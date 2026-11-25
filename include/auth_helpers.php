<?php
// Shared validation regexes, auth config loader, and Google ID token verification.
declare(strict_types=1);

/** Load auth configuration from config/auth.php (falling back to config/auth.example.php). */
function auth_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $file = __DIR__ . '/../config/auth.php';
    if (!is_file($file)) {
        $file = __DIR__ . '/../config/auth.example.php';
    }
    $loaded = is_file($file) ? require $file : [];
    $cfg = is_array($loaded) ? $loaded : [];
    return $cfg;
}

function is_smtp_configured(array $cfg): bool
{
    $smtp = $cfg['smtp'] ?? [];
    return trim((string) ($smtp['host'] ?? '')) !== ''
        && trim((string) ($smtp['username'] ?? '')) !== ''
        && (string) ($smtp['password'] ?? '') !== '';
}

function is_apps_script_configured(array $cfg): bool
{
    $url = trim((string) ($cfg['apps_script_url'] ?? ''));
    return $url !== '' && str_starts_with($url, 'https://');
}

function is_mail_delivery_configured(array $cfg): bool
{
    return is_smtp_configured($cfg) || is_apps_script_configured($cfg);
}

function is_local_dev_request(): bool
{
    $addr = $_SERVER['REMOTE_ADDR'] ?? '';
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $hostName = explode(':', $host)[0];
    return in_array($addr, ['127.0.0.1', '::1', ''], true)
        || in_array($hostName, ['localhost', '127.0.0.1', '::1'], true);
}

function can_use_dev_otp_preview(array $cfg): bool
{
    return !is_mail_delivery_configured($cfg)
        && !empty($cfg['dev_otp_preview'])
        && is_local_dev_request();
}

/**
 * Validate display name (2–100 chars, Unicode/Myanmar/Latin letters, spaces, apostrophes, dots, hyphens).
 * Returns an error message string or null when valid.
 */
function validate_registration_name(string $name): ?string
{
    $len = mb_strlen($name, 'UTF-8');
    if ($len < 2 || $len > 100) {
        return 'Name must be 2–100 characters';
    }
    if (!preg_match("/^[\p{L}\p{M}0-9][\p{L}\p{M}0-9\s'.\-]{1,99}$/u", $name) || !preg_match('/\p{L}/u', $name)) {
        return 'Name may contain letters, spaces, dots, hyphens or apostrophes';
    }
    return null;
}

/**
 * Validate email syntax with strict regex + optional DNS MX/A check for real domains.
 * Returns an error message string or null when valid.
 */
function validate_email_format(string $email, bool $checkDns = false): ?string
{
    if ($email === '' || strlen($email) > 150) {
        return 'Enter a valid email address';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return 'Enter a valid email address';
    }
    $parts = explode('@', $email);
    if (count($parts) !== 2) {
        return 'Enter a valid email address';
    }
    [$local, $domain] = $parts;
    if (
        str_contains($local, '..')
        || !preg_match("/^[a-zA-Z0-9](?:[a-zA-Z0-9._%+\-]{0,62}[a-zA-Z0-9])?$/", $local)
        || !preg_match("/^[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/", $domain)
    ) {
        return 'Enter a valid email address';
    }

    if ($checkDns) {
        $lowerDomain = strtolower($domain);
        $blockedTlds = ['test', 'invalid', 'example', 'local', 'localhost'];
        $tld = substr($lowerDomain, strrpos($lowerDomain, '.') + 1);
        if (in_array($tld, $blockedTlds, true)) {
            return 'Please use a real email address (e.g. Gmail)';
        }

        $typos = [
            'gmial.com'   => 'gmail.com',
            'gmal.com'    => 'gmail.com',
            'gamil.com'   => 'gmail.com',
            'gnail.com'   => 'gmail.com',
            'gmail.con'   => 'gmail.com',
            'gmail.co'    => 'gmail.com',
            'yaho.com'    => 'yahoo.com',
            'yahoo.con'   => 'yahoo.com',
            'outlok.com'  => 'outlook.com',
            'hotmal.com'  => 'hotmail.com',
            'hotmail.con' => 'hotmail.com',
        ];
        if (isset($typos[$lowerDomain])) {
            return "Did you mean @{$typos[$lowerDomain]}? Please check your email address.";
        }

        $disposable = [
            'mailinator.com', 'yopmail.com', '10minutemail.com', 'guerrillamail.com',
            'guerrillamailblock.com', 'sharklasers.com', 'tempmail.com', 'temp-mail.org',
            'trashmail.com', 'fakeinbox.com', 'maildrop.cc', 'getnada.com',
            'dispostable.com', 'throwawaymail.com', 'mintemail.com', 'mohmal.com',
            'emailondeck.com', 'burnermail.io', 'tempail.com', 'tmpmail.org',
            'tmpmail.net', 'mailnesia.com', 'example.com', 'example.org', 'example.net',
        ];
        if (in_array($lowerDomain, $disposable, true)) {
            return 'Temporary or disposable email addresses are not allowed.';
        }

        // Only reject on missing MX record when DNS itself is reachable (so offline dev still works).
        if (function_exists('checkdnsrr') && @checkdnsrr('gmail.com', 'MX')) {
            if (!@checkdnsrr($domain, 'MX')) {
                return 'This email domain cannot receive emails. Please use a real email address.';
            }
        }
    }

    return null;
}

