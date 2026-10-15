"use client";

import { useEffect, useRef } from "react";
import { formatCost, sectionCost } from "@/lib/cost";
import type { Section } from "@/lib/schema";
import { Icon } from "./icons";

export type VideoRequest = { requestedAt: string; sectionIds: string[]; total: number };

export default function VideoRequestDialog({
  sections,
  onCancel,
  onConfirm,
}: {
  sections: Section[];
  onCancel: () => void;
  onConfirm: (request: VideoRequest) => void;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const clips = sections
    .map((section, index) => ({ section, index, cost: sectionCost(section) }))
    .filter((clip) => clip.cost > 0);
  const total = clips.reduce((sum, clip) => sum + clip.cost, 0);

  useEffect(() => {
    cancelButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="video-dialog-backdrop">
      <div className="video-dialog" role="alertdialog" aria-modal="true" aria-labelledby="video-dialog-title">
        <h2 id="video-dialog-title"><Icon name="sparkle" /> Crea i video AI</h2>
        <p>Le sezioni con due foto diventano clip generate dall’AI, dalla foto iniziale a quella finale.</p>
        <ul className="video-dialog-list">
          {clips.map(({ section, index, cost }) => (
            <li key={section.id}>
              <span>Sezione {index + 1} · {section.type !== "A" && section.media.source === "photos" ? `${section.media.durationSec} s` : ""}</span>
              <strong>{formatCost(cost)}</strong>
            </li>
          ))}
        </ul>
        <p className="video-dialog-total"><span>Totale stimato</span><strong>{formatCost(total)}</strong></p>
        <p className="field-hint">La generazione non è ancora attiva: confermando registri solo la richiesta. Nessun costo viene addebitato.</p>
        <div className="action-group">
          <button ref={cancelButton} className="button-outline" type="button" onClick={onCancel}>Annulla</button>
          <button
            className="button button-dark"
            type="button"
            onClick={() => onConfirm({ requestedAt: new Date().toISOString(), sectionIds: clips.map((clip) => clip.section.id), total })}
          >Conferma richiesta</button>
        </div>
      </div>
    </div>
  );
}
