"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/app/components/icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  get,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
  type UseFormSetValue,
  type UseFormRegister,
} from "react-hook-form";
import { contrastRatio, deriveColors } from "@/lib/color";
import { formatCost, sectionCost, totalCost } from "@/lib/cost";
import {
  imageResolutionWarning,
  readImageDimensions,
  readVideoDuration,
  toFileRef,
  validateImageFile,
  validateVideoDuration,
  validateVideoFile,
} from "@/lib/files";
import { fontPairs, googleFontsUrl } from "@/lib/fonts";
import {
  configuratorSchema,
  contactFieldsSchema,
  projectFieldsSchema,
  sectionsSchema,
  styleSchema,
  type ConfiguratorData,
  type FileRef,
  type Section,
} from "@/lib/schema";

const draftKey = "scroll-studio-configuratore-v1";
const stepNames = ["Progetto", "Contatti e SEO", "Stile", "Sezioni", "Riepilogo"];
const sectionLabels = {
  A: "Testo → Foto → Testo",
  B: "Video → Testo finale",
  C: "Video + Testo laterale",
} as const;

type StepIssue = { path: string; message: string };
type StoredFile = { file: File; url: string };
type FileKind = "image" | "video";

function blankSection(type: "A" | "B" | "C", id = crypto.randomUUID()) {
  const manualText = { mode: "manual" as const, title: "", subtitle: "" };
  if (type === "A") {
    return {
      id,
      type,
      photo: null,
      text1: { ...manualText },
      text2: { ...manualText },
    };
  }
  return {
    id,
    type,
    media: {
      source: "photos" as const,
      startPhoto: null,
      endPhoto: null,
      linkPrevious: false,
      durationSec: 5 as const,
    },
    ...(type === "B" ? { endText: { ...manualText } } : { sideText: { ...manualText } }),
  };
}

function initialValues(): ConfiguratorData {
  return {
    brand: {
      existingSite: { url: "", replicateContent: false, copyStyle: false },
      name: "",
      logo: null,
      mission: "",
      values: "",
      target: "",
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
      seo: { title: "", description: "", primaryKeyword: "", secondaryKeywords: [] },
      legal: { companyName: "", vat: "", privacyUrl: "", cookieUrl: "" },
    },
    style: { colors: { mode: "ai" }, fonts: { mode: "ai" } },
    sections: [blankSection("A", "section-1")],
  } as unknown as ConfiguratorData;
}

function TextInput({
  label,
  name,
  register,
  error,
  type = "text",
  placeholder,
  hint,
}: {
  label: string;
  name: FieldPath<ConfiguratorData>;
  register: UseFormRegister<ConfiguratorData>;
  error?: string;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  const id = name.replaceAll(".", "-");
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={[hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined}
        {...register(name)}
      />
      {hint && <small id={hintId}>{hint}</small>}
      {error && <span className="field-error" id={errorId} role="alert">{error}</span>}
    </div>
  );
}

function TextArea({
  label,
  name,
  register,
  error,
  placeholder,
  hint,
  maxLength,
}: {
  label: string;
  name: FieldPath<ConfiguratorData>;
  register: UseFormRegister<ConfiguratorData>;
  error?: string;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
}) {
  const id = name.replaceAll(".", "-");
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...register(name)}
      />
      {hint && <small>{hint}</small>}
      {error && <span className="field-error" id={errorId} role="alert">{error}</span>}
    </div>
  );
}

function FilePreview({
  fileRef,
  url,
  kind,
}: {
  fileRef?: FileRef | null;
  url?: string;
  kind: FileKind;
}) {
  if (!fileRef) {
    return <div className="file-preview"><span className="file-preview-missing">Nessun file caricato</span></div>;
  }
  return (
    <div className="file-preview">
      {url ? (
        kind === "video" ? <video src={url} aria-label={fileRef.name} muted /> : <Image src={url} alt={`Anteprima ${fileRef.name}`} width={82} height={55} unoptimized />
      ) : (
        <span className="file-preview-missing">Da ricaricare</span>
      )}
      <span>{fileRef.name}</span>
    </div>
  );
}

function TypeDiagram({ type }: { type: "A" | "B" | "C" }) {
  return (
    <div className={`type-diagram type-diagram-${type}`} aria-hidden="true">
      <span className="diagram-photo" />
      {type === "A" ? (
        <>
          <span className="diagram-text one" />
          <span className="diagram-text two" />
        </>
      ) : type === "B" ? <span className="diagram-play" /> : <><span className="diagram-play" /><span className="diagram-side" /></>}
    </div>
  );
}

function getSectionFrame(section?: Section): FileRef | null {
  if (!section) return null;
  if (section.type === "A") return section.photo ?? null;
  if (section.media.source === "photos") return section.media.endPhoto ?? null;
  return null;
}

function SortableSection({
  id,
  children,
}: {
  id: string;
  children: (dragHandle: ReactNode, style: React.CSSProperties) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children(
        <button
          className="drag-handle"
          type="button"
          aria-label="Trascina per riordinare"
          title="Trascina per riordinare"
          {...attributes}
          {...listeners}
        ><Icon name="grip" /></button>,
        style,
      )}
    </div>
  );
}

function TextBlockFields({
  basePath,
  register,
  getError,
  control,
  setValue,
}: {
  basePath: string;
  register: UseFormRegister<ConfiguratorData>;
  getError: (path: string) => string | undefined;
  control: Control<ConfiguratorData>;
  setValue: UseFormSetValue<ConfiguratorData>;
}) {
  const modePath = `${basePath}.mode` as FieldPath<ConfiguratorData>;
  const mode = useWatch({ control, name: modePath }) as "manual" | "ai";
  const idBase = basePath.replaceAll(".", "-");
  return (
    <div>
      <div className="field">
        <span className="field-label">Modalità testo</span>
        <div className="source-picker">
          <button
            type="button"
            className={mode === "manual" ? "is-selected" : ""}
            aria-pressed={mode === "manual"}
            onClick={() => {
              if (mode === "manual") return;
              setValue(
                basePath as FieldPath<ConfiguratorData>,
                { mode: "manual", title: "", subtitle: "" } as never,
                { shouldDirty: true, shouldValidate: true },
              );
            }}
          >Manuale</button>
          <button
            type="button"
            className={mode === "ai" ? "is-selected" : ""}
            aria-pressed={mode === "ai"}
            onClick={() => {
              if (mode === "ai") return;
              setValue(
                basePath as FieldPath<ConfiguratorData>,
                { mode: "ai", brief: "" } as never,
                { shouldDirty: true, shouldValidate: true },
              );
            }}
          >Generato da AI</button>
        </div>
      </div>
      {mode === "manual" ? (
        <div className="section-fields">
          <TextInput label="Titolo" name={`${basePath}.title` as FieldPath<ConfiguratorData>} register={register} error={getError(`${basePath}.title`)} placeholder="Una frase che resta" />
          <TextInput label="Sottotesto (facoltativo)" name={`${basePath}.subtitle` as FieldPath<ConfiguratorData>} register={register} placeholder="Aggiungi un dettaglio, se vuoi" />
        </div>
      ) : (
        <TextArea
          label="Cosa raccontare"
          name={`${basePath}.brief` as FieldPath<ConfiguratorData>}
          register={register}
          error={getError(`${basePath}.brief`)}
          placeholder="Descrivi il messaggio o l'emozione da trasmettere"
        />
      )}
      <span id={`${idBase}-assist`} className="field-hint">Puoi scrivere il testo o lasciare un brief per una fase successiva.</span>
    </div>
  );
}

