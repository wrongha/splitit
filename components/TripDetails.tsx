
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Trip, Participant, Expense, Currency, UserProfile } from '../types';
import { 
  ArrowLeft, Plus, Users, Receipt, PieChart, Calendar,
  Trash2, Wallet, RefreshCw, Loader2, Check, X, Edit2, Settings, Star, Save,
  Zap, Lock, AlertTriangle, Info, Globe, RotateCcw, Copy, Archive, PlayCircle, ChevronDown, ChevronUp, UserPlus, Search
} from 'lucide-react';
import { AddExpenseModal, CATEGORY_CONFIG } from './AddExpenseModal';
import { SettlementView } from './SettlementView';
import { FLAG_OPTIONS } from './TripDashboard';

interface TripDetailsProps {
  tripId: string;
  onBack: () => void;
  globalRates: Record<string, number>;
  allAvailableCurrencies: Currency[];
  autoOpenAdd?: boolean;
  currentUser?: UserProfile | null;
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

export const MASCOTS = ['👤', '🐼', '🦊', '🐱', '🐶', '🦄', '🐲', '🐙', '🐢', '🦖', '🐝', '🐬', '🐥', '🐣', '🦊', '🦁', '🐯', '🐧'];

export const getParticipantTheme = (colorKey?: string) => {
  return COLOR_MAP[colorKey || 'indigo'] || COLOR_MAP.indigo;
};

const formatAmount = (val: number) => {
  return val % 1 === 0 
    ? val.toLocaleString(undefined, { maximumFractionDigits: 0 }) 
    : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const TripDetails: React.FC<TripDetailsProps> = ({ 
  tripId, 
  onBack, 
  globalRates,
  allAvailableCurrencies,
  autoOpenAdd,
  currentUser
}) => {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tripEnabledCurrencies, setTripEnabledCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState<'toRealtime' | 'toFixed' | null>(null);
  const [switchBaseCurrency, setSwitchBaseCurrency] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tripDeleteConfirm, setTripDeleteConfirm] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [copyOptionsModal, setCopyOptionsModal] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlements' | 'people' | 'settings'>('expenses');
  
  const [showBreakdown, setShowBreakdown] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tripRes, partRes, expRes, currRes] = await Promise.all([
        supabase.from('trips').select('*').eq('id', tripId).single(),
        supabase.from('participants').select('*').eq('trip_id', tripId).order('name'),
        supabase.from('expenses').select(`*, payers:expense_payers(participant_id, amount_paid), splits:expense_splits(participant_id, share_amount)`).eq('trip_id', tripId).order('updated_at', { ascending: false }),
        supabase.from('trip_currencies').select('currency_code').eq('trip_id', tripId)
      ]);

      if (tripRes.data) {
        const tripData = {
          ...tripRes.data,
          currency_method: tripRes.data.currency_method || 'fixed',
          fixed_rates: tripRes.data.fixed_rates || {}
        };
        setTrip(tripData);
        setPendingFixedRates(tripData.fixed_rates);
        if (!switchBaseCurrency) setSwitchBaseCurrency(tripData.default_currency);
      }
      if (partRes.data) setParticipants(partRes.data);
      if (expRes.data) setExpenses(expRes.data as any);
      if (currRes.data) setTripEnabledCurrencies(currRes.data.map(c => c.currency_code));
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [tripId, switchBaseCurrency]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isCurrentUserParticipating = useMemo(() => {
    if (!currentUser) return false;
    return participants.some(p => p.user_id === currentUser.id || p.name.toLowerCase() === currentUser.name.toLowerCase());
  }, [participants, currentUser]);

  const handleAddMe = async () => {
    if (!currentUser) return;
    setIsJoining(true);
    try {
      const { error } = await supabase.from('participants').insert([{
        trip_id: tripId,
        name: currentUser.name,
        user_id: currentUser.id,
        color: currentUser.color,
        mascot: currentUser.mascot
      }]);
      if (error) throw error;
      
      // Temporary delay to show the feedback popup
      setTimeout(() => {
        setIsJoining(false);
        fetchData();
      }, 1500);
    } catch (err: any) {
      alert("Failed to join trip: " + err.message);
      setIsJoining(false);
    }
  };

