import assert from "node:assert/strict"
import test from "node:test"
import { runWorkspaceHealthGet, runWorkspaceHealthPost, type WorkspaceHealthDependencies } from "./route"

const authContext = {
    userId: "user-1",
    supabase: {} as never,
}

const readResponseBody = async (response: Response) => response.json()

const makeWorkspace = () => ({
    notebooks: [{ id: "notebook-1", userId: "user-1", title: "Notebook", slug: "notebook", summary: "", color: "#000", createdAt: "2026-06-01T00:00:00.000Z" }],
    pages: [],
    topics: [],
    views: [],
})

const baseDependencies = (overrides: Partial<WorkspaceHealthDependencies> = {}): WorkspaceHealthDependencies => ({
    createEmptyWorkspace: () => ({
        notebooks: [],
        pages: [],
        topics: [],
        views: [],
    }),
    loadWorkspaceForUser: async () => makeWorkspace(),
    recordVisualNoteEvent: () => {},
    repairWorkspaceConsistency: () =>
        ({
            ok: true,
            value: {
                notebookCount: 1,
                pageCount: 0,
                topicCount: 0,
                viewCount: 0,
                issues: [],
                repaired: false,
            },
        }) as never,
    resolveWorkspaceRevision: async () => "v1",
    saveWorkspaceForUser: async () => ({}) as never,
    workspaceHealthCheck: () =>
        ({
            ok: true,
            value: { notebookCount: 1, pageCount: 0, topicCount: 0, viewCount: 0, issues: [] },
        }) as never,
    ...overrides,
})

test("GET returns workspace health check results", async () => {
    const response = await runWorkspaceHealthGet(authContext, {
        ...baseDependencies(),
        workspaceHealthCheck: () =>
            ({
                ok: true,
                value: { notebookCount: 1, pageCount: 2, topicCount: 3, viewCount: 4, issues: [{ severity: "warning", scope: "page", id: "page-1", message: "Missing topic." }] },
            }) as never,
    })

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.ok, true)
    assert.equal(body.value.notebookCount, 1)
    assert.equal(body.value.pageCount, 2)
    assert.equal(body.value.issues[0].id, "page-1")
})

test("GET maps workspace load failures to status 500", async () => {
    const response = await runWorkspaceHealthGet(authContext, {
        ...baseDependencies(),
        loadWorkspaceForUser: async () => {
            throw new Error("db unavailable")
        },
    })

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "db unavailable")
})

test("POST reports repair result when no changes are required", async () => {
    const response = await runWorkspaceHealthPost(authContext, {
        ...baseDependencies(),
        repairWorkspaceConsistency: () =>
            ({
                ok: true,
                value: {
                    orphanPages: [],
                    orphanTopics: [],
                    orphanViews: [],
                    repaired: false,
                },
            }) as never,
    })

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.ok, true)
    assert.equal(body.repaired, false)
})

test("POST saves repaired workspace and returns new revision", async () => {
    let saved = false
    const response = await runWorkspaceHealthPost(authContext, {
        ...baseDependencies(),
        repairWorkspaceConsistency: () =>
            ({
                ok: true,
                value: {
                    orphanPages: ["page-1"],
                    orphanTopics: [],
                    orphanViews: [],
                    repaired: true,
                    repairedWorkspace: makeWorkspace(),
                },
            }) as never,
        resolveWorkspaceRevision: async () => "v2",
        saveWorkspaceForUser: async () => {
            saved = true
            return { workspace: makeWorkspace(), warnings: [] }
        },
    })

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(saved, true)
    assert.equal(body.ok, true)
    assert.equal(body.repaired, true)
    assert.equal(body.revision, "v2")
})

test("POST maps repair calculation failures to 400", async () => {
    const response = await runWorkspaceHealthPost(authContext, {
        ...baseDependencies(),
        repairWorkspaceConsistency: () => ({ ok: false, error: "repair validation failed" }) as never,
    })

    assert.equal(response.status, 400)
    assert.equal((await readResponseBody(response)).error, "repair validation failed")
})

test("POST maps repair persistence failures to 500", async () => {
    const response = await runWorkspaceHealthPost(authContext, {
        ...baseDependencies(),
        repairWorkspaceConsistency: () =>
            ({
                ok: true,
                value: {
                    orphanPages: ["page-1"],
                    orphanTopics: [],
                    orphanViews: [],
                    repaired: true,
                    repairedWorkspace: makeWorkspace(),
                },
            }) as never,
        saveWorkspaceForUser: async () => {
            throw new Error("save failed")
        },
    })

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "save failed")
})
