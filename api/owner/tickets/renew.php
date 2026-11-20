<?php
// POST|PUT /api/owner/tickets/renew.php { postId, expiresAt } or { postId, days }
// Extend the validity of one of the owner's discount posts (issue #6 "renew expiring coupons").
//   expiresAt  ISO 8601 / MySQL datetime — must be in the future.
//   days       1–365, counted from the current expiry (or now when already over).
//
// Response: Post (same shape as /api/owner/posts.php)
// 403 not your post | 404 not found | 422 invalid
declare(strict_types=1);

require __DIR__ . '/../../../include/bootstrap.php';
require __DIR__ . '/../../../include/posts.php';
require __DIR__ . '/../../../include/owner.php';

require_method('POST', 'PUT');

['user' => $user, 'place' => $place] = require_owner();
require_csrf();

$placeId = (int) $place['id'];
$pdo     = db();
$in      = body();

$postId = (int) ($in['postId'] ?? 0);
if ($postId <= 0) {
    fail(422, 'Choose a deal');
}

$st = $pdo->prepare(post_select() . ' WHERE po.id = ?');
$st->execute([$postId]);
$row = $st->fetch();

if (!$row) {
    fail(404, 'Post not found');
}
if ((int) $row['place_id'] !== $placeId) {
    fail(403, 'Not your post');
}
if ($row['type'] !== 'discount') {
    fail(422, 'Only a discount can be renewed');
}

// Work out the new end time.
if (isset($in['expiresAt'])) {
    $when = strtotime((string) $in['expiresAt']);
    if ($when === false || $when <= time()) {
        fail(422, 'The end time must be in the future');
    }
} elseif (isset($in['days'])) {
    $days = filter_var($in['days'], FILTER_VALIDATE_INT);
    if ($days === false || $days < 1 || $days > 365) {
        fail(422, 'Choose 1 to 365 days');
    }
    $from = $row['expires_at'] !== null ? strtotime((string) $row['expires_at']) : time();
    $when = max(time(), $from) + ($days * 86400);
} else {
    fail(422, 'Send expiresAt or days');
}

$pdo->prepare('UPDATE posts SET expires_at = ? WHERE id = ?')
    ->execute([date('Y-m-d H:i:s', $when), $postId]);

$fresh = $pdo->prepare(post_select() . ' WHERE po.id = ?');
$fresh->execute([$postId]);

json_out(post_shape($fresh->fetch()));
