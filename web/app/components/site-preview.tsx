"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { deriveColors } from "@/lib/color";
import { fontPairs, googleFontsUrl } from "@/lib/fonts";
import type { ConfiguratorData, FileRef, Section, TextBlock } from "@/lib/schema";
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

export default function SitePreview({
  data,
  fileUrls,
  onClose,
}: {
  data: ConfiguratorData;
  fileUrls: Record<string, string>;
  onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [progress, setProgress] = useState<number[]>([]);

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
        <span>Anteprima · i video AI non sono ancora generati</span>
        <button ref={closeButton} type="button" className="preview-close" onClick={onClose}><Icon name="close" /> Chiudi anteprima</button>
      </div>
      <div className="preview-scroller" ref={scroller}>
        <header className="preview-header">
          <div className="preview-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoUrl && <img src={logoUrl} alt="" />}
            <strong>{brand.name || "Il tuo progetto"}</strong>
          </div>
          {brand.cta.label && <span className="preview-cta">{brand.cta.label}</span>}
        </header>

        {data.sections.map((section, index) => {
          const p = progress[index] ?? 0;
          const register = (element: HTMLElement | null) => { sectionRefs.current[index] = element; };
          const number = String(index + 1).padStart(2, "0");

          if (section.type === "A") {
            const first = 1 - ramp(p, 0.3, 0.5);
            const second = ramp(p, 0.5, 0.7);
            return (
              <section key={section.id} ref={register} className="preview-section" aria-label={`Sezione ${index + 1}`}>
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
            media = (
              <>
                <PreviewImage url={urlOf(start)} label="Foto iniziale" style={{ transform: `scale(${1 + mediaProgress * 0.12})` }} />
                <PreviewImage url={urlOf(section.media.endPhoto)} label="Foto finale" style={{ opacity: mediaProgress, transform: `scale(${1.12 - mediaProgress * 0.12})` }} />
                <span className="preview-ai-note">Simulazione: qui andrà la clip AI</span>
              </>
            );
          }
          const textOpacity = isB ? ramp(p, 0.78, 0.92) : ramp(p, 0.08, 0.2) * (1 - ramp(p, 0.85, 0.97));
          return (
            <section key={section.id} ref={register} className="preview-section" aria-label={`Sezione ${index + 1}`}>
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
          <div>
            <h2>{brand.name || "Il tuo progetto"}</h2>
            {brand.mission && <p>{brand.mission}</p>}
            {brand.cta.label && <span className="preview-cta">{brand.cta.label}</span>}
          </div>
          <div className="preview-contacts">
            {brand.contacts.email && <p>{brand.contacts.email}</p>}
            {brand.contacts.phone && <p>{brand.contacts.phone}</p>}
            {brand.contacts.address && <p>{brand.contacts.address}</p>}
            {(brand.legal.companyName || brand.legal.vat) && <small>{[brand.legal.companyName, brand.legal.vat && `P.IVA ${brand.legal.vat}`].filter(Boolean).join(" · ")}</small>}
          </div>
        </footer>
      </div>
    </div>
  );
}
