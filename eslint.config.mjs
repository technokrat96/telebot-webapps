import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      // Larang penggunaan tipe `any` — pakai `unknown` + type guard, atau tipe eksplisit
      "@typescript-eslint/no-explicit-any": "error",
      // Matikan rule bawaan (gak bisa auto-fix), pakai versi plugin yang bisa
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // Hapus otomatis import yang gak dipakai lewat `eslint --fix`
      "unused-imports/no-unused-imports": "error",
      // Variabel/argumen yang gak dipakai juga ditandai (prefix _ untuk sengaja dibiarkan)
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      // Object literal harus multiline, tidak boleh inline { a: 1, b: 2 }
      "object-curly-newline": [
        "error",
        {
          ObjectExpression: { multiline: true, minProperties: 1 },
          ObjectPattern: { multiline: true },
          ImportDeclaration: "never",
          ExportDeclaration: { multiline: true, minProperties: 3 },
        },
      ],
      // Tiap property object wajib di baris sendiri
      "object-property-newline": [
        "error",
        { allowAllPropertiesOnSameLine: false },
      ],
      // Wajib trailing comma di multiline object/array/dll
      "comma-dangle": ["error", "always-multiline"],
      // Spasi setelah ":" pada key-value, tidak boleh sebelum ":"
      "key-spacing": ["error", { beforeColon: false, afterColon: true }],
      // Spasi di dalam kurung kurawal { a } bukan {a}
      "object-curly-spacing": ["error", "always"],

      // --- JSX / React ---
      // Kalau prop lebih dari 1, tiap prop wajib baris sendiri
      "react/jsx-max-props-per-line": [
        "error",
        { maximum: 1, when: "multiline" },
      ],
      // Kalau ada >1 prop, prop pertama wajib pindah ke baris baru
      "react/jsx-first-prop-new-line": ["error", "multiline-multiprop"],
      // Posisi "/>" atau ">" penutup wajib align dengan tag pembuka, di baris sendiri
      "react/jsx-closing-bracket-location": ["error", "tag-aligned"],
      // Posisi "</Tag>" wajib align dengan tag pembuka, di baris sendiri
      "react/jsx-closing-tag-location": "error",
      // Indentasi prop JSX konsisten 2 spasi
      "react/jsx-indent-props": ["error", 2],
      // Setiap child JSX (elemen/tag) di baris sendiri kalau multiline
      "react/jsx-wrap-multilines": [
        "error",
        {
          declaration: "parens-new-line",
          assignment: "parens-new-line",
          return: "parens-new-line",
          arrow: "parens-new-line",
          condition: "parens-new-line",
          logical: "parens-new-line",
          prop: "parens-new-line",
        },
      ],
    },
  },
  // Matikan rule ESLint yang bentrok dengan Prettier (harus paling akhir)
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Kode auto-generated Prisma, jangan di-lint
    "src/generated/**",
  ]),
]);

export default eslintConfig;
