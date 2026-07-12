import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

function vendorChunk(id: string) {
  if (!id.includes("/node_modules/")) return undefined;
  if (
    id.includes("/node_modules/react/") ||
    id.includes("/node_modules/react-dom/") ||
    id.includes("/node_modules/scheduler/")
  )
    return "react-runtime";
  if (id.includes("/@supabase/")) return "supabase";
  if (id.includes("/recharts/") || id.includes("/d3-") || id.includes("/victory-vendor/"))
    return "charts";
  if (id.includes("/remotion/") || id.includes("/@remotion/")) return "remotion";
  if (id.includes("/date-fns/")) return "dates";
  if (id.includes("/zod/")) return "validation";
  return undefined;
}

// Standalone Vite config targeting Vercel (Build Output API via Nitro).
// Replaces @lovable.dev/vite-tanstack-config, which pinned the build to
// Cloudflare Workers. Plugin order mirrors the old wrapper: tailwind →
// tsconfig paths → TanStack Start → nitro (build only) → react.
export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts wraps the framework server entry with branded 5xx pages.
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    ...(command === "build" ? [nitro({ preset: "vercel" })] : []),
    viteReact(),
  ],
  build: {
    rollupOptions: {
      output: { manualChunks: vendorChunk },
    },
  },
}));
