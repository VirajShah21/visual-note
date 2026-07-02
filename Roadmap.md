# Visual Note Roadmap

## Scope

This roadmap focuses on the current codebase in `/Users/viraj/WebstormProjects/visual-note` and highlights issues that materially affect reliability, security, collaboration, and product readiness.

## Completed items (from Visual Note Legacy/Tech Debt Removal)

1. Removed dual persistence fallback to `visual_note_workspaces`.
    - `src/server/visual-note/workspace-store.ts`
    - `src/lib/supabase/server.ts`
    - `supabase/schema.sql`
    - `src/server/visual-note/workspace-store.test.mts`
2. Removed legacy workspace compatibility shape (`components`, `componentIds`, and old section aliasing).
    - `src/lib/visual-note/types.ts`
    - `src/lib/visual-note/factories.ts`
    - `src/features/visual-note/visual-note-app/types/visual-note-app.types.ts`
    - `src/lib/visual-note/workspace-api.ts`
3. Removed browser localStorage-based user/workspace cache for runtime restoration.
    - `src/lib/visual-note/storage.ts` (deleted)
    - `src/features/visual-note/visual-note-app/hooks/restore-visual-note-session.ts`
    - `src/features/visual-note/visual-note-app/hooks/use-visual-note-app-controller.ts`
    - `src/features/visual-note/visual-note-app/hooks/restore-visual-note-session.test.mts`
4. Removed legacy chart-data compatibility path and migration script.
    - `src/lib/visual-note/chart-data.ts`
    - `src/features/visual-note/visual-note-app/utils/chart-data.test.mts`
    - `scripts/migrate-visual-note-workspaces.mjs` (deleted)
5. Removed seeded workspace defaults and narrowed save synchronization behavior.
    - `src/features/visual-note/visual-note-app/hooks/restore-visual-note-session.ts`
    - `src/features/visual-note/visual-note-app/hooks/use-visual-note-app-controller.ts`
    - `src/server/visual-note/workspace-store.ts`

## Current risks (should be addressed first)

1. Data integrity risk in workspace save flow
    - `saveWorkspaceForUser` writes notebooks/pages first, then page content files in S3, without transaction boundaries.
    - Mitigated destructive in-memory snapshot cleanup (`deleteNotebooksNotIn`/`deletePagesNotIn`) during save to avoid dropping records created by concurrent sessions.
    - If upload/content serialization fails mid-loop, database rows can be committed without matching page content.
    - A stale or partial workspace can become indistinguishable from a valid one for normal reads.
    - Files: `src/server/visual-note/workspace-store.ts`, `src/server/visual-note/page-content-store.ts`.

2. Unreliable conflict handling for concurrent edits
    - Save logic is full-document overwrite style (`/api/workspace` PUT stores the complete workspace from client state).
    - There is no version/ETag check or optimistic lock, so last write wins silently.
    - Concurrent editors on the same account can clobber each other’s changes.
    - Files: `src/app/api/workspace/route.ts`, `src/lib/visual-note/workspace-api.ts`.

3. Explicit offline recovery UX is not yet defined.
    - Browser localStorage fallback was removed; recovery and stale-state handling is now remote-session-driven only.
    - Add clear reconnect/recovery UX for transient auth/network failures and explicitly report unsynced state.
    - Files: `src/features/visual-note/visual-note-app/hooks/restore-visual-note-session.ts`, `src/features/visual-note/visual-note-app/hooks/use-visual-note-app-controller.ts`, `src/app/api/workspace/route.ts`.

4. Authentication/session model is custom and security-sensitive
    - Project uses custom Supabase table auth instead of Supabase Auth.
    - Password/token security depends on code-level consistency and route hygiene.
    - Missing safeguards like rate limiting, suspicious-login detection, lockout policy, and token/session rotation.
    - Files: `src/server/auth/*`, `src/app/api/auth/*`.

5. MCP security scope model is currently non-functional
    - Tokens have `scopes`, and `verifyMcpToken` captures them, but tool handlers do not enforce scope-based authorization.
    - Any valid token can call all MCP tools.
    - Files: `src/server/mcp/token-store.ts`, `src/server/mcp/visual-note-tools.ts`, `src/server/mcp/visual-note-server-core.ts`.

6. No explicit orphan cleanup lifecycle for assets
    - Pages can be deleted while uploaded assets remain in S3/object keys and in records.
    - No background cleanup job or hard delete path tied to page/topic/view deletion.
    - Files: `src/app/api/pages/[pageId]/route.ts`, `src/app/api/notebooks/[notebookId]/assets/route.ts`, `src/app/api/assets/[assetId]/route.ts`, `src/server/storage/notebook-storage.ts`.

7. Limited observability and operational insight
    - No production telemetry around save conflicts, auth failures, MCP call failures, or storage errors.
    - Incident recovery and debugging currently depends on logs and manual UI notices.
    - Files: API routes and controllers emit generic notices without structured metrics.

