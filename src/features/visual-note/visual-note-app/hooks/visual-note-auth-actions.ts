import { loginVisualNoteUser, registerVisualNoteUser } from "@/lib/visual-note/auth-api"
import type { VisualUser } from "@/lib/visual-note/types"
import type { ToastTone } from "@/components/ui"

type AuthActionContext = {
    openWorkspaceForUser: (user: VisualUser) => Promise<void>
    pushToast: (title: string, description?: string, tone?: ToastTone) => void
    setNotice: (message: string) => void
}

export const signInVisualNoteUser = async (context: AuthActionContext, email: string, password: string) => {
    try {
        const user = await loginVisualNoteUser(email, password)
        await context.openWorkspaceForUser(user)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to log in."
        context.setNotice(message)
        context.pushToast("Login failed", message, "error")
    }
}

export const registerVisualNoteAccount = async (context: AuthActionContext, email: string, password: string, name: string) => {
    try {
        const user = await registerVisualNoteUser(email, password, name)
        await context.openWorkspaceForUser(user)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to register."
        context.setNotice(message)
        context.pushToast("Registration failed", message, "error")
    }
}
