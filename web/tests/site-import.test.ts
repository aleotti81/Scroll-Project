import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPrivateAddress, parseSiteChrome } from "../lib/site-import";

const happyTuscanyHtml = readFileSync(
  new URL("../../input/scraping/home.html", import.meta.url),
  "utf8",
);

describe("parseSiteChrome", () => {
  it("legge l'header e il footer della fixture Happy Tuscany", () => {
    const site = parseSiteChrome(happyTuscanyHtml, "https://www.happytuscany.it/");

    expect(site.sourceUrl).toBe("https://www.happytuscany.it/");
    expect(site.siteName).toBe("Happy Tuscany");
    expect(site.logoUrl).toContain("png_trns_logo");
    expect(site.nav.length).toBeGreaterThan(0);
    expect(site.nav.some(({ label }) => /la casa|servizi/i.test(label))).toBe(true);
    expect(site.footer.emails.map((email) => email.toLowerCase())).toContain(
      "info@happytuscany.it",
    );
    expect(site.footer.phones).toContain("+393515710979");
    expect(site.footer.lines.some((line) => /rigomagno/i.test(line))).toBe(true);
  });

  it("risolve URL relativi, usa il logo corrispondente e deduplica la navigazione", () => {
    const html = `
      <html>
        <head><meta property="og:site_name" content="Sito prova"></head>
        <body>
          <header>
            <img src="/assets/hero.jpg" alt="Immagine">
            <img class="brand-logo" data-src="images/site-logo.svg" alt="Brand">
            <nav>
              <a href="/casa">Casa</a>
              <a href="/casa-duplicata">CASA</a>
              <a href="/uno">Uno</a>
              <a href="/due">Due</a>
              <a href="/tre">Tre</a>
              <a href="/quattro">Quattro</a>
              <a href="/cinque">Cinque</a>
              <a href="/sei">Sei</a>
              <a href="/sette">Sette</a>
              <a href="/otto">Otto</a>
              <a href="#">Salta</a>
              <a href="javascript:void(0)">Script</a>
              <a href="mailto:hello@example.com">Email</a>
              <a href="tel:+390212345678">Telefono</a>
            </nav>
          </header>
          <footer>
            <a href="mailto:info%40example.com?subject=ciao">Scrivi</a>
            <a href="mailto:INFO%40example.com?subject=duplicato">Email duplicata</a>
            <a href="tel:%2B390212345678?source=footer">Chiama</a>
            <a href="https://www.instagram.com/brand">Instagram</a>
            <a href="https://instagram.com/brand-2">Instagram alternativo</a>
            <a href="https://youtu.be/abc123">Canale video</a>
            <a href="https://www.tiktok.com/@brand"><span></span></a>
            <a href="/privacy">Privacy</a>
            <p>© 2025 Brand</p>
            <p>P.IVA 01234567890</p>
          </footer>
        </body>
      </html>
    `;

    const site = parseSiteChrome(html, "https://example.com/it/home");

    expect(site.logoUrl).toBe("https://example.com/it/images/site-logo.svg");
    expect(site.nav).toHaveLength(8);
    expect(site.nav[0]).toEqual({ label: "Casa", href: "https://example.com/casa" });
    expect(site.nav.some(({ label }) => label === "Otto")).toBe(false);
    expect(site.footer.emails).toEqual(["info@example.com"]);
    expect(site.footer.phones).toEqual(["+390212345678"]);
    expect(site.footer.socials).toEqual([
      { label: "Instagram", href: "https://www.instagram.com/brand" },
      { label: "YouTube", href: "https://youtu.be/abc123" },
      { label: "TikTok", href: "https://www.tiktok.com/@brand" },
    ]);
    expect(site.footer.links).toEqual([
      { label: "Privacy", href: "https://example.com/privacy" },
    ]);
    expect(site.footer.lines).toContain("© 2025 Brand");
    expect(site.footer.lines).toContain("P.IVA 01234567890");
  });

  it("usa il primo logo disponibile quando non trova un'immagine logo", () => {
    const site = parseSiteChrome(
      "<body><header><img data-src='images/photo.jpg' alt='Foto'></header></body>",
      "https://example.com/page/",
    );

    expect(site.logoUrl).toBe("https://example.com/page/images/photo.jpg");
  });
});

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "192.168.1.1",
    "172.16.0.1",
    "169.254.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("identifica %s come indirizzo privato", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "2a00:1450::1"])(
    "non identifica %s come indirizzo privato",
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );
});
