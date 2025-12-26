const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: "class",
  plugins: [],
  theme: {
    extend: {
      fontSize: {
        sm: ["0.95rem", { lineHeight: "1.3rem" }],
        base: ["1rem", { lineHeight: "1.3rem" }],
        lg: ["1.05rem", { lineHeight: "1.6rem" }],
        xl: ["1.2rem", { lineHeight: "1.5rem" }],
      },
      colors: {
        mint: "#f2fcf8",
        darkmint: "#ebfff5",
      },
      screens: {
        sm: "420px",
        md: "600px",
        lg: "768px",
      },
    },
  },
};
