'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion } from 'motion/react';
import { User, AtSign, Camera, Loader2, Check, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function ProfileSetupPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('Other');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const router = useRouter();

  useEffect(() => {
    if (profile) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  const checkUsername = async (val: string) => {
    if (val.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    const userDoc = await getDoc(doc(db, `usernames/${val.toLowerCase()}`));
    if (userDoc.exists()) {
      setUsernameStatus('taken');
    } else {
      setUsernameStatus('available');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (username) checkUsername(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || usernameStatus !== 'available') return;
    setLoading(true);

    try {
      let photoURL = user.photoURL || '';
      if (image) {
        const imgRef = storageRef(storage, `profiles/${user.uid}`);
        await uploadBytes(imgRef, image);
        photoURL = await getDownloadURL(imgRef);
      }

      const userData = {
        fullName,
        username: username.toLowerCase(),
        gender,
        photoURL,
        uid: user.uid,
        createdAt: Date.now()
      };

      await setDoc(doc(db, `users/${user.uid}`), userData);
      await setDoc(doc(db, `usernames/${username.toLowerCase()}`), { uid: user.uid });
      
      await refreshProfile();
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white dark:bg-[#0f0f0f]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black">Complete Profile</h1>
          <p className="text-gray-500 mt-2">Tell us a bit about yourself</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <div className="relative w-24 h-24">
              <div className="w-full h-full rounded-3xl bg-gray-200 dark:bg-black overflow-hidden border-2 border-purple-600 flex items-center justify-center relative">
                {preview ? (
                  <Image 
                    src={preview} 
                    alt="Preview" 
                    fill 
                    className="object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User size={40} className="text-gray-400" />
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 p-2 bg-purple-600 text-white rounded-xl cursor-pointer shadow-lg">
                <Camera size={16} />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Full Name" 
                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="relative">
              <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Username" 
                className="w-full pl-12 pr-12 py-4 bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                required
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && <Loader2 className="animate-spin text-gray-400" size={20} />}
                {usernameStatus === 'available' && <Check className="text-green-500" size={20} />}
                {usernameStatus === 'taken' && <X className="text-red-500" size={20} />}
              </div>
            </div>

            <div className="flex gap-2">
              {['Male', 'Female', 'Other'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`flex-1 py-3 rounded-2xl border transition-all font-medium ${
                    gender === g 
                      ? 'bg-purple-600 text-white border-purple-600' 
                      : 'bg-white dark:bg-black border-gray-200 dark:border-gray-800 text-gray-500'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading || usernameStatus !== 'available' || !fullName}
            className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-purple-500/30"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Save Profile'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
