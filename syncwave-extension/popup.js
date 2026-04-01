// SyncWave Popup Logic
document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const usernameSection = document.getElementById('username-section');
  const usernameInput = document.getElementById('username-input');
  const saveUsernameBtn = document.getElementById('save-username-btn');
  const joinSection = document.getElementById('join-section');
  const roomInput = document.getElementById('room-input');
  const joinBtn = document.getElementById('join-btn');
  const createBtn = document.getElementById('create-btn');
  const roomInfoSection = document.getElementById('room-info-section');
  const activeRoomCode = document.getElementById('active-room-code');
  const membersList = document.getElementById('members-list');
  const leaveBtn = document.getElementById('leave-btn');
  const copyBtn = document.getElementById('copy-btn');

  // Load initial state
  chrome.storage.local.get(['username', 'roomCode', 'connected'], (data) => {
    if (data.username) {
      usernameSection.classList.add('hidden');
      if (data.roomCode) {
        showRoomInfo(data.roomCode);
      } else {
        joinSection.classList.remove('hidden');
      }
    } else {
      usernameSection.classList.remove('hidden');
      joinSection.classList.add('hidden');
      roomInfoSection.classList.add('hidden');
    }

    if (data.connected) {
      statusDot.classList.add('online');
      statusText.textContent = 'Connected to SyncWave';
    }
  });

  // Save Username
  saveUsernameBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
      chrome.storage.local.set({ username }, () => {
        usernameSection.classList.add('hidden');
        joinSection.classList.remove('hidden');
        // Notify background script
        chrome.runtime.sendMessage({ type: 'SET_USERNAME', username });
      });
    }
  });

  // Join Room
  joinBtn.addEventListener('click', () => {
    const roomCode = roomInput.value.trim().toUpperCase();
    if (roomCode.length === 6) {
      chrome.runtime.sendMessage({ type: 'JOIN_ROOM', roomCode }, (response) => {
        if (response && response.success) {
          showRoomInfo(roomCode);
        } else {
          alert('Failed to join room. Please check the code.');
        }
      });
    }
  });

  // Create Room
  createBtn.addEventListener('click', () => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    chrome.runtime.sendMessage({ type: 'CREATE_ROOM', roomCode }, (response) => {
      if (response && response.success) {
        showRoomInfo(roomCode);
      }
    });
  });

  // Leave Room
  leaveBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LEAVE_ROOM' }, () => {
      roomInfoSection.classList.add('hidden');
      joinSection.classList.remove('hidden');
      chrome.storage.local.remove('roomCode');
    });
  });

  // Copy Room Code
  copyBtn.addEventListener('click', () => {
    const code = activeRoomCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy', 2000);
    });
  });

  function showRoomInfo(roomCode) {
    joinSection.classList.add('hidden');
    roomInfoSection.classList.remove('hidden');
    activeRoomCode.textContent = roomCode;
    updateMembersList();
  }

  function updateMembersList() {
    chrome.runtime.sendMessage({ type: 'GET_MEMBERS' }, (members) => {
      if (members && Array.isArray(members)) {
        membersList.innerHTML = '';
        members.forEach(member => {
          const div = document.createElement('div');
          div.className = 'member-item';
          div.innerHTML = `<div class="member-dot"></div><span>${member.username}</span>`;
          membersList.appendChild(div);
        });
      }
    });
  }

  // Listen for updates from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATUS_UPDATE') {
      if (message.connected) {
        statusDot.classList.add('online');
        statusText.textContent = 'Connected to SyncWave';
      } else {
        statusDot.classList.remove('online');
        statusText.textContent = 'Connecting to Firebase...';
      }
    }
    if (message.type === 'MEMBERS_UPDATE') {
      updateMembersList();
    }
  });
});
