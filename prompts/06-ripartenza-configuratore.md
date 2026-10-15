# Prompt di ripartenza — Configuratore `/crea` e clip AI (stato al 15/10/2026)

Agisci come lead developer e product engineer. Lavoriamo nel repo **https://github.com/aleotti81/Scroll-Project**, app Next.js nella cartella `web/`.

**Come lavorare con me**
- Rispondi in italiano, breve.
- Procedi a piccoli passi, con bozze rapide e frequenti: a ogni passo ti fermi, mi mostri un'anteprima o uno screenshot e aspetti il mio OK.
- Fai solo ciò che chiedo: niente extra non richiesti e niente decorazioni/etichette di servizio nel sito generato.
- Prima di spendere credito fal.ai mostrami il costo stimato e chiedi l'OK. Prima una clip di prova, poi una alla volta.
- Lavora sempre su un branch nuovo con PR; il merge lo faccio io.

## Obiettivo del prodotto
Startup/SaaS che trasforma il materiale di una struttura turistica o di un immobile (foto, video, sito esistente) in un **sito one-page cinematico in scroll-telling**, pronto all'uso, con header e footer coerenti con il sito del cliente. Il pilota è Happy Tuscany (https://www.happytuscany.it). Contesto generale e decisioni precedenti: `prompts/A-sessione-scrolltelling-saas.md`, `prompts/04-prompt-definitivo-devin.md`, `prompts/05-prompt-form-configuratore.md`.

## Cosa esiste già (tutto su `main`, PR #1–#4 unite)
Configuratore **`/crea`**: wizard in 5 step (Progetto → Contatti e SEO → Stile → Sezioni → Riepilogo).
- Modello dati in `web/lib/schema.ts` (zod), da 1 a 12 sezioni. Bozza salvata in localStorage (`scroll-studio-configuratore-v1`); export `brand.json` + `scenes.json`.
- **Tipi di sezione**
  - **A**: una foto fissa + `text1` + `text2`. Scrollando, `text1` sfuma e compare `text2`.
  - **B**: video che avanza con lo scroll + testo finale in dissolvenza.
  - **C**: video che avanza con lo scroll + testo laterale sovrapposto (in basso su mobile).
- **Media B/C**: un video caricato, oppure due foto (iniziale e finale) da cui si genera una clip AI. "Collega alla precedente" usa come foto iniziale la foto finale della sezione prima.
- **Testi**: ogni testo ha l'interruttore Manuale/AI. La generazione AI dei testi **non è ancora collegata**: in anteprima compare la descrizione ("brief") scritta dall'utente.
- **Anteprima del sito** (`web/app/components/site-preview.tsx`): dialog a schermo intero, sezioni da `300vh` con stage sticky, scrub del video ammorbidito (lerp 0,12, nessun seek mentre `video.seeking`, clip caricate come blob).
- **Header/footer dal sito esistente**: `POST /api/site-import` (`web/lib/site-import.ts`, cheerio, protezioni SSRF) legge logo, menu, contatti, social e righe legali. Se l'URL manca o la lettura non riesce, li costruisce dai dati del form. Su happytuscany.it il logo letto è solo il simbolo dell'albero e i social non ci sono.
- **Clip AI reali con fal.ai**: modello `fal-ai/bytedance/seedance/v1.5/pro/image-to-video` (`web/lib/fal-video.ts`).
  - `POST /api/video-clips` (multipart `startImage`, `endImage`, `durationSec` "5"|"10", `prompt` facoltativo) → `fal.storage.upload` + `fal.queue.submit` con 1080p, 16:9, senza audio → `{ requestId }`.
  - `GET /api/video-clips/:id` → queued | running | done | error. A clip completata il server la scarica (solo host `*.fal.media`) e la ricodifica **all-intra** (`ffmpeg -an -c:v libx264 -crf 23 -g 1`) in `web/.generated-clips/` (ignorata da git).
  - `GET /api/video-clips/:id/file` serve la clip.
  - Il client controlla lo stato ogni 5 s (timeout 10 min) e salva `{ videoUrl, requestId }` in localStorage `scroll-studio-clips-v1`.
  - Dialog di conferma: "Conferma e genera · totale", con l'avviso che la spesa è reale.
- **Costi**: circa 0,058 $/s, cioè circa 0,29 $ per una clip da 5 s (1080p senza audio, 1,2 $ per milione di token; `web/lib/cost.ts`).

## Ambiente
- Su Devin, Node non è nel PATH: eseguire prima `source ~/.nvm/nvm.sh`. Il blueprint del repo fa già `npm install` in `web/`.
- Chiave fal: secret permanente `secret:personal:FAL_KEY`. Non arriva da sola nell'ambiente: va passata nel binding `env` quando si avvia `npm run dev`, altrimenti le route video rispondono 503. Non va mai esposta né scritta su file.
- Controlli: `npx eslint . && npx tsc --noEmit` · `npx vitest run` (59 test) · `npx playwright test --workers=1` (30 test: Desktop Chrome, Pixel 7, iPhone 14) · `npm run build`. Su GitHub non ci sono controlli automatici.
- `web/AGENTS.md`: questa versione di Next (16) ha API diverse, quindi leggere `web/node_modules/next/dist/docs/` prima di modificare il codice Next.

## Materiale prodotto
- Prima clip reale generata dal configuratore: request `01a14153-1ef8-79c1-89ac-d3006a57fbc9`, versione all-intra salvata in `lavoro/FASE-3/v2/clip-01a14153-allintra.mp4` (7,5 MB).
- Clip pilota precedente e pagina di test: `lavoro/FASE-3/v1/`. One page statica in stile Happy Tuscany: `lavoro/ONEPAGE/v1/`.

## Problemi aperti (da qui si riparte)
1. **Clip già generata persa dopo il ricaricamento della pagina**. Ricaricando, il browser perde le foto e il configuratore chiede "Ricarica le foto". Quando le si ricarica, ricevono un nuovo `id` casuale: la chiave della clip (`clipInputKey` in `configurator-wizard.tsx`) cambia e la clip già pagata viene scartata, quindi bisognerebbe pagarla di nuovo. Correzione proposta: identificare le foto per contenuto (nome + dimensione + lastModified, oppure un hash) invece che per `id`, e far restare valida la clip anche quando le foto mancano.
2. **Fluidità dello scroll** da verificare con me sulla clip all-intra. Se va ancora a scatti, valutare Lenis, oppure una sequenza di immagini disegnata su canvas (soprattutto per Safari).
3. **Generazione AI dei testi** (modalità "AI") non ancora collegata.
4. **Video caricati dall'utente** (tipo C, sorgente video) non ricodificati all-intra: potrebbero andare a scatti.
5. **Pubblicazione** del sito finale (export statico, hosting) e flusso SaaS completo (account, progetti, pagamenti) ancora da progettare.
6. **Salvataggio delle foto** solo in memoria del browser: per la SaaS serve uno storage lato server.
