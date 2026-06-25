import { listMcpToolCapabilities } from "./workspace-operations-part-039"
import { collectIssueSummary } from "./workspace-operations-part-034"
import { applyChangePlanOperation } from "./workspace-operations-part-033"
import { agenticAutoRepair } from "./workspace-operations-part-021"
import { agenticObservationLog } from "./workspace-operations-part-020"
import { agenticContractCheck, assertWorkspaceInvariants } from "./workspace-operations-part-017"
import { countScopeState, findOwnedNotebook, scopedWorkspaceEntities, touchedFromInput } from "./workspace-operations-part-004"
import { tokenize } from "./workspace-operations-part-003"
import { cloneWorkspace, hasPassedContract, invalidInput, notFound, ok, PassableContractPayload, safeTrim } from "./workspace-operations-part-002"
import { VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-022"

type ContractEnforcerNotebookValue = {
    scope: "notebook"
    contract: PassableContractPayload
    policy?: PassableContractPayload
}

type ContractEnforcerMultiValue = {
    scope: string
    checks: Array<{ contract: PassableContractPayload; policy?: PassableContractPayload }>
}

export const agenticChangeSet = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { plan: Array<{ tool: string; input: Record<string, unknown> }>; notebookId?: string; maxSteps?: number },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan is required.")
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const operations = input.plan.slice(0, input.maxSteps ?? input.plan.length).map(operation => ({
        ...operation,
        input: operation.input ?? {},
    }))
    let nextWorkspace = cloneWorkspace(workspace)
    const scopeBefore = scopedWorkspaceEntities(nextWorkspace, userId, input.notebookId)
    const touched = new Set<string>()
    const stepResults: Array<{ step: number; tool: string; blocked: boolean; issueCount: number; warnings: string[]; touched: ReturnType<typeof touchedFromInput> }> = []
    for (let index = 0; index < operations.length; index += 1) {
        const operation = operations[index]
        const applied = applyChangePlanOperation(nextWorkspace, userId, operation)
        if (!applied.ok) return invalidInput(`Invalid operation at step ${index + 1}: ${operation.tool}. ${applied.message}`)

        nextWorkspace = applied.value.workspace
        const after = collectIssueSummary(nextWorkspace, userId)
        touched.add(`${operation.tool}:${index}`)
        const impacted = touchedFromInput(operation)
        Object.values(impacted).forEach(list => list.forEach(id => touched.add(id)))

        const warnings = after.blockers > 0 ? [`Step ${index + 1} left workspace with ${after.blockers} blocking issue(s).`] : []
        stepResults.push({
            step: index + 1,
            tool: operation.tool,
            blocked: warnings.length > 0,
            issueCount: after.blockers,
            warnings,
            touched: impacted,
        })
    }

    const scopeAfter = scopedWorkspaceEntities(nextWorkspace, userId, input.notebookId)
    const beforeCount = countScopeState(scopeBefore)
    const afterCount = countScopeState(scopeAfter)
    const added = {
        notebooks: Math.max(0, afterCount.notebooks - beforeCount.notebooks),
        pages: Math.max(0, afterCount.pages - beforeCount.pages),
        topics: Math.max(0, afterCount.topics - beforeCount.topics),
        views: Math.max(0, afterCount.views - beforeCount.views),
        displays: Math.max(0, afterCount.displays - beforeCount.displays),
    }
    const removed = {
        notebooks: Math.max(0, beforeCount.notebooks - afterCount.notebooks),
        pages: Math.max(0, beforeCount.pages - afterCount.pages),
        topics: Math.max(0, beforeCount.topics - afterCount.topics),
        views: Math.max(0, beforeCount.views - afterCount.views),
        displays: Math.max(0, beforeCount.displays - afterCount.displays),
    }

    return ok({
        dryRun: true,
        before: beforeCount,
        after: afterCount,
        added,
        removed,
        changed:
            added.notebooks + added.pages + added.topics + added.views + added.displays + removed.notebooks + removed.pages + removed.topics + removed.views + removed.displays,
        touchedEntityCount: touched.size,
        stepResults,
        plan: operations,
        workspace: nextWorkspace,
    })
}

