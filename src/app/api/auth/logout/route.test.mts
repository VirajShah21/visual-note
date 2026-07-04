import assert from "node:assert/strict"
import test from "node:test"
import { runLogout, type LogoutRouteDependencies } from "./route"

const readResponseBody = async (response: Response) => response.json()

const makeDependencies = (overrides: Partial<LogoutRouteDependencies> = {}): LogoutRouteDependencies => ({
    getSupabaseServiceRoleClient: () => ({}) as never,
    rejectCrossOriginMutation: () => null,
    readSessionCookie: () => "token-1",
    revokeAppSession: async () => {},
    clearSessionCookie: () => "visual_note_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    ...overrides,
})

test("rejects cross-origin logouts", async () => {
    const originError = Response.json({ error: "Cross-origin mutation requests are not allowed." }, { status: 403 })
    const response = await runLogout(new Request("https://app.test/api/auth/logout", { method: "POST", headers: { origin: "https://attacker.test" } }), {
        ...makeDependencies(),
        rejectCrossOriginMutation: () => originError,
    })

    assert.equal(response.status, 403)
    assert.deepEqual(await readResponseBody(response), { error: "Cross-origin mutation requests are not allowed." })
})

test("revokes active app session and clears cookie", async () => {
    let revokedToken: string | null = null

    const response = await runLogout(new Request("https://app.test/api/auth/logout", { method: "POST", headers: { origin: "https://app.test" } }), {
        ...makeDependencies(),
        readSessionCookie: () => "token-1",
        revokeAppSession: async (_supabase, token) => {
            revokedToken = token
        },
    })

    assert.equal(response.status, 200)
    assert.equal(revokedToken, "token-1")
    assert.equal(response.headers.get("set-cookie"), "visual_note_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")
    assert.deepEqual(await readResponseBody(response), { ok: true })
})

test("still clears cookie when no session exists", async () => {
    const response = await runLogout(
        new Request("https://app.test/api/auth/logout", { method: "POST", headers: { origin: "https://app.test" } }),
        makeDependencies({
            readSessionCookie: () => "",
        }),
    )

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("set-cookie"), "visual_note_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")
    assert.deepEqual(await readResponseBody(response), { ok: true })
})
