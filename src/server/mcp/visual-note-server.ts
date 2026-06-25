import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerVisualNoteCoreTools } from "./visual-note-tools"

export const registerVisualNoteMcpTools = (server: McpServer) => {
    registerVisualNoteCoreTools(server)
}
