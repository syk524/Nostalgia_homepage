/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Neutral ink scale — DEFAULT is a warm gray (not near-black) to
        // match the softer "weight of paper" reference tone; numbered
        // shades are untouched.
        ink:    { DEFAULT: '#5c574d', 50: '#f7f7f6', 100: '#ececea', 200: '#d6d4d0', 300: '#b3b0aa', 400: '#8a8782', 500: '#6b6864', 600: '#524f4c', 700: '#3a3836', 800: '#282625', 900: '#1a1918' },
        // Neutral surface scale — 100 is the site's painted page background (#f1f1f1)
        scroll: { DEFAULT: '#e9e7e2', 50: '#faf9f7', 100: '#f1f1f1', 200: '#e9e7e2', 300: '#dbd8d1', 400: '#c2beb5', 500: '#a39e93', 600: '#847e72', 700: '#665f54', 800: '#494339', 900: '#2c2822' },
        // Error/danger accent
        ember:  { DEFAULT: '#b23b2c', 50: '#fbf0ee', 100: '#f4d6d0', 200: '#e8ac9f', 300: '#d8816c', 400: '#c65f45', 500: '#b23b2c', 600: '#8f2f23', 700: '#6c241b', 800: '#4a1813', 900: '#280d0a' },
        // Success accent
        sage:   { DEFAULT: '#5c7364', 50: '#f1f4f2', 100: '#dbe3dd', 200: '#b7c7bc', 300: '#93aa9a', 400: '#748c7c', 500: '#5c7364', 600: '#495c50', 700: '#37453c', 800: '#252e28', 900: '#131714' },
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans:    ['var(--font-roboto)', 'var(--font-noto-sans-kr)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-chivo-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        parchment: '0 2px 8px rgba(34,34,34,0.06), 0 1px 3px rgba(34,34,34,0.05)',
        lifted:    '0 8px 24px rgba(34,34,34,0.10), 0 2px 8px rgba(34,34,34,0.06)',
      },
    },
  },
  plugins: [],
}
