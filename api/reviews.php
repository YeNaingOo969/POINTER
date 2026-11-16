<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/shapes.php';

// Reviews of one place. GET is public; POST / PUT / DELETE need a login and the CSRF token.
// The review text lives in reviews.comment; the JSON field is "text".
const REVIEW_SELECT =
    'SELECT r.id, r.place_id, r.rating, r.comment AS text, r.created_at, r.updated_at, r.owner_reply,
            u.id AS user_id, u.name AS user_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id';

function find_review(int $id): ?array
{
    $st = db()->prepare(REVIEW_SELECT . ' WHERE r.id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    return $row ?: null;
}

/** Read rating + text from the body, or fail 422. Returns [rating, text]. */
function review_input(array $in): array
{
    $rating = filter_var($in['rating'] ?? null, FILTER_VALIDATE_INT);
    if ($rating === false || $rating < 1 || $rating > 5) {
        fail(422, 'Rating must be 1 to 5');
    }
    $text = trim((string) ($in['text'] ?? ''));
    $len  = mb_strlen($text);
    if ($len < 1 || $len > 600) {
        fail(422, 'Review text must be 1 to 600 characters');
    }
    return [$rating, $text];
}

$method = require_method('GET', 'POST', 'PUT', 'DELETE');

// ---------- GET: anyone can read the reviews of a place, newest first ----------

if ($method === 'GET') {
    $placeId = isset($_GET['place_id']) && ctype_digit((string) $_GET['place_id']) ? (int) $_GET['place_id'] : 0;
    $st = db()->prepare(REVIEW_SELECT . ' WHERE r.place_id = ? ORDER BY r.created_at DESC, r.id DESC');
    $st->execute([$placeId]);
    json_out(array_map('review_shape', $st->fetchAll()));
}

// ---------- Everything below needs a logged-in user + the CSRF token ----------

$user   = require_login();
$userId = $user['id'];
require_csrf();

if ($method === 'POST') {
    $in      = body();
    $placeId = (int) ($in['placeId'] ?? 0);
    [$rating, $text] = review_input($in);

    $st = db()->prepare('SELECT owner_id FROM places WHERE id = ?');
    $st->execute([$placeId]);
    $place = $st->fetch();
    if (!$place) {
        fail(404, 'Place not found');
    }
    if ($place['owner_id'] !== null && (int) $place['owner_id'] === $userId) {
        fail(403, "You can't review your own shop");
    }

    $st = db()->prepare('SELECT 1 FROM reviews WHERE user_id = ? AND place_id = ?');
    $st->execute([$userId, $placeId]);
    if ($st->fetchColumn()) {
        fail(409, 'You already reviewed this place');
    }

    try {
        $st = db()->prepare('INSERT INTO reviews (user_id, place_id, rating, comment) VALUES (?, ?, ?, ?)');
        $st->execute([$userId, $placeId, $rating, $text]);
    } catch (PDOException $e) {
        // uq_user_place_review (user_id, place_id) is the safety net for a double submit.
        if ($e->getCode() === '23000') {
            fail(409, 'You already reviewed this place');
        }
        throw $e;
    }

    json_out(review_shape(find_review((int) db()->lastInsertId())), 201);
}

// ---------- PUT / DELETE: only the author ----------

$id     = isset($_GET['id']) && ctype_digit((string) $_GET['id']) ? (int) $_GET['id'] : 0;
$review = find_review($id);
if ($review === null) {
    fail(404, 'Review not found');
}
if ((int) $review['user_id'] !== $userId) {
    fail(403, 'Not your review');
}

if ($method === 'PUT') {
    [$rating, $text] = review_input(body());
    $st = db()->prepare('UPDATE reviews SET rating = ?, comment = ?, updated_at = NOW() WHERE id = ?');
    $st->execute([$rating, $text, $id]);
    json_out(review_shape(find_review($id)));
}

// DELETE
$st = db()->prepare('DELETE FROM reviews WHERE id = ?');
$st->execute([$id]);
json_out(['deleted' => true]);
