// SyncWave Content Script — YouTube Player Hijack
// Injected into every YouTube page

let currentRoomCode = null;
let currentUsername = null;
let playSyncEnabled = false;
let audioModeEnabled = false;
let isSeekingFromSync = false;
let isRedirectingForSync = false;
let lastSyncData = null;

// Navbar UI Elements
let navbar = null;
let statusDot = null;
let roomCodeText = null;
let syncBtn = null;
let playSyncBtn = null;
let audioModeBtn = null;
let homeBtn = null;
let hideToggleBtn = null;

// Initialize
function init() {
  chrome.storage.local.get(['username', 'roomCode', 'playSyncEnabled', 'audioModeEnabled'], (data) => {
    currentUsername = data.username;
    currentRoomCode = data.roomCode;
    playSyncEnabled = data.playSyncEnabled || false;
    audioModeEnabled = data.audioModeEnabled || false;

    if (window.location.pathname === '/watch') {
      injectNavbar();
      setupPlayerListeners();
      checkPendingSync();
    }
  });
}

// Inject Floating Navbar
function injectNavbar() {
  if (document.getElementById('syncwave-navbar')) return;

  navbar = document.createElement('div');
  navbar.id = 'syncwave-navbar';
  navbar.innerHTML = `
    <div class="sw-drag-handle" title="Drag to move">⋮⋮</div>
    <div class="sw-room-info">
      <div class="sw-status-dot ${currentRoomCode ? 'online' : ''}"></div>
      <span id="sw-room-code">${currentRoomCode || 'No Room'}</span>
    </div>
    <button class="sw-btn sw-sync" title="Sync current video to room">
      <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
      <label>Sync</label>
    </button>
    <button class="sw-btn sw-playsync ${playSyncEnabled ? 'on' : ''}" title="Toggle PlaySync (Auto-sync with room)">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
      <label>PlaySync</label>
    </button>
    <button class="sw-btn sw-audio ${audioModeEnabled ? 'on' : ''}" title="Toggle Audio Mode (Hide video)">
      <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <label>Audio</label>
    </button>
    <button class="sw-btn sw-home" title="Go to YouTube Home">
      <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
      <label>Home</label>
    </button>
    <button class="sw-btn sw-hide" title="Minimize Navbar">
      <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
      <label>Hide</label>
    </button>
  `;
  document.body.appendChild(navbar);

  // Dragging Logic
  let isDragging = false;
  let offsetX, offsetY;

  const dragHandle = navbar.querySelector('.sw-drag-handle');
  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - navbar.offsetLeft;
    offsetY = e.clientY - navbar.offsetTop;
    navbar.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    navbar.style.left = `${e.clientX - offsetX}px`;
    navbar.style.top = `${e.clientY - offsetY}px`;
    navbar.style.transform = 'none';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    navbar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  });

  // Button Event Listeners
  syncBtn = navbar.querySelector('.sw-sync');
  syncBtn.addEventListener('click', syncCurrentVideo);

  playSyncBtn = navbar.querySelector('.sw-playsync');
  playSyncBtn.addEventListener('click', togglePlaySync);

  audioModeBtn = navbar.querySelector('.sw-audio');
  audioModeBtn.addEventListener('click', toggleAudioMode);

  homeBtn = navbar.querySelector('.sw-home');
  homeBtn.addEventListener('click', () => {
    window.location.href = 'https://www.youtube.com/';
  });

  hideToggleBtn = navbar.querySelector('.sw-hide');
  hideToggleBtn.addEventListener('click', toggleNavbarMinimize);

  // Apply initial audio mode
  if (audioModeEnabled) applyAudioMode(true);
}

// Player Detection
const getVideoElement = () => document.querySelector('video');
const getVideoId = () => new URLSearchParams(window.location.search).get('v');

// Sync Current Video to Firebase
function syncCurrentVideo() {
  if (!currentRoomCode) return showToast("Join a room first!", "error");
  
  const video = getVideoElement();
  const videoId = getVideoId();
  
  if (!videoId || !video) return showToast("No video playing!", "error");
  
  const syncData = {
    videoId: videoId,
    timestamp: video.currentTime,
    playing: !video.paused,
    title: document.title
  };
  
  syncBtn.classList.add('syncing');
  chrome.runtime.sendMessage({ type: 'SYNC_VIDEO', syncData });
  
  setTimeout(() => {
    syncBtn.classList.remove('syncing');
    showToast("Synced! 🎵", "success");
  }, 500);
}

