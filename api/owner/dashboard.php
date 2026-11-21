<?php
// GET /api/owner/dashboard.php
// Everything the owner dashboard shows in one request.
// 403 when the user has no active place.
//
// Response: {
//   place, subscription: { months, startsAt, expiresAt, active, daysLeft } | null,
//   pending: OwnerUpgrade | null,
//   stats: { posts, activeDeals, ticketsTaken, ticketsUsed, rating },
//   posts: Post[], reviews: Review[]
// }
declare(strict_types=1);

require __DIR__ . '/../../include/bootstrap.php';
require __DIR__ . '/../../include/posts.php';
require __DIR__ . '/../../include/shapes.php';
require __DIR__ . '/../../include/owner.php';

require_method('GET');
['user' => $user, 'place' => $place] = require_owner();

$placeId = (int) $place['id'];
$pdo     = db();

// ---------- Subscription ----------

$sub     = active_subscription($user['id']);
$subOut  = subscription_out($sub);

// Pending renewal (a new owner_upgrades row in 'pending' status).
$pendSt = $pdo->prepare(
    "SELECT o.id, COALESCE(o.months, pl.months, 3) AS months,
            COALESCE(o.amount, pl.amount, 30000) AS amount,
            o.payment_method, o.payment_ref, o.status, o.created_at
     FROM owner_upgrades o
     LEFT JOIN plans pl ON pl.id = o.plan_id
     WHERE o.user_id = ? AND o.status = 'pending'
     ORDER BY o.id DESC LIMIT 1"
);
$pendSt->execute([$user['id']]);
$pendRow = $pendSt->fetch();
$pending = $pendRow ? [
    'id'            => (int) $pendRow['id'],
    'months'        => (int) $pendRow['months'],
    'amount'        => (float) $pendRow['amount'],
    'paymentMethod' => $pendRow['payment_method'],
    'paymentRef'    => $pendRow['payment_ref'],
    'status'        => $pendRow['status'],
    'createdAt'     => iso($pendRow['created_at']),
] : null;

// ---------- Posts (all, including ended deals) ----------

$postSql = post_select() . ' WHERE po.place_id = ?
           ORDER BY po.is_pinned DESC, po.created_at DESC, po.id DESC';
$postSt  = $pdo->prepare($postSql);
$postSt->execute([$placeId]);
$posts = array_map('post_shape', $postSt->fetchAll());

// ---------- Tickets for this place ----------

$tickSt = $pdo->prepare(
    'SELECT t.id, t.post_id, t.ticket_code, t.status, t.used_at, t.created_at
     FROM tickets t
     JOIN posts po ON po.id = t.post_id
     WHERE po.place_id = ?'
);
$tickSt->execute([$placeId]);
$tickets = $tickSt->fetchAll();

$ticketsTaken = count($tickets);
$ticketsUsed  = 0;
foreach ($tickets as $t) {
    if ($t['used_at'] !== null) {
        $ticketsUsed++;
    }
}

// ---------- Reviews ----------

$revSt = $pdo->prepare(
    'SELECT r.id, r.place_id, r.rating, r.comment AS text, r.created_at, r.updated_at,
            r.owner_reply, u.id AS user_id, u.name AS user_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.place_id = ?
     ORDER BY r.created_at DESC, r.id DESC'
);
$revSt->execute([$placeId]);
$reviews = array_map('review_shape', $revSt->fetchAll());

// ---------- Stats ----------

$activeDeals = 0;
foreach ($posts as $p) {
    if ($p['type'] === 'discount' && !$p['ended']) {
        $activeDeals++;
    }
}

json_out([
    'place'        => owner_place_shape($place),
    'subscription' => $subOut,
    'pending'      => $pending,
    'stats'        => [
        'posts'        => count($posts),
        'activeDeals'  => $activeDeals,
        'ticketsTaken' => $ticketsTaken,
        'ticketsUsed'  => $ticketsUsed,
        'rating'       => [
            'average' => round((float) $place['avg_rating'], 1),
            'count'   => (int) $place['review_count'],
        ],
    ],
    'posts'   => $posts,
    'reviews' => $reviews,
]);
