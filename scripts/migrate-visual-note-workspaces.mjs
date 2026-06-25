import { createExportDocument } from "../src/lib/visual-note/export/document.ts"
import { resolveExportAssets } from "../src/lib/visual-note/export/assets.ts"
import { renderMarkdownExport } from "../src/lib/visual-note/export/markdown.ts"
import { normalizeWorkspace } from "../src/lib/visual-note/factories.ts"
import { getSupabaseServiceRoleClient } from "../src/lib/supabase/server.ts"
import { makePageObjectKey, upsertPages } from "../src/server/visual-note/page-store.ts"
import { upsertNotebooks } from "../src/server/visual-note/notebook-store.ts"
import { readPageMarkdown, savePageMarkdown } from "../src/server/visual-note/page-content-store.ts"

const toString = value => String(value ?? "")

const pageSelection = (notebookId, pageId) => ({
    notebookId,
    pageId,
    topicId: "",
    viewId: "",
})

const serializePageMarkdown = async (workspace, pageId) => {
    const page = workspace.pages.find(item => item.id === pageId)
    if (!page) return ""

    const document = createExportDocument({
        scope: "page",
        selection: pageSelection(page.notebookId, page.id),
        workspace,
    })
    if (!document) return ""

    const context = await resolveExportAssets(document, "ignore")
    return renderMarkdownExport(document, {
        assetMode: "ignore",
        assetResolution: context,
    })
}

const loadCounts = async (supabase, userId) => {
    const { count: notebookCount, error: notebookCountError } = await supabase.from("visual_note_notebooks").select("id", { count: "exact", head: true }).eq("user_id", userId)

    const { count: pageCount, error: pageCountError } = await supabase.from("visual_note_pages").select("id", { count: "exact", head: true }).eq("user_id", userId)

    if (notebookCountError || pageCountError) throw new Error(notebookCountError?.message || pageCountError?.message)

    return { notebookCount: notebookCount ?? 0, pageCount: pageCount ?? 0 }
}

const summarizeSample = async (supabase, userId, workspace, samplePage) => {
    if (!samplePage) return null

    const expectedMarkdown = await serializePageMarkdown(workspace, samplePage.id)
    const expectedObjectKey = makePageObjectKey(samplePage.notebookId, samplePage.id)
    const { data: pageRow } = await supabase.from("visual_note_pages").select("id,notebook_id,content_object_key").eq("user_id", userId).eq("id", samplePage.id).maybeSingle()

    const actualMarkdown = await readPageMarkdown({ supabase, userId }, samplePage.id)

    return {
        pageId: samplePage.id,
        expectedMarkdownLength: expectedMarkdown.length,
        actualMarkdownLength: actualMarkdown?.length ?? 0,
        samplePageIdMatch: pageRow?.id === samplePage.id,
        sampleNotebookMatch: pageRow?.notebook_id === samplePage.notebookId,
        sampleObjectKeyMatch: pageRow?.content_object_key === expectedObjectKey,
        sampleContentMatch: expectedMarkdown === (actualMarkdown ?? ""),
        sampleObjectExists: actualMarkdown !== null,
    }
}

