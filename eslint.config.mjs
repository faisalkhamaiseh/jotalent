import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // SQL injection guard. Prisma has two ways to run raw SQL. The tagged
    // templates ($queryRaw`...`, $executeRaw`...`) send every ${value} as a
    // bound parameter. The "Unsafe" functions take a plain string, and a
    // string built from user input is how injection happens, so they are
    // banned outright, along with Prisma.raw, which splices text into a
    // template unescaped.
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name=/^\\$(queryRaw|executeRaw)Unsafe$/]",
          message: "Use the tagged template form ($queryRaw`...` / $executeRaw`...`): it parameterizes every value.",
        },
        {
          selector: "CallExpression[callee.object.name='Prisma'][callee.property.name='raw']",
          message: "Prisma.raw inserts text into SQL unescaped. Pass values as ${parameters} in a tagged template.",
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
    // Generated Prisma client:
    "src/generated/**",
  ]),
]);

export default eslintConfig;
