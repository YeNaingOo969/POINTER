<?php
// The "Add your business" request of one user, in the BusinessRequest shape (task doc §5).
// Schema notes (database/pointer.sql):
//   - owner_upgrades has user_id (there is no place_id); one request per user, so the row is
//     found by the owner, not by the place.
//   - the payment screenshot column is payment_proof.
//   - places.address is NOT NULL, but the request form has no address field yet: it is saved
//     empty and the admin fills it in when approving the shop.
declare(strict_types=1);

function business_request_for_user(int $userId): ?array
{
    $st = db()->prepare(
        'SELECT p.id, p.status, p.name, p.category_id, p.description, p.phone, p.open_hours,
                p.lat, p.lng, p.storefront_photo, p.created_at,
                o.months, o.amount, o.payment_method, o.status AS payment_status
         FROM places p
         LEFT JOIN owner_upgrades o ON o.user_id = p.owner_id
         WHERE p.owner_id = ?
         ORDER BY p.id DESC, o.id DESC
         LIMIT 1'
    );
    $st->execute([$userId]);
    $r = $st->fetch();
    if (!$r) {
        return null;
    }

    $hours = json_decode((string) $r['open_hours'], true);

    return [
        'id'           => (int) $r['id'],
        'status'       => $r['status'],                       // pending / active / rejected / hidden
        'name'         => $r['name'],
        'categoryId'   => (int) $r['category_id'],
        'description'  => $r['description'],
        'phone'        => $r['phone'],
        'openingHours' => is_array($hours) ? array_values($hours) : [],
        'lat'          => (float) $r['lat'],
        'lng'          => (float) $r['lng'],
        'photoUrl'     => $r['storefront_photo'],
        'payment'      => $r['months'] === null ? null : [
            'months' => (int) $r['months'],
            'amount' => (float) $r['amount'],
            'method' => $r['payment_method'],
            'status' => $r['payment_status'],                // pending / approved / rejected
        ],
        'createdAt'    => iso($r['created_at']),
    ];
}
