type SearchPageInput = {
    currentPageId?: string
    limit?: number
    offset?: number
    query: string
}

type SearchPageParseResult =
    | {
          ok: true
          input: SearchPageInput
      }
    | {
          ok: false
          error: string
          status: 400
      }

const parseNumber = (value: string | null) => {
    if (!value) return undefined

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    const rounded = Math.trunc(parsed)

    return Number.isNaN(rounded) ? null : rounded
}

const validateSearchInput = (query: string) => {
    if (typeof query !== "string") return "Invalid search query."
    if (query.length > 200) return "Search query is too long."

    return null
}

export const parseSearchRequest = (request: Request): SearchPageParseResult => {
    const url = new URL(request.url)
    const query = url.searchParams.get("q") ?? ""
    const validation = validateSearchInput(query)
    if (validation) return { ok: false, error: validation, status: 400 }

    const limit = parseNumber(url.searchParams.get("limit"))
    if (limit === null) return { ok: false, error: "limit must be a number.", status: 400 }

    const offset = parseNumber(url.searchParams.get("offset"))
    if (offset === null) return { ok: false, error: "offset must be a number.", status: 400 }

    return {
        ok: true,
        input: {
            currentPageId: url.searchParams.get("currentPageId") ?? undefined,
            query,
            limit,
            offset,
        },
    }
}
