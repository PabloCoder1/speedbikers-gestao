/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sbblue: "#1e47ba",
        sbnavy: "#112a5d",
        sbred: "#dc3434",
        sbgold: "#e8890b",
        ink: "#16233a",
        muted: "#6b7a93",
        line: "#e6eaf0",
        ground: "#f6f8fb",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "Inter", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
