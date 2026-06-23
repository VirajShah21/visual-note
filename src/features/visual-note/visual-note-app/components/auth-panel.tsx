"use client"

import { Sparkles } from "lucide-react"
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react"
import { Button, Card, Grid, Heading, InfoCard, InfoPopover, Pill, Stack, Text, TextField } from "@/components/ui"
import type { AuthPanelProps } from "../types/visual-note-app.types"
import styles from "../../visual-note-app.module.css"

export function AuthPanel({ authStatus, notice, onSignIn, onRegister }: AuthPanelProps) {
    const [mode, setMode] = useState<"login" | "register">("register")
    const [email, setEmail] = useState("")
    const [name, setName] = useState("")
    const [password, setPassword] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const formRef = useRef({ email, mode, name, onRegister, onSignIn, password })
    const authReady = authStatus === "ready"

    useEffect(() => {
        formRef.current = { email, mode, name, onRegister, onSignIn, password }
    }, [email, mode, name, onRegister, onSignIn, password])

    const submit = useCallback(async () => {
        const current = formRef.current
        setIsSubmitting(true)
        try {
            if (current.mode === "register") await current.onRegister(current.email, current.password, current.name)
            else await current.onSignIn(current.email, current.password, current.name)
        } finally {
            setIsSubmitting(false)
        }
    }, [])
    const updateName = useCallback((event: ChangeEvent<HTMLInputElement>) => setName(event.target.value), [])
    const updateEmail = useCallback((event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value), [])
    const updatePassword = useCallback((event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value), [])
    const toggleMode = useCallback(() => setMode(current => (current === "register" ? "login" : "register")), [])

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
                        Visual Note uses application-owned users, password hashes, and server sessions.
                    </InfoPopover>
                </Stack>
                <Card>
                    <Stack gap="md">
                        {mode === "register" ? <TextField label="Name" value={name} onChange={updateName} /> : null}
                        <TextField label="Email" type="email" value={email} onChange={updateEmail} />
                        <TextField label="Password" type="password" value={password} onChange={updatePassword} />
                        <Button variant="primary" onClick={submit} disabled={!authReady || isSubmitting} fullWidth>
                            {mode === "register" ? "Register and open workspace" : "Log in"}
                        </Button>
                        <Button variant="ghost" onClick={toggleMode} fullWidth>
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
