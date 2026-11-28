<?php
require __DIR__ . '/../../include/bootstrap.php';

$method = require_method('GET', 'POST');
$admin = require_admin();
$pdo = db();

if ($method === 'GET') {
    $kind   = trim((string) ($_GET['kind'] ?? ''));
    $status = trim((string) ($_GET['status'] ?? ''));
    $q      = trim((string) ($_GET['q'] ?? ''));

    $sql = "SELECT u.id as upgrade_id, u.user_id, u.plan_id,
                   COALESCE(NULLIF(u.months, 0), pl.months, 3) as months,
                   COALESCE(NULLIF(u.amount, 0), pl.amount, 30000) as amount,
                   u.payment_method, u.payment_ref,
                   u.payment_proof, u.status as upgrade_status, u.starts_at, u.expires_at, u.admin_id,
                   u.reviewed_at, u.created_at,
                   usr.name as owner_name, usr.email as owner_email,
                   p.id as place_id, p.name as shop_name, p.phone as shop_phone, p.address as shop_address,
                   p.description as shop_description, p.lat, p.lng, p.storefront_photo, p.status as place_status,
                   c.name_en as category_name, c.name_my as category_name_my,
                   EXISTS (
                       SELECT 1 FROM owner_upgrades prev
                       WHERE prev.user_id = u.user_id AND prev.status = 'approved' AND prev.id < u.id
                   ) as has_prior_approved
            FROM owner_upgrades u
            LEFT JOIN plans pl ON pl.id = u.plan_id
            LEFT JOIN users usr ON usr.id = u.user_id
            LEFT JOIN places p ON p.id = (
                SELECT p2.id
                FROM places p2
                WHERE p2.owner_id = u.user_id
                ORDER BY FIELD(p2.status, 'pending', 'active', 'hidden', 'rejected'), p2.id ASC
                LIMIT 1
            )
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE 1=1";

    $params = [];

    if ($status !== '' && in_array(strtolower($status), ['pending', 'approved', 'rejected'], true)) {
        $sql .= " AND LOWER(u.status) = ?";
        $params[] = strtolower($status);
    }

    if ($q !== '') {
        $sql .= " AND (p.name LIKE ? OR usr.name LIKE ? OR usr.email LIKE ? OR u.payment_ref LIKE ?)";
        $wildcard = "%$q%";
        $params[] = $wildcard;
        $params[] = $wildcard;
        $params[] = $wildcard;
        $params[] = $wildcard;
    }

    $sql .= " ORDER BY (u.status = 'pending') DESC, u.created_at DESC, u.id DESC";

    $st = $pdo->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll();

    $results = [];
    foreach ($rows as $r) {
        $appId = 'PTR-APP-' . str_pad((string) $r['upgrade_id'], 4, '0', STR_PAD_LEFT);

        // Determine whether this is a 'new' shop request or an existing owner's 'renewal'
        $isNew = (
            $r['place_status'] === 'pending'
            || $r['place_status'] === 'rejected'
            || $r['place_id'] === null
            || (
                strtolower((string) $r['upgrade_status']) !== 'pending'
                && (int) $r['has_prior_approved'] === 0
                && (int) $r['upgrade_id'] >= 6
            )
        );
        $appKind = $isNew ? 'new' : 'renewal';

        if ($kind !== '' && $kind !== $appKind) {
            continue;
        }

        $appNumber = str_pad((string) (count($results) + 1), 2, '0', STR_PAD_LEFT);

        $durationLabel = match ((int) $r['months']) {
            12      => '12 Months (Platinum Tier)',
            6       => '6 Months (Gold Tier)',
            3       => '3 Months (Gold Tier)',
            default => '1 Month (Silver Tier)',
        };

        $results[] = [
            'id'               => (int) $r['upgrade_id'],
            'appId'            => $appId,
            'number'           => $appNumber,
            'placeId'          => $r['place_id'] ? (int) $r['place_id'] : null,
            'placeStatus'      => $r['place_status'],
            'shopName'         => $r['shop_name'] ?: 'Pending Registration Store',
            'category'         => $r['category_name'] ?: 'General Store',
            'categoryMy'       => $r['category_name_my'] ?: '',
            'owner'            => $r['owner_name'] ?: 'Unknown Merchant',
            'ownerId'          => (int) $r['user_id'],
            'email'            => $r['owner_email'] ?: '',
            'phone'            => $r['shop_phone'] ?: '',
            'address'          => $r['shop_address'] ?: '',
            'description'      => $r['shop_description'] ?: '',
            'coordinates'      => "{$r['lat']}° N, {$r['lng']}° E",
            'lat'              => (float) $r['lat'],
            'lng'              => (float) $r['lng'],
            'mapUrl'           => "https://maps.google.com/?q={$r['lat']},{$r['lng']}",
            'storefrontPhoto'  => $r['storefront_photo'],
            'kind'             => $appKind,
            'type'             => $appKind,
            'typeLabel'        => $isNew ? 'New Shop' : 'Renewal',
            'duration'         => $durationLabel,
            'months'           => (int) $r['months'],
            'paymentRaw'       => (float) $r['amount'],
            'paymentFormatted' => number_format((float) $r['amount']) . ' MMK',
            'paymentMethod'    => $r['payment_method'],
            'paymentRef'       => $r['payment_ref'],
            'txnId'            => $r['payment_ref'],
            'paymentProof'     => $r['payment_proof'],
            'status'           => ucfirst($r['upgrade_status']),
            'submittedDate'    => iso($r['created_at']),
            'paymentDate'      => $r['created_at'] . ' MMT',
            'startsAt'         => iso($r['starts_at']),
            'expiresAt'        => iso($r['expires_at']),
            'adminId'          => $r['admin_id'] ? (int) $r['admin_id'] : null,
            'reviewedAt'       => iso($r['reviewed_at']),
        ];
    }

    json_out($results);
}

