<?php
require __DIR__ . '/../include/bootstrap.php';

require_method('POST');
require_csrf();

// Clear the login but keep the CSRF token, so the page (which got the token once, from
// session.php) can log in again without reloading.
$csrf = $_SESSION['csrf'];
$_SESSION = [];
session_regenerate_id(true);
$_SESSION['csrf'] = $csrf;

json_out(['user' => null]);
