import assert from "node:assert/strict"
import test from "node:test"
import { runWorkspaceLoad, runWorkspaceSave, type WorkspaceRouteDependencies } from "./route"

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
    const routes = await runWorkspaceLoad(authContext, {
        loadWorkspaceForUserWithRevision: async () => ({ workspace, revision: "v1|notebooks:0:0|pages:0:0" }),
        resolveWorkspaceRevision: async () => "v1",
        saveWorkspaceForUser: async () => ({}) as never,
        logEvent: () => {},
        isWorkspaceConflictError: () => false,
        isWorkspaceIntegrityError: () => false,
    } as WorkspaceRouteDependencies)

    assert.equal(routes.status, 200)

    const body = await readResponseBody(routes)
    assert.equal(body.revision, "v1|notebooks:0:0|pages:0:0")
    assert.deepEqual(body.workspace, workspace)
    assert.equal(routes.headers.get("etag"), '"v1|notebooks:0:0|pages:0:0"')
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
    } as WorkspaceRouteDependencies)

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
            isWorkspaceIntegrityError: error => (error as { code?: string }).code === "workspace_integrity",
        } as WorkspaceRouteDependencies,
    )

    assert.equal(response.status, 400)
    const body = await readResponseBody(response)
    assert.match(body.error, /workspace payload is malformed/)
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
            isWorkspaceConflictError: error => (error as { code?: string }).code === "workspace_conflict",
            isWorkspaceIntegrityError: () => false,
        } as WorkspaceRouteDependencies,
    )

    assert.equal(response.status, 409)
    const body = await readResponseBody(response)
    assert.equal(body.error, "Workspace was modified while editing. Reload before saving.")
})

test("PUT maps storage configuration errors to status 400", async () => {
    const storageError = new Error("Configure notebook storage before saving page content to MinIO.") as Error & { code?: string }
    storageError.code = "workspace_storage_not_configured"

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
                throw storageError
            },
            logEvent: () => {},
            isWorkspaceConflictError: () => false,
            isWorkspaceIntegrityError: () => false,
            isWorkspaceStorageError: () => true,
        } as WorkspaceRouteDependencies,
    )

    assert.equal(response.status, 400)
    const body = await readResponseBody(response)
    assert.equal(body.error, "Configure notebook storage before saving page content to MinIO.")
})

test("PUT maps unknown save failures to status 500", async () => {
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
            logEvent: () => {},
            isWorkspaceConflictError: () => false,
            isWorkspaceIntegrityError: () => false,
        } as WorkspaceRouteDependencies,
    )

    assert.equal(response.status, 500)
    const body = await readResponseBody(response)
    assert.equal(body.error, "database down")
})
