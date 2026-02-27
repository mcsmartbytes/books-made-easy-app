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
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Corporate color palette
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        corporate: {
          dark: '#0f172a',    // Slate 900
          navy: '#1e293b',    // Slate 800
          slate: '#334155',   // Slate 700
          gray: '#64748b',    // Slate 500
          light: '#f1f5f9',   // Slate 100
          white: '#f8fafc',   // Slate 50
        },
        success: '#059669',   // Emerald 600
        warning: '#d97706',   // Amber 600
        danger: '#dc2626',    // Red 600
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
