export function IconPlay({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l11.1-6.86a1.05 1.05 0 000-1.8L9.56 4.24A1.05 1.05 0 008 5.14z" />
    </svg>
  );
}
export function IconPause({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}
export function IconNext({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M5 5.14v13.72c0 .8.87 1.3 1.56.9l9.44-5.83v5.07h3V4h-3v5.07L6.56 4.24A1.05 1.05 0 005 5.14z" />
    </svg>
  );
}
export function IconPrev({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19 5.14v13.72c0 .8-.87 1.3-1.56.9L8 13.93V19H5V4h3v5.07l9.44-5.83c.69-.4 1.56.1 1.56.9z" />
    </svg>
  );
}
export function IconShuffle({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18 4l3 3-3 3v-2h-2.6L12.9 10.7l-1.3-1.9L14.4 6H18V4zM4 6h4l7 12h3v-2l3 3-3 3v-2h-4L7 8H4V6zm0 12h3l1.3-2.2 1.3 1.9L8 18H4v-2z" />
    </svg>
  );
}
export function IconRepeat({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
    </svg>
  );
}
export function IconRepeatOne({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2v-5h-1l-2 .5v1l1-.3V15h1z" />
    </svg>
  );
}
export function IconHeart({
  filled = false,
  className = "w-4 h-4",
}: {
  filled?: boolean;
  className?: string;
}) {
  return filled ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 21s-7.5-4.9-10-9.2C.3 8.9 2 5.5 5.4 5.1c1.9-.2 3.8.8 4.9 2.4h1.4c1.1-1.6 3-2.6 4.9-2.4C19.9 5.5 21.7 8.9 20 11.8c-2.5 4.3-8 9.2-8 9.2z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 21s-7.5-4.9-10-9.2C.3 8.9 2 5.5 5.4 5.1c1.9-.2 3.8.8 4.9 2.4h1.4c1.1-1.6 3-2.6 4.9-2.4C19.9 5.5 21.7 8.9 20 11.8c-2.5 4.3-8 9.2-8 9.2z" />
    </svg>
  );
}
export function IconSearch({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
export function IconHome({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l9 8h-2v12h-5v-7h-4v7H5V10H3l9-8z" />
    </svg>
  );
}
export function IconQueue({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3 6h14v2H3zM3 11h14v2H3zM3 16h10v2H3zM19 8v7a3 3 0 11-2-2.8V8h2z" />
    </svg>
  );
}
export function IconLyrics({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4 3h16a1 1 0 011 1v13a1 1 0 01-1 1h-5l-3 4-3-4H4a1 1 0 01-1-1V4a1 1 0 011-1zm3 4v2h10V7H7zm0 4v2h7v-2H7z" />
    </svg>
  );
}
export function IconVolume({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4 9v6h3l5 4V5L7 9H4zm12.5 3a3.5 3.5 0 00-2-3.2v6.4a3.5 3.5 0 002-3.2zm2.5 0a6 6 0 00-3.5-5.4v1.9A4.09 4.09 0 0117 12a4.09 4.09 0 01-1.5 3.5v1.9A6 6 0 0019 12z" />
    </svg>
  );
}
export function IconVolumeMute({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4 9v6h3l5 4V5L7 9H4zm11 .9L16.4 11 18 9.4 19.4 11 21 9.4 19.6 12l1.4 1.6-1.4 1.4-1.6-1.6-1.6 1.6-1.4-1.4 1.6-1.6-1.6-1.4L15 9.9z" />
    </svg>
  );
}
export function IconPlus({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
export function IconTrash({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M9 3h6v2h4v2H5V5h4V3zm1 5h2v9h-2V8zm4 0h2v9h-2V8zM7 9h1L7.5 19a1 1 0 001 1h7a1 1 0 001-1L16 9h1L16.5 19.5A2 2 0 0114.5 21h-5a2 2 0 01-2-1.5L7 9z" />
    </svg>
  );
}
export function IconMusic({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20 3v10.5a3.5 3.5 0 11-2-3.2V6.2L11 7.8v8.7a3.5 3.5 0 11-2-3.2V6l13-3z" />
    </svg>
  );
}
export function IconClose({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
export function IconBack({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className}>
      <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconMic({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3zm7 8v1a7 7 0 01-6 6.94V20h3v2H8v-2h3v-2.06A7 7 0 015 11v-1h2v1a5 5 0 0010 0v-1h2z" />
    </svg>
  );
}
export function IconLibrary({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M5 3h2v18H5zM9 3h2v18H9zM13.5 3.6l6.86 17.3-1.86.74L11.6 4.34 13.5 3.6z" />
    </svg>
  );
}
export function IconSpinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} fill="currentColor">
      <path d="M12 2a10 10 0 0110 10h-2a8 8 0 00-8-8V2z" />
    </svg>
  );
}
export function IconForward({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className}>
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconChevronRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className={className}>
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconEllipsis({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
export function IconDisc({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
export function IconUser({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" strokeLinecap="round" />
    </svg>
  );
}
export function IconRewind({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 24" fill="currentColor" className={className}>
      <path d="M14 5.14v13.72c0 .8-.87 1.3-1.56.9L2.3 13.9a1.05 1.05 0 010-1.8l10.14-5.86c.69-.4 1.56.1 1.56.9zM26 5.14v13.72c0 .8-.87 1.3-1.56.9L14.3 13.9a1.05 1.05 0 010-1.8l10.14-5.86c.69-.4 1.56.1 1.56.9z" />
    </svg>
  );
}
export function IconFastForward({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 24" fill="currentColor" className={className}>
      <path d="M2 5.14v13.72c0 .8.87 1.3 1.56.9L13.7 13.9a1.05 1.05 0 000-1.8L3.56 4.24C2.87 3.84 2 4.34 2 5.14zM14 5.14v13.72c0 .8.87 1.3 1.56.9L25.7 13.9a1.05 1.05 0 000-1.8L15.56 4.24c-.69-.4-1.56.1-1.56.9z" />
    </svg>
  );
}
export function IconExpand({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconKeyboard({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path
        d="M6 9.8h.01M9.5 9.8h.01M13 9.8h.01M16.5 9.8h.01M6 12.9h.01M9.5 12.9h.01M13 12.9h.01M16.5 12.9h.01M8 16h8"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function IconCrossfade({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 7.5h13.2M14.2 4l3.6 3.5-3.6 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M20 16.5H6.8M9.8 13l-3.6 3.5 3.6 3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function IconShare({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 14V3.5" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <path d="M5.5 11.5v7a2 2 0 002 2h9a2 2 0 002-2v-7" />
    </svg>
  );
}

export function IconList({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="3" y="5" width="2.4" height="2.4" rx="1.2" />
      <rect x="8" y="5.4" width="13" height="1.7" rx=".85" />
      <rect x="3" y="10.8" width="2.4" height="2.4" rx="1.2" />
      <rect x="8" y="11.15" width="13" height="1.7" rx=".85" />
      <rect x="3" y="16.6" width="2.4" height="2.4" rx="1.2" />
      <rect x="8" y="16.95" width="13" height="1.7" rx=".85" />
    </svg>
  );
}
export function IconLyricsQuote({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M5 3h14a2.5 2.5 0 012.5 2.5v9A2.5 2.5 0 0119 17h-5.2l-3.6 4v-4H5a2.5 2.5 0 01-2.5-2.5v-9A2.5 2.5 0 015 3zM6.8 6.6h3.6v3.5l-1.4 3H7.4l1-3H6.8zm6.3 0h3.6v3.5l-1.4 3h-1.6l1-3h-1.6z" />
    </svg>
  );
}
