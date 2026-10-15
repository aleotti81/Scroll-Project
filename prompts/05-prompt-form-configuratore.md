# Prompt di REVIEW — Form "Crea il tuo sito scroll-telling" (bozza v3)

> Fase di sola analisi: **non scrivere codice**. Produci una specifica e fermati per l'OK.

## Ruolo e regole
Agisci come product engineer + lead frontend. Repo: **github.com/aleotti81/Scroll-Project** (oggi contiene solo `input/`, `lavoro/`, `prompts/`, nessuna app). La pagina va in una **nuova app Next.js** nella cartella `web/` di questo repo (riferimento tecnico: `aleotti81/windsurf`). Rispondi in italiano, breve. Leggi prima `prompts/A-sessione-scrolltelling-saas.md`, `lavoro/SCRAPING/v1/brand.json`, `lavoro/ONEPAGE/v1/index.html`. Niente spesa AI (fal.ai) in questa fase. Non toccare `lavoro/MAPPA-2D/`.

## Obiettivo
Una pagina del sito della startup (es. `/crea`) con un form a step che raccoglie tutti i parametri per generare un sito one-page scroll-telling composto da **N sezioni**. Output del form = un JSON (`brand.json` + `scenes.json`) compatibile con il template parametrico (passo 2 del prompt A).

## Requisiti funzionali

### 1. Dati del progetto / brand
- **Sito esistente** (opzionale, un solo campo URL) con due spunte indipendenti:
  - "Replica il mio sito esistente": scraping di testi, foto, contatti per precompilare il form;
  - "Copia lo stile dal mio sito": scraping di colori, font, logo.
  - Se attive, i campi corrispondenti diventano facoltativi (saranno riempiti dallo scraping). Nel primo rilascio si salvano solo URL e spunte nel JSON; lo scraping vero arriva dopo.
- Nome struttura, logo (upload).
- Mission, senso/valori, target, tono di voce (menu: elegante, familiare, avventuroso, …), lingue del sito.
- Contatti: email, telefono, WhatsApp, indirizzo, social, CTA principale (es. "Prenota", link esterno).
- SEO base: titolo e descrizione pagina, **keyword primaria** (1) e **keyword secondarie** (fino a 5), usate anche come contesto per i testi generati da AI. Footer legale: ragione sociale, P.IVA, link privacy/cookie.

### 2. Stile
- **Coppia di colori** (primario + secondario) con color picker; sfondo e testo derivati automaticamente, con controllo contrasto WCAG AA e avviso. In alternativa spunta **"Lascia scegliere all'AI"** (salvato come `"ai"` nel JSON, scelta fatta in una fase successiva).
- **Font**: menu a tendina di abbinamenti curati Google Fonts (titoli + testo), con anteprima live. In alternativa spunta **"Lascia scegliere all'AI"**.
- Priorità della sorgente stile: "Copia lo stile dal mio sito" > scelta AI > scelta manuale (se c'è la spunta di copia, colori/font manuali sono disattivati).

### 3. Sezioni (N)
- Selettore numero sezioni (min 1, max 12) + aggiungi/rimuovi/duplica/riordina (drag & drop, con alternativa a pulsanti su mobile).
- Per ogni sezione:
  - **Tipo sezione** (3):
    - A. `testo → foto → testo`: **una sola foto** fissa a tutto schermo + due testi. All'inizio si vede la foto con il testo 1; scrollando il testo 1 sfuma (opacità → 0) e compare in dissolvenza il testo 2 sulla stessa foto. Nessun video, nessun costo AI.
    - B. `video → testo finale`: scrollando il video avanza fino all'ultimo fotogramma, poi compare in dissolvenza il testo finale
    - C. `video + testo laterale` sovrapposto mentre il video scorre
  - **Sorgente media**: tipo A = upload di 1 foto; tipi B e C:
    - due foto **inizio + fine** → clip generata con AI (first+last frame), oppure
    - **upload video** già pronto.
    - Opzione "raccorda con la sezione precedente": la foto di inizio = foto di fine della sezione precedente (continuità senza tagli).
  - **Testi**: ogni testo = titolo + sottotesto. Quali testi servono dipende dal tipo: A = testo 1 (iniziale) + testo 2 (dopo la dissolvenza); B = testo finale a fine video; C = testo laterale sovrapposto durante lo scorrimento del video. Per ogni testo uno switch **Manuale / Generato da AI**; se AI, campo "indicazioni" (cosa raccontare) e uso di mission/tono come contesto.
  - Per AI video: campo opzionale "descrizione del movimento" (prompt camera), durata (es. 5 s).
- Stima costo AI indicativa per sezione e totale (es. ~0,29 $ per clip 5 s Seedance), solo calcolata, nessuna chiamata.

### 4. Riepilogo
- Anteprima struttura (lista sezioni con miniature), validazione completa, export/download JSON, salvataggio bozza (localStorage), pulsante "Invia" (per ora mock).

## Requisiti non funzionali
- **Mobile first**: tutto utilizzabile da smartphone (upload da galleria/fotocamera, step verticali, nessun drag obbligatorio).
- Validazione file: formati (jpg/png/webp/heic?, mp4/mov), peso massimo, risoluzione minima, durata video massima.
- Accessibilità: label, focus, tastiera, messaggi di errore leggibili.
- Stack: Next.js (App Router) + TypeScript + Tailwind; form con react-hook-form + zod (schema unico condiviso tra form ed export JSON).
- **Test**: unit test dello schema zod e delle regole condizionali (tipo sezione ↔ campi richiesti); test E2E Playwright su viewport desktop e mobile (iPhone/Android) del flusso completo con export JSON; lint + typecheck puliti.

## Primo rilascio (confermato)
Solo frontend: form, anteprima, validazione, salvataggio bozza ed export JSON.

## Fuori scope (per ora)
Backend, account/login, upload reale su storage, chiamate fal.ai, scraping automatico, pagamento, pubblicazione.

## Cosa devi consegnare (poi STOP)
1. Specifica di una pagina: step del form, campi per step, regole condizionali per tipo sezione.
2. Schema dati (zod/TypeScript) di `brand.json` e `scenes.json`, con un esempio compilato su Happy Tuscany.
3. Wireframe testuale (o screenshot di un mockup statico) desktop + mobile.
4. Piano di implementazione a fasi piccole con stop/OK, e piano di test.
5. Domande aperte e rischi.
