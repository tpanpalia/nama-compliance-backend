# NWS Compliance System — API Reference

> **Base URL:** `/api`
> **Auth:** All endpoints (except `POST /auth/login`, `POST /auth/register`, `GET /health`) require `Authorization: Bearer <access_token>`
> **Dates:** All dates in requests use `YYYY-MM-DD`. All timestamps in responses are ISO 8601 UTC.
> **Pagination:** All list endpoints accept `?page=1&limit=20` and return `{ items, total }`.

---

## Table of Contents
1. [Auth & Shared](#1-auth--shared)
2. [Admin Portal — Web App](#2-admin-portal--web-app)
3. [Regulator Portal — Web App](#3-regulator-portal--web-app)
4. [Inspector App — Mobile](#4-inspector-app--mobile)
5. [Contractor App — Mobile](#5-contractor-app--mobile)
6. [File Upload Flow](#6-file-upload-flow)
7. [PostgreSQL Functions (Dashboard Queries)](#7-postgresql-functions-dashboard-queries)
8. [Pending / Not Yet Implemented](#8-pending--not-yet-implemented)

---

## 1. Auth & Shared

### Screen: Login (All Roles)

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 1 | POST | `/auth/login` | Authenticate user, get tokens | `email`, `password` | users, contractor_profiles, staff_profiles, regulator_profiles | users (lastLogin) |
| 2 | POST | `/auth/refresh` | Exchange refresh token for new access token | `refreshToken` | users | — |
| 3 | GET | `/auth/me` | Get current logged-in user + profile | — | users, contractor_profiles, staff_profiles, regulator_profiles | — |

**Login response:**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "uuid",
    "email": "...",
    "role": "ADMIN | INSPECTOR | REGULATOR | CONTRACTOR",
    "status": "ACTIVE",
    "profile": { ...role-specific fields }
  }
}
```

---

### Screen: Registration (Contractor / Regulator)

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 4 | POST | `/auth/register` | Submit access request | `applicantName`, `email`, `phone?`, `roleRequested` (CONTRACTOR/REGULATOR), `contractorCr?` *(required for CONTRACTOR)*, `organization?` *(required for REGULATOR)*, `department?`, `documentFileId?`, `documentName?` | access_requests (dup check) | access_requests |

**Notes:**
- Contractor CR number is a plain text input — no FK validation at registration time.
- `documentFileId` must reference an already-uploaded file (`/api/files/presign` → confirm flow).
- Returns `{ requestId, message }`.

---

### Screen: Change Password (All Roles)

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 5 | PATCH | `/auth/me/password` | Change own password | `currentPassword`, `newPassword` (min 8 chars) | users | users (passwordHash) |

---

### Notifications (All Roles)

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 6 | GET | `/notifications` | List notifications with unread count | `unread=true`, `page`, `limit` | notifications | — |
| 7 | PATCH | `/notifications/read-all` | Mark all as read | — | notifications | notifications |
| 8 | PATCH | `/notifications/:id/read` | Mark single as read | — | notifications | notifications |

**Response (GET):**
```json
{ "items": [...], "total": 50, "unreadCount": 3 }
```

---

## 2. Admin Portal — Web App

> All `/api/admin/*` routes require role `ADMIN`.

---

### Screen: Dashboard

| # | Method | Endpoint | Purpose | Query Params | DB Function | Tables Aggregated |
|---|--------|----------|---------|--------------|-------------|-------------------|
| 9 | GET | `/admin/dashboard` | Full dashboard data in one call | `year` (default: current year), `month` (0 = full year, 1-12 = specific month) | `get_admin_dashboard(year, month)` | inspections, work_orders, users, contractor_profiles |

**Response structure:**
```json
{
  "kpis": {
    "total_inspections":  { "value": 120, "trend_pct": 12.5 },
    "active_contractors": { "value": 45,  "trend_count": 3 },
    "avg_performance":    { "value": 84.2, "trend_pts": 2.1 },
    "pending_reviews":    { "value": 7 }
  },
  "monthly_trend":          [ { "month": "2025-01", "inspection_count": 18, "avg_compliance": 83.1 }, ... ],
  "compliance_by_category": { "hse": 87.0, "technical": 82.5, "process": 80.0, "closure": 91.0 },
  "recent_inspections":     [ { "work_order_id": "WO-...", "contractor_name": "...", "final_score": 88.0, ... } ],
  "top_contractors":        [ { "cr_number": "...", "company_name": "...", "avg_score": 92.0, "total_projects": 8 } ]
}
```

---

### Screen: Work Orders — List

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 10 | GET | `/admin/work-orders` | Paginated list with filters | `status`, `contractorCr`, `inspectorId`, `governorateCode`, `page`, `limit` | work_orders, contractor_profiles, users, staff_profiles, governorates, inspections | — |

**Response item:**
```json
{
  "id": "WO-20250101-0001",
  "siteName": "Al Khoud Phase 2",
  "status": "SUBMITTED",
  "priority": "HIGH",
  "allocationDate": "2025-01-10",
  "contractor": { "companyName": "Al Noor Contracting" },
  "assignedInspector": { "staffProfile": { "fullName": "Ahmed Al-Rashdi" } },
  "governorate": { "code": "MS", "nameEn": "Muscat" },
  "inspection": { "finalScore": null, "complianceRating": null, "status": "PENDING" }
}
```

---

### Screen: Work Orders — Create

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 11 | POST | `/admin/work-orders` | Create new work order | `contractorCr`, `governorateCode`, `siteName`, `description?`, `priority` (LOW/MEDIUM/HIGH/CRITICAL), `allocationDate`, `targetCompletionDate`, `assignedInspectorId?` | contractor_profiles, governorates, scoring_weights, users | work_orders, audit_logs, notifications |
| 12 | GET | `/admin/contractors` | Populate contractor dropdown | `status=ACTIVE`, `page`, `limit` | contractor_profiles, users | — |
| 13 | GET | `/admin/reports/governorates` | Populate governorate dropdown | — | governorates | — |
| 14 | GET | `/admin/users` | Populate inspector dropdown | `role=INSPECTOR&status=ACTIVE`, `page`, `limit` | users, staff_profiles | — |

**Notes:**
- Work order ID auto-generated: `WO-YYYYMMDD-XXXX` (sequential per day).
- `scoringWeightsId` is automatically set to the currently active weights row (effectiveTo = null).
- If `assignedInspectorId` provided → status = `ASSIGNED` and notification sent. Otherwise status = `UNASSIGNED`.

---

### Screen: Work Orders — Detail

| # | Method | Endpoint | Purpose | Path/Query | Tables Read | Tables Written |
|---|--------|----------|---------|------------|-------------|----------------|
| 15 | GET | `/admin/work-orders/:id` | Full work order with inspection, responses, all evidence | Path: `id` | work_orders, contractor_profiles, users, staff_profiles, governorates, scoring_weights, inspections, inspection_responses, checklist_items, evidence, files | — |
| 16 | PATCH | `/admin/work-orders/:id/assign` | Assign or reassign inspector | Body: `inspectorId` | work_orders, users, checklist_versions, checklist_items | work_orders, inspections, inspection_responses, audit_logs, notifications |
| 17 | PATCH | `/admin/work-orders/:id` | Edit work order fields | Body: `siteName?`, `description?`, `priority?`, `targetCompletionDate?` | work_orders | work_orders, audit_logs |

**Assign logic:**
- If current status = `SUBMITTED` → new status = `PENDING_INSPECTION` + creates `Inspection` record with all active checklist items pre-populated.
- If current status = `UNASSIGNED` or `ASSIGNED` → new status = `ASSIGNED`.
- Sends `WORK_ORDER_ASSIGNED` notification to inspector.

---

### Screen: Contractors — List

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 18 | GET | `/admin/contractors` | Paginated contractor list | `status` (PENDING/ACTIVE/INACTIVE/SUSPENDED), `search` (company name/CR/contact/email), `page`, `limit` | contractor_profiles, users | — |

---

### Screen: Contractor — Detail

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 19 | GET | `/admin/contractors/:cr` | Contractor profile + last 10 work orders | Path: `cr` | contractor_profiles, users, work_orders, inspections, governorates | — |
| 20 | GET | `/admin/contractors/:cr/performance` | Full performance data (SQL function) | `year`, `month` (0=all) | **get_contractor_performance()** → work_orders, inspections, inspection_responses, contractor_profiles, governorates | — |
| 21 | PATCH | `/admin/contractors/:cr/status` | Activate / suspend / deactivate contractor | Body: `status`, `reason?` | contractor_profiles | users, audit_logs |

**Performance response structure:**
```json
{
  "profile": { "cr_number": "...", "company_name": "...", "status": "ACTIVE", ... },
  "summary": { "total_work_orders": 24, "completed": 20, "active": 4, "avg_score": 86.2, "compliance_distribution": { "excellent": 8, "good": 9, "fair": 2, "poor": 1 } },
  "category_scores": { "hse": 88.0, "technical": 84.5, "process": 82.0, "closure": 90.0 },
  "monthly_trend": [ { "month": "2025-01", "avg_score": 87.0, "count": 3 }, ... ],
  "work_orders": [ { "work_order_id": "...", "site_name": "...", "final_score": 88.0, ... } ]
}
```

---

### Screen: User Management — List

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 22 | GET | `/admin/users` | List all staff users | `role` (INSPECTOR/ADMIN/REGULATOR), `status`, `search` (name/email), `page`, `limit` | users, staff_profiles, regulator_profiles | — |

---

### Screen: User Management — Create Inspector / Admin

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 23 | POST | `/admin/users` | Create inspector or admin | `email`, `role` (INSPECTOR/ADMIN), `employeeId`, `fullName`, `phone` | users (dup check), staff_profiles (dup employee_id) | users, staff_profiles, audit_logs |

**Returns:** `{ user (without passwordHash), tempPassword }`
Temp password format: `Temp@XXXXXX` (6-char random uppercase). Admin must share this with the new user.

---

### Screen: User Management — User Detail / Status

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 24 | GET | `/admin/users/:id` | Get user detail | — | users, staff_profiles, regulator_profiles | — |
| 25 | PATCH | `/admin/users/:id/status` | Activate / suspend / deactivate | Body: `status` (PENDING/ACTIVE/INACTIVE/SUSPENDED) | users | users, audit_logs |

---

### Screen: Access Requests — List

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 26 | GET | `/admin/access-requests` | Paginated request list | `status` (PENDING/APPROVED/REJECTED), `role` (CONTRACTOR/REGULATOR), `page`, `limit` | access_requests, files | — |

---

### Screen: Access Requests — Detail / Review

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 27 | GET | `/admin/access-requests/:id` | Full request with document | — | access_requests, files | — |
| 28 | POST | `/admin/access-requests/:id/approve` | Approve: create user + profile | — | access_requests, users (dup), contractor_profiles (dup CR) | users, contractor_profiles OR regulator_profiles, access_requests, audit_logs, notifications |
| 29 | POST | `/admin/access-requests/:id/reject` | Reject with reason | Body: `reason` (required) | access_requests | access_requests, audit_logs |

**Approve flow:**
- `roleRequested = CONTRACTOR` → creates `users` + `contractor_profiles` (crNumber from request).
- `roleRequested = REGULATOR` → creates `users` + `regulator_profiles`.
- Sets `access_requests.status = APPROVED`, `verification_status = VERIFIED`.
- Sends `ACCESS_REQUEST_APPROVED` notification.
- Returns `{ ok, userId, tempPassword }`.

---

### Screen: Checklist Management

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 30 | GET | `/admin/checklist` | List checklist items | `active=true/false`, `category` (HSE/TECHNICAL/PROCESS/CLOSURE) | checklist_items | — |
| 31 | POST | `/admin/checklist` | Create new item | `id` (e.g. HSE-004), `question`, `category`, `weight` (1-100), `order` | checklist_items (dup check) | checklist_items, audit_logs |
| 32 | PATCH | `/admin/checklist/:id/deactivate` | Soft-delete item | — | checklist_items | checklist_items, audit_logs |

**Rules:**
- `id` format: `HSE-001`, `TECH-007`, etc.
- Question text is **immutable** after creation. To change a question: deactivate old item, create new.
- Per-category weights should sum to 100 (enforced by convention, not DB constraint).

---

### Screen: Scoring Weights

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 33 | GET | `/admin/scoring-weights` | List all weight versions | — | scoring_weights | — |
| 34 | POST | `/admin/scoring-weights` | Create new weights (closes current) | `hsePercent`, `technicalPercent`, `processPercent`, `closurePercent` *(must sum to 100)*, `effectiveFrom` | scoring_weights | scoring_weights, audit_logs |

**Behaviour:**
- Creating new weights sets `effectiveTo` on the currently active row (effectiveTo = null) to `effectiveFrom - 1 day`.
- All future work orders will use the new weights.
- Existing work orders keep the weights they were created with (locked on `scoring_weights_id`).

---

### Screen: Reports — Inspector Workload

| # | Method | Endpoint | Purpose | Query Params | DB Function | Tables Aggregated |
|---|--------|----------|---------|--------------|-------------|-------------------|
| 35 | GET | `/admin/reports/inspector-workload` | Inspector workload stats | `from` (YYYY-MM-DD), `to` (YYYY-MM-DD) | `get_inspector_workload(from, to)` | users, staff_profiles, work_orders, inspections |

**Response:**
```json
{
  "inspectors": [
    {
      "user_id": "uuid",
      "full_name": "Ahmed Al-Rashdi",
      "employee_id": "EMP-001",
      "email": "...",
      "phone": "...",
      "status": "ACTIVE",
      "active_work_orders": 3,
      "completed_in_period": 8,
      "avg_score": 85.4,
      "avg_days_to_complete": 4.2
    }
  ]
}
```

---

### Screen: Reports — Exports List

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 36 | GET | `/admin/reports/exports` | List generated report exports | `page`, `limit` | report_exports, files | — |
| 37 | GET | `/admin/reports/governorates` | Get all governorates (for filter dropdowns) | — | governorates | — |

---

## 3. Regulator Portal — Web App

> All `/api/regulator/*` routes require role `REGULATOR` or `ADMIN`.

---

### Screen: Dashboard

| # | Method | Endpoint | Purpose | Query Params | DB Function | Tables Aggregated |
|---|--------|----------|---------|--------------|-------------|-------------------|
| 38 | GET | `/regulator/dashboard` | Full regulator dashboard in one call | `from` (default: Jan 1 current year), `to` (default: today) | `get_regulator_dashboard(from, to)` | users, contractor_profiles, inspections, work_orders, inspection_responses, governorates, audit_logs |

**Response structure:**
```json
{
  "kpis": {
    "total_contractors": { "value": 52, "active": 45, "pending": 4, "suspended": 2, "inactive": 1 },
    "total_inspections": { "value": 140, "trend_pct": 8.0 },
    "avg_compliance":    { "value": 83.7, "trend_pts": 1.2 },
    "non_compliant_items": { "count": 34, "total": 420, "pct": 8.1 }
  },
  "compliance_trend": [ { "month": "2025-01", "overall": 83.0, "hse": 86.0, "technical": 81.0, "process": 79.0, "closure": 90.0 } ],
  "compliance_distribution": { "excellent": 12, "good": 22, "fair": 8, "poor": 3 },
  "regional_performance": [ { "governorate_code": "MS", "governorate_name": "Muscat", "active_contractors": 18, "total_inspections": 52, "avg_score": 85.2 } ],
  "category_performance": { "hse": 86.0, "technical": 82.0, "process": 80.0, "closure": 90.0 },
  "top_performers":    [ { "cr_number": "...", "company_name": "...", "avg_score": 93.0, "projects": 6 } ],
  "bottom_performers": [ { "cr_number": "...", "company_name": "...", "avg_score": 61.0, "projects": 3 } ],
  "recent_activity":   [ { "action": "INSPECTION_COMPLETED", "entity_type": "WORK_ORDER", "entity_id": "WO-...", "metadata": {}, "created_at": "..." } ]
}
```

---

### Screen: Contractors — List (Read-Only)

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 39 | GET | `/regulator/contractors` | Read-only contractor list | `status`, `search`, `page`, `limit` | contractor_profiles, users | — |

---

### Screen: Contractor — Detail (Read-Only)

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 40 | GET | `/regulator/contractors/:cr` | Contractor basic info | Path: `cr` | contractor_profiles, users | — |
| 41 | GET | `/regulator/contractors/:cr/performance` | Full performance metrics | `year`, `month` | **get_contractor_performance()** | work_orders, inspections, contractor_profiles, governorates | — |

---

## 4. Inspector App — Mobile

> All `/api/inspector/*` routes require role `INSPECTOR`.

---

### Screen: Work Pool (Unassigned Work Orders)

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 42 | GET | `/inspector/work-orders?view=pool` | Unassigned SUBMITTED work orders | `page`, `limit` | work_orders, contractor_profiles, governorates, inspections | — |

**Response item:**
```json
{
  "id": "WO-20250101-0001",
  "siteName": "Al Khoud Phase 2",
  "status": "SUBMITTED",
  "priority": "HIGH",
  "allocationDate": "2025-01-10",
  "targetCompletionDate": "2025-01-30",
  "governorate": { "code": "MS", "nameEn": "Muscat" },
  "contractor": { "companyName": "Al Noor Contracting", "crNumber": "CR-2020-001" },
  "inspection": null
}
```

---

### Screen: My Work Orders (Assigned)

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 43 | GET | `/inspector/work-orders?view=mine` | Orders assigned to me (ASSIGNED/PENDING_INSPECTION/INSPECTION_IN_PROGRESS) | `page`, `limit` | work_orders, contractor_profiles, governorates, inspections | — |
| 44 | GET | `/inspector/work-orders?view=completed` | My completed inspections | `page`, `limit` | work_orders, contractor_profiles, governorates, inspections | — |

---

### Screen: Work Order Detail (Pre-Inspection)

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 45 | GET | `/inspector/work-orders/:id` | Full work order including contractor evidence | Path: `id` | work_orders, contractor_profiles, governorates, inspections, inspection_responses, checklist_items, evidence (CONTRACTOR only), files | — |
| 46 | POST | `/inspector/work-orders/:id/claim` | Claim from work pool → PENDING_INSPECTION | — | work_orders (status check), checklist_versions, checklist_items | work_orders, inspections, inspection_responses (all items pre-populated), audit_logs |

**Claim details:**
- Verifies work order is `SUBMITTED` and unassigned.
- Fetches current active `checklist_version` (effectiveTo = null).
- Fetches all active `checklist_items`.
- Creates `Inspection` record (status = PENDING).
- Creates one `InspectionResponse` per checklist item with `questionSnapshot` = current question text.
- Sets work order `assignedInspectorId` = current user, status → `PENDING_INSPECTION`.

---

### Screen: Inspection Detail / Begin Inspection

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 47 | GET | `/inspector/inspections` | List my inspections | `status` (PENDING/IN_PROGRESS/SUBMITTED), `page`, `limit` | inspections, work_orders, contractor_profiles, governorates | — |
| 48 | GET | `/inspector/inspections/:id` | Full inspection with all responses + contractor evidence | Path: `id` | inspections, work_orders, contractor_profiles, governorates, scoring_weights, inspection_responses, checklist_items, evidence (both roles), files | — |
| 49 | POST | `/inspector/inspections/:id/start` | Begin inspection (PENDING → IN_PROGRESS) | — | inspections, work_orders | inspections, work_orders, audit_logs |

**Start details:**
- Status: `PENDING` → `IN_PROGRESS`
- Work order status: `PENDING_INSPECTION` → `INSPECTION_IN_PROGRESS`
- Audit logged.

---

### Screen: Checklist / Rate Items

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 50 | PUT | `/inspector/inspections/:id/responses` | Save / update ratings & comments (draft, no status change) | `responses[]` each with `checklistItemId`, `rating?` (COMPLIANT/PARTIAL/NON_COMPLIANT), `inspectorComments?` | inspections, work_orders | inspection_responses |

**Notes:**
- Can be called multiple times as inspector works through the list.
- No status change — inspection stays `IN_PROGRESS`.
- Partial saves are supported (can send just the updated items).

---

### Screen: Evidence Upload (During Inspection)

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 51 | POST | `/files/presign` | Get presigned upload URL | `filename`, `mimeType`, `category` (EVIDENCE_PHOTO/EVIDENCE_VIDEO), `fileSize?` | — | files (status=PENDING) |
| 52 | PATCH | `/files/:id/confirm` | Confirm file uploaded successfully | — | files | files (status=UPLOADED) |
| 53 | POST | `/inspector/evidence` | Link uploaded file to inspection + checklist item | `inspectionId`, `workOrderId`, `checklistItemId`, `fileId`, `comment?`, `gpsLat?`, `gpsLng?`, `gpsAccuracy?`, `capturedAt?` | inspections, files | evidence |
| 54 | DELETE | `/inspector/evidence/:id` | Remove evidence from in-progress inspection | — | evidence, inspections | evidence |

**GPS fields:** `gpsLat` (Decimal 10,8), `gpsLng` (Decimal 11,8), `gpsAccuracy` (Decimal 8,2 in meters).

---

### Screen: Submit Inspection

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 55 | POST | `/inspector/inspections/:id/submit` | Calculate scores + submit | — | inspections, work_orders, scoring_weights, inspection_responses, checklist_items, users (admins for notification) | inspections, work_orders, audit_logs, notifications |

**Score calculation (server-side):**
1. Groups responses by `checklist_items.category`.
2. Per category: `score = Σ(rating_value × item_weight) / Σ(item_weights) × 100`
   - COMPLIANT = 1.0, PARTIAL = 0.5, NON_COMPLIANT = 0.0
3. `final_score = (hse × hsePercent + technical × technicalPercent + process × processPercent + closure × closurePercent) / 100`
4. Rating: EXCELLENT ≥ 90, GOOD ≥ 80, FAIR ≥ 70, POOR < 70

**Precondition:** All `inspection_responses.rating` must be set (no nulls).

**State changes:**
- `inspections.status` → `SUBMITTED`, `submitted_at` = now
- `inspections.hse_score`, `technical_score`, `process_score`, `closure_score`, `final_score`, `compliance_rating` populated
- `work_orders.status` → `INSPECTION_COMPLETED`
- Audit logged + `INSPECTION_COMPLETED` notifications sent to all ADMIN users

**Returns:** `{ finalScore, complianceRating, categoryScores: { hse, technical, process, closure } }`

---

### Screen: View File

| # | Method | Endpoint | Purpose | Path | Tables Read |
|---|--------|----------|---------|------|-------------|
| 56 | GET | `/files/:id/url` | Get temporary read URL for any file (evidence, docs) | Path: `id` | files |

Returns `{ url, expiresInSeconds: 3600 }` — signed URL valid for 1 hour.

---

## 5. Contractor App — Mobile

> All `/api/contractor/*` routes require role `CONTRACTOR`.

---

### Screen: My Work Orders — List

| # | Method | Endpoint | Purpose | Query Params | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 57 | GET | `/contractor/work-orders` | List contractor's own work orders | `status` (filter), `page`, `limit` | work_orders, governorates, inspections | — |

**Response item includes:** `id`, `siteName`, `status`, `priority`, `allocationDate`, `targetCompletionDate`, `governorate`, `inspection` (finalScore, complianceRating, status, submittedAt).

---

### Screen: Work Order Detail

| # | Method | Endpoint | Purpose | Path | Tables Read | Tables Written |
|---|--------|----------|---------|------|-------------|----------------|
| 58 | GET | `/contractor/work-orders/:id` | Full work order with own uploaded evidence and inspection result | Path: `id` | work_orders, governorates, inspections, inspection_responses, checklist_items, evidence (CONTRACTOR only), files | — |

**Notes:**
- `inspection_responses` shown read-only (question + rating) after inspection submitted.
- Contractor sees their own uploaded evidence only.

---

### Screen: Start Work

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 59 | PATCH | `/contractor/work-orders/:id/start` | Mark work as started (ASSIGNED → IN_PROGRESS) | — | work_orders, contractor_profiles | work_orders, audit_logs |

**Precondition:** Work order must be `ASSIGNED` to this contractor.

---

### Screen: Upload Evidence (During Work)

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 60 | POST | `/files/presign` | Get presigned upload URL | `filename`, `mimeType`, `category` (EVIDENCE_PHOTO/EVIDENCE_VIDEO), `fileSize?` | — | files (status=PENDING) |
| 61 | PATCH | `/files/:id/confirm` | Confirm file uploaded | — | files | files (status=UPLOADED) |
| 62 | POST | `/contractor/work-orders/:id/evidence` | Attach evidence to a checklist item with optional comment | `checklistItemId`, `fileId`, `comment?` (contractor note), `gpsLat?`, `gpsLng?`, `gpsAccuracy?`, `capturedAt?` | work_orders, contractor_profiles, files | evidence |

**Notes:**
- `comment` = contractor's note on their evidence (e.g. "Installed as per spec, photo taken at site exit").
- Allowed when work order status is `ASSIGNED` or `IN_PROGRESS`.
- `uploadedByRole` = `CONTRACTOR` automatically.

---

### Screen: Submit Work

| # | Method | Endpoint | Purpose | Request Body | Tables Read | Tables Written |
|---|--------|----------|---------|--------------|-------------|----------------|
| 63 | POST | `/contractor/work-orders/:id/submit` | Submit completed work (IN_PROGRESS → SUBMITTED) | — | work_orders, contractor_profiles, users (admins) | work_orders, audit_logs, notifications |

**Precondition:** Status must be `IN_PROGRESS`.
**State change:** `work_orders.status` → `SUBMITTED`, `submission_date` = now.
**Notifications:** `WORK_ORDER_SUBMITTED` sent to all ADMIN users.
Work order now appears in Inspector app Work Pool.

---

### Screen: View Inspection Result

| # | Method | Endpoint | Purpose | Path | Tables Read |
|---|--------|----------|---------|------|-------------|
| 64 | GET | `/contractor/work-orders/:id` | View final inspection scores and checklist results | Path: `id` | work_orders, inspections, inspection_responses, checklist_items |

Contractor sees the final score, compliance rating, and per-item ratings (no inspector comments shown, only rating values).

---

## 6. File Upload Flow

All file uploads follow a **presign → upload directly → confirm** pattern to avoid routing large files through the backend.

```
1. POST /api/files/presign
   Body: { filename, mimeType, category, fileSize? }
   → Creates File record (status=PENDING) in DB
   → Returns: { fileId, uploadUrl (signed), publicUrl, expiresInSeconds: 900 }

2. Client uploads directly to S3 / Supabase Storage using uploadUrl (PUT request)
   No backend involvement in the actual file transfer

3. PATCH /api/files/:fileId/confirm
   → Updates File record status to UPLOADED
   → Returns: { ok: true, fileId }

4. Use fileId in subsequent API calls
   (e.g. POST /api/contractor/work-orders/:id/evidence with { fileId: "..." })
```

**Storage provider:** `STORAGE_PROVIDER=supabase` (dev) or `STORAGE_PROVIDER=s3` (UAT + prod).
**Read access:** `GET /api/files/:id/url` returns a 1-hour signed read URL for any file.

---

## 7. PostgreSQL Functions (Dashboard Queries)

These functions live in `database/functions/` and are called via `prisma.$queryRaw`. Each returns a single `jsonb` in one DB roundtrip.

| Function | Endpoint | Called By | Parameters |
|----------|----------|-----------|------------|
| `get_admin_dashboard(year, month)` | `GET /admin/dashboard` | Admin dashboard | `p_year INT`, `p_month INT` (0=all) |
| `get_regulator_dashboard(from, to)` | `GET /regulator/dashboard` | Regulator dashboard | `p_from_date DATE`, `p_to_date DATE` |
| `get_contractor_performance(cr, year, month)` | `GET /admin/contractors/:cr/performance`, `GET /regulator/contractors/:cr/performance` | Admin + Regulator | `p_cr_number TEXT`, `p_year INT`, `p_month INT` |
| `get_inspector_workload(from, to)` | `GET /admin/reports/inspector-workload` | Admin Reports | `p_from_date DATE`, `p_to_date DATE` |

Apply all functions: `./database/apply.sh` (loads `.env.{NODE_ENV}` and runs all SQL files against the DB).

---

## 8. Pending / Not Yet Implemented

The following features are identified as needed but **not yet built**. These should be added before frontend integration.

### High Priority — Blockers for Frontend

| # | Feature | Role | Suggested Endpoint | Notes |
|---|---------|------|--------------------|-------|
| P1 | Get all governorates (standalone) | Admin, Inspector | `GET /api/governorates` | Needed for work order creation form and filters. Currently only under `/admin/reports/governorates` — should be a public or widely accessible endpoint. |
| P2 | Get all active checklist items | Inspector, Contractor | `GET /api/checklist` | Needed by mobile to show checklist structure (categories + items) before inspection. Inspector needs to know all items to display them properly. |
| P3 | Update own profile (name, phone) | All roles | `PATCH /api/auth/me/profile` | Currently only password change is supported. Staff need to update phone; contractors need to update contact details. |
| P4 | Get a single notification | All | `GET /api/notifications/:id` | List exists but tapping a notification to get full detail needs this. |

### Medium Priority — Full Feature Coverage

| # | Feature | Role | Suggested Endpoint | Notes |
|---|---------|------|--------------------|-------|
| M1 | Audit log viewer | Admin | `GET /api/admin/audit-logs?entityType=&entityId=&page=&limit=` | Audit logs are written everywhere but never exposed via API. Admin should be able to view history. |
| M2 | Create checklist version | Admin | `POST /api/admin/checklist/versions` | When checklist items are added/deactivated, a new version snapshot should be created. Currently no endpoint to bump the version and create a new `checklist_versions` row. |
| M3 | Update contractor profile | Admin, Contractor | `PATCH /api/admin/contractors/:cr` | Updating company name, contact name, phone, regions of operation. |
| M4 | Update inspector / admin profile | Admin | `PATCH /api/admin/users/:id/profile` | Updating full name, phone, employee ID. |
| M5 | Regulator view of all inspections | Regulator | `GET /api/regulator/inspections?from=&to=&contractorCr=` | Regulator needs a list of all inspections (not just per-contractor). Currently no aggregate inspection list for regulator. |
| M6 | Inspector stats / summary card | Admin | `GET /api/admin/users/:id/stats` | The workload function returns aggregate; admin may want a per-inspector drill-down screen. |
| M7 | Work order cancellation | Admin | `POST /api/admin/work-orders/:id/cancel` | No way to cancel/void a work order currently. |
| M8 | Resend / reset temp password | Admin | `POST /api/admin/users/:id/reset-password` | Admin needs to reset passwords without recreating users. |
| M9 | Search work orders by date range | Admin | `GET /api/admin/work-orders?fromDate=&toDate=` | Allocation date range filter not yet implemented. |
| M10 | Get contractor's own profile | Contractor | `GET /api/contractor/profile` | `GET /auth/me` returns profile but contractor may need a dedicated endpoint for their full business profile. |

### Low Priority — Nice to Have

| # | Feature | Role | Suggested Endpoint | Notes |
|---|---------|------|--------------------|-------|
| L1 | PDF report generation | Admin | `POST /api/admin/reports/generate` | The `ReportExport` table exists. Need to integrate a PDF library (e.g. `pdfkit` or headless Chrome) to generate contractor performance PDFs. |
| L2 | Excel/CSV export | Admin | `POST /api/admin/reports/generate` (format=EXCEL/CSV) | Same endpoint, different format parameter. |
| L3 | Delete contractor evidence | Contractor | `DELETE /api/contractor/work-orders/:id/evidence/:evidenceId` | Contractor can upload but cannot remove incorrectly uploaded evidence. |
| L4 | Reassign inspector from mobile | Admin (if mobile admin role exists) | *(via existing PATCH assign endpoint)* | Already exists for web — just needs to be called from mobile if admin screens are added to mobile. |
| L5 | Inspection summary for contractor | Contractor | Within existing work order detail | After inspection is `INSPECTION_COMPLETED`, contractor should see a read-only summary. Already partially supported via `GET /contractor/work-orders/:id`. |
| L6 | Push notifications integration | All mobile | Not a REST endpoint | FCM/APNs device token registration and push delivery. Currently only in-app notification records are created. |
| L7 | Mark work order as OVERDUE | System | Cron job / background task | `OVERDUE` status exists but no mechanism to set it. Needs a scheduled job that marks orders past `targetCompletionDate` as overdue. |

---

## Data Model Quick Reference

| Table | Primary Key | Key Relationships | Notes |
|-------|-------------|-------------------|-------|
| `users` | `id` (UUID) | Has contractor_profile / staff_profile / regulator_profile | Soft status via `status` enum |
| `contractor_profiles` | `cr_number` (string) | Belongs to `users`, has many `work_orders` | CR = primary business identifier |
| `staff_profiles` | `user_id` | Belongs to `users` | For INSPECTOR and ADMIN roles |
| `regulator_profiles` | `user_id` | Belongs to `users` | For REGULATOR role |
| `work_orders` | `id` (WO-YYYYMMDD-XXXX) | contractor_cr → contractor_profiles, assigned_inspector_id → users, scoring_weights_id → scoring_weights, governorate_code → governorates | Lifecycle: UNASSIGNED → ASSIGNED → IN_PROGRESS → SUBMITTED → PENDING_INSPECTION → INSPECTION_IN_PROGRESS → INSPECTION_COMPLETED |
| `inspections` | `id` (UUID) | Unique per work_order_id, checklist_version_id → checklist_versions | Scores populated on submit |
| `inspection_responses` | `id` (UUID) | Unique per (inspection_id, checklist_item_id) | `question_snapshot` = immutable copy of question at inspection time (Option B) |
| `evidence` | `id` (UUID) | work_order_id, inspection_id (nullable for contractor), checklist_item_id, uploaded_by, file_id | `uploaded_by_role` = INSPECTOR or CONTRACTOR |
| `checklist_items` | `id` (HSE-001 format) | Has many inspection_responses | `is_active` = soft delete; question text immutable |
| `checklist_versions` | `version_number` (autoincrement) | Has many inspections | `items_snapshot` = JSON snapshot; version locked onto inspection at claim time |
| `scoring_weights` | `id` (UUID) | Has many work_orders | `effective_to = null` = currently active; locked onto work order at creation |
| `access_requests` | `id` (REQ-YYYYMMDD-XXXX) | `document_file_id` → files, `reviewed_by` → users | `contractor_cr` is plain string (no FK) |
| `files` | `id` (UUID) | `uploaded_by` → users | `s3_key` = storage path; `upload_status` = PENDING → UPLOADED |
| `notifications` | `id` (UUID) | `user_id` → users, `work_order_id?` → work_orders | Append-only, read-only after creation |
| `audit_logs` | `id` (UUID) | `performed_by?` → users (no FK on entity_id) | Append-only; polymorphic entity reference |
| `report_exports` | `id` (UUID) | `generated_by` → users, `file_id?` → files | Tracks every generated PDF/export |
| `governorates` | `code` (e.g. "MS") | Has many work_orders | Seeded: 11 Oman governorates |

---

## Status Lifecycle Summary

### Work Order Status Flow
```
UNASSIGNED
    ↓ (Admin assigns inspector)
ASSIGNED
    ↓ (Contractor starts work)
IN_PROGRESS
    ↓ (Contractor submits)
SUBMITTED ←── appears in Inspector Work Pool
    ↓ (Inspector claims OR Admin assigns inspector)
PENDING_INSPECTION
    ↓ (Inspector clicks Begin)
INSPECTION_IN_PROGRESS
    ↓ (Inspector submits)
INSPECTION_COMPLETED

(parallel) OVERDUE  ← set when past targetCompletionDate [not yet automated]
```

### Inspection Status Flow
```
PENDING         ← created when inspector claims / admin assigns from SUBMITTED
    ↓ (Inspector taps Begin Inspection)
IN_PROGRESS
    ↓ (Inspector rates all items + submits)
SUBMITTED       ← final state; scores calculated server-side
```
