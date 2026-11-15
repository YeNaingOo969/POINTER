<?php
require __DIR__ . '/../include/bootstrap.php';

require_method('GET');

$rows = db()->query('SELECT id, name_en, name_my, group_name FROM categories ORDER BY id')->fetchAll();

json_out(array_map(fn ($r) => [
    'id'     => (int) $r['id'],
    'name'   => $r['name_en'],
    'nameMy' => $r['name_my'],
    'group'  => $r['group_name'],
], $rows));
