<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/shapes.php';

// The logged-in user's reviews, newest first: [ Review & { place: PlaceSummary } ].
require_method('GET');
$user = require_login();

$st = db()->prepare(
    'SELECT r.id, r.place_id, r.rating, r.comment AS text, r.created_at, r.updated_at, r.owner_reply,
            u.id AS user_id, u.name AS user_name,
            p.name AS p_name, p.address AS p_address,
            c.id AS cat_id, c.name_en, c.name_my, c.group_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN places p ON p.id = r.place_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC, r.id DESC'
);
$st->execute([$user['id']]);

$out = [];
foreach ($st->fetchAll() as $r) {
    $out[] = review_shape($r) + ['place' => place_summary([
        'id'         => $r['place_id'],
        'name'       => $r['p_name'],
        'address'    => $r['p_address'],
        'cat_id'     => $r['cat_id'],
        'name_en'    => $r['name_en'],
        'name_my'    => $r['name_my'],
        'group_name' => $r['group_name'],
    ])];
}

json_out($out);
