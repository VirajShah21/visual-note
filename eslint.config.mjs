import { defineConfig, globalIgnores } from "eslint/config"
import css from "@eslint/css"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettierConfig from "eslint-config-prettier"
import prettierRecommended from "eslint-plugin-prettier/recommended"

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
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
        files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
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
