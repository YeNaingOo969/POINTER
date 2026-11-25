<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/auth_helpers.php';
require __DIR__ . '/../include/mailer.php';

require_method('POST');
require_csrf();

$in       = body();
$name     = trim((string) ($in['name'] ?? ''));
$email    = strtolower(trim((string) ($in['email'] ?? '')));
$password = (string) ($in['password'] ?? '');
$resend   = !empty($in['resend']);

if ($err = validate_email_format($email, true)) {
    fail(422, $err);
}

$pdo = db();
ensure_auth_schema($pdo);

// Remove stale expired rows opportunistically.
$pdo->exec('DELETE FROM email_verifications WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)');

$st = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$st->execute([$email]);
if ($st->fetch()) {
    fail(409, 'Email already registered');
}

$stPending = $pdo->prepare(
    'SELECT id, name, password_hash, resend_count,
            TIMESTAMPDIFF(SECOND, last_sent_at, NOW()) AS seconds_since_sent,
            TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_left
     FROM email_verifications
     WHERE email = ?'
);
$stPending->execute([$email]);
$pending = $stPending->fetch();

if ($pending) {
    $since = (int) $pending['seconds_since_sent'];
    $cooldown = $resend ? 45 : 10;
    if ($since >= 0 && $since < $cooldown) {
        $wait = $cooldown - $since;
        fail(429, "Please wait {$wait}s before requesting a new verification code");
    }
    if ((int) $pending['seconds_left'] > 0 && (int) $pending['resend_count'] >= 10) {
        fail(429, 'Too many code requests. Please try again later.');
    }
}

// Support resending from step 2 without forcing password re-entry if already stored cleanly.
if ($resend && $pending && $name === '' && $password === '') {
    $name = $pending['name'];
    $passwordHash = $pending['password_hash'];
} else {
    if ($err = validate_registration_name($name)) {
        fail(422, $err);
    }
    if ($err = validate_password_strength($password)) {
        fail(422, $err);
    }
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
}

$cfg = auth_config();
$appsScriptReady = is_apps_script_configured($cfg);
$smtpReady = is_smtp_configured($cfg);
$mailReady = $appsScriptReady || $smtpReady;
$devPreview = can_use_dev_otp_preview($cfg);

if (!$mailReady && !$devPreview) {
    fail(503, 'Email verification service is not configured on the server yet.');
}

$code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$otpHash = password_hash($code, PASSWORD_DEFAULT);

$deliveryMode = 'dev_preview';
if ($appsScriptReady) {
    try {
        apps_script_send_otp_email((string) $cfg['apps_script_url'], (string) ($cfg['apps_script_secret'] ?? ''), $email, $name, $code);
        $deliveryMode = 'https_relay';
    } catch (Throwable $e) {
        error_log('OTP HTTPS relay failed: ' . $e->getMessage());
        if (!$smtpReady) {
            $detail = is_local_dev_request() ? ' (' . $e->getMessage() . ')' : '';
            fail(502, 'Could not send verification email' . $detail . '. Please try again.');
        }
    }
}

if ($deliveryMode === 'dev_preview' && $smtpReady) {
    try {
        send_verification_otp_email($cfg['smtp'], $email, $name, $code);
        $deliveryMode = 'smtp';
    } catch (Throwable $e) {
        error_log('OTP SMTP delivery failed: ' . $e->getMessage());
        $detail = is_local_dev_request() ? ' (' . $e->getMessage() . ')' : '';
        fail(502, 'Could not send verification email' . $detail . '. Please check SMTP/network configuration and try again.');
    }
}

$upsert = $pdo->prepare(
    'INSERT INTO email_verifications (email, name, password_hash, otp_hash, attempts, resend_count, expires_at, last_sent_at)
     VALUES (?, ?, ?, ?, 0, 0, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW())
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       password_hash = VALUES(password_hash),
       otp_hash = VALUES(otp_hash),
       attempts = 0,
       resend_count = IF(expires_at < NOW(), 0, resend_count + 1),
       expires_at = VALUES(expires_at),
       last_sent_at = NOW()'
);
$upsert->execute([$email, $name, $passwordHash, $otpHash]);

if ($deliveryMode !== 'dev_preview') {
    json_out([
        'ok'             => true,
        'delivery'       => $deliveryMode,
        'expiresIn'      => 600,
        'resendCooldown' => 60,
    ]);
}

// Local dev preview before Gmail SMTP password is configured
error_log("POINTER dev OTP for {$email}: {$code}");
json_out([
    'ok'             => true,
    'delivery'       => 'dev_preview',
    'devCode'        => $code,
    'expiresIn'      => 600,
    'resendCooldown' => 60,
]);
