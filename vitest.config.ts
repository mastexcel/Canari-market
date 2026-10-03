import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Les tests d'intégration partagent une base PostgreSQL : exécution séquentielle des fichiers.
    fileParallelism: false,
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/application/**"],
      reporter: ["text-summary", "html"],
    },
  },
});
