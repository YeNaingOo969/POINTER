<?php
// GET    /api/owner/posts.php                       Every post of my shop (pinned first)
// POST   /api/owner/posts.php                       Create a post / deal
// PUT    /api/owner/posts.php?id=101                Edit a post (content, discount fields, isPinned)
// DELETE /api/owner/posts.php?id=101                Delete a post (keeps existing tickets valid)
//
// POST body (multipart/form-data):
//   type         normal | discount
//   content      1–1000 chars
//   image        optional image file (JPEG/PNG/WebP ≤ 5 MB)
//   discountText discount label (discount posts only)
//   ticketLimit  1–500 (discount posts only)
//   expiresAt    ISO 8601, must be in the future (discount posts only)
//
// PUT body (JSON):
//   content?, discountText?, ticketLimit?, expiresAt?, isPinned?
declare(strict_types=1);

require __DIR__ . '/../../include/bootstrap.php';
require __DIR__ . '/../../include/posts.php';
require __DIR__ . '/../../include/owner.php';

$method = require_method('GET', 'POST', 'PUT', 'DELETE');

['user' => $user, 'place' => $place] = require_owner();

$placeId = (int) $place['id'];
$pdo     = db();

// ─── GET: every post of my shop, pinned first ────────────────────────────────

if ($method === 'GET') {
    $st = $pdo->prepare(
        post_select() . ' WHERE po.place_id = ?
        ORDER BY po.is_pinned DESC, po.created_at DESC, po.id DESC'
    );
    $st->execute([$placeId]);
    json_out(array_map('post_shape', $st->fetchAll()));
}

require_csrf();

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Validate discount-specific fields; returns error string or null. */
function validate_discount_fields(string $discountText, mixed $ticketLimit, mixed $expiresAt): ?string
{
    if (trim($discountText) === '') {
        return 'Say what the discount is';
    }
    $limit = filter_var($ticketLimit, FILTER_VALIDATE_INT);
    if ($limit === false || $limit < 1 || $limit > 500) {
        return 'Ticket limit must be 1 to 500';
    }
    if (!$expiresAt || strtotime((string) $expiresAt) <= time()) {
        return 'The end time must be in the future';
    }
    return null;
}

/** Check subscription is active; fail 403 if not. */
function require_active_subscription(array $user): void
{
    if (active_subscription($user['id']) === null) {
        fail(403, 'Your subscription is not active');
    }
}

