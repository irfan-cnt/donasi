import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const SECRET_PUBLIC_ENV = "^NEXT_PUBLIC_\\w*(SECRET|KEY|TOKEN|PASSWORD)";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `MemberExpression[property.name=/${SECRET_PUBLIC_ENV}/]`,
          message:
            "Env NEXT_PUBLIC_ terekspos ke browser: jangan berisi SECRET/KEY/TOKEN/PASSWORD.",
        },
        {
          selector: `MemberExpression[property.value=/${SECRET_PUBLIC_ENV}/]`,
          message:
            "Env NEXT_PUBLIC_ terekspos ke browser: jangan berisi SECRET/KEY/TOKEN/PASSWORD.",
        },
        {
          selector: `Literal[value=/${SECRET_PUBLIC_ENV}/]`,
          message:
            "Env NEXT_PUBLIC_ terekspos ke browser: jangan berisi SECRET/KEY/TOKEN/PASSWORD.",
        },
        {
          selector: "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
          message:
            "sql.raw dilarang (risiko SQL injection). Gunakan template sql`...` berparameter.",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "design-mockups/**",
    "docs/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
