DELETE FROM "AuditLog" WHERE "workOrderId" IN (SELECT id FROM "WorkOrder" WHERE status = 'REJECTED');
DELETE FROM "Evidence" WHERE "workOrderId" IN (SELECT id FROM "WorkOrder" WHERE status = 'REJECTED');
DELETE FROM "ContractorItemComment" WHERE "workOrderId" IN (SELECT id FROM "WorkOrder" WHERE status = 'REJECTED');
DELETE FROM "ChecklistResponse" WHERE "checklistId" IN (SELECT woc.id FROM "WorkOrderChecklist" woc JOIN "WorkOrder" wo ON wo.id = woc."workOrderId" WHERE wo.status = 'REJECTED');
DELETE FROM "WorkOrderChecklist" WHERE "workOrderId" IN (SELECT id FROM "WorkOrder" WHERE status = 'REJECTED');
DELETE FROM "WorkOrder" WHERE status = 'REJECTED';
