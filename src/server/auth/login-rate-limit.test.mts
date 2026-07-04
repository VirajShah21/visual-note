import assert from "node:assert/strict"
import test from "node:test"
import { checkLoginRateLimit, recordLoginFailure, recordLoginSuccess } from "./login-rate-limit"

const makeRequest = (ip = "198.51.100.1") =>
    new Request("http://localhost/api/auth/login", {
        headers: {
            "x-forwarded-for": ip,
        },
    })

test("allows repeated failures until the configured threshold", () => {
    const request = makeRequest()
    const email = "throttle@example.com"

    assert.equal(checkLoginRateLimit(request, email).allowed, true)

    for (let attempt = 0; attempt < 7; attempt += 1) {
        const failure = recordLoginFailure(request, email)
        assert.equal(failure.blocked, false)
    }

    const finalFailure = recordLoginFailure(request, email)
    assert.equal(finalFailure.blocked, true)
    assert.equal(finalFailure.retryAfterMs > 0, true)
})

test("clears the throttle after a successful login", () => {
    const request = makeRequest("203.0.113.9")
    const email = "success@example.com"

    for (let attempt = 0; attempt < 8; attempt += 1) {
        recordLoginFailure(request, email)
    }

    recordLoginSuccess(request, email)

    assert.equal(checkLoginRateLimit(request, email).allowed, true)
})
