<?php
require __DIR__ . '/../../include/bootstrap.php';

$method = require_method('GET', 'POST', 'PUT', 'DELETE');
$admin = require_admin();
$pdo = db();

if ($method === 'GET') {
    $owned      = isset($_GET['owned']) ? $_GET['owned'] : null;
    $status     = trim((string) ($_GET['status'] ?? ''));
    $categoryId = isset($_GET['categoryId']) ? (int) $_GET['categoryId'] : 0;
    $q          = trim((string) ($_GET['q'] ?? ''));

    $sql = "SELECT p.*,
                   c.name_en as category_name, c.name_my as category_name_my, c.group_name as category_group,
                   u.name as owner_name, u.email as owner_email,
                   MAX(up.months) as plan_months, MAX(up.expires_at) as plan_expires_at,
                   COALESCE(AVG(r.rating), 0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM places p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN users u ON u.id = p.owner_id
            LEFT JOIN owner_upgrades up ON up.id = (
                SELECT o2.id
                FROM owner_upgrades o2
                WHERE o2.user_id = p.owner_id AND o2.status = 'approved'
                ORDER BY o2.expires_at DESC, o2.id DESC
                LIMIT 1
            )
            LEFT JOIN reviews r ON r.place_id = p.id
            WHERE 1=1";

    $params = [];

    if ($owned !== null && $owned !== '') {
        if ($owned == 1 || $owned === 'true') {
            $sql .= " AND p.owner_id IS NOT NULL";
        } elseif ($owned == 0 || $owned === 'false') {
            $sql .= " AND p.owner_id IS NULL";
        }
    }

    if ($status !== '') {
        $sql .= " AND p.status = ?";
        $params[] = strtolower($status);
    } elseif ($owned !== null && $owned !== '') {
        // Pending and rejected shop requests stay in Applications until approved.
        $sql .= " AND p.status IN ('active', 'hidden')";
    }

    if ($categoryId > 0) {
        $sql .= " AND p.category_id = ?";
        $params[] = $categoryId;
    }

    if ($q !== '') {
        $sql .= " AND (p.name LIKE ? OR p.address LIKE ? OR p.description LIKE ? OR p.phone LIKE ?)";
        $wildcard = "%$q%";
        $params[] = $wildcard;
        $params[] = $wildcard;
        $params[] = $wildcard;
        $params[] = $wildcard;
    }

    $sql .= " GROUP BY p.id ORDER BY p.id DESC";

    $st = $pdo->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll();

    $results = array_map(function ($r) {
        $hours = [];
        if (!empty($r['open_hours'])) {
            $decoded = json_decode($r['open_hours'], true);
            if (is_array($decoded)) {
                $hours = $decoded;
            }
        }

        $avg = round((float) $r['avg_rating'], 1);
        $count = (int) $r['review_count'];
        $planMonths = $r['plan_months'] ? (int) $r['plan_months'] : null;
        $planExpiresAt = $r['plan_expires_at'] ?: null;
        $isExpired = ($planExpiresAt !== null && strtotime($planExpiresAt) <= time());

        return [
            'id'              => (int) $r['id'],
            'ownerId'         => $r['owner_id'] ? (int) $r['owner_id'] : null,
            'ownerName'       => $r['owner_name'],
            'ownerEmail'      => $r['owner_email'],
            'categoryId'      => (int) $r['category_id'],
            'categoryName'    => $r['category_name'],
            'categoryNameMy'  => $r['category_name_my'],
            'categoryGroup'   => $r['category_group'],
            'name'            => $r['name'],
            'description'     => $r['description'] ?: '',
            'phone'           => $r['phone'] ?: '',
            'address'         => $r['address'] ?: '',
            'lat'             => (float) $r['lat'],
            'lng'             => (float) $r['lng'],
            'coverPhoto'      => $r['cover_photo'],
            'storefrontPhoto' => $r['storefront_photo'],
            'status'          => $r['status'],
            'isHidden'        => ($r['status'] === 'hidden'),
            'planMonths'      => $planMonths,
            'planExpiresAt'   => $planExpiresAt ? iso($planExpiresAt) : null,
            'isExpired'       => $isExpired,
            'openHours'       => $hours,
            'rating'          => [
                'average' => $count > 0 ? $avg : 5.0,
                'count'   => $count,
            ],
            'createdAt'       => iso($r['created_at']),
        ];
    }, $rows);

    json_out($results);
}

if ($method === 'POST') {
    // Create Public Place (owner_id = NULL)
    $in = body();
    $name        = trim((string) ($in['name'] ?? ''));
    $categoryId  = (int) ($in['categoryId'] ?? ($in['category_id'] ?? 4));
    $address     = trim((string) ($in['address'] ?? ''));
    $description = trim((string) ($in['description'] ?? ''));
    $phone       = trim((string) ($in['phone'] ?? ''));
    $lat         = (float) ($in['lat'] ?? 16.799);
    $lng         = (float) ($in['lng'] ?? 96.15);
    $coverPhoto  = trim((string) ($in['coverPhoto'] ?? ($in['cover_photo'] ?? '')));

    if ($name === '') {
        fail(422, 'Place name is required');
    }

    $st = $pdo->prepare("INSERT INTO places (category_id, owner_id, name, description, phone, address, lat, lng, cover_photo, status, created_at)
                         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())");
    $st->execute([
        $categoryId,
        $name,
        $description ?: null,
        $phone ?: null,
        $address,
        $lat,
        $lng,
        $coverPhoto ?: null,
    ]);

    $placeId = (int) $pdo->lastInsertId();
    log_audit($admin['id'], 'add_public_place', 'place', $placeId);

    json_out([
        'id'          => $placeId,
        'name'        => $name,
        'categoryId'  => $categoryId,
        'address'     => $address,
        'description' => $description,
        'lat'         => $lat,
        'lng'         => $lng,
        'status'      => 'active',
        'createdAt'   => iso(date('Y-m-d H:i:s')),
    ], 201);
}

if ($method === 'PUT') {
    $id = (int) ($_GET['id'] ?? 0);
    $in = body();
    if ($id <= 0 && !empty($in['id'])) {
        $id = (int) $in['id'];
    }
    if ($id <= 0) {
        fail(422, 'Place ID is required');
    }

    $st = $pdo->prepare('SELECT * FROM places WHERE id = ?');
    $st->execute([$id]);
    $place = $st->fetch();
    if (!$place) {
        fail(404, 'Place not found');
    }

    $name        = isset($in['name']) ? trim((string) $in['name']) : $place['name'];
    $categoryId  = isset($in['categoryId']) ? (int) $in['categoryId'] : (isset($in['category_id']) ? (int) $in['category_id'] : (int) $place['category_id']);
    $address     = isset($in['address']) ? trim((string) $in['address']) : $place['address'];
    $description = isset($in['description']) ? trim((string) $in['description']) : $place['description'];
    $phone       = isset($in['phone']) ? trim((string) $in['phone']) : $place['phone'];
    $lat         = isset($in['lat']) ? (float) $in['lat'] : (float) $place['lat'];
    $lng         = isset($in['lng']) ? (float) $in['lng'] : (float) $place['lng'];
    $coverPhoto  = isset($in['coverPhoto']) ? trim((string) $in['coverPhoto']) : $place['cover_photo'];

    $status = $place['status'];
    if (isset($in['isHidden'])) {
        $status = $in['isHidden'] ? 'hidden' : 'active';
    } elseif (isset($in['status'])) {
        $status = strtolower(trim((string) $in['status']));
    }

    $hours = $place['open_hours'];
    if (isset($in['openHours'])) {
        $hours = is_string($in['openHours']) ? $in['openHours'] : json_encode($in['openHours'], JSON_UNESCAPED_UNICODE);
    }

    $stUp = $pdo->prepare("UPDATE places
                           SET name = ?, category_id = ?, address = ?, description = ?, phone = ?,
                               lat = ?, lng = ?, cover_photo = ?, status = ?, open_hours = ?
                           WHERE id = ?");
    $stUp->execute([
        $name, $categoryId, $address, $description, $phone,
        $lat, $lng, $coverPhoto, $status, $hours, $id
    ]);

    log_audit($admin['id'], 'update_place', 'place', $id);

    json_out([
        'id'          => $id,
        'name'        => $name,
        'categoryId'  => $categoryId,
        'address'     => $address,
        'description' => $description,
        'status'      => $status,
        'isHidden'    => ($status === 'hidden'),
        'message'     => 'Place updated successfully',
    ]);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        fail(422, 'Place ID is required');
    }

    $st = $pdo->prepare("UPDATE places SET status = 'hidden' WHERE id = ?");
    $st->execute([$id]);

    log_audit($admin['id'], 'hide_place', 'place', $id);

    json_out(['id' => $id, 'status' => 'hidden', 'message' => 'Place archived']);
}
