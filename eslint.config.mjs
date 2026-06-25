import { defineConfig, globalIgnores } from "eslint/config"
import css from "@eslint/css"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import noEslintDisable from "./eslint-rules/no-eslint-disable.mjs"
import prettierConfig from "eslint-config-prettier"
import prettierRecommended from "eslint-plugin-prettier/recommended"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"

const codeFiles = ["**/*.{js,jsx,mjs,cjs,ts,tsx}"]

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    {
        ...react.configs.flat.recommended,
        files: codeFiles,
    },
    {
        ...react.configs.flat["jsx-runtime"],
        files: codeFiles,
    },
    {
        ...reactHooks.configs.flat["recommended-latest"],
        files: codeFiles,
    },
    {
        files: codeFiles,
        plugins: {
            "local-eslint": noEslintDisable,
        },
        rules: {
            "local-eslint/no-eslint-disable": "error",
        },
    },
    prettierConfig,
    prettierRecommended,
    {
        files: ["**/*.css"],
        language: "css/css",
        plugins: {
            css,
        },
    },
    {
        files: codeFiles,
        settings: {
            react: {
                version: "detect",
            },
        },
        rules: {
            "arrow-parens": ["error", "as-needed"],
            curly: ["error", "multi"],
            "max-len": [
                "error",
                {
                    code: 180,
                    ignoreUrls: true,
                    tabWidth: 4,
                },
            ],
            "max-lines": [
                "error",
                {
                    max: 300,
                },
            ],
            "no-tabs": "error",
            "@next/next/no-img-element": "error",
            "react-hooks/exhaustive-deps": "error",
            "react-hooks/memo-dependencies": "error",
            "react-hooks/memoized-effect-dependencies": "error",
            "react/jsx-no-bind": [
                "error",
                {
                    allowArrowFunctions: false,
                    allowBind: false,
                    allowFunctions: false,
                    ignoreDOMComponents: false,
                    ignoreRefs: false,
                },
            ],
            semi: ["error", "never"],
        },
    },
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
    ]),
])

export default eslintConfig
