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
         ORDER BY p.id ASC
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
 * Overview numbers shown on the owner dashboard / shop endpoint.
 * activeDeals = discount posts that have not expired and still have tickets left.
 */
function owner_stats(int $placeId, array $place): array
{
    $pdo = db();

    $st = $pdo->prepare('SELECT COUNT(*) FROM posts WHERE place_id = ?');
    $st->execute([$placeId]);
    $posts = (int) $st->fetchColumn();

    $st = $pdo->prepare(
        "SELECT COUNT(*) FROM posts po
         WHERE po.place_id = ? AND po.type = 'discount'
           AND (po.expires_at IS NULL OR po.expires_at > NOW())
           AND (po.ticket_limit IS NULL OR po.ticket_limit >
                (SELECT COUNT(*) FROM tickets t WHERE t.post_id = po.id))"
    );
    $st->execute([$placeId]);
    $activeDeals = (int) $st->fetchColumn();

    $st = $pdo->prepare(
        'SELECT COUNT(*) FROM tickets t JOIN posts po ON po.id = t.post_id WHERE po.place_id = ?'
    );
    $st->execute([$placeId]);
    $ticketsTaken = (int) $st->fetchColumn();

    $st = $pdo->prepare(
        'SELECT COUNT(*) FROM tickets t JOIN posts po ON po.id = t.post_id
         WHERE po.place_id = ? AND t.used_at IS NOT NULL'
    );
    $st->execute([$placeId]);
    $ticketsUsed = (int) $st->fetchColumn();

    return [
        'posts'        => $posts,
        'activeDeals'  => $activeDeals,
        'ticketsTaken' => $ticketsTaken,
        'ticketsUsed'  => $ticketsUsed,
        'rating'       => [
            'average' => round((float) $place['avg_rating'], 1),
            'count'   => (int) $place['review_count'],
        ],
    ];
}

/**
 * Payload for GET/PUT /api/owner/shop.php: profile + subscription + overview numbers.
 */
function owner_shop_payload(array $user, array $place): array
{
    return [
        'place'        => owner_place_shape($place),
        'subscription' => subscription_out(active_subscription((int) $user['id'])),
        'stats'        => owner_stats((int) $place['id'], $place),
    ];
}

/**
 * Fetch one place again after an update (same joins as require_owner()).
 */
function owner_place_by_id(int $placeId): array
{
    $st = db()->prepare(
        "SELECT p.id, p.name, p.owner_id, p.category_id, p.description, p.phone,
                p.open_hours, p.address, p.lat, p.lng, p.cover_photo, p.storefront_photo,
                p.status, p.created_at,
                c.id AS cat_id, c.name_en, c.name_my, c.group_name,
                COALESCE(r.avg_rating, 0) AS avg_rating,
                COALESCE(r.review_count, 0) AS review_count
         FROM places p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN (SELECT place_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
                    FROM reviews GROUP BY place_id) r ON r.place_id = p.id
         WHERE p.id = ?"
    );
    $st->execute([$placeId]);
    $row = $st->fetch();
    if (!$row) {
        fail(404, 'Shop not found');
    }
    return $row;
}

/**
 * Log one changed place column into place_edit_history (issue #6).
 * Soft-fails when the migration (sql/004_place_edit_history.sql) has not been run,
 * so an older database does not break saving the shop.
 */
function log_place_edit(int $placeId, int $ownerId, string $field, mixed $old, mixed $new): void
{
    static $ready = null;

    if ((string) $old === (string) $new) {
        return;
    }
    if ($ready === null) {
        $st    = db()->query("SHOW TABLES LIKE 'place_edit_history'");
        $ready = (bool) $st->fetchColumn();
    }
    if (!$ready) {
        return;
    }

    $st = db()->prepare(
        'INSERT INTO place_edit_history (place_id, owner_id, field, old_value, new_value)
         VALUES (?, ?, ?, ?, ?)'
    );
    $st->execute([
        $placeId,
        $ownerId,
        $field,
        $old === null ? null : (string) $old,
        $new === null ? null : (string) $new,
    ]);
}

/**
 * Validate + normalise openingHours from a JSON body.
 * Expected: [{ day: mon..sun, open: HH:MM, close: HH:MM }, ...]
 * Returns the JSON string to store, or fails 422.
 */
function owner_opening_hours(mixed $hours): string
{
    if (!is_array($hours)) {
        fail(422, 'Opening hours must be an array');
    }
    $days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    foreach ($hours as $h) {
        if (!is_array($h) || !isset($h['day'], $h['open'], $h['close']) || !in_array($h['day'], $days, true)) {
            fail(422, 'Invalid opening hours');
        }
        if (!preg_match('/^\d{2}:\d{2}$/', (string) $h['open']) || !preg_match('/^\d{2}:\d{2}$/', (string) $h['close'])) {
            fail(422, 'Opening hours must use HH:MM format');
        }
    }
    return json_encode(array_values($hours), JSON_UNESCAPED_UNICODE);
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