/**
 * Enforce modern password rules matching the frontend regex checklist:
 *  - 8–72 bytes (bcrypt limit)
 *  - At least 1 uppercase letter (A-Z)
 *  - At least 1 lowercase letter (a-z)
 *  - At least 1 digit (0-9)
 *  - At least 1 special character
 */
function validate_password_strength(string $password): ?string
{
    if (mb_strlen($password, 'UTF-8') < 8) {
        return 'Password must be at least 8 characters';
    }
    if (strlen($password) > 72) {
        return 'Password must be 72 bytes or shorter';
    }
    if (!preg_match('/[A-Z]/', $password)) {
        return 'Password needs at least one uppercase letter (A-Z)';
    }
    if (!preg_match('/[a-z]/', $password)) {
        return 'Password needs at least one lowercase letter (a-z)';
    }
    if (!preg_match('/[0-9]/', $password)) {
        return 'Password needs at least one number (0-9)';
    }
    if (!preg_match('/[^A-Za-z0-9\s]/', $password)) {
        return 'Password needs at least one special character (e.g. !@#$%)';
    }
    return null;
}

/**
 * Ensure users table & email_verifications table include OTP and Google Sign-In columns.
 * Prevents 500 Server Error when a teammate imports database/pointer.sql without running sql/005 manually.
 */
