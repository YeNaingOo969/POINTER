<?php
// Shared helpers for every api/owner/* endpoint.
// Usage: require __DIR__ . '/../include/owner.php';
//        $place = require_owner();   // also calls require_csrf() for state-changing verbs if needed
declare(strict_types=1);

/**
 * Require the current user to be logged in AND own an active place.
 * Returns ['user' => [...], 'place' => [...]] on success.
 * Fails 401 when not logged in, 403 when no active place found.
 */
function require_owner(): array
{
    $user = require_login();

    $st = db()->prepare(
        "SELECT p.id, p.name, p.owner_id, p.category_id, p.description, p.phone,
                p.open_hours, p.address, p.lat, p.lng, p.cover_photo, p.storefront_photo,
                p.status, p.created_at,
                c.id AS cat_id, c.name_en, c.name_my, c.group_name,
                COALESCE(r.avg_rating, 0) AS avg_rating,
                COALESCE(r.review_count, 0) AS review_count
         FROM places p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN (
             SELECT place_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
             FROM reviews GROUP BY place_id
         ) r ON r.place_id = p.id
         WHERE p.owner_id = ? AND p.status = 'active'
         LIMIT 1"
    );
    $st->execute([$user['id']]);
    $place = $st->fetch();

    if (!$place) {
        fail(403, 'You have no active shop');
    }

    return ['user' => $user, 'place' => $place];
}

/**
 * Active owner_upgrades row for a user, or null.
 * "Active" = status approved AND expires_at > NOW().
 */
function active_subscription(int $userId): ?array
{
    $st = db()->prepare(
        "SELECT id, months, amount, payment_method, starts_at, expires_at
         FROM owner_upgrades
         WHERE user_id = ? AND status = 'approved' AND expires_at > NOW()
         ORDER BY expires_at DESC LIMIT 1"
    );
    $st->execute([$userId]);
    $row = $st->fetch();
    return $row ?: null;
}

/**
 * Subscription shape the owner dashboard expects.
 * { months, startsAt, expiresAt, active, daysLeft }
 */
function subscription_out(?array $sub): ?array
{
    if ($sub === null) return null;
    $expires = strtotime((string) $sub['expires_at']);
    $daysLeft = max(0, (int) ceil(($expires - time()) / 86400));
    return [
        'months'    => (int) $sub['months'],
        'startsAt'  => iso($sub['starts_at']),
        'expiresAt' => iso($sub['expires_at']),
        'active'    => $daysLeft > 0,
        'daysLeft'  => $daysLeft,
    ];
}

/**
 * Place shape returned to the owner (includes all editable fields).
 */
function owner_place_shape(array $r): array
{
    $hours = json_decode((string) $r['open_hours'], true);
    return [
        'id'           => (int) $r['id'],
        'name'         => $r['name'],
        'category'     => $r['cat_id'] === null ? null : [
            'id'     => (int) $r['cat_id'],
            'name'   => $r['name_en'],
            'nameMy' => $r['name_my'],
            'group'  => $r['group_name'],
        ],
        'ownerId'      => (int) $r['owner_id'],
        'address'      => $r['address'],
        'description'  => $r['description'],
        'phone'        => $r['phone'],
        'location'     => ['lat' => (float) $r['lat'], 'lng' => (float) $r['lng']],
        'openingHours' => is_array($hours) ? array_values($hours) : [],
        'coverPhoto'   => $r['cover_photo'],
        'storefrontPhoto' => $r['storefront_photo'],
        'status'       => $r['status'],
        'rating'       => [
            'average' => round((float) $r['avg_rating'], 1),
            'count'   => (int) $r['review_count'],
        ],
        'createdAt'    => iso($r['created_at']),
    ];
}