const migrateUserWorkspace = async (supabase, userId, workspaceRow) => {
    const workspace = normalizeWorkspace(workspaceRow ?? { notebooks: [], pages: [], topics: [], views: [] })
    const candidateNotebooks = workspace.notebooks.filter(notebook => notebook.userId === userId)
    const candidatePages = workspace.pages.filter(page => candidateNotebooks.some(notebook => notebook.id === page.notebookId))
    const contentChecks = {
        samples: [],
        attemptedWrites: 0,
        skippedWrites: 0,
        failedWrites: 0,
        errors: [],
    }

    await upsertNotebooks(supabase, userId, candidateNotebooks)

    for (const page of candidatePages) {
        const topics = workspace.topics.filter(topic => topic.pageId === page.id)
        const topicIds = new Set(topics.map(topic => topic.id))
        const views = workspace.views.filter(view => topicIds.has(view.topicId))
        const contentObjectKey = makePageObjectKey(page.notebookId, page.id)

        const { data: existing } = await supabase.from("visual_note_pages").select("content_object_key").eq("user_id", userId).eq("id", page.id).maybeSingle()

        await upsertPages(supabase, userId, [
            {
                page,
                notebookId: page.notebookId,
                topics,
                views,
                contentObjectKey,
            },
        ])

        if (existing?.content_object_key === contentObjectKey) {
            contentChecks.skippedWrites += 1
            continue
        }

        try {
            const markdown = await serializePageMarkdown(workspace, page.id)
            await savePageMarkdown({ supabase, userId }, { notebookId: page.notebookId, id: page.id }, markdown, contentObjectKey)
            contentChecks.attemptedWrites += 1
        } catch (error) {
            contentChecks.failedWrites += 1
            contentChecks.errors.push({
                pageId: page.id,
                notebookId: page.notebookId,
                message: error instanceof Error ? error.message : "Unable to save page markdown.",
            })
        }
    }

    const counts = await loadCounts(supabase, userId)
    const samplePage = candidatePages[0]
    if (samplePage) {
        const sampleCheck = await summarizeSample(supabase, userId, workspace, samplePage)
        if (sampleCheck) contentChecks.samples.push(sampleCheck)
    }

    return {
        userId,
        sourceNotebooks: candidateNotebooks.length,
        sourcePages: candidatePages.length,
        counts,
        contentChecks,
    }
}

const main = async () => {
    const supabase = getSupabaseServiceRoleClient()
    if (!supabase) throw new Error("Visual Note service role client is not configured.")

    const source = await supabase.from("visual_note_workspaces").select("user_id,workspace").order("user_id").throwOnError()
    const legacyRows = source.data ?? []
    const reports = []
    const failures = []

    for (const row of legacyRows) {
        const userId = toString(row.user_id)
        const result = await migrateUserWorkspace(supabase, userId, row.workspace)
        const counts = await loadCounts(supabase, userId)
        const sampleChecks = result.contentChecks.samples

        const report = {
            userId,
            sourceNotebooks: result.sourceNotebooks,
            sourcePages: result.sourcePages,
            targetNotebooks: counts.notebookCount,
            targetPages: counts.pageCount,
            countsParity: {
                notebookDelta: counts.notebookCount - result.sourceNotebooks,
                pageDelta: counts.pageCount - result.sourcePages,
            },
            markdownWrites: {
                attempted: result.contentChecks.attemptedWrites,
                skipped: result.contentChecks.skippedWrites,
                failed: result.contentChecks.failedWrites,
            },
            sampleContentChecks: sampleChecks,
            errors: result.contentChecks.errors,
        }

        if (result.sourceNotebooks !== counts.notebookCount || result.sourcePages !== counts.pageCount || result.contentChecks.failedWrites > 0)
            failures.push({
                userId,
                reason: result.contentChecks.failedWrites > 0 ? "markdown write failures occurred" : "page/notebook parity mismatch after migration",
                details: result.contentChecks.errors,
            })

        const sampleFailed = sampleChecks.some(
            check => !check.samplePageIdMatch || !check.sampleContentMatch || !check.sampleObjectKeyMatch || !check.sampleNotebookMatch || !check.sampleObjectExists,
        )
        if (sampleFailed)
            failures.push({
                userId,
                reason: "sample markdown parity check failed",
                details: sampleChecks,
            })

        reports.push(report)
    }

    console.log("MIGRATION REPORT")
    console.log(JSON.stringify(reports, null, 2))

    if (failures.length > 0) {
        console.log("MIGRATION WARNINGS")
        console.log(JSON.stringify(failures, null, 2))
        process.exit(1)
    }
}

await main()
