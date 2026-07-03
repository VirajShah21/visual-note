import { validateUploadContentLength } from "@/server/storage/upload-validation"

type AssetUploadParseResult =
    | {
          ok: true
          file: File
      }
    | {
          ok: false
          error: string
          status: 400 | 413 | 415
      }

export const parseAssetUploadRequest = async (request: Request): Promise<AssetUploadParseResult> => {
    const contentLengthError = validateUploadContentLength(request)
    if (contentLengthError) return { ok: false, error: contentLengthError.message, status: contentLengthError.status }

    let formData: FormData
    try {
        formData = await request.formData()
    } catch {
        return { ok: false, error: "Invalid asset upload payload.", status: 400 }
    }

    const file = formData.get("file")
    if (!(file instanceof File)) return { ok: false, error: "Image file is required.", status: 400 }

    return { ok: true, file }
}
