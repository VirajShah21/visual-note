import type { SupabaseClient } from "@supabase/supabase-js"

const workspaceReadinessCode = "workspace_schema_not_ready"

const schemaChecks = [
    {
        columns: "id,user_id,title,slug,summary,color,published,published_at,editor_settings,created_at,updated_at",
        label: "visual_note_notebooks",
        table: "visual_note_notebooks",
    },
    {
        columns: "id,user_id,notebook_id,title,position,content_object_key,topics,views,created_at,updated_at",
        label: "visual_note_pages",
        table: "visual_note_pages",
    },
    {
        columns: "id,user_id,name,note,created_at,workspace",
        label: "visual_note_workspace_snapshots",
        table: "visual_note_workspace_snapshots",
    },
] as const

const schemaIssueMessage = (label: string, error: unknown) => {
    const message = error instanceof Error ? error.message : (error as { message?: string } | null)?.message
    if (message) return `${label}: ${message}`

    return `${label}: schema check failed`
}

const readinessError = (issues: string[]) => {
    const error = new Error(
        `Visual Note normalized workspace storage is not ready. Apply supabase/schema.sql and refresh the Supabase schema cache. Issues: ${issues.join("; ")}`,
    ) as Error & { code: string; issues: string[] }
    error.code = workspaceReadinessCode
    error.issues = issues
    return error
}

export const isWorkspaceReadinessError = (error: unknown) => (error as { code?: string } | null)?.code === workspaceReadinessCode

export const assertWorkspaceStoreReady = async (supabase: SupabaseClient) => {
    const issues: string[] = []

    for (const check of schemaChecks) {
        const { error } = await supabase.from(check.table).select(check.columns, { head: true }).limit(1)
        if (error) issues.push(schemaIssueMessage(check.label, error))
    }

    if (issues.length > 0) throw readinessError(issues)
}
