<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/business.php';

// The logged-in user's business request, or null when they never sent one.
require_method('GET');
$user = require_login();

json_out(business_request_for_user($user['id']));
