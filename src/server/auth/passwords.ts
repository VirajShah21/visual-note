import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto"

const keyLength = 64
const scryptOptions = { N: 16384, r: 8, p: 1 }

const deriveKey = (password: string, salt: string, options = scryptOptions) =>
    new Promise<Buffer>((resolve, reject) => {
        scrypt(password, salt, keyLength, options, (error, derivedKey) => {
            if (error) reject(error)
            else resolve(derivedKey)
        })
    })

export const hashPassword = async (password: string) => {
    const salt = randomBytes(16).toString("base64url")
    const hash = await deriveKey(password, salt)
    return `scrypt$1$${scryptOptions.N}$${scryptOptions.r}$${scryptOptions.p}$${salt}$${hash.toString("base64url")}`
}

export const verifyPassword = async (password: string, passwordHash: string) => {
    const [algorithm, version, n, r, p, salt, expectedHash] = passwordHash.split("$")
    if (algorithm !== "scrypt" || version !== "1" || !salt || !expectedHash) return false

    const actual = await deriveKey(password, salt, { N: Number(n), r: Number(r), p: Number(p) })
    const expected = Buffer.from(expectedHash, "base64url")
    return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected)
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")
