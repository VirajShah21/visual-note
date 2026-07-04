import type { NotebookStorageSettingsInput } from "@/lib/visual-note/storage-settings"

type ParseResult =
    | {
          ok: true
          input: NotebookStorageSettingsInput
      }
    | {
          ok: false
          error: string
          status: 400
      }

export const validateStorageSettingsInput = (input: NotebookStorageSettingsInput) => {
    if (!input.connectionName?.trim()) return "Connection name is required."
    if (!input.region?.trim()) return "Region is required."
    if (!input.accessKeyId?.trim()) return "Access key ID is required."
    if (!input.connectionId && !input.secretAccessKey?.trim()) return "Secret access key is required."
    if (!input.bucketName?.trim()) return "Bucket name is required."

    return null
}

export const parseStorageSettingsRequest = async (request: Request): Promise<ParseResult> => {
    const input = (await request.json().catch(() => null)) as NotebookStorageSettingsInput | null

    if (!input || Array.isArray(input)) return { ok: false, error: "Invalid storage settings payload.", status: 400 }
    const error = validateStorageSettingsInput(input)
    if (error) return { ok: false, error, status: 400 }

    return {
        ok: true,
        input,
    }
}
