<?php
require __DIR__ . '/../include/bootstrap.php';

$method = require_method('GET', 'POST');

// Notifications for the logged-in user, newest first. Visitors get an empty list.
if ($method === 'GET') {
    $user = current_user();
    if ($user === null) {
        json_out([]);
    }

    $st = db()->prepare('SELECT id, type, ref_id, is_read, created_at
                         FROM notifications WHERE user_id = ?
                         ORDER BY created_at DESC, id DESC');
    $st->execute([$user['id']]);

    $out = [];
    foreach ($st->fetchAll() as $row) {
        $out[] = [
            'id'        => (int) $row['id'],
            'type'      => $row['type'],
            'refId'     => $row['ref_id'] === null ? null : (int) $row['ref_id'],
            'isRead'    => (bool) $row['is_read'],
            'createdAt' => iso($row['created_at']),
        ];
    }
    json_out($out);
}

// ---------- POST { read: 'all' } ----------

$user = require_login();
require_csrf();

$in = body();
if (($in['read'] ?? '') !== 'all') {
    fail(422, 'Nothing to mark');
}

db()->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')->execute([$user['id']]);
json_out(['ok' => true]);
