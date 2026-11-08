/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./client/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border, 240 3.7% 15.9%))",
        background: "hsl(var(--background, 240 10% 3.9%))",
        foreground: "hsl(var(--foreground, 0 0% 98%))",
        card: "hsl(var(--card, 240 10% 6%))",
        accent: {
          DEFAULT: "#4f46e5",
          hover: "#4338ca",
          muted: "rgba(99, 102, 241, 0.15)",
        },
        emerald: {
          DEFAULT: "#10b981",
          muted: "rgba(16, 185, 129, 0.15)",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      }
    },
  },
  plugins: [],
}

