<?php
// GET  /api/owner/ticket.php?code=GB-7Q4K  — Look up without consuming (flowchart 3b)
// POST /api/owner/ticket.php { code }       — Consume the ticket at the counter
//
// GET response:
//   { result: 'ok'|'not_found'|'other_shop'|'used'|'expired', ticket?: Ticket & { userName }, post?: Post }
//
// POST response:
//   { result: 'used', ticket } on success
//   409 when already used or expired | 404 not found | 403 other shop's ticket
declare(strict_types=1);

require __DIR__ . '/../../include/bootstrap.php';
require __DIR__ . '/../../include/posts.php';
require __DIR__ . '/../../include/shapes.php';
require __DIR__ . '/../../include/owner.php';

$method = require_method('GET', 'POST');

['user' => $user, 'place' => $place] = require_owner();
$placeId = (int) $place['id'];
$pdo     = db();

// ─── Shared: resolve the ticket + ownership ───────────────────────────────────

$code = '';
if ($method === 'GET') {
    $code = strtoupper(trim((string) ($_GET['code'] ?? '')));
} else {
    require_csrf();
    $in   = body();
    $code = strtoupper(trim((string) ($in['code'] ?? '')));
}

if ($code === '') {
    fail(422, 'Enter a ticket code');
}

// Find the ticket.
$st = $pdo->prepare(
    'SELECT t.id, t.post_id, t.ticket_code, t.status AS db_status, t.used_at, t.created_at,
            u.name AS user_name
     FROM tickets t
     JOIN users u ON u.id = t.user_id
     WHERE t.ticket_code = ?'
);
$st->execute([$code]);
$raw = $st->fetch();

if (!$raw) {
    json_out(['result' => 'not_found']);
}

// Check it belongs to one of my posts.
$pst = $pdo->prepare(post_select() . ' WHERE po.id = ?');
$pst->execute([(int) $raw['post_id']]);
$postRow = $pst->fetch();

if (!$postRow || (int) $postRow['place_id'] !== $placeId) {
    json_out(['result' => 'other_shop']);
}

$post   = post_shape($postRow);
$ticket = ticket_shape($raw) + ['userName' => $raw['user_name']];

// ─── GET: check without consuming ────────────────────────────────────────────

if ($method === 'GET') {
    $result = $ticket['status'] === 'active' ? 'ok' : $ticket['status'];
    json_out(['result' => $result, 'ticket' => $ticket, 'post' => $post]);
}

// ─── POST: consume ────────────────────────────────────────────────────────────

if ($ticket['status'] === 'used') {
    fail(409, 'used');
}
if ($ticket['status'] === 'expired') {
    fail(409, 'expired');
}

// Mark used (atomic: only if still unused).
$up = $pdo->prepare(
    "UPDATE tickets SET status = 'used', used_at = NOW() WHERE id = ? AND used_at IS NULL"
);
$up->execute([(int) $raw['id']]);

if ($up->rowCount() === 0) {
    // Another request got there first.
    fail(409, 'used');
}

// Return the fresh row.
$fresh = $pdo->prepare('SELECT id, post_id, ticket_code, status, used_at, created_at FROM tickets WHERE id = ?');
$fresh->execute([(int) $raw['id']]);
json_out(['result' => 'used', 'ticket' => ticket_shape($fresh->fetch()) + ['userName' => $raw['user_name']]]);
