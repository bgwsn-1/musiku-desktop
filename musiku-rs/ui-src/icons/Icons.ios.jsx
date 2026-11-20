/* Ikon desktop (Windows/Linux): Phosphor Icons — bentuk rounded ala SF Symbols.
   Nama export sengaja identik dengan src/components/Icons.tsx supaya seluruh
   pemanggil tetap dipakai apa adanya. File ini hanya dipakai lewat alias
   `@/components/Icons` di build.mjs; web/Android tetap pakai SVG aslinya. */
import {
  ArrowsLeftRight,
  ArrowsOut,
  Books,
  CaretLeft,
  CaretRight,
  ChatCenteredText,
  CircleNotch,
  Disc,
  DotsThree,
  Export,
  FastForward,
  Heart,
  House,
  Keyboard,
  List,
  MagnifyingGlass,
  Microphone,
  MusicNote,
  Pause,
  Play,
  Plus,
  Queue,
  Quotes,
  Repeat,
  RepeatOnce,
  Rewind,
  Shuffle,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  SpeakerX,
  Trash,
  User,
  X,
} from "@phosphor-icons/react";

const icon = (Comp, weight, fallback) =>
  function IconPhosphor({ className = fallback }) {
    return <Comp weight={weight} className={className} />;
  };

export const IconPlay = icon(Play, "fill", "w-5 h-5");
export const IconPause = icon(Pause, "fill", "w-5 h-5");
export const IconNext = icon(SkipForward, "fill", "w-5 h-5");
export const IconPrev = icon(SkipBack, "fill", "w-5 h-5");
export const IconShuffle = icon(Shuffle, "fill", "w-5 h-5");
export const IconRepeat = icon(Repeat, "fill", "w-5 h-5");
export const IconRepeatOne = icon(RepeatOnce, "fill", "w-5 h-5");
export const IconSearch = icon(MagnifyingGlass, "regular", "w-5 h-5");
export const IconHome = icon(House, "fill", "w-6 h-6");
export const IconQueue = icon(Queue, "fill", "w-5 h-5");
export const IconLyrics = icon(ChatCenteredText, "fill", "w-5 h-5");
export const IconVolume = icon(SpeakerHigh, "fill", "w-5 h-5");
export const IconVolumeMute = icon(SpeakerX, "fill", "w-5 h-5");
export const IconPlus = icon(Plus, "regular", "w-4 h-4");
export const IconTrash = icon(Trash, "fill", "w-4 h-4");
export const IconMusic = icon(MusicNote, "fill", "w-6 h-6");
export const IconClose = icon(X, "regular", "w-5 h-5");
export const IconBack = icon(CaretLeft, "bold", "w-5 h-5");
export const IconMic = icon(Microphone, "fill", "w-5 h-5");
export const IconLibrary = icon(Books, "fill", "w-6 h-6");
export const IconForward = icon(CaretRight, "bold", "w-5 h-5");
export const IconChevronRight = icon(CaretRight, "bold", "w-4 h-4");
export const IconEllipsis = icon(DotsThree, "fill", "w-5 h-5");
export const IconDisc = icon(Disc, "regular", "w-5 h-5");
export const IconUser = icon(User, "regular", "w-5 h-5");
export const IconRewind = icon(Rewind, "fill", "w-5 h-5");
export const IconFastForward = icon(FastForward, "fill", "w-5 h-5");
export const IconExpand = icon(ArrowsOut, "regular", "w-5 h-5");
export const IconKeyboard = icon(Keyboard, "regular", "w-5 h-5");
export const IconCrossfade = icon(ArrowsLeftRight, "regular", "w-5 h-5");
export const IconShare = icon(Export, "regular", "w-5 h-5");
export const IconList = icon(List, "fill", "w-5 h-5");
export const IconLyricsQuote = icon(Quotes, "fill", "w-5 h-5");

export function IconHeart({ filled = false, className = "w-4 h-4" }) {
  return <Heart weight={filled ? "fill" : "regular"} className={className} />;
}

export function IconSpinner({ className = "w-5 h-5" }) {
  return <CircleNotch weight="regular" className={`animate-spin ${className}`} />;
}
