'use client';

import { motion } from 'motion/react';
import { Download, Chrome, Puzzle, ArrowLeft, Terminal, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/theme-toggle';

export default function ExtensionPage() {
  const steps = [
    {
      title: "Download Source",
      description: "Download the extension folder from the AI Studio file explorer (SyncWave-Extension).",
      icon: <Download className="text-purple-600" size={24} />
    },
    {
      title: "Enable Developer Mode",
      description: "Open chrome://extensions (Chrome/Brave) or about:debugging (Firefox) and enable Developer Mode.",
      icon: <Terminal className="text-purple-600" size={24} />
    },
    {
      title: "Load Unpacked",
      description: "Click 'Load Unpacked' and select the folder you downloaded.",
      icon: <Puzzle className="text-purple-600" size={24} />
    },
    {
      title: "Start Syncing",
      description: "Open YouTube, join a room via the extension popup, and enjoy real-time sync!",
      icon: <CheckCircle2 className="text-purple-600" size={24} />
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-black text-black dark:text-white">
      <header className="p-4 flex justify-between items-center max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2 text-purple-600 font-bold">
          <ArrowLeft size={20} /> Back Home
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 max-w-4xl mx-auto p-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full text-sm font-bold mb-6">
            <Chrome size={16} /> Browser Extension
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">SyncWave Extension</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Take the SyncWave experience directly to YouTube. Sync videos, toggle audio mode, and manage rooms without leaving the player.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 flex gap-4"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-black rounded-2xl flex items-center justify-center shadow-sm">
                {step.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="bg-purple-600 rounded-3xl p-8 md:p-12 text-white text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-4">Ready to level up?</h2>
            <p className="text-purple-100 mb-8 max-w-md mx-auto">
              The extension files are already generated in your project folder. Just download them and follow the steps above.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="/syncwave-extension/README.md" 
                download 
                className="px-8 py-4 bg-white text-purple-600 rounded-full font-bold shadow-xl hover:scale-105 transition-transform"
              >
                Download Extension Files
              </a>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-400/20 rounded-full -ml-32 -mb-32 blur-3xl" />
        </div>
      </main>

      <footer className="p-8 text-center text-gray-500 text-sm">
        © 2026 SyncWave. Built for the vibe.
      </footer>
    </div>
  );
}
