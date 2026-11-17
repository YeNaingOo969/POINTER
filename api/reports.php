<?php
require __DIR__ . '/../include/bootstrap.php';

require_method('POST');

// Report a place, post, review, user or message. A logged-in user + CSRF token is required.
$user = require_login();
require_csrf();

$in         = body();
$targetType = (string) ($in['targetType'] ?? '');
$targetId   = (int) ($in['targetId'] ?? 0);
$reason     = trim((string) ($in['reason'] ?? ''));

if (!in_array($targetType, ['place', 'post', 'review', 'user', 'message'], true)) {
    fail(422, 'Choose what to report');
}
if ($targetId <= 0) {
    fail(422, 'Choose what to report');
}
if ($reason === '' || mb_strlen($reason) > 255) {
    fail(422, 'Please say what is wrong');
}

$st = db()->prepare("INSERT INTO reports (reporter_id, target_type, target_id, reason, status)
                     VALUES (?, ?, ?, ?, 'open')");
$st->execute([$user['id'], $targetType, $targetId, $reason]);

json_out(['id' => (int) db()->lastInsertId(), 'status' => 'open'], 201);
