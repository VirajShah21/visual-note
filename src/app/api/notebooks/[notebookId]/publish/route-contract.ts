export type PublishAction = "preview" | "publish" | "unpublish"

type PublishRequestInput = {
    action: PublishAction
    revision?: string
    includeHtml?: boolean
    includeJson?: boolean
}

type PublishParseResult =
    | {
          ok: true
          input: PublishRequestInput
      }
    | {
          ok: false
          error: string
          status: 400
      }

export const parsePublishRequest = async (request: Request): Promise<PublishParseResult> => {
    const input = (await request.json().catch(() => null)) as PublishRequestInput | null
    if (!input || Array.isArray(input)) return { ok: false, error: "Invalid publish request body.", status: 400 }

    const action = input.action
    if (action !== "preview" && action !== "publish" && action !== "unpublish") return { ok: false, error: "action must be preview, publish, or unpublish.", status: 400 }

    if (action !== "preview")
        if (typeof input.revision !== "string" || !input.revision.trim()) return { ok: false, error: "revision is required for publish and unpublish actions.", status: 400 }

    if (input.includeHtml !== undefined && typeof input.includeHtml !== "boolean") return { ok: false, error: "includeHtml must be a boolean.", status: 400 }

    if (input.includeJson !== undefined && typeof input.includeJson !== "boolean") return { ok: false, error: "includeJson must be a boolean.", status: 400 }

    return {
        ok: true,
        input: {
            action,
            revision: action === "preview" ? undefined : input.revision,
            includeHtml: input.includeHtml === true,
            includeJson: input.includeJson === true,
        },
    }
}
