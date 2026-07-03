type CreateMcpTokenBody = {
    name?: string
    scopes?: unknown
}

type McpTokenCreateParseResult =
    | {
          ok: true
          name: string
          scopes: unknown
      }
    | {
          ok: false
          error: string
          status: 400
      }

export const parseMcpTokenCreateRequest = async (request: Request): Promise<McpTokenCreateParseResult> => {
    const body = (await request.json().catch(() => null)) as CreateMcpTokenBody | null
    if (!body || Array.isArray(body)) return { ok: false, error: "Invalid request body.", status: 400 }

    const name = body.name?.trim?.() ?? ""
    const scopes: unknown = body.scopes ?? undefined

    if (body.scopes !== undefined && !Array.isArray(body.scopes)) return { ok: false, error: "Scopes must be an array when provided.", status: 400 }

    return {
        ok: true,
        name,
        scopes,
    }
}
