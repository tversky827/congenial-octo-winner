import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Goldwater Care brand: navy #00263c + sky blue #97c0d5.
        brand: {
          50: "#eef5f9",
          100: "#d9e9f1",
          200: "#b9d6e5",
          300: "#97c0d5",
          400: "#6ba0bd",
          500: "#3f7ea1",
          600: "#1c5578",
          700: "#0d3f5e",
          800: "#00263c",
          900: "#001a2b",
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
