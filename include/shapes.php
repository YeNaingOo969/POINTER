<?php
// Row -> JSON shapes shared by the task-2 endpoints (saves, reviews).
// Column names follow database/pointer.sql: the review text is reviews.comment.
declare(strict_types=1);

/** PlaceSummary = { id, name, address, category } — task doc §4. */
function place_summary(array $r): array
{
    return [
        'id'       => (int) $r['id'],
        'name'     => $r['name'],
        'address'  => $r['address'],
        'category' => $r['cat_id'] === null ? null : [
            'id'     => (int) $r['cat_id'],
            'name'   => $r['name_en'],
            'nameMy' => $r['name_my'],
            'group'  => $r['group_name'],
        ],
    ];
}

/** Review = { id, placeId, user, rating, text, createdAt, updatedAt, ownerReply }. */
function review_shape(array $r): array
{
    return [
        'id'         => (int) $r['id'],
        'placeId'    => (int) $r['place_id'],
        'user'       => ['id' => (int) $r['user_id'], 'name' => $r['user_name']],
        'rating'     => (int) $r['rating'],
        'text'       => $r['text'],
        'createdAt'  => iso($r['created_at']),
        'updatedAt'  => iso($r['updated_at']),
        'ownerReply' => $r['owner_reply'],
    ];
}
