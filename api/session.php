<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/auth_helpers.php';

require_method('GET');
$user = current_user(); // also starts the session and creates the CSRF token
$cfg = auth_config();
$googleClientId = trim((string) ($cfg['google_client_id'] ?? ''));

json_out([
    'user'           => $user,
    'csrfToken'      => $_SESSION['csrf'],
    'googleClientId' => $googleClientId !== '' ? $googleClientId : null,
    'otpDelivery'    => is_apps_script_configured($cfg) ? 'https_relay' : (is_smtp_configured($cfg) ? 'smtp' : (can_use_dev_otp_preview($cfg) ? 'dev_preview' : 'unconfigured')),
]);
