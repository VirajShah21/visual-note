import assert from "node:assert/strict"
import test from "node:test"
import { runLogin, type LoginRouteDependencies, suspiciousFailureAttempts } from "./route"

type LoginRouteTestDependencies = LoginRouteDependencies & {
    events: Array<{ event: string; severity?: string; metadata?: Record<string, unknown>; error?: unknown; userId?: string }>
}

const makeEventRecorder = () => {
    const events: Array<{ event: string; severity?: string; metadata?: Record<string, unknown>; error?: unknown; userId?: string }> = []

    const recordEvent = (entry: { event: string; severity?: string; metadata?: Record<string, unknown>; error?: unknown; userId?: string }) => {
        events.push(entry)
    }

    return { events, recordEvent }
}

const requestWithBody = (body: Record<string, unknown>, origin = "https://app.test") =>
    new Request("https://app.test/api/auth/login", {
        method: "POST",
        headers: {
            origin,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })

const readResponseBody = async (response: Response) => response.json()

const makeLoginDependencies = (overrides: Partial<LoginRouteDependencies> = {}): LoginRouteTestDependencies => {
    const { events, recordEvent } = makeEventRecorder()

    return {
        checkLoginRateLimit: () => ({ allowed: true, retryAfterMs: 0 }),
        createAppSession: async () => "token-1",
        createSessionCookie: token => `session=${token}`,
        getSupabaseServiceRoleClient: () => ({}) as never,
        recordLoginFailure: () => ({ attempts: 1, blocked: false }),
        recordLoginSuccess: () => {},
        recordVisualNoteEvent: entry => recordEvent(entry),
        rejectCrossOriginMutation: () => null,
        verifyAppUserCredentials: async () => null,
        errorMessage: (_, fallback) => fallback,
        ...overrides,
        events,
    } as LoginRouteTestDependencies
}

test("rejects cross-origin mutations using existing origin checks", async () => {
    const originError = Response.json({ error: "Cross-origin mutation requests are not allowed." }, { status: 403 })
    const dependencies = makeLoginDependencies({
        rejectCrossOriginMutation: () => originError,
    })

    const response = await runLogin(requestWithBody({ email: "user@example.com", password: "secret" }, "https://attacker.test"), dependencies as LoginRouteDependencies)

    assert.equal(response.status, 403)
    assert.deepEqual(await readResponseBody(response), { error: "Cross-origin mutation requests are not allowed." })
})

test("returns 503 when auth is unavailable", async () => {
    const dependencies = makeLoginDependencies({
        getSupabaseServiceRoleClient: () => null,
    })

    const response = await runLogin(requestWithBody({ email: "user@example.com", password: "secret" }), dependencies)

    assert.equal(response.status, 503)
    assert.deepEqual(await readResponseBody(response), { error: "Application database auth is not configured." })
})

test("returns 429 and logs lockout when rate limit blocks login", async () => {
    const dependencies = makeLoginDependencies({
        checkLoginRateLimit: () => ({ allowed: false, retryAfterMs: 1200 }),
    })

    const response = await runLogin(requestWithBody({ email: "user@example.com", password: "secret" }), dependencies)

    const body = await readResponseBody(response)
    assert.equal(response.status, 429)
    assert.equal(body.error, "Too many failed login attempts. Try again in 2 seconds.")

    const events = dependencies.events
    assert.equal(events.length, 1)
    assert.equal(events[0].event, "auth.login_rate_limited")
})

test("tracks suspicious failures near lockout threshold", async () => {
    const dependencies = makeLoginDependencies({
        recordLoginFailure: () => ({ attempts: suspiciousFailureAttempts, blocked: false }),
    })

    const response = await runLogin(requestWithBody({ email: "user@example.com", password: "bad-password" }), dependencies)

    const body = await readResponseBody(response)
    assert.equal(response.status, 401)
    assert.equal(body.error, "Invalid login credentials.")

    const events = dependencies.events
    assert.equal(
        events.some(event => event.event === "auth.login_suspicious"),
        true,
    )
    assert.equal(
        events.some(event => event.event === "auth.login_failed"),
        true,
    )
})

test("logs lockout and returns 429 once failure cap reached", async () => {
    const dependencies = makeLoginDependencies({
        recordLoginFailure: () => ({ attempts: 9, blocked: true, retryAfterMs: 60000 }),
    })

    const response = await runLogin(requestWithBody({ email: "user@example.com", password: "bad-password" }), dependencies)

    const body = await readResponseBody(response)
    assert.equal(response.status, 429)
    assert.equal(body.error, "Too many failed login attempts. Try again in 60 seconds.")

    const events = dependencies.events
    assert.equal(
        events.some(event => event.event === "auth.login_lockout_started"),
        true,
    )
})

test("logs success and returns session cookie on valid login", async () => {
    const dependencies = makeLoginDependencies({
        verifyAppUserCredentials: async () => ({ id: "user-1", email: "user@example.com", name: "User" }),
    })

    const response = await runLogin(requestWithBody({ email: "user@example.com", password: "correct" }), dependencies)

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("set-cookie"), "session=token-1")

    const body = await readResponseBody(response)
    assert.equal(body.user.id, "user-1")

    const events = dependencies.events
    assert.equal(
        events.some(event => event.event === "auth.login_succeeded"),
        true,
    )
})
