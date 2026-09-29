/* VibeWave - Music Player | Author: Abdul Basit */

// ---------- JAMENDO API CONFIG ----------
// Get your own free client id at https://devportal.jamendo.com and paste it here.
const JAMENDO_CLIENT_ID = "56d30c95";
const JAMENDO_URL = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=40&order=popularity_total&imagesize=300&audioformat=mp32`;
const CATEGORIES = ["pop", "rock", "hiphop", "jazz"];

// ---------- STATE ----------
let songs = [];
let currentSongIndex = 0;
let isPlaying = false,
  isShuffle = false,
  isRepeat = false;
let currentFilter = "all",
  currentSearchQuery = "",
  currentView = "all"; // view: all | favorites | recent
const store = {
  get: (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};
let favorites = store.get("favorites", []);
let recentlyPlayed = store.get("recentlyPlayed", []);

// ---------- DOM ELEMENTS ----------
const $ = (id) => document.getElementById(id);
const audio = $("audioPlayer"),
  playlistContainer = $("playlistContainer"),
  playlistTitle = $("playlistTitle");
const playBtn = $("playBtn"),
  prevBtn = $("prevBtn"),
  nextBtn = $("nextBtn"),
  shuffleBtn = $("shuffleBtn"),
  repeatBtn = $("repeatBtn");
const progressBar = $("progressBar"),
  progress = $("progress"),
  currentTimeEl = $("currentTime"),
  totalTimeEl = $("totalTime");
const volumeSlider = $("volumeSlider"),
  volumeIcon = $("volumeIcon"),
  favoriteBtn = $("favoriteBtn");
const songTitle = $("songTitle"),
  songArtist = $("songArtist"),
  albumCover = $("albumCover"),
  albumArt = $("albumArt");
const searchInput = $("searchInput"),
  filterBtns = document.querySelectorAll(".filter-btn");
const viewBtns = {
  favorites: $("showFavorites"),
  recent: $("showRecent"),
  all: $("showAll"),
};

// ---------- HELPERS ----------
function formatTime(s) {
  if (!isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2000);
}
const escapeHTML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const currentSong = () => songs[currentSongIndex];

// ---------- API INTEGRATION ----------
async function loadRealSongs() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(JAMENDO_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error("API " + res.status);
    const data = await res.json();
    return (data.results || [])
      .filter((t) => t.audio)
      .map((t, i) => ({
        id: "j" + t.id,
        title: t.name,
        artist: t.artist_name,
        duration: t.duration,
        src: t.audio,
        cover: t.image || `https://picsum.photos/seed/vw${i}/300`,
        category: CATEGORIES[i % CATEGORIES.length],
      }));
  } catch (err) {
    console.warn("Jamendo unavailable, using fallback songs.", err);
    return [];
  }
}

// ---------- FALLBACK SONGS ----------
function getFallbackSongs() {
  const list = [
    ["Blinding Lights", "The Weeknd"],
    ["Believer", "Imagine Dragons"],
    ["Lose Yourself", "Eminem"],
    ["Take Five", "Dave Brubeck"],
    ["Shape of You", "Ed Sheeran"],
    ["Bohemian Rhapsody", "Queen"],
    ["HUMBLE.", "Kendrick Lamar"],
    ["So What", "Miles Davis"],
    ["Levitating", "Dua Lipa"],
    ["Numb", "Linkin Park"],
    ["Sicko Mode", "Travis Scott"],
    ["Fly Me to the Moon", "Frank Sinatra"],
    ["Stay", "The Kid LAROI"],
    ["Smells Like Teen Spirit", "Nirvana"],
    ["Godzilla", "Eminem"],
    ["Blue in Green", "Miles Davis"],
  ];
  return list.map(([title, artist], i) => ({
    id: "f" + i,
    title,
    artist,
    duration: 180 + ((i * 37) % 120),
    category: CATEGORIES[i % CATEGORIES.length],
    src: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${i + 1}.mp3`,
    cover: `https://picsum.photos/seed/vibewave${i}/300`,
  }));
}

