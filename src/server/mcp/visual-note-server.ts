import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerVisualNoteMcpToolsPart1 } from "./visual-note-server-part1"
import { registerVisualNoteMcpToolsPart2 } from "./visual-note-server-part2"
import { registerVisualNoteMcpToolsPart3 } from "./visual-note-server-part3"
import { registerVisualNoteMcpToolsPart4 } from "./visual-note-server-part4"
import { registerVisualNoteMcpToolsPart5 } from "./visual-note-server-part5"
import { registerVisualNoteMcpToolsPart6 } from "./visual-note-server-part6"

export const registerVisualNoteMcpTools = (server: McpServer) => {
    registerVisualNoteMcpToolsPart1(server)
    registerVisualNoteMcpToolsPart2(server)
    registerVisualNoteMcpToolsPart3(server)
    registerVisualNoteMcpToolsPart4(server)
    registerVisualNoteMcpToolsPart5(server)
    registerVisualNoteMcpToolsPart6(server)
}
