<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/messages.php';

require_method('GET');

// The logged-in user's conversations, newest first. One row per other person/shop.
$user = require_login();
$uid  = $user['id'];

$st = db()->prepare(
    'SELECT id, sender_id, receiver_id, body, status, is_read, created_at
     FROM messages
     WHERE sender_id = ? OR receiver_id = ?
     ORDER BY created_at ASC, id ASC'
);
$st->execute([$uid, $uid]);
$rows = $st->fetchAll();

if (!$rows) {
    json_out([]);
}

$byOther = [];
foreach ($rows as $row) {
    $otherId = (int) $row['sender_id'] === $uid ? (int) $row['receiver_id'] : (int) $row['sender_id'];
    $byOther[$otherId][] = $row;
}

$others  = users_with_places(array_keys($byOther));
$blocked = [];
$st = db()->prepare('SELECT blocked_id FROM blocks WHERE blocker_id = ?');
$st->execute([$uid]);
foreach ($st->fetchAll() as $b) {
    $blocked[(int) $b['blocked_id']] = true;
}

$out = [];
foreach ($byOther as $otherId => $messages) {
    $last = $messages[count($messages) - 1];
    $info = $others[$otherId] ?? null;
    if ($info === null) {
        continue;
    }

    $unread = 0;
    $accepted = false;
    foreach ($messages as $m) {
        if ((int) $m['receiver_id'] === $uid && !(int) $m['is_read']) {
            $unread++;
        }
        if ($m['status'] === 'accepted') {
            $accepted = true;
        }
    }

    $out[] = [
        'other'   => other_summary($info),
        'last'    => message_shape($last),
        'unread'  => $unread,
        'status'  => $accepted ? 'accepted' : 'request',
        'blocked' => isset($blocked[$otherId]),
    ];
}

usort($out, fn ($a, $b) => strcmp($b['last']['createdAt'], $a['last']['createdAt']));

json_out($out);
