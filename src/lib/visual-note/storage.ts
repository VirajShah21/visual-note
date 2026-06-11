import type { VisualNoteWorkspace, VisualUser } from "./types"

const userKey = "visual-note:user"
const workspaceKey = (userId: string) => `visual-note:workspace:${userId}`

export const loadStoredUser = (): VisualUser | null => {
    if (typeof window === "undefined") return null

    const value = window.localStorage.getItem(userKey)
    if (!value) return null

    try {
        return JSON.parse(value) as VisualUser
    } catch {
        window.localStorage.removeItem(userKey)
        return null
    }
}

export const storeUser = (user: VisualUser) => {
    window.localStorage.setItem(userKey, JSON.stringify(user))
}

export const clearStoredUser = () => {
    window.localStorage.removeItem(userKey)
}

export const loadStoredWorkspace = (userId: string): VisualNoteWorkspace | null => {
    if (typeof window === "undefined") return null

    const value = window.localStorage.getItem(workspaceKey(userId))
    if (!value) return null

    try {
        return JSON.parse(value) as VisualNoteWorkspace
    } catch {
        window.localStorage.removeItem(workspaceKey(userId))
        return null
    }
}

export const storeWorkspace = (userId: string, workspace: VisualNoteWorkspace) => {
    window.localStorage.setItem(workspaceKey(userId), JSON.stringify(workspace))
}
