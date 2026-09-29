import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef0ff",
          100: "#e0e4ff",
          200: "#c7ccfe",
          300: "#a5a9fc",
          400: "#8583f8",
          500: "#6e63f1",
          600: "#5b48e5",
          700: "#4d39ca",
          800: "#3f31a3",
          900: "#362f81",
        },
        ink: {
          600: "#2b3050",
          700: "#1d2139",
          800: "#141729",
          900: "#0c0e1c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
