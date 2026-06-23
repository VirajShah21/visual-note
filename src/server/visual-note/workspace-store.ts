import type { SupabaseClient } from "@supabase/supabase-js"
import type { AuthenticatedSupabaseContext } from "@/lib/supabase/server"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

const tableName = "visual_note_workspaces"

export const loadWorkspaceForUser = async ({ supabase, userId }: AuthenticatedSupabaseContext): Promise<VisualNoteWorkspace | null> => {
    const { data, error } = await supabase.from(tableName).select("workspace").eq("user_id", userId).maybeSingle()
    if (error) throw new Error(error.message)

    return (data?.workspace as VisualNoteWorkspace | undefined) ?? null
}

export const saveWorkspaceForUser = async (supabase: SupabaseClient, userId: string, workspace: VisualNoteWorkspace) => {
    const { error } = await supabase.from(tableName).upsert({
        user_id: userId,
        workspace,
        updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)

    return workspace
}
