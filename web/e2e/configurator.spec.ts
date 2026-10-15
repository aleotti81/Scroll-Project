import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SiteChrome } from "../lib/site-import";

const imageFixture = path.join(__dirname, "fixtures", "story.jpg");
const videoFixture = path.join(__dirname, "fixtures", "story.mp4");

const importedChrome: SiteChrome = {
  sourceUrl: "https://www.esempio.it/",
  siteName: "Esempio Resort",
  logoUrl: null,
  nav: [{ label: "Camere", href: "https://www.esempio.it/camere" }],
  footer: {
    links: [],
    socials: [{ label: "Instagram", href: "https://instagram.com/esempio" }],
    emails: ["info@esempio.it"],
    phones: ["+39 055 123"],
    lines: ["© 2025 Esempio Srl"],
  },
};

async function fillConfiguratorToSummary(page: Page, siteUrl?: string) {
  await page.goto("/crea");

  if (siteUrl) await page.getByLabel("Sito esistente (facoltativo)").fill(siteUrl);
  await page.getByLabel("Nome della struttura o del progetto").fill("Casa delle colline");
  await page.getByLabel("Missione").fill("Accogliere con cura e semplicità.");
  await page.getByLabel("Valori e senso").fill("Natura, lentezza, ospitalità.");
  await page.getByLabel("A chi ti rivolgi?").fill("Viaggiatori curiosi.");
  await page.getByRole("button", { name: "Avanti" }).click();

  await page.getByLabel("Keyword primaria").fill("casa vacanze in Toscana");
  await page.getByLabel("Titolo SEO").fill("La casa tra le colline");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();

  await page.locator("#sections-0-photo").setInputFiles(imageFixture);
  await page.locator("#sections-0-text1-title").fill("Benvenuti a casa");
  await page.getByRole("button", { name: "Sezione 1: Testo → Foto → Testo" }).click();
  const firstSection = page.getByRole("region", { name: "Sezione 1" });
  await firstSection.getByRole("button", { name: "Generato da AI" }).first().click();
  await expect(firstSection.getByLabel("Cosa raccontare").first()).toHaveValue("");
  await firstSection.getByRole("button", { name: "Manuale" }).first().click();
  await expect(page.locator("#sections-0-text1-title")).toHaveValue("");
  await firstSection.getByRole("button", { name: "Generato da AI" }).first().click();
  await firstSection.getByLabel("Cosa raccontare").first().fill("L'arrivo in una casa accogliente.");
  await page.locator("#sections-0-text2-title").fill("Il tempo rallenta");
  await expect(page.getByText("story.jpg").first()).toBeVisible();

  await firstSection.getByRole("button", { name: "Duplica sezione 1" }).click();
  await page.getByRole("button", { name: "Rimuovi sezione 2" }).click();
  await expect(page.getByAltText("Anteprima story.jpg")).toBeVisible();
  await page.getByRole("button", { name: "Aggiungi sezione" }).click();
  await page.getByRole("button", { name: "Aggiungi sezione" }).click();

  await page.getByRole("button", { name: "Sezione 2: Video → Testo finale" }).click();
  await page.locator("#sections-1-media-endPhoto").setInputFiles(imageFixture);
  await expect(page.locator("#sections-1-media-endPhoto")).toBeVisible();
  await page.getByLabel("Raccorda con la sezione precedente").check();
  await page.locator("#sections-1-endText-title").fill("Qui comincia la vacanza");

  await page.getByRole("button", { name: "Sezione 3: Video + Testo laterale" }).click();
  await page.getByRole("region", { name: "Sezione 3" }).getByRole("button", { name: "Carica un video" }).click();
  await page.locator("#sections-2-media-video").setInputFiles(videoFixture);
  await page.locator("#sections-2-sideText-title").fill("Un panorama da ricordare");
  await page.getByRole("button", { name: "Avanti" }).click();
}

