import { ArtistLogoName } from "@/components/ArtistLogoName";
import { ArtistVideo } from "@/components/ArtistVideo";

/** "20.8M" → "20,8 jt", "1.2K" → "1,2 rb" (YTM selalu memberi suffix Inggris). */
function compactCount(v: string | number | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  // "96.2M monthly audience" → ambil angka+unit di depan saja
  const m = s.match(/^([\d.,]+)\s*([KMB])/i);
  if (!m) return s;
  const unit = { K: "rb", M: "jt", B: "M" }[m[2].toUpperCase()];
  return `${m[1].replace(/,/g, "").replace(".", ",")} ${unit}`;
}

/**
 * Header artis: gambar header HD (2880×1200) sebagai pita penuh, digeser
 * perlahan supaya terasa hidup seperti header animasi YouTube Music.
 * Nama/logo, jumlah pengikut & pendengar bulanan, lalu aksi utama duduk di
 * atas scrim gelap agar tetap terbaca di atas foto apa pun.
 */
export function ArtistHeader({
  name,
  image,
  avatar,
  videoId,
  followers,
  monthly,
  actions,
}: {
  name: string;
  image?: string | null;
  avatar?: string | null;
  videoId?: string | null;
  followers?: string | number | null;
  monthly?: string | number | null;
  actions?: React.ReactNode;
}) {
  const stats = [
    compactCount(followers) && `${compactCount(followers)} pengikut`,
    compactCount(monthly) && `${compactCount(monthly)} pendengar bulanan`,
  ].filter(Boolean) as string[];

  return (
    <header className="artist-hero relative overflow-hidden">
      <div className="relative flex h-[clamp(380px,52vh,600px)] w-full items-end bg-fill1">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="artist-hero-img"
            loading="eager"
            fetchPriority="high"
          />
        )}
        <ArtistVideo videoId={videoId} />
        <div className="artist-hero-scrim" aria-hidden="true" />
        {/* tepi bawah: kaca buram yang melarutkan video ke latar halaman */}
        <div className="artist-hero-fade" aria-hidden="true" />

        <div
          className="relative flex w-full flex-col items-start gap-5 pb-[calc(var(--hero-fade)+18px)] pt-6 md:flex-row md:items-end md:gap-7 md:pt-10"
          style={{
            paddingLeft: "var(--pad-l)",
            paddingRight: "var(--pad-r)",
          }}
        >
          {avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={name}
              className="h-24 w-24 shrink-0 rounded-full object-cover shadow-[0_10px_30px_rgba(0,0,0,0.45)] ring-1 ring-white/20 md:h-[168px] md:w-[168px]"
              loading="eager"
            />
          )}

          <div className="min-w-0 pb-1">
            <p className="t-eyebrow !text-white/70">Artis</p>
            <h1 className="mt-2 break-words text-[clamp(30px,4.4vw,56px)] font-bold leading-[1.02] tracking-[-0.03em] text-white">
              <ArtistLogoName
                name={name}
                sizeClass="max-h-[clamp(40px,5vw,68px)]"
              />
            </h1>
            {stats.length > 0 && (
              <p className="mt-2.5 text-[14px] font-medium text-white/85">
                {stats.join(" · ")}
              </p>
            )}
            {actions && (
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
