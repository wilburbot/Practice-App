/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        court: {
          DEFAULT: "#ea580c",
          dark: "#0f172a",
          light: "#fff7ed",
        },
      },
    },
  },
  plugins: [],
};