/** Validate and store an uploaded image. Returns stored relative path. */
function store_post_image(): ?string
{
    $f = $_FILES['image'] ?? null;
    if ($f === null || ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if ($f['error'] !== UPLOAD_ERR_OK) {
        fail(422, 'Image could not be uploaded');
    }
    if ($f['size'] > 5 * 1024 * 1024) {
        fail(422, 'Image must be 5 MB or less');
    }
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = finfo_file($finfo, $f['tmp_name']);
    finfo_close($finfo);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
    if ($ext === null) {
        fail(422, 'Image must be a JPEG, PNG or WebP');
    }
    $name   = bin2hex(random_bytes(16)) . '.' . $ext;
    $target = __DIR__ . '/../../uploads/places/' . $name;
    if (!is_dir(dirname($target)) && !mkdir(dirname($target), 0775, true)) {
        fail(500, 'Server error');
    }
    if (!move_uploaded_file($f['tmp_name'], $target)) {
        fail(500, 'Server error');
    }
    return '/uploads/places/' . $name;
}

/** Return one post row shaped as Post, or fail 404. Optionally enforce ownership. */
function find_own_post(int $id, int $placeId): array
{
    $st = db()->prepare(post_select() . ' WHERE po.id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) {
        fail(404, 'Post not found');
    }
    if ((int) $row['place_id'] !== $placeId) {
        fail(403, 'Not your post');
    }
    return $row;
}

// ─── POST: create ────────────────────────────────────────────────────────────

if ($method === 'POST') {
    require_active_subscription($user);

    $type    = trim((string) ($_POST['type'] ?? ''));
    $content = trim((string) ($_POST['content'] ?? ''));
    $len     = mb_strlen($content);

    if (!in_array($type, ['normal', 'discount'], true)) {
        fail(422, 'Post type must be normal or discount');
    }
    if ($len < 1 || $len > 1000) {
        fail(422, 'Write the post (1 to 1000 characters)');
    }

    $imageUrl     = store_post_image();
    $discountText = null;
    $ticketLimit  = null;
    $expiresAt    = null;

    if ($type === 'discount') {
        $discountText = trim((string) ($_POST['discountText'] ?? ''));
        $ticketLimit  = $_POST['ticketLimit'] ?? null;
        $rawExpires   = $_POST['expiresAt'] ?? '';
        $err = validate_discount_fields($discountText, $ticketLimit, $rawExpires);
        if ($err !== null) {
            fail(422, $err);
        }
        $ticketLimit = (int) $ticketLimit;
        // Normalise to 'Y-m-d H:i:s' for MySQL.
        $expiresAt = date('Y-m-d H:i:s', strtotime((string) $rawExpires));
    }

    $st = $pdo->prepare(
        'INSERT INTO posts (place_id, type, content, image_url, discount_text, ticket_limit, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $st->execute([$placeId, $type, $content, $imageUrl, $discountText, $ticketLimit, $expiresAt]);

    $newId = (int) $pdo->lastInsertId();
    $row   = $pdo->prepare(post_select() . ' WHERE po.id = ?');
    $row->execute([$newId]);

    json_out(post_shape($row->fetch()), 201);
}

// ─── PUT: edit ───────────────────────────────────────────────────────────────

if ($method === 'PUT') {
    $id  = isset($_GET['id']) && ctype_digit((string) $_GET['id']) ? (int) $_GET['id'] : 0;
    $row = find_own_post($id, $placeId);
    $in  = body();

    $sets   = [];
    $params = [];

    if (array_key_exists('content', $in)) {
        $content = trim((string) $in['content']);
        $len = mb_strlen($content);
        if ($len < 1 || $len > 1000) {
            fail(422, 'Write the post (1 to 1000 characters)');
        }
        $sets[]   = 'content = ?';
        $params[] = $content;
    }

    if ($row['type'] === 'discount') {
        if (array_key_exists('discountText', $in) || array_key_exists('ticketLimit', $in) || array_key_exists('expiresAt', $in)) {
            $discountText = array_key_exists('discountText', $in) ? trim((string) $in['discountText']) : $row['discount_text'];
            $ticketLimit  = array_key_exists('ticketLimit', $in) ? $in['ticketLimit'] : $row['ticket_limit'];
            $expiresAt    = array_key_exists('expiresAt', $in) ? $in['expiresAt'] : $row['expires_at'];
            $err = validate_discount_fields((string) $discountText, $ticketLimit, $expiresAt);
            if ($err !== null) {
                fail(422, $err);
            }
            $sets[]   = 'discount_text = ?';
            $params[] = trim((string) $discountText);
            $sets[]   = 'ticket_limit = ?';
            $params[] = (int) $ticketLimit;
            $sets[]   = 'expires_at = ?';
            $params[] = date('Y-m-d H:i:s', strtotime((string) $expiresAt));
        }
    }

    if (array_key_exists('isPinned', $in)) {
        $sets[]   = 'is_pinned = ?';
        $params[] = (bool) $in['isPinned'] ? 1 : 0;
    }

    if ($sets) {
        $params[] = $id;
        $pdo->prepare('UPDATE posts SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    }

    $updated = $pdo->prepare(post_select() . ' WHERE po.id = ?');
    $updated->execute([$id]);
    json_out(post_shape($updated->fetch()));
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

$id = isset($_GET['id']) && ctype_digit((string) $_GET['id']) ? (int) $_GET['id'] : 0;
find_own_post($id, $placeId); // ownership check

// Existing tickets keep working until they expire; only the post row is removed.
$pdo->prepare('DELETE FROM posts WHERE id = ?')->execute([$id]);
json_out(['deleted' => true]);
