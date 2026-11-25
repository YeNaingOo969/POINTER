<?php
// Copy this file to config/auth.php if you want custom local overrides.
// Teammates pulling from GitHub also work out of the box using these shared school-project defaults.
return [
    // Google Identity Services OAuth 2.0 Client ID (Web application).
    // OAuth Client IDs are public identifiers, so teammates pulling from GitHub
    // can test Continue with Google out of the box on http://localhost:5173.
    'google_client_id' => getenv('POINTER_GOOGLE_CLIENT_ID') ?: '794734944891-c1389udvka5n988khj1u9vsmqqt2est5.apps.googleusercontent.com',

    // SMTP settings for sending real 6-digit OTP verification emails (Gmail SMTP).
    'smtp' => [
        'host'       => getenv('POINTER_SMTP_HOST') ?: 'smtp.gmail.com',
        'port'       => (int) (getenv('POINTER_SMTP_PORT') ?: 587),
        'encryption' => getenv('POINTER_SMTP_ENCRYPTION') ?: 'tls', // 'tls' (587) or 'ssl' (465)
        'username'   => getenv('POINTER_SMTP_USER') ?: 'luua0757@gmail.com',
        'password'   => getenv('POINTER_SMTP_PASS') ?: 'hnbxsztmyblogmdo',
        'from_email' => getenv('POINTER_SMTP_FROM_EMAIL') ?: 'luua0757@gmail.com',
        'from_name'  => getenv('POINTER_SMTP_FROM_NAME') ?: 'POINTER',
    ],

    // Optional HTTPS fallback/relay (Google Apps Script Web App URL) over port 443.
    // Use this if your ISP/network blocks outbound SMTP ports 587 and 465.
    'apps_script_url'    => getenv('POINTER_APPS_SCRIPT_URL') ?: '',
    'apps_script_secret' => getenv('POINTER_APPS_SCRIPT_SECRET') ?: '',

    // Local development preview fallback when mail delivery is empty and running on localhost.
    'dev_otp_preview' => false,
];