async function reloadWithStoredClip(
  page: Page,
  storedClip: string | { videoUrl: string; requestId: string },
) {
  await fillConfiguratorToSummary(page);
  await page.waitForFunction(() => Boolean(localStorage.getItem("scroll-studio-configuratore-v1")));
  const sectionId = await page.evaluate((value) => {
    const draft = JSON.parse(localStorage.getItem("scroll-studio-configuratore-v1") ?? "null");
    const section = draft?.sections?.find((item: { type?: string }) => item.type === "B");
    if (typeof section?.id !== "string") throw new Error("Sezione B non trovata nella bozza.");
    localStorage.setItem("scroll-studio-clips-v1", JSON.stringify({ [section.id]: value }));
    return section.id as string;
  }, storedClip);
  await page.reload();
  return sectionId;
}

async function advanceToSections(page: Page) {
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
}

async function openSitePreview(page: Page) {
  await page.getByRole("button", { name: "Apri anteprima del sito" }).click();
  const preview = page.getByRole("dialog", { name: "Anteprima del sito" });
  await expect(preview).toBeVisible();
  return preview;
}

async function openPreviewMenuIfVisible(preview: Locator) {
  const menuButton = preview.getByRole("button", { name: "Menu" });
  if (await menuButton.isVisible()) await menuButton.click();
}

test("blocca Avanti quando i campi obbligatori sono vuoti", async ({ page }) => {
  await page.goto("/crea");
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByRole("heading", { name: "Il tuo progetto" })).toBeVisible();
  await expect(page.getByText("Inserisci il nome della struttura.")).toBeVisible();
  await expect(page.getByText("La missione è obbligatoria se non replichi i contenuti.")).toBeVisible();
});

test("ripristina la bozza dopo aver ricaricato la pagina", async ({ page }) => {
  await page.goto("/crea");
  await page.getByLabel("Nome della struttura o del progetto").fill("La mia casa di prova");
  await page.waitForFunction(() => Boolean(localStorage.getItem("scroll-studio-configuratore-v1")));
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Le foto/video vanno ricaricati");
  await expect(page.getByLabel("Nome della struttura o del progetto")).toHaveValue("La mia casa di prova");
});

test("accetta un secondo video dopo il ripristino del valore null", async ({ page }) => {
  await page.goto("/crea");
  await page.getByLabel("Nome della struttura o del progetto").fill("Casa delle colline");
  await page.getByLabel("Missione").fill("Accogliere con cura e semplicità.");
  await page.getByLabel("Valori e senso").fill("Natura, lentezza, ospitalità.");
  await page.getByLabel("A chi ti rivolgi?").fill("Viaggiatori curiosi.");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByLabel("Keyword primaria").fill("casa vacanze in Toscana");
  await page.getByLabel("Titolo SEO").fill("La casa tra le colline");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();

  await page.getByRole("button", { name: "Sezione 1: Video → Testo finale" }).click();
  await page.getByRole("region", { name: "Sezione 1" }).getByRole("button", { name: "Carica un video" }).click();
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("scroll-studio-configuratore-v1") ?? "null");
    return { source: draft?.sections?.[0]?.media?.source, video: draft?.sections?.[0]?.media?.video };
  })).toEqual({ source: "video", video: null });

  await page.reload();
  await expect(page.getByRole("status")).toContainText("Le foto/video vanno ricaricati");
  await advanceToSections(page);
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("scroll-studio-configuratore-v1") ?? "null");
    return { source: draft?.sections?.[0]?.media?.source, video: draft?.sections?.[0]?.media?.video };
  })).toEqual({ source: "video", video: null });

  const videoInput = page.locator("#sections-0-media-video");
  await videoInput.setInputFiles(videoFixture);
  await expect(page.locator(".file-name").filter({ hasText: "story.mp4" })).toHaveText("story.mp4");

  const secondVideo = Buffer.concat([await readFile(videoFixture), Buffer.from([0])]);
  await videoInput.setInputFiles({
    name: "story-second.mp4",
    mimeType: "video/mp4",
    buffer: secondVideo,
  });
  await expect(page.locator(".file-name").filter({ hasText: "story-second.mp4" })).toHaveText("story-second.mp4");
  await expect(page.getByText(/Cannot read properties of null/)).toHaveCount(0);
});

test("ripristina le clip salvate nel formato legacy stringa", async ({ page }) => {
  const legacyUrl = "https://v3b.fal.media/legacy.mp4";
  const sectionId = await reloadWithStoredClip(page, legacyUrl);

  await expect.poll(async () => page.evaluate((id) => {
    const clips = JSON.parse(localStorage.getItem("scroll-studio-clips-v1") ?? "{}");
    return clips[id];
  }, sectionId)).toEqual({ videoUrl: legacyUrl });
});

