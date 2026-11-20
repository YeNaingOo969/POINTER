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
                   COALESCE(pl.months, 3) as months,
                   COALESCE(pl.amount, 30000) as amount,
                   u.payment_method, u.payment_ref,
                   u.payment_proof, u.status as upgrade_status, u.starts_at, u.expires_at, u.admin_id,
                   u.reviewed_at, u.created_at,
                   usr.name as owner_name, usr.email as owner_email,
                   p.id as place_id, p.name as shop_name, p.phone as shop_phone, p.address as shop_address,
                   p.description as shop_description, p.lat, p.lng, p.storefront_photo, p.status as place_status,
                   c.name_en as category_name, c.name_my as category_name_my
            FROM owner_upgrades u
            LEFT JOIN plans pl ON pl.id = u.plan_id
            LEFT JOIN users usr ON usr.id = u.user_id
            LEFT JOIN places p ON p.owner_id = u.user_id
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

    $sql .= " ORDER BY (u.status = 'pending') DESC, u.created_at DESC";

    $st = $pdo->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll();

    $results = [];
    foreach ($rows as $index => $r) {
        $appNumber = str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT);
        $appId = 'PTR-APP-' . str_pad((string) $r['upgrade_id'], 4, '0', STR_PAD_LEFT);
        
        // Determine whether this is a 'new' shop or a 'renewal'
        $isNew = ($r['place_status'] === 'pending' || $r['starts_at'] === null);
        $appKind = $isNew ? 'new' : 'renewal';

        if ($kind !== '' && $kind !== $appKind) {
            continue;
        }

        $durationLabel = match ((int) $r['months']) {
            12      => '12 Months (Platinum Tier)',
            3       => '3 Months (Gold Tier)',
            default => '1 Month (Silver Tier)',
        };

        $results[] = [
            'id'               => (int) $r['upgrade_id'],
            'appId'            => $appId,
            'number'           => $appNumber,
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

        // 2. Promote user to 'owner'
        $stUser = $pdo->prepare("UPDATE users SET role = 'owner' WHERE id = ?");
        $stUser->execute([$userId]);

        // 3. Activate shop
        $stPlace = $pdo->prepare("UPDATE places SET status = 'active' WHERE owner_id = ? AND status = 'pending'");
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

        // If place was pending, hide it
        $stPlace = $pdo->prepare("UPDATE places SET status = 'hidden' WHERE owner_id = ? AND status = 'pending'");
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
