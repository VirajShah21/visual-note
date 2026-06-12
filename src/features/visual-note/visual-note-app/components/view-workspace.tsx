import { ArticleEditor, Card, Heading, Stack, Text } from "@/components/ui"
import type { ArticleWorkspaceProps, ViewWorkspaceProps } from "../types/visual-note-app.types"
import { stringFrom } from "../utils/visual-note-app.utils"
import styles from "../../visual-note-app.module.css"
import { RenderedDisplay } from "./rendered-display"
import { VisualBlockDisplay } from "./visual-block-display"

export function ViewWorkspace({ view, editorSettings, onUpdateView, onUpdateDisplay }: ViewWorkspaceProps) {
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
            <ArticleWorkspace view={view} editorSettings={editorSettings} onUpdateView={onUpdateView} onUpdateDisplay={onUpdateDisplay} />
        </Stack>
    )
}

export function ArticleWorkspace({ view, editorSettings, onUpdateView, onUpdateDisplay }: ArticleWorkspaceProps) {
    const isReaderMode = editorSettings.mode === "reader"

    return (
        <ArticleEditor
            value={stringFrom(view.content)}
            displays={view.displays}
            blockInfoMode={editorSettings.blockInfo}
            contentsMode={editorSettings.contents}
            editorMode={editorSettings.mode}
            readOnly={isReaderMode}
            onChange={content => onUpdateView({ ...view, content })}
            renderDisplay={display => <RenderedDisplay display={display} onUpdate={onUpdateDisplay} isReadOnly={isReaderMode} />}
            renderVisualBlock={(block, onDataChange) => (
                <VisualBlockDisplay
                    visualKind={block.visualKind}
                    data={block.data}
                    raw={block.raw}
                    parseError={block.parseError}
                    isReadOnly={isReaderMode}
                    onDataChange={onDataChange}
                />
            )}
        />
    )
}
