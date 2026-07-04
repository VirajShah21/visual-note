import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

const tableName = "visual_note_mcp_tokens"
const auditTableName = "visual_note_mcp_audit_events"
const tokenPrefix = "vn_mcp_"
export const mcpScopeRead = "visual-note:mcp:read"
export const mcpScopeWrite = "visual-note:mcp:write"
export const legacyMcpScope = "visual-note:mcp"

export const allMcpScopes = [mcpScopeRead, mcpScopeWrite] as const
export type McpTokenScope = (typeof allMcpScopes)[number]
export type RequestedMcpTokenScope = McpTokenScope | typeof legacyMcpScope

export class InvalidMcpScopeError extends Error {
    constructor() {
        super(`MCP token scopes must include at least one valid scope: ${allMcpScopes.join(", ")}`)
        this.name = "InvalidMcpScopeError"
    }
}

type McpAuditAction = {
    tokenId: string
    userId: string
    toolName: string
    scopeRequired: readonly McpTokenScope[]
    scopeSatisfied: readonly McpTokenScope[]
    success: boolean
    denialReason?: string | null
}

type McpTokenRow = {
    id: string
    user_id: string
    name: string
    token_prefix: string
    token_hash?: string
    scopes?: unknown
    last_used_at: string | null
    revoked_at: string | null
    expires_at: string | null
    created_at: string
}

type McpTokenAuditSummary = {
    failedAttempts: number
    deniedAttempts: number
    lastAttemptAt: string | null
}

const normalizeMcpScopes = (input: string[]): McpTokenScope[] => {
    const includesLegacy = input.includes(legacyMcpScope)
    if (includesLegacy) return [...allMcpScopes]

    const unique = [...new Set(input)]
    return unique.filter((scope): scope is McpTokenScope => allMcpScopes.includes(scope as McpTokenScope))
}

const validateRequestedScopes = (input: string[] | undefined): McpTokenScope[] => {
    if (!input) return [...allMcpScopes]

    const hasLegacy = input.includes(legacyMcpScope)
    const hasInvalidScope = input.some(scope => !allMcpScopes.includes(scope as McpTokenScope) && scope !== legacyMcpScope)
    const normalized = normalizeMcpScopes(input)

    if (hasInvalidScope) throw new InvalidMcpScopeError()
    if (hasLegacy) return [...allMcpScopes]
    if (normalized.length === 0) throw new InvalidMcpScopeError()

    return [...normalized]
}

const parseStoredMcpScopes = (scopes: unknown): McpTokenScope[] | null => {
    if (!Array.isArray(scopes)) return null

    const normalized = normalizeMcpScopes(scopes.map(value => String(value)))
    if (normalized.length === 0) return null

    return [...normalized]
}

export const normalizeScopeSet = (scopes: unknown, fallback: readonly McpTokenScope[] = allMcpScopes): McpTokenScope[] => {
    if (!Array.isArray(scopes)) return [...fallback]
    return normalizeMcpScopes(scopes.map(value => String(value)))
}

export type McpTokenRecord = {
    id: string
    userId: string
    name: string
    tokenPrefix: string
    scopes: McpTokenScope[]
    lastUsedAt: string | null
    revokedAt: string | null
    expiresAt: string | null
    createdAt: string
    failedAttempts: number
    deniedAttempts: number
    lastAttemptAt: string | null
}

export type VerifiedMcpToken = {
    tokenId: string
    userId: string
    scopes: McpTokenScope[]
}

