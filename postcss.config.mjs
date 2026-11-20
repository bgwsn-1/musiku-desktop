/** Tailwind CSS 4 through PostCSS.
 *
 *  `next dev` runs Tailwind through the Turbopack rule in next.config.ts, but
 *  `next build --webpack` (the production build) has no such rule — without
 *  this file the utilities are never generated and the deployed page ships
 *  unstyled. Keeping both paths configured makes dev and build agree.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
