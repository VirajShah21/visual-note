import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { rejectCrossOriginMutation } from "./server"

describe("rejectCrossOriginMutation", () => {
    it("allows requests without an origin header", () => {
        const request = new Request("https://app.example.test/api/workspace", { method: "PUT" })

        assert.equal(rejectCrossOriginMutation(request), null)
    })

    it("allows same-origin requests", () => {
        const request = new Request("https://app.example.test/api/workspace", {
            headers: { origin: "https://app.example.test" },
            method: "PUT",
        })

        assert.equal(rejectCrossOriginMutation(request), null)
    })

    it("rejects cross-origin requests", async () => {
        const request = new Request("https://app.example.test/api/workspace", {
            headers: { origin: "https://evil.example.test" },
            method: "PUT",
        })

        const response = rejectCrossOriginMutation(request)

        assert.ok(response instanceof Response)
        assert.equal(response.status, 403)
        assert.deepEqual(await response.json(), { error: "Cross-origin mutation requests are not allowed." })
    })

    it("rejects invalid origin headers", async () => {
        const request = new Request("https://app.example.test/api/workspace", {
            headers: { origin: "not a url" },
            method: "PUT",
        })

        const response = rejectCrossOriginMutation(request)

        assert.ok(response instanceof Response)
        assert.equal(response.status, 403)
        assert.deepEqual(await response.json(), { error: "Invalid request origin." })
    })
})