export default function ConfiguratorWizard() {
  const defaults = useMemo(initialValues, []);
  const {
    control,
    register,
    watch,
    getValues,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ConfiguratorData>({
    resolver: zodResolver(configuratorSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: "sections" });
  const watched = useWatch({ control }) as ConfiguratorData;
  const sections = useMemo(() => watched.sections ?? [], [watched.sections]);
  const copyStyle = watched.brand?.existingSite?.copyStyle ?? false;
  const [step, setStep] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [fileWarnings, setFileWarnings] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const files = useRef(new Map<string, StoredFile>());
  const uploadVersions = useRef(new Map<string, number>());
  const uploadSeq = useRef(0);
  const fileUrlsRef = useRef(fileUrls);
  fileUrlsRef.current = fileUrls;

  const invalidateUploads = (sectionId?: string) => {
    if (sectionId === undefined) {
      uploadVersions.current.clear();
      return;
    }
    const prefix = `${sectionId}:`;
    uploadVersions.current.forEach((_, key) => {
      if (key.startsWith(prefix)) uploadVersions.current.delete(key);
    });
  };

  useEffect(() => {
    const referencedIds = new Set<string>();
    const addFileRef = (fileRef?: FileRef | null) => {
      if (fileRef?.id) referencedIds.add(fileRef.id);
    };
    addFileRef(watched.brand?.logo);
    sections.forEach((section) => {
      if (section.type === "A") {
        addFileRef(section.photo);
      } else if (section.media.source === "photos") {
        addFileRef(section.media.startPhoto);
        addFileRef(section.media.endPhoto);
      } else {
        addFileRef(section.media.video);
      }
    });

    const unreferencedIds: string[] = [];
    files.current.forEach(({ url }, id) => {
      if (!referencedIds.has(id)) {
        URL.revokeObjectURL(url);
        files.current.delete(id);
        unreferencedIds.push(id);
      }
    });
    if (unreferencedIds.length) {
      setFileUrls((current) => {
        const next = { ...current };
        unreferencedIds.forEach((id) => delete next[id]);
        return next;
      });
    }
  }, [sections, watched.brand?.logo]);

  useEffect(() => () => {
    files.current.forEach(({ url }) => URL.revokeObjectURL(url));
    files.current.clear();
    uploadVersions.current.clear();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const getError = useCallback((path: string) => {
    const message = get(errors, path)?.message;
    return typeof message === "string" ? message : undefined;
  }, [errors]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ConfiguratorData;
        if (parsed && typeof parsed === "object" && parsed.brand && Array.isArray(parsed.sections)) {
          reset(parsed);
          setDraftRestored(true);
        }
      }
    } catch {
      localStorage.removeItem(draftKey);
    } finally {
      setHydrated(true);
    }
  }, [reset]);

  useEffect(() => {
    if (!hydrated) return;
    const subscription = watch((values) => {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        localStorage.setItem(draftKey, JSON.stringify(values));
      }, 450);
    });
    return () => subscription.unsubscribe();
  }, [watch, hydrated]);

  const saveTimer = useRef<number>(0);

  useEffect(() => {
    if (copyStyle) {
      setValue("style.colors", { mode: "site" }, { shouldDirty: true });
      setValue("style.fonts", { mode: "site" }, { shouldDirty: true });
    } else if (watched.style?.colors?.mode === "site" || watched.style?.fonts?.mode === "site") {
      setValue("style.colors", { mode: "ai" }, { shouldDirty: true });
      setValue("style.fonts", { mode: "ai" }, { shouldDirty: true });
    }
  }, [copyStyle, setValue, watched.style?.colors?.mode, watched.style?.fonts?.mode]);

  const hasUsableFrame = useCallback((index: number) => {
    const previous = sections[index - 1] as Section | undefined;
    const frame = getSectionFrame(previous);
    return Boolean(frame);
  }, [sections]);

  useEffect(() => {
    sections.forEach((section, index) => {
      if (
        (section.type === "B" || section.type === "C") &&
        section.media?.source === "photos" &&
        section.media.linkPrevious &&
        !hasUsableFrame(index)
      ) {
        setValue(`sections.${index}.media.linkPrevious` as FieldPath<ConfiguratorData>, false as never, { shouldDirty: true });
        setValue(`sections.${index}.media.startPhoto` as FieldPath<ConfiguratorData>, null as never, { shouldDirty: true });
      }
    });
  }, [sections, hasUsableFrame, setValue]);

  const uploadFile = useCallback(async (
    path: FieldPath<ConfiguratorData>,
    file: File | undefined,
    kind: FileKind,
    sectionId?: string,
  ) => {
    if (!file) return;
    const key = String(path);
    const fieldName = sectionId ? key.replace(/^sections\.\d+\./, "") : key;
    const requestKey = sectionId ? `${sectionId}:${fieldName}` : fieldName;
    const requestVersion = ++uploadSeq.current;
    uploadVersions.current.set(requestKey, requestVersion);
    const isCurrentRequest = () => uploadVersions.current.get(requestKey) === requestVersion;
    const resolveCurrentPath = (): FieldPath<ConfiguratorData> | null => {
      if (!sectionId) return path;
      const currentSections = getValues("sections");
      const index = currentSections.findIndex((section) => section.id === sectionId);
      const section = currentSections[index];
      if (!section) return null;
      if (fieldName === "photo" && section.type !== "A") return null;
      if (fieldName === "media.video" && (section.type === "A" || section.media.source !== "video")) return null;
      if (
        (fieldName === "media.startPhoto" || fieldName === "media.endPhoto") &&
        (section.type === "A" || section.media.source !== "photos")
      ) return null;
      return `sections.${index}.${fieldName}` as FieldPath<ConfiguratorData>;
    };
    const check = kind === "image" ? validateImageFile(file) : validateVideoFile(file);
    if (check.error) {
      const currentPath = resolveCurrentPath();
      if (!isCurrentRequest() || !currentPath) return;
      const currentKey = String(currentPath);
      setFileErrors((current) => ({ ...current, [currentKey]: check.error! }));
      setValue(currentPath, null as never, { shouldDirty: true, shouldValidate: true });
      return;
    }
    try {
      let dimensions: { width?: number; height?: number } = {};
      let duration: number | undefined;
      if (kind === "image") dimensions = await readImageDimensions(file);
      else {
        duration = await readVideoDuration(file);
        const durationCheck = validateVideoDuration(duration);
        if (durationCheck.error) {
          const currentPath = resolveCurrentPath();
          if (!isCurrentRequest() || !currentPath) return;
          const currentKey = String(currentPath);
          setFileErrors((current) => ({ ...current, [currentKey]: durationCheck.error! }));
          setValue(currentPath, null as never, { shouldDirty: true, shouldValidate: true });
          return;
        }
      }
      if (!isCurrentRequest()) return;
      const currentPath = resolveCurrentPath();
      if (!currentPath) return;
      const currentKey = String(currentPath);
      const fileRef = toFileRef(file, dimensions, duration);
      const url = URL.createObjectURL(file);
      files.current.set(fileRef.id, { file, url });
      setFileUrls((current) => ({ ...current, [fileRef.id]: url }));
      setFileErrors((current) => {
        const next = { ...current };
        delete next[currentKey];
        return next;
      });
      const warning = kind === "image" ? imageResolutionWarning(dimensions.width, dimensions.height) : undefined;
      setFileWarnings((current) => warning ? { ...current, [currentKey]: warning } : { ...current, [currentKey]: "" });
      setValue(currentPath, fileRef as never, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      if (!isCurrentRequest()) return;
      const currentPath = resolveCurrentPath();
      if (!currentPath) return;
      const currentKey = String(currentPath);
      setFileErrors((current) => ({ ...current, [currentKey]: error instanceof Error ? error.message : "Impossibile leggere il file." }));
    }
  }, [getValues, setValue]);

  const filePicker = (
    path: FieldPath<ConfiguratorData>,
    label: string,
    kind: FileKind,
    fileRef?: FileRef | null,
    required = true,
    sectionId?: string,
  ) => {
    const key = String(path);
    const id = key.replaceAll(".", "-");
    const url = fileRef ? fileUrls[fileRef.id] : undefined;
    const accept = kind === "image" ? "image/jpeg,image/png,image/webp,image/heic,image/heif" : "video/mp4,video/quicktime,video/webm";
    const chooseLabel = kind === "video" ? "Scegli video" : key === "brand.logo" ? "Scegli logo" : "Scegli foto";
    return (
      <div className="field">
        <label htmlFor={id}>{label}{required ? " *" : ""}</label>
        <div className="file-control">
          <input
            id={id}
            className="file-input-visually-hidden"
            type="file"
            accept={accept}
            aria-describedby={[fileErrors[key] ? `${id}-error` : "", fileWarnings[key] ? `${id}-warning` : ""].filter(Boolean).join(" ") || undefined}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              void uploadFile(path, event.target.files?.[0], kind, sectionId);
            }}
          />
          <label className="file-choose-button" htmlFor={id}>{chooseLabel}</label>
          <span className="file-name">{fileRef?.name ?? "Nessun file selezionato"}</span>
          <FilePreview fileRef={fileRef} url={url} kind={kind} />
        </div>
        {fileErrors[key] && <span className="field-error" id={`${id}-error`} role="alert">{fileErrors[key]}</span>}
        {fileWarnings[key] && <span className="field-hint" id={`${id}-warning`}>{fileWarnings[key]}</span>}
      </div>
    );
  };

  const missingFileIssues = useCallback((data: ConfiguratorData): StepIssue[] => {
    const missing: StepIssue[] = [];
    const hasFile = (ref?: FileRef | null) => Boolean(ref && fileUrlsRef.current[ref.id]);
    data.sections.forEach((section, index) => {
      if (section.type === "A") {
        if (!hasFile(section.photo)) missing.push({ path: `sections.${index}.photo`, message: "Ricarica la foto della sezione." });
        return;
      }
      if (section.media.source === "video") {
        if (!hasFile(section.media.video)) missing.push({ path: `sections.${index}.media.video`, message: "Ricarica il video della sezione." });
        return;
      }
      if (!hasFile(section.media.endPhoto)) missing.push({ path: `sections.${index}.media.endPhoto`, message: "Ricarica la foto finale della sezione." });
      if (section.media.linkPrevious) {
        const inherited = getSectionFrame(data.sections[index - 1]);
        if (!hasFile(inherited)) missing.push({ path: `sections.${index}.media.linkPrevious`, message: "Ricarica il fotogramma della sezione precedente." });
      } else if (!hasFile(section.media.startPhoto)) {
        missing.push({ path: `sections.${index}.media.startPhoto`, message: "Ricarica la foto iniziale della sezione." });
      }
    });
    return missing;
  }, []);

  const getIssues = useCallback((data: ConfiguratorData): StepIssue[] => {
    const parsed = configuratorSchema.safeParse(data);
    const schemaIssues = parsed.success
      ? []
      : parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    return [...schemaIssues, ...missingFileIssues(data)];
  }, [missingFileIssues]);

  const applyIssues = (issues: StepIssue[], prefix = "") => {
    clearErrors();
    issues.forEach((issue) => {
      const path = `${prefix}${issue.path}` as FieldPath<ConfiguratorData>;
      setError(path, { type: "manual", message: issue.message });
    });
  };

  const validateStep = () => {
    const data = getValues();
    let result: { success: boolean; issues: StepIssue[] };
    if (step === 1) {
      const parsed = projectFieldsSchema.safeParse(data.brand);
      result = {
        success: parsed.success,
        issues: parsed.success ? [] : parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      };
      if (result.issues.length) applyIssues(result.issues, "brand.");
    } else if (step === 2) {
      const parsed = contactFieldsSchema.safeParse(data.brand);
      const issues = parsed.success ? [] : parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
      if (!data.brand.existingSite.replicateContent && !data.brand.seo.primaryKeyword.trim()) {
        issues.push({ path: "seo.primaryKeyword", message: "La keyword primaria è obbligatoria." });
      }
      result = { success: issues.length === 0, issues };
      if (issues.length) applyIssues(issues, "brand.");
    } else if (step === 3) {
      const parsed = styleSchema.safeParse(data.style);
      result = {
        success: parsed.success,
        issues: parsed.success ? [] : parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      };
      if (result.issues.length) applyIssues(result.issues, "style.");
    } else if (step === 4) {
      const parsed = sectionsSchema.safeParse(data.sections);
      const issues = parsed.success ? [] : parsed.error.issues.map((issue) => ({ path: `sections.${issue.path.join(".")}`, message: issue.message }));
      issues.push(...missingFileIssues(data));
      result = { success: issues.length === 0, issues };
      if (issues.length) applyIssues(issues);
    } else {
      const issues = getIssues(data);
      result = { success: issues.length === 0, issues };
      if (issues.length) applyIssues(issues);
    }
    setSuccess("");
    if (!result.success) {
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return false;
    }
    clearErrors();
    return true;
  };

  const goNext = () => {
    if (validateStep()) setStep((current) => Math.min(5, current + 1));
  };

  const removeSections = (indexes: number[]) => {
    indexes.forEach((index) => {
      const sectionId = sections[index]?.id;
      if (sectionId) invalidateUploads(sectionId);
    });
    remove(indexes);
  };

  const changeSectionCount = (count: number) => {
    const target = Math.min(12, Math.max(1, count));
    if (target > fields.length) {
      for (let index = fields.length; index < target; index += 1) append(blankSection("A") as never);
    } else if (target < fields.length) {
      removeSections(Array.from({ length: fields.length - target }, (_, index) => target + index));
    }
  };

  const reorderSections = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return;
    move(from, to);
    clearErrors("sections");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = sections.findIndex((section) => section.id === event.active.id);
    const newIndex = sections.findIndex((section) => section.id === event.over?.id);
    if (oldIndex >= 0 && newIndex >= 0) reorderSections(oldIndex, newIndex);
  };

  const chooseSectionType = (index: number, type: "A" | "B" | "C") => {
    const current = sections[index];
    if (!current || current.type === type) return;
    invalidateUploads(current.id);
    setValue(`sections.${index}` as FieldPath<ConfiguratorData>, blankSection(type, current.id) as never, { shouldDirty: true, shouldValidate: true });
  };

  const changeMediaSource = (index: number, source: "photos" | "video") => {
    const current = sections[index];
    if (!current || (current.type !== "B" && current.type !== "C")) return;
    if (current.media.source === source) return;
    invalidateUploads(current.id);
    const nextMedia = source === "photos"
      ? { source, startPhoto: null, endPhoto: null, linkPrevious: false, durationSec: 5 }
      : { source, video: null };
    setValue(`sections.${index}.media` as FieldPath<ConfiguratorData>, nextMedia as never, { shouldDirty: true, shouldValidate: true });
  };

  const setManualColor = (key: "primary" | "secondary", value: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) return;
    const current = watched.style.colors;
    const primary = key === "primary" ? value : current.mode === "manual" ? current.primary : "#758d15";
    const secondary = key === "secondary" ? value : current.mode === "manual" ? current.secondary : "#7ad03a";
    setValue("style.colors", { mode: "manual", ...deriveColors(primary, secondary) }, { shouldDirty: true, shouldValidate: true });
  };

  const applyHappyPreset = () => {
    setValue("brand.existingSite.copyStyle", false, { shouldDirty: true });
    setValue("style.colors", { mode: "manual", ...deriveColors("#758d15", "#7ad03a") }, { shouldDirty: true });
    setValue("style.fonts", { mode: "manual", pairId: "happy-tuscany" }, { shouldDirty: true });
  };

  const clearDraft = () => {
    localStorage.removeItem(draftKey);
    window.clearTimeout(saveTimer.current);
    setFileErrors({});
    setFileWarnings({});
    setDraftRestored(false);
    invalidateUploads();
    reset(initialValues());
    setStep(1);
    setSuccess("");
    clearErrors();
  };

  const exportJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportConfiguredData = (filename: "brand.json" | "scenes.json") => {
    const values = getValues();
    const parsed = configuratorSchema.safeParse(values);
    if (!parsed.success || missingFileIssues(values).length > 0) return;
    const data = filename === "brand.json"
      ? { ...parsed.data.brand, style: parsed.data.style }
      : { version: 1, sections: parsed.data.sections };
    exportJson(filename, data);
  };

  const summaryIssues = getIssues(watched);
  const colors = watched.style.colors;
  const colorMode = colors.mode;
  const manualColors = colorMode === "manual" ? colors : null;
  const primaryContrast = manualColors ? contrastRatio(manualColors.primary, manualColors.background) : 0;
  const textContrast = manualColors ? contrastRatio(manualColors.text, manualColors.background) : 0;
  const sectionTotal = sections.length;
  const totalAI = totalCost(sections as Section[]);

  const renderTextBlock = (basePath: string) => (
    <TextBlockFields basePath={basePath} register={register} getError={getError} control={control} setValue={setValue} />
  );

  const renderSection = (section: Section | undefined, index: number, dragHandle: ReactNode) => {
    if (!section) return null;
    const sectionData = section;
    const sectionId = sectionData?.id ?? `section-${index + 1}`;
    const media = sectionData.type === "B" || sectionData.type === "C" ? sectionData.media : undefined;
    const canLink = index > 0 && Boolean(getSectionFrame(sections[index - 1] as Section)) && hasUsableFrame(index);
    const inheritedFrame = canLink ? getSectionFrame(sections[index - 1] as Section) : null;
  const setSectionMode = (path: string, value: string | number) => setValue(path as FieldPath<ConfiguratorData>, value as never, { shouldDirty: true });
    return (
      <section className="section-card" key={sectionId} aria-label={`Sezione ${index + 1}`}>
        <div className="section-card-head">
          <div className="section-title-group">
            {dragHandle}
            <span className="section-index">{String(index + 1).padStart(2, "0")}</span>
            <h3>Sezione {index + 1}</h3>
          </div>
          <div className="section-actions">
            <button className="icon-button" type="button" aria-label={`Sposta sezione ${index + 1} su`} title={`Sposta sezione ${index + 1} su`} disabled={index === 0} onClick={() => reorderSections(index, index - 1)}><Icon name="chevron-up" /></button>
            <button className="icon-button" type="button" aria-label={`Sposta sezione ${index + 1} giù`} title={`Sposta sezione ${index + 1} giù`} disabled={index === sectionTotal - 1} onClick={() => reorderSections(index, index + 1)}><Icon name="chevron-down" /></button>
            <button
              className="icon-button"
              type="button"
              aria-label={`Duplica sezione ${index + 1}`}
              title={`Duplica sezione ${index + 1}`}
              disabled={sectionTotal >= 12}
              onClick={() => {
                const copy = structuredClone(sections[index]) as Section;
                copy.id = crypto.randomUUID();
                append(copy as never, { shouldFocus: false });
              }}
            ><Icon name="copy" /></button>
            <button className="icon-button" type="button" aria-label={`Rimuovi sezione ${index + 1}`} title={`Rimuovi sezione ${index + 1}`} disabled={sectionTotal <= 1} onClick={() => removeSections([index])}><Icon name="close" /></button>
          </div>
        </div>
        <div className="section-type-grid" role="group" aria-label={`Tipo della sezione ${index + 1}`}>
          {(["A", "B", "C"] as const).map((type) => (
            <button
              type="button"
              key={type}
              className={`type-choice ${sectionData.type === type ? "is-selected" : ""}`}
              aria-pressed={sectionData.type === type}
              aria-label={`Sezione ${index + 1}: ${sectionLabels[type]}`}
              onClick={() => chooseSectionType(index, type)}
            >
              <TypeDiagram type={type} />
              <strong>{sectionLabels[type]}</strong>
              <small>
                {type === "A"
                  ? "Una foto fissa: il primo testo sfuma e il secondo compare con lo scroll."
                  : type === "B"
                    ? "Il video scorre fino all'ultimo fotogramma, poi entra il testo finale."
                    : "Il testo laterale resta sovrapposto mentre il video scorre."}
              </small>
            </button>
          ))}
        </div>
        {sectionData.type === "A" ? (
          <div className="section-fields">
            <div className="subsection">
              <h4>Foto a tutto schermo</h4>
              {filePicker(`sections.${index}.photo` as FieldPath<ConfiguratorData>, "Foto", "image", sectionData.photo, true, sectionId)}
            </div>
            <div className="subsection">
              <h4>Testo iniziale</h4>
              {renderTextBlock(`sections.${index}.text1`)}
            </div>
            <div className="subsection span-two">
              <h4>Testo dopo la dissolvenza</h4>
              {renderTextBlock(`sections.${index}.text2`)}
            </div>
          </div>
        ) : (
          <>
            <div className="field">
              <span className="field-label">Sorgente media</span>
              <div className="source-picker">
                <button type="button" className={media?.source === "photos" ? "is-selected" : ""} aria-pressed={media?.source === "photos"} onClick={() => changeMediaSource(index, "photos")}>Due foto · clip AI</button>
                <button type="button" className={media?.source === "video" ? "is-selected" : ""} aria-pressed={media?.source === "video"} onClick={() => changeMediaSource(index, "video")}>Carica un video</button>
              </div>
            </div>
            {media?.source === "photos" ? (
              <div className="section-fields">
                <div className="subsection">
                  <h4>Fotogramma iniziale</h4>
                  {media.linkPrevious && inheritedFrame ? (
                    <div className="file-preview">
                  {fileUrls[inheritedFrame.id] ? <Image src={fileUrls[inheritedFrame.id]} alt="Fotogramma ereditato dalla sezione precedente" width={82} height={55} unoptimized /> : <span className="file-preview-missing">Da ricaricare</span>}
                      <span>Immagine ereditata · {inheritedFrame.name}</span>
                    </div>
                  ) : filePicker(`sections.${index}.media.startPhoto` as FieldPath<ConfiguratorData>, "Foto iniziale", "image", media.startPhoto, true, sectionId)}
                  <label className="check-row" style={{ marginTop: 12 }}>
                    <input
                      type="checkbox"
                      checked={media.linkPrevious}
                      disabled={!canLink}
                      aria-describedby={`link-prev-${index}-hint`}
                      onChange={(event) => {
                        setValue(`sections.${index}.media.linkPrevious` as FieldPath<ConfiguratorData>, event.target.checked as never, { shouldDirty: true, shouldValidate: true });
                        if (event.target.checked) setValue(`sections.${index}.media.startPhoto` as FieldPath<ConfiguratorData>, null as never, { shouldDirty: true });
                      }}
                    />
                    <span>Raccorda con la sezione precedente</span>
                  </label>
                  {!canLink && <small className="field-hint" id={`link-prev-${index}-hint`}>Disponibile quando la sezione precedente termina con una foto utilizzabile.</small>}
                  {canLink && <small className="field-hint" id={`link-prev-${index}-hint`}>Usa il fotogramma finale della sezione precedente.</small>}
                </div>
                <div className="subsection">
                  <h4>Fotogramma finale</h4>
                  {filePicker(`sections.${index}.media.endPhoto` as FieldPath<ConfiguratorData>, "Foto finale", "image", media.endPhoto, true, sectionId)}
                  <div className="field" style={{ marginTop: 14 }}>
                    <label htmlFor={`duration-${index}`}>Durata clip stimata</label>
                    <select
                      id={`duration-${index}`}
                      value={media.durationSec}
                      onChange={(event) => setSectionMode(`sections.${index}.media.durationSec`, Number(event.target.value))}
                    >
                      <option value={5}>5 secondi · {formatCost(5 * 0.058)}</option>
                      <option value={10}>10 secondi · {formatCost(10 * 0.058)}</option>
                    </select>
                  </div>
                </div>
                <div className="span-two">
                  <TextInput label="Descrizione del movimento (facoltativa)" name={`sections.${index}.media.motionPrompt` as FieldPath<ConfiguratorData>} register={register} placeholder="Es. lento avvicinamento verso la terrazza" />
                  <p className="cost-badge">Stima indicativa per questa sezione: <strong>{formatCost(sectionCost(sectionData))}</strong></p>
                </div>
              </div>
            ) : (
              <div className="subsection">
                <h4>Video pronto</h4>
                {filePicker(`sections.${index}.media.video` as FieldPath<ConfiguratorData>, "Video", "video", media?.source === "video" ? media.video : null, true, sectionId)}
                <p className="cost-badge">Nessun costo AI per i video caricati.</p>
              </div>
            )}
            <div className="subsection" style={{ marginTop: 15 }}>
              <h4>{sectionData.type === "B" ? "Testo finale" : "Testo laterale"}</h4>
              {renderTextBlock(sectionData.type === "B" ? `sections.${index}.endText` : `sections.${index}.sideText`)}
            </div>
          </>
        )}
        {(getError(`sections.${index}`) || getError(`sections.${index}.media.startPhoto`) || getError(`sections.${index}.media.endPhoto`)) && (
          <p className="field-error" role="alert">{getError(`sections.${index}.media.startPhoto`) ?? getError(`sections.${index}.media.endPhoto`) ?? getError(`sections.${index}`)}</p>
        )}
      </section>
    );
  };

  const setStyleMode = (part: "colors" | "fonts", mode: "ai" | "manual") => {
    if (part === "colors") {
      setValue("style.colors", mode === "ai" ? { mode } : { mode, ...deriveColors("#758d15", "#7ad03a") }, { shouldDirty: true, shouldValidate: true });
    } else {
      setValue("style.fonts", mode === "ai" ? { mode } : { mode, pairId: "happy-tuscany" }, { shouldDirty: true, shouldValidate: true });
    }
  };

  const setLanguage = (language: string, checked: boolean) => {
    const current = watched.brand.languages ?? [];
    setValue("brand.languages", checked ? [...new Set([...current, language])] as never : current.filter((item) => item !== language) as never, { shouldDirty: true, shouldValidate: true });
  };

  const addKeyword = () => {
    const input = document.getElementById("secondary-keyword-input") as HTMLInputElement | null;
    const value = input?.value.trim();
    if (!value || (watched.brand.seo.secondaryKeywords ?? []).length >= 5) return;
    setValue("brand.seo.secondaryKeywords", [...watched.brand.seo.secondaryKeywords, value], { shouldDirty: true, shouldValidate: true });
    if (input) input.value = "";
  };

  const keywordList = watched.brand.seo.secondaryKeywords ?? [];
  const fonts = watched.style.fonts;
  const selectedPair = fonts.mode === "manual"
    ? fontPairs.find((pair) => pair.id === fonts.pairId) ?? fontPairs[0]
    : undefined;

  if (!hydrated) return <div className="loading-message">Apro il tuo progetto…</div>;

  return (
    <div className="wizard-shell">
      <header className="wizard-topbar">
        <Link className="wordmark" href="/">scroll<span>studio</span></Link>
        <div className="topbar-meta"><span>PROGETTA IL TUO SITO</span><Link href="/"><Icon name="arrow-left" /> Torna al sito</Link></div>
      </header>
      <main className="wizard-main">
        <div className="wizard-heading">
          <div>
            <p className="wizard-kicker">IL TUO PROGETTO, PASSO DOPO PASSO</p>
            <h1>Crea il tuo sito</h1>
          </div>
          <button className="draft-button" type="button" onClick={clearDraft}>Svuota bozza</button>
        </div>
        <nav className="stepper" aria-label="Avanzamento del configuratore">
          {stepNames.map((name, index) => {
            const currentStep = index + 1;
            return (
              <div key={name} className={`step-item ${step === currentStep ? "is-active" : ""} ${step > currentStep ? "is-complete" : ""}`} aria-current={step === currentStep ? "step" : undefined}>
                <span className="step-number">{step > currentStep ? <Icon name="check" /> : currentStep}</span>
                <span>{name}</span>
              </div>
            );
          })}
        </nav>
        {draftRestored && (
          <div className="draft-banner" role="status">
            Bozza ripristinata. Le foto/video vanno ricaricati: i file restano soltanto nel browser mentre lavori.
          </div>
        )}
        {success && <div className="success-banner" role="status">{success}</div>}
        <form onSubmit={(event) => event.preventDefault()} noValidate>
          <div className="wizard-card">
            {step === 1 && (
              <>
                <div className="step-heading"><p className="section-kicker">PASSO 1 DI 5</p><h2>Il tuo progetto</h2><p>Raccontaci chi sei e cosa vuoi far vivere a chi visita il tuo sito.</p></div>
                <div className="form-grid">
                  <TextInput label="Sito esistente (facoltativo)" name="brand.existingSite.url" register={register} error={getError("brand.existingSite.url")} placeholder="https://www.esempio.it" type="url" hint="Puoi inserire un solo indirizzo web." />
                  <div className="field">
                    <span className="field-label">Cosa possiamo riprendere dal sito?</span>
                    <label className="check-row">
                      <input type="checkbox" {...register("brand.existingSite.replicateContent")} />
                      <span><strong>Replica i contenuti</strong><small>Testi, foto e contatti saranno facoltativi in questa bozza.</small></span>
                    </label>
                    <label className="check-row">
                      <input type="checkbox" {...register("brand.existingSite.copyStyle")} />
                      <span><strong>Copia lo stile dal mio sito</strong><small>Colori e font saranno impostati sullo stile esistente.</small></span>
                    </label>
                  </div>
                  <TextInput label="Nome della struttura o del progetto" name="brand.name" register={register} error={getError("brand.name")} placeholder="Es. Casa delle colline" />
                  <div>{filePicker("brand.logo", "Logo (facoltativo)", "image", watched.brand.logo, false)}</div>
                  <TextArea label="Missione" name="brand.mission" register={register} error={getError("brand.mission")} placeholder="Cosa rende speciale ciò che fai?" />
                  <TextArea label="Valori e senso" name="brand.values" register={register} placeholder="Quali valori vuoi trasmettere?" />
                  <TextArea label="A chi ti rivolgi?" name="brand.target" register={register} placeholder="Descrivi le persone che vuoi raggiungere." />
                  <div className="field">
                    <label htmlFor="brand-tone">Tono di voce</label>
                    <select id="brand-tone" {...register("brand.tone")}>
                      {["elegante", "familiare", "avventuroso", "romantico", "lusso", "sostenibile", "giovane"].map((tone) => <option key={tone} value={tone}>{tone[0].toUpperCase() + tone.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="field span-two">
                    <span className="field-label">Lingue del sito</span>
                    <div className="language-list">
                      {[["it", "Italiano"], ["en", "English"], ["de", "Deutsch"], ["fr", "Français"], ["es", "Español"], ["nl", "Nederlands"]].map(([code, label]) => (
                        <label className="choice-chip" key={code}>
                          <input type="checkbox" checked={watched.brand.languages.includes(code as never)} onChange={(event) => setLanguage(code, event.target.checked)} />
                          {label}
                        </label>
                      ))}
                    </div>
                    {getError("brand.languages") && <span className="field-error" role="alert">{getError("brand.languages")}</span>}
                  </div>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div className="step-heading"><p className="section-kicker">PASSO 2 DI 5</p><h2>Contatti, SEO e dati legali</h2><p>Le informazioni utili per farti trovare e contattare.</p></div>
                <h3 className="form-section-title">Contatti e invito all’azione</h3>
                <div className="form-grid">
                  <TextInput label="Email" name="brand.contacts.email" register={register} error={getError("brand.contacts.email")} type="email" placeholder="ciao@esempio.it" />
                  <TextInput label="Telefono" name="brand.contacts.phone" register={register} placeholder="+39 000 000 0000" />
                  <TextInput label="WhatsApp" name="brand.contacts.whatsapp" register={register} placeholder="+39 000 000 0000" />
                  <TextInput label="Indirizzo" name="brand.contacts.address" register={register} placeholder="Via, città, CAP" />
                  <TextInput label="Instagram" name="brand.contacts.socials.instagram" register={register} error={getError("brand.contacts.socials.instagram")} type="url" placeholder="https://instagram.com/..." />
                  <TextInput label="Facebook" name="brand.contacts.socials.facebook" register={register} error={getError("brand.contacts.socials.facebook")} type="url" placeholder="https://facebook.com/..." />
                  <TextInput label="TikTok" name="brand.contacts.socials.tiktok" register={register} error={getError("brand.contacts.socials.tiktok")} type="url" placeholder="https://tiktok.com/@..." />
                  <TextInput label="Testo del pulsante principale" name="brand.cta.label" register={register} placeholder="Es. Prenota ora" />
                  <TextInput label="Link del pulsante principale" name="brand.cta.url" register={register} error={getError("brand.cta.url")} type="url" placeholder="https://..." />
                </div>
                <div className="form-section">
                  <h3 className="form-section-title">SEO</h3>
                  <div className="form-grid">
                    <TextInput label="Titolo SEO" name="brand.seo.title" register={register} placeholder="Un titolo per i risultati di ricerca" />
                    <TextInput label="Keyword primaria" name="brand.seo.primaryKeyword" register={register} error={getError("brand.seo.primaryKeyword")} placeholder="Es. casa vacanze in Toscana" hint={watched.brand.existingSite.replicateContent ? "Facoltativa con la replica dei contenuti." : "Obbligatoria per aiutare le persone a trovarti."} />
                    <div className="span-two">
                      <TextArea label="Descrizione SEO" name="brand.seo.description" register={register} error={getError("brand.seo.description")} maxLength={160} placeholder="Riassumi il tuo progetto in massimo 160 caratteri." hint={`${watched.brand.seo.description.length}/160 caratteri`} />
                    </div>
                    <div className="field span-two">
                      <label htmlFor="secondary-keyword-input">Keyword secondarie <small>fino a 5</small></label>
                      <div className="source-picker">
                        <input id="secondary-keyword-input" className="text-input" placeholder="Aggiungi una keyword" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addKeyword(); } }} />
                        <button type="button" onClick={addKeyword} disabled={keywordList.length >= 5}>Aggiungi</button>
                      </div>
                      <div className="language-list">
                        {keywordList.map((keyword, index) => <button key={`${keyword}-${index}`} className="choice-chip" type="button" aria-label={`Rimuovi keyword ${keyword}`} title={`Rimuovi keyword ${keyword}`} onClick={() => setValue("brand.seo.secondaryKeywords", keywordList.filter((_, current) => current !== index), { shouldDirty: true, shouldValidate: true })}>{keyword} <Icon name="close" /></button>)}
                      </div>
                      {getError("brand.seo.secondaryKeywords") && <span className="field-error" role="alert">{getError("brand.seo.secondaryKeywords")}</span>}
                    </div>
                  </div>
                </div>
                <div className="form-section">
                  <h3 className="form-section-title">Dati legali · facoltativi</h3>
                  <div className="form-grid">
                    <TextInput label="Ragione sociale" name="brand.legal.companyName" register={register} />
                    <TextInput label="Partita IVA" name="brand.legal.vat" register={register} />
                    <TextInput label="Link privacy" name="brand.legal.privacyUrl" register={register} error={getError("brand.legal.privacyUrl")} type="url" placeholder="https://..." />
                    <TextInput label="Link cookie" name="brand.legal.cookieUrl" register={register} error={getError("brand.legal.cookieUrl")} type="url" placeholder="https://..." />
                  </div>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <div className="step-heading"><p className="section-kicker">PASSO 3 DI 5</p><h2>Lo stile del tuo sito</h2><p>Colori e caratteri danno forma alla prima impressione.</p></div>
                {copyStyle && <div className="notice-banner">Hai scelto di copiare lo stile del sito: colori e font sono impostati su “Sito” e i controlli manuali sono disattivati.</div>}
                <button className="preset-button" type="button" onClick={applyHappyPreset} disabled={copyStyle}><Icon name="sparkle" /> Prova lo stile “Come Happy Tuscany”</button>
                <div className="form-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                  <h3 className="form-section-title">Colori</h3>
                  <div className="style-mode">
                    <label><input type="radio" name="color-mode" checked={colorMode === "manual"} disabled={copyStyle} onChange={() => setStyleMode("colors", "manual")} /><span><strong>Scegli i colori</strong><small>Primario e secondario; sfondo e testo vengono derivati.</small></span></label>
                    <label><input type="radio" name="color-mode" checked={colorMode === "ai"} disabled={copyStyle} onChange={() => setStyleMode("colors", "ai")} /><span><strong>Lascia scegliere all’AI</strong><small>Il carattere visivo verrà definito in una fase successiva.</small></span></label>
                    {copyStyle && <label><input type="radio" name="color-mode" checked={colorMode === "site"} readOnly /><span><strong>Usa lo stile del sito</strong><small>Colori coerenti con il tuo sito esistente.</small></span></label>}
                  </div>
                  {manualColors && (
                    <>
                      <div className="color-controls" style={{ marginTop: 17 }}>
                        {(["primary", "secondary"] as const).map((key) => (
                          <div className="field" key={key}>
                            <span className="field-label">{key === "primary" ? "Colore primario" : "Colore secondario"}</span>
                            <div className="color-input-row">
                              <input type="color" aria-label={`${key === "primary" ? "Primario" : "Secondario"}: selettore colore`} value={manualColors[key]} onChange={(event) => setManualColor(key, event.target.value)} />
                              <input className="text-input" aria-label={`${key === "primary" ? "Primario" : "Secondario"}: codice esadecimale`} value={manualColors[key]} onChange={(event) => setManualColor(key, event.target.value)} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="color-output" style={{ backgroundColor: manualColors.background, color: manualColors.text }}>
                        <div><strong>Una storia fatta per scorrere</strong><span>Testo e sfondo vengono derivati dal primario.</span></div>
                        <span style={{ padding: "6px 10px", borderRadius: 3, background: manualColors.primary, color: "#fff" }}>Primario</span>
                      </div>
                      {(primaryContrast < 4.5 || textContrast < 4.5) && (
                        <p className="contrast-warning" role="status">
                          Attenzione: contrasto da migliorare. Testo/sfondo {textContrast.toFixed(2)}:1 · primario/sfondo {primaryContrast.toFixed(2)}:1. Il valore consigliato WCAG AA è almeno 4,5:1.
                        </p>
                      )}
                      <p className="field-hint">Sfondo derivato: {manualColors.background} · testo: {manualColors.text}</p>
                    </>
                  )}
                </div>
                <div className="form-section">
                  <h3 className="form-section-title">Font</h3>
                  <div className="style-mode">
                    <label><input type="radio" name="font-mode" checked={watched.style.fonts.mode === "manual"} disabled={copyStyle} onChange={() => setStyleMode("fonts", "manual")} /><span><strong>Scegli una coppia</strong><small>Abbinamenti curati per titoli e testi.</small></span></label>
                    <label><input type="radio" name="font-mode" checked={watched.style.fonts.mode === "ai"} disabled={copyStyle} onChange={() => setStyleMode("fonts", "ai")} /><span><strong>Lascia scegliere all’AI</strong><small>La scelta arriverà con la proposta visiva.</small></span></label>
                    {copyStyle && <label><input type="radio" name="font-mode" checked={watched.style.fonts.mode === "site"} readOnly /><span><strong>Usa lo stile del sito</strong><small>Caratteri coerenti con il tuo sito esistente.</small></span></label>}
                  </div>
                  {watched.style.fonts.mode === "manual" && selectedPair && (
                    <>
                      <div className="field" style={{ marginTop: 16 }}>
                        <label htmlFor="font-pair">Abbinamento tipografico</label>
                        <select id="font-pair" value={selectedPair.id} onChange={(event) => setValue("style.fonts", { mode: "manual", pairId: event.target.value }, { shouldDirty: true, shouldValidate: true })}>
                          {fontPairs.map((pair) => <option key={pair.id} value={pair.id}>{pair.name} · {pair.title} + {pair.body}</option>)}
                        </select>
                      </div>
                      <link rel="stylesheet" href={googleFontsUrl(selectedPair)} />
                      <div className="font-preview" style={{ fontFamily: `"${selectedPair.body}", sans-serif` }}>
                        <strong style={{ fontFamily: `"${selectedPair.title}", cursive` }}>Ogni luogo ha una storia.</strong>
                        <p>Una piccola anteprima di come dialogano titolo e testo.</p>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
            {step === 4 && (
              <>
                <div className="step-heading"><p className="section-kicker">PASSO 4 DI 5</p><h2>Disegna le tue sezioni</h2><p>Scegli il ritmo della storia. Puoi aggiungerle, duplicarle o spostarle in qualsiasi momento.</p></div>
                <div className="sections-toolbar">
                  <label htmlFor="section-count">Numero di sezioni
                    <select id="section-count" aria-label="Numero sezioni" value={sectionTotal} onChange={(event) => changeSectionCount(Number(event.target.value))}>
                      {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                    </select>
                  </label>
                  <button className="button-secondary" type="button" aria-label="Aggiungi sezione" title="Aggiungi sezione" disabled={sectionTotal >= 12} onClick={() => append(blankSection("A") as never)}><Icon name="plus" /> Aggiungi sezione</button>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
                    {fields.map((field, index) => (
                      <SortableSection key={field.id} id={sections[index]?.id ?? field.id}>
                        {(dragHandle) => renderSection(sections[index], index, dragHandle)}
                      </SortableSection>
                    ))}
                  </SortableContext>
                </DndContext>
                <div className="summary-cost"><span>Stima indicativa video generati con AI</span><strong>{formatCost(totalAI)}</strong></div>
              </>
            )}
            {step === 5 && (
              <>
                <div className="step-heading"><p className="section-kicker">PASSO 5 DI 5</p><h2>La tua storia, in breve</h2><p>Rivedi la struttura e scarica i dati del progetto. Puoi tornare a qualsiasi passaggio.</p></div>
                <div className="summary-grid">
                  <div className="summary-box">
                    <h3>Progetto e stile</h3>
                    <p><strong>Nome:</strong> {watched.brand.name || "Da definire"}</p>
                    {watched.brand.existingSite.url && <p><strong>Sito:</strong> {watched.brand.existingSite.url}</p>}
                    <p><strong>Tono:</strong> {watched.brand.tone} · <strong>Lingue:</strong> {watched.brand.languages.join(", ").toUpperCase()}</p>
                    <p><strong>Colori:</strong> {watched.style.colors.mode === "manual" ? `${watched.style.colors.primary} / ${watched.style.colors.secondary}` : watched.style.colors.mode === "ai" ? "Scelti dall’AI" : "Sito esistente"}</p>
                    <p><strong>Font:</strong> {selectedPair ? `${selectedPair.title} + ${selectedPair.body}` : watched.style.fonts.mode === "ai" ? "Scelti dall’AI" : "Sito esistente"}</p>
                  </div>
                  <div className="summary-box">
                    <h3>Contatti e SEO</h3>
                    <p><strong>Email:</strong> {watched.brand.contacts.email || "—"}</p>
                    <p><strong>Invito all’azione:</strong> {watched.brand.cta.label || "—"} {watched.brand.cta.url}</p>
                    <p><strong>Keyword primaria:</strong> {watched.brand.seo.primaryKeyword || "—"}</p>
                    <p><strong>Secondarie:</strong> {keywordList.join(", ") || "—"}</p>
                  </div>
                </div>
                <div className="summary-box" style={{ marginTop: 13 }}>
                  <h3>Le tue sezioni · {sectionTotal}</h3>
                  {sections.map((section, index) => {
                    const frame = getSectionFrame(section as Section);
                    const type = section.type;
                    return (
                      <div className="summary-section" key={section.id}>
                        <div className="summary-thumb">{frame && fileUrls[frame.id] ? <Image src={fileUrls[frame.id]} alt="" width={55} height={43} unoptimized /> : type === "B" || type === "C" ? "VIDEO" : "FOTO"}</div>
                        <div><strong>{String(index + 1).padStart(2, "0")} · {sectionLabels[type]}</strong><small>{sectionCost(section as Section) ? `Clip AI · ${formatCost(sectionCost(section as Section))}` : type === "A" ? "Una foto · nessun costo AI" : "Video caricato · nessun costo AI"}</small></div>
                      </div>
                    );
                  })}
                  <div className="summary-cost"><span>Stima indicativa totale AI</span><strong>{formatCost(totalAI)}</strong></div>
                </div>
                {summaryIssues.length > 0 && (
                  <div className="summary-errors">
                    <h3>Ci sono ancora {summaryIssues.length} elementi da completare</h3>
                    {summaryIssues.map((issue, index) => {
                      const targetStep = issue.path.startsWith("sections") ? 4 : issue.path.startsWith("style") ? 3 : issue.path.startsWith("brand.contacts") || issue.path.startsWith("brand.cta") || issue.path.startsWith("brand.seo") || issue.path.startsWith("brand.legal") ? 2 : 1;
                      return <button className="summary-error-link" type="button" key={`${issue.path}-${index}`} onClick={() => { setStep(targetStep); applyIssues([issue]); }}>Passo {targetStep} · {issue.message}</button>;
                    })}
                  </div>
                )}
                <div className="form-section">
                  <h3 className="form-section-title">Esporta o invia la bozza</h3>
                  <p className="field-hint">I file restano nel browser: brand.json e scenes.json contengono metadati, non i file originali.</p>
                  <div className="action-group" style={{ marginTop: 13, flexWrap: "wrap" }}>
                    <button className="button-outline" type="button" disabled={summaryIssues.length > 0} onClick={() => exportConfiguredData("brand.json")}>Scarica brand.json</button>
                    <button className="button-outline" type="button" disabled={summaryIssues.length > 0} onClick={() => exportConfiguredData("scenes.json")}>Scarica scenes.json</button>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={summaryIssues.length > 0}
                      onClick={() => {
                        const payload = { brand: { ...watched.brand, style: watched.style }, scenes: { version: 1, sections: watched.sections } };
                        console.log("Invio mock Scroll Studio", JSON.stringify(payload, null, 2));
                        setSuccess("La tua bozza è pronta. L’invio è una simulazione: non è stato contattato alcun servizio.");
                      }}
                    >Invia</button>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="wizard-actions">
            <button className="button-outline" type="button" disabled={step === 1} onClick={() => { setStep((current) => current - 1); clearErrors(); }}><Icon name="arrow-left" /> Indietro</button>
            <div className="action-group">
              {step < 5 ? (
                <button className="button button-dark" type="button" onClick={goNext}>Avanti <Icon name="arrow-right" /></button>
              ) : (
                <button className="button button-dark" type="button" onClick={() => { setStep(4); clearErrors(); }}>Modifica sezioni <Icon name="arrow-up-right" /></button>
              )}
            </div>
          </div>
        </form>
        <p className="wizard-footer">Una prima bozza, tutta tua. Nessun costo e nessun contenuto viene inviato online.</p>
      </main>
    </div>
  );
}
