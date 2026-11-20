<?php
require __DIR__ . '/../../include/bootstrap.php';

$method = require_method('GET', 'POST', 'PUT', 'DELETE');
$admin = require_admin();
$pdo = db();

if ($method === 'GET') {
    $rows = $pdo->query("SELECT c.*, COUNT(p.id) as places_count
                         FROM categories c
                         LEFT JOIN places p ON p.category_id = c.id
                         GROUP BY c.id, c.name_en, c.name_my, c.group_name
                         ORDER BY c.id ASC")->fetchAll();

    $results = array_map(fn($r) => [
        'id'          => (int) $r['id'],
        'nameEn'      => $r['name_en'],
        'nameMy'      => $r['name_my'],
        'groupName'   => $r['group_name'],
        'name_en'     => $r['name_en'],
        'name_my'     => $r['name_my'],
        'group_name'  => $r['group_name'],
        'placesCount' => (int) $r['places_count'],
    ], $rows);

    json_out($results);
}

if ($method === 'POST') {
    $in = body();
    $nameEn    = trim((string) ($in['nameEn'] ?? ($in['name_en'] ?? '')));
    $nameMy    = trim((string) ($in['nameMy'] ?? ($in['name_my'] ?? '')));
    $groupName = trim((string) ($in['groupName'] ?? ($in['group_name'] ?? 'other')));

    if ($nameEn === '') {
        fail(422, 'Category English name is required');
    }

    $st = $pdo->prepare("INSERT INTO categories (name_en, name_my, group_name) VALUES (?, ?, ?)");
    $st->execute([$nameEn, $nameMy, $groupName]);
    $catId = (int) $pdo->lastInsertId();

    log_audit($admin['id'], 'create_category', 'category', $catId);

    json_out([
        'id'          => $catId,
        'nameEn'      => $nameEn,
        'nameMy'      => $nameMy,
        'groupName'   => $groupName,
        'name_en'     => $nameEn,
        'name_my'     => $nameMy,
        'group_name'  => $groupName,
        'placesCount' => 0,
    ], 201);
}

if ($method === 'PUT') {
    $id = (int) ($_GET['id'] ?? 0);
    $in = body();
    if ($id <= 0 && !empty($in['id'])) {
        $id = (int) $in['id'];
    }
    if ($id <= 0) {
        fail(422, 'Category ID is required');
    }

    $st = $pdo->prepare('SELECT * FROM categories WHERE id = ?');
    $st->execute([$id]);
    $cat = $st->fetch();
    if (!$cat) {
        fail(404, 'Category not found');
    }

    $nameEn    = isset($in['nameEn']) ? trim((string) $in['nameEn']) : (isset($in['name_en']) ? trim((string) $in['name_en']) : $cat['name_en']);
    $nameMy    = isset($in['nameMy']) ? trim((string) $in['nameMy']) : (isset($in['name_my']) ? trim((string) $in['name_my']) : $cat['name_my']);
    $groupName = isset($in['groupName']) ? trim((string) $in['groupName']) : (isset($in['group_name']) ? trim((string) $in['group_name']) : $cat['group_name']);

    $stUp = $pdo->prepare("UPDATE categories SET name_en = ?, name_my = ?, group_name = ? WHERE id = ?");
    $stUp->execute([$nameEn, $nameMy, $groupName, $id]);

    log_audit($admin['id'], 'update_category', 'category', $id);

    json_out([
        'id'         => $id,
        'nameEn'     => $nameEn,
        'nameMy'     => $nameMy,
        'groupName'  => $groupName,
        'name_en'    => $nameEn,
        'name_my'    => $nameMy,
        'group_name' => $groupName,
        'message'    => 'Category updated successfully',
    ]);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    $in = body();
    if ($id <= 0 && !empty($in['id'])) {
        $id = (int) $in['id'];
    }
    if ($id <= 0) {
        fail(422, 'Category ID is required');
    }

    $reassignTo = (int) ($in['reassignTo'] ?? ($_GET['reassignTo'] ?? 0));
    if ($reassignTo > 0 && $reassignTo !== $id) {
        $stReassign = $pdo->prepare("UPDATE places SET category_id = ? WHERE category_id = ?");
        $stReassign->execute([$reassignTo, $id]);
    } else {
        // Check if places are still assigned to this category
        $stCheck = $pdo->prepare("SELECT COUNT(*) FROM places WHERE category_id = ?");
        $stCheck->execute([$id]);
        if ((int) $stCheck->fetchColumn() > 0) {
            fail(409, 'Cannot delete category that still has places assigned to it. Please reassign first.');
        }
    }

    $stDel = $pdo->prepare("DELETE FROM categories WHERE id = ?");
    $stDel->execute([$id]);

    log_audit($admin['id'], 'delete_category', 'category', $id);

    json_out(['id' => $id, 'message' => 'Category deleted successfully']);
}
