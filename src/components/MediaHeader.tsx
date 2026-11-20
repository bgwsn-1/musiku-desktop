import type { ReactNode } from "react";
import { Artwork } from "@/components/Artwork";

/**
 * Header for album / artist / playlist pages. The artwork's colour is pulled
 * into a full-bleed backdrop that runs beneath the sidebar and toolbar, so the
 * glass has colour to reflect (liquid-glass.md › "extend content beneath").
 */
export function MediaHeader({
  art,
  kind,
  title,
  meta,
  actions,
  backdrop,
}: {
  art: ReactNode;
  kind: string;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  backdrop?: string | null;
}) {
  return (
    <header className="relative isolate">
      {backdrop && (
        <div className="media-backdrop" aria-hidden="true">
          <Artwork src={backdrop} quiet />
        </div>
      )}
      <div className="flex flex-col items-center gap-6 pt-2 text-center md:flex-row md:items-end md:gap-8 md:text-left">
        <div className="art-in shrink-0">{art}</div>
        <div className="card-anim min-w-0 md:pb-1" style={{ "--i": 3 } as React.CSSProperties}>
          <p className="t-eyebrow">{kind}</p>
          <h1 className="t-large mt-2 break-words">{title}</h1>
          {meta && <div className="mt-2 text-[15px] leading-snug text-label2">{meta}</div>}
          {actions && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 md:justify-start">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const artBase =
  "h-[208px] w-[208px] shrink-0 object-cover shadow-[var(--shadow-art)] md:h-[232px] md:w-[232px]";

export function MediaArt({
  src,
  alt = "",
  round = false,
}: {
  src?: string | null;
  alt?: string;
  round?: boolean;
}) {
  const radius = round ? "rounded-full" : "rounded-[20px]";
  return <Artwork src={src} alt={alt} className={`${artBase} ${radius}`} />;
}
