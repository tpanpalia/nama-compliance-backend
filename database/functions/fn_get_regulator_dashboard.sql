-- ============================================================
-- get_regulator_dashboard(p_from_date, p_to_date)
--
-- Returns all data needed for the Regulator portal dashboard
-- in a single DB roundtrip. Read-only view of the system.
--
-- Previous period = same duration immediately before p_from_date
-- (used for trend indicators).
--
-- Called by: GET /api/regulator/dashboard?from=&to=
-- ============================================================

CREATE OR REPLACE FUNCTION get_regulator_dashboard(
  p_from_date date,
  p_to_date   date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_period_days int;
  v_prev_from   date;
  v_prev_to     date;
BEGIN

  v_period_days := p_to_date - p_from_date;
  v_prev_from   := p_from_date - v_period_days - 1;
  v_prev_to     := p_from_date - 1;

  RETURN jsonb_build_object(

    -- ── KPIs (4 cards) ───────────────────────────────────────
    'kpis', jsonb_build_object(

      'total_contractors', jsonb_build_object(
        'value',    (SELECT COUNT(*) FROM users WHERE role = 'CONTRACTOR'),
        'active',   (SELECT COUNT(*) FROM users WHERE role = 'CONTRACTOR' AND status = 'ACTIVE'),
        'pending',  (SELECT COUNT(*) FROM users WHERE role = 'CONTRACTOR' AND status = 'PENDING'),
        'suspended',(SELECT COUNT(*) FROM users WHERE role = 'CONTRACTOR' AND status = 'SUSPENDED'),
        'inactive', (SELECT COUNT(*) FROM users WHERE role = 'CONTRACTOR' AND status = 'INACTIVE')
      ),

      'total_inspections', (
        WITH curr AS (
          SELECT COUNT(*) AS n
          FROM   inspections i
          JOIN   work_orders wo ON wo.work_order_id = i.work_order_id
          WHERE  i.status = 'SUBMITTED'
            AND  wo.allocation_date BETWEEN p_from_date AND p_to_date
        ),
        prev AS (
          SELECT COUNT(*) AS n
          FROM   inspections i
          JOIN   work_orders wo ON wo.work_order_id = i.work_order_id
          WHERE  i.status = 'SUBMITTED'
            AND  wo.allocation_date BETWEEN v_prev_from AND v_prev_to
        )
        SELECT jsonb_build_object(
          'value',     curr.n,
          'trend_pct', ROUND(((curr.n - prev.n)::numeric / NULLIF(prev.n, 0)) * 100, 1)
        )
        FROM curr, prev
      ),

      'avg_compliance', (
        WITH curr AS (
          SELECT ROUND(AVG(i.final_score)::numeric, 1) AS v
          FROM   inspections i
          JOIN   work_orders wo ON wo.work_order_id = i.work_order_id
          WHERE  i.status = 'SUBMITTED'
            AND  i.final_score IS NOT NULL
            AND  wo.allocation_date BETWEEN p_from_date AND p_to_date
        ),
        prev AS (
          SELECT ROUND(AVG(i.final_score)::numeric, 1) AS v
          FROM   inspections i
          JOIN   work_orders wo ON wo.work_order_id = i.work_order_id
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

      'non_compliant_items', (
        SELECT jsonb_build_object(
          'count', COUNT(*) FILTER (WHERE ir.rating = 'NON_COMPLIANT'),
          'total', COUNT(*),
          'pct',   ROUND(
            (COUNT(*) FILTER (WHERE ir.rating = 'NON_COMPLIANT'))::numeric
            / NULLIF(COUNT(*), 0) * 100, 1)
        )
        FROM  inspection_responses ir
        JOIN  inspections   i  ON i.id              = ir.inspection_id
        JOIN  work_orders   wo ON wo.work_order_id  = i.work_order_id
        WHERE i.status = 'SUBMITTED'
          AND wo.allocation_date BETWEEN p_from_date AND p_to_date
      )
    ),

    -- ── Compliance trend (last 12 months, fixed rolling window) ──
    'compliance_trend', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY month_start), '[]'::jsonb)
      FROM (
        SELECT
          ms.month_start,
          jsonb_build_object(
            'month',       TO_CHAR(ms.month_start, 'YYYY-MM'),
            'month_label', TO_CHAR(ms.month_start, 'Mon YYYY'),
            'overall',     ROUND(AVG(i.final_score)::numeric,       1),
            'hse',         ROUND(AVG(i.hse_score)::numeric,         1),
            'technical',   ROUND(AVG(i.technical_score)::numeric,   1),
            'process',     ROUND(AVG(i.process_score)::numeric,     1),
            'closure',     ROUND(AVG(i.closure_score)::numeric,     1)
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
        LEFT JOIN inspections i
          ON  i.work_order_id = wo.work_order_id
          AND i.status = 'SUBMITTED'
        GROUP BY ms.month_start
      ) sub
    ),

    -- ── Compliance distribution — one score per contractor ────
    -- Uses the contractor's latest inspection score in the period.
    'compliance_distribution', (
      SELECT jsonb_build_object(
        'excellent', COUNT(*) FILTER (WHERE final_score >= 90),
        'good',      COUNT(*) FILTER (WHERE final_score >= 80 AND final_score < 90),
        'fair',      COUNT(*) FILTER (WHERE final_score >= 70 AND final_score < 80),
        'poor',      COUNT(*) FILTER (WHERE final_score < 70)
      )
      FROM (
        SELECT DISTINCT ON (wo.contractor_cr)
          i.final_score
        FROM  inspections   i
        JOIN  work_orders   wo ON wo.work_order_id = i.work_order_id
        WHERE i.status = 'SUBMITTED'
          AND i.final_score IS NOT NULL
          AND wo.allocation_date BETWEEN p_from_date AND p_to_date
        ORDER BY wo.contractor_cr, i.submitted_at DESC
      ) latest
    ),

    -- ── Regional performance (all governorates) ───────────────
    'regional_performance', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY avg_score DESC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT
          jsonb_build_object(
            'governorate_code',   g.code,
            'governorate_name',   g.name_en,
            'active_contractors', COUNT(DISTINCT wo.contractor_cr),
            'total_inspections',  COUNT(i.id),
            'avg_score',          ROUND(AVG(i.final_score)::numeric, 1),
            'latest_inspection',  MAX(i.submitted_at)
          ) AS row_data,
          AVG(i.final_score) AS avg_score
        FROM  governorates   g
        LEFT  JOIN work_orders   wo ON wo.governorate_code = g.code
                AND wo.allocation_date BETWEEN p_from_date AND p_to_date
        LEFT  JOIN inspections   i  ON i.work_order_id     = wo.work_order_id
                AND i.status = 'SUBMITTED'
        GROUP BY g.code, g.name_en
      ) sub
    ),

    -- ── Category performance (period-filtered) ────────────────
    'category_performance', (
      SELECT jsonb_build_object(
        'hse',       ROUND(AVG(i.hse_score)::numeric,       1),
        'technical', ROUND(AVG(i.technical_score)::numeric, 1),
        'process',   ROUND(AVG(i.process_score)::numeric,   1),
        'closure',   ROUND(AVG(i.closure_score)::numeric,   1)
      )
      FROM  inspections i
      JOIN  work_orders wo ON wo.work_order_id = i.work_order_id
      WHERE i.status = 'SUBMITTED'
        AND wo.allocation_date BETWEEN p_from_date AND p_to_date
    ),

    -- ── Top 5 and Bottom 5 performers ────────────────────────
    'top_performers', (
      SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'cr_number',    cp.cr_number,
          'company_name', cp.company_name,
          'avg_score',    ROUND(AVG(i.final_score)::numeric, 1),
          'projects',     COUNT(DISTINCT wo.work_order_id)
        ) AS row_data
        FROM  contractor_profiles cp
        JOIN  work_orders         wo ON wo.contractor_cr   = cp.cr_number
        JOIN  inspections         i  ON i.work_order_id    = wo.work_order_id
        WHERE i.status = 'SUBMITTED'
          AND i.final_score IS NOT NULL
          AND wo.allocation_date BETWEEN p_from_date AND p_to_date
        GROUP BY cp.cr_number, cp.company_name
        ORDER BY AVG(i.final_score) DESC NULLS LAST
        LIMIT 5
      ) sub
    ),

    'bottom_performers', (
      SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'cr_number',    cp.cr_number,
          'company_name', cp.company_name,
          'avg_score',    ROUND(AVG(i.final_score)::numeric, 1),
          'projects',     COUNT(DISTINCT wo.work_order_id)
        ) AS row_data
        FROM  contractor_profiles cp
        JOIN  work_orders         wo ON wo.contractor_cr   = cp.cr_number
        JOIN  inspections         i  ON i.work_order_id    = wo.work_order_id
        WHERE i.status = 'SUBMITTED'
          AND i.final_score IS NOT NULL
          AND wo.allocation_date BETWEEN p_from_date AND p_to_date
        GROUP BY cp.cr_number, cp.company_name
        ORDER BY AVG(i.final_score) ASC NULLS LAST
        LIMIT 5
      ) sub
    ),

    -- ── Recent activity feed (last 20 events from audit_logs) ─
    'recent_activity', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          jsonb_build_object(
            'action',      al.action,
            'entity_type', al.entity_type,
            'entity_id',   al.entity_id,
            'metadata',    al.metadata,
            'created_at',  al.created_at
          ) AS row_data,
          al.created_at
        FROM audit_logs al
        WHERE al.entity_type IN ('WORK_ORDER', 'CONTRACTOR', 'INSPECTION')
          AND al.action IN (
            'REGISTERED', 'INSPECTION_COMPLETED',
            'SUSPENDED',  'ACTIVATED', 'SCORE_FLAGGED'
          )
        ORDER BY al.created_at DESC
        LIMIT 20
      ) sub
    )

  ); -- end RETURN
END;
$$;
