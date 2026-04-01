'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Users, User } from 'lucide-react';
import { motion } from 'motion/react';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { icon: <Home size={24} />, label: 'Home', href: '/dashboard' },
    { icon: <Search size={24} />, label: 'Search', href: '/search' },
    { icon: <Users size={24} />, label: 'Rooms', href: '/rooms' },
    { icon: <User size={24} />, label: 'Profile', href: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#0f0f0f]/80 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 px-6 py-3 pb-8 flex justify-between items-center z-50">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link key={item.href} href={item.href}>
            <motion.div
              whileTap={{ scale: 0.9 }}
              className={`flex flex-col items-center gap-1 ${
                isActive ? 'text-purple-600' : 'text-gray-400'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
              {isActive && (
                <motion.div 
                  layoutId="nav-dot"
                  className="w-1 h-1 bg-purple-600 rounded-full mt-0.5"
                />
              )}
            </motion.div>
          </Link>
        );
      })}
    </nav>
  );
}
