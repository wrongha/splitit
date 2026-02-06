
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Trip, Participant } from '../types';
import { Plus, Calendar, MapPin, ChevronRight, Loader2, Trash2, Check, X, Globe } from 'lucide-react';
import { COLOR_MAP } from './TripDetails';

interface TripDashboardProps {
  onSelectTrip: (id: string) => void;
}

interface TripWithParticipants extends Trip {
  participants: Participant[];
}

export const FLAG_OPTIONS = [
  '✈️', '🌍', '🗺️', '🧳', '📸', '🏙️', '🏖️', '⛰️', '🏨', '🗼', 
  '🚂', '🛳️', '🛫', '🛂', '🎫', '⛺️', '🌉', '🌋', '⛩️', '🏜️', 
  '🌲', '⛷️', '🚕', '🥐', '🍹', '🌅', '🎒'
];

export const TripDashboard: React.FC<TripDashboardProps> = ({ onSelectTrip }) => {
  const [trips, setTrips] = useState<TripWithParticipants[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [newTripName, setNewTripName] = useState('');
  const [firstParticipant, setFirstParticipant] = useState('');
  const [flagEmoji, setFlagEmoji] = useState('✈️');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    setLoading(true);
    const { data: tripData, error: fetchError } = await supabase
      .from('trips')
      .select('*, participants(*)')
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      setError("Sync failed: Check if database columns exist in Supabase.");
    } else if (tripData) {
      setTrips(tripData as TripWithParticipants[]);
    }
    setLoading(false);
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripName.trim() || !firstParticipant.trim() || creating) return;

    setCreating(true);
    setError(null);

    const colorKeys = Object.keys(COLOR_MAP);
    const randomColor = colorKeys[Math.floor(Math.random() * colorKeys.length)];

    try {
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .insert([{ 
          name: newTripName,
          default_currency: defaultCurrency,
          color_key: randomColor,
          flag_emoji: flagEmoji || '✈️'
        }])
        .select()
        .single();

      if (tripError) throw tripError;

      if (tripData) {
        await Promise.all([
          supabase.from('participants').insert([{ 
            trip_id: tripData.id, 
            name: firstParticipant, 
            color: 'indigo', 
            mascot: '👤' 
          }]),
          supabase.from('trip_currencies').insert([
            { trip_id: tripData.id, currency_code: 'USD' },
            { trip_id: tripData.id, currency_code: defaultCurrency }
          ].filter((v, i, a) => a.findIndex(t => t.currency_code === v.currency_code) === i))
        ]);
        
        setNewTripName('');
        setFirstParticipant('');
        setFlagEmoji('✈️');
        setIsAdding(false);
        await fetchTrips();
      }
    } catch (err: any) {
      setError(err.message || "Failed to create trip.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTrip = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const { error } = await supabase.from('trips').delete().eq('id', id);
      if (error) throw error;
      setTrips(prev => prev.filter(t => t.id !== id));
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert("Error deleting trip: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Your Trips</h2>
          <p className="text-slate-500 font-bold text-sm tracking-tight uppercase opacity-60">Archive of your group adventures</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all active:scale-95 uppercase tracking-widest text-xs"
          >
            <Plus size={20} /> New Trip
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 animate-in slide-in-from-top-6 duration-300">
          <form onSubmit={handleCreateTrip} className="space-y-8">
            <h3 className="text-3xl font-black text-slate-900">Launch New Journey</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destination Icon</label>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-2xl border-2 border-slate-100 max-h-[200px] overflow-y-auto scrollbar-hide">
                  {FLAG_OPTIONS.map(flag => (
                    <button 
                      key={flag} 
                      type="button" 
                      onClick={() => setFlagEmoji(flag)}
                      className={`text-2xl p-2 rounded-xl transition-all flex items-center justify-center hover:scale-110 active:scale-95 ${flagEmoji === flag ? 'bg-white shadow-md ring-2 ring-indigo-500' : 'opacity-60 hover:opacity-100 grayscale hover:grayscale-0'}`}
                    >
                      {flag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trip Name</label>
                  <input required autoFocus type="text" placeholder="e.g. Kyoto Bloom" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 outline-none text-slate-900 font-bold transition-all placeholder:text-slate-300 shadow-sm" value={newTripName} onChange={(e) => setNewTripName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Base Currency</label>
                  <select className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 outline-none text-slate-900 font-black transition-all cursor-pointer shadow-sm" value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="HKD">HKD ($)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Your Identity</label>
                <input required type="text" placeholder="e.g. Alex" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 outline-none text-slate-900 font-bold transition-all placeholder:text-slate-300 shadow-sm" value={firstParticipant} onChange={(e) => setFirstParticipant(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-slate-50">
              <button type="submit" disabled={creating} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-12 py-5 rounded-[1.5rem] font-black transition-all flex items-center gap-3 shadow-xl shadow-indigo-100 active:scale-95 uppercase tracking-widest text-xs">
                {creating ? <Loader2 className="animate-spin" size={18} /> : null}
                {creating ? 'Building...' : 'Initiate Trip'}
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-10 py-5 rounded-[1.5rem] font-black transition-colors uppercase tracking-widest text-xs">Cancel</button>
            </div>
            {error && <div className="text-red-600 text-[10px] font-black bg-red-50 p-5 rounded-2xl border border-red-100 uppercase tracking-widest leading-relaxed shadow-sm">{error}</div>}
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Accessing Archives...</p>
        </div>
      ) : trips.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-24 flex flex-col items-center justify-center text-center">
          <div className="bg-indigo-50 p-6 rounded-full text-indigo-500 mb-6 shadow-inner shadow-indigo-100/50"><MapPin size={48} /></div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">No trips found</h3>
          <p className="text-slate-400 font-bold max-w-sm mt-3 mb-8 uppercase tracking-tighter">Your travel expense history is empty. Launch a new trip to start tracking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {trips.map((trip) => {
            const tripTheme = COLOR_MAP[trip.color_key || 'indigo'] || COLOR_MAP.indigo;
            return (
              <div key={trip.id} onClick={() => onSelectTrip(trip.id)} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:shadow-2xl hover:shadow-indigo-50/50 hover:border-indigo-300 cursor-pointer transition-all group relative overflow-hidden flex flex-col justify-between h-80">
                <div className={`absolute top-0 right-0 w-40 h-40 ${tripTheme.bg} opacity-50 rounded-bl-[4rem] -mr-16 -mt-16 transition-all group-hover:scale-110 group-hover:opacity-70`} />
                
                <div className="relative">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1 pr-8">
                      <span className="text-3xl mb-1">{trip.flag_emoji || '✈️'}</span>
                      <h3 className="text-3xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors tracking-tight leading-tight">{trip.name}</h3>
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
                  <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-4"><Calendar size={12} className="text-indigo-400" /><span>EST. {new Date(trip.created_at).toLocaleDateString()}</span></div>
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
    </div>
  );
};
