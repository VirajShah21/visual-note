import { getSupabaseBrowserClient } from "./client"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

const tableName = "visual_note_workspaces"

export const loadSupabaseWorkspace = async (userId: string): Promise<VisualNoteWorkspace | null> => {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return null

  const { data, error } = await supabase.from(tableName).select("workspace").eq("user_id", userId).maybeSingle()
  if (error) return null

  return (data?.workspace as VisualNoteWorkspace | undefined) ?? null
}

export const saveSupabaseWorkspace = async (userId: string, workspace: VisualNoteWorkspace) => {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return

  await supabase.from(tableName).upsert({
    user_id: userId,
    workspace,
    updated_at: new Date().toISOString(),
  })
}