// ---------- PLAYLIST ----------
function getVisibleSongs() {
  let list = songs;
  if (currentView === "favorites")
    list = songs.filter((s) => favorites.includes(s.id));
  else if (currentView === "recent")
    list = recentlyPlayed
      .map((id) => songs.find((s) => s.id === id))
      .filter(Boolean);
  if (currentFilter !== "all")
    list = list.filter((s) => s.category === currentFilter);
  const sort = $("sortSelect").value;
  if (sort !== "default")
    list = [...list].sort((a, b) =>
      sort === "duration"
        ? a.duration - b.duration
        : a[sort].localeCompare(b[sort]),
    );
  if (currentSearchQuery)
    list = list.filter((s) =>
      (s.title + " " + s.artist).toLowerCase().includes(currentSearchQuery),
    );
  return list;
}
function filterAndDisplaySongs() {
  const list = getVisibleSongs();
  displayPlaylist(list);
  const total = list.reduce((t, s) => t + (+s.duration || 0), 0);
  $("playlistStats").textContent =
    `${list.length} songs \u00b7 ${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`;
  $("clearRecent").hidden = !(currentView === "recent" && list.length);
}

function displayPlaylist(list) {
  if (!list.length) {
    const msg =
      currentView === "favorites"
        ? "No favourites yet. Tap a heart to add one."
        : currentView === "recent"
          ? "Nothing played yet."
          : "No songs found.";
    playlistContainer.innerHTML = `<div class="empty"><i class="fas fa-music"></i><p>${msg}</p></div>`;
    return;
  }
  playlistContainer.innerHTML = list
    .map((s) => {
      const active = currentSong() && s.id === currentSong().id,
        fav = favorites.includes(s.id);
      return `<div class="song-item ${active ? "active" : ""}" data-id="${s.id}" tabindex="0">
      <img src="${s.cover}" alt="" loading="lazy" onerror="this.src='https://picsum.photos/seed/${s.id}/300'">
      <div class="song-details"><div class="song-title">${escapeHTML(s.title)}</div><div class="song-artist">${escapeHTML(s.artist)}</div></div>
      ${active ? '<div class="eq"><i></i><i></i><i></i></div>' : ""}<div class="song-meta"><span class="song-duration">${formatTime(s.duration)}</span>
      <button class="fav-btn ${fav ? "active" : ""}" data-fav="${s.id}" aria-label="Toggle favourite"><i class="${fav ? "fas" : "far"} fa-heart"></i></button></div></div>`;
    })
    .join("");
}
// Event delegation: one listener handles every row
playlistContainer.addEventListener("click", (e) => {
  const favBtn = e.target.closest(".fav-btn");
  if (favBtn) {
    e.stopPropagation();
    return toggleFavorite(favBtn.dataset.fav);
  }
  const item = e.target.closest(".song-item");
  if (item) {
    currentSongIndex = songs.findIndex((s) => s.id === item.dataset.id);
    loadSong(currentSongIndex);
    playSong();
  }
});
playlistContainer.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.classList.contains("song-item"))
    e.target.click();
});

