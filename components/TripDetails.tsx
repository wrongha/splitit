
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Trip, Participant, Expense, Currency } from '../types';
import { 
  ArrowLeft, Plus, Users, Receipt, PieChart, Calendar,
  Trash2, Wallet, RefreshCw, Loader2, Check, X, Edit2, Settings, Star, Palette, Save,
  Tag
} from 'lucide-react';
import { AddExpenseModal, CATEGORY_CONFIG } from './AddExpenseModal';
import { SettlementView } from './SettlementView';
import { FLAG_OPTIONS } from './TripDashboard';

interface TripDetailsProps {
  tripId: string;
  onBack: () => void;
  globalRates: Record<string, number>;
  allAvailableCurrencies: Currency[];
}

export const COLOR_MAP: Record<string, { bg: string, text: string, ring: string, dot: string }> = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-500', dot: 'bg-indigo-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-500', dot: 'bg-rose-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-500', dot: 'bg-amber-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-500', dot: 'bg-emerald-500' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-600', ring: 'ring-sky-500', dot: 'bg-sky-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-500', dot: 'bg-violet-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-500', dot: 'bg-orange-500' },
  fuchsia: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', ring: 'ring-fuchsia-500', dot: 'bg-fuchsia-500' },
};

export const MASCOTS = ['👤', '🐼', '🦊', '🐱', '🐶', '🦄', '🐲', '🐙', '🐢', '🦖', '🐝', '🐬', '🐥'];

export const getParticipantTheme = (colorKey?: string) => {
  return COLOR_MAP[colorKey || 'indigo'] || COLOR_MAP.indigo;
};