## Critical feature gaps

1. Search, filtering, and discoverability scale
    - Search is implemented in-memory on the loaded workspace; no indexed/offline-friendly query strategy.
    - Large workspaces will degrade quickly without server-side filtering/pagination and field indexes in API queries.
    - Files: `src/features/visual-note/visual-note-app.tsx`, `src/features/visual-note/visual-note-app/utils/notebook-search.ts`.

2. Incomplete publish/export workflow
    - Export supports markdown/web/json generation paths but there is no persisted publish state and no preview/approval chain.
    - There is no versioned snapshot or public sharing mode tied to notebook configuration.
    - Files: `src/lib/visual-note/export/*`, `src/server/visual-note/workspace-operations/exports.ts`.

3. No workspace recovery UI for health checks
    - Health/repair logic exists (`workspaceHealthCheck`, `repairWorkspaceConsistency`) but is not surfaced as actionable UI/API tool.
    - Inconsistencies can continue to accumulate silently.
    - Files: `src/server/visual-note/workspace-operations/health.ts`.

4. Storage UX blocked without explicit setup
    - Notebook content persistence is coupled to per-notebook S3 configuration.
    - `savePageMarkdown` throws until storage is configured, causing content creation routes to fail in partially onboarded accounts.
    - Requires onboarding improvements and clearer setup guidance.
    - Files: `src/server/storage/notebook-storage.ts`, `src/app/api/notebooks/route.ts`, `src/app/api/pages/[pageId]/route.ts`, `src/features/visual-note/visual-note-app.tsx`.

5. Weak asset delivery security model
    - Asset fetch uses authenticated routes and short cache but no explicit content validation/virus scanning hooks.
    - No anti-hotlinking or signed URL policy and no size/type hardening beyond upload route checks.
    - Files: `src/app/api/assets/[assetId]/route.ts`, `src/app/api/notebooks/[notebookId]/assets/route.ts`.

## Developer and quality gaps

1. Tooling and release automation missing
    - No CI pipeline files or GitHub actions are present in-tree.
    - No full test command that runs all checks together; `lint` only runs auto-fix.
    - Build/lint/test gating is manual and inconsistent across environments.
    - Files: `package.json`, repo root.

2. No test coverage for API contract and schema validation boundaries
    - Unit tests cover parser/export/workspace operations and MCP smoke logic.
    - Route-level tests (auth, S3/storage paths, error branches, race cases) are effectively absent.
    - Files: `package.json`, `src/**/*.test.mts`.

3. No explicit contract tests for data model transitions
    - No tests for slug uniqueness, notebook transfer between user IDs, orphan repair, or cross-route ACL consistency.
    - Complex operations happen on whole-workspace objects without integration guardrails.
    - Files: operations and route layers above.

## Roadmap by quarter

### Q1 (Stability and correctness)

1. Add transaction-like save orchestration for workspace + content writes (idempotent staging and rollback semantics).
2. Add workspace versioning/ETag and reject stale saves.
3. Add conflict-aware merge strategy for concurrent editors.
4. Enforce MCP scopes on every tool action.
5. Rework local fallback behavior into explicit offline mode with explicit recovery UX.
6. Add deterministic migration verification for environments still onboarding normalized storage.

### Q2 (Security and platform)

1. Expand auth controls: rate limiting, brute-force protection, session invalidation policy, better CSRF protections where relevant.
2. Add storage hygiene: delete asset records and remote objects when notebook/page/topic/view data is removed.
3. Add upload hardening (MIME allowlist checks beyond prefix, scan path, lifecycle cleanup).
4. Add signing/expiring asset access pattern for private media.

### Q3 (Product quality and collaboration)

1. Implement server-side notebook/topic/view pagination and filtered search APIs.
2. Add publish snapshots/versioning and shareable notebook revisions.
3. Surface workspace health and repair in UI with user-confirmed cleanup.
4. Add explicit setup UX for storage configuration and graceful degraded mode.

### Q4 (Scale and confidence)

1. Add comprehensive route tests (auth + mutation edges + storage errors).
2. Add integration E2E for auth + notebook create/edit + page save + asset upload + export.
3. Add observability (request error taxonomy, retry counters, save failure metrics, MCP request auditing).
4. Add CI pipeline for lint/typecheck/tests/build/security checks.

## Suggested next immediate actions (first 2 sprints)

1. Implement scoped MCP tool authorization + add MCP token usage audit.
2. Add transactional save strategy for `/api/workspace` and `/api/pages` to prevent partial updates.
3. Introduce workspace revision checks on save.
4. Add route-level tests for auth + `/api/workspace`, `/api/pages`, `/api/notebooks/[id]/storage-settings`, `/api/notebooks/[id]/assets`.
5. Add migration readiness checks for teams with partial schema/config onboarding and fail fast with clear setup guidance.