  const [editTripName, setEditTripName] = useState('');
  const [editTripFlag, setEditTripFlag] = useState('');
  const [editTripColor, setEditTripColor] = useState('');
  const [pendingFixedRates, setPendingFixedRates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (trip) {
      setEditTripName(trip.name);
      setEditTripFlag(trip.flag_emoji || '✈️');
      setEditTripColor(trip.color_key || 'indigo');
    }
  }, [trip]);

  const handleUpdateTripSettings = async () => {
    setIsSavingSettings(true);
    try {
      const { error } = await supabase.from('trips')
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

  const handleArchiveTrip = async () => {
    if (!trip) return;
    setIsSavingSettings(true);
    try {
      const { error } = await supabase.from('trips')
        .update({ is_archived: !trip.is_archived })
        .eq('id', tripId);
      if (error) throw error;
      setArchiveConfirm(false);
      await fetchData();
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCopyTrip = async (copyExpenses: boolean) => {
    if (!trip) return;
    setIsCopying(true);
    try {
      const { data: newTrip, error: tripErr } = await supabase.from('trips').insert([{
        name: `${trip.name} (Copy)`,
        default_currency: trip.default_currency,
        color_key: trip.color_key,
        flag_emoji: trip.flag_emoji,
        currency_method: trip.currency_method,
        fixed_rates: trip.fixed_rates,
        is_archived: false
      }]).select().single();
      
      if (tripErr) throw tripErr;

      const partInserts = participants.map(p => ({
        trip_id: newTrip.id,
        name: p.name,
        user_id: p.user_id,
        color: p.color,
        mascot: p.mascot
      }));
      
      const currInserts = tripEnabledCurrencies.map(c => ({
        trip_id: newTrip.id,
        currency_code: c
      }));

      await Promise.all([
        supabase.from('participants').insert(partInserts),
        supabase.from('trip_currencies').insert(currInserts)
      ]);

      if (copyExpenses && expenses.length > 0) {
        const { data: newParts } = await supabase.from('participants').select('*').eq('trip_id', newTrip.id);
        const partMap = new Map();
        participants.forEach((oldP) => {
          const newP = newParts?.find(np => np.name === oldP.name);
          if (newP) partMap.set(oldP.id, newP.id);
        });

        for (const exp of expenses) {
          const { data: newExp } = await supabase.from('expenses').insert([{
            trip_id: newTrip.id,
            expense_name: exp.expense_name,
            amount: exp.amount,
            currency: exp.currency,
            exchange_rate: exp.exchange_rate,
            expense_date: exp.expense_date,
            category: exp.category
          }]).select().single();

          if (newExp && exp.payers && exp.splits) {
            const payerInserts = exp.payers.map(p => ({
              expense_id: newExp.id,
              participant_id: partMap.get(p.participant_id),
              amount_paid: p.amount_paid
            }));
            const splitInserts = exp.splits.map(s => ({
              expense_id: newExp.id,
              participant_id: partMap.get(s.participant_id),
              share_amount: s.share_amount
            }));
            await Promise.all([
              supabase.from('expense_payers').insert(payerInserts),
              supabase.from('expense_splits').insert(splitInserts)
            ]);
          }
        }
      }

      alert("Trip cloned successfully! Redirecting...");
      window.location.hash = `#trip/${newTrip.id}`;
      setCopyOptionsModal(false);
    } catch (err: any) {
      alert("Failed to copy trip: " + err.message);
    } finally {
      setIsCopying(false);
    }
  };

  const handleRefreshFixedRates = async () => {
    if (!trip) return;
    setIsRefreshingRates(true);
    try {
      const response = await fetch(`https://api.frankfurter.app/latest?from=${trip.default_currency}`);
      const data = await response.json();
      const newRates = data?.rates || {};
      newRates[trip.default_currency] = 1;
      setPendingFixedRates(newRates);
    } catch (err) { 
      alert("Rate refresh failed."); 
    } finally { 
      setIsRefreshingRates(false); 
    }
  };

  const handleSaveFixedRates = async () => {
    if (!trip) return;
    setIsSavingSettings(true);
    try {
      const ratesToSave = { ...pendingFixedRates };
      ratesToSave[trip.default_currency] = 1.0;

      const { error } = await supabase.from('trips')
        .update({ fixed_rates: ratesToSave })
        .eq('id', tripId);
      
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      alert("Failed to save rates: " + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const usedCurrencies = useMemo(() => {
    return new Set(expenses.map(e => e.currency));
  }, [expenses]);

  const totalSpentInBase = useMemo(() => {
    if (!trip) return 0;
    return expenses
      .filter(e => !e.expense_name.startsWith('Settlement:'))
      .reduce((sum, e) => {
        let rateToUse = 1;
        if (trip.currency_method === 'realtime') {
          rateToUse = e.exchange_rate || 1;
        } else {
          rateToUse = (trip.fixed_rates?.[e.currency] || 1);
        }
        return sum + (Number(e.amount) / rateToUse);
      }, 0);
  }, [expenses, trip]);

  const categoryBreakdown = useMemo(() => {
    if (!trip) return {};
    const breakdown: Record<string, number> = {};
    expenses.forEach(exp => {
      if (exp.expense_name.startsWith('Settlement:')) return;
      let rate = 1;
      if (trip.currency_method === 'realtime') {
        rate = exp.exchange_rate || 1;
      } else {
        rate = trip.fixed_rates?.[exp.currency] || 1;
      }
      const amountInBase = exp.amount / rate;
      const cat = exp.category || 'Others';
      breakdown[cat] = (breakdown[cat] || 0) + amountInBase;
    });
    return breakdown;
  }, [expenses, trip]);

  const participantShare = useMemo(() => {
    if (!trip) return {};
    const map: Record<string, number> = {};
    participants.forEach(p => map[p.id] = 0);
    expenses.forEach(exp => {
      if (exp.expense_name.startsWith('Settlement:')) return;
      let rate = 1;
      if (trip.currency_method === 'realtime') {
        rate = exp.exchange_rate || 1;
      } else {
        rate = trip.fixed_rates?.[exp.currency] || 1;
      }
      exp.splits?.forEach(split => {
        if (map[split.participant_id] !== undefined) {
          map[split.participant_id] += (Number(split.share_amount) / rate);
        }
      });
    });
    return map;
  }, [expenses, participants, trip]);

  const tripTheme = getParticipantTheme(trip?.color_key);

  const ExpenseDonut = () => {
    const categories = CATEGORY_CONFIG.filter(c => (categoryBreakdown[c.id] || 0) > 0);
    if (categories.length === 0 || totalSpentInBase === 0) return null;

    const radius = 12;
    const circumference = 2 * Math.PI * radius;
    let cumulativePercent = 0;

    return (
      <svg viewBox="0 0 32 32" className="w-48 h-48 drop-shadow-lg transform -rotate-90">
        {categories.map((cat) => {
          const amount = categoryBreakdown[cat.id] || 0;
          const percentage = (amount / totalSpentInBase) * 100;
          const strokeDashArray = `${(percentage * circumference) / 100} ${circumference}`;
          const strokeDashOffset = -(cumulativePercent * circumference) / 100;
          cumulativePercent += percentage;
          const strokeColor = cat.id === 'Food' ? '#f97316' : 
                            cat.id === 'Accommodation' ? '#3b82f6' : 
                            cat.id === 'Commute' ? '#6366f1' : 
                            cat.id === 'Flights' ? '#0ea5e9' : 
                            cat.id === 'Entertainment' ? '#a855f7' : 
                            cat.id === 'Shopping' ? '#ec4899' : '#64748b';
          return (
            <circle
              key={cat.id}
              r={radius}
              cx="16"
              cy="16"
              fill="transparent"
              stroke={strokeColor}
              strokeWidth="5"
              strokeDasharray={strokeDashArray}
              strokeDashoffset={strokeDashOffset}
              className="transition-all duration-700 ease-in-out"
            />
          );
        })}
        <circle r="9" cx="16" cy="16" fill="white" className="transform rotate-90 origin-center" />
      </svg>
    );
  };

  return (
    <div className="pb-32 space-y-6 animate-in fade-in duration-500">
      {isJoining && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg animate-bounce">
              <UserPlus size={32} strokeWidth={3} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Adding yourself to this trip...</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Preparing your dashboard</p>
            </div>
            <Loader2 className="animate-spin text-indigo-200 mt-2" size={20} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors w-fit group font-black uppercase text-[9px] tracking-widest">
            <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
            Dashboard
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-4xl drop-shadow-sm">{trip?.flag_emoji}</span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">{trip?.name}</h2>
          {trip?.is_archived && <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest h-fit mt-1">Archived</span>}
          
          {!isCurrentUserParticipating && (
             <button 
              onClick={handleAddMe}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 animate-in zoom-in slide-in-from-left-2"
            >
              <UserPlus size={14} /> Add Me
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className={`${tripTheme.dot} p-6 rounded-[2rem] text-white shadow-xl flex flex-col justify-between relative overflow-hidden group min-h-[140px]`}>
          <div className="absolute -right-4 -bottom-4 bg-white/10 w-28 h-28 rounded-full" />
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md"><Wallet size={20} /></div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80">Total Spend</span>
          </div>
          <div className="mt-4 relative z-10 flex items-baseline gap-1.5">
            <span className="text-3xl sm:text-4xl font-black tracking-tighter">{allAvailableCurrencies.find(c => c.code === trip?.default_currency)?.symbol || '$'}{formatAmount(totalSpentInBase)}</span>
            <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">{trip?.default_currency}</span>
          </div>
        </div>
        <div className="hidden sm:flex bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex-col justify-between">
          <div className="flex justify-between items-start"><div className="bg-indigo-50 p-2 rounded-xl text-indigo-500"><Users size={20} /></div><span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Attendees</span></div>
          <div className="mt-4 font-black text-3xl sm:text-4xl text-slate-800 tracking-tighter">{participants.length}</div>
        </div>
        <div className="hidden sm:flex bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex-col justify-between">
          <div className="flex justify-between items-start"><div className="bg-indigo-50 p-2 rounded-xl text-indigo-500"><Receipt size={20} /></div><span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Entries</span></div>
          <div className="mt-4 font-black text-3xl sm:text-4xl text-slate-800 tracking-tighter">{expenses.length}</div>
        </div>
      </div>

      <div className="py-1">
        {activeTab === 'expenses' && (
          <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
              <button onClick={() => setShowBreakdown(!showBreakdown)} className="w-full px-8 py-5 flex justify-between items-center bg-slate-50/30 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><PieChart size={18} /></div>
                  <span className="text-sm font-black text-slate-800 uppercase tracking-tight">Spending Analysis</span>
                </div>
                {showBreakdown ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
              </button>
              {showBreakdown && (
                <div className="p-8 sm:p-10 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300 flex flex-col md:flex-row gap-10 items-center">
                  <div className="flex-1 space-y-5 w-full">
                    {CATEGORY_CONFIG.map(cat => {
                      const amount = categoryBreakdown[cat.id] || 0;
                      if (amount === 0 && cat.id !== 'Others') return null;
                      const percent = totalSpentInBase > 0 ? (amount / totalSpentInBase) * 100 : 0;
                      return (
                        <div key={cat.id} className="space-y-1.5 group/cat">
                          <div className="flex justify-between items-center px-1">
                            <div className="flex items-center gap-2.5"><div className={`${cat.color} p-1.5 rounded-lg text-white`}><cat.icon size={12} /></div><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{cat.id}</span></div>
                            <div className="text-right"><span className="text-xs font-black text-slate-900">{allAvailableCurrencies.find(c => c.code === trip?.default_currency)?.symbol || '$'}{formatAmount(amount)}</span><span className="text-[9px] text-slate-400 font-bold ml-1.5 opacity-60">{percent.toFixed(0)}%</span></div>
                          </div>
                          <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden"><div className={`h-full ${cat.color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="shrink-0 flex items-center justify-center"><ExpenseDonut /></div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="px-1 font-black text-lg text-slate-900 tracking-tight">Recent Activity</div>
              {expenses.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-16 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">No entries yet.</div>
              ) : (
                expenses.map((expense) => {
                  const payer = participants.find(p => p.id === expense.payers?.[0]?.participant_id);
                  const payerTheme = getParticipantTheme(payer?.color);
                  const symbol = allAvailableCurrencies.find(c => c.code === expense.currency)?.symbol || '$';
                  const catData = CATEGORY_CONFIG.find(c => c.id === expense.category) || CATEGORY_CONFIG[CATEGORY_CONFIG.length - 1];
                  const isBaseCurrency = expense.currency === trip?.default_currency;
                  let amountInBase = 0;
                  if (!isBaseCurrency) {
                    const rateToUse = expense.exchange_rate || (trip?.fixed_rates?.[expense.currency]) || 1;
                    amountInBase = Number(expense.amount) / rateToUse;
                  }
                  return (
                    <div key={expense.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 group hover:border-indigo-200 hover:shadow-lg transition-all overflow-hidden">
                      <div className="shrink-0 relative">
                        <div className={`w-12 h-12 ${catData.color} text-white rounded-xl flex items-center justify-center shadow-md`}><catData.icon size={22} /></div>
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${payerTheme.bg} ${payerTheme.text} rounded-full flex items-center justify-center font-black text-[10px] border-2 border-white shadow-md ring-1 ring-slate-100`}>{payer?.mascot || payer?.name[0]}</div>
                      </div>
                      <div className="flex-1 min-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                          <h4 className="font-black text-slate-800 text-sm tracking-tight truncate">{expense.expense_name}</h4>
                          <div className="text-left sm:text-right">
                            <div className="font-black text-slate-900 text-sm sm:text-base tracking-tighter leading-none">{symbol}{formatAmount(Number(expense.amount))} <span className="text-[9px] text-slate-400 uppercase">{expense.currency}</span></div>
                            {!isBaseCurrency && <div className="text-[9px] font-black text-slate-400 uppercase tracking-tight mt-0.5">≈ {allAvailableCurrencies.find(c => c.code === trip?.default_currency)?.symbol || '$'}{formatAmount(amountInBase)} {trip?.default_currency}</div>}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em]">
                          <span className="flex items-center gap-1"><Calendar size={10} />{expense.expense_date}</span>
                          <span className="opacity-30">•</span>
                          <span className="text-slate-500 font-black">Split with {expense.splits?.length || 0} people</span>
                          <span className="opacity-30">•</span>
                          <span className="text-slate-500 font-black">{catData.id}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {deleteConfirmId !== expense.id ? (
                          <div className="flex gap-0.5">
                            <button onClick={() => { setEditingExpense(expense); setIsModalOpen(true); }} className="text-slate-300 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg transition-all"><Edit2 size={16} /></button>
                            <button onClick={() => setDeleteConfirmId(expense.id)} className="text-slate-300 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 animate-in zoom-in-95">
                            <button onClick={(e) => { e.stopPropagation(); fetchData(); }} className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 shadow-md transition-all active:scale-90"><Check size={14} /></button>
                            <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 p-2 rounded-lg hover:bg-slate-200 transition-all"><X size={14} /></button>
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
          <SettlementView tripId={tripId} expenses={expenses} participants={participants} rates={trip?.currency_method === 'realtime' ? globalRates : trip?.fixed_rates || {}} enabledCurrencies={tripEnabledCurrencies} baseCurrency={trip?.default_currency || 'USD'} onSettled={() => { fetchData(); setActiveTab('expenses'); }} />
        )}

        {activeTab === 'people' && (
          <div className="space-y-6">
            <button 
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-3 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:border-indigo-500 transition-all w-full text-left group"
            >
              <div className="bg-indigo-100 p-4 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform"><UserPlus size={24} /></div>
              <div>
                <span className="font-black text-slate-900 block tracking-tight">Invite People</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grow the adventure</span>
              </div>
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {participants.map((p) => {
                const theme = getParticipantTheme(p.color);
                return (
                  <div key={p.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-100 transition-all flex flex-col gap-4 group">
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 w-12 h-12 ${theme.bg} ${theme.text} rounded-xl flex items-center justify-center font-black text-2xl shadow-inner`}>{p.mascot || p.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <span className="font-black text-lg text-slate-800 block leading-tight tracking-tight truncate">{p.name}</span>
                        <div className="mt-0.5 flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Spent</span><span className={`text-[11px] font-black ${theme.text}`}>{allAvailableCurrencies.find(c => c.code === trip?.default_currency)?.symbol || '$'}{formatAmount(participantShare[p.id] || 0)}</span></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div><h3 className="text-xl font-black text-slate-900 tracking-tight leading-none">Trip Settings</h3><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Configuration Hub</p></div>
                <button onClick={handleUpdateTripSettings} disabled={isSavingSettings} className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100">{isSavingSettings ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}{isSavingSettings ? 'Saving...' : 'Save DNA'}</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Trip Name</label><input type="text" className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-white focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all text-sm" value={editTripName} onChange={e => setEditTripName(e.target.value)} /></div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Theme Color</label>
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-xl border-2 border-slate-100">
                      {Object.keys(COLOR_MAP).map(colorKey => {
                        const swatch = COLOR_MAP[colorKey];
                        return <button key={colorKey} type="button" onClick={() => setEditTripColor(colorKey)} className={`w-8 h-8 rounded-full ${swatch.dot} transition-all hover:scale-110 ${editTripColor === colorKey ? `ring-offset-2 ring-2 ${swatch.ring} scale-110` : 'opacity-30 hover:opacity-100'}`} />;
                      })}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Destination Icon</label>
                  <div className="grid grid-cols-6 sm:grid-cols-7 md:grid-cols-8 gap-2 p-4 bg-slate-50 rounded-xl border-2 border-slate-100 max-h-[110px] overflow-y-auto scrollbar-hide">
                    {FLAG_OPTIONS.map(flag => (
                      <button key={flag} type="button" onClick={() => setEditTripFlag(flag)} className={`text-xl p-1.5 rounded-lg transition-all flex items-center justify-center hover:scale-110 active:scale-90 ${editTripFlag === flag ? 'bg-white shadow-md ring-2 ring-indigo-50' : 'opacity-30 grayscale'}`}>{flag}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-4 h-16 flex items-center justify-between z-[90] shadow-[0_-10px_30px_rgb(0,0,0,0.06)]">
        <div className="flex flex-1 justify-around items-center">
          <button onClick={() => setActiveTab('expenses')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'expenses' ? 'text-indigo-600' : 'text-slate-400'}`}><Receipt size={18} strokeWidth={activeTab === 'expenses' ? 3 : 2} /><span className="text-[8px] font-black uppercase tracking-widest">Expenses</span></button>
          <button onClick={() => setActiveTab('settlements')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'settlements' ? 'text-indigo-600' : 'text-slate-400'}`}><PieChart size={18} strokeWidth={activeTab === 'settlements' ? 3 : 2} /><span className="text-[8px] font-black uppercase tracking-widest">Balances</span></button>
        </div>
        <div className="relative -top-5 px-4"><button onClick={() => { setEditingExpense(null); setIsModalOpen(true); }} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${tripTheme.dot} text-white flex items-center justify-center shadow-xl transition-all active:scale-90 hover:scale-110`}><Plus size={28} strokeWidth={4} /></button></div>
        <div className="flex flex-1 justify-around items-center">
          <button onClick={() => setActiveTab('people')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'people' ? 'text-indigo-600' : 'text-slate-400'}`}><Users size={18} strokeWidth={activeTab === 'people' ? 3 : 2} /><span className="text-[8px] font-black uppercase tracking-widest">People</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-400'}`}><Settings size={18} strokeWidth={activeTab === 'settings' ? 3 : 2} /><span className="text-[8px] font-black uppercase tracking-widest">Settings</span></button>
        </div>
      </nav>

      {isInviteModalOpen && (
        <InviteParticipantsModal 
          tripId={tripId}
          existingParticipants={participants}
          currentUser={currentUser}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={() => { setIsInviteModalOpen(false); fetchData(); }}
        />
      )}

      {isModalOpen && trip && (
        <AddExpenseModal 
            trip={trip} 
            participants={participants} 
            expenseToEdit={editingExpense} 
            enabledCurrencies={tripEnabledCurrencies.length > 0 ? tripEnabledCurrencies : ['USD']} 
            currentUser={currentUser}
            onClose={() => setIsModalOpen(false)} 
            onSuccess={() => { setIsModalOpen(false); fetchData(); setActiveTab('expenses'); }} 
        />
      )}
    </div>
  );
};

interface InviteParticipantsModalProps {
  tripId: string;
  existingParticipants: Participant[];
  currentUser?: UserProfile | null;
  onClose: () => void;
  onSuccess: () => void;
}

const InviteParticipantsModal: React.FC<InviteParticipantsModalProps> = ({ tripId, existingParticipants, currentUser, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [companions, setCompanions] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMascot, setNewMascot] = useState(MASCOTS[0]);
  const [inviteLoading, setInviteLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanions();
  }, [currentUser]);

  const fetchCompanions = async () => {
    setLoading(true);
    try {
      if (!currentUser) return;
      // 1. Find all trips user participated in
      const { data: myTrips } = await supabase.from('participants').select('trip_id').eq('user_id', currentUser.id);
      const tripIds = myTrips?.map(t => t.trip_id) || [];
      
      // 2. Count frequency of other participants in those trips
      let results: UserProfile[] = [];
      if (tripIds.length > 0) {
        const { data: others } = await supabase.from('participants').select('name, user_id, mascot, color').in('trip_id', tripIds).neq('user_id', currentUser.id);
        const map = new Map<string, { profile: UserProfile, count: number }>();
        others?.forEach(p => {
          if (!p.user_id) return;
          const entry = map.get(p.user_id) || { profile: { id: p.user_id, name: p.name, mascot: p.mascot || '👤', color: p.color || 'indigo' }, count: 0 };
          entry.count++;
          map.set(p.user_id, entry);
        });
        results = Array.from(map.values()).sort((a, b) => b.count - a.count).map(e => e.profile);
      }

      // 3. Fallback: just fetch some other users
      if (results.length < 10) {
        const { data: globalUsers } = await supabase.from('users').select('*').limit(20);
        globalUsers?.forEach(u => {
          if (u.id !== currentUser.id && !results.find(r => r.id === u.id)) {
            results.push({ id: u.id, name: u.name, mascot: u.mascot || '👤', color: u.color || 'indigo' });
          }
        });
      }
      setCompanions(results);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const filteredCompanions = useMemo(() => {
    return companions.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) && 
      !existingParticipants.some(p => p.user_id === c.id || p.name.toLowerCase() === c.name.toLowerCase())
    );
  }, [companions, search, existingParticipants]);

  const handleInviteExisting = async (user: UserProfile) => {
    setInviteLoading(user.id || user.name);
    try {
      const { error } = await supabase.from('participants').insert([{
        trip_id: tripId,
        name: user.name,
        user_id: user.id,
        color: user.color,
        mascot: user.mascot
      }]);
      if (error) throw error;
      onSuccess();
    } catch (err: any) { alert(err.message); } finally { setInviteLoading(null); }
  };

  const handleAddNewParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || inviteLoading) return;
    
    const normalizedName = newName.trim();
    if (existingParticipants.some(p => p.name.toLowerCase() === normalizedName.toLowerCase())) {
      alert("A participant with this name already exists in this trip.");
      return;
    }

    setInviteLoading('new');
    try {
      const colorKeys = Object.keys(COLOR_MAP);
      const randomColor = colorKeys[Math.floor(Math.random() * colorKeys.length)];
      
      // Check global user table
      const { data: globalMatch } = await supabase.from('users').select('*').ilike('name', normalizedName).single();
      
      let finalUserId = globalMatch?.id;
      if (!globalMatch) {
        const { data: newUser, error: userError } = await supabase.from('users').insert([{
          name: normalizedName,
          mascot: newMascot,
          color: randomColor
        }]).select().single();
        if (userError) throw userError;
        finalUserId = newUser.id;
      }

      const { error: pError } = await supabase.from('participants').insert([{
        trip_id: tripId,
        name: normalizedName,
        user_id: finalUserId,
        color: randomColor,
        mascot: globalMatch?.mascot || newMascot
      }]);
      if (pError) throw pError;
      onSuccess();
    } catch (err: any) { alert(err.message); } finally { setInviteLoading(null); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Invite Participant</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full"><X size={24} strokeWidth={3} /></button>
        </div>

        <div className="flex bg-slate-50 p-1.5 gap-1 m-4 rounded-2xl border border-slate-200 shadow-inner">
          <button onClick={() => setActiveTab('existing')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'existing' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Existing Users</button>
          <button onClick={() => setActiveTab('new')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'new' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Add New</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {activeTab === 'existing' ? (
            <>
              <div className="relative mb-2 px-2">
                <input type="text" placeholder="Search global users..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 outline-none text-sm font-bold shadow-sm" value={search} onChange={e => setSearch(e.target.value)} />
                <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
              </div>
              <div className="space-y-2">
                {loading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
                ) : filteredCompanions.length === 0 ? (
                  <div className="text-center py-20 text-slate-300 font-black uppercase tracking-widest text-[10px]">No users found</div>
                ) : (
                  filteredCompanions.map(c => (
                    <button key={c.id} onClick={() => handleInviteExisting(c)} disabled={!!inviteLoading} className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all bg-white shadow-sm group active:scale-95">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${getParticipantTheme(c.color).bg} ${getParticipantTheme(c.color).text} flex items-center justify-center font-black text-xl`}>{c.mascot}</div>
                        <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                      </div>
                      <div className="bg-indigo-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        {inviteLoading === c.id ? <Loader2 className="animate-spin" size={14} /> : <UserPlus size={14} />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleAddNewParticipant} className="space-y-6 px-2 animate-in slide-in-from-bottom-2">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <input required autoFocus type="text" placeholder="e.g. John Doe" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mascot</label>
                <div className="grid grid-cols-6 gap-2 p-3 bg-slate-50 rounded-2xl border-2 border-slate-100">
                  {MASCOTS.map(m => (
                    <button key={m} type="button" onClick={() => setNewMascot(m)} className={`text-2xl p-2 rounded-xl transition-all flex items-center justify-center ${newMascot === m ? 'bg-white shadow-md ring-2 ring-indigo-500' : 'opacity-40 hover:opacity-100'}`}>{m}</button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={!newName.trim() || !!inviteLoading} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-slate-100">
                {inviteLoading === 'new' ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />} Create & Invite
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