export const TripDetails: React.FC<TripDetailsProps> = ({ 
  tripId, 
  onBack, 
  globalRates,
  allAvailableCurrencies
}) => {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tripEnabledCurrencies, setTripEnabledCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingDefaultId, setUpdatingDefaultId] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlements' | 'people' | 'settings'>('expenses');
  const [newParticipantName, setNewParticipantName] = useState('');

  // Editable trip settings
  const [editTripName, setEditTripName] = useState('');
  const [editTripFlag, setEditTripFlag] = useState('');
  const [editTripColor, setEditTripColor] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tripRes, partRes, expRes, currRes] = await Promise.all([
        supabase.from('trips').select('*').eq('id', tripId).single(),
        supabase.from('participants').select('*').eq('trip_id', tripId).order('name'),
        supabase.from('expenses').select(`*, payers:expense_payers(participant_id, amount_paid), splits:expense_splits(participant_id, share_amount)`).eq('trip_id', tripId).order('expense_date', { ascending: false }),
        supabase.from('trip_currencies').select('currency_code').eq('trip_id', tripId)
      ]);

      if (tripRes.data) {
        setTrip(tripRes.data);
        setEditTripName(tripRes.data.name);
        setEditTripFlag(tripRes.data.flag_emoji || '✈️');
        setEditTripColor(tripRes.data.color_key || 'indigo');
      }
      if (partRes.data) setParticipants(partRes.data);
      if (expRes.data) setExpenses(expRes.data as any);
      if (currRes.data) setTripEnabledCurrencies(currRes.data.map(c => c.currency_code));
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateTripSettings = async () => {
    setIsSavingSettings(true);
    try {
      const { error } = await supabase
        .from('trips')
        .update({
          name: editTripName,
          flag_emoji: editTripFlag,
          color_key: editTripColor
        })
        .eq('id', tripId);
      
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      alert("Settings update failed: " + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUpdateParticipantColor = async (pId: string, color: string) => {
    setParticipants(prev => prev.map(p => p.id === pId ? { ...p, color } : p));
    const { error } = await supabase.from('participants').update({ color }).eq('id', pId);
    if (error) fetchData();
  };

  const handleUpdateParticipantMascot = async (pId: string, mascot: string) => {
    setParticipants(prev => prev.map(p => p.id === pId ? { ...p, mascot } : p));
    const { error } = await supabase.from('participants').update({ mascot }).eq('id', pId);
    if (error) fetchData();
  };

  const handleUpdateParticipantName = async (pId: string, newName: string) => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('participants').update({ name: newName.trim() }).eq('id', pId);
    if (error) {
      alert("Failed to update name");
      fetchData();
    } else {
      setParticipants(prev => prev.map(p => p.id === pId ? { ...p, name: newName.trim() } : p));
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipantName.trim()) return;
    const nameToInsert = newParticipantName;
    setNewParticipantName('');
    
    const { error } = await supabase.from('participants').insert([{ trip_id: tripId, name: nameToInsert, color: 'indigo', mascot: '👤' }]);
    if (error) {
      console.error(error);
      setNewParticipantName(nameToInsert);
    } else {
      fetchData();
    }
  };

  const handleConfirmDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    setDeletingId(id);
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (!error) { setExpenses(prev => prev.filter(exp => exp.id !== id)); setDeleteConfirmId(null); }
    } catch (err: any) { alert(err.message); } finally { setDeletingId(null); }
  };

  const toggleTripCurrency = async (code: string) => {
    const isEnabled = tripEnabledCurrencies.includes(code);
    if (isEnabled) {
      if (tripEnabledCurrencies.length <= 1) return;
      setTripEnabledCurrencies(prev => prev.filter(c => c !== code));
      await supabase.from('trip_currencies').delete().eq('trip_id', tripId).eq('currency_code', code);
      if (trip?.default_currency === code) {
        const next = tripEnabledCurrencies.find(c => c !== code) || 'USD';
        handleSetDefaultCurrency(next);
      }
    } else {
      setTripEnabledCurrencies(prev => [...prev, code]);
      await supabase.from('trip_currencies').insert([{ trip_id: tripId, currency_code: code }]);
    }
  };

  const handleSetDefaultCurrency = async (code: string) => {
    if (trip?.default_currency === code) return;
    setUpdatingDefaultId(code);
    setTrip(prev => prev ? { ...prev, default_currency: code } : null);
    try {
      await supabase.from('trips').update({ default_currency: code }).eq('id', tripId);
      await supabase.from('trip_currencies').upsert([{ trip_id: tripId, currency_code: code }]);
    } catch (err) {
      fetchData();
    } finally {
      setUpdatingDefaultId(null);
    }
  };

  const totalSpentUSD = expenses
    .filter(e => !e.expense_name.startsWith('Settlement:'))
    .reduce((sum, e) => {
      const rate = globalRates[e.currency] || 1;
      return sum + (Number(e.amount) / rate);
    }, 0);

  const defaultCurrency = trip?.default_currency || 'USD';
  const defaultRate = globalRates[defaultCurrency] || 1;
  const totalInDefault = totalSpentUSD * defaultRate;
  const defaultCurrencySymbol = allAvailableCurrencies.find(c => c.code === defaultCurrency)?.symbol || '$';

  // Category Breakdown Calculation
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    expenses.forEach(exp => {
      if (exp.expense_name.startsWith('Settlement:')) return;
      const rate = globalRates[exp.currency] || 1;
      const amountInDefault = (exp.amount / rate) * defaultRate;
      const cat = exp.category || 'Others';
      breakdown[cat] = (breakdown[cat] || 0) + amountInDefault;
    });
    return breakdown;
  }, [expenses, globalRates, defaultRate]);

  // Calculate individual spending based on SPLITS
  const participantShare = useMemo(() => {
    const map: Record<string, number> = {};
    participants.forEach(p => map[p.id] = 0);
    expenses.forEach(exp => {
      if (exp.expense_name.startsWith('Settlement:')) return;
      const rate = globalRates[exp.currency] || 1;
      exp.splits?.forEach(split => {
        if (map[split.participant_id] !== undefined) {
          map[split.participant_id] += (Number(split.share_amount) / rate);
        }
      });
    });
    return map;
  }, [expenses, participants, globalRates]);

  const tripTheme = COLOR_MAP[trip?.color_key || 'indigo'] || COLOR_MAP.indigo;

  return (
    <div className="pb-36 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors w-fit group font-black uppercase text-[10px] tracking-widest">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Dashboard
        </button>
        <div className="flex items-center gap-5">
          <span className="text-5xl drop-shadow-sm">{trip?.flag_emoji}</span>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">{trip?.name}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className={`${tripTheme.dot} p-7 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-100 flex flex-col justify-between relative overflow-hidden group min-h-[160px] ${activeTab === 'expenses' ? 'flex' : 'hidden sm:flex'}`}>
          <div className="absolute -right-4 -bottom-4 bg-white/10 w-32 h-32 rounded-full group-hover:scale-125 transition-transform duration-700" />
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
              <Wallet size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Total Spend</span>
          </div>
          <div className="mt-6 relative z-10 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black tracking-tighter">{defaultCurrencySymbol}{totalInDefault.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
            <span className="text-xs font-black opacity-60 uppercase tracking-widest">{defaultCurrency}</span>
          </div>
        </div>
        
        <div className="hidden sm:flex bg-white p-7 rounded-[2.5rem] border border-slate-200 shadow-sm flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-500">
              <Users size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Attendees</span>
          </div>
          <div className="mt-6"><span className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tighter">{participants.length}</span></div>
        </div>
        
        <div className="hidden sm:flex bg-white p-7 rounded-[2.5rem] border border-slate-200 shadow-sm flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-500">
              <Receipt size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Entries</span>
          </div>
          <div className="mt-6"><span className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tighter">{expenses.length}</span></div>
        </div>
      </div>

      <div className="py-2">
        {activeTab === 'expenses' && (
          <div className="space-y-10">
            {/* Category Dashboard */}
            {expenses.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 sm:p-10 shadow-sm animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Spending Breakdown</h3>
                  <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <PieChart size={14} /> Category Mix
                  </div>
                </div>
                <div className="space-y-6">
                  {CATEGORY_CONFIG.map(cat => {
                    const amount = categoryBreakdown[cat.id] || 0;
                    if (amount === 0 && cat.id !== 'Others') return null;
                    const percent = totalInDefault > 0 ? (amount / totalInDefault) * 100 : 0;
                    return (
                      <div key={cat.id} className="space-y-2 group/cat">
                        <div className="flex justify-between items-center px-1">
                          <div className="flex items-center gap-3">
                            <div className={`${cat.color} p-2 rounded-xl text-white shadow-sm`}>
                              <cat.icon size={16} />
                            </div>
                            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{cat.id}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-slate-900">{defaultCurrencySymbol}{amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            <span className="text-[10px] text-slate-400 font-bold ml-1.5 opacity-60">{percent.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${cat.color} rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.05)]`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expense List */}
            <div className="space-y-4">
              <div className="flex justify-between items-end px-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Recent Activity</h3>
              </div>
              {expenses.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs">No entries yet.</div>
              ) : (
                expenses.map((expense) => {
                  const payer = participants.find(p => p.id === expense.payers?.[0]?.participant_id);
                  const theme = getParticipantTheme(payer?.color);
                  const symbol = allAvailableCurrencies.find(c => c.code === expense.currency)?.symbol || '$';
                  const catData = CATEGORY_CONFIG.find(c => c.id === expense.category) || CATEGORY_CONFIG[CATEGORY_CONFIG.length - 1];
                  const CatIcon = catData.icon;

                  return (
                    <div key={expense.id} className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 flex items-center gap-4 sm:gap-6 group hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-50/50 transition-all relative overflow-hidden">
                      <div className={`shrink-0 p-2.5 sm:p-3 rounded-2xl transition-all ${theme.bg} ${theme.text} w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center font-black text-2xl sm:text-3xl shadow-inner relative`}>
                        {payer?.mascot || payer?.name[0]}
                        <div className={`absolute -bottom-1 -right-1 p-1.5 rounded-lg text-white ${catData.color} shadow-lg ring-2 ring-white scale-75 sm:scale-90`}>
                          <CatIcon size={12} />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-1.5">
                          <h4 className="font-black text-slate-800 text-base sm:text-lg tracking-tight truncate">
                            {expense.expense_name}
                          </h4>
                          <div className="text-left sm:text-right font-black text-slate-900 text-lg sm:text-xl tracking-tighter">
                            {symbol}{Number(expense.amount).toLocaleString(undefined, {minimumFractionDigits: 2})} 
                            <span className="text-[10px] text-slate-400 ml-1 uppercase">{expense.currency}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em]">
                          <span className="flex items-center gap-1.5 shrink-0"><Calendar size={12} className="text-slate-300" />{expense.expense_date}</span>
                          <span className="hidden sm:inline opacity-30 shrink-0">•</span>
                          <span className={`px-2.5 py-0.5 rounded-full ${theme.bg} ${theme.text} inline-flex items-center shrink-0`}>
                            By {payer?.name || 'Someone'}
                          </span>
                          <span className="hidden sm:inline opacity-30 shrink-0">•</span>
                          <span className="text-slate-500 font-black">{catData.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {deleteConfirmId !== expense.id ? (
                          <div className="flex gap-0.5">
                            <button onClick={() => { setEditingExpense(expense); setIsModalOpen(true); }} className="text-slate-300 hover:text-indigo-600 p-2 sm:p-2.5 hover:bg-indigo-50 rounded-xl transition-all">
                              <Edit2 size={18} />
                            </button>
                            <button onClick={() => setDeleteConfirmId(expense.id)} className="text-slate-300 hover:text-red-600 p-2 sm:p-2.5 hover:bg-red-50 rounded-xl transition-all">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 animate-in slide-in-from-right-2">
                            <button onClick={(e) => handleConfirmDelete(e, expense.id)} className="bg-red-600 text-white p-2.5 rounded-xl hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95">
                              {deletingId === expense.id ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 p-2.5 rounded-xl hover:bg-slate-200 transition-all">
                              <X size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'settlements' && (
          <SettlementView 
            tripId={tripId}
            expenses={expenses} 
            participants={participants} 
            rates={globalRates} 
            enabledCurrencies={tripEnabledCurrencies}
            onSettled={fetchData}
          />
        )}

        {activeTab === 'people' && (
          <div className="space-y-8">
            <form onSubmit={handleAddParticipant} className="flex gap-4 bg-white p-3 rounded-[1.5rem] border border-slate-200 shadow-sm focus-within:border-indigo-500 transition-all max-w-2xl">
              <input 
                type="text" 
                placeholder="Add participant name..." 
                className="flex-1 px-4 py-3 outline-none font-bold text-slate-900 placeholder:text-slate-300 bg-white rounded-xl" 
                value={newParticipantName} 
                onChange={(e) => setNewParticipantName(e.target.value)} 
              />
              <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-widest text-xs">Invite</button>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {participants.map((p) => {
                const theme = getParticipantTheme(p.color);
                const share = (participantShare[p.id] || 0) * defaultRate;
                return (
                  <div key={p.id} className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/30 transition-all flex flex-col gap-6 group">
                    <div className="flex items-center gap-5">
                      <div className={`shrink-0 w-16 h-16 ${theme.bg} ${theme.text} rounded-2xl flex items-center justify-center font-black text-3xl shadow-inner`}>
                        {p.mascot || p.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <input 
                          type="text"
                          defaultValue={p.name}
                          onBlur={(e) => handleUpdateParticipantName(p.id, e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                          className="font-black text-2xl text-slate-800 block leading-tight tracking-tight bg-transparent border-none focus:ring-2 focus:ring-indigo-100 rounded-lg w-full outline-none px-1 -ml-1 transition-all truncate"
                        />
                        <div className="mt-1 flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Spent</span>
                          <span className={`text-sm font-black ${theme.text}`}>
                            {defaultCurrencySymbol}{share.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-5 pt-5 border-t border-slate-50">
                      <div className="flex flex-wrap gap-2">
                        {MASCOTS.map(m => (
                          <button
                            key={m}
                            onClick={() => handleUpdateParticipantMascot(p.id, m)}
                            className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl transition-all hover:scale-110 active:scale-90 ${p.mascot === m ? 'ring-2 ring-indigo-500 bg-white shadow-md z-10 scale-110' : 'opacity-30 grayscale hover:grayscale-0 hover:opacity-100'}`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-3.5 pt-2">
                        {Object.keys(COLOR_MAP).map(colorKey => {
                          const swatch = COLOR_MAP[colorKey];
                          const isActive = p.color === colorKey;
                          return (
                            <button
                              key={colorKey}
                              onClick={() => handleUpdateParticipantColor(p.id, colorKey)}
                              className={`w-8 h-8 rounded-full ${swatch.dot} transition-all hover:scale-125 hover:shadow-lg active:scale-90 ${isActive ? `ring-offset-2 ring-2 ${swatch.ring} scale-110` : 'opacity-40 hover:opacity-100'}`}
                              title={colorKey}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 sm:p-10 space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Trip Identity</h3>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Configure your travel DNA.</p>
                </div>
                <button 
                  onClick={handleUpdateTripSettings}
                  disabled={isSavingSettings}
                  className="w-full sm:w-auto bg-indigo-600 text-white px-7 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-xl shadow-indigo-100"
                >
                  {isSavingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {isSavingSettings ? 'Saving...' : 'Save DNA'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trip Name</label>
                    <input 
                      type="text" 
                      className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all shadow-sm"
                      value={editTripName}
                      onChange={e => setEditTripName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Theme Color</label>
                    <div className="flex flex-wrap gap-3 p-5 bg-slate-50 rounded-2xl border-2 border-slate-100">
                      {Object.keys(COLOR_MAP).map(colorKey => {
                        const swatch = COLOR_MAP[colorKey];
                        const isActive = editTripColor === colorKey;
                        return (
                          <button
                            key={colorKey}
                            type="button"
                            onClick={() => setEditTripColor(colorKey)}
                            className={`w-10 h-10 rounded-full ${swatch.dot} transition-all hover:scale-125 ${isActive ? `ring-offset-2 ring-2 ${swatch.ring} scale-110` : 'opacity-40 hover:opacity-100'}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destination Icon</label>
                  <div className="grid grid-cols-6 sm:grid-cols-7 md:grid-cols-8 gap-2.5 p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 max-h-[220px] overflow-y-auto scrollbar-hide">
                    {FLAG_OPTIONS.map(flag => (
                      <button 
                        key={flag} 
                        type="button" 
                        onClick={() => setEditTripFlag(flag)}
                        className={`text-2xl p-2 rounded-xl transition-all flex items-center justify-center hover:scale-125 active:scale-95 ${editTripFlag === flag ? 'bg-white shadow-md ring-2 ring-indigo-500' : 'opacity-40 hover:opacity-100 grayscale hover:grayscale-0'}`}
                      >
                        {flag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 sm:p-10">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Active Currencies</h3>
                <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-full shadow-sm">
                  <Star size={12} className="fill-indigo-600" />
                  Default: {trip?.default_currency || 'USD'}
                </div>
              </div>
              <p className="text-slate-400 font-bold text-xs mb-10 uppercase tracking-widest">Configure your preferred markets.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allAvailableCurrencies.map(curr => {
                  const isDefault = trip?.default_currency === curr.code;
                  const isEnabled = tripEnabledCurrencies.includes(curr.code);
                  const isPending = updatingDefaultId === curr.code;
                  
                  return (
                    <div key={curr.code} className="relative group/curr">
                      <button
                        type="button"
                        onClick={() => toggleTripCurrency(curr.code)}
                        className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all font-black ${
                          isEnabled 
                            ? 'border-indigo-600 bg-white shadow-md' 
                            : 'border-slate-50 bg-slate-50/50 grayscale opacity-40'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors ${
                            isEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
                          }`}>{curr.symbol}</span>
                          <span className="text-slate-900">{curr.code}</span>
                        </div>
                        {isEnabled && <Check size={20} strokeWidth={4} className={isDefault ? "text-indigo-600" : "text-indigo-300"} />}
                      </button>
                      
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.preventDefault();
                          e.stopPropagation(); 
                          handleSetDefaultCurrency(curr.code); 
                        }}
                        className={`absolute -top-2 -right-2 p-2 rounded-full shadow-xl transition-all active:scale-90 z-20 ${
                          isDefault 
                            ? 'bg-amber-400 text-white scale-110 rotate-12' 
                            : 'bg-white text-slate-300 hover:text-amber-400 hover:scale-110 opacity-0 group-hover/curr:opacity-100'
                        }`}
                        title="Set as Default"
                      >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} className={isDefault ? 'fill-white' : ''} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-red-50 border-2 border-dashed border-red-100 rounded-[2.5rem] p-12 flex flex-col items-center text-center">
              <div className="bg-red-100 p-5 rounded-[1.5rem] text-red-600 mb-6 shadow-sm"><Trash2 size={32} /></div>
              <h3 className="text-2xl font-black text-red-900">End Journey</h3>
              <p className="text-red-700/60 font-black text-sm max-w-sm mt-3 mb-10 uppercase tracking-tighter">This will permanently purge all history and data. This action is irreversible.</p>
              <button onClick={() => alert("Please use the dashboard delete button to remove this trip.")} className="bg-red-600 text-white px-12 py-5 rounded-[2rem] font-black hover:bg-red-700 shadow-xl shadow-red-100 transition-all active:scale-95 uppercase tracking-widest text-xs">Purge Database Entry</button>
            </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-4 h-28 flex items-center justify-between z-[90] shadow-[0_-12px_40px_rgb(0,0,0,0.08)]">
        <div className="flex flex-1 justify-around items-center">
          <button 
            onClick={() => setActiveTab('expenses')}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'expenses' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Receipt size={24} strokeWidth={activeTab === 'expenses' ? 3 : 2} />
            <span className="text-[10px] font-black uppercase tracking-widest">Expenses</span>
          </button>
          <button 
            onClick={() => setActiveTab('settlements')}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'settlements' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <PieChart size={24} strokeWidth={activeTab === 'settlements' ? 3 : 2} />
            <span className="text-[10px] font-black uppercase tracking-widest">Balances</span>
          </button>
        </div>

        <div className="relative -top-8 px-5">
          <button 
            onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${tripTheme.dot} text-white flex items-center justify-center shadow-2xl shadow-indigo-300 transition-all active:scale-90 hover:scale-110 active:shadow-indigo-500 hover:shadow-indigo-400`}
          >
            <Plus size={40} strokeWidth={4} />
          </button>
        </div>

        <div className="flex flex-1 justify-around items-center">
          <button 
            onClick={() => setActiveTab('people')}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'people' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Users size={24} strokeWidth={activeTab === 'people' ? 3 : 2} />
            <span className="text-[10px] font-black uppercase tracking-widest">People</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Settings size={24} strokeWidth={activeTab === 'settings' ? 3 : 2} />
            <span className="text-[10px] font-black uppercase tracking-widest">Settings</span>
          </button>
        </div>
      </nav>

      {isModalOpen && (
        <AddExpenseModal 
          tripId={tripId} 
          participants={participants}
          expenseToEdit={editingExpense}
          defaultCurrency={trip?.default_currency || 'USD'}
          enabledCurrencies={tripEnabledCurrencies.length > 0 ? tripEnabledCurrencies : ['USD']}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); fetchData(); }}
        />
      )}
    </div>
  );
};
