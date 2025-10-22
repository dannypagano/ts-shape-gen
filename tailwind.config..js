// tailwind.config.cjs
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    // Preline components (if you use any)
    "./node_modules/preline/dist/*.js",
  ],
  theme: { extend: {} },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@preline/plugin"), // <— updated
  ],
};
