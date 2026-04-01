'use client';

import BottomNav from '@/components/bottom-nav';
import { Users } from 'lucide-react';

export default function RoomsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f0f] p-6">
      <h1 className="text-3xl font-black mb-6">Public Rooms</h1>
      <div className="text-center text-gray-500 mt-20">
        <Users size={48} className="mx-auto mb-4 opacity-20" />
        <p>No public rooms available right now.</p>
        <p className="text-sm">Create a private room to start syncing!</p>
      </div>
      <BottomNav />
    </div>
  );
}
