'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import ThemeToggle from '@/components/theme-toggle';
import { Music, Users, Gamepad2, ArrowRight, Puzzle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">S</div>
          <span className="text-2xl font-bold tracking-tight">SyncWave</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            Sync Your <span className="text-purple-600">Vibe</span> With Friends.
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
            Listen to music, watch videos, and hang out in real-time. No matter the distance, stay in sync.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-purple-600 text-white rounded-full font-bold text-lg flex items-center gap-2 shadow-lg shadow-purple-500/30"
              >
                Get Started <ArrowRight size={20} />
              </motion.button>
            </Link>
            <Link href="/extension">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white rounded-full font-bold text-lg flex items-center gap-2 border border-gray-200 dark:border-gray-800"
              >
                Browser Extension <Puzzle size={20} />
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full">
          <FeatureCard 
            icon={<Music className="text-purple-600" size={32} />}
            title="Music Sync"
            description="Real-time YouTube synchronization. Play, pause, and seek together."
          />
          <FeatureCard 
            icon={<Users className="text-purple-600" size={32} />}
            title="Friends"
            description="Invite your friends to your private rooms and chat while listening."
          />
          <FeatureCard 
            icon={<Gamepad2 className="text-purple-600" size={32} />}
            title="Games"
            description="Interactive features and mini-games coming soon to your rooms."
          />
        </div>

        {/* Brave Banner */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-20 p-4 bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-2xl text-orange-800 dark:text-orange-200 text-sm font-medium"
        >
          🚀 Install on Brave Browser for an ad-free YouTube experience!
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="p-8 text-center text-gray-500 text-sm">
        © 2026 SyncWave. Built for the vibe.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl text-left border border-gray-100 dark:border-gray-800"
    >
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </motion.div>
  );
}
