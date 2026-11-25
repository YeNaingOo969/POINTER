<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/auth_helpers.php';

require_method('POST');
require_csrf();

$in = body();
$credential = trim((string) ($in['credential'] ?? ''));

$cfg = auth_config();
$clientId = trim((string) ($cfg['google_client_id'] ?? ''));
if ($clientId === '') {
    fail(503, 'Google Sign-In is not configured on the server yet.');
}

try {
    $gUser = verify_google_id_token($credential, $clientId);
} catch (RuntimeException $e) {
    fail(401, $e->getMessage());
}

$pdo = db();
$st = $pdo->prepare(
    'SELECT id, name, email, password_hash, google_id, auth_provider, avatar_url, role, status
     FROM users
     WHERE google_id = ? OR email = ?
     LIMIT 1'
);
$st->execute([$gUser['sub'], $gUser['email']]);
$row = $st->fetch();

if ($row) {
    if (is_blocked_status($row['status'])) {
        fail(403, 'This account is suspended');
    }

    $newProvider = ($row['password_hash'] !== null && $row['password_hash'] !== '') ? 'both' : 'google';
    $newAvatar = $gUser['picture'] ?: $row['avatar_url'];

    $up = $pdo->prepare(
        'UPDATE users
         SET google_id = ?,
             auth_provider = ?,
             avatar_url = ?,
             email_verified_at = COALESCE(email_verified_at, NOW())
         WHERE id = ?'
    );
    $up->execute([$gUser['sub'], $newProvider, $newAvatar, (int) $row['id']]);

    $row['google_id'] = $gUser['sub'];
    $row['auth_provider'] = $newProvider;
    $row['avatar_url'] = $newAvatar;

    login_user((int) $row['id']);
    json_out(['user' => public_user($row)], 200);
}

$ins = $pdo->prepare(
    "INSERT INTO users (name, email, password_hash, google_id, auth_provider, email_verified_at, avatar_url, role, status)
     VALUES (?, ?, NULL, ?, 'google', NOW(), ?, 'user', 'active')"
);
$ins->execute([$gUser['name'], $gUser['email'], $gUser['sub'], $gUser['picture']]);
$id = (int) $pdo->lastInsertId();

login_user($id);
json_out([
    'user' => [
        'id'           => $id,
        'name'         => $gUser['name'],
        'email'        => $gUser['email'],
        'authProvider' => 'google',
        'avatarUrl'    => $gUser['picture'],
        'role'         => 'user',
    ],
], 201);
