<?php
require __DIR__ . '/../../include/bootstrap.php';

require_method('GET');
$admin = require_admin();
$pdo = db();

$action     = trim((string) ($_GET['action'] ?? ''));
$targetType = trim((string) ($_GET['targetType'] ?? ($_GET['target_type'] ?? '')));
$limit      = min(100, max(1, (int) ($_GET['limit'] ?? 50)));

$sql = "SELECT a.id, a.action, a.target_type, a.target_id, a.created_at,
               u.id as admin_id, u.name as admin_name, u.email as admin_email
        FROM audit_log a
        LEFT JOIN users u ON u.id = a.admin_id
        WHERE 1=1";

$params = [];

if ($action !== '' && $action !== 'all') {
    $sql .= " AND a.action = ?";
    $params[] = $action;
}

if ($targetType !== '') {
    $sql .= " AND a.target_type = ?";
    $params[] = $targetType;
}

$sql .= " ORDER BY a.id DESC LIMIT $limit";

$st = $pdo->prepare($sql);
$st->execute($params);
$rows = $st->fetchAll();

$results = array_map(function ($row) use ($pdo) {
    $targetName = '#' . $row['target_id'];
    $targetType = $row['target_type'];
    $targetId   = (int) $row['target_id'];

    if ($targetType === 'place' || $targetType === 'places') {
        $st = $pdo->prepare('SELECT name FROM places WHERE id = ?');
        $st->execute([$targetId]);
        $name = $st->fetchColumn();
        if ($name) $targetName = $name;
    } elseif ($targetType === 'user' || $targetType === 'users') {
        $st = $pdo->prepare('SELECT name, email FROM users WHERE id = ?');
        $st->execute([$targetId]);
        $usr = $st->fetch();
        if ($usr) $targetName = "{$usr['name']} ({$usr['email']})";
    } elseif ($targetType === 'category' || $targetType === 'categories') {
        $st = $pdo->prepare('SELECT name_en, name_my FROM categories WHERE id = ?');
        $st->execute([$targetId]);
        $cat = $st->fetch();
        if ($cat) $targetName = "{$cat['name_en']} / {$cat['name_my']}";
    } elseif ($targetType === 'owner_upgrades') {
        $st = $pdo->prepare('SELECT p.name, u.payment_ref
                             FROM owner_upgrades u
                             LEFT JOIN places p ON p.owner_id = u.user_id
                             WHERE u.id = ?');
        $st->execute([$targetId]);
        $up = $st->fetch();
        if ($up && $up['name']) {
            $targetName = "{$up['name']} (Txn: {$up['payment_ref']})";
        } else {
            $targetName = "Application #PTR-APP-" . str_pad((string)$targetId, 4, '0', STR_PAD_LEFT);
        }
    } elseif ($targetType === 'reports') {
        $st = $pdo->prepare('SELECT reason, target_type, target_id FROM reports WHERE id = ?');
        $st->execute([$targetId]);
        $rep = $st->fetch();
        if ($rep) {
            $targetName = "Report #{$targetId} on {$rep['target_type']}: " . mb_substr($rep['reason'], 0, 40) . '...';
        }
    }

    return [
        'id'         => (int) $row['id'],
        'adminId'    => (int) ($row['admin_id'] ?: 18),
        'adminName'  => $row['admin_name'] ?: 'Admin U Min Thant',
        'adminEmail' => $row['admin_email'] ?: 'admin@pointer.app',
        'action'     => $row['action'],
        'targetType' => $targetType,
        'target_type'=> $targetType,
        'targetId'   => $targetId,
        'target_id'  => $targetId,
        'targetName' => $targetName,
        'createdAt'  => iso($row['created_at']),
    ];
}, $rows);

json_out($results);
