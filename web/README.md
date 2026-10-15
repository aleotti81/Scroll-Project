# Scroll Studio configuratore

Frontend-only configuratore per siti scroll-telling cinematici. Non invia file, non chiama servizi AI e conserva le bozze soltanto nel browser.

## Avvio

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000). Il wizard si trova in `/crea`.

## Verifica

```bash
npx eslint .
npx tsc --noEmit
npm run build
npx vitest run
npx playwright test
```

Le unit test usano Vitest. Playwright avvia il server di sviluppo e verifica Desktop Chrome, Pixel 7 e iPhone 14 (Chromium).
