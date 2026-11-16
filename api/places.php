<?php
require __DIR__ . '/../include/bootstrap.php';

require_method('GET');

// Only approved places (status 'active'); pending requests and hidden places stay out.
// Rating = average and count of reviews. LEFT JOINs keep places with no reviews / no category.
$sql = "SELECT p.id, p.name, p.owner_id, p.address, p.description, p.phone, p.open_hours,
               p.lat, p.lng, p.cover_photo,
               c.id AS cat_id, c.name_en, c.name_my, c.group_name,
               COALESCE(r.avg_rating, 0) AS avg_rating, COALESCE(r.review_count, 0) AS review_count
        FROM places p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN (SELECT place_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
                   FROM reviews GROUP BY place_id) r ON r.place_id = p.id
        WHERE p.status = 'active'";

$pdo  = db();
$user = current_user();

// Phase 2 rule: a user doesn't see shops of owners they blocked.
$params = [];
if ($user !== null) {
    $sql .= ' AND (p.owner_id IS NULL OR p.owner_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?))';
    $params[] = $user['id'];
}

$id = null;
if (isset($_GET['id'])) {
    if (!ctype_digit((string) $_GET['id'])) {
        fail(404, 'Place not found');
    }
    $id = (int) $_GET['id'];
    $sql .= ' AND p.id = ?';
    $params[] = $id;
}
$sql .= ' ORDER BY p.id';

$st = $pdo->prepare($sql);
$st->execute($params);
$rows = $st->fetchAll();

if ($id !== null && !$rows) {
    fail(404, 'Place not found');
}

// Photos for the places we are returning (one query, not one per place).
$photos = [];
if ($rows) {
    $ids = array_map(fn ($r) => (int) $r['id'], $rows);
    $in  = implode(',', array_fill(0, count($ids), '?'));
    $ph  = $pdo->prepare("SELECT place_id, url FROM place_photos WHERE place_id IN ($in) ORDER BY id");
    $ph->execute($ids);
    foreach ($ph->fetchAll() as $p) {
        $photos[(int) $p['place_id']][] = ['url' => $p['url']];
    }
}

function open_hours(?string $json): array
{
    if ($json === null || trim($json) === '') {
        return [];
    }
    $data = json_decode($json, true);
    return is_array($data) ? array_values($data) : [];
}

$places = array_map(fn ($r) => [
    'id'           => (int) $r['id'],
    'name'         => $r['name'],
    'category'     => $r['cat_id'] === null ? null : [
        'id'     => (int) $r['cat_id'],
        'name'   => $r['name_en'],
        'nameMy' => $r['name_my'],
        'group'  => $r['group_name'],
    ],
    'ownerId'      => $r['owner_id'] === null ? null : (int) $r['owner_id'],
    'address'      => $r['address'],
    'description'  => $r['description'],
    'phone'        => $r['phone'],
    'location'     => ['lat' => (float) $r['lat'], 'lng' => (float) $r['lng']],
    'openingHours' => open_hours($r['open_hours']),
    'coverPhoto'   => $r['cover_photo'],
    'photos'       => $photos[(int) $r['id']] ?? [],
    'rating'       => ['average' => round((float) $r['avg_rating'], 1), 'count' => (int) $r['review_count']],
], $rows);

json_out($id !== null ? $places[0] : $places);
