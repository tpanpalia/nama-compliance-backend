-- ============================================================
-- get_inspector_workload(p_from_date, p_to_date)
--
-- Returns inspector workload statistics used by:
--   - Admin: Reports page → "Inspector Workload" card
--   - Admin: User Management → inspector list stats
--
-- Called by: GET /api/reports/inspector-workload?from=&to=
-- ============================================================

CREATE OR REPLACE FUNCTION get_inspector_workload(
  p_from_date date,
  p_to_date   date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN

  RETURN jsonb_build_object(

    'inspectors', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY completed_in_period DESC), '[]'::jsonb)
      FROM (
        SELECT
          jsonb_build_object(
            'user_id',           u.id,
            'full_name',         sp.full_name,
            'employee_id',       sp.employee_id,
            'email',             u.email,
            'phone',             sp.phone,
            'status',            u.status,

            -- Work orders currently active (not period-filtered — snapshot of right now)
            'active_work_orders', COUNT(DISTINCT wo.work_order_id)
              FILTER (WHERE wo.status IN (
                'ASSIGNED','IN_PROGRESS',
                'PENDING_INSPECTION','INSPECTION_IN_PROGRESS'
              )),

            -- Inspections completed within the requested period
            'completed_in_period', COUNT(DISTINCT wo.work_order_id)
              FILTER (
                WHERE wo.status = 'INSPECTION_COMPLETED'
                  AND i.submitted_at::date BETWEEN p_from_date AND p_to_date
              ),

            -- Average final score of inspections completed in period
            'avg_score', ROUND(
              AVG(i.final_score)
                FILTER (WHERE i.submitted_at::date BETWEEN p_from_date AND p_to_date)
              ::numeric, 1),

            -- Average days from work order allocation to inspection submission
            'avg_days_to_complete', ROUND(
              AVG(
                EXTRACT(EPOCH FROM (
                  i.submitted_at - wo.allocation_date::timestamptz
                )) / 86400.0
              )
                FILTER (
                  WHERE i.status = 'SUBMITTED'
                    AND i.submitted_at::date BETWEEN p_from_date AND p_to_date
                )
              ::numeric, 1)

          ) AS row_data,

          -- For ordering the outer aggregate
          COUNT(DISTINCT wo.work_order_id)
            FILTER (
              WHERE wo.status = 'INSPECTION_COMPLETED'
                AND i.submitted_at::date BETWEEN p_from_date AND p_to_date
            ) AS completed_in_period

        FROM  users          u
        JOIN  staff_profiles sp ON sp.user_id           = u.id
        LEFT  JOIN work_orders wo ON wo.assigned_inspector_id = u.id
        LEFT  JOIN inspections  i  ON i.work_order_id        = wo.work_order_id
        WHERE u.role   = 'INSPECTOR'
          AND u.status = 'ACTIVE'
        GROUP BY u.id, sp.full_name, sp.employee_id, u.email, sp.phone, u.status

      ) sub
    )

  ); -- end RETURN
END;
$$;
