<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/messages.php';

$method = require_method('GET', 'POST');

// ---------- GET: one thread, and mark their messages as read ----------

if ($method === 'GET') {
    $user = require_login();
    $uid  = $user['id'];

    $otherId = isset($_GET['with']) && ctype_digit((string) $_GET['with']) ? (int) $_GET['with'] : 0;
    if ($otherId <= 0 || $otherId === $uid) {
        fail(422, 'Choose a conversation');
    }

    $info = users_with_places([$otherId])[$otherId] ?? null;
    if ($info === null) {
        fail(404, 'User not found');
    }

    db()->prepare('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?')
        ->execute([$otherId, $uid]);

    $st = db()->prepare(
        'SELECT id, sender_id, receiver_id, body, status, is_read, created_at
         FROM messages
         WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
         ORDER BY created_at ASC, id ASC'
    );
    $st->execute([$uid, $otherId, $otherId, $uid]);
    $rows = $st->fetchAll();

    $accepted = false;
    foreach ($rows as $row) {
        if ($row['status'] === 'accepted') {
            $accepted = true;
        }
    }

    json_out([
        'other'    => other_summary($info),
        'status'   => $accepted ? 'accepted' : ($rows ? 'request' : 'new'),
        'blocked'  => blocked_between($uid, $otherId),
        'messages' => array_map('message_shape', $rows),
    ]);
}

// ---------- POST: send a message, or accept a request ----------

$user = require_login();
require_csrf();

$uid = $user['id'];
$in  = body();

if (isset($in['accept'])) {
    $otherId = (int) $in['accept'];
    if ($otherId <= 0 || $otherId === $uid) {
        fail(422, 'Choose a conversation');
    }
    $st = db()->prepare(
        "UPDATE messages SET status = 'accepted'
         WHERE status = 'request'
           AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))"
    );
    $st->execute([$otherId, $uid, $uid, $otherId]);
    json_out(['status' => 'accepted']);
}

$to   = (int) ($in['to'] ?? 0);
$body = trim((string) ($in['body'] ?? ''));

if ($to <= 0 || $to === $uid) {
    fail(404, 'User not found');
}
if ((users_with_places([$to])[$to] ?? null) === null) {
    fail(404, 'User not found');
}
if (blocked_between($uid, $to)) {
    fail(403, 'Blocked');
}

$len = mb_strlen($body);
if ($len < 1 || $len > 1000) {
    fail(422, 'Write a message of up to 1000 characters');
}

$st = db()->prepare(
    "SELECT 1 FROM messages
     WHERE status = 'accepted'
       AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
     LIMIT 1"
);
$st->execute([$to, $uid, $uid, $to]);
$status = $st->fetchColumn() ? 'accepted' : 'request';

$st = db()->prepare('INSERT INTO messages (sender_id, receiver_id, body, status) VALUES (?, ?, ?, ?)');
$st->execute([$uid, $to, $body, $status]);
$id = (int) db()->lastInsertId();

$st = db()->prepare('SELECT id, sender_id, receiver_id, body, status, is_read, created_at
                     FROM messages WHERE id = ?');
$st->execute([$id]);

json_out(message_shape($st->fetch()), 201);
