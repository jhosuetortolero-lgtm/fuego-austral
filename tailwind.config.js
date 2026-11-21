/** Tailwind — tokens da marca Fuego Austral.
 *  Recompilar após mudar classes no HTML/JS:  npm run build:css
 */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0A0A0B',
        surface: '#141416',
        brasa: '#E85D04',
        ember: '#F48C06',
        bone: '#F2EDE4',
      },
      fontFamily: {
        display: ['Anton', 'Oswald', 'Impact', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
