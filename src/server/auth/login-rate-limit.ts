type LoginAttemptBucket = {
    attempts: number
    resetAt: number
    blockedUntil: number | null
}

type LoginFailureResult =
    | {
          attempts: number
          blocked: false
          retryAfterMs?: never
      }
    | {
          attempts: number
          blocked: true
          retryAfterMs: number
      }

const maxAttempts = 8
const windowMs = 10 * 60 * 1000
const blockMs = 10 * 60 * 1000
const buckets = new Map<string, LoginAttemptBucket>()

const nowMs = () => Date.now()

const normalizedIpFromRequest = (request: Request) => {
    const forwarded = request.headers.get("x-forwarded-for")
    if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown"

    return request.headers.get("x-real-ip") || "unknown"
}

const throttleKey = (request: Request, email: string) => `${email.toLowerCase()}|${normalizedIpFromRequest(request)}`

const readBucket = (request: Request, email: string) => {
    const key = throttleKey(request, email)
    const current = buckets.get(key)
    if (!current) {
        const entry: LoginAttemptBucket = {
            attempts: 0,
            resetAt: nowMs() + windowMs,
            blockedUntil: null,
        }
        buckets.set(key, entry)
        return entry
    }

    if (current.resetAt <= nowMs()) {
        current.attempts = 0
        current.resetAt = nowMs() + windowMs
        current.blockedUntil = null
    }

    return current
}

export const checkLoginRateLimit = (request: Request, email: string) => {
    const bucket = readBucket(request, email)
    const blockedUntil = bucket.blockedUntil

    if (blockedUntil && blockedUntil > nowMs()) return { allowed: false, retryAfterMs: blockedUntil - nowMs() }

    return { allowed: true, retryAfterMs: 0 }
}

export const recordLoginFailure = (request: Request, email: string): LoginFailureResult => {
    const bucket = readBucket(request, email)
    bucket.attempts += 1

    if (bucket.attempts >= maxAttempts && !bucket.blockedUntil) bucket.blockedUntil = nowMs() + blockMs

    return bucket.blockedUntil ? { blocked: true, retryAfterMs: bucket.blockedUntil - nowMs(), attempts: bucket.attempts } : { blocked: false, attempts: bucket.attempts }
}

export const recordLoginSuccess = (request: Request, email: string) => {
    const key = throttleKey(request, email)
    buckets.delete(key)
}
