import assert from "node:assert/strict"
import test from "node:test"
import { defaultNotebookEditorSettings, type VisualNoteWorkspace } from "@/lib/visual-note/types"
import { restoreVisualNoteSession } from "./restore-visual-note-session"

const user = { id: "user-1", email: "viraj@example.com", name: "Viraj" }

const workspace: VisualNoteWorkspace = {
    notebooks: [
        {
            id: "notebook-1",
            userId: user.id,
            title: "Notebook",
            slug: "notebook",
            summary: "A notebook",
            color: "#2f7d5c",
            createdAt: "2026-01-01T00:00:00.000Z",
            editorSettings: defaultNotebookEditorSettings,
        },
    ],
    pages: [{ id: "page-1", notebookId: "notebook-1", title: "Home", position: 0 }],
    topics: [{ id: "topic-1", pageId: "page-1", title: "Start", summary: "Start here", position: 0 }],
    views: [
        {
            id: "view-1",
            topicId: "topic-1",
            title: "Welcome",
            mode: "article",
            content: "# Welcome",
            displays: [],
        },
    ],
}

class MemoryStorage {
    private values = new Map<string, string>()

    getItem(key: string) {
        return this.values.get(key) ?? null
    }

    setItem(key: string, value: string) {
        this.values.set(key, value)
    }

    removeItem(key: string) {
        this.values.delete(key)
    }
}

const setWindowStorage = () => {
    const localStorage = new MemoryStorage()
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { localStorage },
    })
    localStorage.setItem("visual-note:user", JSON.stringify({ id: "stale-user", email: "stale@example.com", name: "Stale" }))
    return localStorage
}

const setFetch = (sessionBody: unknown, workspaceBody: unknown = { workspace }) => {
    Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: async (input: RequestInfo | URL) => {
            const path = input.toString()
            if (path === "/api/auth/session") return Response.json(sessionBody)
            if (path === "/api/workspace") return Response.json(workspaceBody)
            return Response.json({ error: "Unexpected request." }, { status: 500 })
        },
    })
}

test("does not restore browser-stored users when app auth is unconfigured", async () => {
    setWindowStorage()
    setFetch({ authReady: false, user: null })

    const restored = await restoreVisualNoteSession("")

    assert.equal(restored.authStatus, "unconfigured")
    assert.equal(restored.user, null)
    assert.equal(restored.workspace, undefined)
})

test("does not restore browser-stored users without a server session", async () => {
    setWindowStorage()
    setFetch({ authReady: true, user: null })

    const restored = await restoreVisualNoteSession("")

    assert.equal(restored.authStatus, "ready")
    assert.equal(restored.user, null)
    assert.equal(restored.workspace, undefined)
})

test("restores workspace only for a valid Visual Note server session", async () => {
    setWindowStorage()
    setFetch({ authReady: true, user })

    const restored = await restoreVisualNoteSession("notebook-1")

    assert.equal(restored.authStatus, "ready")
    assert.deepEqual(restored.user, user)
    assert.equal(restored.workspace?.notebooks[0]?.id, "notebook-1")
    assert.equal(restored.selection?.viewId, "view-1")
})
