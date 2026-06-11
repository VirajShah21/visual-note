import { VisualNoteApp } from "@/features/visual-note/visual-note-app"

type NotebookPageProps = {
  searchParams: Promise<{ id?: string | string[] }>
}

export default async function NotebookPage({ searchParams }: NotebookPageProps) {
  const params = await searchParams
  const notebookId = Array.isArray(params.id) ? params.id[0] : params.id

  return <VisualNoteApp mode="notebook" initialNotebookId={notebookId ?? ""} />
}
