import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ember: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        sage: {
          50: "#f6f7f4",
          100: "#e8ebe3",
          200: "#d1d7c8",
          300: "#b0bba3",
          400: "#8f9c7f",
          500: "#728063",
          600: "#59664d",
          700: "#46513e",
          800: "#3a4234",
          900: "#32382d",
        },
        cream: {
          50: "#fefdfb",
          100: "#faf6f0",
          200: "#f5ebe0",
          300: "#ead9c8",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(60, 40, 20, 0.08), 0 4px 12px rgba(60, 40, 20, 0.06)",
        "card-hover":
          "0 2px 8px rgba(60, 40, 20, 0.1), 0 8px 24px rgba(60, 40, 20, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
