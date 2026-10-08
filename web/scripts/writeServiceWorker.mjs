import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const entryKeys = ['index.html', 'src/components/FarmCanvas.tsx', 'src/components/FarmGame.tsx'];
// ponytail: Only one season ahead is cached; more than one offline season change needs a connection.
const artKeys = [
  '../art/source/characters/farmer/farmer-walk-sheet.png',
  '../art/source/environment/props/raised-bed.png',
  '../art/source/environment/ground/sandy-path.png',
  '../art/source/environment/ground/meadow-ground.png',
  '../art/source/crops/spring/growth-sheet.png',
  '../art/source/animals/spring/chicken-pose-sheet.png',
  '../art/source/animals/spring/rabbit-pose-sheet.png',
];
const files = new Set(['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png']);
for (const key of [...entryKeys, ...artKeys]) {
  const asset = manifest[key];
  if (!asset?.file) throw new Error(`Missing PWA asset: ${key}`);
  files.add(`./${asset.file}`);
  if (entryKeys.includes(key)) for (const css of asset.css ?? []) files.add(`./${css}`);
}
const shell = [...files];
const seasonPacks = Object.fromEntries(['summer', 'rainy', 'autumn', 'winter'].map(season => {
  const keys = [
    `../art/source/crops/${season}/growth-sheet.png`,
    `../art/source/seasons/${season}/roster-sheet.png`,
    ...(season === 'autumn' || season === 'winter' ? [`../art/source/environment/ground/${season}-ground.png`] : []),
  ];
  return [season, keys.map(key => {
    if (!manifest[key]?.file) throw new Error(`Missing seasonal PWA asset: ${key}`);
    return `./${manifest[key].file}`;
  })];
}));
if (Object.values(seasonPacks).flat().some(file => shell.includes(file))) throw new Error('Future season art must stay out of the install cache');
const version = createHash('sha256').update(JSON.stringify(shell)).digest('hex').slice(0, 12);
const source = `const PREFIX = 'focus-valley-';
const SHELL = PREFIX + '${version}-shell';
const RUNTIME = PREFIX + '${version}-runtime';
const FILES = ${JSON.stringify(shell)};
const SEASON_PACKS = ${JSON.stringify(seasonPacks)};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== SHELL && key !== RUNTIME).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_SEASON' || !SEASON_PACKS[event.data.season]) return;
  event.waitUntil((async () => {
    const cache = await caches.open(RUNTIME);
    await Promise.all(SEASON_PACKS[event.data.season].map(async file => {
      if (await caches.match(file)) return;
      const response = await fetch(file);
      if (response.ok) await cache.put(file, response);
    }));
  })().catch(() => {}));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  if (!['script', 'style', 'image', 'manifest'].includes(request.destination)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(RUNTIME).then(cache => cache.put(request, copy)));
    }
    return response;
  })());
});
`;
await writeFile('dist/sw.js', source);
