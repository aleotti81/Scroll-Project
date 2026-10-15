"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { deriveColors } from "@/lib/color";
import { fontPairs, googleFontsUrl } from "@/lib/fonts";
import { formatCost, totalCost } from "@/lib/cost";
import type { ConfiguratorData, FileRef, Section, TextBlock } from "@/lib/schema";
import type { SiteChrome, SiteLink } from "@/lib/site-import";
import { Icon } from "./icons";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const ramp = (progress: number, start: number, end: number) => clamp((progress - start) / (end - start));

function frameOf(section?: Section): FileRef | null {
  if (!section) return null;
  if (section.type === "A") return section.photo ?? null;
  if (section.media.source === "photos") return section.media.endPhoto ?? null;
  return null;
}

function PreviewText({ block, fallback }: { block?: TextBlock; fallback: string }) {
  if (block?.mode === "ai") {
    return (
      <>
        <p className="preview-ai-badge"><Icon name="sparkle" /> Testo generato dall’AI</p>
        <h2>{block.brief?.trim() ? `«${block.brief.trim()}»` : fallback}</h2>
      </>
    );
  }
  return (
    <>
      <h2>{block?.title?.trim() || fallback}</h2>
      {block?.subtitle?.trim() && <p>{block.subtitle}</p>}
    </>
  );
}

function PreviewImage({ url, label, style }: { url?: string; label: string; style?: CSSProperties }) {
  if (!url) return <div className="preview-media preview-missing" style={style}><span>{label}</span></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="preview-media" src={url} alt="" style={style} />;
}

function PreviewVideo({ url, progress }: { url?: string; progress: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    video.currentTime = Math.min(video.duration - 0.05, progress * video.duration);
  }, [progress]);
  if (!url) return <div className="preview-media preview-missing"><span>Video da ricaricare</span></div>;
  return <video ref={ref} className="preview-media" src={url} muted playsInline preload="auto" />;
}

const chromeCache = new Map<string, Promise<SiteChrome | null>>();

