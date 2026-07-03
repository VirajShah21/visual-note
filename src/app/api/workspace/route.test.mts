import assert from "node:assert/strict"
import test from "node:test"
import { runWorkspaceAuthFailure, runWorkspaceLoad, runWorkspaceSave, type WorkspaceRouteDependencies } from "./route"
import { STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT } from "@/lib/visual-note/storage-messages"

const workspace = {
    notebooks: [],
    pages: [],
    topics: [],
    views: [],
}

const authContext = {
    userId: "user-1",
    supabase: {} as any,
}

const readResponseBody = async (response: Response) => response.json()

test("GET returns workspace data and revision from dependencies", async () => {
    const events: Array<{ event: string; userId?: string; severity?: string; metadata?: unknown }> = []

    const routes = await runWorkspaceLoad(authContext, {
        loadWorkspaceForUserWithRevision: async () => ({ workspace, revision: "v1|notebooks:0:0|pages:0:0" }),
        resolveWorkspaceRevision: async () => "v1",
        saveWorkspaceForUser: async () => ({}) as never,
        logEvent: (event: any) => {
            events.push(event)
        },
        isWorkspaceConflictError: () => false,
        isWorkspaceIntegrityError: () => false,
    } as unknown as WorkspaceRouteDependencies)

    assert.equal(routes.status, 200)

    const body = await readResponseBody(routes)
    assert.equal(body.revision, "v1|notebooks:0:0|pages:0:0")
    assert.deepEqual(body.workspace, workspace)
    assert.equal(routes.headers.get("etag"), '"v1|notebooks:0:0|pages:0:0"')
    assert.equal(events.length, 1)
    assert.equal(events[0].event, "workspace.load_success")
    assert.equal(events[0].severity, "info")
})

test("GET maps load failures to status 500", async () => {
    const routes = await runWorkspaceLoad(authContext, {
        loadWorkspaceForUserWithRevision: async () => {
            throw new Error("storage unavailable")
        },
        resolveWorkspaceRevision: async () => "v1",
        saveWorkspaceForUser: async () => ({}) as never,
        logEvent: () => {},
        isWorkspaceConflictError: () => false,
        isWorkspaceIntegrityError: () => false,
    } as unknown as WorkspaceRouteDependencies)

    assert.equal(routes.status, 500)

    const body = await readResponseBody(routes)
    assert.equal(body.error, "storage unavailable")
})

test("PUT maps invalid payloads to parsing status", async () => {
    const response = await runWorkspaceSave(authContext, { ok: false, error: "Workspace is required.", status: 400 })

    assert.equal(response.status, 400)
    assert.deepEqual(await readResponseBody(response), { error: "Workspace is required." })
})

test("PUT maps workspace integrity errors to status 400", async () => {
    const integrityError = new Error("Workspace payload is malformed: topic:topic-1") as Error & { code?: string; issues?: string[] }
    integrityError.code = "workspace_integrity"
    integrityError.issues = ["topic:topic-1"]

    const response = await runWorkspaceSave(
        authContext,
        {
            ok: true,
            workspace,
            revision: "v1",
            baseWorkspace: undefined,
        },
        {
            loadWorkspaceForUserWithRevision: async () => ({ workspace, revision: "v1" }),
            resolveWorkspaceRevision: async () => "v1",
            saveWorkspaceForUser: async () => {
                throw integrityError
            },
            logEvent: () => {},
            isWorkspaceConflictError: () => false,
            isWorkspaceIntegrityError: (error: unknown) => (error as { code?: string }).code === "workspace_integrity",
        } as unknown as WorkspaceRouteDependencies,
    )

    assert.equal(response.status, 400)
    const body = await readResponseBody(response)
    assert.match(body.error, /workspace payload is malformed/)
})

test("PUT returns warnings when workspace save reports non-fatal warnings", async () => {
    const response = await runWorkspaceSave(
        authContext,
        {
            ok: true,
            workspace,
            revision: "v1",
            baseWorkspace: undefined,
        },
        {
            loadWorkspaceForUserWithRevision: async () => ({ workspace, revision: "v1" }),
            resolveWorkspaceRevision: async () => "v2",
            saveWorkspaceForUser: async () => ({ workspace, warnings: [STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT] }),
            logEvent: () => {},
            isWorkspaceConflictError: () => false,
            isWorkspaceIntegrityError: () => false,
        } as unknown as WorkspaceRouteDependencies,
    )

    assert.equal(response.status, 200)
    const body = (await readResponseBody(response)) as { revision: string; warnings?: string[] }
    assert.equal(body.revision, "v2")
    assert.deepEqual(body.warnings, [STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT])
})

