import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The design system intentionally uses literal "// text" section eyebrows
      // (e.g. <span>// About</span>), which this rule flags as stray JSX comment
      // textnodes. It's a deliberate visual motif across the app, so we turn it
      // off rather than rewrite every eyebrow.
      "react/jsx-no-comment-textnodes": "off",
      // This app's client components load data inside useEffect (a `load()`
      // that calls the API and setState's the result — the same thing
      // react-query/SWR do under the hood). The React Compiler's
      // `set-state-in-effect` rule flags the post-await setState in these
      // data-loading effects as if it were a synchronous render cascade, which
      // they are not. We scope-disable it and keep it mentally on for genuine
      // synchronous setState-during-render bugs.
      "react-hooks/set-state-in-effect": "off",
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
]);

export default eslintConfig;
