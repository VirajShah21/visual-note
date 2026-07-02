import { ArticleBlock, defaultVisualBlockData, serializeVisualBlockBody, VisualBlockData, VisualBlockKind } from "./types"

export const createVisualArticleBlock = (visualKind: VisualBlockKind, data: VisualBlockData): Extract<ArticleBlock, { kind: "visual" }> => {
    const mergedData = { ...defaultVisualBlockData(visualKind), ...data }
    return {
        kind: "visual",
        visualKind,
        data: mergedData,
        raw: serializeVisualBlockBody(mergedData),
    }
}
