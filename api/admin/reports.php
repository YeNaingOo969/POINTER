<?php
require __DIR__ . '/../../include/bootstrap.php';

$method = require_method('GET', 'POST');
$admin = require_admin();
$pdo = db();

if ($method === 'GET') {
    $status     = trim((string) ($_GET['status'] ?? ''));
    $targetType = trim((string) ($_GET['targetType'] ?? ($_GET['target_type'] ?? '')));
    $kind       = trim((string) ($_GET['kind'] ?? ''));

    $sql = "SELECT r.*, u.name as reporter_name, u.email as reporter_email
            FROM reports r
            LEFT JOIN users u ON u.id = r.reporter_id
            WHERE 1=1";

    $params = [];

    if ($status !== '' && in_array(strtolower($status), ['open', 'resolved', 'dismissed'], true)) {
        $sql .= " AND r.status = ?";
        $params[] = strtolower($status);
    }

    if ($targetType !== '') {
        $sql .= " AND r.target_type = ?";
        $params[] = strtolower($targetType);
    }

    $sql .= " ORDER BY (r.status = 'open') DESC, r.created_at DESC";

    $st = $pdo->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll();

    $results = [];
    foreach ($rows as $r) {
        $targetId   = (int) $r['target_id'];
        $type       = $r['target_type'];
        $targetTitle = "#{$targetId}";
        $placeName   = '';

        if ($type === 'place') {
            $stP = $pdo->prepare("SELECT name FROM places WHERE id = ?");
            $stP->execute([$targetId]);
            $pName = $stP->fetchColumn();
            $targetTitle = $pName ?: "Place #{$targetId}";
            $placeName   = $targetTitle;
        } elseif ($type === 'review') {
            $stR = $pdo->prepare("SELECT r.comment, p.name as place_name
                                  FROM reviews r
                                  LEFT JOIN places p ON p.id = r.place_id
                                  WHERE r.id = ?");
            $stR->execute([$targetId]);
            $rev = $stR->fetch();
            if ($rev) {
                $targetTitle = $rev['comment'] ? mb_substr($rev['comment'], 0, 80) : "Review #{$targetId}";
                $placeName   = $rev['place_name'] ?: '';
            }
        } elseif ($type === 'post') {
            $stPost = $pdo->prepare("SELECT po.content, p.name as place_name
                                     FROM posts po
                                     LEFT JOIN places p ON p.id = po.place_id
                                     WHERE po.id = ?");
            $stPost->execute([$targetId]);
            $po = $stPost->fetch();
            if ($po) {
                $targetTitle = $po['content'] ? mb_substr($po['content'], 0, 80) : "Post #{$targetId}";
                $placeName   = $po['place_name'] ?: '';
            }
        }

        // Differentiate general report vs owner appeal
        $isAppeal = ($type === 'place' && str_contains(strtolower($r['reason']), 'appeal'));
        $itemKind = $isAppeal ? 'appeal' : 'report';

        if ($kind !== '' && $kind !== $itemKind) {
            continue;
        }

        $results[] = [
            'id'            => (int) $r['id'],
            'reporterId'    => (int) $r['reporter_id'],
            'reporterName'  => $r['reporter_name'] ?: 'Anonymous User',
            'reporterEmail' => $r['reporter_email'] ?: '',
            'targetType'    => $type,
            'target_type'   => $type,
            'targetId'      => $targetId,
            'target_id'     => $targetId,
            'targetTitle'   => $targetTitle,
            'placeName'     => $placeName,
            'reason'        => $r['reason'],
            'status'        => $r['status'],
            'kind'          => $itemKind,
            'createdAt'     => iso($r['created_at']),
        ];
    }

    json_out($results);
}

if ($method === 'POST') {
    $in     = body();
    $id     = (int) ($in['id'] ?? 0);
    $action = strtolower(trim((string) ($in['action'] ?? '')));
    $status = strtolower(trim((string) ($in['status'] ?? '')));
    $note   = trim((string) ($in['note'] ?? ''));

    if ($id <= 0) {
        fail(422, 'Report ID is required');
    }

    $st = $pdo->prepare("SELECT * FROM reports WHERE id = ?");
    $st->execute([$id]);
    $report = $st->fetch();
    if (!$report) {
        fail(404, 'Report not found');
    }

    $newStatus = ($action === 'dismiss' || $status === 'dismissed') ? 'dismissed' : 'resolved';

    $stUp = $pdo->prepare("UPDATE reports SET status = ? WHERE id = ?");
    $stUp->execute([$newStatus, $id]);

    $auditAction = ($newStatus === 'dismissed') ? 'dismiss_report' : 'resolve_report';
    log_audit($admin['id'], $auditAction, 'reports', $id);

    json_out([
        'id'         => $id,
        'status'     => $newStatus,
        'resolution' => [
            'action'     => $action,
            'status'     => $newStatus,
            'note'       => $note,
            'resolvedAt' => iso(date('Y-m-d H:i:s')),
        ],
        'message'    => "Report marked as {$newStatus}",
    ]);
}
