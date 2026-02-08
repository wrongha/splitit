
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Trip, Participant, UserProfile, Currency } from '../types';
import { Plus, Calendar, MapPin, ChevronRight, Loader2, Trash2, Check, X, User, Archive, PlayCircle, Clock } from 'lucide-react';
import { COLOR_MAP } from './TripDetails';
import { AddTripModal } from './AddTripModal';

interface TripDashboardProps {
  onSelectTrip: (id: string, isNew?: boolean) => void;
  currentUser: UserProfile;
  allAvailableCurrencies: Currency[];
}

interface TripWithParticipants extends Trip {
  participants: Participant[];
}

export const FLAG_OPTIONS = [
  '✈️', '🌍', '🗺️', '🧳', '📸', '🏙️', '🏖️', '⛰️', '🏨', '🗼', 
  '🚂', '🛳️', '🛫', '🛂', '🎫', '⛺️', '🌉', '🌋', '⛩️', '🏜️', 
  '🌲', '⛷️', '🚕', '🥐', '🍹', '🌅', '🎒'
];

const getRelativeTime = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

export const TripDashboard: React.FC<TripDashboardProps> = ({ onSelectTrip, currentUser, allAvailableCurrencies }) => {
  const [trips, setTrps] = useState<TripWithParticipants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewFilter, setViewFilter] = useState<'mine' | 'all'>('mine');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrips();
  }, [currentUser]);

  const fetchTrips = async () => {
    setLoading(true);
    const { data: tripData, error: fetchError } = await supabase
      .from('trips')
      .select('*, participants(*)')
      .order('updated_at', { ascending: false });
    
    if (fetchError) {
      setError("Sync failed: Check database configuration.");
    } else if (tripData) {
      setTrps(tripData as TripWithParticipants[]);
    }
    setLoading(false);
  };

  const handleDeleteTrip = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await supabase.from('trips').delete().eq('id', id);
      setTrps(prev => prev.filter(t => t.id !== id));
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert("Error deleting trip: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const displayedTrips = trips.filter(trip => {
    // Status filter
    const matchesStatus = statusFilter === 'archived' ? !!trip.is_archived : !trip.is_archived;
    if (!matchesStatus) return false;

    // View filter
    if (viewFilter === 'all') return true;
    return trip.participants.some(p => p.name.toLowerCase() === currentUser.name.toLowerCase());
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">
              Hello, {currentUser.name}!
            </h2>
            <p className="text-slate-500 font-bold text-sm tracking-tight uppercase opacity-60">Ready for your next adventure?</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all active:scale-95 uppercase tracking-widest text-xs"
          >
            <Plus size={20} /> New Trip
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex p-1.5 bg-white border border-slate-200 rounded-2xl w-fit shadow-sm">
            <button 
              onClick={() => setViewFilter('mine')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewFilter === 'mine' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <User size={14} /> My Trips
            </button>
            <button 
              onClick={() => setViewFilter('all')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewFilter === 'all' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <Archive size={14} /> Explore All
            </button>
          </div>

          <div className="flex p-1.5 bg-white border border-slate-200 rounded-2xl w-fit shadow-sm ml-auto sm:ml-0">
            <button 
              onClick={() => setStatusFilter('active')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${statusFilter === 'active' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setStatusFilter('archived')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${statusFilter === 'archived' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              Archived
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Accessing Archives...</p>
        </div>
      ) : displayedTrips.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-24 flex flex-col items-center justify-center text-center">
          <div className="bg-indigo-50 p-6 rounded-full text-indigo-500 mb-6 shadow-inner shadow-indigo-100/50">
            {statusFilter === 'archived' ? <Archive size={48} /> : <MapPin size={48} />}
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            {statusFilter === 'archived' ? 'No archived trips' : 'No trips found'}
          </h3>
          <p className="text-slate-400 font-bold max-w-sm mt-3 mb-8 uppercase tracking-tighter">
            {statusFilter === 'archived' 
              ? "Your vault is empty. You can archive completed trips from the settings menu."
              : (viewFilter === 'mine' 
                ? "You haven't been added to any active trips yet. Create one or switch to 'Explore All'." 
                : "The archives are empty. Launch a new trip to start tracking.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {displayedTrips.map((trip) => {
            const tripTheme = COLOR_MAP[trip.color_key || 'indigo'] || COLOR_MAP.indigo;
            return (
              <div key={trip.id} onClick={() => onSelectTrip(trip.id)} className={`bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:shadow-2xl hover:shadow-indigo-50/50 hover:border-indigo-300 cursor-pointer transition-all group relative overflow-hidden flex flex-col justify-between h-80 ${trip.is_archived ? 'grayscale-[0.5] opacity-90' : ''}`}>
                <div className={`absolute top-0 right-0 w-40 h-40 ${tripTheme.bg} opacity-50 rounded-bl-[4rem] -mr-16 -mt-16 transition-all group-hover:scale-110 group-hover:opacity-70`} />
                
                <div className="relative">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1 pr-8">
                      <span className="text-3xl mb-1">{trip.flag_emoji || '✈️'}</span>
                      <h3 className="text-3xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors tracking-tight leading-tight">{trip.name}</h3>
                      {trip.is_archived && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-600 tracking-widest mt-1">
                          <Archive size={12} /> Archived
                        </div>
                      )}
                    </div>
                    {deleteConfirmId !== trip.id ? (
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(trip.id); }} className="text-slate-300 hover:text-red-500 p-2.5 rounded-xl hover:bg-red-50 transition-all md:opacity-0 group-hover:opacity-100"><Trash2 size={22} /></button>
                    ) : (
                      <div className="flex items-center gap-2 animate-in zoom-in-90">
                        <button onClick={(e) => handleDeleteTrip(e, trip.id)} disabled={deletingId === trip.id} className="bg-red-600 text-white p-2.5 rounded-xl hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95">{deletingId === trip.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}</button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }} className="bg-slate-100 text-slate-700 p-2.5 rounded-xl hover:bg-slate-200 transition-all"><X size={18} /></button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 mt-4">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]"><Calendar size={12} className="text-indigo-400" /><span>EST. {new Date(trip.created_at).toLocaleDateString()}</span></div>
                    <div className="flex items-center gap-2 text-indigo-500 text-[10px] font-black uppercase tracking-[0.2em]"><Clock size={12} className="text-indigo-500" /><span>Active {getRelativeTime(trip.updated_at)}</span></div>
                  </div>
                </div>

                <div className="flex items-end justify-between relative mt-auto pt-6">
                  <div className="flex -space-x-4 overflow-hidden p-1">
                    {trip.participants.slice(0, 5).map((p) => {
                      const pTheme = COLOR_MAP[p.color || 'indigo'] || COLOR_MAP.indigo;
                      return (
                        <div 
                          key={p.id} 
                          className={`inline-block h-12 w-12 rounded-2xl ring-4 ring-white ${pTheme.bg} ${pTheme.text} flex items-center justify-center font-black text-2xl shadow-sm transition-transform hover:scale-125 hover:z-20`}
                          title={p.name}
                        >
                          {p.mascot || p.name[0]}
                        </div>
                      );
                    })}
                    {trip.participants.length > 5 && (
                      <div className="inline-block h-12 w-12 rounded-2xl ring-4 ring-white bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs">
                        +{trip.participants.length - 5}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest bg-indigo-50 px-6 py-3.5 rounded-[1.25rem] group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                    Details <ChevronRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <AddTripModal 
          currentUser={currentUser}
          allCurrencies={allAvailableCurrencies}
          onClose={() => setIsModalOpen(false)}
          onSuccess={(tripId) => {
            setIsModalOpen(false);
            onSelectTrip(tripId, true);
          }}
        />
      )}
    </div>
  );
};
