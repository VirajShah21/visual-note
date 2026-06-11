"use client"

import { Sparkles } from "lucide-react"
import { useState } from "react"
import { Button, Card, Grid, Heading, InfoPopover, Pill, Stack, Text, TextField } from "@/components/ui"
import type { AuthPanelProps } from "../types/visual-note-app.types"
import styles from "../../visual-note-app.module.css"

export function AuthPanel({ notice, supabaseStatus, onSignIn, onRegister }: AuthPanelProps) {
    const [mode, setMode] = useState<"login" | "register">("register")
    const [email, setEmail] = useState("viraj@example.com")
    const [name, setName] = useState("Viraj")
    const [password, setPassword] = useState("visual-note-demo")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const submit = async () => {
        setIsSubmitting(true)
        if (mode === "register") await onRegister(email, password, name)
        else await onSignIn(email, password, name)
        setIsSubmitting(false)
    }

    return (
        <Grid className={`${styles.app} ${styles.authShell}`}>
            <Stack className={styles.authStory} gap="xl">
                <Pill>
                    <Sparkles size={14} />
                    Web-native notebooks
                    <InfoPopover title="Visual Note model" label="Visual Note model details">
                        Visual Note organizes knowledge as notebooks, sections, topics, article views, displays, and data so each notebook behaves like a structured website.
                    </InfoPopover>
                </Pill>
                <Stack gap="lg">
                    <Heading as="h1" size="hero">
                        Visual Note
                    </Heading>
                </Stack>
                <Grid columns="auto">
                    <InfoCard title="Notebook">Each notebook owns its own web-shaped information architecture.</InfoCard>
                    <InfoCard title="Article">Each topic has one article view. Add displays to the article as embedded items.</InfoCard>
                </Grid>
            </Stack>
            <Stack className={styles.authPanel} gap="lg">
                <Stack direction="horizontal" gap="sm">
                    <Heading size="lg">{mode === "register" ? "Create your account" : "Log in"}</Heading>
                    <InfoPopover title="Authentication mode" label="Authentication mode details">
                        {supabaseStatus === "configured" ? "Supabase auth is enabled for this build." : "Supabase env vars are missing, so this runs in local demo mode."}
                    </InfoPopover>
                </Stack>
                <Card>
                    <Stack gap="md">
                        {mode === "register" ? <TextField label="Name" value={name} onChange={event => setName(event.target.value)} /> : null}
                        <TextField label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} />
                        <TextField label="Password" type="password" value={password} onChange={event => setPassword(event.target.value)} />
                        <Button variant="primary" onClick={submit} disabled={isSubmitting} fullWidth>
                            {mode === "register" ? "Register and open workspace" : "Log in"}
                        </Button>
                        <Button variant="ghost" onClick={() => setMode(current => (current === "register" ? "login" : "register"))} fullWidth>
                            {mode === "register" ? "Use login instead" : "Create an account instead"}
                        </Button>
                    </Stack>
                </Card>
                {notice ? (
                    <Card className={styles.error} padding="compact">
                        <Text>{notice}</Text>
                    </Card>
                ) : null}
            </Stack>
        </Grid>
    )
}

function InfoCard({ title, children }: { title: string; children: string }) {
    return (
        <Card>
            <Stack direction="horizontal" gap="sm">
                <Pill>{title}</Pill>
                <InfoPopover title={title} label={`${title} details`}>
                    {children}
                </InfoPopover>
            </Stack>
        </Card>
    )
}
