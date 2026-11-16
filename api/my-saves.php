<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/shapes.php';

// The logged-in user's saved places, newest save first: [{ place: PlaceSummary }].
require_method('GET');
$user = require_login();

$st = db()->prepare(
    'SELECT p.id, p.name, p.address,
            c.id AS cat_id, c.name_en, c.name_my, c.group_name
     FROM favorites f
     JOIN places p ON p.id = f.place_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE f.user_id = ?
     ORDER BY f.created_at DESC, p.id DESC'
);
$st->execute([$user['id']]);

// PlaceSummary = { id, name, address, category: { id, name, nameMy, group } }
$out = [];
foreach ($st->fetchAll() as $r) {
    $out[] = ['place' => place_summary($r)];
}

json_out($out);
