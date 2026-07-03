# Visual Note Roadmap

## Scope

This roadmap focuses on this repository’s Visual Note codebase and highlights issues that materially affect reliability, security, collaboration, and product readiness.

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
6. Enabled direct TSConfig path tooling and enforced alias-based imports.
    - `package.json`
    - `tsconfig.json`
    - `eslint.config.mjs`
    - `eslint-rules/prefer-tsconfig-paths.mjs`
    - `scripts/fix-tsconfig-imports.mjs`

7. Enforced MCP scope authorization and added MCP auth-failure observability at route boundary.
    - `src/server/mcp/token-store.ts`
    - `src/server/mcp/visual-note-server-core.ts`
    - `src/server/mcp/visual-note-tools.ts`
    - `src/server/mcp/visual-note-workspace-tools.ts`
    - `src/app/api/mcp/route.ts`
8. Added workspace revision validation and optimistic conflict handling for full-workspace saves.
    - `src/app/api/workspace/route-contract.ts`
    - `src/app/api/workspace/route.ts`
    - `src/server/visual-note/workspace-store.ts`
    - `src/lib/visual-note/workspace-api.ts`
9. Added explicit offline and conflict recovery state on the workspace client.
    - `src/features/visual-note/visual-note-app/hooks/use-visual-note-workspace-autosave.ts`
    - `src/features/visual-note/visual-note-app/hooks/workspace-recovery-actions.ts`
    - `src/features/visual-note/visual-note-app/hooks/restore-visual-note-session.ts`
    - `src/features/visual-note/visual-note-app/hooks/workspace-session-actions.ts`
10. Added login abuse protection and session hardening.
    - `src/server/auth/login-rate-limit.ts`
    - `src/app/api/auth/login/route.ts`
    - `src/server/auth/session-cookie.ts`
    - `src/app/api/auth/session/route.ts`
11. Added page-level and workspace-level orphan asset cleanup with S3 object deletion.
    - `src/server/visual-note/workspace-store.ts`
    - `src/server/storage/notebook-asset-cleanup.ts`
    - `src/app/api/pages/[pageId]/route.ts`
12. Added structured workspace/auth/MCP event telemetry across high-impact routes.
    - `src/server/observability/visual-note-events.ts`
    - `src/app/api/workspace/route.ts`
    - `src/app/api/pages/[pageId]/route.ts`
    - `src/app/api/auth/login/route.ts`
    - `src/app/api/mcp/route.ts`
13. Added maintenance endpoints for periodic orphan cleanup and operational metrics readback.
    - `src/app/api/maintenance/assets/route.ts`
    - `src/app/api/observability/metrics/route.ts`
14. Added route coverage for workspace health diagnostics and hardened asset delivery checks.
    - `src/app/api/workspace/health/route.ts`
    - `src/app/api/workspace/health/route.test.mts`
    - `src/app/api/assets/[assetId]/route.ts`
    - `src/app/api/assets/[assetId]/route.test.mts`
    - `src/components/ui/notebook-settings-workspace.tsx`
15. Added signed asset URL endpoint for private access and test coverage.
    - `src/app/api/assets/[assetId]/sign/route.ts`
    - `src/app/api/assets/[assetId]/sign/route.test.mts`
16. Added notebook publish preview/apply workflow with persistence and test coverage.
    - `src/lib/visual-note/storage-api.ts`
    - `src/features/visual-note/visual-note-app/hooks/use-visual-note-app-controller.ts`
    - `src/features/visual-note/visual-note-app/visual-note-app.tsx`
    - `src/components/ui/notebook-settings-workspace.tsx`
    - `src/app/api/notebooks/[notebookId]/publish/route.ts`
    - `src/app/api/notebooks/[notebookId]/publish/route.test.mts`
17. Added CI workflow for automated quality gates (format, lint, type-check, tests, build).
    - `.github/workflows/ci.yml`
18. Added search result caching and offline fallback behavior for notebook discovery.
    - `src/features/visual-note/visual-note-app/visual-note-app.tsx`
    - `src/features/visual-note/visual-note-app/utils/notebook-search.ts`
    - `src/lib/visual-note/storage-messages.ts`
19. Standardized storage-setup warning copy and setup guidance across storage writes and autosave surfaces.
    - `src/app/api/notebooks/route.ts`
    - `src/app/api/pages/[pageId]/route.ts`
    - `src/app/api/pages/[pageId]/content/route.ts`
    - `src/features/visual-note/visual-note-app/hooks/use-visual-note-workspace-autosave.ts`
    - `src/server/visual-note/page-content-store.ts`
    - `src/server/visual-note/workspace-store.ts`
    - `src/lib/visual-note/storage-messages.ts`
20. Added unified repo QA entrypoints for format/lint/type-check/test/build release automation.
    - `package.json`
21. Added contract-level route tests for uncovered auth and MCP token endpoints.
    - `src/app/api/auth/logout/route.ts`
    - `src/app/api/auth/logout/route.test.mts`
    - `src/app/api/auth/register/route.ts`
    - `src/app/api/auth/register/route.test.mts`
    - `src/app/api/auth/session/route.ts`
    - `src/app/api/auth/session/route.test.mts`
    - `src/app/api/mcp/tokens/[tokenId]/route.ts`
    - `src/app/api/mcp/tokens/[tokenId]/route.test.mts`
22. Added explicit data-model contract tests for ownership transitions and orphan repair.
    - `src/server/visual-note/workspace-store.test.mts`
    - `src/server/visual-note/workspace-operations.test.mts`

## Current risks (should be addressed first)

No risks currently listed in this section.

## Critical feature gaps

No critical feature gaps remain in this list after the latest fixes.
## Developer and quality gaps

No remaining developer and quality risks remain in this section after these fixes.

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
3. Add publish workflow preview and approval flow for versioned snapshots.
4. Add explicit setup UX for storage configuration and graceful degraded mode.

### Q4 (Scale and confidence)

1. Add comprehensive route tests (auth + mutation edges + storage errors).
2. Add integration E2E for auth + notebook create/edit + page save + asset upload + export.
3. Add observability (request error taxonomy, retry counters, save failure metrics, MCP request auditing).
4. Add CI pipeline for lint/typecheck/tests/build/security checks.

## Suggested next immediate actions (first 2 sprints)

1. Implement scoped MCP tool authorization + add MCP token usage audit.
2. Add background/periodic orphaned-asset reconciliation outside mutation paths.
3. Add centralized metrics collection, alerting, and dashboards for save/retry/error classes.
4. Add route-level tests for auth + `/api/workspace`, `/api/pages`, `/api/notebooks/[id]/assets`, and `/api/notebooks/[id]/storage-settings`.
5. Add migration readiness checks for teams with partial schema/config onboarding and fail fast with clear setup guidance.
