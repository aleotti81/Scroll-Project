# Prompt sessione B — Mappa interattiva illustrata (Happy Tuscany)

Agisci come front-end developer e illustratore SVG. Lavoriamo nel repo **https://github.com/aleotti81/Scroll-Project**, cartella `lavoro/MAPPA-2D/v3/`. Rispondi in italiano, in modo breve. Fai **bozze rapide**: dopo ogni modifica mi mandi subito screenshot e anteprima e aspetti il mio feedback. Costo AI 0 $: tutto in SVG, HTML, CSS e JS. Se serve l'AI (sprite, illustrazioni) prima mi prepari un prompt strutturato con il costo.

## Avvio
```bash
cd lavoro/MAPPA-2D/v3 && python3 build_v3.py && python3 -m http.server 8084
```
- `build_v3.py` genera `index.html` da `tpl3.html`, con i segnaposto %OUTER% %INNER% %LEG% %DATA% %TOURS% %TREES% %VB% %HX% %HY%.
- `inner3.py` disegna la mappa della casa e riusa house, alberi, piscina, pergolato e pin da `../v2/build_iso.py`.
- Usa `../v1/index.html` per i dati delle schede (testi e foto) e i font.
- `test2.py` è il test Playwright (CDP su localhost:29229), con screenshot in `shots/`.

## Cosa c'è (v3)
**Mappa grande (Toscana e Umbria)**
- Stile Vej Adventure (https://www.vejadventure.it/il-parco/mappa-interattiva/): pastello, alberi e cipressi visti di lato, font del sito (Architects Daughter, Schoolbell).
- Non in scala. In `P()` la proiezione comprime le distanze (r^0.55, con compressione extra oltre 60 km) e aggiunge prospettiva: il nord è schiacciato in fondo, il sud è più avanti e più largo. Le icone si ingrandiscono verso sud.
- Happy Tuscany (Via della Croce 200, Rigomagno SI, circa 43.2597, 11.7032) è una casetta al centro con un banner arancione.
- I gruppi troppo vicini sono distanziati a mano con `_mv`: Perugia, S. Maria degli Angeli, Assisi ed Eremo in fila verso est; Val d'Orcia, Pienza e Montepulciano in fila verso ovest.
- **9 tour** presi da https://www.happytuscany.it/tours/:
  - Siena · San Gimignano · Certaldo
  - Firenze
  - Pisa
  - Roma
  - Montepulciano · Val d'Orcia · Pienza
  - Perugia · Assisi · Eremo
  - Arezzo · La Verna · Anghiari · Cortona
  - Wine Tour Montepulciano
  - Terme di Rapolano
- I due pacchetti "Settimana" sono esclusi.
- I tour sono **archi "balistici"** con tratteggio fine e colorato; più lunga è la tratta, più alto è l'arco.
- Al passaggio del mouse la linea si ingrossa e compaiono i **tempi di ogni tratto**: km = linea d'aria × 1,3, a 65 km/h.
- Al clic la mappa **zooma sul percorso** (animando la viewBox), nasconde gli altri tour e attenua le altre città. Si apre una scheda con un carosello di foto (`tours/*_N.webp`), una breve descrizione, il percorso con i km, il totale A/R e "in giornata / 2 giorni".
- **Niente prezzi né link di vendita**: sono informazioni per chi viaggia da solo.
- Gli itinerari sono in un menu a tendina in basso a sinistra; non devono mai coprire la mappa.
- Ci sono mare, Lago Trasimeno, Arno e Tevere (pieni, con larghezza variabile e un riflesso).

**Zoom → mappa della casa**
- Con la rotellina, o con i pulsanti "+ La casa" / "− Toscana", si fa zoom sulla casetta e si passa alla mappa locale.
- Visuale obliqua: alberi più piccoli in fondo e foschia in alto. Inquadratura su casa e bosco.
- Pin: casa, interni, terrazza e amaca, barbecue, musica, ingresso, piscina, jacuzzi, vista.
- Strada (Via della Croce) dal basso con due tornanti stretti: passa dal cancello e sale verso Rigomagno, in alto a destra. Ingresso con un vialetto di pietre bianche.
- 3 macchinine viste dall'alto con ombra, mosse in JS lungo `#rdp`, lente. Passano dietro gli alberi grazie ai livelli di profondità `.zl` per fasce di y.
- 2 scoiattoli in JS: scatti, pause, colpi di coda, salgono su un tronco e spariscono, poi ricompaiono altrove.
- **Piscina → "Entra nella scena"**: apre la clip pilota a tutto schermo, che avanza con lo scroll (`assets/video/clip01_*.mp4`, all-intra, caricata come blob).

## Feedback e regole dell'utente da rispettare
- Fiumi a linee tratteggiate e scoiattoli a "iconcina che gira": bocciati. Servono movimenti realistici.
- Le macchinine non devono mai passare sopra gli alberi: serve la profondità giusta.
- Uliveto e fiume nella mappa della casa: tolti, non rimetterli.
- Le etichette non si devono accavallare: se i luoghi sono vicini, distanziali, anche fuori scala.
- Meno spazio vuoto o bosco ai bordi; lo zoom deve restare centrato su ciò che si fa partendo da Happy Tuscany.
- Le posizioni reali dei luoghi vanno verificate su Google Maps.

## Da fare / aperto
- Correggere le sovrapposizioni rimaste: le etichette dei tempi sui nomi nello zoom di un tour, e il bosco sul lato destro.
- Ricollocare piscina, jacuzzi, barbecue, ingresso, ecc. secondo le indicazioni che darò sulla casa reale (ingresso con pietre bianche, vedi le foto in `input/scraping/img`).
- Rendere visibili i tornanti in basso sfoltendo gli alberi davanti.
- Rifinire la versione mobile.
- Fasi successive, solo dopo l'OK sul 2D: passaggio al 3D (Three.js, diorama low-poly), camera guidata dallo scroll, personaggi e animali animati, poi integrazione come sezione del sito scroll-telling (seguito in un'altra sessione).
