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

1. Align route architecture around Next.js Server Actions for notebook/page/topic/view CRUD operations.
    - HTTP API routes should no longer be the primary mutating/read/write surface for core domain objects.
    - Keep route handlers only for flows required by MCP, and have those handlers delegate to shared Server Actions.
    - This reduces duplication and makes `src/app/api` ownership clearer for MCP-only integration.

## Critical feature gaps

No critical feature gaps remain in this list after the latest fixes.

## Developer and quality gaps

No remaining developer and quality risks remain in this section after these fixes.

## Roadmap by quarter

### Q1 (Stability and correctness)

Completed by the current roadmap cleanup:

1. Added transaction-like workspace save orchestration with revision validation and optimistic conflict handling.
2. Added workspace versioning/revision rejection for stale saves.
3. Added explicit conflict recovery state for concurrent workspace updates.
4. Enforced MCP scopes on tool actions.
5. Reworked local fallback behavior into explicit offline and recovery UX.
6. Removed legacy normalized-storage fallback paths and covered onboarding readiness with clearer setup failures.

### Q2 (Security and platform)

Completed by the current roadmap cleanup:

1. Expanded auth controls with login abuse protection and session hardening.
2. Added storage hygiene for page-level and workspace-level orphan asset cleanup.
3. Added maintenance cleanup endpoints for periodic orphan reconciliation.
4. Added signing/expiring asset access for private media.

Remaining product hardening:

1. Add deeper upload scanning beyond current MIME allowlist checks when production infrastructure is selected.

### Q3 (Product quality and collaboration)

Completed by the current roadmap cleanup:

1. Added search result caching and offline fallback behavior for notebook discovery.
2. Added notebook publish preview/apply workflow with persistence and test coverage.
3. Added explicit setup UX copy for storage configuration and graceful degraded behavior.

Remaining product roadmap:

1. Implement server-side notebook/topic/view pagination and filtered search APIs.
2. Add publish snapshot history and shareable notebook revisions.
3. Migrate core CRUD away from Next.js HTTP routes into Server Actions, then rework MCP route handlers to call those actions and expose only MCP-required HTTP endpoints.

### Q4 (Scale and confidence)

Completed by the current roadmap cleanup:

1. Added route tests across auth, MCP token, workspace health, asset delivery, signed assets, and publish workflow boundaries.
2. Added structured workspace/auth/MCP event telemetry and operational metrics readback.
3. Added CI workflow and unified repo QA entrypoints for format, lint, type-check, tests, and build.

Remaining confidence roadmap:

1. Add integration E2E for auth + notebook create/edit + page save + asset upload + export.
2. Add security checks to the automated release gate once the security tooling choice is finalized.

## Suggested next immediate actions (first 2 sprints)

1. Add integration E2E coverage for auth + notebook create/edit + page save + asset upload + export.
2. Implement server-side notebook/topic/view pagination and filtered search APIs.
3. Add publish snapshot history and shareable notebook revision URLs.
4. Migrate core notebook/page/topic/view CRUD from HTTP routes to Server Actions and route MCP endpoints through those actions.
5. Choose and wire production upload scanning for private media.
6. Add security checks to `npm run qa`/CI once the security tooling choice is finalized.
