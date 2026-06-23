export type RegisteredVisualNoteUser = {
    id: string
    email: string
    name: string
}

export type VisualNoteSessionResponse = {
    authReady: boolean
    user: RegisteredVisualNoteUser | null
}

const readError = async (response: Response, fallback: string) => {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    return body?.error ?? fallback
}

export const registerVisualNoteUser = async (email: string, password: string, name: string) => {
    const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, name, password }),
    })

    if (!response.ok) {
        const message = await readError(response, "Unable to register account.")
        throw new Error(message)
    }

    const body = (await response.json()) as { user: RegisteredVisualNoteUser }
    return body.user
}

export const loginVisualNoteUser = async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
        const message = await readError(response, "Unable to log in.")
        throw new Error(message)
    }

    const body = (await response.json()) as { user: RegisteredVisualNoteUser }
    return body.user
}

export const loadCurrentVisualNoteSession = async () => {
    const response = await fetch("/api/auth/session")
    if (!response.ok) return { authReady: false, user: null }

    return (await response.json()) as VisualNoteSessionResponse
}

export const logoutVisualNoteUser = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
}
