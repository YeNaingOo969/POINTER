<?php
// POST /api/owner/reviews/reply.php?id=12 { reply }
// Issue #6 route name for the merchant reply. Same logic as PUT /api/owner/review-reply.php
// (the frontend keeps using that one). Stored in reviews.owner_reply.
require __DIR__ . '/../review-reply.php';
