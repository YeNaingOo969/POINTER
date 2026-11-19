<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/business.php';

// "Add your business" request: multipart/form-data with the shop fields, one shop photo and the
// payment (1, 3 or 12 months) with its screenshot. Saves a pending places row + a pending
// owner_upgrades row in one transaction.
// Field names and payment method values are the ones frontend/business.html sends.
require_method('POST');
$user   = require_login();
$userId = $user['id'];
require_csrf();

// ---------- Helpers ----------

/** Trimmed text form field. */
function field(string $key): string
{
    return trim((string) ($_POST[$key] ?? ''));
}

/** Validate an uploaded image (JPEG / PNG / WebP, max 5 MB). Returns [tmpPath, extension]. */
function check_image(string $key, string $label): array
{
    $f = $_FILES[$key] ?? null;
    if ($f === null || ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        fail(422, "$label is required");
    }
    if ($f['error'] !== UPLOAD_ERR_OK) {
        fail(422, "$label could not be uploaded");
    }
    if ($f['size'] > 5 * 1024 * 1024) {
        fail(422, "$label must be 5 MB or less");
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = finfo_file($finfo, $f['tmp_name']);
    finfo_close($finfo);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
    if ($ext === null) {
        fail(422, "$label must be a JPEG, PNG or WebP image");
    }

    return [$f['tmp_name'], $ext];
}

/** Move a checked image into uploads/<dir>/ under a random name. Returns the stored path. */
function store_image(array $checked, string $dir): string
{
    [$tmp, $ext] = $checked;
    $name = bin2hex(random_bytes(16)) . '.' . $ext;
    $target = __DIR__ . "/../uploads/$dir/$name";
    if (!is_dir(dirname($target)) && !mkdir(dirname($target), 0775, true)) {
        fail(500, 'Server error');
    }
    if (!move_uploaded_file($tmp, $target)) {
        fail(500, 'Server error');
    }
    return "/uploads/$dir/$name";
}

// ---------- One business per user ----------

$st = db()->prepare("SELECT 1 FROM places WHERE owner_id = ? AND status IN ('pending','active','hidden') LIMIT 1");
$st->execute([$userId]);
if ($st->fetchColumn()) {
    fail(409, 'You already have a business request');
}

// ---------- Fields (task doc §5) ----------

$name        = field('name');
$description = field('description');
$phone       = field('phone');
$address     = field('address');
$hoursRaw    = (string) ($_POST['openingHours'] ?? '');
$paymentRef  = field('paymentRef');
$method      = field('paymentMethod');
$categoryId  = (int) ($_POST['categoryId'] ?? 0);
$months      = (int) ($_POST['months'] ?? 0);
$amount      = $_POST['amount'] ?? '';
$lat         = $_POST['lat'] ?? '';
$lng         = $_POST['lng'] ?? '';

$nameLength = mb_strlen($name);
if ($nameLength < 2 || $nameLength > 100) {
    fail(422, 'Shop name must be 2 to 100 characters');
}

$st = db()->prepare('SELECT 1 FROM categories WHERE id = ?');
$st->execute([$categoryId]);
if (!$st->fetchColumn()) {
    fail(422, 'Choose a category');
}

$descriptionLength = mb_strlen($description);
if ($descriptionLength < 10 || $descriptionLength > 600) {
    fail(422, 'Description must be 10 to 600 characters');
}

if (mb_strlen($phone) < 6 || mb_strlen($phone) > 20 || !preg_match('/^[0-9 +()-]+$/', $phone)) {
    fail(422, 'Phone number is not valid');
}

$addressLength = mb_strlen($address);
if ($addressLength < 5 || $addressLength > 200) {
    fail(422, 'Address must be 5 to 200 characters');
}

// Opening hours: JSON text, open days only, [{ "day": "mon", "open": "06:00", "close": "11:00" }]
$hours = json_decode($hoursRaw, true);
if (!is_array($hours) || $hours === []) {
    fail(422, 'Opening hours are not valid');
}
$days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
$cleanHours = [];
foreach ($hours as $h) {
    $open  = is_array($h) ? (string) ($h['open'] ?? '') : '';
    $close = is_array($h) ? (string) ($h['close'] ?? '') : '';
    $day   = is_array($h) ? ($h['day'] ?? null) : null;
    $time  = '/^([01][0-9]|2[0-3]):[0-5][0-9]$/';
    if (!in_array($day, $days, true) || !preg_match($time, $open) || !preg_match($time, $close)) {
        fail(422, 'Opening hours are not valid');
    }
    $cleanHours[] = ['day' => $day, 'open' => $open, 'close' => $close];
}

// Around Yangon only (task doc §5).
if (!is_numeric($lat) || (float) $lat < 16.65 || (float) $lat > 17.05) {
    fail(422, 'Latitude is not valid');
}
if (!is_numeric($lng) || (float) $lng < 95.95 || (float) $lng > 96.35) {
    fail(422, 'Longitude is not valid');
}

// Payment: 1, 3 or 12 months, paid with KBZPay / Wave Pay / AYA Pay.
if (!in_array($months, [1, 3, 12], true)) {
    fail(422, 'Months must be 1, 3 or 12');
}
if (!is_numeric($amount) || (float) $amount <= 0) {
    fail(422, 'Amount is not valid');
}
if (!in_array($method, ['KBZPay', 'Wave Pay', 'AYA Pay'], true)) {
    fail(422, 'Choose a payment method');
}
$refLength = mb_strlen($paymentRef);
if ($refLength < 4 || $refLength > 40) {
    fail(422, 'Transaction ID must be 4 to 40 characters');
}

// ---------- Images: check both before saving either ----------

$shopCheck  = check_image('photo', 'Shop photo');
$proofCheck = check_image('proof', 'Payment screenshot');

$shopPath  = store_image($shopCheck, 'places');
$proofPath = store_image($proofCheck, 'payments');

// ---------- Save (both rows or none) ----------

$pdo = db();
try {
    $pdo->beginTransaction();

    $st = $pdo->prepare(
        "INSERT INTO places (owner_id, category_id, name, address, description, phone, open_hours,
                             lat, lng, storefront_photo, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
    );
    $st->execute([
        $userId, $categoryId, $name, $address, $description, $phone,
        json_encode($cleanHours, JSON_UNESCAPED_UNICODE), (float) $lat, (float) $lng, $shopPath,
    ]);
    $placeId = (int) $pdo->lastInsertId();

    // owner_upgrades keeps the payment by user (the schema has no place_id).
    // starts_at / expires_at stay NULL until an admin approves the request.
    $st = $pdo->prepare(
        "INSERT INTO owner_upgrades (user_id, months, amount, payment_method, payment_ref, payment_proof, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')"
    );
    $st->execute([$userId, $months, round((float) $amount, 2), $method, $paymentRef, $proofPath]);

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    @unlink(__DIR__ . '/../' . $shopPath);
    @unlink(__DIR__ . '/../' . $proofPath);
    throw $e;
}

json_out(business_request_for_user($userId), 201);
