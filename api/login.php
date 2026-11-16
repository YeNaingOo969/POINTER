<?php
require __DIR__ . '/../include/bootstrap.php';

require_method('POST');
require_csrf();

$in       = body();
$email    = strtolower(trim((string) ($in['email'] ?? '')));
$password = (string) ($in['password'] ?? '');

$st = db()->prepare('SELECT id, name, role, status, password_hash FROM users WHERE email = ?');
$st->execute([$email]);
$row = $st->fetch();

// Same work and same message for "no such email" and "wrong password".
$hash = $row['password_hash'] ?? password_hash('dummy-password-for-timing', PASSWORD_DEFAULT);
$ok   = password_verify($password, $hash) && $row;
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