export const agenticContractEnforcer = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includePolicy?: boolean; autoFix?: boolean }) => {
    const contract = agenticContractCheck(workspace, userId, { notebookId: input.notebookId, includePolicy: input.includePolicy ?? true })
    if (!contract.ok) return contract

    const contractValue = contract.value as ContractEnforcerNotebookValue | ContractEnforcerMultiValue
    const isNotebookContract = !("checks" in contractValue)
    const checks = isNotebookContract ? [contractValue] : contractValue.checks
    const passed = isNotebookContract
        ? hasPassedContract(contractValue.contract) && (contractValue.policy ? !("passed" in contractValue.policy) || hasPassedContract(contractValue.policy) : true)
        : checks.every(
              (item: { contract: PassableContractPayload; policy?: PassableContractPayload }) =>
                  hasPassedContract(item.contract) && (input.includePolicy ? !item.policy || !("passed" in item.policy) || hasPassedContract(item.policy) : true),
          )
    const invariant = assertWorkspaceInvariants(workspace, userId, { notebookId: input.notebookId })
    if (!invariant.ok) return invariant

    if (input.autoFix && !passed) {
        const repaired = agenticAutoRepair(workspace, userId, {
            notebookId: input.notebookId,
            includeDrift: true,
            dryRun: false,
        })
        if (!repaired.ok) return repaired
        const repairedWorkspace = repaired.value.workspace as VisualNoteWorkspace
        const refreshed = agenticContractCheck(repairedWorkspace, userId, { notebookId: input.notebookId, includePolicy: input.includePolicy ?? true })
        const refreshedValue = refreshed.ok ? (refreshed.value as ContractEnforcerNotebookValue | ContractEnforcerMultiValue) : null
        return ok({
            ...contract.value,
            passed: refreshedValue ? (!("checks" in refreshedValue) ? "passed" in refreshedValue.contract && refreshedValue.contract.passed : true) : passed,
            autoFixed: true,
            fixedWorkspace: repairedWorkspace,
            refreshed: refreshedValue,
            invariants: invariant.value,
        })
    }

    return ok({
        ...contract.value,
        passed,
        autoFixed: false,
        invariants: invariant.value,
    })
}

export const agenticToolSelector = (workspace: VisualNoteWorkspace, userId: string, input: { goal: string }) => {
    const goal = tokenize(safeTrim(input.goal)).map(word => word.toLowerCase())
    if (!goal.length) return invalidInput("goal is required.")

    const capabilities = listMcpToolCapabilities()
    if (!capabilities.ok) return capabilities
    const capability: string[] = capabilities.value.tools.map(item => item.name)
    if (!capability.includes("list_notebooks")) return invalidInput("Tool registry unavailable.")
    const suggestions: Array<{
        tool: string
        confidence: number
        reason: string
    }> = []

    if (goal.some(token => ["publish", "release", "ship"].includes(token))) {
        suggestions.push({ tool: "agentic_contract_enforcer", confidence: 0.9, reason: "Validate publish and policy constraints." })
        suggestions.push({ tool: "publish_diagnose", confidence: 0.85, reason: "Run publish readiness diagnostics." })
    }

    if (goal.some(token => ["structure", "organize", "restructure", "layout"].includes(token)))
        suggestions.push({ tool: "agentic_suggest_restructure", confidence: 0.82, reason: "Generate page/topic/view structure recommendations." })

    if (goal.some(token => ["reference", "link", "broken", "anchor"].includes(token)))
        suggestions.push({ tool: "agentic_reference_rewrite", confidence: 0.84, reason: "Inspect unresolved links and propose safe rewrites." })

    if (goal.some(token => ["repair", "fix", "recover", "heal"].includes(token)))
        suggestions.push({ tool: "agentic_auto_repair", confidence: 0.88, reason: "Run safe deterministic repair sequence." })

    if (goal.some(token => ["observe", "status", "health", "summary"].includes(token)))
        suggestions.push({ tool: "agentic_observe_workspace", confidence: 0.95, reason: "Return concise workspace health and risk summary." })

    if (goal.some(token => ["plan", "dry-run", "simulate", "forecast"].includes(token)))
        suggestions.push({ tool: "agentic_plan_dryrun", confidence: 0.9, reason: "Simulate impact of a proposed agent plan." })

    if (goal.some(token => ["guard", "risk", "safe", "constraints"].includes(token)))
        suggestions.push({ tool: "agentic_plan_guardrail", confidence: 0.87, reason: "Screen a plan against risk and policy before execution." })

    if (goal.some(token => ["execute", "perform", "carry", "do"].includes(token)))
        suggestions.push({ tool: "agentic_execute_with_sla", confidence: 0.85, reason: "Run a guarded execution path with SLA feedback." })

    if (goal.some(token => ["pipeline", "component", "dashboard", "display"].includes(token)))
        suggestions.push({ tool: "agentic_component_pipeline", confidence: 0.8, reason: "Run schema-aware component and layout transitions." })

    if (goal.some(token => ["change", "set", "diff", "preview"].includes(token)))
        suggestions.push({ tool: "agentic_change_set", confidence: 0.86, reason: "Show projected change set before mutation." })

    if (!suggestions.length) suggestions.push({ tool: "agentic_intent_to_plan", confidence: 0.71, reason: "Default conversion from goal to executable plan." })

    return ok({
        query: safeTrim(input.goal),
        suggestions,
        fallbackTools: ["read_workspace", "analyze_workspace_gaps", "list_notebooks"].filter(tool => capability.includes(tool)),
    })
}

export const agenticObservationQuery = (workspace: VisualNoteWorkspace, userId: string, input: { status?: "ok" | "warning" | "failed"; goal?: string; maxItems?: number }) =>
    agenticObservationLog(workspace, userId, {
        action: "read",
        status: input.status,
        goal: input.goal,
        maxItems: input.maxItems,
    })
