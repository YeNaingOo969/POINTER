<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/posts.php';

require_method('GET');

// Home feed: the newest posts from live shops, and the deals ending soonest.
// Visitors see the same feed; a logged-in user does not see shops they blocked.
$user   = current_user();
$params = [];

$notEnded = "(po.type <> 'discount' OR (
                (po.expires_at IS NULL OR po.expires_at > NOW())
                AND (po.ticket_limit IS NULL OR COALESCE(t.taken, 0) < po.ticket_limit)
            ))";

$base = post_select() . ' WHERE ' . post_live_sql() . " AND $notEnded";
$base .= post_blocked_sql('p', $user, $params);

$postsSt = db()->prepare($base . ' ORDER BY po.created_at DESC, po.id DESC LIMIT 6');
$postsSt->execute($params);

$dealsSt = db()->prepare($base . " AND po.type = 'discount'
                                  ORDER BY (po.expires_at IS NULL) ASC, po.expires_at ASC, po.id ASC
                                  LIMIT 4");
$dealsSt->execute($params);

json_out([
    'posts' => array_map('post_shape', $postsSt->fetchAll()),
    'deals' => array_map('post_shape', $dealsSt->fetchAll()),
]);