// Toggle PlaySync
function togglePlaySync() {
  playSyncEnabled = !playSyncEnabled;
  chrome.storage.local.set({ playSyncEnabled });
  playSyncBtn.classList.toggle('on', playSyncEnabled);
  
  if (playSyncEnabled) {
    showToast("PlaySync ON — Auto-syncing", "success");
    // Get latest sync data from room
    chrome.runtime.sendMessage({ type: 'GET_SYNC_DATA' }, (syncData) => {
      if (syncData) onSyncDataReceived(syncData);
    });
  } else {
    showToast("PlaySync OFF — Local mode", "info");
  }
}

// Toggle Audio Mode
function toggleAudioMode() {
  audioModeEnabled = !audioModeEnabled;
  chrome.storage.local.set({ audioModeEnabled });
  audioModeBtn.classList.toggle('on', audioModeEnabled);
  applyAudioMode(audioModeEnabled);
}

function applyAudioMode(enabled) {
  const video = getVideoElement();
  if (video) {
    if (enabled) {
      video.style.visibility = 'hidden';
      video.style.height = '1px';
      showToast("Audio Mode ON", "info");
    } else {
      video.style.visibility = 'visible';
      video.style.height = 'auto';
      showToast("Audio Mode OFF", "info");
    }
  }
}

// Navbar Minimize
function toggleNavbarMinimize() {
  navbar.classList.toggle('minimized');
}

// Firebase Listener (via Background Script)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SYNC_UPDATE') {
    onSyncDataReceived(message.syncData);
  }
});

function onSyncDataReceived(syncData) {
  if (!playSyncEnabled) return;
  
  const video = getVideoElement();
  const currentVideoId = getVideoId();
  
  if (!video) return;

  // Case 1: Same video
  if (currentVideoId === syncData.videoId) {
    const timeDiff = Math.abs(video.currentTime - syncData.timestamp);
    if (timeDiff > 1.5) {
      isSeekingFromSync = true;
      video.currentTime = syncData.timestamp;
      setTimeout(() => isSeekingFromSync = false, 500);
    }
    
    if (syncData.playing && video.paused) {
      video.play();
    } else if (!syncData.playing && !video.paused) {
      video.pause();
    }
  } 
  // Case 2: Different video — Redirect
  else {
    isRedirectingForSync = true;
    chrome.storage.local.set({ pendingSync: syncData }, () => {
      window.location.href = `https://www.youtube.com/watch?v=${syncData.videoId}`;
    });
  }
}

// Check for pending sync after redirect
function checkPendingSync() {
  chrome.storage.local.get(['pendingSync'], (data) => {
    if (data.pendingSync && playSyncEnabled) {
      waitForVideoElement().then((video) => {
        video.currentTime = data.pendingSync.timestamp;
        if (data.pendingSync.playing) video.play();
        else video.pause();
        chrome.storage.local.remove('pendingSync');
      }).catch(err => console.error('SyncWave: Video load timeout', err));
    }
  });
}

function waitForVideoElement(maxWait = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const video = getVideoElement();
      if (video && video.readyState >= 2) return resolve(video);
      if (Date.now() - start > maxWait) return reject('Timeout');
      setTimeout(check, 200);
    };
    check();
  });
}

// Player Event Listeners
function setupPlayerListeners() {
  const video = getVideoElement();
  if (!video) return;

  video.addEventListener('seeked', () => {
    if (!playSyncEnabled || isSeekingFromSync) return;
    
    // User manually seeked — Sync to room
    const syncData = {
      videoId: getVideoId(),
      timestamp: video.currentTime,
      playing: !video.paused,
      title: document.title
    };
    chrome.runtime.sendMessage({ type: 'SYNC_VIDEO', syncData });
  });

  // Detect Ad
  const adObserver = new MutationObserver(() => {
    const isAd = document.querySelector('.ad-showing') !== null;
    if (isAd && playSyncEnabled) {
      // Maybe pause sync or show indicator
    }
  });
  const moviePlayer = document.getElementById('movie_player');
  if (moviePlayer) {
    adObserver.observe(moviePlayer, { attributes: true, attributeFilter: ['class'] });
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `sw-toast show ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// YouTube SPA Navigation Detection
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    onYouTubePageChange();
  }
}).observe(document, { subtree: true, childList: true });

function onYouTubePageChange() {
  if (window.location.pathname === '/watch') {
    injectNavbar();
    setupPlayerListeners();
    checkPendingSync();
  } else {
    if (navbar) navbar.remove();
  }
}

// Start
init();