function ensure_auth_schema(PDO $pdo): void
{
    static $checked = false;
    if ($checked) {
        return;
    }
    $checked = true;

    $hasGoogleCol = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'google_id'")->fetch();
    if (!$hasGoogleCol) {
        $pdo->exec("ALTER TABLE `users` MODIFY COLUMN `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL");
        $pdo->exec("ALTER TABLE `users` ADD COLUMN `google_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL AFTER `password_hash`");
        if (!$pdo->query("SHOW COLUMNS FROM `users` LIKE 'auth_provider'")->fetch()) {
            $pdo->exec("ALTER TABLE `users` ADD COLUMN `auth_provider` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local' AFTER `google_id`");
        }
        if (!$pdo->query("SHOW COLUMNS FROM `users` LIKE 'email_verified_at'")->fetch()) {
            $pdo->exec("ALTER TABLE `users` ADD COLUMN `email_verified_at` datetime NULL DEFAULT NULL AFTER `auth_provider`");
        }
        if (!$pdo->query("SHOW COLUMNS FROM `users` LIKE 'avatar_url'")->fetch()) {
            $pdo->exec("ALTER TABLE `users` ADD COLUMN `avatar_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL AFTER `email_verified_at`");
        }
        if (!$pdo->query("SHOW INDEX FROM `users` WHERE Key_name = 'uq_users_google_id'")->fetch()) {
            $pdo->exec("ALTER TABLE `users` ADD UNIQUE KEY `uq_users_google_id` (`google_id`)");
        }
        $pdo->exec("UPDATE `users` SET `email_verified_at` = COALESCE(`created_at`, NOW()) WHERE `email_verified_at` IS NULL");
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS `email_verifications` (
           `id` int NOT NULL AUTO_INCREMENT,
           `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
           `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
           `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
           `otp_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
           `attempts` int NOT NULL DEFAULT 0,
           `resend_count` int NOT NULL DEFAULT 0,
           `expires_at` datetime NOT NULL,
           `last_sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
           `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
           PRIMARY KEY (`id`),
           UNIQUE KEY `uq_ev_email` (`email`),
           KEY `idx_ev_expires` (`expires_at`)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function find_ca_bundle_path(): ?string
{
    $candidates = [
        ini_get('curl.cainfo') ?: '',
        ini_get('openssl.cafile') ?: '',
        '/etc/ssl/cert.pem',
        '/etc/ssl/certs/ca-certificates.crt',
        '/usr/local/etc/openssl@3/cert.pem',
        '/opt/homebrew/etc/openssl@3/cert.pem',
        'C:\\xampp\\apache\\bin\\curl-ca-bundle.crt',
        'C:\\xampp\\php\\extras\\ssl\\cacert.pem',
    ];
    foreach ($candidates as $path) {
        if ($path !== '' && is_file($path)) {
            return $path;
        }
    }
    return null;
}

function http_get_json(string $url): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('PHP cURL extension is required for Google Sign-In');
    }
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ];
    $ca = find_ca_bundle_path();
    if ($ca !== null) {
        $opts[CURLOPT_CAINFO] = $ca;
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $status !== 200) {
        throw new RuntimeException('Google verification HTTP ' . ($status ?: 'error') . ($curlErr ? ": $curlErr" : ''));
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new RuntimeException('Invalid JSON response from Google');
    }
    return $data;
}

function base64url_decode_strict(string $input): string
{
    $pad = (4 - (strlen($input) % 4)) % 4;
    $decoded = base64_decode(strtr($input, '-_', '+/') . str_repeat('=', $pad), true);
    if ($decoded === false) {
        throw new RuntimeException('Invalid base64url encoding in Google token');
    }
    return $decoded;
}

function der_len(int $len): string
{
    if ($len < 0x80) {
        return chr($len);
    }
    $bytes = '';
    while ($len > 0) {
        $bytes = chr($len & 0xff) . $bytes;
        $len >>= 8;
    }
    return chr(0x80 | strlen($bytes)) . $bytes;
}

function jwk_rsa_to_pem(string $nB64, string $eB64): ?string
{
    $n = base64url_decode_strict($nB64);
    $e = base64url_decode_strict($eB64);
    if ($n === '' || $e === '') {
        return null;
    }
    if (ord($n[0]) > 0x7f) {
        $n = "\x00" . $n;
    }
    if (ord($e[0]) > 0x7f) {
        $e = "\x00" . $e;
    }
    $mod = "\x02" . der_len(strlen($n)) . $n;
    $exp = "\x02" . der_len(strlen($e)) . $e;
    $rsaPub = "\x30" . der_len(strlen($mod . $exp)) . $mod . $exp;
    $algId = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";
    $bitString = "\x03" . der_len(strlen($rsaPub) + 1) . "\x00" . $rsaPub;
    $spki = "\x30" . der_len(strlen($algId . $bitString)) . $algId . $bitString;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

function fetch_google_jwks(bool $forceRefresh = false): array
{
    $cacheFile = sys_get_temp_dir() . '/pointer_google_jwks.json';
    if (!$forceRefresh && is_file($cacheFile) && (time() - (int) @filemtime($cacheFile)) < 21600) {
        $cached = json_decode((string) @file_get_contents($cacheFile), true);
        if (is_array($cached) && !empty($cached['keys'])) {
            return $cached['keys'];
        }
    }
    $jwks = http_get_json('https://www.googleapis.com/oauth2/v3/certs');
    if (empty($jwks['keys']) || !is_array($jwks['keys'])) {
        throw new RuntimeException('Invalid Google JWKS response');
    }
    @file_put_contents($cacheFile, json_encode($jwks));
    return $jwks['keys'];
}

function verify_google_id_token_jwks(string $idToken, string $expectedClientId): array
{
    if (!function_exists('openssl_verify')) {
        throw new RuntimeException('OpenSSL extension unavailable');
    }
    $parts = explode('.', $idToken);
    if (count($parts) !== 3) {
        throw new RuntimeException('Invalid Google credential format');
    }
    [$headB64, $bodyB64, $sigB64] = $parts;
    $header = json_decode(base64url_decode_strict($headB64), true);
    $claims = json_decode(base64url_decode_strict($bodyB64), true);
    $sig = base64url_decode_strict($sigB64);

    if (!is_array($header) || !is_array($claims) || ($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])) {
        throw new RuntimeException('Unsupported Google token header');
    }

    $kid = (string) $header['kid'];
    $keys = fetch_google_jwks(false);
    $matched = null;
    foreach ($keys as $k) {
        if (($k['kid'] ?? '') === $kid) {
            $matched = $k;
            break;
        }
    }
    if ($matched === null) {
        $keys = fetch_google_jwks(true);
        foreach ($keys as $k) {
            if (($k['kid'] ?? '') === $kid) {
                $matched = $k;
                break;
            }
        }
    }
    if ($matched === null || empty($matched['n']) || empty($matched['e'])) {
        throw new RuntimeException('Google signing key not found');
    }

    $pem = jwk_rsa_to_pem((string) $matched['n'], (string) $matched['e']);
    if ($pem === null || openssl_verify($headB64 . '.' . $bodyB64, $sig, $pem, OPENSSL_ALGO_SHA256) !== 1) {
        throw new RuntimeException('Google token signature invalid');
    }
    return $claims;
}

