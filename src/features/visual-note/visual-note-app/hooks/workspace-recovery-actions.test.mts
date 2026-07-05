import assert from "node:assert/strict"
import test from "node:test"
import type { WorkspaceRecoveryState } from "./use-visual-note-workspace-autosave"
import { retryWorkspaceRecovery } from "./workspace-recovery-actions"

const makeRecoveryState = (message = "", status: WorkspaceRecoveryState["status"] = "error"): WorkspaceRecoveryState => ({
    message,
    status,
})

test("reloads workspace when revision is missing before retrying save", async () => {
    let openWorkspaceForUserCount = 0
    let setRecoveryCount = 0
    let setNoticeCount = 0

    await retryWorkspaceRecovery({
        hasActiveSaveErrorRef: { current: false },
        openWorkspaceForUser: async () => {
            openWorkspaceForUserCount += 1
        },
        pushToast: () => {},
        setNotice: () => {
            setNoticeCount += 1
        },
        setWorkspaceRecovery: state => {
            setRecoveryCount += 1
            assert.equal(state.status, "error")
            assert.equal(state.message, "Workspace revision is missing. Reloading workspace before retrying save.")
        },
        setWorkspaceRevision: () => {},
        syncedWorkspaceRef: { current: "{}" },
        user: { id: "user-1", email: "u@example.com", name: "U" },
        workspace: null,
        workspaceRecovery: makeRecoveryState("", "error"),
        workspaceRevision: null,
    })

    assert.equal(openWorkspaceForUserCount, 1)
    assert.equal(setRecoveryCount, 1)
    assert.equal(setNoticeCount, 1)
})
