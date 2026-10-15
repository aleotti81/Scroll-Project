import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const imageFixture = path.join(__dirname, "fixtures", "story.jpg");
const videoFixture = path.join(__dirname, "fixtures", "story.mp4");

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

test("completa il configuratore ed esporta le scene con una clip AI da 0,29 USD", async ({ page }, testInfo) => {
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

  await page.locator("#sections-0-photo").setInputFiles(imageFixture);
  await page.locator("#sections-0-text1-title").fill("Benvenuti a casa");
  await page.getByRole("region", { name: "Sezione 1" }).getByRole("button", { name: "Sezione 1: Testo → Foto → Testo" }).click();
  await expect(page.locator("#sections-0-text1-title")).toHaveValue("Benvenuti a casa");
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

  await expect(page.getByRole("heading", { name: "La tua storia, in breve" })).toBeVisible();
  await expect(page.getByText("0,29 USD").last()).toBeVisible();
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
});
