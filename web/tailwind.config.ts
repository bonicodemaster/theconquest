import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          950: "#06070a",
          900: "#0b0d12",
          800: "#11141b",
          700: "#1a1f29",
          600: "#252b38",
        },
        brand: {
          50:  "#eef2ff",
          400: "#7c8cff",
          500: "#5b6cff",
          600: "#4452f0",
          700: "#363cc7",
        },
      },
      boxShadow: {
        glow: "0 0 30px -5px rgba(124, 140, 255, 0.5)",
      },
      keyframes: {
        pop: {
          "0%":   { transform: "scale(0.9)", opacity: "0" },
          "60%":  { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        shine: {
          "0%":   { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        pop: "pop 0.3s ease-out",
        shine: "shine 3s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
