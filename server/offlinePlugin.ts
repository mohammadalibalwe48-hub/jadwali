import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

export function offlinePlugin(): Plugin {
  return {
    name: 'jadwali-offline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const files = ['/', '/brand/mark.svg', '/manifest.webmanifest', '/icons/192.png', '/icons/512.png', '/icons/apple-touch.png',
        ...Object.keys(bundle).filter((name) => name.startsWith('assets/')).sort().map((name) => '/' + name)];
      const hash = createHash('sha256').update(JSON.stringify(files)).update(readFileSync('index.html'));
      for (const file of files.filter((name) => name.startsWith('/icons/') || name.startsWith('/brand/') || name.endsWith('.webmanifest'))) {
        hash.update(readFileSync('public' + file));
      }
      const version = hash.digest('hex').slice(0, 16);
      this.emitFile({
        type: 'asset', fileName: 'sw.js', source: `
const prefix = 'jadwali-app-';
const shell = prefix + '${version}';
const files = ${JSON.stringify(files)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(shell)
    .then((cache) => cache.addAll(files.map((path) => new Request(path, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  // Keep the previous asset cache for tabs that still have the previous version open.
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith(prefix) && key !== shell).slice(0, -1).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(shell).then((cache) => cache.match('/')).then((response) => response || fetch(event.request)));
  } else if (files.includes(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.open(shell).then((cache) => cache.match(url.pathname))
      .then((response) => response || caches.match(url.pathname))
      .then((response) => response || fetch(event.request)));
  }
});
` });
    },
  };
}
