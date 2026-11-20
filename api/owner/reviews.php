<?php
// GET /api/owner/reviews.php
// Customer reviews for the authenticated owner's shop, newest first.
// Response: Review[] — { id, placeId, user, rating, text, createdAt, updatedAt, ownerReply }
//
// 401 not logged in | 403 no active place
declare(strict_types=1);

require __DIR__ . '/../../include/bootstrap.php';
require __DIR__ . '/../../include/shapes.php';
require __DIR__ . '/../../include/owner.php';

require_method('GET');

['user' => $user, 'place' => $place] = require_owner();

$st = db()->prepare(
    'SELECT r.id, r.place_id, r.rating, r.comment AS text, r.created_at, r.updated_at,
            r.owner_reply, u.id AS user_id, u.name AS user_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.place_id = ?
     ORDER BY r.created_at DESC, r.id DESC'
);
$st->execute([(int) $place['id']]);

json_out(array_map('review_shape', $st->fetchAll()));
