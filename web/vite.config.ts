import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Le site importe le vrai cœur (../src) et le semis (../seed) : on autorise Vite à
// servir toute la racine du dépôt, pas seulement web/.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  // base relatif : le site est servi sous https://<user>.github.io/gammes/
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  server: { fs: { allow: [repoRoot] } },
});
