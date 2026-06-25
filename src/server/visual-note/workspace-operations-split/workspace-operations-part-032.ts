import { addDisplayToView } from "./workspace-operations-part-010"
import { changeViewMode } from "./workspace-operations-part-009"
import { createView } from "./workspace-operations-part-008"
import { createPage, createTopic } from "./workspace-operations-part-007"
import { findOwnedView } from "./workspace-operations-part-005"
import { findOwnedPage } from "./workspace-operations-part-004"
import { displayKindForMode, estimateRenderComplexity, parseOutlineSections } from "./workspace-operations-part-003"
import { cloneWorkspace, invalidInput, notFound, ok, safeTrim } from "./workspace-operations-part-002"
import { LayoutSuggestion, parseArticleContent, ViewMode, VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-031"

export const generateTopicFromOutline = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        notebookId: string
        pageId?: string
        pageTitle?: string
        outline: string
        topicMode?: ViewMode
    },
) => {
    if (!safeTrim(input.outline)) return invalidInput("outline is required.")

    const sections = parseOutlineSections(safeTrim(input.outline))
    if (sections.length === 0) return invalidInput("outline did not contain valid topics or views.")

    let nextWorkspace = workspace
    const pageResult = input.pageId
        ? findOwnedPage(workspace, userId, input.pageId)
        : input.pageTitle
          ? createPage(cloneWorkspace(workspace), userId, {
                notebookId: input.notebookId,
                title: safeTrim(input.pageTitle),
            })
          : undefined

    if (!pageResult) return notFound("Target page not found.")
    if ("ok" in pageResult) {
        if (!pageResult.ok) return pageResult
        nextWorkspace = pageResult.value.workspace
    }
    const page = "ok" in pageResult ? pageResult.value.page : pageResult.page

    if (!page) return notFound("Target page not found.")

    const createdTopicIds: string[] = []
    const createdViewIds: string[] = []
    const mode: ViewMode = input.topicMode ?? "article"

    sections.forEach((section, sectionIndex) => {
        const topicResult = createTopic(nextWorkspace, userId, {
            pageId: page.id,
            title: section.title || `Section ${sectionIndex + 1}`,
            position: sectionIndex,
        })
        if (!topicResult.ok) return
        nextWorkspace = topicResult.value.workspace
        createdTopicIds.push(topicResult.value.topic.id)

        const topic = topicResult.value.topic
        const views = section.views.length > 0 ? section.views : ["Overview"]
        views.forEach((viewTitle, viewIndex) => {
            const viewResult = createView(nextWorkspace, userId, {
                topicId: topic.id,
                title: viewTitle,
                mode,
                position: viewIndex,
                content: `# ${viewTitle}`,
            })
            if (!viewResult.ok) return
            nextWorkspace = viewResult.value.workspace
            createdViewIds.push(viewResult.value.view.id)
        })
    })

    return ok({
        page,
        createdTopicIds,
        createdViewIds,
        created: createdTopicIds.length + createdViewIds.length,
        workspace: nextWorkspace,
    })
}

export const suggestLayoutForViewMode = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; preferredMode?: ViewMode }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    const mode = input.preferredMode ?? (context.view.displays.length > 2 || parsed.headings.length > 4 ? "structured" : context.view.mode)
    const reasons: string[] = []

    if (context.view.displays.length > 2) reasons.push("This view already has multiple structured displays.")
    if (parsed.headings.length > 4) reasons.push("Multiple headings suggest a structured outline layout.")
    if (!context.view.displays.length && parsed.blocks.length > 10 && mode !== "article") reasons.push("No displays present, so add display components first.")

    const suggestion: LayoutSuggestion = {
        mode,
        reason: reasons.join(" ") || "Current layout is sufficient for current content.",
        addedDisplays: mode === "dashboard" ? ["dashboard"] : [displayKindForMode(mode)],
        changed: mode !== context.view.mode,
    }

    return ok({
        ...suggestion,
        viewId: context.view.id,
        currentMode: context.view.mode,
        estimatedImpact: {
            additionalDisplays: suggestion.addedDisplays.length,
            blocks: parsed.blocks.length,
            headings: parsed.headings.length,
        },
    })
}

export const rewriteViewLayoutForMode = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; mode: ViewMode; addRecommendedDisplays?: boolean }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const updatedMode = changeViewMode(workspace, userId, { viewId: context.view.id, mode: input.mode, keepContent: true })
    if (!updatedMode.ok) return updatedMode

    let nextWorkspace = updatedMode.value.workspace

    if (input.addRecommendedDisplays && nextWorkspace.views.find(view => view.id === context.view.id)?.displays.length === 0) {
        const recommended = addDisplayToView(nextWorkspace, userId, {
            viewId: context.view.id,
            kind: displayKindForMode(input.mode),
            name: `${input.mode} summary`,
            data: { title: `${context.view.title} ${input.mode}` },
        })
        if (!recommended.ok) return recommended
        nextWorkspace = recommended.value.workspace
    }

    const finalView = nextWorkspace.views.find(view => view.id === context.view.id)
    if (!finalView) return notFound("View not found after rewrite.")

    return ok({
        workspace: nextWorkspace,
        view: finalView,
        suggestionApplied: true,
        changed: finalView.mode !== context.view.mode,
        addedRecommendedDisplay: input.addRecommendedDisplays ?? false,
    })
}

export const previewRenderProfile = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    const profile = {
        viewId: context.view.id,
        blockCount: parsed.blocks.length,
        headingCount: parsed.headings.length,
        displayCount: context.view.displays.length,
        visualBlockCount: parsed.blocks.filter(block => block.kind === "visual").length,
        rawLength: context.view.content.length,
    }
    const next = estimateRenderComplexity(profile)

    return ok({
        ...profile,
        estimatedComplexity: next.estimatedComplexity,
        estimatedRenderCost: next.estimatedRenderCost,
        warnings: profile.blockCount === 0 ? ["The view is empty."] : profile.visualBlockCount > 2 ? ["High visual-block density may increase parse/serialize cost."] : [],
    })
}
