SELECT s."name", s."weight", COUNT(i."id")
FROM "ChecklistSection" s
LEFT JOIN "ChecklistItem" i ON i."sectionId" = s."id"
GROUP BY s."id", s."name", s."weight", s."order"
ORDER BY s."order";
