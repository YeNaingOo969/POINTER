<?php
// PUT /api/owner/place.php { description, phone, address, openingHours }
// Owner edits the safe fields of their place.
// Name, category and coordinates stay with the admin and are NOT editable here.
//
// Response: Place (same shape as /api/places.php?id=N)
// 422 on validation failure
declare(strict_types=1);

require __DIR__ . '/../../include/bootstrap.php';
require __DIR__ . '/../../include/owner.php';

require_method('PUT');

['user' => $user, 'place' => $place] = require_owner();
require_csrf();

$in = body();

// ---------- Validate ----------

$description = trim((string) ($in['description'] ?? ''));
$descLen     = mb_strlen($description);
if ($descLen < 10 || $descLen > 600) {
    fail(422, 'Describe your shop (10 to 600 characters)');
}

$phone = isset($in['phone']) ? trim((string) $in['phone']) : null;
if ($phone !== null && $phone !== '') {
    if (!preg_match('/^[0-9+\s()\-]{6,20}$/', $phone)) {
        fail(422, 'Check the phone number');
    }
} else {
    $phone = null;
}

$address = trim((string) ($in['address'] ?? $place['address']));
$addrLen = mb_strlen($address);
if ($addrLen < 5 || $addrLen > 200) {
    fail(422, 'Enter the street address (5 to 200 characters)');
}

// Opening hours: a JSON array of { day, open, close } objects.
$openingHours = null;
if (array_key_exists('openingHours', $in)) {
    $hours = $in['openingHours'];
    if (!is_array($hours)) {
        fail(422, 'Opening hours must be an array');
    }
    $days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    foreach ($hours as $h) {
        if (!isset($h['day'], $h['open'], $h['close']) || !in_array($h['day'], $days, true)) {
            fail(422, 'Invalid opening hours');
        }
        if (!preg_match('/^\d{2}:\d{2}$/', (string) $h['open']) || !preg_match('/^\d{2}:\d{2}$/', (string) $h['close'])) {
            fail(422, 'Opening hours must use HH:MM format');
        }
    }
    $openingHours = json_encode(array_values($hours), JSON_UNESCAPED_UNICODE);
}

// ---------- Persist ----------

$sets   = ['description = ?', 'phone = ?', 'address = ?'];
$params = [$description, $phone, $address];

if ($openingHours !== null) {
    $sets[]   = 'open_hours = ?';
    $params[] = $openingHours;
}

$params[] = (int) $place['id'];
db()->prepare('UPDATE places SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);

// Return fresh place row.
$fresh = db()->prepare(
    "SELECT p.id, p.name, p.owner_id, p.category_id, p.description, p.phone,
            p.open_hours, p.address, p.lat, p.lng, p.cover_photo, p.storefront_photo,
            p.status, p.created_at,
            c.id AS cat_id, c.name_en, c.name_my, c.group_name,
            COALESCE(r.avg_rating, 0) AS avg_rating,
            COALESCE(r.review_count, 0) AS review_count
     FROM places p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN (SELECT place_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
                FROM reviews GROUP BY place_id) r ON r.place_id = p.id
     WHERE p.id = ?"
);
$fresh->execute([(int) $place['id']]);

json_out(owner_place_shape($fresh->fetch()));
