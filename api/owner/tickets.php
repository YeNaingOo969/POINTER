<?php
// GET /api/owner/tickets.php
// Every customer ticket taken against this shop's posts, newest first.
//
// Coupons are created as discount posts (POST /api/owner/posts.php with
// type=discount, ticketLimit, expiresAt) because this schema has one ticket
// table (user_id + post_id), not a separate coupon definition table.
//
// Response: (Ticket & { userName, post: { id, content, discountText } })[]
// 401 not logged in | 403 no active place
declare(strict_types=1);

require __DIR__ . '/../../include/bootstrap.php';
require __DIR__ . '/../../include/posts.php';
require __DIR__ . '/../../include/owner.php';

require_method('GET');

['user' => $user, 'place' => $place] = require_owner();

$st = db()->prepare(
    'SELECT t.id, t.post_id, t.ticket_code, t.status, t.used_at, t.created_at,
            u.name AS user_name, po.content, po.discount_text
     FROM tickets t
     JOIN posts po ON po.id = t.post_id
     JOIN users u ON u.id = t.user_id
     WHERE po.place_id = ?
     ORDER BY t.created_at DESC, t.id DESC'
);
$st->execute([(int) $place['id']]);

$out = [];
foreach ($st->fetchAll() as $r) {
    $out[] = ticket_shape($r) + [
        'userName' => $r['user_name'],
        'post'     => [
            'id'           => (int) $r['post_id'],
            'content'      => $r['content'],
            'discountText' => $r['discount_text'],
        ],
    ];
}

json_out($out);
