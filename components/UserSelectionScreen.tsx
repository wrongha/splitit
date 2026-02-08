
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { UserProfile } from '../types';
import { Loader2, Plus, ArrowLeft, Globe } from 'lucide-react';
import { COLOR_MAP, getParticipantTheme } from './TripDetails';

interface UserSelectionScreenProps {
  onSelectUser: (user: UserProfile) => void;
}

export const UserSelectionScreen: React.FC<UserSelectionScreenProps> = ({ onSelectUser }) => {
  const [loading, setLoading] = useState(true);
  const [existingUsers, setExistingUsers] = useState<UserProfile[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('participants')
      .select('name, mascot, color');

    if (data) {
      const userMap = new Map<string, UserProfile>();
      data.forEach((p: any) => {
        const normalizedName = p.name.trim();
        if (!userMap.has(normalizedName)) {
          userMap.set(normalizedName, {
            name: normalizedName,
            mascot: p.mascot || '👤',
            color: p.color || 'indigo'
          });
        }
      });
      setExistingUsers(Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    }
    setLoading(false);
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    const keys = Object.keys(COLOR_MAP);
    const randomColor = keys[Math.floor(Math.random() * keys.length)];
    
    onSelectUser({
      name: newName.trim(),
      mascot: '🐣', // Default new user mascot
      color: randomColor
    });
  };

  const handleGuestAccess = () => {
    onSelectUser({
      name: 'Guest',
      mascot: '👀',
      color: 'slate'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Loader2 className="animate-spin text-red-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center p-4 animate-in fade-in duration-700">
      
      {/* Creation Mode */}
      {isCreating ? (
        <div className="w-full max-w-md animate-in zoom-in-95 duration-300">
          <h2 className="text-3xl font-medium text-white text-center mb-2">Add Profile</h2>
          <p className="text-gray-400 text-center mb-8 text-sm">Add a profile for another person.</p>
          
          <form onSubmit={handleCreateNew} className="flex flex-col gap-6">
            <div className="flex items-center gap-4 bg-[#333] p-4 rounded-lg">
              <div className="w-16 h-16 rounded-md bg-indigo-600 flex items-center justify-center text-3xl">
                🐣
              </div>
              <input 
                autoFocus
                type="text" 
                placeholder="Name" 
                className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder:text-gray-500 font-medium"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="submit"
                disabled={!newName.trim()}
                className="flex-1 bg-white text-black hover:bg-red-600 hover:text-white font-bold py-3 px-6 text-sm uppercase tracking-widest transition-colors"
              >
                Save
              </button>
              <button 
                type="button"
                onClick={() => { setIsCreating(false); setNewName(''); }}
                className="flex-1 border border-gray-500 text-gray-500 hover:border-white hover:text-white font-bold py-3 px-6 text-sm uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Selection Mode */
        <div className="flex flex-col items-center">
          <h1 className="text-3xl md:text-5xl font-medium text-white mb-12 tracking-tight drop-shadow-lg">Who's traveling?</h1>
          
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 max-w-5xl">
            {/* Existing Profiles */}
            {existingUsers.map((user) => {
              const theme = getParticipantTheme(user.color);
              return (
                <button
                  key={user.name}
                  onClick={() => onSelectUser(user)}
                  className="group flex flex-col items-center gap-3 w-24 md:w-32 active:scale-95 transition-transform duration-200"
                >
                  <div className={`w-24 h-24 md:w-32 md:h-32 rounded-full ${theme.bg} flex items-center justify-center text-5xl md:text-6xl shadow-2xl group-hover:ring-4 ring-white transition-all duration-200 overflow-hidden relative`}>
                    <span className="group-hover:scale-110 transition-transform duration-300">{user.mascot}</span>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                  </div>
                  <span className="text-gray-400 group-hover:text-white font-medium text-sm md:text-lg transition-colors truncate w-full text-center">
                    {user.name}
                  </span>
                </button>
              );
            })}

            {/* Add Profile Button */}
            <button
              onClick={() => setIsCreating(true)}
              className="group flex flex-col items-center gap-3 w-24 md:w-32 active:scale-95 transition-transform duration-200"
            >
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-[#141414] border-2 border-[#333] flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-black group-hover:border-white transition-all duration-200">
                <Plus size={48} />
              </div>
              <span className="text-gray-400 group-hover:text-white font-medium text-sm md:text-lg transition-colors">
                Add Profile
              </span>
            </button>
          </div>

          {/* Browse Action */}
          <button 
            onClick={handleGuestAccess}
            className="mt-16 px-8 py-2 border border-gray-500 text-gray-500 hover:border-white hover:text-white transition-all uppercase tracking-widest text-xs font-bold"
          >
            Browse All Trips
          </button>
        </div>
      )}
    </div>
  );
};
