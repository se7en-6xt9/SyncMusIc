'use client';

import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import BottomNav from '@/components/bottom-nav';
import { Settings, LogOut, Shield, Bell, HelpCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { motion } from 'motion/react';

export default function ProfilePage() {
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f0f] pb-32">
      <div className="p-8 flex flex-col items-center text-center">
        <div className="w-32 h-32 rounded-[2.5rem] bg-purple-600 overflow-hidden border-4 border-purple-600 shadow-2xl mb-6 relative">
          {profile.photoURL ? (
            <Image 
              src={profile.photoURL} 
              alt="Profile" 
              fill 
              className="object-cover" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-4xl font-black">
              {profile.username[0].toUpperCase()}
            </div>
          )}
        </div>
        <h1 className="text-3xl font-black">{profile.fullName}</h1>
        <p className="text-purple-600 font-bold">@{profile.username}</p>
      </div>

      <div className="px-6 space-y-2">
        <ProfileItem icon={<Settings size={20} />} label="Account Settings" />
        <ProfileItem icon={<Bell size={20} />} label="Notifications" />
        <ProfileItem icon={<Shield size={20} />} label="Privacy & Security" />
        <ProfileItem icon={<HelpCircle size={20} />} label="Help & Support" />
        <button 
          onClick={() => auth.signOut()}
          className="w-full p-5 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-3xl flex items-center gap-4 mt-8 font-bold"
        >
          <LogOut size={20} /> Sign Out
        </button>
      </div>

      <BottomNav />
    </div>
  );
}

function ProfileItem({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <motion.button
      whileHover={{ x: 5 }}
      className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-3xl flex items-center justify-between border border-gray-100 dark:border-gray-800"
    >
      <div className="flex items-center gap-4">
        <div className="text-gray-400">{icon}</div>
        <span className="font-bold">{label}</span>
      </div>
      <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-black flex items-center justify-center text-gray-400">
        <ChevronRight size={16} />
      </div>
    </motion.button>
  );
}

function ChevronRight({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  );
}
