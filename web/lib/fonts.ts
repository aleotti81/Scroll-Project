export type FontPair = {
  id: string;
  name: string;
  title: string;
  body: string;
};

export const fontPairs: FontPair[] = [
  { id: "happy-tuscany", name: "Happy Tuscany", title: "Schoolbell", body: "Architects Daughter" },
  { id: "editoriale", name: "Editoriale", title: "Playfair Display", body: "Lato" },
  { id: "contemporaneo", name: "Contemporaneo", title: "DM Sans", body: "Inter" },
  { id: "caldo", name: "Caldo", title: "DM Serif Display", body: "Nunito Sans" },
  { id: "essenziale", name: "Essenziale", title: "Manrope", body: "Open Sans" },
  { id: "romantico", name: "Romantico", title: "Cormorant Garamond", body: "Raleway" },
  { id: "naturale", name: "Naturale", title: "Bree Serif", body: "Lora" },
  { id: "audace", name: "Audace", title: "Oswald", body: "Roboto" },
];

export function googleFontsUrl(pair: FontPair) {
  const families = [pair.title, pair.body]
    .map((family) => `family=${family.replaceAll(" ", "+")}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
