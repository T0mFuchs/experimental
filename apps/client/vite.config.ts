import { defineConfig } from "vite";
import unocss from "unocss/vite";
import { presetMini, presetIcons } from "unocss";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react-swc";
import conditionalCompile from "vite-plugin-conditional-compiler";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    unocss({
      presets: [
        presetMini({
          // enable media variants
          dark: "media",
        }),
        presetIcons({
          extraProperties: {
            display: "inline-block",
            "vertical-align": "middle",
          },
        }),
      ],
    }),
    react(),
    conditionalCompile(),
  ],
  build: {
    target: "esnext",
  },
  esbuild: {
    jsxFactory: "h",
    jsxFragment: "Fragment",
    jsxInject: "import { h } from 'preact';",
  },
  resolve: {
    alias: {
      "react/jsx-runtime.js": "preact/compat/jsx-runtime",
      react: "preact/compat",
      "react-dom/test-utils": "preact/test-utils",
      "react-dom": "preact/compat",
    },
  },
});
