<?php
require __DIR__ . '/../../include/bootstrap.php';

$method = require_method('GET', 'POST', 'PUT');
$admin = require_admin();
$pdo = db();

if ($method === 'GET') {
    $status = trim((string) ($_GET['status'] ?? ''));
    $role   = trim((string) ($_GET['role'] ?? ''));
    $q      = trim((string) ($_GET['q'] ?? ''));

    $sql = "SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
                   (SELECT COUNT(*) FROM places p WHERE p.owner_id = u.id) as places_count,
                   (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id) as reviews_count
            FROM users u
            WHERE 1=1";

    $params = [];

    if ($status !== '' && in_array(strtolower($status), ['active', 'suspended'], true)) {
        $sql .= " AND u.status = ?";
        $params[] = strtolower($status);
    }

    if ($role !== '') {
        $sql .= " AND u.role = ?";
        $params[] = strtolower($role);
    }

    if ($q !== '') {
        $sql .= " AND (u.name LIKE ? OR u.email LIKE ?)";
        $wildcard = "%$q%";
        $params[] = $wildcard;
        $params[] = $wildcard;
    }

    $sql .= " ORDER BY u.id DESC";

    $st = $pdo->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll();

    $results = array_map(fn($r) => [
        'id'           => (int) $r['id'],
        'name'         => $r['name'],
        'email'        => $r['email'],
        'role'         => $r['role'],
        'status'       => $r['status'],
        'banned'       => ($r['status'] === 'suspended'),
        'placesCount'  => (int) $r['places_count'],
        'reviewsCount' => (int) $r['reviews_count'],
        'createdAt'    => iso($r['created_at']),
    ], $rows);

    json_out($results);
}

// POST or PUT: Ban / Unban user or modify role
$in = body();
$id = (int) ($in['id'] ?? ($_GET['id'] ?? 0));

if ($id <= 0) {
    fail(422, 'User ID is required');
}

$st = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$st->execute([$id]);
$user = $st->fetch();

if (!$user) {
    fail(404, 'User not found');
}

// Safety check: Cannot ban oneself
if ($id === (int) $admin['id']) {
    fail(403, 'You cannot suspend your own administrative account');
}

$newStatus = $user['status'];
if (isset($in['banned'])) {
    $newStatus = $in['banned'] ? 'suspended' : 'active';
} elseif (isset($in['status'])) {
    $newStatus = strtolower(trim((string) $in['status']));
}

$newRole = isset($in['role']) ? strtolower(trim((string) $in['role'])) : $user['role'];
if (!in_array($newStatus, ['active', 'suspended'], true)) {
    fail(422, 'Status must be active or suspended');
}

$stUp = $pdo->prepare("UPDATE users SET status = ?, role = ? WHERE id = ?");
$stUp->execute([$newStatus, $newRole, $id]);

$auditAction = ($newStatus === 'suspended') ? 'ban_user' : 'unban_user';
log_audit($admin['id'], $auditAction, 'user', $id);

json_out([
    'id'      => $id,
    'name'    => $user['name'],
    'email'   => $user['email'],
    'role'    => $newRole,
    'status'  => $newStatus,
    'banned'  => ($newStatus === 'suspended'),
    'message' => "User {$user['name']} has been " . ($newStatus === 'suspended' ? 'suspended' : 'activated'),
]);
