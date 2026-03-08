SELECT status, COUNT(*) AS count
FROM "WorkOrder"
GROUP BY status
ORDER BY status;
