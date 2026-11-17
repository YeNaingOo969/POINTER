<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/posts.php';

require_method('GET');

// One post by id, or all posts of one place. This endpoint is public, so a deal link from
// Home or a notification works for visitors too. Ended deals are left out of a place's list.
if (isset($_GET['id'])) {
    if (!ctype_digit((string) $_GET['id'])) {
        fail(404, 'Post not found');
    }
    $st = db()->prepare(post_select() . ' WHERE po.id = ?');
    $st->execute([(int) $_GET['id']]);
    $row = $st->fetch();
    if (!$row) {
        fail(404, 'Post not found');
    }
    json_out(post_shape($row));
}

if (!isset($_GET['place_id']) || !ctype_digit((string) $_GET['place_id'])) {
    fail(422, 'id or place_id is required');
}

$st = db()->prepare(
    post_select() . " WHERE po.place_id = ?
    AND (po.type <> 'discount' OR (
        (po.expires_at IS NULL OR po.expires_at > NOW())
        AND (po.ticket_limit IS NULL OR COALESCE(t.taken, 0) < po.ticket_limit)
    ))
    ORDER BY po.is_pinned DESC, po.created_at DESC, po.id DESC"
);
$st->execute([(int) $_GET['place_id']]);

json_out(array_map('post_shape', $st->fetchAll()));