function loadSiteChrome(url: string) {
  let request = chromeCache.get(url);
  if (!request) {
    request = fetch("/api/site-import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    })
      .then((response) => (response.ok ? (response.json() as Promise<SiteChrome>) : null))
      .catch(() => null);
    chromeCache.set(url, request);
  }
  return request;
}

function sectionLabel(section: Section, index: number) {
  const block = section.type === "A" ? section.text1 : section.type === "B" ? section.endText : section.sideText;
  const label = block?.mode === "manual" ? block.title?.trim() : "";
  return label && label.length <= 28 ? label : `Sezione ${index + 1}`;
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function ExternalLink({ link }: { link: SiteLink }) {
  return <a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>;
}

export default function SitePreview({
  data,
  fileUrls,
  clipUrls,
  pendingSectionIds,
  pendingVideoCost,
  allClipsDone,
  onClose,
  onRequestVideos,
}: {
  data: ConfiguratorData;
  fileUrls: Record<string, string>;
  clipUrls: Record<string, string>;
  pendingSectionIds: string[];
  pendingVideoCost: number;
  allClipsDone: boolean;
  onClose: () => void;
  onRequestVideos: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [progress, setProgress] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const siteUrl = data.brand.existingSite.url.trim();
  const canImport = isValidUrl(siteUrl);
  const [chrome, setChrome] = useState<{ url: string; value: SiteChrome | null } | null>(null);
  const importState = !canImport ? "none" : chrome?.url !== siteUrl ? "loading" : chrome.value ? "ok" : "failed";
  const imported = importState === "ok" ? chrome?.value ?? null : null;
  const aiCost = totalCost(data.sections);

  useEffect(() => {
    if (!canImport) return;
    let active = true;
    loadSiteChrome(siteUrl).then((value) => {
      if (active) setChrome({ url: siteUrl, value });
    });
    return () => { active = false; };
  }, [canImport, siteUrl]);

  const colors = data.style.colors.mode === "manual"
    ? deriveColors(data.style.colors.primary, data.style.colors.secondary)
    : deriveColors("#758d15", "#7ad03a");
  const pair = fontPairs.find((item) => item.id === (data.style.fonts.mode === "manual" ? data.style.fonts.pairId : "happy-tuscany")) ?? fontPairs[0];
  const urlOf = (fileRef?: FileRef | null) => (fileRef ? fileUrls[fileRef.id] : undefined);

  const measure = useCallback(() => {
    const container = scroller.current;
    if (!container) return;
    const viewport = container.clientHeight;
    container.style.setProperty("--p-vh", `${viewport}px`);
    setProgress(sectionRefs.current.map((element) => {
      if (!element) return 0;
      const top = element.offsetTop - container.scrollTop;
      const travel = element.offsetHeight - viewport;
      return travel > 0 ? clamp(-top / travel) : 0;
    }));
  }, []);

  useEffect(() => {
    const container = scroller.current;
    if (!container) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [measure]);

  useEffect(() => {
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const themeStyle = {
    "--p-primary": colors.primary,
    "--p-secondary": colors.secondary,
    "--p-background": colors.background,
    "--p-text": colors.text,
    "--p-title-font": `"${pair.title}", Georgia, serif`,
    "--p-body-font": `"${pair.body}", Arial, sans-serif`,
  } as CSSProperties;

  const { brand } = data;
  const logoUrl = urlOf(brand.logo);

  return (
    <div className="site-preview" role="dialog" aria-modal="true" aria-label="Anteprima del sito" style={themeStyle}>
      <link rel="stylesheet" href={googleFontsUrl(pair)} />
      <div className="preview-toolbar">
        <span>
          Anteprima · {aiCost > 0 ? (allClipsDone ? "video AI generati" : "i video AI non sono ancora generati") : "nessun video AI da generare"}
          {importState === "loading" && " · lettura del sito in corso…"}
          {importState === "ok" && imported && ` · header e footer da ${new URL(imported.sourceUrl).hostname}`}
          {importState === "failed" && " · sito non leggibile, header e footer dal form"}
        </span>
        <div className="preview-toolbar-actions">
          {pendingSectionIds.length > 0 && (
            <button type="button" className="preview-create" onClick={onRequestVideos}><Icon name="sparkle" /> Crea i video AI · {formatCost(pendingVideoCost)}</button>
          )}
          <button ref={closeButton} type="button" className="preview-close" onClick={onClose}><Icon name="close" /> Chiudi</button>
        </div>
      </div>
      <div className="preview-scroller" ref={scroller}>
        <header className="preview-header">
          <div className="preview-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {imported?.logoUrl ? <img src={imported.logoUrl} alt={imported.siteName ?? brand.name} /> : logoUrl ? <img src={logoUrl} alt={brand.name} /> : null}
            {!(imported?.logoUrl || logoUrl) && <strong>{imported?.siteName || brand.name || "Il tuo progetto"}</strong>}
          </div>
          <button type="button" className="preview-burger" aria-expanded={menuOpen} aria-label="Menu" onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>
          <nav className={`preview-nav${menuOpen ? " is-open" : ""}`} aria-label="Menu del sito">
            {imported && imported.nav.length > 0
              ? imported.nav.map((link) => <ExternalLink key={link.href + link.label} link={link} />)
              : data.sections.map((section, index) => (
                <a key={section.id} href={`#anteprima-sezione-${index + 1}`} onClick={(event) => {
                  event.preventDefault();
                  setMenuOpen(false);
                  sectionRefs.current[index]?.scrollIntoView({ behavior: "smooth" });
                }}>{sectionLabel(section, index)}</a>
              ))}
            {brand.languages.length > 1 && <span className="preview-langs">{brand.languages.map((language) => language.toUpperCase()).join(" · ")}</span>}
            {brand.cta.label && (brand.cta.url ? <a className="preview-cta" href={brand.cta.url} target="_blank" rel="noreferrer">{brand.cta.label}</a> : <span className="preview-cta">{brand.cta.label}</span>)}
          </nav>
        </header>

        {data.sections.map((section, index) => {
          const p = progress[index] ?? 0;
          const register = (element: HTMLElement | null) => { sectionRefs.current[index] = element; };
          const number = String(index + 1).padStart(2, "0");

          if (section.type === "A") {
            const first = 1 - ramp(p, 0.3, 0.5);
            const second = ramp(p, 0.5, 0.7);
            return (
              <section key={section.id} ref={register} id={`anteprima-sezione-${index + 1}`} className="preview-section" aria-label={`Sezione ${index + 1}`}>
                <div className="preview-sticky">
                  <PreviewImage url={urlOf(section.photo)} label="Foto da caricare" style={{ transform: `scale(${1 + p * 0.06})` }} />
                  <div className="preview-shade" />
                  <div className="preview-copy center" style={{ opacity: first, transform: `translateY(${-p * 40}px)` }}>
                    <span className="preview-number">{number}</span>
                    <PreviewText block={section.text1} fallback="Primo testo" />
                  </div>
                  <div className="preview-copy center" style={{ opacity: second, transform: `translateY(${(1 - second) * 30}px)` }}>
                    <PreviewText block={section.text2} fallback="Secondo testo" />
                  </div>
                </div>
              </section>
            );
          }

          const isB = section.type === "B";
          const mediaProgress = isB ? ramp(p, 0, 0.75) : p;
          let media;
          if (section.media.source === "video") {
            media = <PreviewVideo url={urlOf(section.media.video)} progress={mediaProgress} />;
          } else {
            const start = section.media.linkPrevious ? frameOf(data.sections[index - 1]) : section.media.startPhoto;
            media = clipUrls[section.id]
              ? <PreviewVideo url={clipUrls[section.id]} progress={mediaProgress} />
              : (
                <>
                  <PreviewImage url={urlOf(start)} label="Foto iniziale" style={{ transform: `scale(${1 + mediaProgress * 0.12})` }} />
                  <PreviewImage url={urlOf(section.media.endPhoto)} label="Foto finale" style={{ opacity: mediaProgress, transform: `scale(${1.12 - mediaProgress * 0.12})` }} />
                  <span className="preview-ai-note">Simulazione: qui andrà la clip AI</span>
                </>
              );
          }
          const textOpacity = isB ? ramp(p, 0.78, 0.92) : ramp(p, 0.08, 0.2) * (1 - ramp(p, 0.85, 0.97));
          return (
            <section key={section.id} ref={register} id={`anteprima-sezione-${index + 1}`} className="preview-section" aria-label={`Sezione ${index + 1}`}>
              <div className="preview-sticky">
                {media}
                <div className="preview-shade" style={{ opacity: isB ? textOpacity : 0.6 }} />
                {isB ? (
                  <div className="preview-copy center" style={{ opacity: textOpacity, transform: `translateY(${(1 - textOpacity) * 30}px)` }}>
                    <span className="preview-number">{number}</span>
                    <PreviewText block={section.endText} fallback="Testo finale" />
                  </div>
                ) : (
                  <div className="preview-copy side" style={{ opacity: textOpacity, transform: `translateX(${(1 - textOpacity) * -30}px)` }}>
                    <span className="preview-number">{number}</span>
                    <PreviewText block={section.sideText} fallback="Testo laterale" />
                  </div>
                )}
              </div>
            </section>
          );
        })}

        <footer className="preview-footer">
          <div className="preview-footer-main">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {imported?.logoUrl ? <img className="preview-footer-logo" src={imported.logoUrl} alt="" /> : logoUrl ? <img className="preview-footer-logo" src={logoUrl} alt="" /> : null}
              <h2>{imported?.siteName || brand.name || "Il tuo progetto"}</h2>
              {brand.mission && <p>{brand.mission}</p>}
              {brand.cta.label && (brand.cta.url ? <a className="preview-cta" href={brand.cta.url} target="_blank" rel="noreferrer">{brand.cta.label}</a> : <span className="preview-cta">{brand.cta.label}</span>)}
            </div>
            <div className="preview-footer-col">
              <h3>Contatti</h3>
              {(imported?.footer.emails.length ? imported.footer.emails : [brand.contacts.email].filter(Boolean)).map((email) => <a key={email} href={`mailto:${email}`}>{email}</a>)}
              {(imported?.footer.phones.length ? imported.footer.phones : [brand.contacts.phone].filter(Boolean)).map((phone) => <a key={phone} href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a>)}
              {brand.contacts.whatsapp && <a href={`https://wa.me/${brand.contacts.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>}
              {brand.contacts.address && <p>{brand.contacts.address}</p>}
            </div>
            {(() => {
              const socials: SiteLink[] = imported?.footer.socials.length
                ? imported.footer.socials
                : ([["Instagram", brand.contacts.socials.instagram], ["Facebook", brand.contacts.socials.facebook], ["TikTok", brand.contacts.socials.tiktok]] as const)
                  .filter(([, href]) => href)
                  .map(([label, href]) => ({ label, href }));
              const links = imported?.footer.links ?? [];
              if (!socials.length && !links.length) return null;
              return (
                <div className="preview-footer-col">
                  <h3>Seguici</h3>
                  {socials.map((link) => <ExternalLink key={link.href} link={link} />)}
                  {links.slice(0, 8).map((link) => <ExternalLink key={link.href + link.label} link={link} />)}
                </div>
              );
            })()}
          </div>
          <div className="preview-footer-legal">
            {imported?.footer.lines.length
              ? imported.footer.lines.map((line) => <small key={line}>{line}</small>)
              : <small>© {new Date().getFullYear()} {brand.legal.companyName || brand.name}{brand.legal.vat && ` · P.IVA ${brand.legal.vat}`}</small>}
            <span>
              {brand.legal.privacyUrl && <a href={brand.legal.privacyUrl} target="_blank" rel="noreferrer">Privacy</a>}
              {brand.legal.cookieUrl && <a href={brand.legal.cookieUrl} target="_blank" rel="noreferrer">Cookie</a>}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
