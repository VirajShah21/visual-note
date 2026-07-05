import assert from "node:assert/strict"
import test from "node:test"
import { collectPrivateAssetIdsFromValue } from "./notebook-asset-cleanup"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

test("collects private asset references from article markdown and visual block data", () => {
    const workspace: VisualNoteWorkspace = {
        notebooks: [
            {
                id: "notebook-1",
                userId: "user-1",
                title: "Notebook",
                slug: "notebook",
                summary: "",
                color: "#000000",
                createdAt: "2026-07-02T00:00:00.000Z",
            },
        ],
        pages: [{ id: "page-1", notebookId: "notebook-1", title: "Page", position: 0 }],
        topics: [{ id: "topic-1", pageId: "page-1", title: "Topic", summary: "", position: 0 }],
        views: [
            {
                id: "view-1",
                topicId: "topic-1",
                title: "View",
                mode: "article",
                content: "![Hero](/api/assets/asset-1?download=1)",
                displays: [
                    {
                        id: "display-1",
                        name: "Image",
                        kind: "data-card",
                        data: { image: "/api/assets/asset-2#preview", nested: { url: "https://example.test/not-private" } },
                    },
                ],
            },
        ],
    }

    assert.deepEqual([...collectPrivateAssetIdsFromValue(workspace)].sort(), ["asset-1", "asset-2"])
})
