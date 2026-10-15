import { describe, expect, it } from "vitest";
import {
  configuratorSchema,
  projectFieldsSchema,
  sectionsSchema,
  type ConfiguratorData,
  type FileRef,
  type Section,
} from "../lib/schema";

type LinkedPhotoSection = Extract<Section, { type: "B" }> & {
  media: Extract<Extract<Section, { type: "B" }>["media"], { source: "photos" }>;
};

const photo: FileRef = {
  id: "photo-1",
  name: "story.jpg",
  type: "image/jpeg",
  size: 1024,
  width: 1600,
  height: 900,
};

const video: FileRef = {
  id: "video-1",
  name: "story.mp4",
  type: "video/mp4",
  size: 2048,
  durationSec: 2,
};

function text(title = "Una storia") {
  return { mode: "manual" as const, title, subtitle: "Da vivere" };
}

function validData(): ConfiguratorData {
  return {
    brand: {
      existingSite: { url: "", replicateContent: false, copyStyle: false },
      name: "Casa delle colline",
      logo: null,
      mission: "Accogliere con cura",
      values: "Natura e ospitalità",
      target: "Viaggiatori curiosi",
      tone: "familiare",
      languages: ["it"],
      contacts: {
        email: "",
        phone: "",
        whatsapp: "",
        address: "",
        socials: { instagram: "", facebook: "", tiktok: "" },
      },
      cta: { label: "", url: "" },
      seo: { title: "", description: "", primaryKeyword: "casa in Toscana", secondaryKeywords: [] },
      legal: { companyName: "", vat: "", privacyUrl: "", cookieUrl: "" },
    },
    style: { colors: { mode: "ai" }, fonts: { mode: "ai" } },
    sections: [
      { id: "a", type: "A", photo, text1: text(), text2: text("Un nuovo inizio") },
    ],
  };
}

function linkedPhotoSection(id: string): LinkedPhotoSection {
  return {
    id,
    type: "B",
    media: {
      source: "photos",
      startPhoto: null,
      endPhoto: photo,
      linkPrevious: true,
      durationSec: 5,
    },
    endText: text("La destinazione"),
  };
}

describe("schema delle sezioni", () => {
  it("richiede i campi previsti per ciascun tipo", () => {
    const a = validData().sections[0];
    expect(sectionsSchema.safeParse([a]).success).toBe(true);
    expect(sectionsSchema.safeParse([{ ...a, photo: null }]).success).toBe(false);
    expect(sectionsSchema.safeParse([{ ...a, text1: { mode: "manual", title: "" } }]).success).toBe(false);

    const b = linkedPhotoSection("b");
    expect(sectionsSchema.safeParse([a, b]).success).toBe(true);
    expect(sectionsSchema.safeParse([a, { ...b, media: { ...b.media, endPhoto: null } }]).success).toBe(false);

    const c: Section = {
      id: "c",
      type: "C",
      media: { source: "video", video },
      sideText: { mode: "ai", brief: "Il panorama al tramonto" },
    };
    expect(sectionsSchema.safeParse([c]).success).toBe(true);
    expect(sectionsSchema.safeParse([{ ...c, media: { source: "video", video: null } }]).success).toBe(false);
    expect(sectionsSchema.safeParse([{ ...c, sideText: { mode: "ai", brief: "" } }]).success).toBe(false);
  });

  it("richiede una foto iniziale se non si raccorda alla sezione precedente", () => {
    const b = linkedPhotoSection("b");
    expect(sectionsSchema.safeParse([{ ...b, media: { ...b.media, linkPrevious: false } }]).success).toBe(false);
    expect(sectionsSchema.safeParse([validData().sections[0], { ...b, media: { ...b.media, linkPrevious: false, startPhoto: photo } }]).success).toBe(true);
  });

  it("rifiuta linkPrevious dopo aver spostato la sezione collegata al primo posto", () => {
    const ordered: Section[] = [validData().sections[0], linkedPhotoSection("b")];
    expect(sectionsSchema.safeParse(ordered).success).toBe(true);
    expect(sectionsSchema.safeParse([...ordered].reverse()).success).toBe(false);
  });

  it("accetta da una a dodici sezioni e respinge zero o tredici", () => {
    const section = validData().sections[0];
    expect(sectionsSchema.safeParse([section]).success).toBe(true);
    expect(sectionsSchema.safeParse(Array.from({ length: 12 }, (_, index) => ({ ...section, id: `a-${index}` })).map((item) => item)).success).toBe(true);
    expect(sectionsSchema.safeParse([]).success).toBe(false);
    expect(sectionsSchema.safeParse(Array.from({ length: 13 }, (_, index) => ({ ...section, id: `a-${index}` }))).success).toBe(false);
  });
});

describe("regole condizionali del progetto", () => {
  it("rende nome, missione e keyword facoltativi con la replica dei contenuti", () => {
    const data = validData();
    data.brand.existingSite = {
      url: "https://example.com",
      replicateContent: true,
      copyStyle: false,
    };
    data.brand.name = "";
    data.brand.mission = "";
    data.brand.seo.primaryKeyword = "";
    expect(configuratorSchema.safeParse(data).success).toBe(true);
    data.brand.existingSite.url = "";
    expect(configuratorSchema.safeParse(data).success).toBe(false);
  });

  it("valida un URL esistente anche senza attivare le opzioni del sito", () => {
    const data = validData();
    data.brand.existingSite.url = "non-un-url";
    expect(projectFieldsSchema.safeParse(data.brand).success).toBe(false);
    expect(configuratorSchema.safeParse(data).success).toBe(false);
    data.brand.existingSite.url = "https://example.com";
    expect(projectFieldsSchema.safeParse(data.brand).success).toBe(true);
    expect(configuratorSchema.safeParse(data).success).toBe(true);
  });

  it("impone lo stile del sito se la copia dello stile è attiva", () => {
    const data = validData();
    data.brand.existingSite = {
      url: "https://example.com",
      replicateContent: false,
      copyStyle: true,
    };
    data.style = { colors: { mode: "site" }, fonts: { mode: "site" } };
    expect(configuratorSchema.safeParse(data).success).toBe(true);
    data.style.colors = { mode: "ai" };
    expect(configuratorSchema.safeParse(data).success).toBe(false);
  });

  it("limita le keyword secondarie a cinque", () => {
    const data = validData();
    data.brand.seo.secondaryKeywords = ["uno", "due", "tre", "quattro", "cinque"];
    expect(configuratorSchema.safeParse(data).success).toBe(true);
    data.brand.seo.secondaryKeywords.push("sei");
    expect(configuratorSchema.safeParse(data).success).toBe(false);
  });
});
