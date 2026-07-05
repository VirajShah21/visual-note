import assert from "node:assert/strict"
import test from "node:test"
import { runSessionGet, type SessionRouteDependencies } from "./route"

const readResponseBody = async (response: Response) => response.json()

const request = new Request("https://app.test/api/auth/session")
const requestWithCookie = (cookie?: string) =>
    new Request("https://app.test/api/auth/session", {
        headers: cookie ? { cookie: `visual_note_session=${cookie}` } : undefined,
    })

const makeDependencies = (overrides: Partial<SessionRouteDependencies> = {}): SessionRouteDependencies => ({
    getSupabaseServiceRoleClient: () => ({}) as never,
    readSessionCookie: () => "",
    findAppSessionByToken: async () => null,
    rotateAppSession: async () => "rotation-token",
    clearSessionCookie: () => "visual_note_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    createSessionCookie: token => `visual_note_session=${token}`,
    sessionNeedsRotation: () => false,
    ...overrides,
})

test("returns unauthenticated when app auth is unavailable", async () => {
    const response = await runSessionGet(request, {
        ...makeDependencies(),
        getSupabaseServiceRoleClient: () => null,
    })

    assert.deepEqual(await readResponseBody(response), { authReady: false, user: null })
})

test("returns no user when no cookie is present", async () => {
    const response = await runSessionGet(request, makeDependencies())

    assert.deepEqual(await readResponseBody(response), { authReady: true, user: null })
})

test("returns no user and clears cookie for missing sessions", async () => {
    const response = await runSessionGet(requestWithCookie("expired"), {
        ...makeDependencies({
            getSupabaseServiceRoleClient: () => ({}) as never,
            readSessionCookie: () => "expired",
            findAppSessionByToken: async () => null,
            clearSessionCookie: () => "visual_note_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        }),
    })

    assert.equal(response.headers.get("set-cookie"), "visual_note_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")
    assert.deepEqual(await readResponseBody(response), { authReady: true, user: null })
})

test("rotates session when near expiry", async () => {
    const response = await runSessionGet(requestWithCookie("current"), {
        ...makeDependencies({
            getSupabaseServiceRoleClient: () => ({}) as never,
            readSessionCookie: () => "current",
            findAppSessionByToken: async () => ({
                expiresAt: "2026-07-03T00:00:00.000Z",
                user: { id: "user-1", email: "user@example.com", name: "User" },
            }),
            sessionNeedsRotation: () => true,
            rotateAppSession: async () => "next-token",
            createSessionCookie: token => `visual_note_session=${token}`,
        }),
    })

    assert.equal(response.headers.get("set-cookie"), "visual_note_session=next-token")
    assert.deepEqual(await readResponseBody(response), {
        authReady: true,
        user: { id: "user-1", email: "user@example.com", name: "User" },
    })
})
