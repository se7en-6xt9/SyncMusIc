'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, X, Play, Pause, SkipBack, SkipForward, 
  Volume2, VolumeX, Music, Users, LogOut, 
  RefreshCw, Radio, Monitor, Download, Chrome, 
  Github, ExternalLink, Info, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { rtdb, db } from '@/lib/firebase';
import { ref, onValue, update, off, get } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export default function RoomPage() {
  const { roomCode } = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  
  // Room State
  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Player State
  const [player, setPlayer] = useState<any>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMode, setIsAudioMode] = useState(false);
  const [playSyncEnabled, setPlaySyncEnabled] = useState(true);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');

  // UI State
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const playerRef = useRef<HTMLDivElement>(null);
  const lastSyncTime = useRef<number>(0);
  const isSeekingFromSync = useRef<boolean>(false);

  // 1. Initialize Room & Listeners
  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    
    // Listen for room data
    const unsubscribe = onValue(roomRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setError('Room not found');
        setLoading(false);
        return;
      }
      setRoom(data);
      
      // Fetch member profiles from Firestore
      if (data.members) {
        const memberIds = Object.keys(data.members);
        const memberProfiles = await Promise.all(
          memberIds.map(async (id) => {
            const docRef = doc(db, `users/${id}`);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id, ...docSnap.data() } : { id, username: 'Unknown' };
          })
        );
        setMembers(memberProfiles);
      }
      
      setLoading(false);
    });

    return () => {
      off(roomRef);
    };
  }, [roomCode]);

  // 2. Load YouTube API
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      console.log('YouTube API Ready');
    };

    return () => {
      // @ts-ignore
      delete window.onYouTubeIframeAPIReady;
    };
  }, []);

  const pushSync = useCallback(async (timestamp: number, playing: boolean, videoId?: string, title?: string, thumbnail?: string) => {
    if (!roomCode || !user) return;
    
    const syncRef = ref(rtdb, `rooms/${roomCode}/sync`);
    const updates: any = {
      timestamp,
      playing,
      syncedBy: user.uid,
      syncedAt: Date.now()
    };

    if (videoId) updates.videoId = videoId;
    if (title) updates.title = title;
    if (thumbnail) updates.thumbnail = thumbnail;

    await update(syncRef, updates);
  }, [roomCode, user]);

  // 3. Initialize Player when room video changes
  useEffect(() => {
    if (!room?.sync?.videoId || !window.YT || player) return;

    const initPlayer = () => {
      const newPlayer = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: room.sync.videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            setPlayer(event.target);
            setPlayerReady(true);
            setDuration(event.target.getDuration());
            if (room.sync.timestamp) {
              event.target.seekTo(room.sync.timestamp);
            }
            if (room.sync.playing) {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
            setIsPlaying(event.data === 1);
            
            // If user manually pauses/plays and PlaySync is ON, we might want to push sync
            // but we need to avoid loops.
            if (playSyncEnabled && !isSeekingFromSync.current) {
              if (event.data === 1 || event.data === 2) {
                pushSync(event.target.getCurrentTime(), event.data === 1);
              }
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const checkYT = setInterval(() => {
        if (window.YT && window.YT.Player) {
          initPlayer();
          clearInterval(checkYT);
        }
      }, 100);
    }
  }, [room?.sync?.videoId, player, playSyncEnabled, pushSync, room?.sync?.playing, room?.sync?.timestamp]);

  // 4. Handle Sync Updates from RTDB
  useEffect(() => {
    if (!playerReady || !player || !playSyncEnabled || !room?.sync) return;

    const sync = room.sync;
    
    // If video ID changed
    if (sync.videoId && sync.videoId !== player.getVideoData().video_id) {
      player.loadVideoById({
        videoId: sync.videoId,
        startSeconds: sync.timestamp || 0
      });
      return;
    }

    // Handle play/pause
    if (sync.playing !== undefined) {
      if (sync.playing && player.getPlayerState() !== 1) {
        player.playVideo();
      } else if (!sync.playing && player.getPlayerState() === 1) {
        player.pauseVideo();
      }
    }

    // Handle seek (if diff > 2 seconds)
    const currentPos = player.getCurrentTime();
    const diff = Math.abs(currentPos - sync.timestamp);
    if (diff > 2) {
      isSeekingFromSync.current = true;
      player.seekTo(sync.timestamp);
      setTimeout(() => { isSeekingFromSync.current = false; }, 500);
    }

  }, [room?.sync, playerReady, playSyncEnabled, player]);

  // 5. Progress Tracker
  useEffect(() => {
    if (!playerReady || !player) return;

    const interval = setInterval(() => {
      setCurrentTime(player.getCurrentTime());
      if (duration === 0) setDuration(player.getDuration());
    }, 500);

    return () => clearInterval(interval);
  }, [playerReady, player, duration]);

  // 6. Search Logic
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube/suggestions?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSuggestions(data);
      } catch (err) {
        console.error('Suggestions error:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setSearchError('');
    setShowSuggestions(false);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error === 'quotaExceeded') {
        setSearchError('Search limit reached. Please paste a YouTube link below.');
      } else {
        setSearchResults(data.items || []);
      }
    } catch (err) {
      setSearchError('Failed to search. Try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLinkPaste = (url: string) => {
    setYoutubeLink(url);
    const videoId = extractVideoId(url);
    if (videoId) {
      loadVideo(videoId);
    } else if (url.trim() !== '') {
      showToast('Invalid YouTube link', 'error');
    }
  };

  const extractVideoId = (url: string) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const loadVideo = async (videoId: string, title?: string, thumbnail?: string) => {
    if (!user) return;
    
    // If PlaySync is ON, we push to Firebase
    if (playSyncEnabled) {
      await pushSync(0, true, videoId, title, thumbnail);
      showToast('Synced new video!', 'success');
    } else {
      // Local mode
      if (player) {
        player.loadVideoById(videoId);
      }
      showToast('Loaded locally (Sync is OFF)', 'info');
    }
    setSearchResults([]);
    setSearchQuery('');
  };

  const togglePlay = () => {
    if (!player) return;
    const newState = !isPlaying;
    if (playSyncEnabled) {
      pushSync(player.getCurrentTime(), newState);
    } else {
      newState ? player.playVideo() : player.pauseVideo();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (player) {
      player.seekTo(time);
      if (playSyncEnabled) {
        pushSync(time, isPlaying);
      }
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setVolume(val);
    if (player) {
      player.setVolume(val);
      if (val === 0) setIsMuted(true);
      else setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!player) return;
    if (isMuted) {
      player.unMute();
      player.setVolume(volume || 50);
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const leaveRoom = async () => {
    if (!user || !roomCode) return;
    // Optional: remove self from members
    router.push('/dashboard');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h > 0 ? h : null, m, s]
      .filter(x => x !== null)
      .map(x => x!.toString().padStart(2, '0'))
      .join(':');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6 text-center">
        <AlertCircle size={64} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">{error}</h1>
        <button onClick={() => router.push('/dashboard')} className="px-6 py-3 bg-purple-600 rounded-xl font-bold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="p-4 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/5 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-xs font-black tracking-widest border border-purple-600/30">
            ROOM: {roomCode}
          </div>
          <div className="flex -space-x-2">
            {members.map((m, i) => (
              <div key={m.id} className="w-8 h-8 rounded-full border-2 border-black bg-gray-800 overflow-hidden relative" title={m.fullName}>
                {m.photoURL ? (
                  <Image src={m.photoURL} alt={m.username} fill className="object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold">
                    {m.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowExtensionModal(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold transition-colors"
          >
            <Download size={14} /> Extension
          </button>
          <button onClick={leaveRoom} className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full transition-all">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Player & Search */}
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          {/* Search Section */}
          <div className="p-4 space-y-4">
            <div className="relative max-w-2xl mx-auto">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Search YouTube..." 
                  className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all text-lg"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch(searchQuery);
                    if (e.key === 'Escape') setShowSuggestions(false);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden"
                  >
                    {suggestions.map((s, i) => (
                      <button 
                        key={i}
                        onClick={() => {
                          setSearchQuery(s);
                          handleSearch(s);
                        }}
                        className="w-full px-6 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3"
                      >
                        <Search size={16} className="text-gray-500" />
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Fallback Link Paste */}
            <div className="max-w-2xl mx-auto flex gap-2">
              <input 
                type="text" 
                placeholder="Or paste YouTube link..." 
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-600"
                value={youtubeLink}
                onChange={(e) => handleLinkPaste(e.target.value)}
              />
            </div>
          </div>

          {/* Player Container */}
          <div className="px-4 pb-4 flex-1 flex flex-col">
            <div className={`relative aspect-video w-full max-w-4xl mx-auto bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/5 ${isAudioMode ? 'h-0 opacity-0 pointer-events-none' : ''}`}>
              <div id="youtube-player" className="w-full h-full" />
              {!room?.sync?.videoId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-[#050505]">
                  <Music size={64} className="mb-4 opacity-20" />
                  <p className="font-bold">Search for a video to start syncing</p>
                </div>
              )}
            </div>

            {/* Audio Mode Visualizer */}
            {isAudioMode && room?.sync?.videoId && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-purple-900/20 to-black rounded-3xl border border-white/5">
                <div className="w-48 h-48 rounded-[3rem] bg-purple-600 shadow-2xl shadow-purple-500/40 flex items-center justify-center relative overflow-hidden mb-8">
                  {room.sync.thumbnail ? (
                    <Image src={room.sync.thumbnail} alt="Thumbnail" fill className="object-cover opacity-50 blur-sm" />
                  ) : (
                    <Music size={64} className="text-white" />
                  )}
                  <div className="relative z-10 flex items-end gap-1 h-12">
                    {[1, 2, 3, 4, 5].map(i => (
                      <motion.div 
                        key={i}
                        animate={{ height: isPlaying ? [10, 40, 15, 35, 10] : 10 }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                        className="w-2 bg-white rounded-full"
                      />
                    ))}
                  </div>
                </div>
                <h2 className="text-2xl font-black text-center max-w-md line-clamp-2 mb-2">
                  {room.sync.title || 'Unknown Track'}
                </h2>
                <p className="text-purple-400 font-bold uppercase tracking-widest text-xs">Audio Mode Active</p>
              </div>
            )}

            {/* Custom Controls */}
            <div className="max-w-4xl w-full mx-auto mt-6 bg-white/5 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-xl">
              {/* Progress Bar */}
              <div className="space-y-2 mb-6">
                <input 
                  type="range" 
                  min={0} 
                  max={duration || 100} 
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-[10px] font-black text-gray-500 tracking-widest">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <button className="p-2 text-gray-400 hover:text-white transition-colors"><SkipBack size={24} /></button>
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={togglePlay}
                    className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-xl"
                  >
                    {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                  </motion.button>
                  <button className="p-2 text-gray-400 hover:text-white transition-colors"><SkipForward size={24} /></button>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-2xl border border-white/5">
                    <button onClick={toggleMute} className="text-gray-400 hover:text-white">
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                    <input 
                      type="range" 
                      min={0} 
                      max={100} 
                      value={volume}
                      onChange={handleVolume}
                      className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsAudioMode(!isAudioMode)}
                      className={`p-3 rounded-2xl border transition-all ${isAudioMode ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                      title="Toggle Audio Mode"
                    >
                      <Radio size={20} />
                    </button>
                    <button 
                      onClick={() => setPlaySyncEnabled(!playSyncEnabled)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-2xl border font-black text-xs tracking-widest transition-all ${playSyncEnabled ? 'bg-green-500/20 border-green-500/50 text-green-400 shadow-lg shadow-green-500/10' : 'bg-white/5 border-white/10 text-gray-400'}`}
                    >
                      <RefreshCw size={16} className={playSyncEnabled ? 'animate-spin-slow' : ''} />
                      {playSyncEnabled ? 'SYNC ON' : 'LOCAL'}
                    </button>
                    <button 
                      onClick={() => pushSync(player?.getCurrentTime() || 0, isPlaying)}
                      className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl shadow-lg shadow-purple-500/20 transition-all"
                      title="Force Sync to Others"
                    >
                      <Monitor size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search Results Grid */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {isSearching && [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="aspect-video bg-white/5 rounded-2xl animate-pulse" />
            ))}
            {searchError && (
              <div className="col-span-full p-8 text-center bg-red-500/10 border border-red-500/20 rounded-3xl">
                <AlertCircle className="mx-auto text-red-500 mb-2" />
                <p className="text-red-400 font-bold">{searchError}</p>
              </div>
            )}
            {searchResults.map((video) => (
              <motion.button
                key={video.id.videoId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                onClick={() => loadVideo(video.id.videoId, video.snippet.title, video.snippet.thumbnails.high.url)}
                className="group text-left bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-purple-500/50 transition-all"
              >
                <div className="aspect-video relative overflow-hidden">
                  <Image 
                    src={video.snippet.thumbnails.high.url} 
                    alt={video.snippet.title} 
                    fill 
                    className="object-cover group-hover:scale-105 transition-transform duration-500" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={40} fill="white" className="text-white" />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-sm line-clamp-2 mb-1 group-hover:text-purple-400 transition-colors" dangerouslySetInnerHTML={{ __html: video.snippet.title }} />
                  <p className="text-xs text-gray-500">{video.snippet.channelTitle}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </main>

      {/* Extension Modal */}
      <AnimatePresence>
        {showExtensionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExtensionModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
            >
              <button onClick={() => setShowExtensionModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white">
                <X size={24} />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4">
                  <Download size={32} />
                </div>
                <h2 className="text-3xl font-black mb-2">Get SyncWave Extension</h2>
                <p className="text-gray-500">Ad-free YouTube + Better Sync Experience</p>
              </div>

              <div className="grid grid-cols-1 gap-4 mb-8">
                <a href="#chrome-store" target="_blank" className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
                      <Chrome size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold">Chrome / Brave</h4>
                      <p className="text-xs text-gray-500">Official Web Store</p>
                    </div>
                  </div>
                  <ExternalLink size={18} className="text-gray-600 group-hover:text-white transition-colors" />
                </a>

                <a href="#firefox-store" target="_blank" className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center">
                      <Monitor size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold">Firefox</h4>
                      <p className="text-xs text-gray-500">Add-ons Store</p>
                    </div>
                  </div>
                  <ExternalLink size={18} className="text-gray-600 group-hover:text-white transition-colors" />
                </a>

                <a href="#github-release" target="_blank" className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-500/20 text-gray-400 rounded-xl flex items-center justify-center">
                      <Github size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold">Manual Install (ZIP)</h4>
                      <p className="text-xs text-gray-500">GitHub Releases</p>
                    </div>
                  </div>
                  <Download size={18} className="text-gray-600 group-hover:text-white transition-colors" />
                </a>
              </div>

              <div className="p-4 bg-purple-600/10 border border-purple-600/20 rounded-2xl flex gap-3">
                <Info className="text-purple-500 shrink-0" size={20} />
                <p className="text-xs text-purple-200 leading-relaxed">
                  <strong>Pro Tip:</strong> Firefox Android users can install the ZIP directly via &quot;Install Add-on&quot; in settings for mobile sync!
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: 50 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 50, x: 50 }}
            className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
              toast.type === 'success' ? 'bg-green-600 border-green-500' : 
              toast.type === 'error' ? 'bg-red-600 border-red-500' : 
              'bg-purple-600 border-purple-500'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : 
             toast.type === 'error' ? <AlertCircle size={20} /> : 
             <Info size={20} />}
            <span className="font-bold text-sm">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
