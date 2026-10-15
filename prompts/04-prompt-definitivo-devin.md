# PROMPT DEFINITIVO — Rielaborazione scroll-cinematica di un sito turistico (per Devin)

## Ruolo e obiettivo
Agisci come direttore della fotografia, video editor (FFmpeg) e frontend developer senior (Next.js, GSAP, Lenis).

Obiettivo: realizzare UN sito scroll-cinematico per la struttura indicata. Scorrendo, la camera viaggia in modo continuo attraverso la proprietà; scorrendo indietro, il viaggio si riavvolge. **La priorità assoluta è la fluidità del movimento.**

## Sorgente del materiale (una o entrambe)
- **Cartella:** foto e video che allego (`input/`).
- **Sito esistente:** `URL: ________`. Fai scraping del sito ed estrai:
  - immagini alla massima risoluzione disponibile (controlla srcset e originali)
  - video
  - testi, servizi, contatti, link di prenotazione
  - logo, palette e font

  Salva tutto in `input/scraping/`, con l'URL di origine di ogni file. In questo caso il prodotto finale è la **rielaborazione scroll-cinematica del sito esistente**, con gli stessi contenuti.

## Regole di supervisione
1. Una fase alla volta. A fine fase **FERMATI**, mostrami il risultato e attendi il mio comando:
   - `OK FASE X` per approvare e passare alla successiva
   - `CORREGGI FASE X: …` per rifare solo quella fase
   - `TORNA A FASE X` per ripartire da lì
2. Ogni versione va in `lavoro/FASE-X/vN/`: non sovrascrivere mai le versioni precedenti.
3. Le decisioni approvate stanno in `storyboard.json`, `clips.json` e `testi.json`. Rileggili a ogni fase.
4. **Clip per clip:** non generare mai più di una clip senza il mio OK. Prima di ogni generazione a pagamento mostra il costo stimato.
5. Se mancano fotogrammi di inizio o fine per un passaggio, o una foto è inadatta, **creali tu**: generazione/estensione AI di un'immagine coerente con la struttura. Segnali come "generati" in `clips.json`.
6. Non dichiarare finito nulla che non hai verificato nel browser o riproducendo il video.

## Fasi

**FASE 0 — Raccolta e inventario**
- Fai lo scraping (se c'è l'URL) e leggi la cartella.
- Consegna una tabella con: file, origine, risoluzione, orientamento, durata/fps, qualità.

**FASE 1 — Storyboard e percorso camera**
- Costruisci il percorso più credibile, per esempio: paesaggio dall'alto → esterni → ingresso → interni → uscita → finale aereo.
- Per ogni passaggio A → B indica:
  - movimento di camera
  - durata
  - ritmo di scroll (~100 vh per secondo di clip)
  - fotogrammi mancanti da creare
- Consegna `storyboard.json` + provino delle foto numerate con il percorso.

**FASE 2 — Fotogrammi chiave**
- Prepara ogni fotogramma iniziale/finale: raddrizzamento, colore uniforme, ritagli 16:9 e 9:16.
- Crea i fotogrammi mancanti.
- Consegna il confronto prima/dopo.

**FASE 3 — Clip pilota**
- Genera UNA sola clip, con un modello che supporti **primo + ultimo fotogramma** (Kling O3, Seedance 2.0 o Veo 3.1, via Higgsfield API o fal.ai). Se utile, confronta 2 modelli.
- Prompt di movimento in inglese: *"Slow, constant, physically plausible camera. Keep architecture, furniture and views consistent. No people, no text, no audio."*
- Applica subito anche la post-produzione della FASE 5 e la codifica della FASE 6.
- Monta una pagina di test con la sola clip scrubbata dallo scroll, per giudicare la fluidità reale.
- Consegna: clip, costo, difetti notati, pagina di test.

**FASE 4 — Clip successive, una alla volta**
- Ogni clip parte esattamente dall'ultimo fotogramma della precedente: la continuità è garantita per costruzione.
- Dopo ogni clip mostra:
  - anteprima
  - giunzione con la clip precedente (ultimo frame / primo frame affiancati)
  - costo
- Poi aspetta il mio OK.

**FASE 5 — Post-produzione per la fluidità** (su ogni clip e sui video reali)
- taglio
- stabilizzazione dei video reali (vidstab)
- **velocità costante**: elimina accelerazioni e rallentamenti agli estremi delle clip
- frame rate uniforme (24 o 30 fps)
- interpolazione RIFE solo se migliora lo scrub, controllando che non deformi le linee architettoniche
- colore uniforme
- giunzioni senza fotogrammi duplicati

Alla fine consegna il "film di anteprima" completo in riproduzione normale.

**FASE 6 — Codifica per lo scroll**
- Comando per ogni scena, all-intra (scrub istantaneo avanti e indietro):
  ```
  ffmpeg -i scena.mp4 -an -vf "fps=24,scale=W:H:flags=lanczos" -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -x264-params keyint=1:min-keyint=1:scenecut=0 -movflags +faststart out.mp4
  ```
- Varianti: 1920×1080, 1280×720 e 720×1280 mobile.
- Poster per ogni scena.
- Verifica con ffprobe che tutti i frame siano I-frame.
- Budget: prima scena ≤ 3 MB su mobile e ≤ 6 MB su desktop.

**FASE 7 — Testi**
- Riprendi e accorcia i testi del sito originale (o del brief).
- Per ogni scena: 1 titolo ≤ 6 parole + 1 riga ≤ 14 parole. Aggiungi meta SEO e tutte le lingue richieste.
- Niente cliché.
- Consegna `testi.json` + tabella.

**FASE 8 — Sito**
- Next.js + TypeScript, nel repo `aleotti81/windsurf`.
- Design: palette e logo del sito originale, serif editoriale + sans minimale, interfaccia minimale.
- Motore di scroll:
  - Lenis + GSAP ScrollTrigger (pin per scena)
  - un unico loop `requestAnimationFrame` che porta `video.currentTime` verso il target con lerp 0,1–0,2
  - il video non va mai in play
- Caricamento: ogni scena viene scaricata intera (Blob URL) prima dello scrub; precarica la successiva; poster sempre visibile, mai frame neri.
- Fallback:
  - sequenza WebP su canvas se Safari iOS va a scatti
  - modalità fotografica con `prefers-reduced-motion`
- Sezione finale con contatti e link di prenotazione del sito originale.

**FASE 9 — Test e pubblicazione**
- Prova nel browser, desktop e mobile (CPU rallentata 4×, rete 4G simulata): scroll lento, veloce e tutto all'indietro.
- Obiettivi: nessun salto o frame nero, frame persi < 5%, LCP < 2,5 s, CLS < 0,05.
- Deploy di anteprima su Vercel e link.

## Rapporto a fine fase (sempre uguale)
```
FASE X (vN) — Fatto | File | Da approvare | Problemi | Costo fase / totale | Decisioni richieste
→ In attesa di: OK / CORREGGI / TORNA A
```

Ora esegui solo la **FASE 0**.
