/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: "class",
  plugins: [],
  theme: {
    extend: {
      fontSize: {
        // Smallest documented step — labels, footnotes, captions, and all the
        // mono detail text standardize on this (replaces the old 0.7/0.72rem one-offs).
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.95rem", { lineHeight: "1.4rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.1rem", { lineHeight: "1.7rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
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
        // Bright orange — primary accent (keep)
        accent: {
          DEFAULT: "#E85D4C",
          // Lightened from #F07563, which was 6.16:1 on the ink-900 page but
          // only 4.15:1 on raised dark surfaces (dropdowns, the sheet), where
          // it carries the selected/active state. Dark theme only.
          light: "#F18272",
          dark: "#C9462F",
          muted: "#D4847A",
        },
        // Earth-tone label palette — cohesive with orange + cream
        sage: {
          DEFAULT: "#3D7A55",
          light: "#7BAE8C",
          dark: "#1F5234",
        },
        ochre: {
          DEFAULT: "#946410",
          light: "#DBA84D",
          dark: "#704A05",
        },
        wine: {
          DEFAULT: "#8A3251",
          // Lightened from #B96481, which was only 4.31:1 on ink-900 and
          // 3.46:1 on the neutral pill fill. The -light shades are dark-theme
          // only, so this doesn't touch any light-theme surface.
          light: "#C68098",
          dark: "#5E1F37",
        },
        steel: {
          DEFAULT: "#3A6A91",
          light: "#779BBE",
          dark: "#1F4567",
        },
        plum: {
          DEFAULT: "#6F4476",
          // Lightened from #A07CA8 (3.96:1 on the neutral pill fill).
          light: "#AA89B1",
          dark: "#4A2A50",
        },
        // Purple-gray for code blocks & secondary surfaces (future use)
        mist: {
          50: "#F5F5F7",
          100: "#EDEDF0",
          200: "#E7E7EB",
          300: "#DCDCE2",
          400: "#C5C5CD",
        },
      },
      // Three roles, defined once as CSS vars in app.css (:root). Keep these in
      // sync with that block — both resolve to the same stacks.
      //   display → Neue Haas Grotesk  (headlines / big headers)
      //   serif   → Optima             (subheads + body / reading text)
      //   mono    → system monospace   (nav, buttons, controls, labels, details)
      fontFamily: {
        display: ["var(--font-display)"],
        serif: ["var(--font-prose)"],
        mono: ["var(--font-mono)"],
      },
      // Tailwind's stock `ring-*`/`ring-offset-*` default to blue-500 and
      // white. Nothing in the design system should use a ring — focus is a
      // single `:focus-visible` outline in app.css — but if a stray `ring-2`
      // ever appears, it lands on palette colours instead of off-brand blue.
      ringColor: {
        DEFAULT: "#C9462F",
      },
      ringOffsetColor: {
        DEFAULT: "#FDF8F3",
      },
      screens: {
        xs: "375px",
        sm: "480px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
  },
};