test("aggiorna alla route locale una clip fal già generata", async ({ page }) => {
  let statusCalls = 0;
  const requestId = "req-12345678";
  const localUrl = `/api/video-clips/${requestId}/file`;
  await page.route(`**/api/video-clips/${requestId}`, (route) => {
    statusCalls += 1;
    return route.fulfill({ json: { status: "done", videoUrl: localUrl } });
  });

  const sectionId = await reloadWithStoredClip(page, {
    videoUrl: "https://v3b.fal.media/x.mp4",
    requestId,
  });

  await expect.poll(async () => page.evaluate((id) => {
    const clips = JSON.parse(localStorage.getItem("scroll-studio-clips-v1") ?? "{}");
    return clips[id];
  }, sectionId)).toEqual({ videoUrl: localUrl, requestId });
  expect(statusCalls).toBe(1);
});

test("mantiene il testo quando si riseleziona la modalità attiva", async ({ page }) => {
  await page.goto("/crea");
  await page.getByLabel("Nome della struttura o del progetto").fill("Casa delle colline");
  await page.getByLabel("Missione").fill("Accogliere con cura e semplicità.");
  await page.getByLabel("Valori e senso").fill("Natura, lentezza, ospitalità.");
  await page.getByLabel("A chi ti rivolgi?").fill("Viaggiatori curiosi.");
  await page.getByRole("button", { name: "Avanti" }).click();

  await page.getByLabel("Keyword primaria").fill("casa vacanze in Toscana");
  await page.getByLabel("Titolo SEO").fill("La casa tra le colline");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();

  const firstSection = page.getByRole("region", { name: "Sezione 1" });
  await page.locator("#sections-0-text1-title").fill("Benvenuti");
  await firstSection.getByRole("button", { name: "Manuale" }).first().click();
  await expect(page.locator("#sections-0-text1-title")).toHaveValue("Benvenuti");

  await firstSection.getByRole("button", { name: "Generato da AI" }).first().click();
  const brief = firstSection.getByLabel("Cosa raccontare").first();
  await brief.fill("Una storia accogliente.");
  await firstSection.getByRole("button", { name: "Generato da AI" }).first().click();
  await expect(brief).toHaveValue("Una storia accogliente.");
});

