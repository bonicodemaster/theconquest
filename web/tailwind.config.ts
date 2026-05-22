import type { Config } from "tailwindcss";

/**
 * "Pavillon" direction — editorial atlas. Cream paper, ink black, a single
 * coral accent + a 6-colour player palette. Fraunces (serif display),
 * Inter Tight (sans), JetBrains Mono (data/labels). Crisp borders, no glass.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter Tight", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Fraunces", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        // Back-compat aliases used across older markup.
        display: ["var(--font-serif)", "Fraunces", "Georgia", "serif"],
        body: ["var(--font-sans)", "Inter Tight", "system-ui", "sans-serif"],
      },
      colors: {
        paper: "#faf7f0",
        panel: "#ffffff",
        "panel-soft": "#f5f1e8",
        mute: "#86827b",
        // Hairline borders — soft & Apple-like instead of solid black rules.
        line: "rgba(28,28,30,0.10)",
        "line-strong": "rgba(28,28,30,0.18)",
        land: "#eae5da",
        "land-hover": "#dcd6c8",
        accent: { DEFAULT: "#d4541c", soft: "#e0662e", deep: "#b8460f" },
        // Six player colours (coral / ocean / forest / mustard / plum / teal).
        player: {
          1: "#d4541c",
          2: "#2a5f8d",
          3: "#3d6b3a",
          4: "#b88a2a",
          5: "#6b3a5f",
          6: "#2a7a7a",
        },
        ink: {
          DEFAULT: "#1c1c1e",
          950: "#141416",
          900: "#1c1c1e",
          800: "#2a2a2c",
          700: "#3a3a3c",
          600: "#4a4a4c",
        },
        // Repointed to coral so any lingering brand-* utilities stay on-palette.
        brand: {
          50: "#fdf0e9",
          400: "#e0662e",
          500: "#d4541c",
          600: "#b8460f",
          700: "#933808",
        },
      },
      boxShadow: {
        glow: "0 8px 32px -4px rgba(212, 84, 28, 0.30)",
        soft: "0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.04)",
        elevated: "0 4px 12px rgba(0,0,0,.05), 0 16px 40px rgba(0,0,0,.08)",
        paper: "0 4px 16px rgba(28, 28, 30, 0.06)",
        toast: "0 8px 24px rgba(28, 28, 30, 0.16)",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "60%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        slideIn: {
          from: { transform: "translateX(-20px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        riseIn: {
          from: { transform: "translateY(16px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-6px)" },
          "75%": { transform: "translateX(6px)" },
        },
        flashpulse: {
          "0%": { transform: "scale(0.5)", opacity: "1" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        blink: { "50%": { borderColor: "transparent" } },
      },
      animation: {
        pop: "pop 0.3s ease-out",
        slideIn: "slideIn 0.3s cubic-bezier(.2,.7,.3,1)",
        riseIn: "riseIn 0.45s cubic-bezier(.2,.7,.3,1)",
        shake: "shake 0.3s",
        flashpulse: "flashpulse 0.7s ease-out forwards",
        blink: "blink 1s step-end infinite",
      },
    },
  },
  plugins: [],
};
export default config;
