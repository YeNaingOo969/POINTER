<?php
require __DIR__ . '/../include/bootstrap.php';

require_method('POST');
require_csrf();

$in       = body();
$name     = trim((string) ($in['name'] ?? ''));
$email    = strtolower(trim((string) ($in['email'] ?? '')));
$password = (string) ($in['password'] ?? '');

// Validate again on the server — never trust the page.
if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
    fail(422, 'Name must be 2–100 characters');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) {
    fail(422, 'Enter a valid email address');
}
// bcrypt only uses the first 72 bytes, so cap by bytes.
if (mb_strlen($password) < 8 || strlen($password) > 72) {
    fail(422, 'Password must be 8–72 characters');
}

$pdo = db();
$st = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$st->execute([$email]);
if ($st->fetch()) {
    fail(409, 'Email already registered');
}

try {
    $st = $pdo->prepare('INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, \'user\', \'active\')');
    $st->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') { // two people registered the same email at once
        fail(409, 'Email already registered');
    }
    throw $e;
}

$id = (int) $pdo->lastInsertId();
login_user($id);

json_out(['user' => ['id' => $id, 'name' => $name, 'role' => 'user']], 201);
