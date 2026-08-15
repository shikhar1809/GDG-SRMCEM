// Build used only by scripts/playtest.mjs. Swaps Firebase for local mocks so
// the games can be driven in a browser without touching the real project.
// Never used by `npm run build`.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const root = process.cwd();
const mock = (f) => path.resolve(root, 'scripts/playtest', f);

export default defineConfig({
  plugins: [
    {
      name: 'playtest-firebase-mocks',
      enforce: 'pre',
      resolveId(source) {
        if (source === 'firebase/firestore') return mock('firestore.js');
        if (source === 'firebase/auth') return mock('auth.js');
        if (/(^|\/)\.\.?\/firebase$/.test(source) || source.endsWith('/src/firebase.js')) {
          return mock('firebase.js');
        }
        return null;
      },
    },
    react(),
    tailwindcss(),
  ],
  build: { outDir: 'dist-playtest' },
});
