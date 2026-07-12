import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".vercel",
      "coverage",
      "playwright-report",
      "test-results",
      "supabase/.temp",
      ".eslint-report.json",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      // These Radix/shadcn primitives intentionally co-export variant helpers.
      // They remain valid Fast Refresh boundaries in consuming component files.
      "react-refresh/only-export-components": "off",
    },
  },
  eslintPluginPrettier,
  {
    files: ["src/components/ui/**/*.{ts,tsx}", "src/components/feed/FeedComposer.tsx"],
    rules: {
      // These files intentionally export reusable component variants/helpers;
      // that shadcn-style module shape is compatible with Fast Refresh.
      "react-refresh/only-export-components": "off",
    },
  },
);
