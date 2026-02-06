
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Participant, Expense } from '../types';
import { X, Check, Loader2, Utensils, Bed, Car, Plane, Ticket, ShoppingBag, Tag } from 'lucide-react';
import { getParticipantTheme } from './TripDetails';

interface AddExpenseModalProps {
  tripId: string;
  participants: Participant[];
  expenseToEdit?: Expense | null;
  enabledCurrencies: string[];
  defaultCurrency: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CATEGORY_CONFIG = [
  { id: 'Food', icon: Utensils, color: 'bg-orange-500', keywords: ['restaurant', 'cafe', 'breakfast', 'lunch', 'dinner', 'drinks', 'starbucks', 'grocery', 'snacks', 'bar'] },
  { id: 'Accommodation', icon: Bed, color: 'bg-blue-500', keywords: ['hotel', 'airbnb', 'hostel', 'resort', 'stay', 'booking'] },
  { id: 'Commute', icon: Car, color: 'bg-indigo-500', keywords: ['taxi', 'uber', 'grab', 'bus', 'metro', 'train', 'subway', 'gas', 'parking', 'toll'] },
  { id: 'Flights', icon: Plane, color: 'bg-sky-500', keywords: ['flight', 'airline', 'plane', 'baggage', 'visa', 'airport'] },
  { id: 'Entertainment', icon: Ticket, color: 'bg-purple-500', keywords: ['museum', 'cinema', 'tour', 'theme park', 'disney', 'ticket', 'concert', 'sightseeing'] },
  { id: 'Shopping', icon: ShoppingBag, color: 'bg-pink-500', keywords: ['souvenir', 'mall', 'outlet', 'clothes', 'gift', 'duty free', 'pharmacy'] },
  { id: 'Others', icon: Tag, color: 'bg-slate-500', keywords: [] }
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ 
  tripId, 
  participants, 
  expenseToEdit,
  enabledCurrencies,
  defaultCurrency,
  onClose, 
  onSuccess 
}) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [category, setCategory] = useState('Others');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [isManualCategory, setIsManualCategory] = useState(false);
  
  const [payerIds, setPayerIds] = useState<string[]>([]);
  const [selectedSplitters, setSelectedSplitters] = useState<string[]>([]);

  useEffect(() => {
    if (expenseToEdit) {
      setName(expenseToEdit.expense_name);
      setAmount(expenseToEdit.amount.toString());
      setCurrency(expenseToEdit.currency);
      setCategory(expenseToEdit.category || 'Others');
      setDate(expenseToEdit.expense_date);
      setPayerIds(expenseToEdit.payers?.map(p => p.participant_id) || [participants[0]?.id || '']);
      setSelectedSplitters(expenseToEdit.splits?.map(s => s.participant_id) || participants.map(p => p.id));
      setIsManualCategory(true);
    } else {
      setName('');
      setAmount('');
      const initialCurrency = enabledCurrencies.includes(defaultCurrency) ? defaultCurrency : (enabledCurrencies[0] || 'USD');
      setCurrency(initialCurrency);
      setCategory('Others');
      setDate(new Date().toISOString().split('T')[0]);
      setPayerIds([participants[0]?.id || '']);
      setSelectedSplitters(participants.map(p => p.id));
      setIsManualCategory(false);
    }
  }, [expenseToEdit, participants, enabledCurrencies, defaultCurrency]);

  const detectCategory = (text: string) => {
    if (isManualCategory) return;
    const lowerText = text.toLowerCase();
    const found = CATEGORY_CONFIG.find(cat => 
      cat.keywords.some(keyword => lowerText.includes(keyword))
    );
    if (found) {
      setCategory(found.id);
    } else {
      setCategory('Others');
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    detectCategory(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || payerIds.length === 0 || selectedSplitters.length === 0) return;

    setLoading(true);
    const numAmount = parseFloat(amount);
    
    try {
      let expenseId = expenseToEdit?.id;

      const expensePayload = { 
        trip_id: tripId, 
        expense_name: name, 
        amount: numAmount, 
        currency, 
        expense_date: date,
        category 
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

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xl font-black text-slate-800 tracking-tight">{expenseToEdit ? 'Revise Item' : 'New Entry'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={28} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto scrollbar-hide">
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Name</label>
            <input required type="text" className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300 shadow-sm" placeholder="e.g. Starbucks" value={name} onChange={handleNameChange} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_CONFIG.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setCategory(cat.id); setIsManualCategory(true); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all font-bold text-[11px] uppercase tracking-wider ${
                    category === cat.id ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                  }`}
                >
                  <cat.icon size={14} />
                  {cat.id}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount</label>
              <input required type="number" step="0.01" className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 outline-none font-black text-slate-900 transition-all shadow-sm" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Currency</label>
              <select className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 outline-none font-black text-slate-900 transition-all cursor-pointer shadow-sm" value={currency} onChange={e => setCurrency(e.target.value)}>
                {enabledCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Date</label>
            <input type="date" className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all shadow-sm" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Who Paid?</label>
            <div className="flex flex-wrap gap-2.5">
              {participants.map(p => {
                const theme = getParticipantTheme(p.color);
                const isActive = payerIds.includes(p.id);
                return (
                  <button 
                    key={p.id} 
                    type="button" 
                    onClick={() => togglePayer(p.id)} 
                    className={`px-4 py-2.5 rounded-2xl border-2 transition-all font-bold text-sm flex items-center gap-2 shadow-sm ${
                      isActive 
                        ? `border-slate-900 bg-slate-900 text-white` 
                        : `border-slate-50 bg-white text-slate-500 hover:border-slate-200`
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-base ${theme.bg} ${theme.text} shadow-inner`}>
                      {p.mascot || p.name[0]}
                    </span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Split with</label>
            <div className="space-y-1.5">
              {participants.map(p => {
                const theme = getParticipantTheme(p.color);
                const isSelected = selectedSplitters.includes(p.id);
                return (
                  <div 
                    key={p.id} 
                    onClick={() => toggleSplitter(p.id)} 
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer group shadow-sm ${
                      isSelected ? 'border-slate-900 bg-slate-50' : 'border-slate-100 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xl shadow-inner ${theme.bg} ${theme.text}`}>
                        {p.mascot || p.name[0]}
                      </div>
                      <span className={`text-base font-black tracking-tight ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                        {p.name}
                      </span>
                    </div>
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                      isSelected ? 'bg-slate-900 text-white shadow-lg' : 'border-2 border-slate-100 text-transparent'
                    }`}>
                      <Check size={16} strokeWidth={3} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-[1.5rem] font-black text-lg shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 uppercase tracking-widest mt-4 active:scale-95">
            {loading ? <Loader2 className="animate-spin" size={24} /> : null}
            {expenseToEdit ? 'Update Entry' : 'Add Entry'}
          </button>
        </form>
      </div>
    </div>
  );
};
