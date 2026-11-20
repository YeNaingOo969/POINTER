<?php
// GET /api/owner/shop.php
//   The authenticated owner's shop profile + subscription + overview numbers.
//   Response: { place, subscription, stats }
//
// PUT /api/owner/shop.php
//   Update the shop profile. Editable: name, description, phone, address,
//   categoryId, location { lat, lng }, openingHours [{ day, open, close }].
//   Status (pending/active/hidden) stays with the admin.
//   Every changed field is written to place_edit_history.
//   Response: same shape as GET.
//
// 401 not logged in | 403 no active place / not your shop | 422 invalid fields
declare(strict_types=1);

require __DIR__ . '/../../include/bootstrap.php';
require __DIR__ . '/../../include/owner.php';

$method = require_method('GET', 'PUT');

if ($method === 'GET') {
    ['user' => $user, 'place' => $place] = require_owner();
    json_out(owner_shop_payload($user, $place));
}

// ---------- PUT ----------

['user' => $user, 'place' => $place] = require_owner();
require_csrf();

$placeId = (int) $place['id'];
$ownerId = (int) $user['id'];
$in      = body();

$sets   = [];
$params = [];

// --- name (varchar 150) ---
if (array_key_exists('name', $in)) {
    $name = trim((string) $in['name']);
    $len  = mb_strlen($name);
    if ($len < 2 || $len > 150) {
        fail(422, 'Shop name must be 2 to 150 characters');
    }
    $sets[]   = 'name = ?';
    $params[] = $name;
}

// --- description ---
if (array_key_exists('description', $in)) {
    $description = trim((string) $in['description']);
    $len         = mb_strlen($description);
    if ($len < 10 || $len > 600) {
        fail(422, 'Describe your shop (10 to 600 characters)');
    }
    $sets[]   = 'description = ?';
    $params[] = $description;
}

// --- phone ---
if (array_key_exists('phone', $in)) {
    $phone = trim((string) $in['phone']);
    if ($phone === '') {
        $phone = null;
    } elseif (!preg_match('/^[0-9+\s()\-]{6,20}$/', $phone)) {
        fail(422, 'Check the phone number');
    }
    $sets[]   = 'phone = ?';
    $params[] = $phone;
}

// --- address (varchar 255) ---
if (array_key_exists('address', $in)) {
    $address = trim((string) $in['address']);
    $len     = mb_strlen($address);
    if ($len < 5 || $len > 255) {
        fail(422, 'Enter the street address (5 to 255 characters)');
    }
    $sets[]   = 'address = ?';
    $params[] = $address;
}

// --- category ---
if (array_key_exists('categoryId', $in)) {
    $categoryId = filter_var($in['categoryId'], FILTER_VALIDATE_INT);
    if ($categoryId === false) {
        fail(422, 'Choose a category');
    }
    $st = db()->prepare('SELECT 1 FROM categories WHERE id = ?');
    $st->execute([$categoryId]);
    if (!$st->fetchColumn()) {
        fail(422, 'Choose a category');
    }
    $sets[]   = 'category_id = ?';
    $params[] = (int) $categoryId;
}

// --- location: { lat, lng } or top-level lat/lng ---
$latProvided = false;
$lngProvided = false;
$lat = null;
$lng = null;
if (isset($in['location']) && is_array($in['location'])) {
    $latProvided = array_key_exists('lat', $in['location']);
    $lngProvided = array_key_exists('lng', $in['location']);
    $lat = $latProvided ? $in['location']['lat'] : null;
    $lng = $lngProvided ? $in['location']['lng'] : null;
} else {
    $latProvided = array_key_exists('lat', $in);
    $lngProvided = array_key_exists('lng', $in);
    $lat = $latProvided ? $in['lat'] : null;
    $lng = $lngProvided ? $in['lng'] : null;
}
if ($latProvided || $lngProvided) {
    if (!$latProvided || !$lngProvided) {
        fail(422, 'Send both lat and lng');
    }
    $lat = filter_var($lat, FILTER_VALIDATE_FLOAT);
    $lng = filter_var($lng, FILTER_VALIDATE_FLOAT);
    if ($lat === false || $lng === false || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
        fail(422, 'Check the map location');
    }
    $sets[]   = 'lat = ?';
    $params[] = $lat;
    $sets[]   = 'lng = ?';
    $params[] = $lng;
}

// --- opening hours ---
if (array_key_exists('openingHours', $in)) {
    $sets[]   = 'open_hours = ?';
    $params[] = owner_opening_hours($in['openingHours']);
}

if (!$sets) {
    fail(422, 'Nothing to update');
}

$params[] = $placeId;
db()->prepare('UPDATE places SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);

// ---------- Audit log (only the fields that changed) ----------

$fresh = owner_place_by_id($placeId);

$tracked = [
    'name'        => [$place['name'], $fresh['name']],
    'description' => [$place['description'], $fresh['description']],
    'phone'       => [$place['phone'], $fresh['phone']],
    'address'     => [$place['address'], $fresh['address']],
    'category_id' => [$place['category_id'], $fresh['category_id']],
    'lat'         => [$place['lat'], $fresh['lat']],
    'lng'         => [$place['lng'], $fresh['lng']],
    'open_hours'  => [$place['open_hours'], $fresh['open_hours']],
];
foreach ($tracked as $field => [$old, $new]) {
    log_place_edit($placeId, $ownerId, $field, $old, $new);
}

json_out(owner_shop_payload($user, $fresh));
