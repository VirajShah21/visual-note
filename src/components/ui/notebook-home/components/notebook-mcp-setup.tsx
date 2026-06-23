"use client"

import { CheckCircle2, Copy, KeyRound, PlugZap, Server, ShieldCheck, TerminalSquare } from "lucide-react"
import { motion } from "motion/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ChangeEvent, ReactNode } from "react"
import { Button } from "../../button"
import { TextField } from "../../form-controls"
import { Heading, Pill, Stack, Text } from "../../primitives"
import { createMcpToken, listMcpTokens, revokeMcpToken, type McpTokenRecord } from "@/lib/visual-note/mcp-token-api"
import styles from "../../notebook-home.module.css"

const endpoint = "/api/mcp"

const tools = ["list_notebooks", "read_notebook", "read_article", "replace_article_content", "create_article", "upsert_visual_block", "remove_visual_block"]

const clientConfig = `{
    "mcpServers": {
        "visual-note": {
            "url": "http://localhost:8000/api/mcp",
            "headers": {
                "Authorization": "Bearer <vn_mcp_token>"
            }
        }
    }
}`

const tokenUnavailableMessage = "MCP tokens require an active Visual Note session. Log in before creating a token."

export function NotebookMcpSetup({ tokensEnabled }: { tokensEnabled: boolean }) {
    const [tokenName, setTokenName] = useState("Codex")
    const [createdToken, setCreatedToken] = useState("")
    const [tokens, setTokens] = useState<McpTokenRecord[]>([])
    const [status, setStatus] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const activeTokens = useMemo(() => tokens.filter(token => !token.revokedAt), [tokens])

    const loadTokens = useCallback(async () => {
        if (!tokensEnabled) {
            setTokens([])
            setStatus(tokenUnavailableMessage)
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        try {
            setTokens(await listMcpTokens())
            setStatus("")
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Unable to load MCP tokens.")
        } finally {
            setIsLoading(false)
        }
    }, [tokensEnabled])
    const updateTokenName = useCallback((event: ChangeEvent<HTMLInputElement>) => setTokenName(event.target.value), [])
    const createToken = useCallback(async () => {
        if (!tokensEnabled) {
            setStatus(tokenUnavailableMessage)
            return
        }

        setIsCreating(true)
        try {
            const created = await createMcpToken(tokenName)
            setCreatedToken(created.token)
            setTokens(current => [created.record, ...current])
            setStatus("Copy this token now. It will not be shown again after you leave this page.")
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Unable to create MCP token.")
        } finally {
            setIsCreating(false)
        }
    }, [tokenName, tokensEnabled])

    useEffect(() => {
        void Promise.resolve().then(loadTokens)
    }, [loadTokens])

    return (
        <Stack gap="xl">
            <motion.header className={styles.mcpHeader}>
                <Stack gap="xs">
                    <Heading as="h1" size="hero">
                        MCP Setup
                    </Heading>
                    <Stack className={styles.statRow} direction="horizontal" gap="sm">
                        <Pill>
                            <TerminalSquare size={13} />
                            Streamable HTTP
                        </Pill>
                        <Pill>
                            <ShieldCheck size={13} />
                            Visual Note API tokens
                        </Pill>
                    </Stack>
                </Stack>
                <Text className={styles.mcpIntro}>
                    Connect Codex, Claude, Antigravity, or another MCP client to Visual Note so agents can read notebooks, update article content, and manage visual blocks through
                    the same workspace model used by the app.
                </Text>
            </motion.header>

            <section className={styles.mcpPanel}>
                <SetupSection icon={<KeyRound size={17} />} title="Create API tokens for agents">
                    <Stack gap="md">
                        <Stack direction="horizontal" gap="sm" className={styles.mcpTokenCreateRow}>
                            <TextField label="Token name" value={tokenName} onChange={updateTokenName} />
                            <Button variant="primary" onClick={createToken} disabled={!tokensEnabled || isCreating}>
                                Create token
                            </Button>
                        </Stack>
                        {createdToken ? <CodeBlock value={createdToken} /> : null}
                        {status ? <Text>{status}</Text> : null}
                        <TokenList tokens={activeTokens} isLoading={isLoading} onRevoke={loadTokens} />
                    </Stack>
                </SetupSection>

                <SetupSection icon={<Server size={17} />} title="1. Run Visual Note">
                    <InstructionList
                        items={[
                            "Start the app with npm run dev. The local server defaults to http://localhost:8000.",
                            `Use ${endpoint} as the MCP endpoint. The route is served inside this Next.js app with the Node.js runtime.`,
                            "MCP requires a Visual Note account session. External MCP callers authenticate with a Visual Note MCP token.",
                        ]}
                    />
                    <CodeBlock value="npm run dev" />
                </SetupSection>

                <SetupSection icon={<KeyRound size={17} />} title="2. Provide a Visual Note MCP token">
                    <InstructionList
                        items={[
                            "Create one token per agent client so each credential can be revoked independently.",
                            "Copy the token when it is created. Visual Note stores only a hash and cannot show the full token later.",
                            "Send every MCP request with Authorization: Bearer <vn_mcp_token>. Cross-user notebook and view ids return not_found.",
                        ]}
                    />
                    <CodeBlock value="Authorization: Bearer <vn_mcp_token>" />
                </SetupSection>

                <SetupSection icon={<PlugZap size={17} />} title="3. Add the MCP server to your agent client">
                    <InstructionList
                        items={[
                            "Add a Visual Note MCP server entry in the client that supports Streamable HTTP MCP servers.",
                            "Use the production app URL when connecting from a hosted agent. Use localhost only for a local agent running on this machine.",
                            "For browser-originated MCP clients, add each allowed origin to MCP_ALLOWED_ORIGINS as a comma-separated list.",
                        ]}
                    />
                    <CodeBlock value={clientConfig} />
                </SetupSection>

                <SetupSection icon={<CheckCircle2 size={17} />} title="4. Verify the exposed tools">
                    <InstructionList
                        items={["Ask the client to list MCP tools, then call list_notebooks. After that, read a notebook or create a test article before allowing broader edits."]}
                    />
                    <ToolGrid />
                </SetupSection>
            </section>
        </Stack>
    )
}

function TokenList({ tokens, isLoading, onRevoke }: { tokens: McpTokenRecord[]; isLoading: boolean; onRevoke: () => void }) {
    if (isLoading) return <Text>Loading MCP tokens...</Text>
    if (tokens.length === 0) return <Text>No active MCP tokens.</Text>

    return (
        <div className={styles.mcpTokenList}>
            {tokens.map(token => (
                <TokenRow key={token.id} token={token} onRevoke={onRevoke} />
            ))}
        </div>
    )
}

function TokenRow({ token, onRevoke }: { token: McpTokenRecord; onRevoke: () => void }) {
    const revokeToken = useCallback(async () => {
        await revokeMcpToken(token.id)
        onRevoke()
    }, [onRevoke, token.id])

    return (
        <div className={styles.mcpTokenRow}>
            <Stack gap="xs">
                <Text tone="strong">{token.name}</Text>
                <Text size="small">
                    {token.tokenPrefix}... · Created {new Date(token.createdAt).toLocaleDateString()} ·{" "}
                    {token.lastUsedAt ? `Last used ${new Date(token.lastUsedAt).toLocaleDateString()}` : "Never used"}
                </Text>
            </Stack>
            <Button variant="danger" onClick={revokeToken}>
                Revoke
            </Button>
        </div>
    )
}

function SetupSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <section className={styles.mcpSection}>
            <Stack direction="horizontal" gap="sm" className={styles.mcpSectionTitle}>
                <span className={styles.mcpSectionIcon}>{icon}</span>
                <Heading as="h2" size="md">
                    {title}
                </Heading>
            </Stack>
            <Stack gap="md">{children}</Stack>
        </section>
    )
}

function InstructionList({ items }: { items: string[] }) {
    return (
        <ol className={styles.mcpInstructionList}>
            {items.map(item => (
                <li key={item}>{item}</li>
            ))}
        </ol>
    )
}

function CodeBlock({ value }: { value: string }) {
    return (
        <pre className={styles.mcpCodeBlock}>
            <code>{value}</code>
            <Copy size={14} aria-hidden />
        </pre>
    )
}

function ToolGrid() {
    return (
        <div className={styles.mcpToolGrid}>
            {tools.map(tool => (
                <code key={tool}>{tool}</code>
            ))}
        </div>
    )
}
