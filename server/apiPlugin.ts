import type { Plugin } from 'vite';
import backup from '../api/backup';
import pdf from '../api/pdf';
import vision from '../api/vision';

export function dawamnaApiPlugin(): Plugin {
  return {
    name: 'jadwali-local-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/api/backup') return void backup(req, res);
        if (url === '/api/pdf') return void pdf(req, res);
        if (url === '/api/vision') return void vision(req, res);
        next();
      });
    },
  };
}
