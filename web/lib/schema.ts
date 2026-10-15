import { z } from "zod";

export const fileRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().nonnegative(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  durationSec: z.number().positive().optional(),
});

export const textBlockSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("manual"),
    title: z.string().trim().min(1, "Inserisci un titolo."),
    subtitle: z.string().optional(),
  }),
  z.object({
    mode: z.literal("ai"),
    brief: z.string().trim().min(1, "Descrivi cosa raccontare."),
  }),
]);

export const photoMediaSchema = z.object({
  source: z.literal("photos"),
  startPhoto: fileRefSchema.nullable(),
  endPhoto: fileRefSchema,
  linkPrevious: z.boolean(),
  motionPrompt: z.string().optional(),
  durationSec: z.union([z.literal(5), z.literal(10)]),
});

export const videoMediaSchema = z.object({
  source: z.literal("video"),
  video: fileRefSchema,
});

export const mediaSchema = z.discriminatedUnion("source", [
  photoMediaSchema,
  videoMediaSchema,
]);

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("A"),
    photo: fileRefSchema,
    text1: textBlockSchema,
    text2: textBlockSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("B"),
    media: mediaSchema,
    endText: textBlockSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("C"),
    media: mediaSchema,
    sideText: textBlockSchema,
  }),
]);

export const sectionsSchema = z
  .array(sectionSchema)
  .min(1, "Aggiungi almeno una sezione.")
  .max(12, "Puoi creare al massimo 12 sezioni.")
  .superRefine((sections, context) => {
    sections.forEach((section, index) => {
      if (section.type === "B" || section.type === "C") {
        if (section.media.source !== "photos") return;
        if (!section.media.linkPrevious && !section.media.startPhoto) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "media", "startPhoto"],
            message: "Carica la foto iniziale oppure raccorda con la sezione precedente.",
          });
        }
        if (section.media.linkPrevious) {
          const previous = sections[index - 1];
          const previousFrame =
            previous?.type === "A"
              ? previous.photo
              : previous && (previous.type === "B" || previous.type === "C") &&
                  previous.media.source === "photos"
                ? previous.media.endPhoto
                : null;
          if (!previousFrame) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, "media", "linkPrevious"],
              message: "La sezione precedente non ha un fotogramma disponibile.",
            });
          }
        }
      }
    });
  });

const toneSchema = z.enum([
  "elegante",
  "familiare",
  "avventuroso",
  "romantico",
  "lusso",
  "sostenibile",
  "giovane",
]);
const languageSchema = z.enum(["it", "en", "de", "fr", "es", "nl"]);
const emptyOrUrl = (message: string) =>
  z.string().refine((value) => !value || z.string().url().safeParse(value).success, message);

export const projectFieldsObjectSchema = z.object({
  existingSite: z.object({
    url: z.string(),
    replicateContent: z.boolean(),
    copyStyle: z.boolean(),
  }),
  name: z.string(),
  logo: fileRefSchema.nullable(),
  mission: z.string(),
  values: z.string(),
  target: z.string(),
  tone: toneSchema,
  languages: z.array(languageSchema).min(1, "Seleziona almeno una lingua."),
});

function refineBrandFields(
  brand: z.infer<typeof projectFieldsObjectSchema>,
  context: z.RefinementCtx,
  pathPrefix: string[],
) {
  const { url, replicateContent, copyStyle } = brand.existingSite;
  const validUrl = z.string().url().safeParse(url).success;
  if (!validUrl && (url.length > 0 || replicateContent || copyStyle)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...pathPrefix, "existingSite", "url"],
      message: replicateContent || copyStyle
        ? "Inserisci un URL valido se attivi una delle opzioni."
        : "Inserisci un URL valido.",
    });
  }
  if (!replicateContent && !brand.name.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...pathPrefix, "name"],
      message: "Inserisci il nome della struttura.",
    });
  }
  if (!replicateContent && !brand.mission.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...pathPrefix, "mission"],
      message: "La missione è obbligatoria se non replichi i contenuti.",
    });
  }
}

export const projectFieldsSchema = projectFieldsObjectSchema.superRefine((brand, context) => {
  refineBrandFields(brand, context, []);
});

export const contactFieldsSchema = z.object({
  contacts: z.object({
    email: z.union([z.literal(""), z.string().email("Inserisci un'email valida.")]),
    phone: z.string(),
    whatsapp: z.string(),
    address: z.string(),
    socials: z.object({
      instagram: emptyOrUrl("Inserisci un URL valido."),
      facebook: emptyOrUrl("Inserisci un URL valido."),
      tiktok: emptyOrUrl("Inserisci un URL valido."),
    }),
  }),
  cta: z.object({
    label: z.string(),
    url: emptyOrUrl("Inserisci un URL valido."),
  }),
  seo: z.object({
    title: z.string(),
    description: z.string().max(160, "La descrizione può contenere al massimo 160 caratteri."),
    primaryKeyword: z.string(),
    secondaryKeywords: z.array(z.string().trim().min(1)).max(5, "Puoi aggiungere al massimo 5 keyword."),
  }),
  legal: z.object({
    companyName: z.string(),
    vat: z.string(),
    privacyUrl: emptyOrUrl("Inserisci un URL valido."),
    cookieUrl: emptyOrUrl("Inserisci un URL valido."),
  }),
});

export const colorsSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("site") }),
  z.object({ mode: z.literal("ai") }),
  z.object({
    mode: z.literal("manual"),
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Usa un colore esadecimale valido."),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Usa un colore esadecimale valido."),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
]);

export const fontsSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("site") }),
  z.object({ mode: z.literal("ai") }),
  z.object({ mode: z.literal("manual"), pairId: z.string().min(1) }),
]);

export const styleSchema = z.object({
  colors: colorsSchema,
  fonts: fontsSchema,
});

export const configuratorSchema = z
  .object({
    brand: projectFieldsObjectSchema.merge(contactFieldsSchema),
    style: styleSchema,
    sections: sectionsSchema,
  })
  .superRefine((data, context) => {
    refineBrandFields(data.brand, context, ["brand"]);
    if (!data.brand.existingSite.replicateContent && !data.brand.seo.primaryKeyword.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["brand", "seo", "primaryKeyword"],
        message: "La keyword primaria è obbligatoria.",
      });
    }
    if (data.brand.existingSite.copyStyle) {
      if (data.style.colors.mode !== "site") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["style", "colors"],
          message: "Con lo stile del sito esistente, i colori sono impostati su Sito.",
        });
      }
      if (data.style.fonts.mode !== "site") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["style", "fonts"],
          message: "Con lo stile del sito esistente, i font sono impostati su Sito.",
        });
      }
    } else if (data.style.colors.mode === "site" || data.style.fonts.mode === "site") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["style"],
        message: "La modalità Sito richiede l'opzione «Copia lo stile dal mio sito».",
      });
    }
  });

export type FileRef = z.infer<typeof fileRefSchema>;
export type TextBlock = z.infer<typeof textBlockSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Brand = z.infer<typeof configuratorSchema>["brand"];
export type Style = z.infer<typeof styleSchema>;
export type ConfiguratorData = z.infer<typeof configuratorSchema>;