/**
 * Verify a Google Identity Services ID token JWT via local JWKS signature verification
 * (with cached public keys) and tokeninfo fallback.
 * Returns ['sub' => string, 'email' => string, 'name' => string, 'picture' => ?string].
 *
 * @throws RuntimeException on invalid/untrusted token or network failure.
 */
function verify_google_id_token(string $idToken, string $expectedClientId): array
{
    if ($expectedClientId === '') {
        throw new RuntimeException('Google Client ID is not configured');
    }
    if ($idToken === '' || substr_count($idToken, '.') !== 2) {
        throw new RuntimeException('Invalid Google credential format');
    }

    $info = null;
    try {
        $info = verify_google_id_token_jwks($idToken, $expectedClientId);
    } catch (Throwable $jwksErr) {
        try {
            $info = http_get_json('https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken));
        } catch (Throwable $tokenErr) {
            throw new RuntimeException('Could not verify Google sign-in token: ' . $tokenErr->getMessage());
        }
    }

    $aud = (string) ($info['aud'] ?? '');
    $iss = (string) ($info['iss'] ?? '');
    $exp = (int) ($info['exp'] ?? 0);
    $sub = trim((string) ($info['sub'] ?? ''));
    $email = strtolower(trim((string) ($info['email'] ?? '')));
    $verified = ($info['email_verified'] ?? false) === true || ($info['email_verified'] ?? '') === 'true';

    if ($aud !== $expectedClientId) {
        throw new RuntimeException('Google token audience mismatch');
    }
    if (!in_array($iss, ['https://accounts.google.com', 'accounts.google.com'], true)) {
        throw new RuntimeException('Google token issuer invalid');
    }
    if ($exp <= time() - 30) {
        throw new RuntimeException('Google token has expired');
    }
    if (!$verified || $sub === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('Your Google account email is not verified');
    }

    $name = trim((string) ($info['name'] ?? ''));
    if ($name === '') {
        $name = strstr($email, '@', true) ?: 'POINTER User';
    }
    if (mb_strlen($name, 'UTF-8') > 100) {
        $name = mb_substr($name, 0, 100, 'UTF-8');
    }
    $picture = isset($info['picture']) && is_string($info['picture']) ? trim($info['picture']) : null;
    if ($picture !== null && strlen($picture) > 500) {
        $picture = null;
    }

    return [
        'sub'     => $sub,
        'email'   => $email,
        'name'    => $name,
        'picture' => $picture,
    ];
}
