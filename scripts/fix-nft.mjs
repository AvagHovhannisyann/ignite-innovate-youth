/**
 * nf3 (nitro's file tracer) ships a minified copy of @vercel/nft inside its
 * own dist/node_modules. Node's cjs-module-lexer can't detect named exports
 * in that minified bundle, so `import { nodeFileTrace } from "@vercel/nft"`
 * throws during `vite build` with the Vercel preset. Removing the nested copy
 * lets resolution fall through to the real @vercel/nft in root node_modules
 * (declared in devDependencies). Runs on postinstall so Vercel builds get the
 * fix too.
 */
import { rmSync, existsSync } from "node:fs";

const nested = new URL("../node_modules/nf3/dist/node_modules", import.meta.url);
if (existsSync(nested)) {
  rmSync(nested, { recursive: true, force: true });
  console.log("[fix-nft] removed nf3's nested @vercel/nft (shadowed the real package)");
}
