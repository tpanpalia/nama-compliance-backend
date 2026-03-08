UPDATE "Evidence"
SET "checklistItemId" = NULL
WHERE "checklistItemId" IS NOT NULL;

DELETE FROM "ChecklistResponse";
DELETE FROM "WorkOrderChecklist";
DELETE FROM "ChecklistItem";
DELETE FROM "ChecklistSection";
DELETE FROM "ChecklistTemplate";

WITH template AS (
  INSERT INTO "ChecklistTemplate" (
    "id", "name", "description", "isActive", "version", "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid()::text,
    'Nama Standard Inspection Checklist',
    'Official Nama Water Services compliance checklist',
    TRUE,
    1,
    NOW(),
    NOW()
  )
  RETURNING "id"
),
sections AS (
  INSERT INTO "ChecklistSection" (
    "id", "name", "description", "weight", "order", "templateId"
  )
  SELECT
    gen_random_uuid()::text,
    s.name,
    s.description,
    s.weight,
    s.sort_order,
    template.id
  FROM template
  CROSS JOIN (
    VALUES
      ('HSE & Safety', 'Health, Safety and Environment checks', 0.30::double precision, 1),
      ('Technical Installation', 'Technical installation quality checks', 0.40::double precision, 2),
      ('Process & Communication', 'Process compliance and communication', 0.20::double precision, 3),
      ('Site Closure', 'Site closure and reinstatement', 0.10::double precision, 4)
  ) AS s(name, description, weight, sort_order)
  RETURNING "id", "name"
)
INSERT INTO "ChecklistItem" (
  "id", "text", "isRequired", "weight", "order", "sectionId"
)
SELECT
  gen_random_uuid()::text,
  i.text,
  TRUE,
  i.weight,
  i.sort_order,
  s."id"
FROM sections s
JOIN (
  VALUES
    ('HSE & Safety', 1, 'Contractor workers'' compliance with wearing PPE', 10),
    ('HSE & Safety', 2, 'Condition of equipment used by the contractor', 10),
    ('HSE & Safety', 3, 'Overall compliance with Nama HSE standards', 10),
    ('Technical Installation', 1, 'Compliance of excavation works with specified pipe diameter', 8),
    ('Technical Installation', 2, 'Installation of warning tape above pipeline', 7),
    ('Technical Installation', 3, 'Sand bedding installation', 8),
    ('Technical Installation', 4, 'Ground leveling, soil compaction, removal of rocks', 7),
    ('Technical Installation', 5, 'Flushing pipeline after installation and before meter', 9),
    ('Technical Installation', 6, 'Installation of marker posts', 5),
    ('Technical Installation', 7, 'Installation of identification tag', 4),
    ('Process & Communication', 1, 'Notification to Nama before/during/after works', 8),
    ('Process & Communication', 2, 'Monthly technical report submission', 7),
    ('Process & Communication', 3, 'Worker list submission', 5),
    ('Site Closure', 1, 'Site cleaning and reinstatement', 3)
) AS i(section_name, sort_order, text, weight)
  ON i.section_name = s."name";
