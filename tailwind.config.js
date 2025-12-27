const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: "class",
  plugins: [],
  theme: {
    extend: {
      fontSize: {
        sm: ["0.95rem", { lineHeight: "1.4rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.1rem", { lineHeight: "1.7rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      },
      colors: {
        // Off-pink/tan palette
        cream: {
          50: "#FFFDFB",
          100: "#FDF8F3",
          200: "#FAF0E6",
          300: "#F5E6D3",
          400: "#E8D5C4",
          500: "#D4C4B0",
        },
        blush: {
          50: "#FFF9F7",
          100: "#FFF0EB",
          200: "#FFE4DB",
          300: "#FFD4C7",
          400: "#E8B8A8",
        },
        ink: {
          50: "#F7F7F7",
          100: "#E3E3E3",
          200: "#C8C8C8",
          300: "#A4A4A4",
          400: "#818181",
          500: "#666666",
          600: "#515151",
          700: "#434343",
          800: "#383838",
          900: "#1A1A1A",
        },
        // Adobe-ish accent for links
        accent: {
          DEFAULT: "#E85D4C",
          light: "#F07563",
          dark: "#C94B3D",
          muted: "#D4847A",
        },
      },
      fontFamily: {
        display: ['"neue-haas-grotesk-display"', ...defaultTheme.fontFamily.sans],
        text: ['"neue-haas-grotesk-text"', ...defaultTheme.fontFamily.sans],
        serif: ['"Source Serif 4"', ...defaultTheme.fontFamily.serif],
      },
      spacing: {
        // 1:3:1 layout ratio helpers
        "layout-side": "20%",
        "layout-main": "60%",
      },
      screens: {
        xs: "375px",
        sm: "480px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "cursor-pulse": "cursorPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        cursorPulse: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
        },
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
};
