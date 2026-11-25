<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/auth_helpers.php';

require_method('GET');
start_session();

$user = null;
$dbError = null;
try {
    db();
    $user = current_user();
} catch (PDOException $e) {
    error_log('Session DB check failed: ' . $e->getMessage());
    if (is_local_request()) {
        $dbError = local_db_error_message($e);
    }
}

$cfg = auth_config();
$googleClientId = trim((string) ($cfg['google_client_id'] ?? ''));

json_out([
    'user'           => $user,
    'csrfToken'      => $_SESSION['csrf'],
    'googleClientId' => $googleClientId !== '' ? $googleClientId : null,
    'otpDelivery'    => is_apps_script_configured($cfg) ? 'https_relay' : (is_smtp_configured($cfg) ? 'smtp' : (can_use_dev_otp_preview($cfg) ? 'dev_preview' : 'unconfigured')),
    'dbError'        => $dbError,
]);
