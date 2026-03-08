SELECT s."name", i."order", i."text", i."weight"
FROM "ChecklistItem" i
JOIN "ChecklistSection" s ON s."id" = i."sectionId"
ORDER BY s."order", i."order";
