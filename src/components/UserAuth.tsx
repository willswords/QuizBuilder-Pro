import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { LogIn, LogOut, User as UserIcon, Shield, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';

export const UserAuth: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or create user profile in Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          // Create default profile for new user
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Anonymous User',
            email: firebaseUser.email || '',
            role: 'user'
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-2 bg-stone-100 rounded-xl animate-pulse">
        <Loader2 size={20} className="text-stone-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {user ? (
          <motion.div
            key="user-info"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-3"
          >
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 p-1.5 pl-3 bg-white border border-black/5 rounded-2xl hover:shadow-md transition-all group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-stone-900 leading-tight">
                  {profile?.displayName}
                </p>
                <div className="flex items-center justify-end gap-1">
                  {profile?.role === 'admin' && (
                    <Shield size={10} className="text-indigo-600" />
                  )}
                  <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">
                    {profile?.role}
                  </p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-indigo-100 border-2 border-white shadow-sm group-hover:border-indigo-100 transition-all">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-indigo-600">
                    <UserIcon size={20} />
                  </div>
                )}
              </div>
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsDropdownOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-black/5 p-2 z-50 overflow-hidden"
                  >
                    <div className="p-3 border-b border-black/5 mb-1">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Account</p>
                      <p className="text-sm font-medium text-stone-600 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium text-sm"
                    >
                      <LogOut size={18} />
                      Sign Out
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.button
            key="login-button"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={handleLogin}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold text-sm"
          >
            <LogIn size={18} />
            Sign In with Google
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
