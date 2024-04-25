import * as path from "path"
import dts from "vite-plugin-dts";
import { defineConfig } from "vite"

export default defineConfig({
  build: {
    outDir: "./dist",
    lib: {
      entry: path.resolve(__dirname, "./src"),
      formats: ["cjs", "es"],
      fileName: (format) => {
        const map = {
          cjs: "cjs",
          es: "mjs"
        }
        return `index.${map[format]}`
      }
    },
  },
  plugins: [
    dts({ include: ["./src"] }),
  ],
})