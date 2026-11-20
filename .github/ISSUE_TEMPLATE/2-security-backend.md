---
name: "[Security] Core Security Architecture & Hardening"
about: "Core security architecture, auth hardening, CSRF, RBAC, and secure upload pipeline for khanthtoonaing4-dev"
title: "[Security] Core Security Architecture & Hardening"
labels: ["backend", "security", "high-priority"]
assignees: "khanhttoonaing4-dev"
---

## 🛡️ Assigned To: @khanhttoonaing4-dev
**Role:** Security Engineer & Backend Architect  
**Components:** `include/`, `config/`, `api/session.php`, `api/login.php`, `api/register.php`, `api/logout.php`  
**Database Tables:** `users`, `audit_log`, `blocks`, `reports`

---

## 1. Overview & Context

This task encompasses the end-to-end **Security Architecture** for the POINTER project.
As the security engineer, you own the core defenses protecting the platform from common web vulnerabilities (OWASP Top 10), ensuring safe user authentication, impenetrable session state, robust CSRF protection, SQL injection prevention, strict role-based access control (RBAC), and a hardened file upload pipeline.

Full documentation: `frontend/docs/tasks/backend-4-security.md`

---

## 2. Core Security Modules to Implement

### 2.1 Authentication & Password Security (`api/register.php`, `api/login.php`)
1. **Password Hashing:**
   - Store passwords exclusively using Bcrypt:
     ```php
     $hash = password_hash($password, PASSWORD_DEFAULT, ['cost' => 12]);
     ```
   - Verify passwords with constant-time verification:
     ```php
     if (!password_verify($password, $user['password_hash'])) { /* fail */ }
     ```
   - **Never** store, log, or return plain text passwords or password hashes.
2. **Password Length & Complexity Policies:**
   - Minimum: 8 characters. Maximum: 72 characters (prevent Bcrypt truncation vulnerability).
3. **Anti-User-Enumeration:**
   - Return the exact same error message and HTTP status for non-existent emails and incorrect passwords:
     `401 { "error": "Wrong email or password" }`.
4. **Account Suspension Gate:**
   - Immediately reject logins if `users.status === 'suspended'`:
     `403 { "error": "This account is suspended" }`.

---

### 2.2 Session Security & Cookie Hardening (`include/session.php`)
1. **Secure Session Cookie Attributes:**
   Configure session parameters prior to `session_start()`:
   ```php
   session_set_cookie_params([
       'lifetime' => 0,               // Session lasts until browser closes
       'path' => '/',
       'domain' => '',                // Host-only
       'secure' => isset($_SERVER['HTTPS']), // Secure over HTTPS
       'httponly' => true,            // Block JavaScript access (XSS defense)
       'samesite' => 'Lax'            // Prevent CSRF cookie leak
   ]);
   session_start();
   ```
2. **Session Fixation Defense:**
   - Call `session_regenerate_id(true)` immediately upon:
     - Successful user registration.
     - Successful user login.
     - Privilege/Role elevation.
3. **Session State Minimization:**
   - Store only `$_SESSION['user_id']` and `$_SESSION['csrf']` in session storage.
   - Do **not** store mutable fields (like role, email, balance, status) in `$_SESSION` to avoid stale permissions; query them from DB when required.
4. **Complete Session Destruction:**
   - On logout (`api/logout.php`):
     ```php
     $_SESSION = [];
     if (ini_get("session.use_cookies")) {
         $params = session_get_cookie_params();
         setcookie(session_name(), '', time() - 42000, $params["path"], $params["domain"], $params["secure"], $params["httponly"]);
     }
     session_destroy();
     ```

---

### 2.3 Cross-Site Request Forgery (CSRF) Protection
1. **Token Generation:**
   - Generate a 32-byte cryptographically secure random token when session initializes:
     ```php
     if (empty($_SESSION['csrf'])) {
         $_SESSION['csrf'] = bin2hex(random_bytes(32));
     }
     ```
