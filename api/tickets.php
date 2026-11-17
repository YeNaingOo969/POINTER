<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/posts.php';

require_method('POST');

// Take a ticket for a discount post (one per user per post; it lasts two hours).
$user = require_login();
require_csrf();

$in     = body();
$postId = (int) ($in['postId'] ?? 0);
if ($postId <= 0) {
    fail(404, 'Post not found');
}

$st = db()->prepare(post_select() . ' WHERE po.id = ?');
$st->execute([$postId]);
$row = $st->fetch();
if (!$row || $row['type'] !== 'discount') {
    fail(404, 'Post not found');
}

$post = post_shape($row);
if ($post['ended']) {
    fail(410, 'This deal has ended');
}

$st = db()->prepare('SELECT 1 FROM tickets WHERE user_id = ? AND post_id = ?');
$st->execute([$user['id'], $postId]);
if ($st->fetchColumn()) {
    fail(409, 'You already have a ticket for this deal');
}

// The code is short enough to read aloud: shop initials + 4 characters, e.g. MT-7Q4K.
$letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
$prefix  = '';
foreach (preg_split('/\s+/', trim((string) $row['name'])) ?: [] as $word) {
    $prefix .= mb_substr($word, 0, 1);
}
$prefix = mb_strtoupper(mb_substr($prefix, 0, 2));

$ticketId = 0;
for ($attempt = 0; $attempt < 5 && $ticketId === 0; $attempt++) {
    $code = $prefix . '-';
    for ($i = 0; $i < 4; $i++) {
        $code .= $letters[random_int(0, strlen($letters) - 1)];
    }
    try {
        $st = db()->prepare("INSERT INTO tickets (user_id, post_id, ticket_code, status)
                             VALUES (?, ?, ?, 'unused')");
        $st->execute([$user['id'], $postId, $code]);
        $ticketId = (int) db()->lastInsertId();
    } catch (PDOException $e) {
        if ($e->getCode() !== '23000') {
            throw $e;
        }
        // Either this user already got the ticket (double submit) or the code collided.
        $st = db()->prepare('SELECT 1 FROM tickets WHERE user_id = ? AND post_id = ?');
        $st->execute([$user['id'], $postId]);
        if ($st->fetchColumn()) {
            fail(409, 'You already have a ticket for this deal');
        }
    }
}

if ($ticketId === 0) {
    fail(409, 'Could not create a ticket, please try again');
}

$st = db()->prepare('SELECT id, post_id, ticket_code, status, used_at, created_at
                     FROM tickets WHERE id = ?');
$st->execute([$ticketId]);

json_out(ticket_shape($st->fetch()), 201);
