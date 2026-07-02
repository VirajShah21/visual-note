import assert from "node:assert/strict"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

const url = process.env.VISUAL_NOTE_MCP_URL
const token = process.env.VISUAL_NOTE_MCP_TOKEN
const expectedToolNames = ["list_notebooks", "read_notebook", "create_article", "read_article", "replace_article_content", "upsert_visual_block", "remove_visual_block"]

if (!url || !token) {
    console.error("Set VISUAL_NOTE_MCP_URL and VISUAL_NOTE_MCP_TOKEN to a Visual Note MCP API token before running the MCP smoke test.")
    process.exit(1)
}

const readJsonText = result => {
    const text = result.content?.find(item => item.type === "text")?.text
    assert.equal(typeof text, "string")
    return JSON.parse(text)
}

const client = new Client({ name: "visual-note-smoke", version: "0.1.0" })
const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    },
})

try {
    await client.connect(transport)
    const tools = await client.listTools()
    assert.deepEqual(tools.tools.map(tool => tool.name).sort(), [...expectedToolNames].sort())

    const notebooks = readJsonText(await client.callTool({ name: "list_notebooks", arguments: {} }))
    assert.equal(notebooks.ok, true)

    const notebookId = notebooks.notebooks[0]?.id
    if (!notebookId) {
        console.log("MCP smoke test connected and listed tools; no notebooks available for mutation cycle.")
        process.exit(0)
    }

    const created = readJsonText(
        await client.callTool({
            name: "create_article",
            arguments: {
                notebookId,
                pageTitle: "MCP Smoke",
                topicTitle: "Round trip",
                articleTitle: "Smoke article",
                content: "# MCP Smoke\n\nCreated by the smoke test.",
            },
        }),
    )
    assert.equal(created.ok, true)

    const visual = readJsonText(
        await client.callTool({
            name: "upsert_visual_block",
            arguments: {
                viewId: created.view.id,
                visualKind: "task-list",
                data: { title: "Smoke tasks", tasks: [{ title: "Verify MCP", done: false }] },
            },
        }),
    )
    assert.equal(visual.ok, true)

    const removed = readJsonText(await client.callTool({ name: "remove_visual_block", arguments: { viewId: created.view.id, blockIndex: visual.blockIndex } }))
    assert.equal(removed.ok, true)
    console.log("MCP smoke test completed.")
} finally {
    await client.close()
}
