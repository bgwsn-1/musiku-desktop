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
/* SF Symbol chevron.left dari Apple Music 7.0.0; diputar saat sidebar ciut. */
export function IconSidebar({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28.0 28.0" fill="currentColor" className={className}>
      <path d="M18.366,5.158C18.148,4.947 17.793,4.947 17.575,5.158L9.634,13.604C9.416,13.816 9.416,14.184 9.634,14.396L17.575,22.842C17.793,23.053 18.148,23.053 18.366,22.842C18.584,22.631 18.584,22.292 18.366,22.081L10.822,14L18.366,5.919C18.584,5.708 18.584,5.369 18.366,5.158Z" />
    </svg>
  );
}
export function IconExplore({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="currentColor" className={className}>
      <path d="M43.6693,26.2536C46.5564,26.2536 48,24.843 48,21.8539L48,12.3829C48,9.3938 46.5564,8 43.6693,8L34.068,8C31.1809,8 29.7373,9.3938 29.7373,12.3829L29.7373,21.8539C29.7373,24.843 31.1809,26.2536 34.068,26.2536L43.6693,26.2536ZM21.9152,26.2536C24.8191,26.2536 26.2459,24.843 26.2459,21.8539L26.2459,12.3829C26.2459,9.3938 24.8191,8 21.9152,8L12.3307,8C9.4436,8 8,9.3938 8,12.3829L8,21.8539C8,24.843 9.4436,26.2536 12.3307,26.2536L21.9152,26.2536ZM21.9152,48C24.8191,48 26.2459,46.6062 26.2459,43.6003L26.2459,34.1461C26.2459,31.1402 24.8191,29.7464 21.9152,29.7464L12.3307,29.7464C9.4436,29.7464 8,31.1402 8,34.1461L8,43.6003C8,46.6062 9.4436,48 12.3307,48L21.9152,48ZM43.6693,48C46.5564,48 48,46.6062 48,43.6003L48,34.1461C48,31.1402 46.5564,29.7464 43.6693,29.7464L34.068,29.7464C31.1809,29.7464 29.7373,31.1402 29.7373,34.1461L29.7373,43.6003C29.7373,46.6062 31.1809,48 34.068,48L43.6693,48Z" />
    </svg>
  );
}
export function IconRadio({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 58 56" fill="currentColor" className={className}>
      <path d="M46.6772,45.3217C56.4988,35.4566 56.2474,19.1738 46.7062,9.6496C45.7524,8.7179 45.6396,7.4714 46.5386,6.5949C47.4086,5.7185 48.6138,5.8321 49.5418,6.793C60.5943,17.9306 61.0422,36.5895 49.5418,48.2076C48.6138,49.1392 47.4086,49.2528 46.5386,48.3731C45.6396,47.4707 45.7524,46.2534 46.6772,45.3217M40.8706,39.4689C47.4634,32.8564 47.2669,21.9753 40.8706,15.5284C39.9716,14.5675 39.8298,13.3502 40.703,12.4478C41.5988,11.5421 42.833,11.6849 43.79,12.6166C51.7008,20.5307 52.0649,34.0153 43.79,42.3839C42.862,43.2864 41.6278,43.4292 40.7288,42.5495C39.8588,41.6471 39.9426,40.4038 40.8706,39.4689M35.1188,33.6453C38.4861,30.253 38.4281,24.6891 35.1188,21.3228C34.1617,20.3879 34.0522,19.1738 34.948,18.2422C35.818,17.3657 37.0521,17.4793 37.9802,18.4402C42.862,23.3581 43.0005,31.5288 37.9802,36.5603C37.0521,37.492 35.847,37.6056 34.977,36.7031C34.0522,35.8234 34.1907,34.5802 35.1188,33.6453M24.9298,27.5132C24.9298,25.2799 26.7536,23.3874 28.9996,23.3874C31.2455,23.3874 33.0984,25.2799 33.0984,27.5132C33.0984,29.7466 31.2455,31.6099 28.9996,31.6099C26.7536,31.6099 24.9298,29.7466 24.9298,27.5132M20.0222,36.5603C15.1372,31.6683 15.0277,23.4718 20.0222,18.4694C20.947,17.5345 22.1522,17.3917 23.0512,18.3006C23.9502,19.1738 23.8085,20.4171 22.8837,21.352C19.5163,24.7443 19.5711,30.3407 22.8837,33.6745C23.8375,34.6386 23.9502,35.8234 23.0802,36.7551C22.1812,37.6348 20.947,37.5212 20.0222,36.5603M14.2414,42.4132C6.2984,34.4665 5.9343,20.9852 14.2414,12.6166C15.1372,11.7109 16.4004,11.5713 17.2704,12.477C18.1694,13.3794 18.0566,14.6227 17.1318,15.5284C10.5358,22.17 10.7613,33.0252 17.1318,39.4689C18.0566,40.433 18.1984,41.6471 17.2994,42.5787C16.4004,43.4584 15.1952,43.3156 14.2414,42.4132M8.4606,48.2076C-2.5951,37.0959 -3.043,18.411 8.4606,6.8222C9.3854,5.8905 10.6228,5.7477 11.4928,6.6242C12.3596,7.5266 12.2468,8.7731 11.322,9.7048C1.5294,19.5439 1.755,35.8234 11.2962,45.3509C12.2468,46.2826 12.3596,47.5291 11.4638,48.4023C10.6228,49.282 9.3854,49.1684 8.4606,48.2076" fillRule="evenodd" />
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

/* Shortcut Pustaka — pathData persis dari Apple Music 7.0.0:
   res/drawable/ic_library_link_icon_{playlists,artists,album,recentlyadded}.xml */
export function IconLibPlaylists({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="currentColor" className={className}>
      <path d="M20.9753,30.8809C22.5276,30.8809 24.8269,29.752 24.8269,26.689L24.8269,16.9937C24.8269,16.396 24.9514,16.2549 25.491,16.1304L30.239,15.0928C30.571,15.0181 30.7786,14.769 30.7786,14.4287L30.7786,10.4692C30.7786,9.938 30.3469,9.5894 29.8323,9.6973L24.47,10.8677C23.8391,11.0005 23.4988,11.3491 23.4988,11.9053L23.5237,23.709C23.5652,24.2651 23.2996,24.6387 22.8015,24.7383L21.1082,25.0952C19.0081,25.5269 18.0203,26.5811 18.0203,28.1748C18.0203,29.7686 19.2405,30.8809 20.9753,30.8809ZM19.5642,14.8604C19.9128,14.8604 20.1951,14.5781 20.1951,14.2295C20.1951,13.8892 19.9128,13.6069 19.5642,13.6069L9.8523,13.6069C9.5037,13.6069 9.2214,13.8892 9.2214,14.2295C9.2214,14.5781 9.5037,14.8604 9.8523,14.8604L19.5642,14.8604ZM19.5642,18.6123C19.9211,18.6123 20.1951,18.3301 20.1951,17.9814C20.1951,17.6411 19.9128,17.3672 19.5642,17.3672L9.8523,17.3672C9.5037,17.3672 9.2214,17.6411 9.2214,17.9814C9.2214,18.3301 9.4954,18.6123 9.8523,18.6123L19.5642,18.6123ZM19.5642,22.3726C19.9211,22.3726 20.1951,22.0986 20.1951,21.7417C20.1951,21.4014 19.9128,21.1191 19.5642,21.1191L9.8523,21.1191C9.5037,21.1191 9.2214,21.4014 9.2214,21.7417C9.2214,22.0986 9.4954,22.3726 9.8523,22.3726L19.5642,22.3726Z" />
    </svg>
  );
}
export function IconLibArtists({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="currentColor" className={className}>
      <path d="M29.0811,16.5703C30.9985,14.6694 31.0732,12.3286 29.2637,10.5439C27.479,8.7676 25.1548,8.8174 23.2456,10.7349L29.0811,16.5703ZM20.2407,30.9224C20.7471,30.9224 21.1372,30.5322 21.1372,30.0342L21.1372,23.5762L21.0625,22.1235L24.3579,19.0688C25.603,19.2432 26.9312,18.7285 28.1099,17.5498L22.2744,11.7061C21.0874,12.8848 20.6143,14.1714 20.7969,15.4165L10.8359,26.1411C10.4375,26.5811 10.4126,27.1455 10.9272,27.6602L9.5078,29.4531C9.3916,29.5942 9.3916,29.8018 9.5493,29.9595L9.8647,30.2749C10.0225,30.4326 10.2134,30.4409 10.3794,30.3164L12.1724,28.8721C12.6538,29.4033 13.2432,29.3701 13.6665,28.9717L19.3359,23.7256L19.3359,30.0342C19.3359,30.5322 19.7344,30.9224 20.2407,30.9224ZM12.8779,28.0835L11.7407,26.9463L21.2866,16.8027C21.4858,17.1348 21.7266,17.4668 22.0254,17.7905C22.3242,18.106 22.6396,18.3633 22.9634,18.5625L12.8779,28.0835Z" />
    </svg>
  );
}
export function IconLibAlbum({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="currentColor" className={className}>
      <path d="M25.1299,8.9004C25.0801,8.1201 24.6318,7.6968 23.7935,7.6968L16.0239,7.6968C15.1855,7.6968 14.7373,8.1201 14.6875,8.9004L25.1299,8.9004ZM26.8979,11.7227C26.7651,10.9009 26.3584,10.4194 25.4536,10.4194L14.2891,10.4194C13.3843,10.4194 12.9775,10.9009 12.853,11.7227L26.8979,11.7227ZM26.3833,32.2505C28.2759,32.2505 29.3633,31.1631 29.3633,29.0464L29.3633,16.7197C29.3633,14.6113 28.2676,13.5239 26.126,13.5239L13.8657,13.5239C11.7241,13.5239 10.6367,14.5947 10.6367,16.7197L10.6367,29.0464C10.6367,31.1714 11.7241,32.2505 13.8657,32.2505L26.3833,32.2505ZM26.3501,30.7813L13.8989,30.7813C12.7368,30.7813 12.106,30.1587 12.106,28.9717L12.106,16.8027C12.106,15.6074 12.7368,14.9932 13.8989,14.9932L26.1011,14.9932C27.2383,14.9932 27.894,15.6074 27.894,16.8027L27.894,28.9717C27.894,30.1587 27.2383,30.7813 26.3501,30.7813Z" />
    </svg>
  );
}
export function IconLibRecent({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="currentColor" className={className}>
      <path d="M20.008,30.824C25.926,30.824 30.824,25.926 30.824,20.016C30.824,14.097 25.918,9.2 19.999,9.2C14.089,9.2 9.2,14.097 9.2,20.016C9.2,25.926 14.097,30.824 20.008,30.824ZM20.008,29.28C14.878,29.28 10.752,25.146 10.752,20.016C10.752,14.878 14.869,10.752 19.999,10.752C25.138,10.752 29.271,14.878 29.271,20.016C29.271,25.146 25.146,29.28 20.008,29.28ZM14.263,21.103L19.999,21.103C20.365,21.103 20.647,20.821 20.647,20.456L20.647,13.052C20.647,12.695 20.365,12.412 19.999,12.412C19.651,12.412 19.36,12.695 19.36,13.052L19.36,19.817L14.263,19.817C13.898,19.817 13.624,20.099 13.624,20.456C13.624,20.821 13.898,21.103 14.263,21.103Z" />
    </svg>
  );
}
