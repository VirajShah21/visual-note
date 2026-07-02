import path from "node:path"

const sourceFileExtensions = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".cjs"]

const ignoredImportExtensions = [".css"]

const aliasMappings = [
    ["src/components/ui", "@ui"],
    ["src/components", "@components"],
    ["src/features", "@features"],
    ["src/server", "@server"],
    ["src/app", "@app"],
    ["src/lib", "@lib"],
    ["src", "@"],
]

const isRelativeParentImport = importPath => importPath.startsWith("../")

const isIgnoredImport = importPath => ignoredImportExtensions.some(extension => importPath.endsWith(extension))

const isPathInside = (parentPath, childPath) => {
    const relativePath = path.relative(parentPath, childPath)

    return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
}

const resolveImportPath = (filename, importPath) => {
    const importBasePath = path.resolve(path.dirname(filename), importPath)
    const candidatePaths = [
        importBasePath,
        ...sourceFileExtensions.map(extension => `${importBasePath}${extension}`),
        ...sourceFileExtensions.map(extension => path.join(importBasePath, `index${extension}`)),
    ]

    return candidatePaths.find(candidatePath => isPathInside(path.resolve(process.cwd(), "src"), candidatePath))
}

const tsconfigPathFor = resolvedImportPath => {
    const relativeImportPath = path.relative(process.cwd(), resolvedImportPath).split(path.sep).join("/")
    const [matchedPath, alias] = aliasMappings.find(([sourcePath]) => relativeImportPath === sourcePath || relativeImportPath.startsWith(`${sourcePath}/`)) ?? []

    if (!matchedPath || !alias) return null

    const aliasSuffix = relativeImportPath
        .slice(matchedPath.length)
        .replace(/\.(c|m)?[jt]sx?$/, "")
        .replace(/\/index$/, "")

    return `${alias}${aliasSuffix}`
}

const reportImportPath = (context, node, importPath) => {
    if (!isRelativeParentImport(importPath) || isIgnoredImport(importPath)) return

    const filename = context.filename
    if (!filename || filename.startsWith("<")) return

    const resolvedImportPath = resolveImportPath(filename, importPath)
    if (!resolvedImportPath) return

    const aliasPath = tsconfigPathFor(resolvedImportPath)
    context.report({
        node,
        messageId: "preferAlias",
        data: {
            aliasPath: aliasPath ?? "a TSConfig path alias",
        },
    })
}

const getLiteralImportPath = node => {
    if (!node || node.type !== "Literal" || typeof node.value !== "string") return null

    return node.value
}

const preferTsconfigPathsRule = {
    meta: {
        type: "suggestion",
        docs: {
            description: "Require TSConfig path aliases for parent-directory imports into src.",
        },
        messages: {
            preferAlias: "Use {{aliasPath}} instead of a parent-directory relative import.",
        },
        schema: [],
    },
    create(context) {
        return {
            ExportAllDeclaration(node) {
                const importPath = getLiteralImportPath(node.source)
                if (importPath) reportImportPath(context, node.source, importPath)
            },
            ExportNamedDeclaration(node) {
                const importPath = getLiteralImportPath(node.source)
                if (importPath) reportImportPath(context, node.source, importPath)
            },
            ImportDeclaration(node) {
                const importPath = getLiteralImportPath(node.source)
                if (importPath) reportImportPath(context, node.source, importPath)
            },
            ImportExpression(node) {
                const importPath = getLiteralImportPath(node.source)
                if (importPath) reportImportPath(context, node.source, importPath)
            },
        }
    },
}

export default preferTsconfigPathsRule
