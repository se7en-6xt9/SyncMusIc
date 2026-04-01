'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Plus, LogIn, Music, LogOut, Settings, Play, Pause } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import BottomNav from '@/components/bottom-nav';
import ThemeToggle from '@/components/theme-toggle';

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  const createRoom = async () => {
    if (!user) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const roomRef = doc(db, `rooms/${code}`);
    
    const roomData = {
      id: code,
      owner: user.uid,
      createdAt: Date.now(),
      members: { [user.uid]: true },
      state: {
        playing: false,
        timestamp: 0,
        videoId: '',
        updatedBy: user.uid,
        lastUpdate: Date.now()
      }
    };

    await setDoc(roomRef, roomData);
    router.push(`/room/${code}`);
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length !== 6) return;
    
    const roomRef = doc(db, `rooms/${roomCode}`);
    const roomDoc = await getDoc(roomRef);
    
    if (roomDoc.exists()) {
      const room = roomDoc.data();
      const members = room.members || {};
      const memberCount = Object.keys(members).length;
      
      if (memberCount >= 2 && !members[user!.uid]) {
        setError('Room is full (max 2 members)');
        return;
      }

      await updateDoc(roomRef, {
        [`members.${user!.uid}`]: true
      });
      router.push(`/room/${roomCode}`);
    } else {
      setError('Invalid room code');
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0f0f0f]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f0f] pb-32">
      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-white/50 dark:bg-[#0f0f0f]/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 overflow-hidden border-2 border-purple-600 flex items-center justify-center relative">
            {profile.photoURL ? (
              <Image 
                src={profile.photoURL} 
                alt="Profile" 
                fill 
                className="object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-white font-bold text-xl">{profile.username[0].toUpperCase()}</span>
            )}
          </div>
          <div>
            <h2 className="font-black text-lg leading-none">{profile.fullName}</h2>
            <p className="text-gray-500 text-sm">@{profile.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => auth.signOut()} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-8">
        {/* Now Playing Placeholder */}
        <section className="bg-purple-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-purple-500/30 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-purple-200 uppercase text-xs font-black tracking-widest mb-4">Now Playing</h3>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white/20 rounded-3xl backdrop-blur-md flex items-center justify-center">
                <Music size={32} />
              </div>
              <div>
                <h4 className="text-2xl font-black mb-1">No active room</h4>
                <p className="text-purple-200 text-sm">Create or join a room to sync music</p>
              </div>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        </section>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={createRoom}
            className="p-6 bg-gray-50 dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 flex flex-col items-center gap-3 text-center"
          >
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-2xl flex items-center justify-center">
              <Plus size={24} />
            </div>
            <div>
              <h4 className="font-bold text-lg">Create Room</h4>
              <p className="text-gray-500 text-sm">Start a new sync session</p>
            </div>
          </motion.button>

          <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center">
              <LogIn size={24} />
            </div>
            <form onSubmit={joinRoom} className="w-full">
              <h4 className="font-bold text-lg mb-2">Join Room</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="6-digit code" 
                  maxLength={6}
                  className="w-full px-4 py-2 bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 text-center font-mono text-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, ''))}
                />
                <button 
                  type="submit"
                  className="p-2 bg-purple-600 text-white rounded-xl"
                >
                  <ArrowRight size={20} />
                </button>
              </div>
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </form>
          </div>
        </div>

        {/* Recent Rooms placeholder */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-black">Recent Activity</h3>
            <button className="text-purple-600 text-sm font-bold">View All</button>
          </div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-black rounded-xl flex items-center justify-center">
                    <Music size={20} className="text-gray-400" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm">Room Session #{i}</h5>
                    <p className="text-gray-500 text-xs">2 days ago • 45 mins</p>
                  </div>
                </div>
                <Settings size={16} className="text-gray-400" />
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

function ArrowRight({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  );
}
