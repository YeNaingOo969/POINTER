<?php
require __DIR__ . '/../include/bootstrap.php';

// Saved flag + the visitor's own review id for one place. No login needed:
// a visitor (or a bad place_id) gets false / null.
require_method('GET');

$placeId = isset($_GET['place_id']) && ctype_digit((string) $_GET['place_id']) ? (int) $_GET['place_id'] : 0;
$user    = current_user();
if ($user === null) {
    json_out(['saved' => false, 'reviewId' => null]);
}

$st = db()->prepare('SELECT 1 FROM favorites WHERE user_id = ? AND place_id = ?');
$st->execute([$user['id'], $placeId]);
$saved = (bool) $st->fetchColumn();

$st = db()->prepare('SELECT id FROM reviews WHERE user_id = ? AND place_id = ?');
$st->execute([$user['id'], $placeId]);
$reviewId = $st->fetchColumn();

json_out([
    'saved'    => $saved,
    'reviewId' => $reviewId === false ? null : (int) $reviewId,
]);