// ---------- LOAD & PLAY ----------
function loadSong(i) {
  const s = songs[i];
  if (!s) return;
  currentSongIndex = i;
  audio.src = s.src;
  songTitle.textContent = s.title;
  songArtist.textContent = s.artist;
  albumCover.src = s.cover;
  progress.style.width = "0%";
  currentTimeEl.textContent = "0:00";
  totalTimeEl.textContent = formatTime(s.duration);
  audio.onloadedmetadata = () => {
    if (isFinite(audio.duration))
      totalTimeEl.textContent = formatTime(audio.duration);
  };
  addToRecentlyPlayed(s.id);
  store.set("lastSong", s.id);
  updateFavoriteButton();
  filterAndDisplaySongs();
  document
    .querySelector(".song-item.active")
    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  document.title = `${s.title} - VibeWave`;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: s.title,
      artist: s.artist,
      artwork: [{ src: s.cover, sizes: "300x300" }],
    });
    navigator.mediaSession.setActionHandler("play", playSong);
    navigator.mediaSession.setActionHandler("pause", pauseSong);
    navigator.mediaSession.setActionHandler("nexttrack", nextSong);
    navigator.mediaSession.setActionHandler("previoustrack", prevSong);
  }
}
function playSong() {
  audio.play().catch((err) => {
    if (err.name !== "AbortError")
      toast("Could not play this track. Skipping...");
  });
}
function pauseSong() {
  audio.pause();
}
function togglePlay() {
  if (!currentSong()) return;
  isPlaying ? pauseSong() : playSong();
}
function updateUIState() {
  playBtn.innerHTML = `<i class="fas fa-${isPlaying ? "pause" : "play"}"></i>`;
  document.body.classList.toggle("playing", isPlaying);
  updateOverlayButton();
  albumArt.classList.toggle("spinning", isPlaying);
}
function updateOverlayButton() {
  const icon = document.querySelector(".album-overlay i");
  if (icon) icon.className = `fas ${isPlaying ? "fa-pause" : "fa-play"}`;
}

// ---------- NAVIGATION ----------
function nextSong() {
  if (!songs.length) return;
  let n;
  if (isShuffle && songs.length > 1)
    do {
      n = Math.floor(Math.random() * songs.length);
    } while (n === currentSongIndex);
  else n = (currentSongIndex + 1) % songs.length;
  loadSong(n);
  playSong();
}
function prevSong() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  } // restart first, like real players
  loadSong((currentSongIndex - 1 + songs.length) % songs.length);
  playSong();
}

// ---------- PROGRESS & SEEK (click + drag) ----------
function updateProgress() {
  if (Math.floor(audio.currentTime) % 3 === 0)
    store.set("lastTime", Math.floor(audio.currentTime));
  if (!audio.duration) return;
  progress.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
  currentTimeEl.textContent = formatTime(audio.currentTime);
}
function seekTo(e) {
  const rect = progressBar.getBoundingClientRect(),
    x = e.touches ? e.touches[0].clientX : e.clientX;
  const pct = Math.min(Math.max((x - rect.left) / rect.width, 0), 1);
  if (audio.duration) {
    audio.currentTime = pct * audio.duration;
    progress.style.width = `${pct * 100}%`;
  }
}
let dragging = false;
progressBar.addEventListener("pointerdown", (e) => {
  dragging = true;
  seekTo(e);
});
window.addEventListener("pointermove", (e) => {
  if (dragging) seekTo(e);
});
window.addEventListener("pointerup", () => {
  dragging = false;
});

// ---------- VOLUME, SHUFFLE, REPEAT ----------
function setVolume(v) {
  audio.volume = v / 100;
  volumeSlider.value = v;
  volumeIcon.className = `fas fa-volume-${v == 0 ? "mute" : v < 50 ? "down" : "up"}`;
  store.set("volumeLevel", v);
}
volumeSlider.addEventListener("input", () => setVolume(+volumeSlider.value));
volumeIcon.addEventListener("click", () =>
  setVolume(audio.volume > 0 ? 0 : 70),
);
shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle("active-btn", isShuffle);
  toast(`Shuffle ${isShuffle ? "on" : "off"}`);
});
repeatBtn.addEventListener("click", () => {
  isRepeat = !isRepeat;
  repeatBtn.classList.toggle("active-btn", isRepeat);
  toast(`Repeat ${isRepeat ? "on" : "off"}`);
});

// ---------- SEARCH & FILTERS ----------
searchInput.addEventListener("input", () => {
  currentSearchQuery = searchInput.value.trim().toLowerCase();
  filterAndDisplaySongs();
});
filterBtns.forEach((btn) =>
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    filterAndDisplaySongs();
  }),
);

