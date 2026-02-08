
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Trip, Participant, Expense, Currency } from '../types';
import { 
  ArrowLeft, Plus, Users, Receipt, PieChart, Calendar,
  Trash2, Wallet, RefreshCw, Loader2, Check, X, Edit2, Settings, Star, Save,
  Zap, Lock, AlertTriangle, Info, Globe, RotateCcw, Copy, Archive, PlayCircle, ChevronDown, ChevronUp
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
  autoOpenAdd
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
  
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tripDeleteConfirm, setTripDeleteConfirm] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [copyOptionsModal, setCopyOptionsModal] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlements' | 'people' | 'settings'>('expenses');
  const [newParticipantName, setNewParticipantName] = useState('');

  const [editTripName, setEditTripName] = useState('');
  const [editTripFlag, setEditTripFlag] = useState('');
  const [editTripColor, setEditTripColor] = useState('');
  const [pendingFixedRates, setPendingFixedRates] = useState<Record<string, number>>({});
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
        setEditTripName(tripData.name);
        setEditTripFlag(tripData.flag_emoji || '✈️');
        setEditTripColor(tripData.color_key || 'indigo');
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

  useEffect(() => {
    if (autoOpenAdd && !loading && participants.length > 0 && !hasAutoOpened) {
      setIsModalOpen(true);
      setHasAutoOpened(true);
    }
  }, [autoOpenAdd, loading, participants, hasAutoOpened]);

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

  const handleDeleteEntireTrip = async () => {
    if (!trip) return;
    setDeletingId(trip.id);
    try {
      const { error } = await supabase.from('trips').delete().eq('id', trip.id);
      if (error) throw error;
      onBack();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeletingId(null);
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

  const handleRevertFixedRates = () => {
    if (trip) setPendingFixedRates(trip.fixed_rates || {});
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

  const handleManualRateChange = (code: string, newRate: string) => {
    if (code === trip?.default_currency) return;
    const rateVal = parseFloat(newRate);
    if (isNaN(rateVal)) return;

    setPendingFixedRates(prev => ({
      ...prev,
      [code]: rateVal
    }));
  };

  const handleSwitchStrategy = async (to: 'realtime' | 'fixed') => {
    if (!trip) return;
    setIsSavingSettings(true);
    try {
      const targetBase = to === 'realtime' ? switchBaseCurrency : trip.default_currency;
      
      const response = await fetch(`https://api.frankfurter.app/latest?from=${targetBase}`);
      const data = await response.json();
      const newRates = data?.rates || {};
      newRates[targetBase] = 1;
      
      const { error } = await supabase.from('trips').update({
        currency_method: to,
        default_currency: targetBase,
        fixed_rates: newRates
      }).eq('id', tripId);
      
      if (error) throw error;
      
      if (to === 'realtime') {
        await supabase.from('trip_currencies').upsert([{ trip_id: tripId, currency_code: targetBase }]);
      }
      
      setShowSwitchConfirm(null);
      await fetchData();
    } catch (err: any) { 
      console.error("Switch error:", err);
      alert("Switch failed. Ensure you have a stable internet connection."); 
    } finally { 
      setIsSavingSettings(false); 
    }
  };

  const handleSetDefaultCurrency = async (code: string) => {
    if (!trip || trip.default_currency === code) return;
    if (trip.currency_method === 'realtime') {
      alert("Base currency is locked in Real-time mode.");
      return;
    }
    try {
      const response = await fetch(`https://api.frankfurter.app/latest?from=${code}`);
      const data = await response.json();
      const newRates = data?.rates || {};
      newRates[code] = 1;

      await supabase.from('trips').update({ default_currency: code, fixed_rates: newRates }).eq('id', tripId);
      await supabase.from('trip_currencies').upsert([{ trip_id: tripId, currency_code: code }]);
      await fetchData();
    } catch (err) { fetchData(); }
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

  const ratesChanged = useMemo(() => {
    if (!trip || !trip.fixed_rates) return false;
    const codes = Object.keys(pendingFixedRates);
    if (codes.length !== Object.keys(trip.fixed_rates).length) return true;
    return codes.some(c => pendingFixedRates[c] !== trip.fixed_rates[c]);
  }, [pendingFixedRates, trip]);

  const defaultCurrency = trip?.default_currency || 'USD';
  const defaultCurrencySymbol = allAvailableCurrencies.find(c => c.code === defaultCurrency)?.symbol || '$';

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

  const handleConfirmDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      setDeleteConfirmId(null);
      await fetchData();
    } catch (err: any) { alert("Delete failed: " + err.message); } finally { setDeletingId(null); }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipantName.trim()) return;
    try {
      const colorKeys = Object.keys(COLOR_MAP);
      const randomColor = colorKeys[Math.floor(Math.random() * colorKeys.length)];
      const randomMascot = MASCOTS[Math.floor(Math.random() * MASCOTS.length)];

      const { error } = await supabase.from('participants').insert([{
        trip_id: tripId,
        name: newParticipantName.trim(),
        color: randomColor,
        mascot: randomMascot
      }]);
      if (error) throw error;
      setNewParticipantName('');
      await fetchData();
    } catch (err: any) { alert("Add failed: " + err.message); }
  };

  const handleUpdateParticipantName = async (id: string, name: string) => {
    if (!name.trim()) return;
    try {
      const { error } = await supabase.from('participants').update({ name: name.trim() }).eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err: any) { alert("Update failed: " + err.message); }
  };

  const toggleTripCurrency = async (code: string) => {
    const isEnabled = tripEnabledCurrencies.includes(code);
    if (isEnabled) {
      if (tripEnabledCurrencies.length <= 1) return;
      if (trip?.default_currency === code) {
         alert("Cannot disable base currency.");
         return;
      }
      if (usedCurrencies.has(code)) {
        alert("Cannot disable currency because it is used in existing expenses.");
        return;
      }
      try {
        await supabase.from('trip_currencies').delete().eq('trip_id', tripId).eq('currency_code', code);
        const { data } = await supabase.from('trip_currencies').select('currency_code').eq('trip_id', tripId);
        if (data) setTripEnabledCurrencies(data.map(c => c.currency_code));
      } catch (err: any) { alert("Update failed: " + err.message); }
    } else {
      try {
        await supabase.from('trip_currencies').insert([{ trip_id: tripId, currency_code: code }]);
        const { data } = await supabase.from('trip_currencies').select('currency_code').eq('trip_id', tripId);
        if (data) setTripEnabledCurrencies(data.map(c => c.currency_code));
      } catch (err: any) { alert("Update failed: " + err.message); }
    }
  };

  const currentCurrencyMethod = trip?.currency_method || 'fixed';

  // Accurate Donut Chart Component
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
      <div className="flex flex-col gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors w-fit group font-black uppercase text-[9px] tracking-widest">
          <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
          Dashboard
        </button>
        <div className="flex items-center gap-4">
          <span className="text-4xl drop-shadow-sm">{trip?.flag_emoji}</span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">{trip?.name}</h2>
          {trip?.is_archived && <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest h-fit mt-1">Archived</span>}
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
            <span className="text-3xl sm:text-4xl font-black tracking-tighter">{defaultCurrencySymbol}{formatAmount(totalSpentInBase)}</span>
            <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">{defaultCurrency}</span>
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
              <button 
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="w-full px-8 py-5 flex justify-between items-center bg-slate-50/30 hover:bg-slate-50 transition-colors"
              >
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
                            <div className="text-right"><span className="text-xs font-black text-slate-900">{defaultCurrencySymbol}{formatAmount(amount)}</span><span className="text-[9px] text-slate-400 font-bold ml-1.5 opacity-60">{percent.toFixed(0)}%</span></div>
                          </div>
                          <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden"><div className={`h-full ${cat.color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="shrink-0 flex items-center justify-center">
                    <ExpenseDonut />
                  </div>
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
                  
                  const isBaseCurrency = expense.currency === defaultCurrency;
                  let amountInBase = 0;
                  if (!isBaseCurrency) {
                    const rateToUse = expense.exchange_rate || (trip?.fixed_rates?.[expense.currency]) || 1;
                    amountInBase = Number(expense.amount) / rateToUse;
                  }

                  const splitCount = expense.splits?.length || 0;
                  const splitWithNames = expense.splits?.map(s => participants.find(p => p.id === s.participant_id)?.name).filter(Boolean).join(', ');

                  return (
                    <div key={expense.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 group hover:border-indigo-200 hover:shadow-lg transition-all overflow-hidden">
                      <div className="shrink-0 relative">
                        <div className={`w-12 h-12 ${catData.color} text-white rounded-xl flex items-center justify-center shadow-md`}>
                          <catData.icon size={22} />
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${payerTheme.bg} ${payerTheme.text} rounded-full flex items-center justify-center font-black text-[10px] border-2 border-white shadow-md ring-1 ring-slate-100`}>
                          {payer?.mascot || payer?.name[0]}
                        </div>
                      </div>
                      <div className="flex-1 min-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                          <h4 className="font-black text-slate-800 text-sm tracking-tight truncate">{expense.expense_name}</h4>
                          <div className="text-left sm:text-right">
                            <div className="font-black text-slate-900 text-sm sm:text-base tracking-tighter leading-none">
                              {symbol}{formatAmount(Number(expense.amount))} <span className="text-[9px] text-slate-400 uppercase">{expense.currency}</span>
                            </div>
                            {!isBaseCurrency && (
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-tight mt-0.5">
                                ≈ {defaultCurrencySymbol}{formatAmount(amountInBase)} {defaultCurrency}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em]">
                          <span className="flex items-center gap-1"><Calendar size={10} />{expense.expense_date}</span>
                          <span className="opacity-30">•</span>
                          <span className="text-slate-500 font-black" title={splitWithNames}>Split with {splitCount} people</span>
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
                            <button onClick={(e) => handleConfirmDelete(e, expense.id)} className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 shadow-md transition-all active:scale-90">{deletingId === expense.id ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}</button>
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
          <SettlementView tripId={tripId} expenses={expenses} participants={participants} rates={currentCurrencyMethod === 'realtime' ? globalRates : trip?.fixed_rates || {}} enabledCurrencies={tripEnabledCurrencies} baseCurrency={defaultCurrency} onSettled={() => { fetchData(); setActiveTab('expenses'); }} />
        )}

        {activeTab === 'people' && (
          <div className="space-y-6">
            <form onSubmit={handleAddParticipant} className="flex gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm focus-within:border-indigo-500 transition-all max-w-xl">
              <input type="text" placeholder="Add participant name..." className="flex-1 px-4 py-3 outline-none font-bold text-slate-900 placeholder:text-slate-300 bg-white rounded-xl text-sm" value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} />
              <button type="submit" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black hover:bg-indigo-700 transition-all uppercase tracking-widest text-[10px]">Invite</button>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {participants.map((p) => {
                const theme = getParticipantTheme(p.color);
                const share = (participantShare[p.id] || 0);
                return (
                  <div key={p.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-100 transition-all flex flex-col gap-4 group">
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 w-12 h-12 ${theme.bg} ${theme.text} rounded-xl flex items-center justify-center font-black text-2xl shadow-inner`}>{p.mascot || p.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <input type="text" defaultValue={p.name} onBlur={(e) => handleUpdateParticipantName(p.id, e.target.value)} className="font-black text-lg text-slate-800 block leading-tight tracking-tight bg-transparent border-none focus:ring-1 focus:ring-indigo-100 rounded-lg w-full outline-none px-1 -ml-1 transition-all truncate" />
                        <div className="mt-0.5 flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Spent</span><span className={`text-[11px] font-black ${theme.text}`}>{defaultCurrencySymbol}{formatAmount(share)}</span></div>
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

              <div className="pt-2 pb-4 border-b border-slate-50 space-y-3">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Base Selection</h4>
                  {currentCurrencyMethod === 'realtime' ? (
                    <span className="text-[9px] font-black text-amber-500 uppercase flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md"><Lock size={10} /> Mode Locked</span>
                  ) : (
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 w-full sm:w-auto">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Currency</span>
                      <select 
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer flex-1"
                        value={trip?.default_currency}
                        onChange={(e) => handleSetDefaultCurrency(e.target.value)}
                      >
                        {tripEnabledCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Trip Name</label><input type="text" className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-white focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all text-sm" value={editTripName} onChange={e => setEditTripName(e.target.value)} /></div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Theme Color</label>
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-xl border-2 border-slate-100">
                      {Object.keys(COLOR_MAP).map(colorKey => {
                        const swatch = COLOR_MAP[colorKey];
                        const isActive = editTripColor === colorKey;
                        return <button key={colorKey} type="button" onClick={() => setEditTripColor(colorKey)} className={`w-8 h-8 rounded-full ${swatch.dot} transition-all hover:scale-110 ${isActive ? `ring-offset-2 ring-2 ${swatch.ring} scale-110` : 'opacity-30 hover:opacity-100'}`} />;
                      })}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Destination Icon</label>
                  <div className="grid grid-cols-6 sm:grid-cols-7 md:grid-cols-8 gap-2 p-4 bg-slate-50 rounded-xl border-2 border-slate-100 max-h-[110px] overflow-y-auto scrollbar-hide">
                    {FLAG_OPTIONS.map(flag => (
                      <button key={flag} type="button" onClick={() => setEditTripFlag(flag)} className={`text-xl p-1.5 rounded-lg transition-all flex items-center justify-center hover:scale-110 active:scale-90 ${editTripFlag === flag ? 'bg-white shadow-md ring-2 ring-indigo-500' : 'opacity-30 hover:opacity-100 grayscale hover:grayscale-0'}`}>{flag}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 space-y-4">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Management Vault</h4>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => setArchiveConfirm(true)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${trip?.is_archived ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                  >
                    {trip?.is_archived ? <><PlayCircle size={12} /> Un-archive Trip</> : <><Archive size={12} /> Archive Trip</>}
                  </button>
                  <button 
                    onClick={() => setCopyOptionsModal(true)}
                    disabled={isCopying}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    {isCopying ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />} Clone Trip
                  </button>
                  <button 
                    onClick={() => setTripDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest bg-red-50 text-red-600 hover:bg-red-100 transition-all ml-auto"
                  >
                    <Trash2 size={12} /> Purge
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 sm:p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div><h3 className="text-xl font-black text-slate-900 tracking-tight leading-none">Currency Strategy</h3><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Conversion Mode</p></div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-[9px] uppercase tracking-widest ${currentCurrencyMethod === 'realtime' ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200'}`}>
                  {currentCurrencyMethod === 'realtime' ? <Zap size={10} /> : <Lock size={10} />} {currentCurrencyMethod} mode
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div className={`p-5 rounded-2xl border-2 transition-all ${currentCurrencyMethod === 'fixed' ? 'border-indigo-600 bg-white shadow-md ring-2 ring-indigo-600 ring-offset-2' : 'border-slate-50 bg-slate-50 opacity-50'}`}>
                    <div className="flex items-center gap-1.5 font-black text-slate-900 mb-1.5 text-xs"><Lock size={14} className="text-indigo-600" /> Fixed Mode</div>
                    <p className="text-[9px] text-slate-400 font-bold leading-tight mb-3 uppercase">Locked valuation logic.</p>
                    {currentCurrencyMethod === 'fixed' ? (
                      <button onClick={handleRefreshFixedRates} disabled={isRefreshingRates} className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                        {isRefreshingRates ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Update Values
                      </button>
                    ) : (
                      <button onClick={() => setShowSwitchConfirm('toFixed')} className="flex items-center gap-1.5 border border-slate-200 text-slate-500 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all">Enable Fixed</button>
                    )}
                 </div>

                 <div className={`p-5 rounded-2xl border-2 transition-all ${currentCurrencyMethod === 'realtime' ? 'border-amber-600 bg-white shadow-md ring-2 ring-amber-600 ring-offset-2' : 'border-slate-50 bg-slate-50 opacity-50'}`}>
                    <div className="flex items-center gap-1.5 font-black text-slate-900 mb-1.5 text-xs"><Zap size={14} className="text-amber-600" /> Dynamic Mode</div>
                    <p className="text-[9px] text-slate-400 font-bold leading-tight mb-3 uppercase">Live historical fetching.</p>
                    {currentCurrencyMethod === 'realtime' ? (
                      <div className="text-[9px] font-black text-amber-600 uppercase flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md">Live Strategy Active</div>
                    ) : (
                      <button onClick={() => setShowSwitchConfirm('toRealtime')} className="flex items-center gap-1.5 border border-slate-200 text-slate-500 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all">Enable Live</button>
                    )}
                 </div>
              </div>

              {currentCurrencyMethod === 'fixed' && pendingFixedRates && (
                <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rate Vault (to {trip?.default_currency})</h4>
                    {ratesChanged && (
                      <div className="flex gap-2 animate-in slide-in-from-right-1">
                        <button onClick={handleSaveFixedRates} disabled={isSavingSettings} className="flex items-center gap-1 bg-emerald-600 text-white px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all shadow-md">
                          <Check size={10} /> Save
                        </button>
                        <button onClick={handleRevertFixedRates} className="flex items-center gap-1 bg-slate-200 text-slate-600 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all">
                          <RotateCcw size={10} /> Revert
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Object.entries(pendingFixedRates)
                      .filter(([code]) => tripEnabledCurrencies.includes(code))
                      .sort(([a], [b]) => a === trip?.default_currency ? -1 : b === trip?.default_currency ? 1 : a.localeCompare(b))
                      .map(([code, rate]) => {
                        const isBase = code === trip?.default_currency;
                        const isChanged = trip?.fixed_rates?.[code] !== rate;
                        return (
                          <div key={code} className={`bg-white px-3 py-2 rounded-xl border-2 transition-all flex justify-between items-center group/rate ${isBase ? 'border-indigo-50 bg-indigo-50/10' : isChanged ? 'border-emerald-500' : 'border-slate-100 shadow-sm'}`}>
                            <div className="flex flex-col">
                              <span className="font-black text-[9px] text-slate-600 uppercase">{code}</span>
                              {isBase && <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Base</span>}
                            </div>
                            <input 
                              type="number" 
                              step="0.001"
                              disabled={isBase}
                              value={rate}
                              onChange={(e) => handleManualRateChange(code, e.target.value)}
                              className={`font-bold text-xs text-right bg-transparent border-none outline-none w-16 px-1 rounded transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isBase ? 'text-slate-300' : 'text-indigo-600 focus:bg-indigo-50'}`}
                            />
                          </div>
                        );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Wallet Options</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {allAvailableCurrencies.map(curr => {
                    const isDefault = trip?.default_currency === curr.code;
                    const isEnabled = tripEnabledCurrencies.includes(curr.code);
                    const isUsed = usedCurrencies.has(curr.code);
                    return (
                      <div key={curr.code} className="relative group/curr">
                        <button 
                          onClick={() => toggleTripCurrency(curr.code)} 
                          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all font-black ${isEnabled ? 'border-indigo-600 bg-white shadow-sm' : 'border-white bg-white/50 opacity-40 hover:opacity-100'} ${isUsed && isEnabled ? 'cursor-not-allowed opacity-100' : ''}`}
                        >
                          <div className="flex items-center gap-2"><span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${isEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{curr.symbol}</span><span className="text-slate-900 text-[10px]">{curr.code}</span></div>
                          {isEnabled && <Check size={14} strokeWidth={4} className={isDefault ? "text-indigo-600" : "text-indigo-200"} />}
                        </button>
                        {isEnabled && isUsed && (
                          <div className="absolute -bottom-1 -left-1 bg-slate-900 text-white p-1 rounded-md scale-[0.6] opacity-0 group-hover/curr:opacity-100 transition-opacity">
                            <Lock size={12} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-4 h-16 flex items-center justify-between z-[90] shadow-[0_-10px_30px_rgb(0,0,0,0.06)]">
        <div className="flex flex-1 justify-around items-center">
          <button onClick={() => setActiveTab('expenses')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'expenses' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><Receipt size={18} strokeWidth={activeTab === 'expenses' ? 3 : 2} /><span className="text-[8px] font-black uppercase tracking-widest">Expenses</span></button>
          <button onClick={() => setActiveTab('settlements')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'settlements' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><PieChart size={18} strokeWidth={activeTab === 'settlements' ? 3 : 2} /><span className="text-[8px] font-black uppercase tracking-widest">Balances</span></button>
        </div>
        <div className="relative -top-5 px-4"><button onClick={() => { setEditingExpense(null); setIsModalOpen(true); }} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${tripTheme.dot} text-white flex items-center justify-center shadow-xl transition-all active:scale-90 hover:scale-110`}><Plus size={28} strokeWidth={4} /></button></div>
        <div className="flex flex-1 justify-around items-center">
          <button onClick={() => setActiveTab('people')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'people' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><Users size={18} strokeWidth={activeTab === 'people' ? 3 : 2} /><span className="text-[8px] font-black uppercase tracking-widest">People</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><Settings size={18} strokeWidth={activeTab === 'settings' ? 3 : 2} /><span className="text-[8px] font-black uppercase tracking-widest">Settings</span></button>
        </div>
      </nav>

      {showSwitchConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 text-center text-slate-900 animate-in zoom-in-95 duration-200">
              <div className="bg-amber-50 w-16 h-16 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-4"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-black mb-2 tracking-tight">Strategy Adjustment</h3>
              <div className="text-slate-500 font-bold text-xs uppercase leading-relaxed mb-6 space-y-3">
                {showSwitchConfirm === 'toRealtime' ? (
                  <>
                    <p className="text-amber-700">⚠️ Existing records keep their logged valuation.</p>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <p className="text-slate-900">Current Base: {defaultCurrency}</p>
                      <p className="text-[9px] text-red-500">Note: This locked selection maintains historical integrity.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p>ℹ️ Future records will follow the latest synced rates.</p>
                    <p>ℹ️ Base selection becomes modifiable again.</p>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-2">
                 <button onClick={() => handleSwitchStrategy(showSwitchConfirm === 'toRealtime' ? 'realtime' : 'fixed')} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all text-xs">Authorize Change</button>
                 <button onClick={() => setShowSwitchConfirm(null)} className="w-full text-slate-400 font-black uppercase tracking-widest py-2 text-[10px] hover:text-slate-600">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {archiveConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 text-center text-slate-900 animate-in zoom-in-95 duration-200">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${trip?.is_archived ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                {trip?.is_archived ? <PlayCircle size={32} /> : <Archive size={32} />}
              </div>
              <h3 className="text-xl font-black mb-2 tracking-tight">{trip?.is_archived ? 'Activate Trip' : 'Archive Trip'}</h3>
              <p className="text-slate-500 font-bold text-xs uppercase leading-relaxed mb-6">
                {trip?.is_archived 
                  ? "Move this trip back to your active list? It will be fully editable again."
                  : "Move this trip to the vault? It will be hidden from your main board. You can un-archive it at any time in the future."}
              </p>
              <div className="flex flex-col gap-2">
                 <button onClick={handleArchiveTrip} className={`w-full text-white py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all text-xs ${trip?.is_archived ? 'bg-indigo-600' : 'bg-amber-600'}`}>
                   {trip?.is_archived ? 'Restore Trip' : 'Archive Now'}
                 </button>
                 <button onClick={() => setArchiveConfirm(false)} className="w-full text-slate-400 font-black uppercase tracking-widest py-2 text-[10px] hover:text-slate-600">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {copyOptionsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 text-center text-slate-900 animate-in zoom-in-95 duration-200">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center text-slate-600 mx-auto mb-4"><Copy size={32} /></div>
              <h3 className="text-xl font-black mb-2 tracking-tight">Clone Strategy</h3>
              <p className="text-slate-500 font-bold text-xs uppercase leading-relaxed mb-8">
                How would you like to duplicate this adventure?
              </p>
              <div className="flex flex-col gap-3">
                 <button onClick={() => handleCopyTrip(false)} className="w-full bg-slate-100 text-slate-700 py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all text-xs border border-slate-200">
                    Just Settings & People
                 </button>
                 <button onClick={() => handleCopyTrip(true)} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all text-xs shadow-lg shadow-indigo-100">
                    Settings + All Expenses
                 </button>
                 <button onClick={() => setCopyOptionsModal(false)} className="w-full text-slate-400 font-black uppercase tracking-widest py-2 text-[10px] hover:text-slate-600">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {tripDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 text-center text-slate-900 animate-in zoom-in-95 duration-200">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4"><Trash2 size={32} /></div>
              <h3 className="text-xl font-black mb-2 tracking-tight text-red-600">Permanent Purge</h3>
              <p className="text-slate-500 font-bold text-xs uppercase leading-relaxed mb-8">
                This will delete the entire trip, all participants, and every expense record permanently. This action cannot be undone.
              </p>
              <div className="flex flex-col gap-2">
                 <button onClick={handleDeleteEntireTrip} disabled={!!deletingId} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all text-xs shadow-lg shadow-red-100">
                    {deletingId ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Delete Everything'}
                 </button>
                 <button onClick={() => setTripDeleteConfirm(false)} className="w-full text-slate-400 font-black uppercase tracking-widest py-2 text-[10px] hover:text-slate-600">Keep Trip</button>
              </div>
           </div>
        </div>
      )}

      {isModalOpen && trip && (
        <AddExpenseModal 
          trip={trip}
          participants={participants}
          expenseToEdit={editingExpense}
          enabledCurrencies={tripEnabledCurrencies.length > 0 ? tripEnabledCurrencies : ['USD']}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { 
            setIsModalOpen(false); 
            fetchData(); 
            setActiveTab('expenses'); 
          }}
        />
      )}
    </div>
  );
};
