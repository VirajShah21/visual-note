import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

const algorithm = "aes-256-gcm"

const encryptionKey = () => {
    const configured = process.env.VISUAL_NOTE_S3_ENCRYPTION_KEY
    if (!configured) return null

    return createHash("sha256").update(configured).digest()
}

export const canEncryptStorageSecrets = () => Boolean(encryptionKey())

export const encryptStorageSecret = (value: string) => {
    const key = encryptionKey()
    if (!key) throw new Error("VISUAL_NOTE_S3_ENCRYPTION_KEY is required.")

    const iv = randomBytes(12)
    const cipher = createCipheriv(algorithm, key, iv)
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".")
}

export const decryptStorageSecret = (value: string) => {
    const key = encryptionKey()
    if (!key) throw new Error("VISUAL_NOTE_S3_ENCRYPTION_KEY is required.")

    const [ivText, tagText, encryptedText] = value.split(".")
    if (!ivText || !tagText || !encryptedText) throw new Error("Encrypted S3 secret is malformed.")

    const decipher = createDecipheriv(algorithm, key, Buffer.from(ivText, "base64"))
    decipher.setAuthTag(Buffer.from(tagText, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]).toString("utf8")
}
