<?php
// Row -> JSON shapes shared by the customer posts/deals/ticket endpoints.
// Column names follow database/pointer.sql: posts.content, tickets.ticket_code, ...
declare(strict_types=1);

/** SELECT that adds the place summary, its category and how many tickets were taken. */
function post_select(): string
{
    return "SELECT po.id, po.place_id, po.type, po.content, po.image_url, po.discount_text,
                   po.ticket_limit, po.expires_at, po.is_pinned, po.created_at,
                   p.name, p.address, p.owner_id,
                   c.id AS cat_id, c.name_en, c.name_my, c.group_name,
                   COALESCE(t.taken, 0) AS taken
            FROM posts po
            JOIN places p ON p.id = po.place_id
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN (SELECT post_id, COUNT(*) AS taken FROM tickets GROUP BY post_id) t ON t.post_id = po.id";
}

/** Public places are always live; a shop is live while its owner has a paid-up plan. */
function post_live_sql(string $placeAlias = 'p'): string
{
    return "$placeAlias.status = 'active'
            AND ($placeAlias.owner_id IS NULL OR EXISTS (
                SELECT 1 FROM owner_upgrades u
                WHERE u.user_id = $placeAlias.owner_id
                  AND u.status = 'approved'
                  AND u.expires_at IS NOT NULL
                  AND u.expires_at > NOW()
            ))";
}

/** Hide shops whose owner the logged-in user blocked (phase 2 rule). */
function post_blocked_sql(string $placeAlias, ?array $user, array &$params): string
{
    if ($user === null) {
        return '';
    }
    $params[] = $user['id'];
    return " AND ($placeAlias.owner_id IS NULL OR $placeAlias.owner_id NOT IN
              (SELECT blocked_id FROM blocks WHERE blocker_id = ?))";
}

/** A discount is over when it expired or all its tickets were taken. */
function post_shape(array $r): array
{
    $taken  = (int) $r['taken'];
    $limit  = $r['ticket_limit'] === null ? null : (int) $r['ticket_limit'];
    $isDeal = $r['type'] === 'discount';
    $ended  = $isDeal && (
        ($r['expires_at'] !== null && strtotime((string) $r['expires_at']) <= time())
        || ($limit !== null && $taken >= $limit)
    );

    return [
        'id'           => (int) $r['id'],
        'placeId'      => (int) $r['place_id'],
        'type'         => $r['type'],
        'content'      => $r['content'],
        'imageUrl'     => $r['image_url'],
        'discountText' => $r['discount_text'],
        'ticketLimit'  => $limit,
        'expiresAt'    => iso($r['expires_at']),
        'isPinned'     => (bool) $r['is_pinned'],
        'createdAt'    => iso($r['created_at']),
        'place'        => [
            'id'       => (int) $r['place_id'],
            'name'     => $r['name'],
            'address'  => $r['address'],
            'ownerId'  => $r['owner_id'] === null ? null : (int) $r['owner_id'],
            'category' => $r['cat_id'] === null ? null : [
                'id'     => (int) $r['cat_id'],
                'name'   => $r['name_en'],
                'nameMy' => $r['name_my'],
                'group'  => $r['group_name'],
            ],
        ],
        'ticketsTaken' => $isDeal ? $taken : null,
        'ticketsLeft'  => $isDeal && $limit !== null ? max(0, $limit - $taken) : null,
        'ended'        => $ended,
    ];
}

/** Ticket = { id, postId, code, status: active|used|expired, createdAt, expiresAt, usedAt }. */
function ticket_shape(array $r): array
{
    $created = (string) $r['created_at'];
    $expires = date('Y-m-d H:i:s', strtotime($created) + 2 * 3600);
    $status  = $r['used_at'] !== null ? 'used' : (time() > strtotime($expires) ? 'expired' : 'active');

    return [
        'id'        => (int) $r['id'],
        'postId'    => (int) $r['post_id'],
        'code'      => $r['ticket_code'],
        'status'    => $status,
        'createdAt' => iso($created),
        'expiresAt' => iso($expires),
        'usedAt'    => iso($r['used_at']),
    ];
}
