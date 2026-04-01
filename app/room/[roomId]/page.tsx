'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { 
  Play, Pause, Cast, Users, 
  Volume2, VolumeX, Maximize2, 
  Minimize2, X, Music, Video,
  ChevronRight, ChevronLeft, GripVertical,
  Radio, Info, LogOut, Monitor
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

// YouTube Player API types
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export default function RoomPage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  
  // Room & Sync State
  const [roomData, setRoomData] = useState<any>(null);
  const [isSynced, setIsSynced] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  
  // UI State
  const [viewMode, setViewMode] = useState<'home' | 'player'>('home');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVideoMode, setIsVideoMode] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingVideos, setTrendingVideos] = useState<any[]>([
    { id: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up', author: 'Rick Astley', views: '1.4B views' },
    { id: '9bZkp7q19f0', title: 'PSY - GANGNAM STYLE', author: 'officialpsy', views: '4.8B views' },
    { id: 'kJQP7kiw5Fk', title: 'Luis Fonsi - Despacito ft. Daddy Yankee', author: 'Luis Fonsi', views: '8.2B views' },
    { id: 'JGwWNGJdvx8', title: 'Ed Sheeran - Shape of You', author: 'Ed Sheeran', views: '6B views' },
    { id: 'OPf0YbXqDm0', title: 'Mark Ronson - Uptown Funk ft. Bruno Mars', author: 'Mark Ronson', views: '4.9B views' },
    { id: 'y6120QOlsfU', title: 'Darude - Sandstorm', author: 'Darude', views: '230M views' },
    { id: 'L_jWHffIx5E', title: 'Smash Mouth - All Star', author: 'Smash Mouth', views: '450M views' },
    { id: 'fHI8X4OXluQ', title: 'Imagine Dragons - Believer', author: 'Imagine Dragons', views: '2.4B views' },
  ]);
  const [activeVideo, setActiveVideo] = useState<{ id: string, title: string, author: string } | null>(null);
  const [playerStatus, setPlayerStatus] = useState<number>(-1);
  
  // Player State
  const playerRef = useRef<any>(null);
  const isUpdatingRef = useRef(false);
  const lastLocalStateRef = useRef({ status: -1, time: 0, videoId: '' });
  const containerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<any>(null);

  // Helper to check if player is ready
  const isPlayerReady = useCallback(() => {
    return !!(playerRef.current && typeof playerRef.current.getCurrentTime === 'function');
  }, []);

  // Helper to safely get video ID
  const getSafeVideoId = useCallback(() => {
    if (!isPlayerReady()) return null;
    try {
      if (typeof playerRef.current.getVideoData === 'function') {
        return playerRef.current.getVideoData()?.video_id;
      }
      const url = playerRef.current.getVideoUrl?.();
      if (url) {
        const match = url.match(/[?&]v=([^&]+)/);
        return match ? match[1] : null;
      }
    } catch (e) {
      console.warn('Failed to get video ID:', e);
    }
    return null;
  }, [isPlayerReady]);

  // Register Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.error('SW registration failed:', err));
    }
  }, []);

  // MediaSession API setup
  const updateMediaSession = useCallback((title: string, artist: string, album: string, artworkUrl: string) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title,
        artist,
        album,
        artwork: [
          { src: artworkUrl, sizes: '96x96', type: 'image/png' },
          { src: artworkUrl, sizes: '128x128', type: 'image/png' },
          { src: artworkUrl, sizes: '192x192', type: 'image/png' },
          { src: artworkUrl, sizes: '256x256', type: 'image/png' },
          { src: artworkUrl, sizes: '384x384', type: 'image/png' },
          { src: artworkUrl, sizes: '512x512', type: 'image/png' },
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => playerRef.current?.playVideo?.());
      navigator.mediaSession.setActionHandler('pause', () => playerRef.current?.pauseVideo?.());
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        if (!isPlayerReady()) return;
        const time = playerRef.current.getCurrentTime();
        playerRef.current.seekTo(Math.max(time - 10, 0), true);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        if (!isPlayerReady()) return;
        const time = playerRef.current.getCurrentTime();
        playerRef.current.seekTo(time + 10, true);
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        playerRef.current?.stopVideo?.();
      });
    }
  }, [isPlayerReady]);

  // Sync logic: Listen to room changes
  useEffect(() => {
    if (!roomId || !user) return;

    const roomRef = doc(db, `rooms/${roomId}`);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        router.push('/dashboard');
        return;
      }
      const data = snapshot.data();
      setRoomData(data);

      // Handle members
      const memberIds = Object.keys(data.members || {});
      setMembers(memberIds.map(id => ({ id })));

      // Sync player state
      if (isSynced && isPlayerReady() && data.state && data.state.lastUpdatedBy !== user.uid) {
        const { status, currentTime: roomTime, currentVideoId } = data.state;
        
        // Check if we need to load a new video
        const currentVideoIdLocal = getSafeVideoId();
        if (currentVideoId && currentVideoIdLocal !== currentVideoId) {
          isUpdatingRef.current = true;
          playerRef.current.loadVideoById(currentVideoId, roomTime);
          setTimeout(() => isUpdatingRef.current = false, 1000);
          
          // Update MediaSession for remote video change
          updateMediaSession("Syncing...", "YouTube", "SyncWave", `https://img.youtube.com/vi/${currentVideoId}/maxresdefault.jpg`);
        } else {
          // Handle significant time drift
          const localTime = playerRef.current.getCurrentTime();
          if (Math.abs(localTime - roomTime) > 2) {
            isUpdatingRef.current = true;
            playerRef.current.seekTo(roomTime, true);
            setTimeout(() => isUpdatingRef.current = false, 500);
          }

          // Sync playback status
          const localPlayerState = playerRef.current.getPlayerState();
          if (status === 'playing' && localPlayerState !== window.YT.PlayerState.PLAYING) {
            isUpdatingRef.current = true;
            playerRef.current.playVideo();
            setTimeout(() => isUpdatingRef.current = false, 500);
          } else if (status === 'paused' && localPlayerState !== window.YT.PlayerState.PAUSED) {
            isUpdatingRef.current = true;
            playerRef.current.pauseVideo();
            setTimeout(() => isUpdatingRef.current = false, 500);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, user, router, isSynced, updateMediaSession, getSafeVideoId, isPlayerReady]);

  // Broadcast state to Firebase
  const broadcastState = useCallback((status: 'playing' | 'paused', time: number, videoId: string) => {
    if (!roomId || !user) return;
    updateDoc(doc(db, `rooms/${roomId}`), {
      'state.status': status,
      'state.currentTime': time,
      'state.currentVideoId': videoId,
      'state.lastUpdatedBy': user.uid,
      'state.lastUpdate': Date.now()
    });
  }, [roomId, user]);

  // Player State Change Handler (Broadcast)
  const onPlayerStateChange = useCallback((event: any) => {
    setPlayerStatus(event.data);
    
    if (event.data === window.YT.PlayerState.PLAYING || event.data === window.YT.PlayerState.PAUSED) {
      const videoId = getSafeVideoId();
      const videoData = playerRef.current?.getVideoData?.();
      if (videoId && videoData) {
        setActiveVideo({
          id: videoId,
          title: videoData.title || 'YouTube Video',
          author: videoData.author || 'YouTube'
        });
      }
    }

    if (isUpdatingRef.current || !isSynced || !user || !roomId || !isPlayerReady()) return;

    const status = event.data === window.YT.PlayerState.PLAYING ? 'playing' : 
                   event.data === window.YT.PlayerState.PAUSED ? 'paused' : null;
    
    if (!status) return;

    const time = playerRef.current.getCurrentTime();
    const videoId = getSafeVideoId();
    
    // Try to get more info for MediaSession if available
    let title = "YouTube Video";
    let author = "YouTube";
    if (typeof playerRef.current.getVideoData === 'function') {
      const videoData = playerRef.current.getVideoData();
      if (videoData) {
        title = videoData.title || title;
        author = videoData.author || author;
      }
    }

    // Update MediaSession
    if (videoId) {
      updateMediaSession(title, author, "SyncWave", `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
    }

    broadcastState(status, time, videoId || '');
  }, [isSynced, user, roomId, updateMediaSession, broadcastState, getSafeVideoId, isPlayerReady]);

  // Polling for local seek detection
  useEffect(() => {
    if (!isSynced || !isPlayerReady()) return;

    pollIntervalRef.current = setInterval(() => {
      if (isUpdatingRef.current || !isPlayerReady()) return;
      
      const currentTime = playerRef.current.getCurrentTime();
      const playerState = playerRef.current.getPlayerState();
      const videoId = getSafeVideoId();

      if (!videoId) return;

      // Detect seek: if time jumped more than 2 seconds (excluding normal playback)
      const timeDiff = Math.abs(currentTime - lastLocalStateRef.current.time);
      const isPlaying = playerState === window.YT.PlayerState.PLAYING;
      
      if (timeDiff > 2 && (!isPlaying || timeDiff > 3)) {
        const status = isPlaying ? 'playing' : 'paused';
        broadcastState(status, currentTime, videoId);
      }

      lastLocalStateRef.current = {
        time: currentTime,
        status: playerState,
        videoId: videoId
      };
    }, 1000);

    return () => clearInterval(pollIntervalRef.current);
  }, [isSynced, broadcastState, getSafeVideoId, isPlayerReady]);

  // YouTube Player Setup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initPlayer = () => {
      if (playerRef.current) return;
      
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: 'dQw4w9WgXcQ', // Default video
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
          enablejsapi: 1,
          listType: 'search',
          list: 'trending music' // Load trending as "homepage"
        },
        events: {
          onStateChange: onPlayerStateChange,
          onReady: (event: any) => {
            if (roomData?.state?.currentVideoId) {
              event.target.loadVideoById(roomData.state.currentVideoId, roomData.state.currentTime || 0);
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = initPlayer;
    }
  }, [onPlayerStateChange, roomData?.state?.currentTime, roomData?.state?.currentVideoId]); // Added missing dependencies

  // Actions
  const playVideo = (videoId: string) => {
    setViewMode('player');
    if (isPlayerReady()) {
      playerRef.current.loadVideoById(videoId);
    }
    // When playing locally, we might want to disable sync automatically if it was on
    // but the user said "local will get priority", so we just stay in local mode
    setIsSynced(false);
  };

  const castToRoom = () => {
    if (!isPlayerReady() || !roomId || !user) return;
    const videoId = getSafeVideoId();
    if (!videoId) return;

    const status = playerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING ? 'playing' : 'paused';
    const time = playerRef.current.getCurrentTime();

    broadcastState(status, time, videoId);
    setIsSynced(true);
    setViewMode('player');
  };

  const goHome = () => {
    setViewMode('home');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    // Check if it's a direct YT link
    const videoIdMatch = searchQuery.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (videoIdMatch) {
      playVideo(videoIdMatch[1]);
    } else {
      // Search logic
      if (isPlayerReady()) {
        setViewMode('player');
        playerRef.current.loadPlaylist({
          listType: 'search',
          list: searchQuery,
          index: 0,
          startSeconds: 0,
          suggestedQuality: 'large'
        });
      }
    }
    setSearchQuery('');
  };

  const syncToRoom = () => {
    if (!roomData?.state?.currentVideoId || !isPlayerReady()) return;
    setIsSynced(true);
    setViewMode('player');
    const { currentVideoId, currentTime, status } = roomData.state;
    playerRef.current.loadVideoById(currentVideoId, currentTime);
    if (status === 'playing') playerRef.current.playVideo();
    else playerRef.current.pauseVideo();
  };

  const leaveRoom = async () => {
    if (!user || !roomId) return;
    router.push('/dashboard');
  };

  return (
    <div className="h-screen w-screen bg-[#0f0f0f] overflow-hidden relative text-white" ref={containerRef}>
      
      {/* --- YOUTUBE HOMEPAGE CLONE --- */}
      <AnimatePresence>
        {viewMode === 'home' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 overflow-y-auto pt-24 pb-32 px-6 bg-[#0f0f0f]"
          >
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                {['All', 'Music', 'Gaming', 'Live', 'Mixes', 'Lo-fi', 'Computers', 'Recently uploaded'].map((tag) => (
                  <button key={tag} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium whitespace-nowrap transition-colors">
                    {tag}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {trendingVideos.map((video) => (
                  <motion.div 
                    key={video.id}
                    whileHover={{ scale: 1.02 }}
                    className="cursor-pointer group"
                    onClick={() => playVideo(video.id)}
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
                      <img 
                        src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        12:34
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0" />
                      <div>
                        <h3 className="text-sm font-bold line-clamp-2 leading-snug group-hover:text-purple-400 transition-colors">
                          {video.title}
                        </h3>
                        <p className="text-xs text-white/60 mt-1">{video.author}</p>
                        <p className="text-xs text-white/60">{video.views} • 2 hours ago</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- FULLSCREEN YOUTUBE PLAYER --- */}
      <div 
        className={`fixed inset-0 transition-all duration-500 ${viewMode === 'home' || !isVideoMode ? 'invisible opacity-0 scale-95' : 'visible opacity-100 scale-100'}`}
        style={{ pointerEvents: 'auto' }}
      >
        <div id="youtube-player" className="w-full h-full"></div>
      </div>

      {/* --- AUDIO MODE UI --- */}
      {viewMode === 'player' && !isVideoMode && (
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900/40 via-black to-black flex flex-col items-center justify-center z-0">
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 2, -2, 0]
            }}
            transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
            className="relative w-80 h-80"
          >
            <div className="absolute inset-0 bg-purple-500/20 blur-[100px] rounded-full animate-pulse" />
            <div className="relative w-full h-full bg-white/5 backdrop-blur-3xl rounded-3xl border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden">
              <img 
                src={`https://img.youtube.com/vi/${activeVideo?.id || 'dQw4w9WgXcQ'}/maxresdefault.jpg`}
                className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm"
                alt="Background"
              />
              <Music size={120} className="text-purple-500/50 relative z-10" />
            </div>
          </motion.div>
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white/90">
              {activeVideo?.title || "SyncWave Audio"}
            </h2>
            <p className="text-purple-400 font-medium mt-1">
              {activeVideo?.author || "YouTube"}
            </p>
          </div>
        </div>
      )}

      {/* --- FLOATING SMART NAVBAR --- */}
      <motion.div 
        drag
        dragConstraints={containerRef}
        dragElastic={0.1}
        initial={{ y: 20, x: '50%' }}
        className="fixed top-6 left-1/2 z-[1000] cursor-grab active:cursor-grabbing"
        style={{ x: '-50%' }}
      >
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.nav 
              key="full-nav"
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="bg-[#1a1a1a]/80 backdrop-blur-3xl border border-white/10 rounded-2xl p-2 flex items-center gap-3 shadow-2xl min-w-[700px]"
            >
              <div className="flex items-center gap-3 pl-2 group relative">
                <GripVertical size={18} className="text-white/20" />
                <div className="flex -space-x-2">
                  {members.slice(0, 3).map((m, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-purple-600 border-2 border-[#1a1a1a] flex items-center justify-center text-[10px] font-bold shadow-lg">
                      {m.id.slice(0, 1).toUpperCase()}
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-6 w-[1px] bg-white/10" />

              <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 bg-black/40 rounded-xl px-3 py-2 border border-white/5 focus-within:border-purple-500/50 transition-all">
                <Radio size={14} className="text-purple-500" />
                <input 
                  type="text" 
                  placeholder="Search or paste YouTube URL..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-white/20"
                />
              </form>

              <div className="h-6 w-[1px] bg-white/10" />

              <div className="flex items-center gap-1.5">
                <button 
                  onClick={goHome}
                  className={`p-2.5 rounded-xl transition-all ${viewMode === 'home' ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5'}`}
                  title="YouTube Home"
                >
                  <Radio size={20} />
                </button>
                
                {roomData?.state?.currentVideoId && (
                  <button 
                    onClick={syncToRoom}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${isSynced ? 'bg-green-500/20 text-green-500 border border-green-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    title="Sync with Room"
                  >
                    <Monitor size={14} />
                    {isSynced ? 'Synced' : 'Join Sync'}
                  </button>
                )}

                <button 
                  onClick={castToRoom}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20"
                  title="Cast current video to everyone"
                >
                  <Cast size={14} />
                  Cast
                </button>
              </div>

              <div className="h-6 w-[1px] bg-white/10" />

              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setIsVideoMode(!isVideoMode)}
                  className={`p-2.5 rounded-xl transition-all ${!isVideoMode ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                  title={isVideoMode ? "Audio Mode" : "Video Mode"}
                >
                  {isVideoMode ? <Video size={20} /> : <Music size={20} />}
                </button>
                
                {viewMode === 'home' && activeVideo && (
                  <button 
                    onClick={() => setViewMode('player')}
                    className="p-2.5 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-all"
                    title="Back to Player"
                  >
                    <Maximize2 size={20} />
                  </button>
                )}

                <button 
                  onClick={() => setIsCollapsed(true)}
                  className="p-2.5 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-all"
                >
                  <ChevronLeft size={20} />
                </button>
                
                <button 
                  onClick={leaveRoom}
                  className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </motion.nav>
          ) : (
            <motion.button 
              key="collapsed-nav"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsCollapsed(false)}
              className="w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/40 border-2 border-white/20 hover:bg-purple-500 transition-all"
            >
              <Users size={24} className="text-white" />
              <div className="absolute -top-1 -right-1 bg-white text-purple-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                {members.length}
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* --- MUSIC BAR (AUDIO MODE) --- */}
      <AnimatePresence>
        {!isVideoMode && viewMode === 'player' && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 h-24 bg-[#1a1a1a]/95 backdrop-blur-2xl border-t border-white/10 z-[50] px-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-4 w-1/3">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                <img 
                  src={`https://img.youtube.com/vi/${activeVideo?.id || 'dQw4w9WgXcQ'}/mqdefault.jpg`}
                  className="w-full h-full object-cover"
                  alt="Thumbnail"
                />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-sm font-bold truncate">
                  {activeVideo?.title || "SyncWave Audio"}
                </h4>
                <p className="text-xs text-white/40 truncate">
                  {activeVideo?.author || "YouTube"}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 w-1/3">
              <div className="flex items-center gap-6">
                <button onClick={() => {
                  if (isPlayerReady()) {
                    const time = playerRef.current.getCurrentTime();
                    playerRef.current.seekTo(time - 10, true);
                  }
                }} className="text-white/60 hover:text-white transition-colors">
                  <ChevronLeft size={24} />
                </button>
                <button 
                  onClick={() => {
                    if (isPlayerReady()) {
                      const state = playerRef.current.getPlayerState();
                      if (state === window.YT.PlayerState.PLAYING) playerRef.current.pauseVideo();
                      else playerRef.current.playVideo();
                    }
                  }}
                  className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                >
                  {playerStatus === window.YT.PlayerState.PLAYING ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" className="ml-1" />}
                </button>
                <button onClick={() => {
                  if (isPlayerReady()) {
                    const time = playerRef.current.getCurrentTime();
                    playerRef.current.seekTo(time + 10, true);
                  }
                }} className="text-white/60 hover:text-white transition-colors">
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 w-1/3">
              <div className="flex items-center gap-2 group">
                {volume === 0 ? <VolumeX size={18} className="text-white/40" /> : <Volume2 size={18} className="text-white/40" />}
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={volume}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setVolume(v);
                    playerRef.current?.setVolume(v);
                  }}
                  className="w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                />
              </div>
              <button 
                onClick={() => setIsVideoMode(true)}
                className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
                title="Back to Video"
              >
                <Video size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- SYNC STATUS INDICATOR --- */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-[10px] font-bold uppercase tracking-widest ${isSynced ? 'text-green-500' : 'text-white/40'}`}>
          <div className={`w-2 h-2 rounded-full ${isSynced ? 'bg-green-500 animate-pulse' : 'bg-white/20'}`} />
          {isSynced ? "Room Sync Active" : "Local Playback"}
        </div>
      </div>
    </div>
  );
}
