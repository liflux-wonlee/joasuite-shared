import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "server/index": "src/server/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  // Everything app-level stays as peer; bundler in each app resolves.
  external: [
    "react",
    "react-dom",
    "@tanstack/react-query",
    "@tanstack/react-router",
    "@tanstack/react-start",
    "@supabase/supabase-js",
    "react-i18next",
    "i18next",
    "lucide-react",
    "sonner",
    "zod",
  ],
});
