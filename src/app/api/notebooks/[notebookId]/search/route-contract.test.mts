import assert from "node:assert/strict"
import test from "node:test"
import { parseSearchRequest } from "./route-contract"

const requestFor = (query: string, extra: Record<string, string> = {}) =>
    new Request(`http://visual-note.test/api/notebooks/notebook-1/search?${new URLSearchParams({ q: query, ...extra }).toString()}`, {
        method: "GET",
    })

test("accepts default search input values", () => {
    const parsed = parseSearchRequest(requestFor("notes"))

    assert.equal(parsed.ok, true)
    if (!parsed.ok) return

    assert.equal(parsed.input.query, "notes")
    assert.equal(parsed.input.limit, undefined)
    assert.equal(parsed.input.offset, undefined)
})

test("accepts numeric limit and offset values", () => {
    const parsed = parseSearchRequest(requestFor("notes", { limit: "10", offset: "20", currentPageId: "page-1" }))

    assert.equal(parsed.ok, true)
    if (!parsed.ok) return

    assert.equal(parsed.input.limit, 10)
    assert.equal(parsed.input.offset, 20)
    assert.equal(parsed.input.currentPageId, "page-1")
})

test("rejects non-numeric limit", () => {
    const parsed = parseSearchRequest(requestFor("notes", { limit: "abc" }))

    assert.deepEqual(parsed, { ok: false, error: "limit must be a number.", status: 400 })
})

test("rejects non-numeric offset", () => {
    const parsed = parseSearchRequest(requestFor("notes", { offset: "abc" }))

    assert.deepEqual(parsed, { ok: false, error: "offset must be a number.", status: 400 })
})

test("rejects overly long search query", () => {
    const parsed = parseSearchRequest(requestFor("x".repeat(201)))

    assert.deepEqual(parsed, { ok: false, error: "Search query is too long.", status: 400 })
})
