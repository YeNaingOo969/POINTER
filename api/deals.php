<?php
require __DIR__ . '/../include/bootstrap.php';
require __DIR__ . '/../include/posts.php';

require_method('GET');

// Every active discount post (flowchart 2b), sorted by "ending soon" (default) or "newest"
// and filtered by category group. Visitors can read this; blocked owners are left out.
$user   = current_user();
$params = [];

$sort  = ($_GET['sort'] ?? 'ending') === 'newest' ? 'newest' : 'ending';
$group = isset($_GET['group']) && is_string($_GET['group']) ? trim($_GET['group']) : '';

$sql = post_select() . ' WHERE ' . post_live_sql() . "
        AND po.type = 'discount'
        AND (po.expires_at IS NULL OR po.expires_at > NOW())
        AND (po.ticket_limit IS NULL OR COALESCE(t.taken, 0) < po.ticket_limit)";
$sql .= post_blocked_sql('p', $user, $params);

if ($group !== '') {
    $sql .= ' AND c.group_name = ?';
    $params[] = $group;
}

$sql .= $sort === 'newest'
    ? ' ORDER BY po.created_at DESC, po.id DESC'
    : ' ORDER BY (po.expires_at IS NULL) ASC, po.expires_at ASC, po.id ASC';

$st = db()->prepare($sql);
$st->execute($params);

json_out(array_map('post_shape', $st->fetchAll()));
