import { randomBytes } from "crypto"

export const appSessionCookieName = "visual_note_session"

const sessionMaxAgeSeconds = 60 * 60 * 24 * 30

export const createSessionToken = () => `vn_session_${randomBytes(32).toString("base64url")}`

export const createSessionCookie = (token: string) =>
    [
        `${appSessionCookieName}=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${sessionMaxAgeSeconds}`,
        process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
        .filter(Boolean)
        .join("; ")

export const clearSessionCookie = () => `${appSessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`

export const readSessionCookie = (request: Request) => {
    const cookies = request.headers.get("cookie") ?? ""
    const match = cookies
        .split(";")
        .map(item => item.trim())
        .find(item => item.startsWith(`${appSessionCookieName}=`))

    return match ? decodeURIComponent(match.slice(appSessionCookieName.length + 1)) : ""
}

export const sessionExpiresAt = () => new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString()
