// SyncWave Background Service Worker (Manifest V3)
// Using Firestore to match the web app's structure

importScripts('firebase-config.js');

// In a real extension, you would include the Firebase SDK files locally.
// For example: importScripts('firebase-app-compat.js', 'firebase-firestore-compat.js');

let db = null;
let currentRoomCode = null;
let currentUsername = null;
let currentUserUid = null;
let isConnected = false;

// Initialize Firebase (Assuming SDK is available)
function initFirebase() {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    // Use the firestoreDatabaseId from config if provided
    db = firebase.firestore();
    isConnected = true;
    chrome.storage.local.set({ connected: true });
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', connected: true });
  }
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_USERNAME') {
    currentUsername = message.username;
    // In a real app, we'd also have a UID from Auth
    currentUserUid = message.uid || 'ext-' + Math.random().toString(36).substr(2, 9);
    chrome.storage.local.set({ username: currentUsername, uid: currentUserUid });
  }

  if (message.type === 'JOIN_ROOM') {
    currentRoomCode = message.roomCode;
    chrome.storage.local.set({ roomCode: currentRoomCode });
    joinRoom(currentRoomCode, sendResponse);
    return true; 
  }

  if (message.type === 'CREATE_ROOM') {
    currentRoomCode = message.roomCode;
    chrome.storage.local.set({ roomCode: currentRoomCode });
    createRoom(currentRoomCode, sendResponse);
    return true;
  }

  if (message.type === 'LEAVE_ROOM') {
    leaveRoom();
    sendResponse({ success: true });
  }

  if (message.type === 'GET_MEMBERS') {
    getMembers(sendResponse);
    return true;
  }

  if (message.type === 'SYNC_VIDEO') {
    syncVideo(message.syncData);
  }

  if (message.type === 'GET_SYNC_DATA') {
    getSyncData(sendResponse);
    return true;
  }
});

function joinRoom(roomCode, callback) {
  if (!db) return callback({ success: false, error: 'Firebase not initialized' });

  const roomRef = db.collection('rooms').doc(roomCode);
  roomRef.get().then(doc => {
    if (doc.exists) {
      // Add user to members
      roomRef.update({
        [`members.${currentUserUid}`]: true
      }).then(() => {
        callback({ success: true });
        listenToSync(roomCode);
      });
    } else {
      callback({ success: false, error: 'Room not found' });
    }
  }).catch(err => callback({ success: false, error: err.message }));
}

function createRoom(roomCode, callback) {
  if (!db) return callback({ success: false, error: 'Firebase not initialized' });

  const roomRef = db.collection('rooms').doc(roomCode);
  roomRef.set({
    id: roomCode,
    owner: currentUserUid,
    createdAt: Date.now(),
    members: {
      [currentUserUid]: true
    },
    state: {
      status: 'paused',
      currentTime: 0,
      currentVideoId: 'dQw4w9WgXcQ',
      lastUpdatedBy: currentUserUid,
      lastUpdate: Date.now()
    }
  }).then(() => {
    callback({ success: true });
    listenToSync(roomCode);
  }).catch(err => callback({ success: false, error: err.message }));
}

function leaveRoom() {
  if (db && currentRoomCode && currentUserUid) {
    db.collection('rooms').doc(currentRoomCode).update({
      [`members.${currentUserUid}`]: firebase.firestore.FieldValue.delete()
    });
    currentRoomCode = null;
  }
}

function getMembers(callback) {
  if (db && currentRoomCode) {
    db.collection('rooms').doc(currentRoomCode).get().then(doc => {
      const data = doc.data();
      const members = data ? Object.keys(data.members || {}).map(id => ({ username: id })) : [];
      callback(members);
    });
  } else {
    callback([]);
  }
}

function syncVideo(syncData) {
  if (db && currentRoomCode) {
    db.collection('rooms').doc(currentRoomCode).update({
      'state.status': syncData.playing ? 'playing' : 'paused',
      'state.currentTime': syncData.timestamp,
      'state.currentVideoId': syncData.videoId,
      'state.lastUpdatedBy': currentUserUid,
      'state.lastUpdate': Date.now()
    });
  }
}

function listenToSync(roomCode) {
  if (!db) return;
  db.collection('rooms').doc(roomCode).onSnapshot(doc => {
    const data = doc.data();
    if (data && data.state) {
      const syncData = {
        videoId: data.state.currentVideoId,
        timestamp: data.state.currentTime,
        playing: data.state.status === 'playing',
        lastUpdatedBy: data.state.lastUpdatedBy
      };
      // Broadcast to all content scripts in YouTube tabs
      chrome.tabs.query({ url: '*://www.youtube.com/*' }, tabs => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'SYNC_UPDATE', syncData });
        });
      });
    }
  });
}

function getSyncData(callback) {
  if (db && currentRoomCode) {
    db.collection('rooms').doc(currentRoomCode).get().then(doc => {
      const data = doc.data();
      if (data && data.state) {
        callback({
          videoId: data.state.currentVideoId,
          timestamp: data.state.currentTime,
          playing: data.state.status === 'playing'
        });
      } else {
        callback(null);
      }
    });
  } else {
    callback(null);
  }
}

// Initial setup
chrome.storage.local.get(['username', 'uid', 'roomCode'], (data) => {
  currentUsername = data.username;
  currentUserUid = data.uid;
  currentRoomCode = data.roomCode;
  initFirebase();
});
