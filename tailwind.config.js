module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#C6B6F7',
        primaryDark: '#B9A7F6',
        primaryLight: '#E3D8FF',
        secondary: '#F6F68F',
        surface: '#F5F3FF',
        onPrimary: '#2B2250',
        onSurface: '#3A2B6B',
        accent: '#F6F6C6',
        tertiary: '#B6E3F7',
        surfaceVariant: '#F3F0FF',
        outline: '#D1C4E9',
        onSurfaceVariant: '#6B5CA5',
      }
    },
  },
  plugins: [],
}; 