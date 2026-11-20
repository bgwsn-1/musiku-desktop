export type Track = {
  videoId: string;
  title: string;
  artist?: string | null;
  artists?: string[];
  artistId?: string | null;
  album?: string | null;
  albumId?: string | null;
  duration?: string | number | null;
  thumbs?: string | null;
  isExplicit?: boolean;
  resultType?: string;
  views?: string | null;
};

export type AlbumSummary = {
  browseId: string | null;
  title: string;
  artist?: string[] | string | null;
  year?: string | null;
  thumbs?: string | null;
};

export type AlbumDetail = AlbumSummary & {
  artistId?: string | null;
  total?: number | null;
  duration?: string | null;
  tracks: Track[];
};

export type ArtistDetail = {
  browseId: string;
  name: string;
  desc?: string | null;
  thumbs?: string | null;
  avatar?: string | null;
  banner?: string | null;
  /** official music video used as the animated header */
  topVideoId?: string | null;
  subscribers?: string | number | null;
  monthlyListeners?: string | number | null;
  topSongs: Track[];
  albums: AlbumSummary[];
  singles: AlbumSummary[];
};

export type HomeItem = {
  title: string;
  videoId: string | null;
  browseId: string | null;
  artist: string | null;
  artistId: string | null;
  thumbs: string | null;
  kind: "album" | "song";
};

export type HomeShelf = { title: string; items: HomeItem[] };

export type Lyrics = {
  text: string | null;
  synced: boolean;
  source: string | null;
};

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  tracks: Track[];
};

export type LocalSong = Track;