export const validateAndNormalizeMcpScopes = (scopes: unknown): McpTokenScope[] => {
    if (scopes === undefined) return [...allMcpScopes]
    if (!Array.isArray(scopes)) throw new InvalidMcpScopeError()

    return validateRequestedScopes(scopes.filter((scope): scope is string => typeof scope === "string"))
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

const tokenHashesMatch = (candidateHash: string, storedHash: string) => {
    const candidate = Buffer.from(candidateHash, "hex")
    const stored = Buffer.from(storedHash, "hex")
    if (candidate.length !== stored.length) return false

    return timingSafeEqual(candidate, stored)
}

const mapTokenRow = (row: McpTokenRow): McpTokenRecord => {
    const normalizedScopes = parseStoredMcpScopes(row.scopes) ?? []

    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        tokenPrefix: row.token_prefix,
        scopes: normalizedScopes,
        lastUsedAt: row.last_used_at,
        revokedAt: row.revoked_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        failedAttempts: 0,
        deniedAttempts: 0,
        lastAttemptAt: null,
    }
}

const loadMcpAuditSummary = async (supabase: SupabaseClient, userId: string, tokenId: string): Promise<McpTokenAuditSummary | null> => {
    const failedQuery = supabase.from(auditTableName).select("id", { count: "exact", head: true }).eq("user_id", userId).eq("token_id", tokenId).eq("success", false)
    const deniedQuery = supabase
        .from(auditTableName)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("token_id", tokenId)
        .eq("success", false)
        .like("denial_reason", "missing_scope:%")
    const latestQuery = supabase
        .from(auditTableName)
        .select("created_at")
        .eq("user_id", userId)
        .eq("token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    const [failed, denied, latest] = await Promise.all([failedQuery, deniedQuery, latestQuery])
    if (failed.error || denied.error || latest.error) return null

    return {
        failedAttempts: failed.count ?? 0,
        deniedAttempts: denied.count ?? 0,
        lastAttemptAt: typeof latest.data?.created_at === "string" ? latest.data.created_at : null,
    }
}

export const createMcpToken = async (supabase: SupabaseClient, userId: string, name: string, scopes?: RequestedMcpTokenScope[]) => {
    const trimmedName = name.trim()
    const token = `${tokenPrefix}${randomBytes(32).toString("base64url")}`
    const tokenHash = hashToken(token)
    const displayPrefix = token.slice(0, 18)
    const normalizedScopes = validateRequestedScopes(scopes)

    const { data, error } = await supabase
        .from(tableName)
        .insert({
            user_id: userId,
            name: trimmedName || "MCP client",
            token_prefix: displayPrefix,
            token_hash: tokenHash,
            scopes: normalizedScopes,
        })
        .select("id,user_id,name,token_prefix,scopes,last_used_at,revoked_at,expires_at,created_at")
        .single()

    if (error) throw error

    return { token, record: mapTokenRow(data as McpTokenRow) }
}

export const listMcpTokens = async (supabase: SupabaseClient, userId: string) => {
    const { data: rawTokens, error } = await supabase
        .from(tableName)
        .select("id,user_id,name,token_prefix,scopes,last_used_at,revoked_at,expires_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

    if (error) throw error

    const tokens = (rawTokens ?? []).map((row: unknown) => mapTokenRow(row as McpTokenRow))

    const summaries = await Promise.all(tokens.map(token => loadMcpAuditSummary(supabase, userId, token.id)))

    return tokens.map((token, index) => {
        const summary = summaries[index]
        if (!summary) return token

        return {
            ...token,
            failedAttempts: summary.failedAttempts,
            deniedAttempts: summary.deniedAttempts,
            lastAttemptAt: summary.lastAttemptAt,
        }
    })
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

    const scopes = parseStoredMcpScopes(row.scopes)
    if (!scopes) return null

    await supabase.from(tableName).update({ last_used_at: new Date().toISOString() }).eq("id", row.id)

    return {
        tokenId: row.id,
        userId: row.user_id,
        scopes,
    }
}

export const logMcpToolAudit = async (supabase: SupabaseClient, event: McpAuditAction) => {
    await supabase.from(auditTableName).insert({
        token_id: event.tokenId,
        user_id: event.userId,
        tool_name: event.toolName,
        scope_required: event.scopeRequired,
        scope_satisfied: event.scopeSatisfied,
        success: event.success,
        denial_reason: event.denialReason ?? null,
    })
}
