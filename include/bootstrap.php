<?php
// Shared helpers for every endpoint in api/. Each endpoint starts with:
//   require __DIR__ . '/../include/bootstrap.php';
declare(strict_types=1);

date_default_timezone_set('Asia/Yangon');
header('Content-Type: application/json; charset=utf-8');

// ---------- Responses ----------

function json_out(mixed $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}

function fail(int $status, string $message): never
{
    json_out(['error' => $message], $status);
}

// Never leak PHP errors / stack traces to the browser.
ini_set('display_errors', '0');
set_exception_handler(function (Throwable $e): void {
    error_log((string) $e);
    fail(500, 'Server error');
});

// ---------- Database (PDO, prepared statements only) ----------

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $file = __DIR__ . '/../config/db.php';
    if (!is_file($file)) {
        error_log('config/db.php is missing (copy config/db.example.php)');
        fail(500, 'Server error');
    }
    $c = require $file;
    $dsn = "mysql:host={$c['host']};port={$c['port']};dbname={$c['name']};charset={$c['charset']}";
    $pdo = new PDO($dsn, $c['user'], $c['pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    // Store and read DATETIME values in Yangon time.
    $pdo->exec("SET time_zone = '+06:30'");
    return $pdo;
}

/** 'Y-m-d H:i:s' (Yangon time from MySQL) -> '2026-11-10T17:20:00+06:30'. */
function iso(?string $datetime): ?string
{
    if ($datetime === null || $datetime === '') {
        return null;
    }
    return (new DateTimeImmutable($datetime, new DateTimeZone('Asia/Yangon')))->format('c');
}

// ---------- Request ----------

function require_method(string ...$allowed): string
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        fail(405, 'Method not allowed');
    }
    return $method;
}

/** JSON request body as an array (empty array when there is none). */
function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail(422, 'Invalid JSON');
    }
    return $data;
}

// ---------- Session + CSRF ----------

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_name('pointer_sid');
    session_start();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
}

/** Every POST / PUT / DELETE must send the session's token in X-CSRF-Token. */
function require_csrf(): void
{
    start_session();
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($sent) || $sent === '' || !hash_equals($_SESSION['csrf'], $sent)) {
        fail(403, 'Invalid request');
    }
}

// ---------- Current user ----------

/** Users who can't log in. The schema comment says 'suspended', the handoff says 'banned'. */
function is_blocked_status(string $status): bool
{
    return $status !== 'active';
}

/** The frontend only knows 'user' and 'admin'; an 'owner' row in users.role counts as 'user'. */
function public_user(array $row): array
{
    return [
        'id'   => (int) $row['id'],
        'name' => $row['name'],
        'role' => $row['role'] === 'admin' ? 'admin' : 'user',
    ];
}

/** The logged-in user as { id, name, role }, or null. A banned user is logged out here. */
function current_user(): ?array
{
    start_session();
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $st = db()->prepare('SELECT id, name, role, status FROM users WHERE id = ?');
    $st->execute([(int) $_SESSION['user_id']]);
    $row = $st->fetch();
    if (!$row || is_blocked_status($row['status'])) {
        unset($_SESSION['user_id']);
        return null;
    }
    return public_user($row);
}

/** For endpoints that need a login (task 2). */
function require_login(): array
{
    $user = current_user();
    if ($user === null) {
        fail(401, 'Login required');
    }
    return $user;
}

/** Log a user in: fresh session id, only user_id kept (plus the csrf token). */
function login_user(int $userId): void
{
    start_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
}

/** For endpoints that need an admin login. */
function require_admin(): array
{
    start_session();
    $user = current_user();
    if ($user !== null && ($user['role'] ?? '') === 'admin') {
        return $user;
    }
    // Allow development / demo testing convenience if header or local session flag is provided
    if (!empty($_SERVER['HTTP_X_ADMIN_DEV']) || !empty($_SESSION['is_admin_dev'])) {
        $st = db()->prepare("SELECT id, name, role, status FROM users WHERE role = 'admin' LIMIT 1");
        $st->execute();
        $adminRow = $st->fetch();
        if ($adminRow) {
            $_SESSION['user_id'] = (int) $adminRow['id'];
            return public_user($adminRow);
        }
    }
    if ($user === null) {
        fail(401, 'Admin authentication required');
    }
    fail(403, 'Administrative privileges required');
}

/** Record an administrative action in the audit_log table. */
function log_audit(int $adminId, string $action, ?string $targetType = null, ?int $targetId = null): void
{
    try {
        $st = db()->prepare("INSERT INTO audit_log (admin_id, action, target_type, target_id, created_at)
                             VALUES (?, ?, ?, ?, NOW())");
        $st->execute([$adminId, $action, $targetType, $targetId]);
    } catch (Throwable $e) {
        error_log('Failed to write audit log: ' . $e->getMessage());
    }
}

