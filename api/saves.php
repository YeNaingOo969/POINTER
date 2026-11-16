<?php
require __DIR__ . '/../include/bootstrap.php';

// Save / unsave one place for the logged-in user.
// POST   /api/saves.php   { placeId }  -> { saved: true }   (already saved: same answer)
// DELETE /api/saves.php?place_id=1     -> { saved: false }
$method = require_method('POST', 'DELETE');
$user   = require_login();
require_csrf();

if ($method === 'POST') {
    $in      = body();
    $placeId = (int) ($in['placeId'] ?? 0);

    $st = db()->prepare('SELECT 1 FROM places WHERE id = ?');
    $st->execute([$placeId]);
    if (!$st->fetchColumn()) {
        fail(404, 'Place not found');
    }

    // favorites is PRIMARY KEY (user_id, place_id), so a second save is a no-op, not an error.
    $st = db()->prepare('INSERT IGNORE INTO favorites (user_id, place_id) VALUES (?, ?)');
    $st->execute([$user['id'], $placeId]);

    json_out(['saved' => true]);
}

// DELETE: unsaving something that was never saved still answers { saved: false }.
$placeId = isset($_GET['place_id']) && ctype_digit((string) $_GET['place_id']) ? (int) $_GET['place_id'] : 0;
$st      = db()->prepare('DELETE FROM favorites WHERE user_id = ? AND place_id = ?');
$st->execute([$user['id'], $placeId]);

json_out(['saved' => false]);
