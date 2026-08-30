/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        court: {
          DEFAULT: "#1e3a8a",
          dark: "#0f172a",
        },
      },
    },
  },
  plugins: [],
};
