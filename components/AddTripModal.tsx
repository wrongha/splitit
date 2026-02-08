
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { UserProfile, Currency } from '../types';
import { X, Check, Loader2, Plus, ChevronRight, ArrowLeft, Users, UserPlus, Star, Info, Zap, Lock } from 'lucide-react';
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
    const { data: myTrips } = await supabase
      .from('participants')
      .select('trip_id')
      .eq('name', currentUser.name);

    const myTripIds = myTrips?.map(t => t.trip_id) || [];

    let companionData: any[] = [];
    if (myTripIds.length > 0) {
      const { data } = await supabase
        .from('participants')
        .select('name, mascot, color')
        .in('trip_id', myTripIds)
        .neq('name', currentUser.name);
      companionData = data || [];
    }

    const uniqueCompanions = new Map<string, UserProfile>();
    companionData.forEach(p => uniqueCompanions.set(p.name, p as UserProfile));

    if (uniqueCompanions.size < 4) {
      const { data: otherUsers } = await supabase
        .from('participants')
        .select('name, mascot, color')
        .neq('name', currentUser.name)
        .limit(10);
      
      otherUsers?.forEach(p => {
        if (uniqueCompanions.size < 6) {
          uniqueCompanions.set(p.name, p as UserProfile);
        }
      });
    }

    setSuggestions(Array.from(uniqueCompanions.values()).slice(0, 4));
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
    if (trimmed && !participants.includes(trimmed) && trimmed !== currentUser.name) {
      setParticipants([...participants, trimmed]);
      setTempParticipant('');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || loading) return;

    setLoading(true);
    const colorKeys = Object.keys(COLOR_MAP);
    const randomColor = colorKeys[Math.floor(Math.random() * colorKeys.length)];

    try {
      // Fetch initial rates relative to the base currency
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

      const allParts = [
        { trip_id: tripData.id, name: currentUser.name, color: currentUser.color || 'indigo', mascot: currentUser.mascot || '👤' },
        ...participants.map(pName => {
          const sug = suggestions.find(s => s.name === pName);
          return {
            trip_id: tripData.id,
            name: pName,
            color: sug?.color || colorKeys[Math.floor(Math.random() * colorKeys.length)],
            mascot: sug?.mascot || '👤'
          };
        })
      ];

      const currencyInserts = enabledCurrencies.map(c => ({
        trip_id: tripData.id,
        currency_code: c
      }));

      await Promise.all([
        supabase.from('participants').insert(allParts),
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
                      <p className="text-[10px] text-slate-400 font-bold leading-tight">Rate stays locked for the whole trip unless you manual refresh.</p>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setCurrencyMethod('realtime')}
                      className={`flex flex-col gap-2 p-4 rounded-2xl border-2 transition-all text-left ${currencyMethod === 'realtime' ? 'border-indigo-600 bg-white shadow-md' : 'border-white bg-white/50 opacity-60'}`}
                    >
                      <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                        <Zap size={14} className="text-amber-500" /> Real-time
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold leading-tight">Every expense pulls the market rate for its specific date.</p>
                    </button>
                 </div>
                 {currencyMethod === 'realtime' && (
                   <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
                      <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase tracking-tight">Note: Base currency cannot be changed after trip starts in Real-time mode.</p>
                   </div>
                 )}
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
                  <input type="text" placeholder="Add name..." className="flex-1 px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white focus:border-indigo-500 outline-none text-slate-900 font-bold transition-all shadow-sm" value={tempParticipant} onChange={(e) => setTempParticipant(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddParticipant(tempParticipant))} />
                  <button type="button" onClick={() => handleAddParticipant(tempParticipant)} className="bg-slate-900 text-white px-6 rounded-2xl hover:bg-slate-800 transition-all"><Plus size={20} /></button>
                </div>
              </div>
              {suggestions.length > 0 && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Suggestions</label>
                  <div className="grid grid-cols-2 gap-3">
                    {suggestions.map(s => {
                      const isAdded = participants.includes(s.name);
                      const theme = COLOR_MAP[s.color] || COLOR_MAP.indigo;
                      return (
                        <button key={s.name} onClick={() => isAdded ? setParticipants(prev => prev.filter(p => p !== s.name)) : handleAddParticipant(s.name)} className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${isAdded ? 'border-indigo-600 bg-indigo-50' : 'border-white bg-white hover:border-indigo-100'}`}>
                          <div className={`w-10 h-10 rounded-xl ${theme.bg} ${theme.text} flex items-center justify-center font-black text-lg`}>{s.mascot}</div>
                          <span className="font-bold text-slate-700 text-sm truncate">{s.name}</span>
                          {isAdded && <div className="ml-auto text-indigo-600"><Check size={16} strokeWidth={4} /></div>}
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
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black">{currentUser.mascot}</div>
                    <span className="font-bold text-slate-900 text-sm">{currentUser.name} (You)</span>
                  </div>
                  {participants.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl animate-in slide-in-from-right-2">
                      <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-black"><Users size={16} /></div><span className="font-bold text-slate-700 text-sm">{p}</span></div>
                      <button type="button" onClick={() => setParticipants(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500"><X size={18} /></button>
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
            <button onClick={handleSubmit} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-4 rounded-[1.5rem] font-black text-lg shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95">{loading ? <Loader2 className="animate-spin" size={24} /> : <Check size={24} strokeWidth={3} />} Initiate Trip</button>
          )}
        </div>
      </div>
    </div>
  );
};
