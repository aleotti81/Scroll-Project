# Prompt sessione A — Sito scroll-telling e SaaS

Agisci come lead developer e product engineer. Lavoriamo nel repo **https://github.com/aleotti81/Scroll-Project**. Rispondi in italiano, in modo breve. Procedi **a piccoli passi**: a ogni passo ti fermi, mi mostri qualcosa (anteprima o screenshot) e aspetti il mio OK. Prima di spendere credito AI (fal.ai, `FAL_KEY` già salvata come secret) mostrami il costo stimato e chiedi l'OK.

## Obiettivo
Startup che trasforma il materiale di una struttura turistica o di un immobile (foto, video oppure scraping del sito esistente) in un **sito one-page cinematico, con video che avanza con lo scroll**. Prima vogliamo un sito singolo che funzioni e sia gradevole, poi una **SaaS**: il cliente carica le foto, definisce le sezioni, approva video e testi e ottiene il sito pubblicato.

## Cosa esiste già (pilota Happy Tuscany, https://www.happytuscany.it)
- `prompts/04-prompt-definitivo-devin.md`: prompt unico a fasi (0–9) con stop e approvazione a ogni fase. Sorgente: una cartella oppure lo scraping di un sito. Fotogrammi mancanti creati con l'AI. Priorità alla fluidità. Clip pilota, poi una clip alla volta.
- `input/scraping/`: HTML, testi, 40 foto originali, font e CSS del sito.
- `lavoro/SCRAPING/v1/brand.json`: parametri del brand.
  - Font: Architects Daughter (testi), Schoolbell (menu, bottoni, titoli), Sail (logo); icone Adventure Tours e FontAwesome 4.7.
  - Colori: #758d15 (verde), #7ad03a (hover), #333 (testo), #9a9a9a (descrizioni), #f6f6f6 (sfondo), #0a0808 (header), #e0dcd3 (footer).
- `lavoro/FASE-2/v1`, `lavoro/FASE-3/v1`: clip pilota (deck → bordo piscina), Seedance 1.5 Pro primo+ultimo fotogramma, 5 s, circa 0,29 $. Codifica all-intra per lo scrub, desktop 6 MB e mobile 3,3 MB, più una pagina di test. Difetto: gli spritz "saltano" tra le due foto.
- `lavoro/ONEPAGE/v1/index.html`: one page statica con lo stile del sito originale (font, icone, colori, sezioni, footer, WhatsApp) e la clip pilota in apertura.

## Decisioni tecniche già prese
- Clip concatenate con **primo e ultimo fotogramma** (Kling O3, Seedance, Veo 3.1 via fal.ai), così si raccordano senza tagli.
- Codifica per lo scroll: ogni fotogramma completo (all-intra / GOP 1), una versione desktop e una mobile. La scena diventa scrollabile solo dopo che il video è scaricato tutto (fetch → blob) e si precarica la scena successiva. Se Safari va a scatti, si ripiega su una sequenza di immagini disegnata su canvas.
- Stack previsto per la SaaS: Next.js + GSAP ScrollTrigger + Lenis. Il codice resta nostro, niente Lovable. Il repo `aleotti81/windsurf` (Next.js, "Scroll Website Engine") è un riferimento.
- Costo stimato per sito: circa 10–35 $ di generazione video, rigenerazioni comprese.

## Prossimi passi (uno alla volta, con OK)
1. Rileggere il materiale esistente e propormi una **specifica della SaaS** di una pagina, che spieghi:
   - flusso utente: upload → inventario → storyboard → clip → testi → sito;
   - struttura dati: progetto, scene, clip, testi, versioni;
   - pipeline video;
   - hosting e costi.
2. Template del sito parametrico: le sezioni e i colori/font si leggono da un JSON (basta `brand.json` più un file delle scene), con la one page attuale come primo tema.
3. Ingestione: scraping automatico del sito oppure upload di cartella o zip, poi inventario delle foto.
4. Storyboard e pipeline clip (fal.ai), clip per clip, con un'anteprima e un'approvazione per ogni clip.
5. Editor minimale: approvazione di clip e testi, riordino delle sezioni.
6. Pubblicazione: build statico per cliente, in anteprima su Vercel.

Non toccare la parte "mappa interattiva" (`lavoro/MAPPA-2D/`): la seguo in un'altra sessione. Più avanti la mappa diventerà una sezione del sito.
