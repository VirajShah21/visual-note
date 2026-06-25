export const errorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) return error.message
    if (typeof error !== "object" || error === null) return fallback

    const message = Reflect.get(error, "message")
    return typeof message === "string" && message.trim() ? message : fallback
}

export const errorCode = (error: unknown) => {
    if (typeof error !== "object" || error === null) return null

    const code = Reflect.get(error, "code")
    return typeof code === "string" ? code : null
}