// POST: Approve or Reject application
$in = body();
$rawId = $in['id'] ?? null;
if (!$rawId) {
    fail(422, 'Application ID is required');
}

// Handle both numeric ID (1) and string identifier ('PTR-APP-0001')
$upgradeId = is_numeric($rawId) ? (int) $rawId : (int) preg_replace('/\D/', '', (string) $rawId);
$action    = strtolower(trim((string) ($in['action'] ?? '')));
$reason    = trim((string) ($in['reason'] ?? ''));

if (!in_array($action, ['approve', 'reject'], true)) {
    fail(422, 'Action must be approve or reject');
}

$st = $pdo->prepare('SELECT u.*, COALESCE(pl.months, 3) as months FROM owner_upgrades u LEFT JOIN plans pl ON pl.id = u.plan_id WHERE u.id = ?');
$st->execute([$upgradeId]);
$upgrade = $st->fetch();

if (!$upgrade) {
    fail(404, 'Application not found');
}

$userId = (int) $upgrade['user_id'];
$months = (int) ($upgrade['months'] ?? 3);
if ($months <= 0) $months = 3;

if ($action === 'approve') {
    $pdo->beginTransaction();
    try {
        // Calculate validity
        $stCalc = $pdo->query("SELECT NOW() as now_time, DATE_ADD(NOW(), INTERVAL $months MONTH) as expire_time");
        $calcTimes = $stCalc->fetch();
        $startsAt  = $calcTimes['now_time'];
        $expiresAt = $calcTimes['expire_time'];

        // 1. Update owner_upgrades
        $stUp = $pdo->prepare("UPDATE owner_upgrades
                               SET status = 'approved', starts_at = ?, expires_at = ?, admin_id = ?, reviewed_at = NOW()
                               WHERE id = ?");
        $stUp->execute([$startsAt, $expiresAt, $admin['id'], $upgradeId]);

        // 2. Promote user to 'owner' (keep admin accounts untouched)
        $stUser = $pdo->prepare("UPDATE users SET role = 'owner' WHERE id = ? AND role <> 'admin'");
        $stUser->execute([$userId]);

        // 3. Activate shop (pending or previously rejected new application)
        $stPlace = $pdo->prepare("UPDATE places SET status = 'active' WHERE owner_id = ? AND status IN ('pending', 'rejected')");
        $stPlace->execute([$userId]);

        // 4. Audit Log
        log_audit($admin['id'], 'approve_upgrade', 'owner_upgrades', $upgradeId);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    json_out([
        'id'        => $upgradeId,
        'status'    => 'Approved',
        'startsAt'  => iso($startsAt),
        'expiresAt' => iso($expiresAt),
        'message'   => 'Application approved successfully',
    ]);
} else {
    // Reject
    $pdo->beginTransaction();
    try {
        $stUp = $pdo->prepare("UPDATE owner_upgrades
                               SET status = 'rejected', admin_id = ?, reviewed_at = NOW()
                               WHERE id = ?");
        $stUp->execute([$admin['id'], $upgradeId]);

        // Mark pending place as rejected (so it does not appear in Shops / Map and user can re-apply)
        $stPlace = $pdo->prepare("UPDATE places SET status = 'rejected' WHERE owner_id = ? AND status = 'pending'");
        $stPlace->execute([$userId]);

        log_audit($admin['id'], 'reject_upgrade', 'owner_upgrades', $upgradeId);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    json_out([
        'id'             => $upgradeId,
        'status'         => 'Rejected',
        'rejectReason'   => $reason,
        'message'        => 'Application rejected',
    ]);
}
