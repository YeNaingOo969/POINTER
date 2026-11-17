<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/messages.php';

$method = require_method('GET', 'POST', 'DELETE');

// People and shop owners the logged-in user blocked.
$user = require_login();
$uid  = $user['id'];

if ($method === 'GET') {
    $st = db()->prepare('SELECT blocked_id FROM blocks WHERE blocker_id = ? ORDER BY blocked_id ASC');
    $st->execute([$uid]);
    $ids = array_map(fn ($r) => (int) $r['blocked_id'], $st->fetchAll());

    $users = users_with_places($ids);
    $out   = [];
    foreach ($ids as $id) {
        if (isset($users[$id])) {
            $out[] = ['user' => other_summary($users[$id])];
        }
    }
    json_out($out);
}

require_csrf();

// ---------- POST: block a user (a shop is blocked through its owner) ----------

if ($method === 'POST') {
    $in  = body();
    $id  = (int) ($in['userId'] ?? 0);
    if ($id <= 0 || $id === $uid || (users_with_places([$id])[$id] ?? null) === null) {
        fail(404, 'User not found');
    }
    db()->prepare('INSERT IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)')
        ->execute([$uid, $id]);
    json_out(['blocked' => true]);
}

// ---------- DELETE: unblock ----------

$id = isset($_GET['user_id']) && ctype_digit((string) $_GET['user_id']) ? (int) $_GET['user_id'] : 0;
if ($id <= 0) {
    fail(422, 'Choose a user');
}
db()->prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?')->execute([$uid, $id]);
json_out(['blocked' => false]);
