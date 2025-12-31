/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'g3-cyan': '#00f3ff',
        'g3-green': '#4caf50',
        'g3-black': '#010401',
        'g3-dark': '#0a1a0a',
      },
      fontFamily: {
        'orbitron': ['Orbitron', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'rotorse-alpha': 'rotorse-alpha 10s linear infinite',
        'rotorse-beta': 'rotorse-beta 60s linear infinite',
      },
      keyframes: {
        'rotorse-alpha': {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '50%': { transform: 'rotate(180deg) scale(1.05)' },
          '100%': { transform: 'rotate(360deg) scale(1)' },
        },
        'rotorse-beta': {
          '0%': { transform: 'rotate(360deg) scale(1.1)' },
          '50%': { transform: 'rotate(180deg) scale(0.95)' },
          '100%': { transform: 'rotate(0deg) scale(1.1)' },
        },
      },
    },
  },
  plugins: [],
}
