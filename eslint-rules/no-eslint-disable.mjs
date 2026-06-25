const rule = {
    meta: {
        type: "problem",
        docs: {
            description: "Disallow inline or file-level eslint disable directives.",
        },
        schema: [],
    },
    create(context) {
        const disableDirectivePattern = /\beslint-(disable|disable-line|disable-next-line|enable)\b/

        return {
            Program() {
                const sourceCode = context.getSourceCode()
                const comments = sourceCode.getAllComments()

                comments.forEach(comment => {
                    const match = comment.value.match(disableDirectivePattern)
                    if (!match) return

                    const raw = context.getSourceCode().getText(comment).replace(/\s+/g, " ").trim()
                    context.report({
                        node: comment,
                        message: `ESLint directive comment is disallowed: ${match[0]}${raw ? ` in "${raw}"` : ""}.`,
                    })
                })
            },
        }
    },
}

const noEslintDisablePlugin = {
    rules: {
        "no-eslint-disable": rule,
    },
}

export default noEslintDisablePlugin
