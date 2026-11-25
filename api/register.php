<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/auth_helpers.php';

require_method('POST');
require_csrf();

$in    = body();
$email = strtolower(trim((string) ($in['email'] ?? '')));
$code  = trim((string) ($in['code'] ?? ''));

if ($err = validate_email_format($email, false)) {
    fail(422, $err);
}
if (!preg_match('/^\d{6}$/', $code)) {
    fail(422, 'Enter the 6-digit verification code sent to your email');
}

$pdo = db();
ensure_auth_schema($pdo);
$st = $pdo->prepare(
    'SELECT id, email, name, password_hash, otp_hash, attempts,
            TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_left
     FROM email_verifications
     WHERE email = ?'
);
$st->execute([$email]);
$pending = $st->fetch();

if (!$pending) {
    fail(422, 'No pending verification found. Please request a verification code.');
}
if ((int) $pending['seconds_left'] <= 0) {
    fail(422, 'Verification code has expired. Please request a new code.');
}
if ((int) $pending['attempts'] >= 5) {
    fail(429, 'Too many wrong attempts. Please request a new verification code.');
}

if (!password_verify($code, $pending['otp_hash'])) {
    $pdo->prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?')
        ->execute([(int) $pending['id']]);
    $left = max(0, 4 - (int) $pending['attempts']);
    $msg = $left > 0
        ? "Incorrect verification code ({$left} attempts left)"
        : 'Incorrect code. Too many attempts — please request a new code.';
    fail(422, $msg);
}

$pdo->beginTransaction();
try {
    $exists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) {
        $pdo->rollBack();
        fail(409, 'Email already registered');
    }

    $ins = $pdo->prepare(
        "INSERT INTO users (name, email, password_hash, auth_provider, email_verified_at, role, status)
         VALUES (?, ?, ?, 'local', NOW(), 'user', 'active')"
    );
    $ins->execute([$pending['name'], $email, $pending['password_hash']]);
    $id = (int) $pdo->lastInsertId();

    $pdo->prepare('DELETE FROM email_verifications WHERE id = ?')->execute([(int) $pending['id']]);
    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($e->getCode() === '23000') {
        fail(409, 'Email already registered');
    }
    throw $e;
}

login_user($id);

json_out([
    'user' => [
        'id'           => $id,
        'name'         => $pending['name'],
        'email'        => $email,
        'authProvider' => 'local',
        'role'         => 'user',
    ],
], 201);
