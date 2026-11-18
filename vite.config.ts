import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { dawamnaApiPlugin } from './server/apiPlugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), dawamnaApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
});
