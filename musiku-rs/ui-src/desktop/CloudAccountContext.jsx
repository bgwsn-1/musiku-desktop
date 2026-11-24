// Manajemen sesi akun Supabase + sinkronisasi otomatis pustaka (suka, playlist, riwayat, preferensi).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePlayer } from "@/lib/player";
import { isSupabaseConfigured, supabase } from "./supabase.js";

const LS = {
  liked: "musiku.liked",
  playlists: "musiku.playlists",
  recent: "musiku.recent",
  volume: "musiku.volume",
  repeat: "musiku.repeat",
  shuffle: "musiku.shuffle",
  crossfade: "musiku.crossfade",
  crossfadeSec: "musiku.crossfade-sec",
  autoplay: "musiku.autoplay",
};

const AccountCtx = createContext(null);

export function useAccount() {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error("useAccount must be used inside CloudAccountProvider");
  return ctx;
}

function readLs(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function hasLs(key) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeLs(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function mapAuthError(err) {
  const msg = String(err?.message || "");
  const low = msg.toLowerCase();
  if (low.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (low.includes("email not confirmed")) {
    return "Email belum dikonfirmasi. Buka tautan konfirmasi di kotak masuk email kamu.";
  }
  if (low.includes("user already registered")) return "Email ini sudah terdaftar. Silakan masuk.";
  if (low.includes("password should be at least")) return "Kata sandi minimal 6 karakter.";
  if (low.includes("unable to validate email") || low.includes("invalid format")) {
    return "Format alamat email tidak valid.";
  }
  if (low.includes("rate limit") || low.includes("too many requests")) {
    return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  }
  return msg || "Autentikasi gagal. Periksa koneksi lalu coba lagi.";
}

function readLocalSnapshot() {
  return {
    liked: Array.isArray(readLs(LS.liked, [])) ? readLs(LS.liked, []) : [],
    playlists: Array.isArray(readLs(LS.playlists, [])) ? readLs(LS.playlists, []) : [],
    recent: Array.isArray(readLs(LS.recent, [])) ? readLs(LS.recent, []) : [],
    settings: {
      volume: readLs(LS.volume, 0.8),
      repeat: readLs(LS.repeat, "off"),
      shuffle: Boolean(readLs(LS.shuffle, false)),
      crossfade: Boolean(readLs(LS.crossfade, false)),
      cfSec: readLs(LS.crossfadeSec, 4),
      autoplay: readLs(LS.autoplay, true),
    },
  };
}

function writeSnapshotToLs(snap) {
  writeLs(LS.liked, snap.liked);
  writeLs(LS.playlists, snap.playlists);
  writeLs(LS.recent, snap.recent.slice(0, 40));
  if (snap.settings) {
    if (typeof snap.settings.volume === "number") writeLs(LS.volume, snap.settings.volume);
    if (snap.settings.repeat) writeLs(LS.repeat, snap.settings.repeat);
    if (typeof snap.settings.shuffle === "boolean") writeLs(LS.shuffle, snap.settings.shuffle);
    if (typeof snap.settings.crossfade === "boolean") writeLs(LS.crossfade, snap.settings.crossfade);
    if (typeof snap.settings.cfSec === "number") writeLs(LS.crossfadeSec, snap.settings.cfSec);
    if (typeof snap.settings.autoplay === "boolean") writeLs(LS.autoplay, snap.settings.autoplay);
  }
}

function mergeTracks(primary, secondary) {
  const seen = new Set();
  const out = [];
  for (const list of [primary, secondary]) {
    if (!Array.isArray(list)) continue;
    for (const t of list) {
      if (!t || !t.videoId || seen.has(t.videoId)) continue;
      seen.add(t.videoId);
      out.push(t);
    }
  }
  return out;
}

function mergeLibraries(localSnap, cloudSnap) {
  const liked = mergeTracks(localSnap.liked, cloudSnap.liked);
  const recent = mergeTracks(localSnap.recent, cloudSnap.recent).slice(0, 40);

  const byId = new Map();
  for (const pl of localSnap.playlists || []) {
    if (!pl || !pl.id) continue;
    byId.set(pl.id, {
      id: pl.id,
      name: pl.name || "Playlist",
      createdAt: Number(pl.createdAt) || Date.now(),
      tracks: Array.isArray(pl.tracks) ? [...pl.tracks] : [],
    });
  }
  for (const cpl of cloudSnap.playlists || []) {
    if (!cpl || !cpl.id) continue;
    const prev = byId.get(cpl.id);
    if (!prev) {
      byId.set(cpl.id, {
        id: cpl.id,
        name: cpl.name || "Playlist",
        createdAt: Number(cpl.createdAt) || Date.now(),
        tracks: Array.isArray(cpl.tracks) ? [...cpl.tracks] : [],
      });
    } else {
      byId.set(cpl.id, {
        id: prev.id,
        name: prev.name || cpl.name || "Playlist",
        createdAt: Math.min(prev.createdAt, Number(cpl.createdAt) || prev.createdAt),
        tracks: mergeTracks(prev.tracks, cpl.tracks),
      });
    }
  }

  const cs = cloudSnap.settings || {};
  const ls = localSnap.settings || {};
  const settings = {
    volume: hasLs(LS.volume) ? ls.volume : (cs.volume ?? 0.8),
    repeat: hasLs(LS.repeat) ? ls.repeat : (cs.repeat ?? "off"),
    shuffle: hasLs(LS.shuffle) ? ls.shuffle : Boolean(cs.shuffle),
    crossfade: hasLs(LS.crossfade) ? ls.crossfade : Boolean(cs.crossfade),
    cfSec: hasLs(LS.crossfadeSec) ? ls.cfSec : (cs.cfSec ?? 4),
    autoplay: hasLs(LS.autoplay) ? ls.autoplay : (cs.autoplay ?? true),
  };

  return {
    liked,
    playlists: [...byId.values()],
    recent,
    settings,
  };
}

function snapshotSignature(snap) {
  return JSON.stringify({
    liked: (snap.liked || []).map((t) => t?.videoId).filter(Boolean),
    playlists: (snap.playlists || []).map((p) => ({
      id: p?.id,
      name: p?.name,
      tracks: (p?.tracks || []).map((t) => t?.videoId).filter(Boolean),
    })),
    recent: (snap.recent || []).slice(0, 40).map((t) => t?.videoId).filter(Boolean),
    settings: snap.settings || {},
  });
}

async function fetchCloudSnapshot(userId) {
  const [profRes, likedRes, plRes, ptRes, prefRes] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).maybeSingle(),
    supabase
      .from("liked_tracks")
      .select("video_id, position, track")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    supabase
      .from("playlists")
      .select("id, name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("playlist_tracks")
      .select("playlist_id, video_id, position, track")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    supabase.from("user_preferences").select("recent, settings").eq("user_id", userId).maybeSingle(),
  ]);

  if (likedRes.error) throw likedRes.error;
  if (plRes.error) throw plRes.error;
  if (ptRes.error) throw ptRes.error;
  if (prefRes.error) throw prefRes.error;

  const tracksByPlaylist = new Map();
  for (const row of ptRes.data || []) {
    if (!row?.playlist_id || !row?.track) continue;
    const list = tracksByPlaylist.get(row.playlist_id) || [];
    list.push(row.track);
    tracksByPlaylist.set(row.playlist_id, list);
  }

  const playlists = (plRes.data || []).map((pl) => ({
    id: pl.id,
    name: pl.name,
    createdAt: Number(pl.created_at) || Date.now(),
    tracks: tracksByPlaylist.get(pl.id) || [],
  }));

  return {
    profile: profRes.data
      ? {
          displayName: profRes.data.display_name || "",
          avatarUrl: profRes.data.avatar_url || null,
        }
      : null,
    liked: (likedRes.data || []).map((r) => r.track).filter(Boolean),
    playlists,
    recent: Array.isArray(prefRes.data?.recent) ? prefRes.data.recent : [],
    settings:
      prefRes.data?.settings && typeof prefRes.data.settings === "object"
        ? prefRes.data.settings
        : {},
  };
}

async function pushCloudSnapshot(userId, snap) {
  const likedTracks = (snap.liked || []).filter((t) => t && t.videoId);
  const likedRows = likedTracks.map((t, idx) => ({
    user_id: userId,
    video_id: t.videoId,
    position: idx,
    track: t,
  }));

  if (likedRows.length > 0) {
    const { error } = await supabase
      .from("liked_tracks")
      .upsert(likedRows, { onConflict: "user_id,video_id" });
    if (error) throw error;
  }

  const { data: existingLiked, error: existingLikedErr } = await supabase
    .from("liked_tracks")
    .select("video_id")
    .eq("user_id", userId);
  if (existingLikedErr) throw existingLikedErr;
  const keepLikedIds = new Set(likedTracks.map((t) => t.videoId));
  const staleLikedIds = (existingLiked || [])
    .map((r) => r.video_id)
    .filter((vid) => !keepLikedIds.has(vid));
  if (staleLikedIds.length > 0) {
    const { error } = await supabase
      .from("liked_tracks")
      .delete()
      .eq("user_id", userId)
      .in("video_id", staleLikedIds);
    if (error) throw error;
  }

  const validPlaylists = (snap.playlists || []).filter((p) => p && p.id);
  const plRows = validPlaylists.map((p) => ({
    user_id: userId,
    id: p.id,
    name: String(p.name || "Playlist").slice(0, 120),
    created_at: Math.round(Number(p.createdAt) || Date.now()),
  }));

  if (plRows.length > 0) {
    const { error } = await supabase
      .from("playlists")
      .upsert(plRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  const { data: existingPl, error: existingPlErr } = await supabase
    .from("playlists")
    .select("id")
    .eq("user_id", userId);
  if (existingPlErr) throw existingPlErr;
  const keepPlIds = new Set(validPlaylists.map((p) => p.id));
  const stalePlIds = (existingPl || []).map((r) => r.id).filter((id) => !keepPlIds.has(id));
  if (stalePlIds.length > 0) {
    const { error } = await supabase
      .from("playlists")
      .delete()
      .eq("user_id", userId)
      .in("id", stalePlIds);
    if (error) throw error;
  }

  const ptRows = [];
  const keepPairsByPl = new Map();
  for (const pl of validPlaylists) {
    const seen = new Set();
    const keepSet = new Set();
    let pos = 0;
    for (const t of pl.tracks || []) {
      if (!t || !t.videoId || seen.has(t.videoId)) continue;
      seen.add(t.videoId);
      keepSet.add(t.videoId);
      ptRows.push({
        user_id: userId,
        playlist_id: pl.id,
        video_id: t.videoId,
        position: pos++,
        track: t,
      });
    }
    keepPairsByPl.set(pl.id, keepSet);
  }

  if (ptRows.length > 0) {
    const { error } = await supabase
      .from("playlist_tracks")
      .upsert(ptRows, { onConflict: "user_id,playlist_id,video_id" });
    if (error) throw error;
  }

  const { data: existingPt, error: existingPtErr } = await supabase
    .from("playlist_tracks")
    .select("playlist_id, video_id")
    .eq("user_id", userId);
  if (existingPtErr) throw existingPtErr;
  const staleByPl = new Map();
  for (const row of existingPt || []) {
    const keepSet = keepPairsByPl.get(row.playlist_id);
    if (!keepSet || !keepSet.has(row.video_id)) {
      const arr = staleByPl.get(row.playlist_id) || [];
      arr.push(row.video_id);
      staleByPl.set(row.playlist_id, arr);
    }
  }
  for (const [plId, videoIds] of staleByPl.entries()) {
    const { error } = await supabase
      .from("playlist_tracks")
      .delete()
      .eq("user_id", userId)
      .eq("playlist_id", plId)
      .in("video_id", videoIds);
    if (error) throw error;
  }

  const { error: prefErr } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      recent: (snap.recent || []).slice(0, 40),
      settings: snap.settings || {},
    },
    { onConflict: "user_id" },
  );
  if (prefErr) throw prefErr;
}

export function CloudAccountProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [syncError, setSyncError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [playerEpoch, setPlayerEpoch] = useState(0);
  const syncHandlerRef = useRef(null);
  const mergedForUserRef = useRef(null);
  const lastPushedSigRef = useRef("");
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      const u = data?.session?.user ?? null;
      setUser(u);
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        mergedForUserRef.current = null;
        lastPushedSigRef.current = "";
        syncingRef.current = false;
        setProfile(null);
        setSyncStatus("idle");
        setSyncError(null);
        setLastSyncedAt(null);
      }
    });
    return () => {
      live = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) throw new Error("Layanan akun cloud belum dikonfigurasi.");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(mapAuthError(error));
    return data;
  }, []);

  const signUp = useCallback(async ({ email, password, displayName }) => {
    if (!supabase) throw new Error("Layanan akun cloud belum dikonfigurasi.");
    const cleanName = (displayName || "").trim();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: cleanName ? { display_name: cleanName } : undefined,
      },
    });
    if (error) throw new Error(mapAuthError(error));
    return { user: data.user, needsEmailConfirm: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(
    async ({ displayName }) => {
      if (!supabase || !user) throw new Error("Belum masuk ke akun.");
      const cleanName = String(displayName || "").trim();
      const { error: profErr } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: cleanName }, { onConflict: "id" });
      if (profErr) throw new Error(profErr.message || "Gagal memperbarui profil.");
      const { error: metaErr } = await supabase.auth.updateUser({
        data: { display_name: cleanName },
      });
      if (metaErr) throw new Error(metaErr.message || "Gagal memperbarui metadata akun.");
      setProfile((prev) => ({ ...(prev || {}), displayName: cleanName }));
    },
    [user],
  );

  const registerSyncHandler = useCallback((fn) => {
    syncHandlerRef.current = fn;
    return () => {
      if (syncHandlerRef.current === fn) syncHandlerRef.current = null;
    };
  }, []);

  const requestSync = useCallback(async () => {
    if (syncHandlerRef.current) {
      await syncHandlerRef.current();
    }
  }, []);

  const bumpPlayerEpoch = useCallback(() => {
    setPlayerEpoch((n) => n + 1);
  }, []);

  const displayName =
    profile?.displayName ||
    user?.user_metadata?.display_name ||
    (user?.email ? user.email.split("@")[0] : "");

  const value = useMemo(
    () => ({
      configured: isSupabaseConfigured,
      authReady,
      user,
      profile,
      displayName,
      syncStatus,
      syncError,
      lastSyncedAt,
      playerEpoch,
      mergedForUserRef,
      lastPushedSigRef,
      syncingRef,
      setProfile,
      setSyncStatus,
      setSyncError,
      setLastSyncedAt,
      bumpPlayerEpoch,
      registerSyncHandler,
      requestSync,
      signIn,
      signUp,
      signOut,
      updateProfile,
    }),
    [
      authReady,
      user,
      profile,
      displayName,
      syncStatus,
      syncError,
      lastSyncedAt,
      playerEpoch,
      bumpPlayerEpoch,
      registerSyncHandler,
      requestSync,
      signIn,
      signUp,
      signOut,
      updateProfile,
    ],
  );

  return <AccountCtx.Provider value={value}>{children}</AccountCtx.Provider>;
}

