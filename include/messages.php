<?php
// Row -> JSON shapes shared by the messages/blocks endpoints.
declare(strict_types=1);

/** Message = { id, senderId, receiverId, body, status: request|accepted, isRead, createdAt }. */
function message_shape(array $r): array
{
    return [
        'id'         => (int) $r['id'],
        'senderId'   => (int) $r['sender_id'],
        'receiverId' => (int) $r['receiver_id'],
        'body'       => $r['body'],
        'status'     => $r['status'] === 'accepted' ? 'accepted' : 'request',
        'isRead'     => (bool) $r['is_read'],
        'createdAt'  => iso($r['created_at']),
    ];
}

/** The other side of a chat: a shop owner is shown by their shop name + placeId. */
function other_summary(array $r): array
{
    $placeId = $r['place_id'] === null ? null : (int) $r['place_id'];
    return [
        'id'      => (int) $r['id'],
        'name'    => $placeId === null ? $r['name'] : $r['place_name'],
        'placeId' => $placeId,
    ];
}

/** Users by id, with the name/id of their first place (if they own one). */
function users_with_places(array $ids): array
{
    if (!$ids) {
        return [];
    }
    $in = implode(',', array_fill(0, count($ids), '?'));
    $st = db()->prepare(
        "SELECT u.id, u.name,
                (SELECT p.id FROM places p WHERE p.owner_id = u.id
                 ORDER BY (p.status = 'active') DESC, p.id ASC LIMIT 1) AS place_id,
                (SELECT p.name FROM places p WHERE p.owner_id = u.id
                 ORDER BY (p.status = 'active') DESC, p.id ASC LIMIT 1) AS place_name
         FROM users u WHERE u.id IN ($in)"
    );
    $st->execute($ids);

    $out = [];
    foreach ($st->fetchAll() as $row) {
        $out[(int) $row['id']] = $row;
    }
    return $out;
}

/** True when either side blocked the other. */
function blocked_between(int $a, int $b): bool
{
    $st = db()->prepare(
        'SELECT 1 FROM blocks
         WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
         LIMIT 1'
    );
    $st->execute([$a, $b, $b, $a]);
    return (bool) $st->fetchColumn();
}
