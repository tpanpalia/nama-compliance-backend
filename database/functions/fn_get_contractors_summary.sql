-- ============================================================
-- get_contractors_summary()
--
-- Returns a lightweight summary for ALL active contractors:
--   cr_number, avg_score, active, completed, total_work_orders
--
-- Used by: Regulator Contractors list page (card grid)
-- Instead of N individual get_contractor_performance() calls
--
-- Called by: GET /api/regulator/contractors/summary
-- ============================================================

CREATE OR REPLACE FUNCTION get_contractors_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'cr_number',        cp.cr_number,
        'total_work_orders', COALESCE(wo_stats.total, 0),
        'completed',         COALESCE(wo_stats.completed, 0),
        'active',            COALESCE(wo_stats.active, 0),
        'avg_score',         wo_stats.avg_score
      ) AS row_data
      FROM contractor_profiles cp
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT wo.work_order_id) AS total,
          COUNT(DISTINCT wo.work_order_id)
            FILTER (WHERE wo.status = 'INSPECTION_COMPLETED') AS completed,
          COUNT(DISTINCT wo.work_order_id)
            FILTER (WHERE wo.status IN (
              'ASSIGNED','IN_PROGRESS','SUBMITTED',
              'PENDING_INSPECTION','INSPECTION_IN_PROGRESS'
            )) AS active,
          ROUND(AVG(i.final_score)::numeric, 1) AS avg_score
        FROM work_orders wo
        LEFT JOIN inspections i
          ON i.work_order_id = wo.work_order_id
          AND i.status = 'SUBMITTED'
        WHERE wo.contractor_cr = cp.cr_number
      ) wo_stats ON true
      WHERE u.status != 'INACTIVE'
      ORDER BY cp.company_name ASC
    ) sub
  );
END;
$$;
