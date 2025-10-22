/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
    "./node_modules/preline/dist/*.js",
  ],
  theme: { extend: {} },
  plugins: [require("@preline/tailwindcss")],
};
