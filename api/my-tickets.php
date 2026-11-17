<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/posts.php';

require_method('GET');

// All the logged-in user's tickets with their deal and shop, newest first.
$user = require_login();

$st = db()->prepare('SELECT id, post_id, ticket_code, status, used_at, created_at
                     FROM tickets WHERE user_id = ?
                     ORDER BY created_at DESC, id DESC');
$st->execute([$user['id']]);
$tickets = $st->fetchAll();

if (!$tickets) {
    json_out([]);
}

$postIds = array_values(array_unique(array_map(fn ($t) => (int) $t['post_id'], $tickets)));
$in      = implode(',', array_fill(0, count($postIds), '?'));
$ps      = db()->prepare(post_select() . " WHERE po.id IN ($in)");
$ps->execute($postIds);

$posts = [];
foreach ($ps->fetchAll() as $row) {
    $posts[(int) $row['id']] = post_shape($row);
}

$out = [];
foreach ($tickets as $ticket) {
    $post = $posts[(int) $ticket['post_id']] ?? null;
    if ($post === null) {
        continue;
    }
    $out[] = ticket_shape($ticket) + ['post' => $post];
}

json_out($out);
