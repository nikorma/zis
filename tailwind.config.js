/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Identità "Zaino in Spalla": i nomi storici restano validi (rimappati)
        terra: { DEFAULT: '#FF6B4A', deep: '#E14E2E', soft: '#FF9A7E' },   // corallo tramonto
        crema: '#F6EEDF',                                                  // sabbia
        oro: { DEFAULT: '#FFC145', tenue: '#FFE0A3' },                     // sole
        azul: '#2A3A63',
        notte: '#141C33',
        dusk: { DEFAULT: '#1E2A4A', light: '#2A3A63' },                    // blu zaino
        sunset: { DEFAULT: '#FF6B4A', deep: '#E14E2E' },
        sabbia: '#F6EEDF',
        sole: '#FFC145',
        menta: '#3FBF9B',
        ink: '#22293B',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['"Albert Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
