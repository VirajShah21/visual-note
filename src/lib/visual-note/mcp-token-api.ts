import { authorizedStorageFetch } from "./storage-api"

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
    failedAttempts: number
    deniedAttempts: number
    lastAttemptAt: string | null
}

export type CreatedMcpToken = {
    token: string
    record: McpTokenRecord
}

const parseError = async (response: Response, fallback: string) => {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    return body?.error ?? fallback
}

export const listMcpTokens = async () => {
    const response = await authorizedStorageFetch("/api/mcp/tokens")
    if (!response.ok) throw new Error(await parseError(response, "Unable to load MCP tokens."))

    const body = (await response.json()) as { tokens: McpTokenRecord[] }
    return body.tokens
}

export const createMcpToken = async (name: string, scopes?: string[]) => {
    const response = await authorizedStorageFetch("/api/mcp/tokens", {
        method: "POST",
        body: JSON.stringify({ name, scopes }),
        headers: {
            "Content-Type": "application/json",
        },
    })
    if (!response.ok) throw new Error(await parseError(response, "Unable to create MCP token."))

    return (await response.json()) as CreatedMcpToken
}

export const revokeMcpToken = async (tokenId: string) => {
    const response = await authorizedStorageFetch(`/api/mcp/tokens/${encodeURIComponent(tokenId)}`, { method: "DELETE" })
    if (!response.ok) throw new Error(await parseError(response, "Unable to revoke MCP token."))
}
