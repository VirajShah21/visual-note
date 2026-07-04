import type { SupabaseClient } from "@supabase/supabase-js"
import { hashPassword, hashToken, verifyPassword } from "./passwords"
import { createSessionToken, sessionExpiresAt } from "./session-cookie"

export type AppUser = {
    id: string
    email: string
    name: string
}

export type AppSession = {
    expiresAt: string
    user: AppUser
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
    await deleteExpiredAppSessions(supabase)

    const token = createSessionToken()
    const { error } = await supabase.from(sessionsTable).insert({
        expires_at: sessionExpiresAt(),
        session_hash: hashToken(token),
        user_id: userId,
    })
    if (error) throw error

    return token
}

export const findAppSessionByToken = async (supabase: SupabaseClient, token: string): Promise<AppSession | null> => {
    if (!token) return null

    const { data, error } = await supabase.from(sessionsTable).select("id,expires_at,visual_note_users(id,email,name)").eq("session_hash", hashToken(token)).maybeSingle()
    if (error) throw error

    const session = data as { expires_at: string; visual_note_users: AppUser | AppUser[] | null } | null
    if (!session) return null
    if (new Date(session.expires_at).getTime() <= Date.now()) {
        await revokeAppSession(supabase, token)
        return null
    }

    const user = Array.isArray(session.visual_note_users) ? (session.visual_note_users[0] ?? null) : session.visual_note_users
    return user ? { expiresAt: session.expires_at, user } : null
}

export const findUserBySessionToken = async (supabase: SupabaseClient, token: string) => {
    return (await findAppSessionByToken(supabase, token))?.user ?? null
}

export const revokeAppSession = async (supabase: SupabaseClient, token: string) => {
    if (!token) return

    await supabase.from(sessionsTable).delete().eq("session_hash", hashToken(token))
}

export const deleteExpiredAppSessions = async (supabase: SupabaseClient, now = new Date().toISOString()) => {
    const { error } = await supabase.from(sessionsTable).delete().lte("expires_at", now)
    if (error) throw error
}

export const rotateAppSession = async (supabase: SupabaseClient, currentToken: string, userId: string) => {
    const nextToken = await createAppSession(supabase, userId)
    await revokeAppSession(supabase, currentToken)
    return nextToken
}
