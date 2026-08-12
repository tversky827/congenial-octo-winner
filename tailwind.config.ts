import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f4",
          100: "#d6ece4",
          200: "#aed9cb",
          300: "#7cc0ac",
          400: "#4ba088",
          500: "#2f866f",
          600: "#236b59",
          700: "#1e5649",
          800: "#1a453c",
          900: "#163a33",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
