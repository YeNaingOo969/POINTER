<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/auth_helpers.php';

require_method('POST');
require_csrf();

$in       = body();
$email    = strtolower(trim((string) ($in['email'] ?? '')));
$password = (string) ($in['password'] ?? '');

$pdo = db();
ensure_auth_schema($pdo);

$st = $pdo->prepare('SELECT id, name, email, auth_provider, avatar_url, role, status, password_hash FROM users WHERE email = ?');
$st->execute([$email]);
$row = $st->fetch();

// Same work and same message for "no such email", "wrong password", and Google-only accounts.
$dummy = password_hash('dummy-password-for-timing', PASSWORD_DEFAULT);
$storedHash = ($row && is_string($row['password_hash']) && $row['password_hash'] !== '')
    ? $row['password_hash']
    : $dummy;

$ok = $row && is_string($row['password_hash']) && $row['password_hash'] !== '' && password_verify($password, $storedHash);
if (!$ok) {
    fail(401, 'Wrong email or password');
}
if (is_blocked_status($row['status'])) {
    fail(403, 'This account is suspended');
}

// Upgrade old hashes if PHP's default algorithm changes.
if (password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) {
    $up = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $up->execute([password_hash($password, PASSWORD_DEFAULT), $row['id']]);
}

login_user((int) $row['id']);
json_out(['user' => public_user($row)]);
