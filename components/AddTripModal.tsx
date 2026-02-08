
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { UserProfile, Currency } from '../types';
import { X, Check, Loader2, Plus, ChevronRight, ArrowLeft, Users, Star, Info, Zap, Lock } from 'lucide-react';
import { COLOR_MAP } from './TripDetails';
import { FLAG_OPTIONS } from './TripDashboard';

interface AddTripModalProps {
  currentUser: UserProfile;
  allCurrencies: Currency[];
  onClose: () => void;
  onSuccess: (tripId: string) => void;
}

export const AddTripModal: React.FC<AddTripModalProps> = ({ 
  currentUser, 
  allCurrencies,
  onClose, 
  onSuccess 
}) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 State
  const [name, setName] = useState('');
  const [flag, setFlag] = useState('✈️');
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(['USD']);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [currencyMethod, setCurrencyMethod] = useState<'fixed' | 'realtime'>('fixed');

  // Step 2 State
  const [participants, setParticipants] = useState<string[]>([]);
  const [tempParticipant, setTempParticipant] = useState('');
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);

  useEffect(() => {
    fetchSuggestions();
  }, [currentUser]);

  const fetchSuggestions = async () => {
    if (!currentUser.id) return;
    
    // 1. Get IDs of trips current user is in
    const { data: myTrips } = await supabase.from('participants').select('trip_id').eq('user_id', currentUser.id);
    const tripIds = myTrips?.map(t => t.trip_id) || [];
    
    let companionData: any[] = [];
    if (tripIds.length > 0) {
      // 2. Find common companions in those trips
      const { data } = await supabase
        .from('participants')
        .select('name, mascot, color, user_id')
        .in('trip_id', tripIds)
        .neq('user_id', currentUser.id);
      companionData = data || [];
    }

    const uniqueCompanions = new Map<string, UserProfile>();
    companionData.forEach(p => {
      if (!p.user_id) return;
      uniqueCompanions.set(p.name.toLowerCase(), { id: p.user_id, name: p.name, mascot: p.mascot || '👤', color: p.color || 'indigo' });
    });

    if (uniqueCompanions.size < 6) {
      const { data: globalUsers } = await supabase.from('users').select('*').neq('id', currentUser.id).limit(10);
      globalUsers?.forEach(u => {
        if (!uniqueCompanions.has(u.name.toLowerCase())) {
          uniqueCompanions.set(u.name.toLowerCase(), u as UserProfile);
        }
      });
    }

    setSuggestions(Array.from(uniqueCompanions.values()).slice(0, 6));
  };

  const toggleCurrency = (code: string) => {
    if (enabledCurrencies.includes(code)) {
      if (enabledCurrencies.length > 1) {
        setEnabledCurrencies(prev => prev.filter(c => c !== code));
        if (defaultCurrency === code) {
          setDefaultCurrency(enabledCurrencies.find(c => c !== code) || 'USD');
        }
      }
    } else {
      setEnabledCurrencies(prev => [...prev, code]);
    }
  };

  const handleAddParticipant = (pName: string) => {
    const trimmed = pName.trim();
    if (!trimmed) return;
    
    // Case-insensitive checks
    const lowerName = trimmed.toLowerCase();
    if (lowerName === currentUser.name.toLowerCase()) {
      alert("You are already included in the trip!");
      return;
    }
    
    if (participants.some(p => p.toLowerCase() === lowerName)) {
      alert("A traveler with this name is already in your list. Suggest a unique name.");
      return;
    }
    
    setParticipants([...participants, trimmed]);
    setTempParticipant('');
  };

  const handleSubmit = async () => {
    if (!name.trim() || loading) return;

    setLoading(true);
    const colorKeys = Object.keys(COLOR_MAP);
    const randomColor = colorKeys[Math.floor(Math.random() * colorKeys.length)];

    try {
      const ratesResponse = await fetch(`https://api.frankfurter.app/latest?from=${defaultCurrency}`);
      const ratesData = await ratesResponse.json();
      const fixedRates = ratesData?.rates || {};
      fixedRates[defaultCurrency] = 1;

      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .insert([{ 
          name,
          default_currency: defaultCurrency,
          color_key: randomColor,
          flag_emoji: flag,
          currency_method: currencyMethod,
          fixed_rates: fixedRates
        }])
        .select()
        .single();

      if (tripError) throw tripError;

      // Map participants to user IDs where possible
      const allPartData = await Promise.all([
        // Me
        { trip_id: tripData.id, name: currentUser.name, user_id: currentUser.id, color: currentUser.color, mascot: currentUser.mascot },
        // Guests
        ...participants.map(async pName => {
          const sug = suggestions.find(s => s.name.toLowerCase() === pName.toLowerCase());
          let userId = sug?.id;
          let userColor = sug?.color || colorKeys[Math.floor(Math.random() * colorKeys.length)];
          let userMascot = sug?.mascot || '👤';
          
          if (!userId) {
            // Check global user table first
            const { data: match } = await supabase.from('users').select('*').ilike('name', pName).single();
            if (match) {
                userId = match.id;
                userColor = match.color;
                userMascot = match.mascot;
            } else {
                 // Create relevant user profile for that person if it doesn't exist
                 const { data: newUser, error: createError } = await supabase.from('users').insert([{
                    name: pName,
                    mascot: userMascot,
                    color: userColor
                }]).select().single();

                if (!createError && newUser) {
                    userId = newUser.id;
                }
            }
          }

          return {
            trip_id: tripData.id,
            name: pName,
            user_id: userId,
            color: userColor,
            mascot: userMascot
          };
        })
      ]);

      const currencyInserts = enabledCurrencies.map(c => ({
        trip_id: tripData.id,
        currency_code: c
      }));

      await Promise.all([
        supabase.from('participants').insert(allPartData),
        supabase.from('trip_currencies').insert(currencyInserts)
      ]);

      onSuccess(tripData.id);
    } catch (err: any) {
      alert("Creation failed: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all relative">
        
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <ArrowLeft size={20} strokeWidth={3} />
              </button>
            )}
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Launch Trip</h3>
              <div className="flex gap-1.5 mt-1">
                <div className={`h-1.5 w-6 rounded-full transition-all ${step === 1 ? 'bg-indigo-600' : 'bg-indigo-200'}`} />
                <div className={`h-1.5 w-6 rounded-full transition-all ${step === 2 ? 'bg-indigo-600' : 'bg-slate-100'}`} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full"><X size={24} strokeWidth={3} /></button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide bg-slate-50/50">
          {step === 1 && (
            <div className="p-8 space-y-8 animate-in slide-in-from-left-4 fade-in duration-300">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trip Name</label>
                  <input required autoFocus type="text" placeholder="e.g. Kyoto Bloom" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white focus:border-indigo-500 outline-none text-slate-900 font-bold transition-all placeholder:text-slate-300 shadow-sm" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Icon</label>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3 bg-white rounded-2xl border-2 border-slate-200 max-h-[120px] overflow-y-auto scrollbar-hide">
                    {FLAG_OPTIONS.map(f => (
                      <button key={f} type="button" onClick={() => setFlag(f)} className={`text-2xl p-2 rounded-xl transition-all flex items-center justify-center hover:scale-125 active:scale-95 ${flag === f ? 'bg-indigo-50 shadow-inner ring-2 ring-indigo-500' : 'opacity-40 grayscale hover:grayscale-0 hover:opacity-100'}`}>{f}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Currency Strategy</label>
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={() => setCurrencyMethod('fixed')}
                      className={`flex flex-col gap-2 p-4 rounded-2xl border-2 transition-all text-left ${currencyMethod === 'fixed' ? 'border-indigo-600 bg-white shadow-md' : 'border-white bg-white/50 opacity-60'}`}
                    >
                      <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                        <Lock size={14} className="text-indigo-600" /> Fixed Rate
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold leading-tight uppercase opacity-50">Stable valuation</p>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setCurrencyMethod('realtime')}
                      className={`flex flex-col gap-2 p-4 rounded-2xl border-2 transition-all text-left ${currencyMethod === 'realtime' ? 'border-indigo-600 bg-white shadow-md' : 'border-white bg-white/50 opacity-60'}`}
                    >
                      <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                        <Zap size={14} className="text-amber-500" /> Real-time
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold leading-tight uppercase opacity-50">Market precision</p>
                    </button>
                 </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Base & Enabled Currencies</label>
                <div className="grid grid-cols-2 gap-3">
                  {allCurrencies.map(curr => {
                    const isEnabled = enabledCurrencies.includes(curr.code);
                    const isDefault = defaultCurrency === curr.code;
                    return (
                      <div key={curr.code} className="relative group/curr">
                        <button
                          type="button"
                          onClick={() => toggleCurrency(curr.code)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all font-black ${isEnabled ? 'border-indigo-600 bg-white shadow-md' : 'border-white bg-white/50 grayscale opacity-40 hover:opacity-60'}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${isEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{curr.symbol}</span>
                            <span className="text-slate-900 text-sm">{curr.code}</span>
                          </div>
                          {isEnabled && <Check size={16} strokeWidth={4} className={isDefault ? "text-indigo-600" : "text-indigo-200"} />}
                        </button>
                        {isEnabled && (
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDefaultCurrency(curr.code); }}
                            className={`absolute -top-1.5 -right-1.5 p-1.5 rounded-full shadow-lg transition-all ${isDefault ? 'bg-amber-400 text-white scale-110' : 'bg-white text-slate-300 hover:text-amber-400 opacity-0 group-hover/curr:opacity-100'}`}
                          >
                            <Star size={12} className={isDefault ? 'fill-white' : ''} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-8 space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Who's joining?</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Add unique name" className="flex-1 px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white focus:border-indigo-500 outline-none text-slate-900 font-bold transition-all shadow-sm" value={tempParticipant} onChange={(e) => setTempParticipant(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddParticipant(tempParticipant))} />
                  <button type="button" onClick={() => handleAddParticipant(tempParticipant)} className="bg-slate-900 text-white px-6 rounded-2xl hover:bg-slate-800 transition-all active:scale-95"><Plus size={20} /></button>
                </div>
              </div>
              {suggestions.length > 0 && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Suggested Companions</label>
                  <div className="grid grid-cols-2 gap-3">
                    {suggestions.map(s => {
                      const isAdded = participants.some(p => p.toLowerCase() === s.name.toLowerCase());
                      const theme = COLOR_MAP[s.color] || COLOR_MAP.indigo;
                      return (
                        <button key={s.name} onClick={() => isAdded ? setParticipants(prev => prev.filter(p => p.toLowerCase() !== s.name.toLowerCase())) : handleAddParticipant(s.name)} className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${isAdded ? 'border-indigo-600 bg-indigo-50' : 'border-white bg-white hover:border-indigo-100 shadow-sm'}`}>
                          <div className={`shrink-0 w-10 h-10 rounded-xl ${theme.bg} ${theme.text} flex items-center justify-center font-black text-lg shadow-inner`}>{s.mascot}</div>
                          <span className="font-bold text-slate-700 text-xs truncate flex-1">{s.name}</span>
                          {isAdded && <div className="text-indigo-600"><Check size={16} strokeWidth={4} /></div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trip Roster</label>
                <div className="space-y-2 min-h-[120px] bg-white p-4 rounded-2xl border-2 border-dashed border-slate-200">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-indigo-100 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm">{currentUser.mascot}</div>
                    <span className="font-bold text-slate-900 text-xs uppercase tracking-tight">{currentUser.name} (Organizer)</span>
                  </div>
                  {participants.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl animate-in slide-in-from-right-2">
                      <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-black"><Users size={16} /></div><span className="font-bold text-slate-700 text-sm">{p}</span></div>
                      <button type="button" onClick={() => setParticipants(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500 p-1"><X size={18} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white z-10">
          {step === 1 ? (
             <button onClick={() => name.trim() && setStep(2)} disabled={!name.trim()} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-4 rounded-[1.5rem] font-black text-lg shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95">Next <ChevronRight size={20} strokeWidth={3} /></button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-4 rounded-[1.5rem] font-black text-lg shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95">{loading ? <Loader2 className="animate-spin" size={24} /> : <Check size={24} strokeWidth={3} />} Create Trip</button>
          )}
        </div>
      </div>
    </div>
  );
};
