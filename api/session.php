<?php
require __DIR__ . '/../include/bootstrap.php';

require_method('GET');
$user = current_user(); // also starts the session and creates the CSRF token

json_out(['user' => $user, 'csrfToken' => $_SESSION['csrf']]);
