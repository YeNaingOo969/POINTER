<?php
// PUT /api/owner/review-reply.php?id=12 { reply }
// Owner replies to a customer review of their own place.
// A reply can be updated (PUT again). Owners cannot delete reviews.
//
// Response: { id, ownerReply }
// 403 when the review is not for the owner's place
// 422 when reply is empty or > 600 characters
declare(strict_types=1);

require __DIR__ . '/../../include/bootstrap.php';
require __DIR__ . '/../../include/shapes.php';
require __DIR__ . '/../../include/owner.php';

require_method('PUT');

['user' => $user, 'place' => $place] = require_owner();
require_csrf();

$reviewId = isset($_GET['id']) && ctype_digit((string) $_GET['id']) ? (int) $_GET['id'] : 0;
if ($reviewId <= 0) {
    fail(404, 'Review not found');
}

// Check the review exists and belongs to the owner's place.
$st = db()->prepare('SELECT id, place_id FROM reviews WHERE id = ?');
$st->execute([$reviewId]);
$review = $st->fetch();

if (!$review) {
    fail(404, 'Review not found');
}
if ((int) $review['place_id'] !== (int) $place['id']) {
    fail(403, 'Not your place');
}

$in    = body();
$reply = trim((string) ($in['reply'] ?? ''));
$len   = mb_strlen($reply);

if ($len < 1 || $len > 600) {
    fail(422, 'Write a reply of up to 600 characters');
}

db()->prepare('UPDATE reviews SET owner_reply = ? WHERE id = ?')->execute([$reply, $reviewId]);

json_out(['id' => $reviewId, 'ownerReply' => $reply]);
