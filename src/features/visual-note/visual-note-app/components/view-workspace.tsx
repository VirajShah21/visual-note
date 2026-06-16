import { ArticleEditor, Card, Heading, Stack, Text } from "@/components/ui"
import { useCallback } from "react"
import type { ArticleBlock } from "@/lib/visual-note/article-content"
import type { DisplayInstance } from "@/lib/visual-note/types"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"
import type { ArticleWorkspaceProps, ViewWorkspaceProps } from "../types/visual-note-app.types"
import { stringFrom } from "../utils/visual-note-app.utils"
import styles from "../../visual-note-app.module.css"
import { RenderedDisplay } from "./rendered-display"
import { VisualBlockDisplay } from "./visual-block-display"

export function ViewWorkspace({ view, editorSettings, onUpdateView, onUpdateDisplay, onUploadImage }: ViewWorkspaceProps) {
    if (!view)
        return (
            <Card className={styles.emptyCanvas}>
                <Stack gap="md">
                    <Heading>No article found</Heading>
                    <Text>This topic does not yet have an article view. Use actions to continue.</Text>
                </Stack>
            </Card>
        )

    return (
        <Stack className={styles.preview} gap="none">
            <ArticleWorkspace view={view} editorSettings={editorSettings} onUpdateView={onUpdateView} onUpdateDisplay={onUpdateDisplay} onUploadImage={onUploadImage} />
        </Stack>
    )
}

export function ArticleWorkspace({ view, editorSettings, onUpdateView, onUpdateDisplay, onUploadImage }: ArticleWorkspaceProps) {
    const isReaderMode = editorSettings.mode === "reader"
    const updateContent = useCallback((content: string) => onUpdateView({ ...view, content }), [onUpdateView, view])
    const renderDisplay = useCallback(
        (display: DisplayInstance) => <RenderedDisplay display={display} onUpdate={onUpdateDisplay} isReadOnly={isReaderMode} />,
        [isReaderMode, onUpdateDisplay],
    )
    const renderVisualBlock = useCallback(
        (block: Extract<ArticleBlock, { kind: "visual" }>, onDataChange: (data: VisualBlockData) => void) => (
            <VisualBlockDisplay
                visualKind={block.visualKind}
                data={block.data}
                raw={block.raw}
                parseError={block.parseError}
                isReadOnly={isReaderMode}
                onDataChange={onDataChange}
            />
        ),
        [isReaderMode],
    )

    return (
        <ArticleEditor
            value={stringFrom(view.content)}
            displays={view.displays}
            blockInfoMode={editorSettings.blockInfo}
            contentsMode={editorSettings.contents}
            editorMode={editorSettings.mode}
            readOnly={isReaderMode}
            onChange={updateContent}
            renderDisplay={renderDisplay}
            renderVisualBlock={renderVisualBlock}
            onUploadImage={onUploadImage}
        />
    )
}
