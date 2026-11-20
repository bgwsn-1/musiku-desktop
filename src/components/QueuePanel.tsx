"use client";

import { Fragment } from "react";
import { usePlayer } from "@/lib/player";
import { IconClose } from "@/components/Icons";
import fmtTime from "@/lib/timefmt";
import { Artwork } from "@/components/Artwork";

export function QueuePanel() {
  const p = usePlayer();
  const rest = Math.max(0, p.queue.length - p.index - 1);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-1 lg:pt-4">
        <div className="min-w-0">
          <h2 className="text-[20px] font-bold leading-tight tracking-tight text-label1">Antrian</h2>
          <p className="text-[13px] text-label2">
            {p.queue.length === 0
              ? "Kosong"
              : rest > 0
                ? `${rest} lagu berikutnya`
                : p.autoplay
                  ? "Putar otomatis siap mengisi"
                  : "Tidak ada lagu berikutnya"}
          </p>
        </div>
        <button
          onClick={p.toggleAutoplay}
          aria-pressed={p.autoplay}
          aria-label="Putar otomatis"
          title={p.autoplay ? "Putar otomatis: aktif" : "Putar otomatis: mati"}
          className={`glass-btn flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-medium ${
            p.autoplay ? "text-label1" : "text-label3"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              p.autoplay ? "bg-[var(--accent)]" : "bg-[color:var(--label-3)]"
            }`}
          />
          Auto
        </button>
        <button
          onClick={() => p.toggleUi("queue")}
          className="glass-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill1 text-label1"
          aria-label="Tutup antrian"
        >
          <IconClose className="h-[18px] w-[18px]" />
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {p.queue.length === 0 && (
          <li className="mt-14 px-6 text-center text-[15px] text-label2">
            Pilih lagu atau album, antriannya muncul di sini.
          </li>
        )}
        {p.queue.map((t, i) => {
          const current = i === p.index;
          const played = i < p.index;
          return (
            <Fragment key={t.videoId + i}>
              {i === p.autoplayFrom && (
                <li className="flex items-center gap-3 px-3 pb-1 pt-5" aria-hidden="true">
                  <span className="h-px flex-1 bg-[color:var(--fill-2)]" />
                  <span className="t-eyebrow !text-label3">Putar otomatis</span>
                  <span className="h-px flex-1 bg-[color:var(--fill-2)]" />
                </li>
              )}
              <li
                className={`group flex items-center rounded-xl pr-1 transition-colors ${
                  current ? "bg-fill2" : "hover:bg-fill1"
                } ${played ? "opacity-60" : ""}`}
              >
                <button
                  onClick={() => p.jumpTo(i)}
                aria-current={current ? "true" : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left"
              >
                <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-fill2">
                  <Artwork src={t.thumbs} />
                  {current && (
                    <span className="glass-clear absolute inset-0 flex items-center justify-center">
                      <span className={`eq ${p.playing ? "on" : ""}`} aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold leading-tight text-label1">
                    {t.title}
                  </span>
                  <span className="block truncate text-[13px] leading-tight text-label2">{t.artist}</span>
                </span>
                <span className="text-[13px] text-label3 tnum">
                  {typeof t.duration === "number" ? fmtTime(t.duration) : (t.duration ?? "")}
                </span>
              </button>
              {!current && (
                <button
                  onClick={() => p.removeFromQueue(i)}
                  className="reveal flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-label3 hover:bg-fill2 hover:text-label1"
                  aria-label={`Hapus ${t.title} dari antrian`}
                >
                  <IconClose className="h-4 w-4" />
                </button>
              )}
            </li>
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
