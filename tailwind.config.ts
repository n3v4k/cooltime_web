import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          50: "#eff9ff",
          100: "#dcf2ff",
          200: "#b3e6ff",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
        },
        coral: {
          400: "#ff8a70",
          500: "#ff6b4d",
          600: "#f04d2e",
        },
        tier: {
          normal: "#22c55e",
          caution: "#eab308",
          warning: "#f97316",
          danger: "#ef4444",
          extreme: "#991b1b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Pretendard", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fill-bar": {
          "0%": { width: "0%" },
          "100%": { width: "var(--fill-to, 100%)" },
        },
        "pulse-ring": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fill-bar": "fill-bar 1s ease-out forwards",
        "pulse-ring": "pulse-ring 1.6s ease-in-out infinite",
        "slide-up": "slide-up 0.4s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
