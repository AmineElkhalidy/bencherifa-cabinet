import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "data/**",
  ]),
  {
    rules: {
      // The app contains natural prose with apostrophes. Escaping each one to
      // &apos; is noisy and doesn't add value.
      "react/no-unescaped-entities": "off",
      // Medical document previews are served via our own /api route as
      // arbitrary user uploads (PDF / JPG). next/image isn't applicable
      // here — disable the warning for those modules.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
