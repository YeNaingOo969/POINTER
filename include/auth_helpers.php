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
 * Verify a Google Identity Services ID token JWT via Google's tokeninfo endpoint.
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
    if (!function_exists('curl_init')) {
        throw new RuntimeException('PHP cURL extension is required for Google Sign-In');
    }

    $ch = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $status !== 200) {
        throw new RuntimeException('Could not verify Google sign-in token' . ($curlErr ? ": $curlErr" : ''));
    }

    $info = json_decode($raw, true);
    if (!is_array($info)) {
        throw new RuntimeException('Invalid response from Google');
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
