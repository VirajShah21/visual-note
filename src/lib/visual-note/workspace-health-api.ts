const parseError = async (response: Response, fallback: string) => {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    return body?.error ?? fallback
}

type WorkspaceHealthIssue = {
    severity: "warning" | "error"
    message: string
    scope: "notebook" | "page" | "topic" | "view"
    id: string
}

export type WorkspaceHealthCheckPayload = {
    notebookCount: number
    pageCount: number
    topicCount: number
    viewCount: number
    issues: WorkspaceHealthIssue[]
}

export type WorkspaceRepairPayload = {
    orphanPages: string[]
    orphanTopics: string[]
    orphanViews: string[]
    repaired: boolean
}

export const runWorkspaceHealthCheck = async (): Promise<WorkspaceHealthCheckPayload> => {
    const response = await fetch("/api/workspace/health")
    if (!response.ok) throw new Error(await parseError(response, "Unable to run workspace health check."))

    const body = (await response.json()) as { ok?: boolean; value?: WorkspaceHealthCheckPayload } | null
    if (!body || body.ok !== true || !body.value) throw new Error("Workspace health response was malformed.")
    return body.value
}

export const repairWorkspaceConsistency = async (): Promise<WorkspaceRepairPayload> => {
    const response = await fetch("/api/workspace/health", { method: "POST" })
    if (!response.ok) throw new Error(await parseError(response, "Unable to repair workspace consistency."))

    const body = (await response.json()) as { ok?: boolean; repaired?: boolean; orphanPages?: unknown; orphanTopics?: unknown; orphanViews?: unknown } | null
    if (!body || body.ok !== true) throw new Error("Workspace repair response was malformed.")

    const orphanPages = Array.isArray(body.orphanPages) ? body.orphanPages.filter((item): item is string => typeof item === "string") : []
    const orphanTopics = Array.isArray(body.orphanTopics) ? body.orphanTopics.filter((item): item is string => typeof item === "string") : []
    const orphanViews = Array.isArray(body.orphanViews) ? body.orphanViews.filter((item): item is string => typeof item === "string") : []

    return {
        orphanPages,
        orphanTopics,
        orphanViews,
        repaired: typeof body.repaired === "boolean" ? body.repaired : false,
    }
}