// ---------- FAVORITES & RECENTLY PLAYED ----------
function toggleFavorite(id) {
  const adding = !favorites.includes(id);
  favorites = adding ? [...favorites, id] : favorites.filter((f) => f !== id);
  store.set("favorites", favorites);
  updateFavoriteButton();
  filterAndDisplaySongs();
  toast(adding ? "Added to favourites" : "Removed from favourites");
}
function updateFavoriteButton() {
  const fav = currentSong() && favorites.includes(currentSong().id);
  favoriteBtn.classList.toggle("active", !!fav);
  favoriteBtn.innerHTML = `<i class="${fav ? "fas" : "far"} fa-heart"></i> ${fav ? "Remove from Favorites" : "Add to Favorites"}`;
}
function addToRecentlyPlayed(id) {
  recentlyPlayed = [id, ...recentlyPlayed.filter((r) => r !== id)].slice(0, 10);
  store.set("recentlyPlayed", recentlyPlayed);
}
function setView(view) {
  currentView = view;
  Object.entries(viewBtns).forEach(([k, b]) =>
    b.classList.toggle("active-btn", k === view && view !== "all"),
  );
  playlistTitle.textContent = {
    all: "Your Playlist",
    favorites: "Your Favorites",
    recent: "Recently Played",
  }[view];
  filterAndDisplaySongs();
}
viewBtns.favorites.addEventListener("click", () => setView("favorites"));
viewBtns.recent.addEventListener("click", () => setView("recent"));
viewBtns.all.addEventListener("click", () => {
  currentFilter = "all";
  currentSearchQuery = "";
  searchInput.value = "";
  filterBtns.forEach((b) =>
    b.classList.toggle("active", b.dataset.filter === "all"),
  );
  setView("all");
});
favoriteBtn.addEventListener("click", () => {
  if (currentSong()) toggleFavorite(currentSong().id);
});

// ---------- AUDIO EVENTS ----------
audio.addEventListener("play", () => {
  isPlaying = true;
  updateUIState();
});
audio.addEventListener("pause", () => {
  isPlaying = false;
  updateUIState();
});
audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("ended", () => {
  if (isRepeat) {
    audio.currentTime = 0;
    playSong();
  } else nextSong();
});
audio.addEventListener("error", () => {
  if (audio.src) {
    toast("Track unavailable. Playing next...");
    setTimeout(nextSong, 1200);
  }
});

// ---------- KEYBOARD SHORTCUTS ----------
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("helpModal").hidden = true;
  if (
    ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) &&
    e.target.type !== "range"
  )
    return;
  if (e.target.tagName === "BUTTON" && e.code === "Space") return;
  const vol = Math.round(audio.volume * 100);
  const extra = {
    KeyM: () => setVolume(audio.volume > 0 ? 0 : 70),
    KeyS: () => shuffleBtn.click(),
    KeyR: () => repeatBtn.click(),
    KeyF: () => favoriteBtn.click(),
    Slash: () => searchInput.focus(),
    "?": toggleHelp,
  };
  if (e.key === "?") {
    e.preventDefault();
    return toggleHelp();
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const actions = {
    ...extra,
    Space: togglePlay,
    ArrowRight: nextSong,
    ArrowLeft: prevSong,
    ArrowUp: () => setVolume(Math.min(vol + 10, 100)),
    ArrowDown: () => setVolume(Math.max(vol - 10, 0)),
  };
  if (actions[e.code]) {
    e.preventDefault();
    actions[e.code]();
  }
});

