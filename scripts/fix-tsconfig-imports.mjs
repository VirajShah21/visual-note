import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import ts from "typescript"

const ROOT_DIR = process.cwd()
const SRC_DIR = path.join(ROOT_DIR, "src")
const TS_CONFIG_PATH = path.join(ROOT_DIR, "tsconfig.json")

const supportedFileExtensions = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".cjs"]

const isAliasTarget = (target, sourcePath) =>
    target === sourcePath || target.startsWith(`${sourcePath}/`)

const stripKnownExtensionAndIndex = relativePath => {
    return relativePath
        .replace(/\.(c|m)?[jt]sx?$/, "")
        .replace(/\/index$/, "")
}

const computeAliasMappings = pathsMap => {
    return Object.entries(pathsMap)
        .filter(([alias, targets]) => alias.endsWith("/*") && Array.isArray(targets) && targets.length > 0)
        .flatMap(([alias, targets]) =>
            targets.filter(target => target.endsWith("/*")).map(target => ({
                aliasRoot: alias.replace(/\/\*$/, ""),
                targetRoot: target.replace(/\/\*$/, ""),
            })),
        )
        .sort((a, b) => b.targetRoot.length - a.targetRoot.length)
}

const resolveAlias = (resolvedImportPath, aliasMappings) => {
    const relativeImportPath = path.relative(ROOT_DIR, resolvedImportPath).split(path.sep).join("/")
    for (const mapping of aliasMappings) {
        if (!isAliasTarget(relativeImportPath, mapping.targetRoot)) continue
        const aliasSuffix = stripKnownExtensionAndIndex(relativeImportPath.slice(mapping.targetRoot.length))
        return `${mapping.aliasRoot}${aliasSuffix}`
    }
    return null
}

const isCssImport = importPath => importPath.endsWith(".css") || importPath.endsWith(".scss") || importPath.endsWith(".sass")

const isImportWithinSource = resolvedImportPath => {
    const relativeToSrc = path.relative(SRC_DIR, resolvedImportPath)
    return Boolean(relativeToSrc) && !relativeToSrc.startsWith("..") && !path.isAbsolute(relativeToSrc)
}

const getSourceFiles = async () => {
    const allFiles = []
    const entries = await fs.readdir(SRC_DIR, { withFileTypes: true, recursive: true })
    for (const entry of entries) {
        if (!entry.isFile()) continue
        if (supportedFileExtensions.includes(path.extname(entry.name))) {
            allFiles.push(path.join(entry.parentPath, entry.name))
        }
    }
    return allFiles
}

const getScriptKind = filePath => {
    const extension = path.extname(filePath)
    if (extension === ".tsx" || extension === ".jsx") return ts.ScriptKind.TSX
    if (extension === ".mts" || extension === ".mjs") return ts.ScriptKind.TS
    return ts.ScriptKind.TS
}

const collectImportNodes = sourceFile => {
    const importNodes = []

    const visit = node => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            importNodes.push(node.moduleSpecifier)
        }
        if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            importNodes.push(node.moduleSpecifier)
        }
        if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments.length === 1 &&
            ts.isStringLiteral(node.arguments[0])
        ) {
            importNodes.push(node.arguments[0])
        }
        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return importNodes
}

const resolveImport = (importPath, filePath, compilerOptions) => {
    if (!importPath.startsWith("../")) return null
    if (isCssImport(importPath)) return null

    const containingFile = path.relative(ROOT_DIR, filePath).split(path.sep).join("/")
    const resolution = ts.resolveModuleName(importPath, containingFile, compilerOptions, ts.sys)
    const resolvedFileName = resolution.resolvedModule?.resolvedFileName
    if (!resolvedFileName) return null

    const absoluteResolved = path.resolve(ROOT_DIR, resolvedFileName)
    if (!isImportWithinSource(absoluteResolved)) return null

    return absoluteResolved
}

const migrateFile = async (filePath, compilerOptions, aliasMappings) => {
    const rawSource = await fs.readFile(filePath, "utf8")
    const sourceFile = ts.createSourceFile(filePath, rawSource, ts.ScriptTarget.Latest, false, getScriptKind(filePath))
    const moduleSpecifiers = collectImportNodes(sourceFile)
    const replacements = []

    for (const specifier of moduleSpecifiers) {
        const importPath = specifier.text
        const resolvedImportPath = resolveImport(importPath, filePath, compilerOptions)
        if (!resolvedImportPath) continue

        const aliasPath = resolveAlias(resolvedImportPath, aliasMappings)
        if (!aliasPath) continue
        if (aliasPath === importPath) continue

        const start = specifier.getStart(sourceFile) + 1
        const end = specifier.getEnd() - 1
        replacements.push({ start, end, aliasPath })
    }

    if (!replacements.length) return 0

    replacements.sort((a, b) => b.start - a.start)
    let source = rawSource
    for (const replacement of replacements) {
        source = `${source.slice(0, replacement.start)}${replacement.aliasPath}${source.slice(replacement.end)}`
    }

    await fs.writeFile(filePath, source, "utf8")
    return replacements.length
}

const main = async () => {
    const tsconfig = JSON.parse(await fs.readFile(TS_CONFIG_PATH, "utf8"))
    const compilerOptions = {
        ...tsconfig.compilerOptions,
        baseUrl: tsconfig.compilerOptions?.baseUrl ?? ".",
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        module: ts.ModuleKind.ESNext,
    }
    const aliasMappings = computeAliasMappings(compilerOptions.paths ?? {})

    if (aliasMappings.length === 0) {
        throw new Error("No TSConfig path aliases found. Expected at least one `paths` entry.")
    }

    const files = await getSourceFiles()
    let totalChanges = 0

    for (const filePath of files) {
        const changed = await migrateFile(filePath, compilerOptions, aliasMappings)
        totalChanges += changed
    }

    console.log(`Updated ${totalChanges} import specifiers across ${files.length} source files.`)
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})