export function CloudSyncBridge() {
  const {
    user,
    setProfile,
    setSyncStatus,
    setSyncError,
    setLastSyncedAt,
    bumpPlayerEpoch,
    registerSyncHandler,
    mergedForUserRef,
    lastPushedSigRef,
    syncingRef,
  } = useAccount();
  const player = usePlayer();
  const [playerHydrated, setPlayerHydrated] = useState(false);
  const debounceRef = useRef(0);

  const playerRef = useRef(player);
  playerRef.current = player;

  // Tunggu hidrasi awal PlayerProvider dari localStorage selesai sebelum auto-push aktif.
  useEffect(() => {
    setPlayerHydrated(false);
    const id = window.setTimeout(() => setPlayerHydrated(true), 250);
    return () => window.clearTimeout(id);
  }, []);

  const liveSnapshot = useMemo(
    () => ({
      liked: player.liked || [],
      playlists: player.playlists || [],
      recent: player.recent || [],
      settings: {
        volume: player.volume,
        repeat: player.repeat,
        shuffle: player.shuffle,
        crossfade: player.crossfade,
        cfSec: player.cfSec,
        autoplay: player.autoplay,
      },
    }),
    [
      player.liked,
      player.playlists,
      player.recent,
      player.volume,
      player.repeat,
      player.shuffle,
      player.crossfade,
      player.cfSec,
      player.autoplay,
    ],
  );
  const liveSig = useMemo(() => snapshotSignature(liveSnapshot), [liveSnapshot]);

  const performFullSync = useCallback(async () => {
    const userId = user?.id;
    if (!supabase || !userId || syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus("syncing");
    setSyncError(null);
    try {
      const localSnap = readLocalSnapshot();
      const localSig = snapshotSignature(localSnap);
      const cloud = await fetchCloudSnapshot(userId);
      if (cloud.profile) {
        setProfile(cloud.profile);
      }
      const merged = mergeLibraries(localSnap, cloud);
      const mergedSig = snapshotSignature(merged);

      writeSnapshotToLs(merged);
      await pushCloudSnapshot(userId, merged);

      lastPushedSigRef.current = mergedSig;
      mergedForUserRef.current = userId;
      setSyncStatus("synced");
      setLastSyncedAt(new Date());

      if (mergedSig !== localSig && !playerRef.current.playing) {
        bumpPlayerEpoch();
      }
    } catch (err) {
      setSyncStatus("error");
      setSyncError(err?.message || "Sinkronisasi gagal.");
    } finally {
      syncingRef.current = false;
    }
  }, [
    user?.id,
    syncingRef,
    mergedForUserRef,
    lastPushedSigRef,
    setProfile,
    setSyncStatus,
    setSyncError,
    setLastSyncedAt,
    bumpPlayerEpoch,
  ]);

  useEffect(() => registerSyncHandler(performFullSync), [registerSyncHandler, performFullSync]);

  // Tarik dan gabungkan pustaka ketika user baru masuk.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    if (mergedForUserRef.current !== userId) {
      void performFullSync();
    }
  }, [user?.id, mergedForUserRef, performFullSync]);

  // Sinkronisasi otomatis perubahan lokal ke cloud dengan jeda 1.2 detik.
  useEffect(() => {
    const userId = user?.id;
    if (!playerHydrated || !supabase || !userId || mergedForUserRef.current !== userId) return;
    if (liveSig === lastPushedSigRef.current) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      debounceRef.current = 0;
      if (syncingRef.current) return;
      syncingRef.current = true;
      setSyncStatus("syncing");
      setSyncError(null);
      try {
        await pushCloudSnapshot(userId, liveSnapshot);
        lastPushedSigRef.current = liveSig;
        setSyncStatus("synced");
        setLastSyncedAt(new Date());
      } catch (err) {
        setSyncStatus("error");
        setSyncError(err?.message || "Gagal menyimpan perubahan ke cloud.");
      } finally {
        syncingRef.current = false;
      }
    }, 1200);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = 0;
      }
    };
  }, [
    playerHydrated,
    user?.id,
    mergedForUserRef,
    lastPushedSigRef,
    syncingRef,
    liveSig,
    liveSnapshot,
    setSyncStatus,
    setSyncError,
    setLastSyncedAt,
  ]);

  return null;
}
