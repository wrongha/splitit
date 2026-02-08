
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Participant, Expense, Trip } from '../types';
import { X, Check, Loader2, Utensils, Bed, Car, Plane, Ticket, ShoppingBag, Tag, ChevronRight, ArrowLeft, Calendar, Info } from 'lucide-react';
import { getParticipantTheme } from './TripDetails';

interface AddExpenseModalProps {
  trip: Trip;
  participants: Participant[];
  expenseToEdit?: Expense | null;
  enabledCurrencies: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export const CATEGORY_CONFIG = [
  { id: 'Food', icon: Utensils, color: 'bg-orange-500', keywords: ['Restaurant', 'Cafe', 'Breakfast', 'Lunch', 'Dinner', 'Drinks', 'Starbucks', 'Grocery', 'Snacks', 'Bar'] },
  { id: 'Accommodation', icon: Bed, color: 'bg-blue-500', keywords: ['Hotel', 'Airbnb', 'Hostel', 'Resort', 'Stay', 'Booking', 'Deposit'] },
  { id: 'Commute', icon: Car, color: 'bg-indigo-500', keywords: ['Taxi', 'Uber', 'Grab', 'Bus', 'Metro', 'Train', 'Subway', 'Gas', 'Parking', 'Toll'] },
  { id: 'Flights', icon: Plane, color: 'bg-sky-500', keywords: ['Flight', 'Airline', 'Baggage', 'Visa', 'Airport Transfer'] },
  { id: 'Entertainment', icon: Ticket, color: 'bg-purple-500', keywords: ['Museum', 'Cinema', 'Tour', 'Theme Park', 'Ticket', 'Concert', 'Activity'] },
  { id: 'Shopping', icon: ShoppingBag, color: 'bg-pink-500', keywords: ['Souvenir', 'Mall', 'Outlet', 'Clothes', 'Gift', 'Duty Free', 'Pharmacy'] },
  { id: 'Others', icon: Tag, color: 'bg-slate-500', keywords: ['Sim Card', 'Laundry', 'Tips', 'Fees'] }
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ 
  trip, 
  participants, 
  expenseToEdit,
  enabledCurrencies,
  onClose, 
  onSuccess 
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(trip.default_currency);
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payerIds, setPayerIds] = useState<string[]>([]);
  const [selectedSplitters, setSelectedSplitters] = useState<string[]>([]);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expenseToEdit) {
      setName(expenseToEdit.expense_name);
      setAmount(expenseToEdit.amount.toString());
      setCurrency(expenseToEdit.currency);
      setCategory(expenseToEdit.category || 'Others');
      setDate(expenseToEdit.expense_date);
      setPayerIds(expenseToEdit.payers?.map(p => p.participant_id) || [participants[0]?.id || '']);
      setSelectedSplitters(expenseToEdit.splits?.map(s => s.participant_id) || participants.map(p => p.id));
    } else {
      setName('');
      setAmount('');
      setCurrency(trip.default_currency);
      setCategory(null);
      setDate(new Date().toISOString().split('T')[0]);
      setPayerIds([participants[0]?.id || '']);
      setSelectedSplitters(participants.map(p => p.id));
    }
  }, [expenseToEdit, participants, trip]);

  const fetchRealtimeRate = async (targetCurrency: string, targetDate: string) => {
    if (targetCurrency === trip.default_currency) return 1;
    setFetchingRate(true);
    try {
      const response = await fetch(`https://api.frankfurter.app/${targetDate}?from=${trip.default_currency}&to=${targetCurrency}`);
      const data = await response.json();
      return data.rates?.[targetCurrency] || 1;
    } catch (err) {
      console.error("Failed to fetch historical rate:", err);
      return 1;
    } finally {
      setFetchingRate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || payerIds.length === 0 || selectedSplitters.length === 0) return;

    setLoading(true);
    const numAmount = parseFloat(amount);
    
    try {
      let finalRate = 1;
      if (trip.currency_method === 'realtime') {
        finalRate = await fetchRealtimeRate(currency, date);
      } else {
        finalRate = trip.fixed_rates?.[currency] || 1;
      }

      let expenseId = expenseToEdit?.id;
      const expensePayload = { 
        trip_id: trip.id, 
        expense_name: name, 
        amount: numAmount, 
        currency, 
        exchange_rate: finalRate,
        expense_date: date,
        category: category || 'Others' 
      };

      if (expenseToEdit) {
        await supabase.from('expenses').update(expensePayload).eq('id', expenseId);
        await supabase.from('expense_payers').delete().eq('expense_id', expenseId);
        await supabase.from('expense_splits').delete().eq('expense_id', expenseId);
      } else {
        const { data: expense, error } = await supabase.from('expenses').insert([expensePayload]).select().single();
        if (error) throw error;
        expenseId = expense.id;
      }

      const payerShare = numAmount / payerIds.length;
      await supabase.from('expense_payers').insert(payerIds.map(pid => ({ 
        expense_id: expenseId, 
        participant_id: pid, 
        amount_paid: payerShare 
      })));

      const splitAmount = numAmount / selectedSplitters.length;
      await supabase.from('expense_splits').insert(selectedSplitters.map(pid => ({ 
        expense_id: expenseId, 
        participant_id: pid, 
        share_amount: splitAmount 
      })));

      onSuccess();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSplitter = (id: string) => {
    setSelectedSplitters(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const togglePayer = (id: string) => {
    setPayerIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter(i => i !== id);
      }
      return [...prev, id];
    });
  };

  const handleNextStep = () => {
    if (category && name) setStep(2);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all relative">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <div className="flex items-center gap-3">
            {step === 2 && <button onClick={() => setStep(1)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"><ArrowLeft size={20} strokeWidth={3} /></button>}
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{expenseToEdit ? 'Edit Entry' : 'New Entry'}</h3>
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
            <div className="p-8 space-y-8 animate-in slide-in-from-left-4 duration-300">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Category</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {CATEGORY_CONFIG.map(cat => (
                    <button key={cat.id} onClick={() => setCategory(cat.id)} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 ${category === cat.id ? `border-indigo-600 bg-white shadow-lg ring-2 ring-indigo-600 ring-offset-2` : 'border-white bg-white hover:border-indigo-100 shadow-sm text-slate-400 hover:text-slate-600'}`}>
                      <div className={`p-2 rounded-xl text-white shadow-sm transition-transform ${category === cat.id ? 'scale-110' : ''} ${cat.color}`}><cat.icon size={20} /></div>
                      <span className={`text-[10px] font-black uppercase tracking-wide ${category === cat.id ? 'text-indigo-900' : 'text-slate-400'}`}>{cat.id}</span>
                    </button>
                  ))}
                </div>
              </div>
              {category && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quick Select</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_CONFIG.find(c => c.id === category)?.keywords.map(keyword => (
                        <button key={keyword} onClick={() => setName(keyword)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border border-transparent active:scale-95 ${name === keyword ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-white hover:border-slate-200 shadow-sm'}`}>{keyword}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Or type name</label>
                    <input autoFocus type="text" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white focus:border-indigo-500 outline-none font-black text-slate-900 transition-all placeholder:text-slate-300 shadow-sm text-lg" placeholder="e.g. Starbucks" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name && category && handleNextStep()} />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                     <div className="relative">
                        <input type="date" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all shadow-sm pl-12" value={date} onChange={e => setDate(e.target.value)} />
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                     </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
             <div className="p-8 space-y-8 animate-in slide-in-from-right-4 duration-300">
               <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Cost</label>
                 <div className="flex gap-3">
                    <div className="relative flex-1">
                      <input required autoFocus type="number" step="0.01" placeholder="0.00" className="w-full px-6 py-5 rounded-[1.5rem] border-2 border-slate-200 bg-white focus:border-indigo-500 outline-none font-black text-4xl text-slate-900 transition-all placeholder:text-slate-200 shadow-sm" value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                    <div className="w-1/3 min-w-[100px]">
                      <select className="w-full h-full px-4 rounded-[1.5rem] border-2 border-slate-200 bg-white focus:border-indigo-500 outline-none font-black text-lg text-slate-900 transition-all cursor-pointer shadow-sm appearance-none text-center" value={currency} onChange={e => setCurrency(e.target.value)}>
                        {enabledCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                 </div>
               </div>
               
               {trip.currency_method === 'realtime' && currency !== trip.default_currency && (
                  <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 animate-in fade-in">
                    <Info size={14} /> RATE WILL BE FETCHED FOR {date}
                  </div>
               )}

               <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paid By</label>
                 <div className="flex flex-wrap gap-2.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                   {participants.map(p => {
                     const theme = getParticipantTheme(p.color);
                     const isActive = payerIds.includes(p.id);
                     return (
                       <button key={p.id} type="button" onClick={() => togglePayer(p.id)} className={`px-4 py-2 rounded-xl border-2 transition-all font-bold text-xs flex items-center gap-2 ${isActive ? `border-slate-900 bg-slate-900 text-white shadow-md transform scale-105` : `border-slate-100 bg-slate-50 text-slate-500 hover:bg-white hover:border-slate-200`}`}>
                         <span className={`w-5 h-5 rounded flex items-center justify-center text-xs ${isActive ? 'bg-white/20 text-white' : `${theme.bg} ${theme.text}`}`}>{p.mascot || p.name[0]}</span>
                         {p.name}
                       </button>
                     );
                   })}
                 </div>
               </div>

               <div className="space-y-3">
                 <div className="flex justify-between items-end px-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Split Amongst</label>
                   <button type="button" onClick={() => setSelectedSplitters(selectedSplitters.length === participants.length ? [] : participants.map(p => p.id))} className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider hover:underline">{selectedSplitters.length === participants.length ? 'Deselect All' : 'Select All'}</button>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {participants.map(p => {
                      const theme = getParticipantTheme(p.color);
                      const isSelected = selectedSplitters.includes(p.id);
                      return (
                        <div key={p.id} onClick={() => toggleSplitter(p.id)} className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all cursor-pointer select-none active:scale-[0.98] ${isSelected ? 'border-indigo-600 bg-indigo-50/50' : 'border-white bg-white hover:border-indigo-100'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg shadow-sm ${theme.bg} ${theme.text}`}>{p.mascot || p.name[0]}</div>
                            <span className={`text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-400'}`}>{p.name}</span>
                          </div>
                          {isSelected && <div className="text-indigo-600 bg-white rounded-full p-1 shadow-sm"><Check size={12} strokeWidth={4} /></div>}
                        </div>
                      );
                    })}
                 </div>
               </div>
             </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white z-10">
          {step === 1 ? (
             <button onClick={handleNextStep} disabled={!category || !name} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white py-4 rounded-[1.5rem] font-black text-lg shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95">Next <ChevronRight size={20} strokeWidth={3} /></button>
          ) : (
            <button onClick={handleSubmit} disabled={loading || !amount || fetchingRate} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-4 rounded-[1.5rem] font-black text-lg shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95">
              {(loading || fetchingRate) ? <Loader2 className="animate-spin" size={24} /> : <Check size={24} strokeWidth={3} />}
              {expenseToEdit ? 'Save Changes' : 'Confirm Entry'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
