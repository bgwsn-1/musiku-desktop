// LRC level-baris -> segmen kata ber-waktu pseudo.
// Karena sumber lrclib umumnya hanya punya timestamp per baris, durasi baris
// dibagi proporsional terhadap panjang tiap kata. Format segment sengaja
// netral agar nanti bisa diisi word timings asli tanpa mengubah renderer.

export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

export interface TimedLine {
  text: string;
  time: number;
  end: number;
  instrumental: boolean;
  words: TimedWord[];
}

const MIN_WORD_MS = 90;

/** Pecah teks jadi kata + jeda spasi, lalu alokasikan waktu. */
function buildWords(text: string, start: number, duration: number): TimedWord[] {
  const raw = text.split(/\s+/).filter(Boolean);
  if (raw.length === 0) return [];
  const weights = raw.map((w) => w.length + 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const usable = Math.max(0, duration - MIN_WORD_MS * raw.length);
  const words: TimedWord[] = [];
  let cursor = start;
  for (let i = 0; i < raw.length; i++) {
    const dur = Math.max(MIN_WORD_MS, (weights[i] / total) * (usable + MIN_WORD_MS * raw.length));
    words.push({ text: raw[i], start: cursor, end: cursor + dur });
    cursor += dur;
  }
  const lastEnd = start + duration;
  if (words.length > 0 && words[words.length - 1].end > lastEnd) {
    words[words.length - 1].end = lastEnd;
  }
  return words;
}

/**
 * @param lines terurut naik, {time} detik
 */
export function buildTimedLines(lines: { time: number; text: string }[]): TimedLine[] {
  const out: TimedLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const end = next ? Math.max(line.time + 0.2, next.time) : line.time + 4;
    const instrumental = !line.text.trim();
    out.push({
      text: line.text,
      time: line.time,
      end,
      instrumental,
      words: instrumental ? [] : buildWords(line.text, line.time, Math.max(0.2, end - line.time)),
    });
  }
  return out;
}