2. **Token Distribution:**
   - Exposed through `GET /api/session.php` in the payload `{ "csrfToken": "..." }`.
3. **Middleware Verification:**
   - On all state-changing HTTP requests (`POST`, `PUT`, `DELETE`, `PATCH`):
     ```php
     $clientToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
     if (empty($clientToken) || !hash_equals($_SESSION['csrf'], $clientToken)) {
         http_response_code(403);
         echo json_encode(['error' => 'Invalid or missing CSRF token']);
         exit;
     }
     ```

---

### 2.4 SQL Injection Defense & PDO Hardening (`config/db.php`, `include/db.php`)
1. **100% Parameterized Prepared Statements:**
   - Prohibit all raw variable concatenation or interpolation in SQL queries.
2. **Hardened PDO Configuration:**
   ```php
   $pdo = new PDO($dsn, $user, $pass, [
       PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
       PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
       PDO::ATTR_EMULATE_PREPARES => false, // Ensure true server-side prepared statements
       PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
   ]);
   ```

---

### 2.5 Role-Based Access Control (RBAC) & Authorization (`include/auth.php`)
Provide reusable middleware guards:
```php
function require_login(): int {
    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Login required']);
        exit;
    }
    return (int)$_SESSION['user_id'];
}

function require_owner(PDO $pdo): array {
    $userId = require_login();
    $stmt = $pdo->prepare("SELECT * FROM places WHERE owner_id = ? AND status IN ('active', 'hidden')");
    $stmt->execute([$userId]);
    $place = $stmt->fetch();
    if (!$place) {
        http_response_code(403);
        echo json_encode(['error' => 'You do not own an approved shop']);
        exit;
    }
    return $place;
}

function require_admin(PDO $pdo): void {
    $userId = require_login();
    $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $role = $stmt->fetchColumn();
    if ($role !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Administrative privileges required']);
        exit;
    }
}
```
* **IDOR Defense:** Ensure endpoints verify resource ownership (e.g. `WHERE id = :review_id AND user_id = :session_user_id`) so users cannot delete or alter other people's data.

---

### 2.6 Hardened File Upload Pipeline (`include/upload.php`)
1. **Server-Side MIME Inspection:**
   - Inspect binary magic numbers using PHP Fileinfo:
     ```php
     $finfo = finfo_open(FILEINFO_MIME_TYPE);
     $mime = finfo_file($finfo, $_FILES['file']['tmp_name']);
     finfo_close($finfo);
     $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
     if (!array_key_exists($mime, $allowed)) {
         http_response_code(422);
         echo json_encode(['error' => 'Only JPEG, PNG and WebP images are permitted']);
         exit;
     }
     ```
2. **Cryptographic Filename Generation:**
   - Prevent path traversal and filename collisions:
     ```php
     $safeFilename = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
     ```
3. **Execution Prevention:**
   - Place an `.htaccess` file inside `uploads/` preventing PHP execution:
     ```apache
     <FilesMatch "\.(php|phtml|php3|php4|php5|php7|phps)$">
         Order Allow,Deny
         Deny from all
     </FilesMatch>
     php_flag engine off
     ```

---

## 3. Definition of Done & Verification Checklist
- [ ] No raw queries exist in the codebase; 100% of queries use PDO prepared statements.
- [ ] `POST`, `PUT`, `DELETE` calls without a matching `X-CSRF-Token` fail with `403`.
- [ ] Session cookies are confirmed with `HttpOnly` and `SameSite=Lax`.
- [ ] Login errors do not disclose whether an email is registered or not.
- [ ] Non-admin users cannot execute any endpoint under `/api/admin/`.
- [ ] Non-owner users cannot execute endpoints under `/api/owner/`.
- [ ] Malicious file uploads (e.g. `.php` renamed to `.jpg`) are blocked by binary MIME inspection.
