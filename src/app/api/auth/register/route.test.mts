import assert from "node:assert/strict"
import test from "node:test"
import { runRegister, type RegisterRouteDependencies } from "./route"

const requestWithBody = (body: Record<string, unknown>, origin = "https://app.test") =>
    new Request("https://app.test/api/auth/register", {
        method: "POST",
        headers: {
            origin,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })

const readResponseBody = async (response: Response) => response.json()

const makeDependencies = (overrides: Partial<RegisterRouteDependencies> = {}): RegisterRouteDependencies => ({
    getSupabaseServiceRoleClient: () => ({}) as never,
    rejectCrossOriginMutation: () => null,
    createAppUser: async () => ({ id: "user-1", email: "user@example.com", name: "User" }),
    createAppSession: async () => "session-token",
    errorCode: error => (typeof error === "object" && error && "code" in error && typeof error.code === "string" ? error.code : null),
    errorMessage: (error, fallback) => (error instanceof Error ? error.message : fallback),
    createSessionCookie: token => `session=${token}`,
    ...overrides,
})

test("rejects cross-origin registration mutations", async () => {
    const originError = Response.json({ error: "Cross-origin mutation requests are not allowed." }, { status: 403 })
    const response = await runRegister(requestWithBody({ email: "user@example.com", name: "User", password: "secret" }, "https://attacker.test"), {
        ...makeDependencies(),
        rejectCrossOriginMutation: () => originError,
    })

    assert.equal(response.status, 403)
    assert.deepEqual(await readResponseBody(response), { error: "Cross-origin mutation requests are not allowed." })
})

test("returns schema validation errors for invalid payloads", async () => {
    const response = await runRegister(requestWithBody({ email: "not-an-email" }), makeDependencies())

    assert.equal(response.status, 400)
    const body = await readResponseBody(response)
    assert.equal(typeof body.error, "string")
    assert.equal(body.error.includes("Invalid email"), true)
})

test("returns 503 when auth backend is not configured", async () => {
    const response = await runRegister(requestWithBody({ email: "user@example.com", name: "User", password: "secret" }), {
        ...makeDependencies(),
        getSupabaseServiceRoleClient: () => null,
    })

    assert.equal(response.status, 503)
    assert.deepEqual(await readResponseBody(response), { error: "Application database auth is not configured." })
})

test("returns duplicate conflict for duplicate account", async () => {
    const response = await runRegister(requestWithBody({ email: "user@example.com", name: "User", password: "secret" }), {
        ...makeDependencies(),
        createAppUser: async () => {
            const error: { message: string; code: string } = { message: "duplicate key value", code: "23505" }
            throw error
        },
    })

    assert.equal(response.status, 409)
    assert.deepEqual(await readResponseBody(response), { error: "An account with this email already exists." })
})

test("creates account and returns session cookie", async () => {
    const response = await runRegister(
        requestWithBody({ email: "user@example.com", name: "User", password: "secret" }),
        makeDependencies({
            createAppUser: async () => ({ id: "user-1", email: "user@example.com", name: "User" }),
            createAppSession: async () => "session-token",
            createSessionCookie: token => `session=${token}`,
        }),
    )

    assert.equal(response.status, 201)
    assert.equal(response.headers.get("set-cookie"), "session=session-token")
    assert.deepEqual(await readResponseBody(response), {
        user: { id: "user-1", email: "user@example.com", name: "User" },
    })
})
