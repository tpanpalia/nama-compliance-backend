-- ============================================================
-- get_contractor_performance(p_cr_number, p_year, p_month)
--
-- Returns full contractor performance data used by:
--   - Admin: Contractor Detail page
--   - Admin: Reports page (per-contractor report / PDF)
--   - Regulator: Contractor Detail page
--   - Inspector: Contractor Detail screen (mobile)
--
-- p_month = 0  →  all months in the year
-- p_month = 1-12  →  specific month
--
-- Called by: GET /api/contractors/:cr/performance?year=&month=
-- ============================================================

CREATE OR REPLACE FUNCTION get_contractor_performance(
  p_cr_number text,
  p_year      int,
  p_month     int   -- 0 = all months
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_from_date date;
  v_to_date   date;
BEGIN

  IF p_month = 0 THEN
    v_from_date := make_date(p_year, 1, 1);
    v_to_date   := make_date(p_year, 12, 31);
  ELSE
    v_from_date := make_date(p_year, p_month, 1);
    v_to_date   := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
  END IF;

  RETURN jsonb_build_object(

    -- ── Contractor profile ────────────────────────────────────
    'profile', (
      SELECT jsonb_build_object(
        'cr_number',    cp.cr_number,
        'company_name', cp.company_name,
        'contact_name', cp.contact_name,
        'email',        cp.email,
        'phone',        cp.phone,
        'regions',      cp.regions_of_operation,
        'status',       u.status,
        'joined_at',    cp.created_at
      )
      FROM  contractor_profiles cp
      JOIN  users               u ON u.id = cp.user_id
      WHERE cp.cr_number = p_cr_number
    ),

    -- ── Summary stats ─────────────────────────────────────────
    'summary', (
      SELECT jsonb_build_object(
        'total_work_orders', COUNT(DISTINCT wo.work_order_id),
        'completed',         COUNT(DISTINCT wo.work_order_id)
          FILTER (WHERE wo.status = 'INSPECTION_COMPLETED'),
        'active',            COUNT(DISTINCT wo.work_order_id)
          FILTER (WHERE wo.status IN (
            'ASSIGNED','IN_PROGRESS','SUBMITTED',
            'PENDING_INSPECTION','INSPECTION_IN_PROGRESS'
          )),
        'avg_score',         ROUND(AVG(i.final_score)::numeric, 1),
        'compliance_distribution', jsonb_build_object(
          'excellent', COUNT(*) FILTER (WHERE i.compliance_rating = 'EXCELLENT'),
          'good',      COUNT(*) FILTER (WHERE i.compliance_rating = 'GOOD'),
          'fair',      COUNT(*) FILTER (WHERE i.compliance_rating = 'FAIR'),
          'poor',      COUNT(*) FILTER (WHERE i.compliance_rating = 'POOR')
        )
      )
      FROM  work_orders wo
      LEFT  JOIN inspections i ON i.work_order_id = wo.work_order_id
                               AND i.status = 'SUBMITTED'
      WHERE wo.contractor_cr     = p_cr_number
        AND wo.allocation_date   BETWEEN v_from_date AND v_to_date
    ),

    -- ── Average category scores ───────────────────────────────
    'category_scores', (
      SELECT jsonb_build_object(
        'hse',       ROUND(AVG(i.hse_score)::numeric,       1),
        'technical', ROUND(AVG(i.technical_score)::numeric, 1),
        'process',   ROUND(AVG(i.process_score)::numeric,   1),
        'closure',   ROUND(AVG(i.closure_score)::numeric,   1)
      )
      FROM  inspections   i
      JOIN  work_orders   wo ON wo.work_order_id = i.work_order_id
      WHERE wo.contractor_cr   = p_cr_number
        AND i.status           = 'SUBMITTED'
        AND i.final_score      IS NOT NULL
        AND wo.allocation_date BETWEEN v_from_date AND v_to_date
    ),

    -- ── Monthly trend (last 12 months, fixed rolling window) ──
    'monthly_trend', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY month_start), '[]'::jsonb)
      FROM (
        SELECT
          ms.month_start,
          jsonb_build_object(
            'month',       TO_CHAR(ms.month_start, 'YYYY-MM'),
            'month_label', TO_CHAR(ms.month_start, 'Mon YYYY'),
            'avg_score',   ROUND(AVG(i.final_score)::numeric, 1),
            'count',       COUNT(i.id)
          ) AS row_data
        FROM (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE - interval '11 months'),
            date_trunc('month', CURRENT_DATE),
            interval '1 month'
          )::date AS month_start
        ) ms
        LEFT JOIN work_orders wo
          ON  DATE_TRUNC('month', wo.allocation_date)::date = ms.month_start
          AND wo.contractor_cr = p_cr_number
        LEFT JOIN inspections i
          ON  i.work_order_id = wo.work_order_id
          AND i.status = 'SUBMITTED'
        GROUP BY ms.month_start
      ) sub
    ),

    -- ── Work order history (period-filtered) ──────────────────
    'work_orders', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY allocation_date DESC), '[]'::jsonb)
      FROM (
        SELECT
          jsonb_build_object(
            'work_order_id',    wo.work_order_id,
            'site_name',        wo.site_name,
            'governorate_code', wo.governorate_code,
            'governorate_name', g.name_en,
            'status',           wo.status,
            'priority',         wo.priority,
            'allocation_date',  wo.allocation_date,
            'submission_date',  wo.submission_date,
            'submitted_at',     i.submitted_at,
            'final_score',      i.final_score,
            'compliance_rating',i.compliance_rating
          ) AS row_data,
          wo.allocation_date
        FROM  work_orders wo
        JOIN  governorates    g  ON g.code           = wo.governorate_code
        LEFT  JOIN inspections i ON i.work_order_id  = wo.work_order_id
                                AND i.status = 'SUBMITTED'
        WHERE wo.contractor_cr   = p_cr_number
          AND wo.allocation_date BETWEEN v_from_date AND v_to_date
        ORDER BY wo.allocation_date DESC
      ) sub
    )

  ); -- end RETURN
END;
$$;
