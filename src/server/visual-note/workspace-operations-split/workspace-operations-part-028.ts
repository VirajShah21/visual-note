import { generateTopicFromOutline } from "./workspace-operations-part-032"
import { workspacePolicyEngine } from "./workspace-operations-part-031"
import { publishPreflightMultiNotebook } from "./workspace-operations-part-019"
import { agenticContractCheck } from "./workspace-operations-part-017"
import { countScopeState, defaultWorkspacePolicyRules, findOwnedNotebook, findOwnedNotebookByTitle, scopedWorkspaceEntities } from "./workspace-operations-part-004"
import { parseOutlineSections } from "./workspace-operations-part-003"
import { cloneWorkspace, invalidInput, notFound, ok, PublishContractCheck, safeTrim, WorkspacePolicyRule } from "./workspace-operations-part-002"
import { ViewMode, VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-027"

export const agenticPolicySet = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        action: "list" | "validate" | "apply"
        notebookId?: string
        policyRules?: Array<
            Partial<WorkspacePolicyRule> & {
                id: string
                check: WorkspacePolicyRule["check"]
            }
        >
    },
) => {
    const normalizeRule = (rule: Partial<WorkspacePolicyRule> & { id: string; check: WorkspacePolicyRule["check"] }): WorkspacePolicyRule => ({
        id: safeTrim(rule.id),
        name: safeTrim(rule.name) || rule.id,
        severity: rule.severity === "high" || rule.severity === "low" || rule.severity === "medium" ? rule.severity : "medium",
        check: rule.check,
    })

    const resolvedRules = input.policyRules?.length ? input.policyRules.map(item => normalizeRule(item)).filter(item => item.id && item.check) : defaultWorkspacePolicyRules

    const result = workspacePolicyEngine(workspace, userId, {
        action: input.action,
        notebookId: input.notebookId,
        policyRules: resolvedRules,
    })

    if (!result.ok) return result

    if (input.action === "apply")
        return ok({
            action: "apply",
            applied: true,
            ruleCount: resolvedRules.length,
            note: "Policies are validated at runtime. No policy persistence layer yet.",
            result: result.value,
        })

    return result
}

export const agenticPublishReadinessGate = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookIds?: string[]; includeRecoveryPlan?: boolean; includePolicy?: boolean },
) => {
    const gate = publishPreflightMultiNotebook(workspace, userId, {
        notebookIds: input.notebookIds,
        includeRecoveryPlan: input.includeRecoveryPlan ?? false,
    })
    if (!gate.ok) return gate

    const targetNotebookIds = input.notebookIds?.length
        ? input.notebookIds.filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId).map(notebook => notebook.id)

    const contractChecks: Array<{
        notebookId: string
        passed: boolean
        blockers?: string[]
        contract?: unknown
        error?: string
    }> = []
    const contractErrors: string[] = []

    targetNotebookIds.forEach(notebookId => {
        const check = agenticContractCheck(workspace, userId, { notebookId, includePolicy: input.includePolicy })
        if (!check.ok) {
            contractErrors.push(check.message)
            contractChecks.push({ notebookId, passed: false, error: check.message })
            return
        }

        const checkValue = check.value as unknown as { passed: boolean; blockingChecks: PublishContractCheck[] }
        contractChecks.push({
            notebookId,
            passed: checkValue.passed,
            contract: check.value,
            blockers: checkValue.blockingChecks.filter((item: PublishContractCheck) => !item.passed).map((item: PublishContractCheck) => item.message),
        })
    })

    const blockers = [
        ...(!gate.value.canPublishAll ? ["Publish readiness gate reported blockers."] : []),
        ...contractChecks.filter(item => !item.passed).map(item => `Contract check failed for notebook ${item.notebookId}`),
        ...contractErrors,
    ]

    return ok({
        status: blockers.length === 0 ? "go" : "hold",
        publishReady: gate.value.canPublishAll,
        includeRecoveryPlan: gate.value.includeRecoveryPlan,
        results: gate.value,
        contractChecks,
        blockers,
    })
}

export const agenticStructuredIngestFromText = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        text: string
        notebookId?: string
        notebookTitle?: string
        pageId?: string
        pageTitle?: string
        topicMode?: ViewMode
        maxSections?: number
        maxViewsPerSection?: number
        apply?: boolean
        dryRun?: boolean
    },
) => {
    const text = safeTrim(input.text)
    if (!text) return invalidInput("text is required.")

    const apply = input.apply ?? false
    const dryRun = input.dryRun ?? false
    const targetNotebook = input.notebookId
        ? findOwnedNotebook(workspace, userId, input.notebookId)
        : input.notebookTitle
          ? findOwnedNotebookByTitle(workspace, userId, input.notebookTitle)
          : undefined

    if (!targetNotebook) return notFound("Notebook not found.")

    const normalized = {
        text,
        maxSections: Math.max(1, Math.min(input.maxSections ?? 12, 24)),
        maxViewsPerSection: Math.max(1, Math.min(input.maxViewsPerSection ?? 8, 24)),
    }
    const outline = parseOutlineSections(normalized.text)
        .slice(0, normalized.maxSections)
        .map(section => ({
            ...section,
            views: section.views.slice(0, normalized.maxViewsPerSection),
        }))

    if (outline.length === 0) return invalidInput("No outline could be parsed from text.")

    const generated = apply
        ? generateTopicFromOutline(workspace, userId, {
              notebookId: targetNotebook.id,
              pageId: input.pageId,
              pageTitle: input.pageTitle,
              outline: normalized.text,
              topicMode: input.topicMode,
          })
        : generateTopicFromOutline(cloneWorkspace(workspace), userId, {
              notebookId: targetNotebook.id,
              pageId: input.pageId,
              pageTitle: input.pageTitle,
              outline: normalized.text,
              topicMode: input.topicMode,
          })

    if (!generated.ok) return generated

    const createdCount = (generated.value.createdTopicIds?.length ?? 0) + (generated.value.createdViewIds?.length ?? 0)
    const before = countScopeState(scopedWorkspaceEntities(workspace, userId, targetNotebook.id))
    const after = countScopeState(scopedWorkspaceEntities(generated.value.workspace, userId, targetNotebook.id))

    if (!apply)
        return ok({
            mode: "preview",
            apply: false,
            dryRun,
            notebookId: targetNotebook.id,
            page: generated.value.page,
            parsed: {
                sectionCount: outline.length,
                viewCount: outline.reduce((sum, section) => sum + section.views.length, 0),
                previewCreated: createdCount,
                sections: outline.map(section => ({
                    title: section.title,
                    viewCount: section.views.length,
                })),
            },
            before,
            after,
        })

    return ok({
        mode: "applied",
        apply: true,
        dryRun,
        notebookId: targetNotebook.id,
        page: generated.value.page,
        workspace: generated.value.workspace,
        created: {
            sections: outline.length,
            topics: generated.value.createdTopicIds.length,
            views: generated.value.createdViewIds.length,
            total: createdCount,
        },
        before,
        after,
    })
}
