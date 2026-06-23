import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

const tableName = "visual_note_mcp_tokens"
const tokenPrefix = "vn_mcp_"
const defaultScopes = ["visual-note:mcp"]

export type McpTokenRecord = {
    id: string
    userId: string
    name: string
    tokenPrefix: string
    scopes: string[]
    lastUsedAt: string | null
    revokedAt: string | null
    expiresAt: string | null
    createdAt: string
}

export type VerifiedMcpToken = {
    tokenId: string
    userId: string
    scopes: string[]
}

type McpTokenRow = {
    id: string
    user_id: string
    name: string
    token_prefix: string
    token_hash?: string
    scopes: string[]
    last_used_at: string | null
    revoked_at: string | null
    expires_at: string | null
    created_at: string
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

const tokenHashesMatch = (candidateHash: string, storedHash: string) => {
    const candidate = Buffer.from(candidateHash, "hex")
    const stored = Buffer.from(storedHash, "hex")
    if (candidate.length !== stored.length) return false

    return timingSafeEqual(candidate, stored)
}

const mapTokenRow = (row: McpTokenRow): McpTokenRecord => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    scopes: row.scopes,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
})

export const createMcpToken = async (supabase: SupabaseClient, userId: string, name: string) => {
    const trimmedName = name.trim()
    const token = `${tokenPrefix}${randomBytes(32).toString("base64url")}`
    const tokenHash = hashToken(token)
    const displayPrefix = token.slice(0, 18)

    const { data, error } = await supabase
        .from(tableName)
        .insert({
            user_id: userId,
            name: trimmedName || "MCP client",
            token_prefix: displayPrefix,
            token_hash: tokenHash,
            scopes: defaultScopes,
        })
        .select("id,user_id,name,token_prefix,scopes,last_used_at,revoked_at,expires_at,created_at")
        .single()

    if (error) throw error

    return { token, record: mapTokenRow(data as McpTokenRow) }
}

export const listMcpTokens = async (supabase: SupabaseClient, userId: string) => {
    const { data, error } = await supabase
        .from(tableName)
        .select("id,user_id,name,token_prefix,scopes,last_used_at,revoked_at,expires_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

    if (error) throw error

    return ((data ?? []) as McpTokenRow[]).map(mapTokenRow)
}

export const revokeMcpToken = async (supabase: SupabaseClient, userId: string, tokenId: string) => {
    const { data, error } = await supabase
        .from(tableName)
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", tokenId)
        .eq("user_id", userId)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle()

    if (error) throw error

    return Boolean(data)
}

export const verifyMcpToken = async (supabase: SupabaseClient, token: string): Promise<VerifiedMcpToken | null> => {
    if (!token.startsWith(tokenPrefix)) return null

    const tokenHash = hashToken(token)
    const { data, error } = await supabase.from(tableName).select("id,user_id,token_hash,scopes,revoked_at,expires_at").eq("token_hash", tokenHash).maybeSingle()

    if (error || !data) return null

    const row = data as Pick<McpTokenRow, "id" | "user_id" | "token_hash" | "scopes" | "revoked_at" | "expires_at">
    if (!row.token_hash || !tokenHashesMatch(tokenHash, row.token_hash)) return null
    if (row.revoked_at) return null
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null

    await supabase.from(tableName).update({ last_used_at: new Date().toISOString() }).eq("id", row.id)

    return {
        tokenId: row.id,
        userId: row.user_id,
        scopes: row.scopes,
    }
}