test("completa il configuratore ed esporta le scene con una clip AI da 0,29 $", async ({ page }, testInfo) => {
  await fillConfiguratorToSummary(page);

  await expect(page.getByRole("heading", { name: "La tua storia, in breve" })).toBeVisible();
  await expect(page.getByText(/0,29\s+\$/).last()).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica scenes.json" }).click();
  const download = await downloadPromise;
  const downloadedFile = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(downloadedFile);
  const scenes = JSON.parse(await readFile(downloadedFile, "utf8")) as {
    version: number;
    sections: Array<{
      type: string;
      text1?: { mode: string; title?: string; brief?: string };
      media?: { source: string; linkPrevious?: boolean };
    }>;
  };
  expect(scenes.version).toBe(1);
  expect(scenes.sections).toHaveLength(3);
  expect(scenes.sections.map((section) => section.type)).toEqual(["A", "B", "C"]);
  expect(scenes.sections[0].text1).toEqual({ mode: "ai", brief: "L'arrivo in una casa accogliente." });
  expect(scenes.sections[1].media).toMatchObject({ source: "photos", linkPrevious: true });
  expect(scenes.sections[2].media?.source).toBe("video");

  const preview = await openSitePreview(page);
  await expect(preview.getByRole("region", { name: "Sezione 1" })).toContainText("L'arrivo in una casa accogliente.");
  await expect(preview.getByRole("region", { name: "Sezione 2" })).toContainText("Qui comincia la vacanza");
  await expect(preview.locator("video")).toHaveCount(1);
  await expect(preview.locator("canvas.preview-media")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(page.getByRole("heading", { name: "La tua storia, in breve" })).toBeVisible();
});

test("usa i dati del form nell’anteprima senza un sito esistente", async ({ page }) => {
  await fillConfiguratorToSummary(page);
  const preview = await openSitePreview(page);
  const navigation = preview.getByRole("navigation", { name: "Menu del sito" });

  await expect(preview.locator(".preview-brand")).toContainText("Casa delle colline");
  await expect(preview.locator(".preview-footer h2")).toHaveText("Casa delle colline");
  await openPreviewMenuIfVisible(preview);
  await expect(navigation.getByRole("link", { name: "Sezione 1" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Qui comincia la vacanza" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Un panorama da ricordare" })).toBeVisible();
});

test("mostra nell’anteprima il sito importato", async ({ page }) => {
  await page.route("**/api/site-import", (route) => route.fulfill({ json: importedChrome }));
  await fillConfiguratorToSummary(page, "https://www.esempio.it");
  const preview = await openSitePreview(page);

  await expect(preview.getByText("header e footer da www.esempio.it")).toBeVisible();
  const navigation = preview.getByRole("navigation", { name: "Menu del sito" });
  await openPreviewMenuIfVisible(preview);
  await expect(navigation.getByRole("link", { name: "Camere" })).toBeVisible();

  const footer = preview.locator(".preview-footer");
  await expect(footer.getByRole("link", { name: "info@esempio.it" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Instagram" })).toBeVisible();
  await expect(footer.getByText("© 2025 Esempio Srl")).toBeVisible();
});

test("ripiega sui dati del form se il sito esistente non è leggibile", async ({ page }) => {
  await page.route("**/api/site-import", (route) =>
    route.fulfill({ status: 422, json: { error: "Impossibile leggere il sito." } }),
  );
  await fillConfiguratorToSummary(page, "https://www.esempio.it");
  const preview = await openSitePreview(page);

  await expect(preview.getByText("sito non leggibile")).toBeVisible();
  await expect(preview.locator(".preview-footer h2")).toHaveText("Casa delle colline");
});

test("consente di richiedere la generazione dei video AI dall’anteprima", async ({ page }) => {
  await page.route("**/api/video-clips", (route) =>
    route.fulfill({ json: { requestId: "req-12345678" } }),
  );
  let statusCalls = 0;
  await page.route("**/api/video-clips/req-12345678", (route) => {
    statusCalls += 1;
    return route.fulfill({
      json: statusCalls === 1
        ? { status: "running" }
        : { status: "done", videoUrl: "/e2e/fixtures/story.mp4" },
    });
  });
  await page.route("**/e2e/fixtures/story.mp4", (route) =>
    route.fulfill({ path: videoFixture, contentType: "video/mp4" }),
  );
  await fillConfiguratorToSummary(page);
  const preview = await openSitePreview(page);
  const requestButton = preview.getByRole("button", { name: /Crea i video AI/ });

  await requestButton.click();
  const videoDialog = page.getByRole("alertdialog", { name: "Crea i video AI" });
  await expect(videoDialog).toBeVisible();
  await expect(videoDialog.getByText("Sezione 2 · 5 s")).toBeVisible();
  await expect(videoDialog.locator(".video-dialog-total")).toContainText("Totale stimato");
  await expect(videoDialog.locator(".video-dialog-total")).toContainText(/0,29\s+\$/);
  await expect(videoDialog.getByText(/Confermando, la generazione parte subito/)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(videoDialog).toHaveCount(0);
  await expect(preview).toBeVisible();

  await page.clock.install();
  await preview.getByRole("button", { name: /Crea i video AI/ }).click();
  await page.getByRole("alertdialog", { name: "Crea i video AI" })
    .getByRole("button", { name: /Conferma e genera.*0,29\s+\$/ })
    .click();
  await expect(preview.getByRole("button", { name: /Crea i video AI/ })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Sezione 2 · In generazione…");
  await page.clock.fastForward(5_000);
  await expect(page.getByRole("status")).toContainText("Sezione 2 · Pronta");

  await preview.getByRole("button", { name: "Chiudi" }).click();
  await expect(page.getByRole("status")).toContainText("Sezione 2 · Pronta");
  const completedPreview = await openSitePreview(page);
  await expect(completedPreview.getByText("video AI generati")).toBeVisible();
  await expect(completedPreview.getByRole("region", { name: "Sezione 2" }).locator("video"))
    .toHaveAttribute("src", /^blob:/);
  await expect(completedPreview.getByText("Simulazione: qui andrà la clip AI")).toHaveCount(0);
});
