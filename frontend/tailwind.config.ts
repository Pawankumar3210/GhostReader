import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", md: "2rem", xl: "3rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        paper: {
          DEFAULT: "rgb(var(--gr-paper) / <alpha-value>)",
          deep: "rgb(var(--gr-paper-deep) / <alpha-value>)",
          soft: "rgb(var(--gr-paper-soft) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--gr-ink) / <alpha-value>)",
          soft: "rgb(var(--gr-ink-soft) / <alpha-value>)",
          muted: "rgb(var(--gr-ink-muted) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--gr-accent) / <alpha-value>)",
          dark: "rgb(var(--gr-accent-dark) / <alpha-value>)",
          soft: "rgb(var(--gr-accent-soft) / <alpha-value>)",
        },
        forest: {
          DEFAULT: "rgb(var(--gr-forest) / <alpha-value>)",
          light: "rgb(var(--gr-forest-light) / <alpha-value>)",
          soft: "rgb(var(--gr-forest-soft) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "rgb(var(--gr-gold) / <alpha-value>)",
          soft: "rgb(var(--gr-gold-soft) / <alpha-value>)",
        },
        line: "rgb(var(--gr-line) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"Newsreader Variable"', "Newsreader", "Georgia", "ui-serif", "serif"],
        kannada: ['"Noto Sans Kannada"', "Noto Sans", "sans-serif"],
      },
      fontSize: {
        "display-sm": [
          "clamp(2.2rem, 5vw, 3.4rem)",
          { lineHeight: "1.02", letterSpacing: "-0.03em" },
        ],
        display: ["clamp(3rem, 8vw, 6.4rem)", { lineHeight: "0.95", letterSpacing: "-0.04em" }],
      },
      boxShadow: {
        card: "0 1px 0 rgba(27, 24, 20, 0.05), 0 18px 50px -28px rgba(27, 24, 20, 0.28)",
        lift: "0 30px 80px -42px rgba(27, 24, 20, 0.45)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.6)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(-1deg)" },
          "50%": { transform: "translateY(-12px) rotate(1deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        drift: {
          "0%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(2%, -3%, 0) scale(1.04)" },
          "100%": { transform: "translate3d(0,0,0) scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        float: "float 7s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
        drift: "drift 18s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
