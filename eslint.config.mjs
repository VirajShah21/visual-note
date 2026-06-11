import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettierConfig from "eslint-config-prettier"

const maxLenOptions = {
    ignoreUrls: true,
    tabWidth: 4,
}

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    prettierConfig,
    {
        files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
        rules: {
            "arrow-parens": ["error", "as-needed"],
            curly: ["error", "multi"],
            "max-len": [
                "error",
                {
                    code: 180,
                    ...maxLenOptions,
                },
            ],
            "no-tabs": "error",
            semi: ["error", "never"],
        },
    },
    {
        files: ["**/*.{ts,tsx}"],
        rules: {
            "max-len": [
                "error",
                {
                    code: 300,
                    ...maxLenOptions,
                },
            ],
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
