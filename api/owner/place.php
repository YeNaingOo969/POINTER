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
    $openingHours = owner_opening_hours($in['openingHours']);
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

// ---------- Audit log (only the fields that changed) ----------

$fresh = owner_place_by_id((int) $place['id']);

$tracked = [
    'description' => [$place['description'], $fresh['description']],
    'phone'       => [$place['phone'], $fresh['phone']],
    'address'     => [$place['address'], $fresh['address']],
    'open_hours'  => [$place['open_hours'], $fresh['open_hours']],
];
foreach ($tracked as $field => [$old, $new]) {
    log_place_edit((int) $place['id'], (int) $user['id'], $field, $old, $new);
}

json_out(owner_place_shape($fresh));
