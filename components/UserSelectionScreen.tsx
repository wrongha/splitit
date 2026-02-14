
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { UserProfile, Trip, Currency } from '../types';
import { Loader2, Plus, ArrowLeft, Check, ChevronRight, Search, MapPin, AlertCircle, LogOut, Edit2, Trash2, X, Settings2, UserCog, Info, AlertTriangle, Eye, Globe } from 'lucide-react';
import { COLOR_MAP, getParticipantTheme, MASCOTS } from './TripDetails';
import { AddTripModal } from './AddTripModal';

interface UserSelectionScreenProps {
  onSelectUser: (user: UserProfile) => void;
  allCurrencies: Currency[];
}

interface TripWithParticipants extends Trip {
  participants: { user_id: string | null; name: string }[];
}

type Step = 'select-profile' | 'enter-name' | 'choose-mascot' | 'post-login';
type DeleteStatus = 'idle' | 'confirming' | 'deleting' | 'success' | 'error';

export const UserSelectionScreen: React.FC<UserSelectionScreenProps> = ({ onSelectUser, allCurrencies }) => {
  const [loading, setLoading] = useState(true);
  const [existingUsers, setExistingUsers] = useState<UserProfile[]>([]);
  const [allTrips, setAllTrips] = useState<TripWithParticipants[]>([]);
  const [step, setStep] = useState<Step>('select-profile');
  const [dbError, setDbError] = useState<string | null>(null);
  const [isAddTripModalOpen, setIsAddTripModalOpen] = useState(false);
  
  // View State
  const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine');
  
  // Create/Edit Profile State
  const [newName, setNewName] = useState('');
  const [selectedMascot, setSelectedMascot] = useState(MASCOTS[0]);
  const [isNameUnique, setIsNameUnique] = useState<boolean | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [tripSearch, setTripSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Involvement State
  const [isInvolvedInTrips, setIsInvolvedInTrips] = useState<boolean>(false);
  const [checkingInvolvement, setCheckingInvolvement] = useState<boolean>(false);
  
  // Delete State
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>('idle');
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Determine default view mode when user logs in
  useEffect(() => {
    if (currentUser && step === 'post-login' && allTrips.length > 0) {
      const hasTrips = allTrips.some(t => 
        t.participants?.some(p => 
          (p.user_id && p.user_id === currentUser.id) || 
          (p.name.toLowerCase() === currentUser.name.toLowerCase())
        )
      );
      setViewMode(hasTrips ? 'mine' : 'all');
    }
  }, [currentUser, step, allTrips]);

  const fetchInitialData = async () => {
    setLoading(true);
    setDbError(null);
    try {
      const { data: users, error: userError } = await supabase.from('users').select('*').order('name');
      
      if (userError) {
        if (userError.message.includes("public.users")) {
          setDbError("The 'users' table is missing. Please apply the SQL migration script in your Supabase SQL Editor to continue.");
        } else {
          setDbError(userError.message);
        }
      } else {
        setExistingUsers(users || []);
      }
      
      const { data: trips } = await supabase
        .from('trips')
        .select('*, participants(user_id, name)')
        .eq('is_archived', false)
        .order('updated_at', { ascending: false });
        
      if (trips) setAllTrips(trips as any);
    } catch (err: any) {
      setDbError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkInvolvement = async (user: UserProfile) => {
    if (!user.id) return;
    setCheckingInvolvement(true);
    setIsInvolvedInTrips(false);
    setDeleteStatus('idle');
    setDeleteErrorMessage(null);
    
    try {
      const [{ data: byId }, { data: byName }, { data: asOwner }] = await Promise.all([
        supabase.from('participants').select('trip_id').eq('user_id', user.id).limit(1),
        supabase.from('participants').select('trip_id').ilike('name', user.name).limit(1),
        supabase.from('trips').select('id').eq('owner_id', user.id).limit(1)
      ]);

      const active = (byId && byId.length > 0) || (byName && byName.length > 0) || (asOwner && asOwner.length > 0);
      setIsInvolvedInTrips(active);
    } catch (e) {
      console.error("Involvement check failed", e);
    } finally {
      setCheckingInvolvement(false);
    }
  };

  const handleProfileSelect = (user: UserProfile) => {
    setCurrentUser(user);
    setStep('post-login');
    checkInvolvement(user);
  };

  const initiateDelete = () => {
    if (isInvolvedInTrips) return;
    setDeleteStatus('confirming');
  };

  const cancelDelete = () => {
    setDeleteStatus('idle');
    setDeleteErrorMessage(null);
  };

  const executeDelete = async () => {
    if (!currentUser?.id) {
      setDeleteStatus('error');
      setDeleteErrorMessage("User ID missing. Refresh app.");
      return;
    }

    setDeleteStatus('deleting');
    setDeleteErrorMessage(null);

    try {
      const { data: participation } = await supabase
        .from('participants')
        .select('id')
        .eq('user_id', currentUser.id)
        .limit(1);

      if (participation && participation.length > 0) {
        throw new Error("Active trip participation detected. Cannot delete.");
      }

      const { data: ownership } = await supabase
        .from('trips')
        .select('id')
        .eq('owner_id', currentUser.id)
        .limit(1);

      if (ownership && ownership.length > 0) {
        throw new Error("User owns active trips. Cannot delete.");
      }

      const { error } = await supabase.from('users').delete().eq('id', currentUser.id);
      
      if (error) throw error;

      setDeleteStatus('success');
      
      setTimeout(() => {
        setExistingUsers(prev => prev.filter(u => u.id !== currentUser.id));
        setStep('select-profile');
        setCurrentUser(null);
        setDeleteStatus('idle');
      }, 1500);

    } catch (err: any) {
      console.error("Delete failed:", err);
      setDeleteStatus('error');
      setDeleteErrorMessage(err.message || "Delete failed. Check console.");
    }
  };

  const checkNameUniqueness = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || (isEditing && currentUser && trimmed.toLowerCase() === currentUser.name.toLowerCase())) {
      setIsNameUnique(true);
      return;
    }
    setCheckingName(true);
    try {
      const { data } = await supabase.from('users').select('id').ilike('name', trimmed).maybeSingle();
      setIsNameUnique(!data);
    } catch (e) {
      setIsNameUnique(null);
    } finally {
      setCheckingName(false);
    }
  };

  const handleStartRevision = () => {
    if (!currentUser) return;
    setIsEditing(true);
    setNewName(currentUser.name);
    setSelectedMascot(currentUser.mascot);
    setIsNameUnique(true);
    setStep('enter-name');
  };

  const handleCreateOrUpdateProfile = async () => {
    if (!newName.trim() || !isNameUnique) return;
    setLoading(true);
    
    try {
      if (isEditing && currentUser?.id) {
        const { data, error } = await supabase.from('users')
          .update({
            name: newName.trim(),
            mascot: selectedMascot
          })
          .eq('id', currentUser.id)
          .select()
          .single();
        
        if (error) throw error;
        setCurrentUser(data);
      } else {
        const colorKeys = Object.keys(COLOR_MAP);
        const randomColor = colorKeys[Math.floor(Math.random() * colorKeys.length)];
        const { data, error } = await supabase.from('users').insert([{
          name: newName.trim(),
          mascot: selectedMascot,
          color: randomColor
        }]).select().single();

        if (error) throw error;
        setCurrentUser(data);
      }
      setStep('post-login');
      setIsEditing(false);
      fetchInitialData();
    } catch (err: any) {
      alert("Failed to save profile: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrips = useMemo(() => {
    let trips = allTrips;

    // Filter by ownership/participation if in 'mine' mode
    if (viewMode === 'mine' && currentUser) {
      trips = trips.filter(t => 
        t.participants?.some(p => 
          (p.user_id && p.user_id === currentUser.id) || 
          (p.name.toLowerCase() === currentUser.name.toLowerCase())
        )
      );
    }

    return trips.filter(t => t.name.toLowerCase().includes(tripSearch.toLowerCase()));
  }, [allTrips, tripSearch, viewMode, currentUser]);

  if (loading && step === 'select-profile') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        </div>
        <span className="text-indigo-400 text-xs font-black uppercase tracking-[0.3em] animate-pulse">Establishing Connection</span>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 max-w-md shadow-2xl backdrop-blur-xl">
          <AlertCircle className="text-red-500 mx-auto mb-6" size={48} />
          <h2 className="text-white text-2xl font-black mb-4 tracking-tight">Sync Failure</h2>
          <p className="text-slate-400 text-sm font-bold mb-8 opacity-60 uppercase tracking-tight">{dbError}</p>
          <button onClick={fetchInitialData} className="w-full bg-white text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Retry Sync</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 transition-all duration-700 overflow-hidden selection:bg-indigo-500 selection:text-white">
      
      {step === 'select-profile' && (
        <div className="w-full max-w-6xl animate-in fade-in zoom-in-95 duration-700 flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-20 tracking-tighter drop-shadow-2xl text-center">Who's traveling?</h1>
          <div className="flex flex-wrap justify-center gap-8 md:gap-14 w-full">
            {existingUsers.map((user) => {
              const theme = getParticipantTheme(user.color);
              return (
                <div key={user.name} className="relative group/card">
                  <button 
                    onClick={() => handleProfileSelect(user)} 
                    className="group/btn flex flex-col items-center gap-5 w-24 md:w-40 active:scale-95 transition-all duration-300"
                  >
                    <div className={`w-24 h-24 md:w-40 md:h-40 rounded-3xl ${theme.bg} flex items-center justify-center text-5xl md:text-8xl shadow-2xl group-hover/btn:ring-[8px] ring-white/30 group-hover/btn:rounded-[2.5rem] transition-all duration-500 overflow-hidden relative`}>
                      <span className="group-hover/btn:scale-110 group-hover/btn:rotate-6 transition-transform duration-500 z-10">{user.mascot}</span>
                      <div className="absolute inset-0 bg-black/10 group-hover/btn:bg-transparent transition-colors" />
                    </div>
                    <span className="text-slate-500 group-hover/btn:text-white font-black text-xs md:text-lg transition-colors uppercase tracking-widest truncate w-full text-center px-1">{user.name}</span>
                  </button>
                </div>
              );
            })}
            <button 
              onClick={() => { setIsEditing(false); setNewName(''); setSelectedMascot(MASCOTS[0]); setStep('enter-name'); }} 
              className="group flex flex-col items-center gap-5 w-24 md:w-40 active:scale-90 transition-all"
            >
              <div className="w-24 h-24 md:w-40 md:h-40 rounded-3xl bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center text-white/20 group-hover:bg-white group-hover:text-black group-hover:border-solid group-hover:border-white group-hover:rounded-[2.5rem] transition-all duration-500">
                <Plus size={56} strokeWidth={3} />
              </div>
              <span className="text-slate-600 group-hover:text-white font-black text-xs md:text-lg uppercase tracking-widest transition-colors">New Pilot</span>
            </button>
          </div>
        </div>
      )}

      {step === 'enter-name' && (
        <div className="w-full max-w-md animate-in slide-in-from-right-12 duration-500">
          <button onClick={() => isEditing ? setStep('post-login') : setStep('select-profile')} className="mb-10 text-white/40 hover:text-white flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-colors group"><ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Cancel</button>
          <h2 className="text-5xl font-black text-white mb-3 tracking-tighter">{isEditing ? 'Revise ID' : 'Identity Core'}</h2>
          <p className="text-white/30 font-bold mb-14 text-xs uppercase tracking-[0.2em]">Unique identity required</p>
          <div className="relative">
            <input 
              autoFocus type="text" placeholder="Unique Name"
              className={`w-full bg-transparent border-b-4 py-6 px-1 outline-none text-white text-4xl font-black placeholder:text-white/5 transition-all ${isNameUnique === true ? 'border-emerald-500' : isNameUnique === false ? 'border-rose-500' : 'border-white/10 focus:border-indigo-500'}`}
              value={newName} 
              onChange={(e) => { setNewName(e.target.value); setIsNameUnique(null); }}
              onBlur={() => checkNameUniqueness(newName)}
            />
            {checkingName && <Loader2 className="absolute right-2 top-8 animate-spin text-white/20" size={28} />}
          </div>
          <button 
            disabled={!newName.trim() || isNameUnique !== true || checkingName}
            onClick={() => setStep('choose-mascot')}
            className="w-full bg-white text-black py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] mt-16 disabled:bg-white/5 disabled:text-white/10 transition-all active:scale-95 shadow-2xl hover:bg-slate-100 flex items-center justify-center gap-3"
          >
            Assign Mascot <ChevronRight size={18} strokeWidth={3} />
          </button>
        </div>
      )}

      {step === 'choose-mascot' && (
        <div className="w-full max-w-xl animate-in slide-in-from-right-12 duration-500">
          <button onClick={() => setStep('enter-name')} className="mb-10 text-white/40 hover:text-white flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-colors"><ArrowLeft size={16} /> Back</button>
          <h2 className="text-5xl font-black text-white mb-3 tracking-tighter">Avatar Selection</h2>
          <p className="text-white/30 font-bold mb-14 text-xs uppercase tracking-[0.2em]">Choose your digital face</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
            {MASCOTS.map(m => (
              <button key={m} onClick={() => setSelectedMascot(m)} className={`w-full aspect-square rounded-[1.5rem] flex items-center justify-center text-4xl transition-all duration-300 ${selectedMascot === m ? 'bg-white shadow-[0_0_40px_rgba(255,255,255,0.2)] scale-110 rounded-[2rem] z-10' : 'bg-white/5 hover:bg-white/10 grayscale opacity-40 hover:opacity-100 hover:grayscale-0'}`}>
                {m}
              </button>
            ))}
          </div>
          <button 
            disabled={loading}
            onClick={handleCreateOrUpdateProfile}
            className="w-full bg-white text-black py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] mt-16 transition-all active:scale-95 shadow-2xl"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" /> : (isEditing ? 'Confirm Revision' : 'Register Identity')}
          </button>
        </div>
      )}

      {step === 'post-login' && currentUser && (
        <div className="w-full max-w-6xl animate-in fade-in zoom-in-95 duration-700 flex flex-col lg:flex-row gap-20 items-center lg:items-start">
           <div className="w-full lg:w-80 flex flex-col items-center lg:items-start text-center lg:text-left animate-in slide-in-from-left-12">
              <div className="relative group/avatar">
                <div className={`w-40 h-40 md:w-56 md:h-56 rounded-[3rem] ${getParticipantTheme(currentUser.color).bg} flex items-center justify-center text-8xl md:text-[10rem] shadow-2xl transform rotate-2 relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
                  <span className="relative z-10">{currentUser.mascot}</span>
                </div>
                <button 
                  onClick={handleStartRevision}
                  className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-3 rounded-2xl shadow-2xl transition-all hover:scale-110 active:scale-95 z-20"
                  title="Revise Profile"
                >
                  <UserCog size={24} strokeWidth={3} />
                </button>
              </div>
              <h2 className="text-5xl md:text-7xl font-black text-white mt-10 tracking-tighter leading-none break-words w-full">{currentUser.name}</h2>
              <p className="text-white/20 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 mb-8">Access Node Ready</p>
              
              <div className="w-full space-y-4">
                <button 
                  onClick={() => onSelectUser(currentUser)} 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl shadow-indigo-600/20"
                >
                  Enter Dashboard
                </button>
                <button 
                  onClick={handleStartRevision}
                  className="w-full bg-white/5 border border-white/5 hover:border-white/10 text-white/40 hover:text-white py-4 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  <Edit2 size={12} /> Revise Name & Mascot
                </button>
                <button onClick={() => setStep('select-profile')} className="w-full text-white/20 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors py-2 flex items-center justify-center gap-2">
                  <LogOut size={14} /> Switch Account
                </button>

                <div className="pt-8 mt-4 border-t border-white/5 space-y-3">
                  {deleteStatus === 'idle' && (
                    <button 
                      onClick={initiateDelete}
                      disabled={isInvolvedInTrips || checkingInvolvement}
                      className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 border ${isInvolvedInTrips ? 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed opacity-40' : 'bg-red-600/10 text-red-500 border-red-600/20 hover:bg-red-600 hover:text-white'}`}
                    >
                      {checkingInvolvement ? (
                        <><Loader2 size={14} className="animate-spin" /> Checking...</>
                      ) : (
                        <><Trash2 size={14} /> {isInvolvedInTrips ? 'Profile Locked' : 'Delete Profile'}</>
                      )}
                    </button>
                  )}

                  {deleteStatus === 'confirming' && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                      <div className="text-white/40 text-[9px] font-bold uppercase tracking-widest text-center px-2">
                        Are you sure? This cannot be undone.
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={cancelDelete}
                          className="flex-1 bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={executeDelete}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-red-900/50"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}

                  {deleteStatus === 'deleting' && (
                    <button disabled className="w-full bg-red-600/50 text-white/50 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 cursor-wait">
                      <Loader2 size={14} className="animate-spin" /> Deleting...
                    </button>
                  )}

                  {deleteStatus === 'success' && (
                    <div className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 animate-in zoom-in">
                      <Check size={14} /> Deleted
                    </div>
                  )}

                  {deleteStatus === 'error' && (
                    <div className="space-y-2">
                       <button onClick={initiateDelete} className="w-full bg-red-600/10 text-red-500 border border-red-500/50 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all">
                        <AlertTriangle size={14} /> Retry Delete
                      </button>
                      {deleteErrorMessage && <p className="text-red-400 text-[8px] font-bold uppercase tracking-widest text-center">{deleteErrorMessage}</p>}
                    </div>
                  )}

                  {isInvolvedInTrips ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 text-white/20">
                         <Info size={10} />
                         <p className="text-[8px] font-bold uppercase tracking-widest">Locked: Active in trip history</p>
                      </div>
                    </div>
                  ) : !checkingInvolvement && deleteStatus === 'idle' && (
                    <p className="text-[8px] text-emerald-500/40 font-bold uppercase tracking-widest text-center">Clean identity: Safe to delete</p>
                  )}
                </div>
              </div>
           </div>
           
           <div className="flex-1 w-full space-y-8 animate-in slide-in-from-right-12">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-6 px-4">
                <div className="flex items-baseline gap-4">
                  <h3 className="text-3xl font-black text-white uppercase tracking-[0.2em] opacity-30">
                    {viewMode === 'mine' ? 'My Itineraries' : 'Global Itineraries'}
                  </h3>
                  {viewMode === 'mine' && (
                    <button onClick={() => setViewMode('all')} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors flex items-center gap-1">
                      <Globe size={12} /> View All
                    </button>
                  )}
                  {viewMode === 'all' && (
                    <button onClick={() => setViewMode('mine')} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors flex items-center gap-1">
                      <ArrowLeft size={12} /> View Mine
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <input type="text" placeholder="Filter routes..." className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-5 text-white text-sm outline-none focus:border-white/30 transition-all w-full font-bold" value={tripSearch} onChange={e => setTripSearch(e.target.value)} />
                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                  </div>
                  <button 
                    onClick={() => setIsAddTripModalOpen(true)}
                    className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white py-5 px-10 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] transition-all active:scale-95 shadow-2xl shadow-indigo-600/30 whitespace-nowrap"
                  >
                    <Plus size={20} strokeWidth={4} /> Add Trip
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto scrollbar-hide p-4">
                 {filteredTrips.length === 0 ? (
                    <div className="col-span-full py-28 bg-white/5 border-2 border-dashed border-white/5 rounded-[4rem] flex flex-col items-center justify-center text-center px-10">
                      <div className="bg-white/5 p-8 rounded-3xl mb-6"><MapPin size={48} className="text-white/10" /></div>
                      <span className="text-white/20 font-black uppercase tracking-[0.3em] text-[10px] mb-8">
                        {viewMode === 'mine' ? 'No active sectors found for you' : 'No active sectors identified'}
                      </span>
                      <button 
                        onClick={() => setIsAddTripModalOpen(true)}
                        className="bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-indigo-700 active:scale-95"
                      >
                        Launch First Trip
                      </button>
                    </div>
                 ) : (
                   filteredTrips.map(trip => (
                     <button key={trip.id} onClick={() => { onSelectUser(currentUser); window.location.hash = `#trip/${trip.id}`; }} className="group bg-white/5 border border-white/10 p-8 rounded-[3rem] hover:bg-white/10 hover:border-white/40 transition-all text-left relative overflow-hidden flex flex-col justify-between h-60 active:scale-95">
                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-500/5 rounded-full group-hover:scale-150 transition-transform duration-1000" />
                        <div className="relative">
                          <span className="text-5xl block mb-6 group-hover:scale-110 transition-transform inline-block">{trip.flag_emoji}</span>
                          <h4 className="text-3xl font-black text-white tracking-tight leading-none group-hover:text-indigo-400 transition-colors">{trip.name}</h4>
                          <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-3 block">{trip.default_currency} Base</span>
                        </div>
                        <div className="flex justify-between items-center relative mt-auto border-t border-white/5 pt-5">
                          <div className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] group-hover:text-white transition-colors">Intercepting Route</div>
                          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <ChevronRight size={24} strokeWidth={4} className="group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                     </button>
                   ))
                 )}
              </div>
           </div>
        </div>
      )}

      {isAddTripModalOpen && currentUser && (
        <AddTripModal 
          currentUser={currentUser}
          allCurrencies={allCurrencies}
          onClose={() => setIsAddTripModalOpen(false)}
          onSuccess={(tripId) => {
            setIsAddTripModalOpen(false);
            onSelectUser(currentUser);
            window.location.hash = `#trip/${tripId}`;
          }}
        />
      )}
    </div>
  );
};