test("PUT maps conflict errors to status 409", async () => {
    const conflictError = new Error("Workspace was modified while editing. Reload before saving.") as Error & { code?: string }
    conflictError.code = "workspace_conflict"

    const response = await runWorkspaceSave(
        authContext,
        {
            ok: true,
            workspace,
            revision: "v1",
            baseWorkspace: undefined,
        },
        {
            loadWorkspaceForUserWithRevision: async () => ({ workspace, revision: "v1" }),
            resolveWorkspaceRevision: async () => "v2",
            saveWorkspaceForUser: async () => {
                throw conflictError
            },
            logEvent: () => {},
            isWorkspaceConflictError: (error: unknown) => (error as { code?: string }).code === "workspace_conflict",
            isWorkspaceIntegrityError: () => false,
        } as unknown as WorkspaceRouteDependencies,
    )

    assert.equal(response.status, 409)
    const body = await readResponseBody(response)
    assert.equal(body.error, "Workspace was modified while editing. Reload before saving.")
})

test("PUT maps unknown save failures to status 500", async () => {
    const events: Array<{ event: string; userId?: string; severity?: string; metadata?: { nextRevision?: string } }> = []

    const response = await runWorkspaceSave(
        authContext,
        {
            ok: true,
            workspace,
            revision: "v1",
            baseWorkspace: undefined,
        },
        {
            loadWorkspaceForUserWithRevision: async () => ({ workspace, revision: "v1" }),
            resolveWorkspaceRevision: async () => "v1",
            saveWorkspaceForUser: async () => {
                throw new Error("database down")
            },
            logEvent: (event: any) => {
                events.push(event)
            },
            isWorkspaceConflictError: () => false,
            isWorkspaceIntegrityError: () => false,
        } as unknown as WorkspaceRouteDependencies,
    )

    assert.equal(response.status, 500)
    const body = await readResponseBody(response)
    assert.equal(body.error, "database down")
    assert.equal(events.length, 1)
    assert.equal(events[0].event, "workspace.save_failed")
    assert.equal(events[0].severity, "error")
    assert.equal(events[0].metadata === undefined, true)
})

test("PUT logs workspace save success for successful saves", async () => {
    const events: Array<{ event: string; userId?: string; metadata?: { nextRevision?: string } }> = []

    const response = await runWorkspaceSave(
        authContext,
        {
            ok: true,
            workspace,
            revision: "v1",
            baseWorkspace: undefined,
        },
        {
            loadWorkspaceForUserWithRevision: async () => ({ workspace, revision: "v1" }),
            resolveWorkspaceRevision: async () => "v2",
            saveWorkspaceForUser: async () => ({}) as never,
            logEvent: (event: any) => {
                events.push(event)
            },
            isWorkspaceConflictError: () => false,
            isWorkspaceIntegrityError: () => false,
        } as unknown as WorkspaceRouteDependencies,
    )

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.revision, "v2")
    assert.equal(
        events.some(item => item.event === "workspace.save_success"),
        true,
    )
    assert.equal(
        events.some(item => item.event === "workspace.save_success" && item.metadata?.nextRevision === "v2"),
        true,
    )
})

test("GET auth failures are logged with workspace.auth_failed", async () => {
    const events: Array<{ event: string; userId?: string; severity?: string; metadata?: Record<string, unknown> }> = []

    const response = new Response(null, { status: 401 })
    const request = new Request("http://visual-note.test/api/workspace")

    const result = runWorkspaceAuthFailure(request, response, "load", {
        loadWorkspaceForUserWithRevision: async () => ({ workspace: { notebooks: [], pages: [], topics: [], views: [] }, revision: "v1" }),
        resolveWorkspaceRevision: async () => "v1",
        saveWorkspaceForUser: async () => ({}) as never,
        logEvent: (event: any) => {
            events.push(event)
        },
        isWorkspaceConflictError: () => false,
        isWorkspaceIntegrityError: () => false,
    } as unknown as WorkspaceRouteDependencies)

    assert.equal(result.status, 401)
    assert.equal(events.length, 1)
    assert.equal(events[0].event, "workspace.auth_failed")
    assert.equal(events[0].metadata?.operation, "load")
    assert.equal(events[0].metadata?.status, 401)
    assert.equal(events[0].metadata?.path, "/api/workspace")
})

test("PUT auth failures are logged with workspace.auth_failed", async () => {
    const events: Array<{ event: string; userId?: string; severity?: string; metadata?: Record<string, unknown> }> = []

    const response = new Response(null, { status: 403 })
    const request = new Request("http://visual-note.test/api/workspace")

    const result = runWorkspaceAuthFailure(request, response, "save", {
        loadWorkspaceForUserWithRevision: async () => ({ workspace: { notebooks: [], pages: [], topics: [], views: [] }, revision: "v1" }),
        resolveWorkspaceRevision: async () => "v1",
        saveWorkspaceForUser: async () => ({}) as never,
        logEvent: (event: any) => {
            events.push(event)
        },
        isWorkspaceConflictError: () => false,
        isWorkspaceIntegrityError: () => false,
    } as unknown as WorkspaceRouteDependencies)

    assert.equal(result.status, 403)
    assert.equal(events.length, 1)
    assert.equal(events[0].event, "workspace.auth_failed")
    assert.equal(events[0].metadata?.operation, "save")
})
