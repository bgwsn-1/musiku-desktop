import { spansOf } from "./motion";

/** Satu baris lirik. Kata dibagi memakai timing perkiraan; baris instrumental
 *  memakai titik. Gaya sapuan ditulis animator lewat CSS variable pada node. */
export function SpicyLine({ line, i, activeIdx, browsing, onSeek, registerRef }) {
  const active = i === activeIdx;
  const sung = activeIdx >= 0 && i < activeIdx;
  const dist = activeIdx < 0 ? 4 : Math.min(4, Math.abs(i - activeIdx));
  const fade = active
    ? 1
    : sung
      ? [0.5, 0.36, 0.26, 0.2][dist - 1]
      : [0.58, 0.42, 0.3, 0.22][dist - 1];
  const blur = active || browsing ? 0 : dist <= 2 ? [0, 0.45, 1.1][dist - 1] : 0;
  const spans = line.text && (active || sung) ? spansOf(line.text) : null;

  return (
    <div
      ref={(el) => registerRef(i, el)}
      className={`sl-line ${active ? "sl-active" : sung ? "sl-sung" : "sl-next"}`}
      style={{ "--sl-fade": fade, "--sl-blur": `${blur}px`, "--sl-progress": "0%" }}
    >
      <button
        onClick={() => onSeek(line.time)}
        aria-current={active ? "true" : undefined}
        aria-label={line.text ? undefined : "Jeda instrumental"}
        className="sl-lyric-btn block w-full origin-left rounded-xl px-2 py-1.5 text-left"
      >
        {line.text ? (
          spans ? (
            spans.map((s, k) => (
              <span key={k}>
                <span
                  className={`sl-word ${sung ? "lit" : ""}`}
                  style={{
                    "--sl-gradient-position": sung ? "100%" : "-20%",
                    "--sl-glow": sung ? 1 : 0,
                    "--sl-glow-alpha": sung ? "60%" : "8%",
                    "--sl-y": "0em",
                  }}
                >
                  {s.word}
                </span>
                {k < spans.length - 1 ? " " : ""}
              </span>
            ))
          ) : (
            <span className="sl-word sl-static">{line.text}</span>
          )
        ) : (
          <span className={`sl-dots ${active ? "on" : ""}`} aria-hidden="true">
            {[0, 1, 2].map((d) => (
              <i key={d} style={{ opacity: active ? 0.3 : 0.45 }} />
            ))}
          </span>
        )}
      </button>
    </div>
  );
}
