-- ============================================================
-- get_admin_dashboard(p_year, p_month)
--
-- Returns all data needed for the Admin (Performance Team)
-- dashboard in a single DB roundtrip.
--
-- p_month = 0  →  all months in the year
-- p_month = 1-12  →  specific month
--
-- Called by: GET /api/dashboard?year=&month=
-- ============================================================

CREATE OR REPLACE FUNCTION get_admin_dashboard(
  p_year  int,
  p_month int   -- 0 = all months
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$

DECLARE
  v_from_date  date;
  v_to_date    date;
  v_prev_from  date;
  v_prev_to    date;
  v_trend_from date;
  v_trend_to   date;
BEGIN

  -- ── Date range for current period ────────────────────────
  IF p_month = 0 THEN
    v_from_date := make_date(p_year, 1, 1);
    v_to_date   := make_date(p_year, 12, 31);
    v_prev_from := make_date(p_year - 1, 1, 1);
    v_prev_to   := make_date(p_year - 1, 12, 31);
  ELSE
    v_from_date := make_date(p_year, p_month, 1);
    v_to_date   := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
    v_prev_from := (v_from_date - interval '1 month')::date;
    v_prev_to   := v_from_date - 1;
  END IF;

  IF p_month = 0 THEN
    v_trend_from := make_date(p_year, 1, 1);
    v_trend_to   := make_date(p_year, 12, 1);
  ELSE
    v_trend_to   := make_date(p_year, p_month, 1);
    v_trend_from := (v_trend_to - interval '5 months')::date;
  END IF;

  RETURN jsonb_build_object(

    -- ── KPIs (4 cards) ───────────────────────────────────────
    'kpis', jsonb_build_object(

      'total_inspections', (
        WITH curr AS (
          SELECT COUNT(*) AS n
          FROM   inspections   i
          JOIN   work_orders   wo ON wo.work_order_id = i.work_order_id
          WHERE  i.status = 'SUBMITTED'
            AND  wo.allocation_date BETWEEN v_from_date AND v_to_date
        ),
        prev AS (
          SELECT COUNT(*) AS n
          FROM   inspections   i
          JOIN   work_orders   wo ON wo.work_order_id = i.work_order_id
          WHERE  i.status = 'SUBMITTED'
            AND  wo.allocation_date BETWEEN v_prev_from AND v_prev_to
        )
        SELECT jsonb_build_object(
          'value',     curr.n,
          'trend_pct', ROUND(((curr.n - prev.n)::numeric / NULLIF(prev.n, 0)) * 100, 1)
        )
        FROM curr, prev
      ),

      'active_contractors', (
        WITH curr AS (
          SELECT COUNT(*) AS n
          FROM   users
          WHERE  role = 'CONTRACTOR' AND status = 'ACTIVE'
        ),
        prev AS (
          -- count contractors who were active at the end of the previous period
          SELECT COUNT(*) AS n
          FROM   users
          WHERE  role = 'CONTRACTOR' AND status = 'ACTIVE'
            AND  created_at <= v_prev_to::timestamptz + interval '23:59:59'
        )
        SELECT jsonb_build_object(
          'value',       curr.n,
          'trend_count', (curr.n - prev.n)
        )
        FROM curr, prev
      ),

      'avg_performance', (
        WITH curr AS (
          SELECT ROUND(AVG(i.final_score)::numeric, 1) AS v
          FROM   inspections   i
          JOIN   work_orders   wo ON wo.work_order_id = i.work_order_id
          WHERE  i.status = 'SUBMITTED'
            AND  i.final_score IS NOT NULL
            AND  wo.allocation_date BETWEEN v_from_date AND v_to_date
        ),
        prev AS (
          SELECT ROUND(AVG(i.final_score)::numeric, 1) AS v
          FROM   inspections   i
          JOIN   work_orders   wo ON wo.work_order_id = i.work_order_id
          WHERE  i.status = 'SUBMITTED'
            AND  i.final_score IS NOT NULL
            AND  wo.allocation_date BETWEEN v_prev_from AND v_prev_to
        )
        SELECT jsonb_build_object(
          'value',     curr.v,
          'trend_pts', ROUND(COALESCE(curr.v, 0) - COALESCE(prev.v, 0), 1)
        )
        FROM curr, prev
      ),

      'pending_reviews', jsonb_build_object(
        'value', (
          SELECT COUNT(*) FROM work_orders WHERE status = 'SUBMITTED'
        )
      )
    ),

    -- ── Monthly inspection trend (last 6 months, fixed window) ──
    -- Not filtered by year/month — always shows the rolling 6-month window.
    'monthly_trend', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY month_start), '[]'::jsonb)
      FROM (
        SELECT
          ms.month_start,
          jsonb_build_object(
            'month',            TO_CHAR(ms.month_start, 'YYYY-MM'),
            'month_label',      TO_CHAR(ms.month_start, 'Mon YYYY'),
            'inspection_count', COUNT(i.id),
            'avg_compliance',   ROUND(AVG(i.final_score)::numeric, 1)
          ) AS row_data
        FROM (
          SELECT generate_series(
            v_trend_from,
            v_trend_to,
            interval '1 month'
          )::date AS month_start
        ) ms
        LEFT JOIN work_orders wo
          ON  DATE_TRUNC('month', wo.allocation_date)::date = ms.month_start
        LEFT JOIN inspections i
          ON  i.work_order_id = wo.work_order_id
          AND i.status = 'SUBMITTED'
        GROUP BY ms.month_start
      ) sub
    ),

    -- ── Compliance by category (period-filtered) ─────────────
    'compliance_by_category', (
      SELECT jsonb_build_object(
        'hse',       ROUND(AVG(i.hse_score)::numeric,       1),
        'technical', ROUND(AVG(i.technical_score)::numeric, 1),
        'process',   ROUND(AVG(i.process_score)::numeric,   1),
        'closure',   ROUND(AVG(i.closure_score)::numeric,   1)
      )
      FROM  inspections i
      JOIN  work_orders wo ON wo.work_order_id = i.work_order_id
      WHERE i.status = 'SUBMITTED'
        AND wo.allocation_date BETWEEN v_from_date AND v_to_date
    ),

    -- ── Recent 10 inspections (global, not period-filtered) ──
    'recent_inspections', (
      SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'work_order_id',     wo.work_order_id,
          'site_name',         wo.site_name,
          'contractor_name',   cp.company_name,
          'contractor_cr',     cp.cr_number,
          'submitted_at',      i.submitted_at,
          'work_order_status', wo.status,
          'final_score',       i.final_score,
          'compliance_rating', i.compliance_rating
        ) AS row_data
        FROM  inspections         i
        JOIN  work_orders         wo ON wo.work_order_id = i.work_order_id
        JOIN  contractor_profiles cp ON cp.cr_number     = wo.contractor_cr
        WHERE i.status = 'SUBMITTED'
          AND wo.allocation_date BETWEEN v_from_date AND v_to_date
        ORDER BY i.submitted_at DESC
        LIMIT 10
      ) sub
    ),

    -- ── Top 5 contractors by avg score (period-filtered) ─────
    'top_contractors', (
      SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'cr_number',          cp.cr_number,
          'company_name',       cp.company_name,
          'avg_score',          ROUND(AVG(i.final_score)::numeric, 1),
          'total_projects',     COUNT(DISTINCT wo.work_order_id),
          'completed_projects', COUNT(DISTINCT wo.work_order_id)
            FILTER (WHERE wo.status = 'INSPECTION_COMPLETED')
        ) AS row_data
        FROM  contractor_profiles cp
        JOIN  work_orders         wo ON wo.contractor_cr    = cp.cr_number
        JOIN  inspections         i  ON i.work_order_id     = wo.work_order_id
        WHERE i.status = 'SUBMITTED'
          AND i.final_score IS NOT NULL
          AND wo.allocation_date BETWEEN v_from_date AND v_to_date
        GROUP BY cp.cr_number, cp.company_name
        ORDER BY AVG(i.final_score) DESC NULLS LAST
        LIMIT 5
      ) sub
    )

  ); -- end RETURN
END;
