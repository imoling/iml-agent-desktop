/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                // Custom Vibe Coding palette placeholders
                primary: "#3b82f6",
                secondary: "#64748b",
            },
        },
    },
    plugins: [],
}
