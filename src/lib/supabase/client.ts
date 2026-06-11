import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type SupabaseStatus = "configured" | "demo"

let browserClient: SupabaseClient | null = null

const getSupabaseKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const getSupabaseStatus = (): SupabaseStatus => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabaseKey()) return "configured"

    return "demo"
}

export const getSupabaseBrowserClient = () => {
    if (getSupabaseStatus() === "demo") return null
    if (browserClient) return browserClient

    browserClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", getSupabaseKey() ?? "")
    return browserClient
}
