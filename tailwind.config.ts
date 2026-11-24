import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pit: {
          bg: "#17191e",
          raised: "#21242b",
          sunken: "#12141a",
          line: "#343842",
          text: "#f3f0e8",
          muted: "#a7a297",
          dim: "#7c786f",
          red: "#e23b32",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Avenir Next", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "Avenir Next Condensed", "Arial Narrow", "sans-serif"],
        mono: ["var(--font-mono)", "SFMono-Regular", "ui-monospace", "monospace"],
      },
      boxShadow: {
        pit: "0 12px 40px rgba(0,0,0,0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
