UPDATE "WorkOrder"
SET status = 'REJECTED'
WHERE status = 'REOPENED';