// ---------- PRO FEATURES: speed, sleep timer, themes, sort, help ----------
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
function setSpeed(s) {
  audio.playbackRate = s;
  $("speedBtn").textContent = s + "x";
  $("speedBtn").classList.toggle("on", s !== 1);
}
$("speedBtn").addEventListener("click", () => {
  const n = SPEEDS[(SPEEDS.indexOf(audio.playbackRate) + 1) % SPEEDS.length];
  setSpeed(n);
  toast(`Speed ${n}x`);
});
audio.addEventListener("loadstart", () => {
  audio.playbackRate = audio.defaultPlaybackRate = audio.playbackRate;
});

let sleepTimer = null,
  sleepIdx = 0;
const SLEEPS = [0, 15, 30, 60];
$("sleepBtn").addEventListener("click", () => {
  sleepIdx = (sleepIdx + 1) % SLEEPS.length;
  clearTimeout(sleepTimer);
  const m = SLEEPS[sleepIdx];
  $("sleepBtn span").textContent = m ? m + " min" : "Off";
  $("sleepBtn").classList.toggle("on", !!m);
  if (m)
    sleepTimer = setTimeout(() => {
      pauseSong();
      sleepIdx = 0;
      $("sleepBtn span").textContent = "Off";
      $("sleepBtn").classList.remove("on");
      toast("Sleep timer: music stopped");
    }, m * 60000);
  toast(m ? `Sleep timer set for ${m} min` : "Sleep timer off");
});

const ACCENTS = [
  ["#00e5ff", "#8b5cf6", "#ff2fb9"],
  ["#22c55e", "#06b6d4", "#a3e635"],
  ["#f97316", "#ef4444", "#facc15"],
  ["#3b82f6", "#6366f1", "#ec4899"],
];
let accentIdx = 0;
function applyAccent(i) {
  accentIdx = i % ACCENTS.length;
  const [c, p, k] = ACCENTS[accentIdx],
    r = document.documentElement.style;
  r.setProperty("--cyan", c);
  r.setProperty("--purple", p);
  r.setProperty("--pink", k);
  store.set("accent", accentIdx);
}
$("themeBtn").addEventListener("click", () => {
  applyAccent(accentIdx + 1);
  toast("Accent color changed");
});

$("sortSelect").addEventListener("change", filterAndDisplaySongs);
$("clearRecent").addEventListener("click", () => {
  recentlyPlayed = [];
  store.set("recentlyPlayed", []);
  filterAndDisplaySongs();
  toast("History cleared");
});
function toggleHelp() {
  $("helpModal").hidden = !$("helpModal").hidden;
}
$("helpBtn").addEventListener("click", toggleHelp);
$("closeHelp").addEventListener("click", toggleHelp);
$("helpModal").addEventListener("click", (e) => {
  if (e.target.id === "helpModal") toggleHelp();
});

// ---------- LOAD SAVED STATE ----------
function loadSavedState() {
  setVolume(store.get("volumeLevel", 70));
  if (songs.length) {
    const last = songs.findIndex((s) => s.id === store.get("lastSong", ""));
    loadSong(Math.max(last, 0));
    const t = store.get("lastTime", 0);
    if (last >= 0 && t > 0)
      audio.addEventListener(
        "loadedmetadata",
        () => {
          audio.currentTime = t;
        },
        { once: true },
      );
  }
  applyAccent(store.get("accent", 0));
  setSpeed(1);
  playBtn.addEventListener("click", togglePlay);
  prevBtn.addEventListener("click", prevSong);
  nextBtn.addEventListener("click", nextSong);
  document.querySelector(".album-overlay").addEventListener("click", (e) => {
    e.stopPropagation();
    togglePlay();
  });
  updateFavoriteButton();
  updateUIState();
}

// ---------- APPLICATION INITIALIZATION ----------
async function initApp() {
  playlistContainer.innerHTML =
    '<div class="empty"><i class="fas fa-spinner fa-spin"></i><p>Loading songs...</p></div>';
  songs = await loadRealSongs();
  if (!songs.length) {
    songs = getFallbackSongs();
    toast("Offline mode: demo playlist loaded");
  }
  loadSavedState();
}
initApp();
