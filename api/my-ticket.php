<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/posts.php';

require_method('GET');

// The logged-in user's ticket for one deal, or null. Visitors get null as well.
$user = current_user();
if ($user === null) {
    json_out(null);
}

$postId = isset($_GET['post_id']) && ctype_digit((string) $_GET['post_id']) ? (int) $_GET['post_id'] : 0;
$st = db()->prepare('SELECT id, post_id, ticket_code, status, used_at, created_at
                     FROM tickets WHERE user_id = ? AND post_id = ? LIMIT 1');
$st->execute([$user['id'], $postId]);
$row = $st->fetch();

json_out($row ? ticket_shape($row) : null);
