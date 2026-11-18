import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { offlinePlugin } from './server/offlinePlugin';
import { dawamnaApiPlugin } from './server/apiPlugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), dawamnaApiPlugin(), offlinePlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
});
