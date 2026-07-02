import type { ToastTone } from "@/components/ui"
import { uploadNotebookImage } from "@/lib/visual-note/storage-api"

type PushToast = (title: string, description?: string, tone?: ToastTone) => void

export const uploadImageForNotebook = async (notebookId: string, file: File, pushToast: PushToast) => {
    if (!notebookId) throw new Error("Choose a notebook before uploading images.")

    const asset = await uploadNotebookImage(notebookId, file)
    pushToast("Image uploaded", asset.fileName)
    return { url: asset.url, alt: asset.fileName }
}
