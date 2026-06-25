import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerVisualNoteMcpToolsPart4a } from "./visual-note-server-part4a"
import { registerVisualNoteMcpToolsPart4b } from "./visual-note-server-part4b"

export const registerVisualNoteMcpToolsPart4 = (server: McpServer) => {
    registerVisualNoteMcpToolsPart4a(server)
    registerVisualNoteMcpToolsPart4b(server)
}
