import type { SupabaseClient } from "@supabase/supabase-js"
import { hashPassword, hashToken, verifyPassword } from "./passwords"
import { createSessionToken, sessionExpiresAt } from "./session-cookie"

export type AppUser = {
    id: string
    email: string
    name: string
}

type UserRow = AppUser & {
    password_hash: string
}

const usersTable = "visual_note_users"
const sessionsTable = "visual_note_sessions"

const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const createAppUser = async (supabase: SupabaseClient, email: string, password: string, name: string) => {
    const passwordHash = await hashPassword(password)
    const { data, error } = await supabase
        .from(usersTable)
        .insert({ email: normalizeEmail(email), name: name.trim(), password_hash: passwordHash })
        .select("id,email,name")
        .single()

    if (error) throw error
    return data as AppUser
}

export const verifyAppUserCredentials = async (supabase: SupabaseClient, email: string, password: string) => {
    const { data, error } = await supabase.from(usersTable).select("id,email,name,password_hash").eq("email", normalizeEmail(email)).maybeSingle()
    if (error) throw error

    const user = data as UserRow | null
    if (!user || !(await verifyPassword(password, user.password_hash))) return null

    return { id: user.id, email: user.email, name: user.name }
}

export const createAppSession = async (supabase: SupabaseClient, userId: string) => {
    const token = createSessionToken()
    const { error } = await supabase.from(sessionsTable).insert({
        expires_at: sessionExpiresAt(),
        session_hash: hashToken(token),
        user_id: userId,
    })
    if (error) throw error

    return token
}

export const findUserBySessionToken = async (supabase: SupabaseClient, token: string) => {
    if (!token) return null

    const { data, error } = await supabase.from(sessionsTable).select("id,expires_at,visual_note_users(id,email,name)").eq("session_hash", hashToken(token)).maybeSingle()
    if (error) throw error

    const session = data as { expires_at: string; visual_note_users: AppUser | AppUser[] | null } | null
    if (!session || new Date(session.expires_at).getTime() <= Date.now()) return null

    return Array.isArray(session.visual_note_users) ? (session.visual_note_users[0] ?? null) : session.visual_note_users
}

export const revokeAppSession = async (supabase: SupabaseClient, token: string) => {
    if (!token) return

    await supabase.from(sessionsTable).delete().eq("session_hash", hashToken(token))
}
