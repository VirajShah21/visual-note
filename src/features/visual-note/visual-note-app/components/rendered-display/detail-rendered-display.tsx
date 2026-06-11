import { Bug, CheckCircle2, Code2, ExternalLink as ExternalLinkIcon, GitPullRequest, Layers3, LinkIcon, ShoppingCart, Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import { ExternalLink, Grid, Heading, MediaImage, Pill, Stack, Text } from "@/components/ui"
import type { DisplayInstance } from "@/lib/visual-note/types"
import { arrayFrom, objectArrayFrom, stringFrom } from "../../utils/visual-note-app.utils"
import styles from "../../../visual-note-app.module.css"

type DetailRenderedDisplayProps = {
    display: DisplayInstance
    editor: ReactNode
    displayHeader: (icon: ReactNode, action?: ReactNode) => ReactNode
}

export function DetailRenderedDisplay({ display, editor, displayHeader }: DetailRenderedDisplayProps) {
    const data = display.data

    if (display.kind === "bugs-list") return <BugsDisplay data={data} editor={editor} displayHeader={displayHeader} />
    if (display.kind === "shopping-list") return <ShoppingDisplay data={data} editor={editor} displayHeader={displayHeader} />
    if (display.kind === "pull-request") return <PullRequestDisplay data={data} editor={editor} displayHeader={displayHeader} />
    if (display.kind === "url") return <UrlDisplay data={data} editor={editor} displayHeader={displayHeader} />
    if (display.kind === "code-block") return <CodeDisplay data={data} editor={editor} displayHeader={displayHeader} />
    if (display.kind === "checklist") return <ChecklistDisplay data={data} editor={editor} displayHeader={displayHeader} />
    if (display.kind === "dashboard") return <DashboardDisplay data={data} editor={editor} displayHeader={displayHeader} />

    return <FallbackDisplay data={data} editor={editor} displayHeader={displayHeader} />
}

DetailRenderedDisplay.Header = function DetailRenderedDisplayHeader({ icon, title, kindLabel, action }: { icon: ReactNode; title: string; kindLabel: string; action?: ReactNode }) {
    return (
        <Stack className={styles.displayHeader} direction="horizontal" gap="sm">
            <Stack className={styles.displayTitleGroup} gap="xs">
                <Pill className={styles.displayKind}>
                    {icon}
                    {kindLabel}
                </Pill>
                <Heading size="sm">{title}</Heading>
            </Stack>
            {action ? <Stack className={styles.displayHeaderAction}>{action}</Stack> : null}
        </Stack>
    )
}

type DetailKindProps = {
    data: Record<string, unknown>
    editor: ReactNode
    displayHeader: DetailRenderedDisplayProps["displayHeader"]
}

function BugsDisplay({ data, editor, displayHeader }: DetailKindProps) {
    return (
        <Stack className={styles.displayFrame} gap="md">
            {displayHeader(<Bug size={13} />)}
            <Stack className={styles.refinedList} gap="sm">
                {objectArrayFrom(data.bugs).map(bug => {
                    const ticketUrl = stringFrom(bug.ticketUrl)

                    return (
                        <Stack key={`${bug.title}-${bug.severity}`} className={styles.refinedItem} gap="sm">
                            <Stack className={styles.itemHeader} direction="horizontal" gap="sm">
                                <Stack gap="xs">
                                    <Heading size="sm">{stringFrom(bug.title, "Bug")}</Heading>
                                    <Text size="small">Issue record</Text>
                                </Stack>
                                <Pill className={styles.statusPill}>
                                    <Bug size={13} />
                                    {stringFrom(bug.severity, "Untriaged")}
                                </Pill>
                            </Stack>
                            <Text>{stringFrom(bug.description, "No description provided.")}</Text>
                            <Stack className={styles.itemFooter} direction="horizontal" gap="sm">
                                {ticketUrl ? (
                                    <ExternalLink href={ticketUrl}>
                                        <ExternalLinkIcon size={14} />
                                        Issue or ticket
                                    </ExternalLink>
                                ) : null}
                            </Stack>
                        </Stack>
                    )
                })}
            </Stack>
            {editor}
        </Stack>
    )
}

function ShoppingDisplay({ data, editor, displayHeader }: DetailKindProps) {
    return (
        <Stack className={styles.displayFrame} gap="md">
            {displayHeader(<ShoppingCart size={13} />)}
            <Stack className={styles.refinedList} gap="sm">
                {objectArrayFrom(data.shoppingItems).map(item => {
                    const storeUrl = stringFrom(item.storeUrl)

                    return (
                        <Stack key={`${item.brand}-${item.product}-${item.modelVariant}`} className={styles.refinedItem} gap="sm">
                            <Stack className={styles.itemHeader} direction="horizontal" gap="sm">
                                <Stack gap="xs">
                                    <Heading size="sm">{stringFrom(item.product, "Product")}</Heading>
                                    <Text tone="strong">{stringFrom(item.brand, "Brand")}</Text>
                                </Stack>
                                <Pill>
                                    <ShoppingCart size={13} />
                                    {stringFrom(item.store, "Store")}
                                </Pill>
                            </Stack>
                            <Grid columns="two" gap="sm">
                                <DetailCell label="Variant" value={stringFrom(item.modelVariant, "Model or variant")} />
                                <DetailCell label="Location" value={stringFrom(item.storeLocation, "Store location")} />
                            </Grid>
                            <Stack className={styles.itemFooter} direction="horizontal" gap="sm">
                                {storeUrl ? (
                                    <ExternalLink href={storeUrl}>
                                        <ExternalLinkIcon size={14} />
                                        Store page
                                    </ExternalLink>
                                ) : null}
                            </Stack>
                        </Stack>
                    )
                })}
            </Stack>
            {editor}
        </Stack>
    )
}

function PullRequestDisplay({ data, editor, displayHeader }: DetailKindProps) {
    const action = stringFrom(data.prUrl) ? (
        <ExternalLink href={stringFrom(data.prUrl)}>
            <ExternalLinkIcon size={14} />
            Open pull request
        </ExternalLink>
    ) : null

    return (
        <Stack className={styles.displayFrame} gap="md">
            {displayHeader(<GitPullRequest size={13} />, action)}
            <Stack className={styles.heroPanel} gap="sm">
                <Pill>{stringFrom(data.prNumber, "PR")}</Pill>
                <Heading size="md">{stringFrom(data.title, "Pull request title")}</Heading>
                <Text>{stringFrom(data.description, "No pull request description provided.")}</Text>
            </Stack>
            <Grid columns="two" gap="sm">
                <DetailCell label="Author" value={stringFrom(data.author, "Unknown")} />
                <DetailCell label="Reviewer" value={stringFrom(data.reviewer, "Unassigned")} />
            </Grid>
            <Stack gap="sm">
                <Text size="small">Review notes</Text>
                <Stack direction="horizontal" gap="xs" className={styles.wrapRow}>
                    {arrayFrom(data.comments).map(comment => (
                        <Pill key={comment}>{comment}</Pill>
                    ))}
                </Stack>
            </Stack>
            {editor}
        </Stack>
    )
}

function UrlDisplay({ data, editor, displayHeader }: DetailKindProps) {
    const bannerImage = stringFrom(data.bannerImage) || stringFrom(data.socialPreviewImage)
    const favicon = stringFrom(data.favicon)

    return (
        <Stack className={styles.displayFrame} gap="md">
            {displayHeader(<LinkIcon size={13} />)}
            <Stack className={styles.urlPreview} gap="sm">
                {bannerImage ? <MediaImage className={styles.bannerImage} src={bannerImage} alt={stringFrom(data.pageTitle, "URL preview")} /> : null}
                <Stack className={styles.urlTitleRow} direction="horizontal" gap="sm">
                    {favicon ? <MediaImage className={styles.favicon} src={favicon} alt="" /> : <LinkIcon size={18} />}
                    <Heading size="md">{stringFrom(data.pageTitle, "Untitled page")}</Heading>
                </Stack>
                <Text>{stringFrom(data.pageDescription, "No page description provided.")}</Text>
            </Stack>
            <Stack gap="sm">
                <Stack direction="horizontal" gap="xs" className={styles.wrapRow}>
                    {arrayFrom(data.keywords).map(keyword => (
                        <Pill key={keyword}>{keyword}</Pill>
                    ))}
                </Stack>
                {stringFrom(data.url) ? (
                    <ExternalLink href={stringFrom(data.url)}>
                        <ExternalLinkIcon size={14} />
                        Open URL
                    </ExternalLink>
                ) : null}
            </Stack>
            {editor}
        </Stack>
    )
}

function CodeDisplay({ data, editor, displayHeader }: DetailKindProps) {
    return (
        <Stack className={styles.displayFrame} gap="md">
            {displayHeader(<Code2 size={13} />)}
            <Stack className={styles.codeSurface} gap="none">
                <Stack className={styles.codeToolbar} direction="horizontal" gap="sm">
                    <Pill>{stringFrom(data.language, "code")}</Pill>
                    {stringFrom(data.sourceUrl) ? (
                        <ExternalLink href={stringFrom(data.sourceUrl)}>
                            <ExternalLinkIcon size={14} />
                            Source
                        </ExternalLink>
                    ) : null}
                </Stack>
                <Text as="code" tone="code" className={styles.codeBlock}>
                    {stringFrom(data.code, "// Add code here")}
                </Text>
            </Stack>
            {editor}
        </Stack>
    )
}

function ChecklistDisplay({ data, editor, displayHeader }: DetailKindProps) {
    return (
        <Stack className={styles.displayFrame} gap="md">
            {displayHeader(<CheckCircle2 size={13} />)}
            <Stack className={styles.checklistItems} gap="xs">
                {arrayFrom(data.items).map(item => (
                    <Stack key={item} className={styles.checklistItem} direction="horizontal" gap="sm">
                        <CheckCircle2 size={16} />
                        <Text tone="strong">{item}</Text>
                    </Stack>
                ))}
            </Stack>
            {editor}
        </Stack>
    )
}

function DashboardDisplay({ data, editor, displayHeader }: DetailKindProps) {
    return (
        <Stack className={styles.displayFrame} gap="md">
            {displayHeader(<Layers3 size={13} />)}
            <Stack className={styles.dashboardSurface} gap="md">
                <Grid columns="auto" gap="sm">
                    {objectArrayFrom(data.metrics).map(metric => (
                        <Stack key={`${metric.label}-${metric.value}`} className={styles.metric} gap="xs">
                            <Text size="small">{String(metric.label ?? "Metric")}</Text>
                            <Heading size="md">{String(metric.value ?? "0")}</Heading>
                        </Stack>
                    ))}
                </Grid>
            </Stack>
            {editor}
        </Stack>
    )
}

function FallbackDisplay({ data, editor, displayHeader }: DetailKindProps) {
    return (
        <Stack className={styles.displayFrame} gap="md">
            {displayHeader(<Sparkles size={13} />)}
            <Stack className={styles.heroPanel} gap="sm">
                <Text tone="strong">{String(data.label ?? "Label")}</Text>
                <Heading size="md">{String(data.value ?? "Value")}</Heading>
            </Stack>
            <Stack className={styles.codeSurface} gap="none">
                <Stack className={styles.codeToolbar} direction="horizontal" gap="sm">
                    <Pill>JSON</Pill>
                </Stack>
                <Text as="code" tone="code" className={styles.dataPreview}>
                    {JSON.stringify(data, null, 2)}
                </Text>
            </Stack>
            {editor}
        </Stack>
    )
}

function DetailCell({ label, value }: { label: string; value: string }) {
    return (
        <Stack className={styles.detailCell} gap="xs">
            <Text size="small">{label}</Text>
            <Text tone="strong">{value}</Text>
        </Stack>
    )
}
