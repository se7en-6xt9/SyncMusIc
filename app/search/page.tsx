'use client';

import BottomNav from '@/components/bottom-nav';
import { Search as SearchIcon } from 'lucide-react';

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f0f] p-6">
      <h1 className="text-3xl font-black mb-6">Search</h1>
      <div className="relative mb-8">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search rooms or friends..." 
          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
        />
      </div>
      <div className="text-center text-gray-500 mt-20">
        <p>Search functionality coming soon!</p>
      </div>
      <BottomNav />
    </div>
  );
}
