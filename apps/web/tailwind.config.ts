import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0A1224",
          900: "#0F1B31",
          800: "#16243F",
          700: "#1F3050",
          600: "#2A3D62",
        },
        ink: {
          DEFAULT: "#0F1B31",
          soft: "#33415A",
        },
        muted: {
          DEFAULT: "#64748B",
          light: "#94A3B8",
        },
        canvas: "#F5F7FA",
        line: {
          DEFAULT: "#E6E8EE",
          strong: "#D5D9E2",
        },
        danger: {
          50: "#FFF1F2",
          100: "#FFE4E6",
          500: "#E11D48",
          600: "#C81E45",
        },
        warning: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          500: "#F97316",
          600: "#EA580C",
        },
        success: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          500: "#10B981",
          600: "#059669",
        },
        info: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#3B82F6",
          600: "#2563EB",
        },
        violet: {
          50: "#F5F3FF",
          100: "#EDE9FE",
          600: "#7C3AED",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 27, 49, 0.04), 0 2px 10px rgba(15, 27, 49, 0.04)",
        "card-hover": "0 2px 4px rgba(15, 27, 49, 0.06), 0 10px 28px rgba(15, 27, 49, 0.09)",
        pop: "0 12px 40px rgba(15, 27, 49, 0.18)",
        glow: "0 0 0 10px rgba(225, 29, 72, 0.12), 0 0 48px rgba(225, 29, 72, 0.35)",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulse_ring: {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.5)", opacity: "0" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 220ms ease-out both",
        "pulse-ring": "pulse_ring 1.6s ease-out infinite",
        wave: "wave 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
