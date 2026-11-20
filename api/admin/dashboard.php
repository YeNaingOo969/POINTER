<?php
require __DIR__ . '/../../include/bootstrap.php';

require_method('GET');
$admin = require_admin();
$pdo = db();

// 1. Core Summary Metrics
$newShops = (int) $pdo->query("SELECT COUNT(*) FROM places WHERE owner_id IS NOT NULL AND status = 'pending'")->fetchColumn();
$pendingPayments = (int) $pdo->query("SELECT COUNT(*) FROM owner_upgrades WHERE status = 'pending'")->fetchColumn();
$openReports = (int) $pdo->query("SELECT COUNT(*) FROM reports WHERE status = 'open'")->fetchColumn();
$openAppeals = (int) $pdo->query("SELECT COUNT(*) FROM reports WHERE target_type = 'place' AND status = 'open'")->fetchColumn();
$shopsLive = (int) $pdo->query("SELECT COUNT(*) FROM places WHERE owner_id IS NOT NULL AND status = 'active'")->fetchColumn();
$totalShops = (int) $pdo->query("SELECT COUNT(*) FROM places WHERE owner_id IS NOT NULL")->fetchColumn();
$totalPlaces = (int) $pdo->query("SELECT COUNT(*) FROM places WHERE owner_id IS NULL")->fetchColumn();
$totalUsers = (int) $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
$bannedUsers = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE status = 'suspended'")->fetchColumn();
$totalReviews = (int) $pdo->query("SELECT COUNT(*) FROM reviews")->fetchColumn();
$totalCategories = (int) $pdo->query("SELECT COUNT(*) FROM categories")->fetchColumn();

// 2. Weekly Registration Breakdown (Monday to Sunday)
$dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
$weeklyBreakdown = [];
foreach ($dayNames as $d) {
    $weeklyBreakdown[$d] = ['users' => 0, 'shops' => 0, 'places' => 0];
}

$userDays = $pdo->query("SELECT DATE_FORMAT(created_at, '%a') as day_name, COUNT(*) as cnt
                         FROM users
                         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                         GROUP BY day_name")->fetchAll();
foreach ($userDays as $r) {
    if (isset($weeklyBreakdown[$r['day_name']])) {
        $weeklyBreakdown[$r['day_name']]['users'] = (int) $r['cnt'];
    }
}

$shopDays = $pdo->query("SELECT DATE_FORMAT(created_at, '%a') as day_name, COUNT(*) as cnt
                         FROM places
                         WHERE owner_id IS NOT NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                         GROUP BY day_name")->fetchAll();
foreach ($shopDays as $r) {
    if (isset($weeklyBreakdown[$r['day_name']])) {
        $weeklyBreakdown[$r['day_name']]['shops'] = (int) $r['cnt'];
    }
}

$placeDays = $pdo->query("SELECT DATE_FORMAT(created_at, '%a') as day_name, COUNT(*) as cnt
                          FROM places
                          WHERE owner_id IS NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                          GROUP BY day_name")->fetchAll();
foreach ($placeDays as $r) {
    if (isset($weeklyBreakdown[$r['day_name']])) {
        $weeklyBreakdown[$r['day_name']]['places'] = (int) $r['cnt'];
    }
}

// 3. Category Distribution
$categories = $pdo->query("SELECT c.id, c.name_en, c.name_my, c.group_name, COUNT(p.id) as places_count
                           FROM categories c
                           LEFT JOIN places p ON p.category_id = c.id
                           GROUP BY c.id, c.name_en, c.name_my, c.group_name
                           ORDER BY places_count DESC, c.id ASC")->fetchAll();

$categoriesFormatted = array_map(fn($c) => [
    'id'          => (int) $c['id'],
    'nameEn'      => $c['name_en'],
    'nameMy'      => $c['name_my'],
    'groupName'   => $c['group_name'],
    'placesCount' => (int) $c['places_count'],
], $categories);

// 4. Latest Audit Trail
$stAudit = $pdo->query("SELECT a.id, a.action, a.target_type, a.target_id, a.created_at,
                               u.name as admin_name, u.email as admin_email
                        FROM audit_log a
                        LEFT JOIN users u ON u.id = a.admin_id
                        ORDER BY a.id DESC
                        LIMIT 10");
$auditRows = $stAudit->fetchAll();

$latestAuditLog = array_map(function ($row) use ($pdo) {
    $targetName = '#' . $row['target_id'];
    if ($row['target_type'] === 'place' || $row['target_type'] === 'places') {
        $st = $pdo->prepare('SELECT name FROM places WHERE id = ?');
        $st->execute([(int) $row['target_id']]);
        $targetName = $st->fetchColumn() ?: $targetName;
    } elseif ($row['target_type'] === 'user' || $row['target_type'] === 'users') {
        $st = $pdo->prepare('SELECT name FROM users WHERE id = ?');
        $st->execute([(int) $row['target_id']]);
        $targetName = $st->fetchColumn() ?: $targetName;
    } elseif ($row['target_type'] === 'category' || $row['target_type'] === 'categories') {
        $st = $pdo->prepare('SELECT name_en FROM categories WHERE id = ?');
        $st->execute([(int) $row['target_id']]);
        $targetName = $st->fetchColumn() ?: $targetName;
    } elseif ($row['target_type'] === 'owner_upgrades') {
        $st = $pdo->prepare('SELECT p.name FROM owner_upgrades u JOIN places p ON p.owner_id = u.user_id WHERE u.id = ?');
        $st->execute([(int) $row['target_id']]);
        $targetName = $st->fetchColumn() ?: ('Upgrade #' . $row['target_id']);
    }

    return [
        'id'         => (int) $row['id'],
        'adminName'  => $row['admin_name'] ?: 'Super Admin',
        'adminEmail' => $row['admin_email'] ?: 'admin@pointer.app',
        'action'     => $row['action'],
        'targetType' => $row['target_type'],
        'targetId'   => (int) $row['target_id'],
        'targetName' => $targetName,
        'createdAt'  => iso($row['created_at']),
    ];
}, $auditRows);

json_out([
    'stats' => [
        'newShops'        => $newShops,
        'pendingPayments' => $pendingPayments,
        'openReports'     => $openReports,
        'openAppeals'     => $openAppeals,
        'shopsLive'       => $shopsLive,
        'totalShops'      => $totalShops,
        'totalPlaces'     => $totalPlaces,
        'totalUsers'      => $totalUsers,
        'bannedUsers'     => $bannedUsers,
        'totalReviews'    => $totalReviews,
        'totalCategories' => $totalCategories,
    ],
    'weeklyGrowth'   => $weeklyBreakdown,
    'categories'     => $categoriesFormatted,
    'latestAuditLog' => $latestAuditLog,
]);
