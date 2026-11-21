<?php
// POST /api/owner/renew.php  (multipart/form-data)
// Owner submits a subscription renewal — admin approves it in phase 3 (flowchart 4a).
//
// Fields: months (1|3|12), amount, paymentMethod, paymentRef, proof (image file)
//
// Response: 201 { id, userId, months, amount, paymentMethod, paymentRef, status: 'pending', createdAt }
// 422 on validation failure | 403 no active place
declare(strict_types=1);

require __DIR__ . '/../../include/bootstrap.php';
require __DIR__ . '/../../include/owner.php';

require_method('POST');

['user' => $user, 'place' => $place] = require_owner();
require_csrf();

// ---------- Fields ----------

$months        = (int) ($_POST['months'] ?? 0);
$amount        = (string) ($_POST['amount'] ?? '');
$paymentMethod = trim((string) ($_POST['paymentMethod'] ?? ''));
$paymentRef    = trim((string) ($_POST['paymentRef'] ?? ''));

if (!in_array($months, [1, 3, 12], true)) {
    fail(422, 'Choose 1, 3 or 12 months');
}

$amountVal = filter_var($amount, FILTER_VALIDATE_FLOAT);
if ($amountVal === false || $amountVal <= 0) {
    fail(422, 'Invalid payment amount');
}

if (!in_array($paymentMethod, ['KBZPay', 'Wave Pay', 'AYA Pay'], true)) {
    fail(422, 'Choose KBZPay, Wave Pay or AYA Pay');
}

$refLen = mb_strlen($paymentRef);
if ($refLen < 4 || $refLen > 100) {
    fail(422, 'Enter the transaction ID (4–100 characters)');
}

// ---------- Payment proof image ----------

$proofFile = $_FILES['proof'] ?? null;
if ($proofFile === null || ($proofFile['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
    fail(422, 'Add a screenshot of the payment');
}
if ($proofFile['error'] !== UPLOAD_ERR_OK) {
    fail(422, 'Payment proof could not be uploaded');
}
if ($proofFile['size'] > 5 * 1024 * 1024) {
    fail(422, 'Payment proof must be 5 MB or less');
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $proofFile['tmp_name']);
// finfo_close() is deprecated in PHP 8.5; the object is freed automatically.
$ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
if ($ext === null) {
    fail(422, 'Payment proof must be a JPEG, PNG or WebP image');
}

$proofName = bin2hex(random_bytes(16)) . '.' . $ext;
$proofDir  = __DIR__ . '/../../uploads/payments/';
if (!is_dir($proofDir) && !mkdir($proofDir, 0775, true)) {
    fail(500, 'Server error');
}
if (!move_uploaded_file($proofFile['tmp_name'], $proofDir . $proofName)) {
    fail(500, 'Server error');
}
$proofPath = '/uploads/payments/' . $proofName;

// ---------- Insert ----------

$planId = match($months) {
    1 => 1,
    3 => 2,
    6 => 3,
    12 => 4,
    default => 2
};

$st = db()->prepare(
    "INSERT INTO owner_upgrades (user_id, plan_id, months, amount, payment_method, payment_ref, payment_proof, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')"
);
$st->execute([$user['id'], $planId, $months, $amountVal, $paymentMethod, $paymentRef, $proofPath]);

$newId = (int) db()->lastInsertId();

$row = db()->prepare('SELECT id, user_id, months, amount, payment_method, payment_ref, status, created_at FROM owner_upgrades WHERE id = ?');
$row->execute([$newId]);
$r = $row->fetch();

json_out([
    'id'            => (int) $r['id'],
    'userId'        => (int) $r['user_id'],
    'months'        => (int) $r['months'],
    'amount'        => (float) $r['amount'],
    'paymentMethod' => $r['payment_method'],
    'paymentRef'    => $r['payment_ref'],
    'status'        => $r['status'],
    'createdAt'     => iso($r['created_at']),
], 201);
