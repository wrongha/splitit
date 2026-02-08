
import React, { useMemo, useState } from 'react';
import { Expense, Participant, Settlement } from '../types';
import { ArrowRight, CheckCircle, Info, RefreshCw, Loader2, Coins, ChevronDown, Check, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { getParticipantTheme } from './TripDetails';

interface SettlementViewProps {
  tripId: string;
  expenses: Expense[];
  participants: Participant[];
  rates: Record<string, number>;
  enabledCurrencies: string[];
  baseCurrency: string;
  onSettled: () => void;
}

const formatValue = (val: number) => {
  return val % 1 === 0 
    ? val.toLocaleString(undefined, { maximumFractionDigits: 0 }) 
    : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const SettlementView: React.FC<SettlementViewProps> = ({ 
  tripId, 
  expenses, 
  participants, 
  rates, 
  enabledCurrencies,
  baseCurrency,
  onSettled
}) => {
  const [displayCurrency, setDisplayCurrency] = useState(baseCurrency);
  const [settlingItem, setSettlingItem] = useState<{from: string, to: string, amount: number, fromId: string, toId: string} | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleCurrency, setSettleCurrency] = useState(displayCurrency);
  const [isProcessing, setIsProcessing] = useState(false);

  const settlements = useMemo(() => {
    const balances: Record<string, number> = {};
    participants.forEach(p => balances[p.id] = 0);

    expenses.forEach(exp => {
      const rate = rates[exp.currency] || 1;
      exp.payers?.forEach(p => {
        if (balances[p.participant_id] !== undefined) {
          balances[p.participant_id] += Number(p.amount_paid) / rate;
        }
      });
      exp.splits?.forEach(s => {
        if (balances[s.participant_id] !== undefined) {
          balances[s.participant_id] -= Number(s.share_amount) / rate;
        }
      });
    });

    const debtors: { id: string, amount: number }[] = [];
    const creditors: { id: string, amount: number }[] = [];
    Object.entries(balances).forEach(([id, b]) => {
      if (b < -0.01) debtors.push({ id, amount: Math.abs(b) });
      else if (b > 0.01) creditors.push({ id, amount: b });
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const results: (Settlement & {fromId: string, toId: string})[] = [];
    let d = 0, c = 0;
    while (d < debtors.length && c < creditors.length) {
      const amount = Math.min(debtors[d].amount, creditors[c].amount);
      results.push({
        from: participants.find(p => p.id === debtors[d].id)?.name || 'Someone',
        fromId: debtors[d].id,
        to: participants.find(p => p.id === creditors[c].id)?.name || 'Someone',
        toId: creditors[c].id,
        amount: amount
      });
      debtors[d].amount -= amount; creditors[c].amount -= amount;
      if (debtors[d].amount < 0.01) d++;
      if (creditors[c].amount < 0.01) c++;
    }
    return results;
  }, [expenses, participants, rates]);

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingItem || !settleAmount || isProcessing) return;

    setIsProcessing(true);
    try {
      const amount = parseFloat(settleAmount);
      const { data: exp, error: expErr } = await supabase.from('expenses').insert([{
        trip_id: tripId,
        expense_name: `Settlement: ${settlingItem.from} to ${settlingItem.to}`,
        amount: amount,
        currency: settleCurrency,
        expense_date: new Date().toISOString().split('T')[0]
      }]).select().single();

      if (expErr) throw expErr;

      await Promise.all([
        supabase.from('expense_payers').insert([{ expense_id: exp.id, participant_id: settlingItem.fromId, amount_paid: amount }]),
        supabase.from('expense_splits').insert([{ expense_id: exp.id, participant_id: settlingItem.toId, share_amount: amount }])
      ]);

      setSettlingItem(null);
      onSettled();
    } catch (err: any) {
      alert("Settlement error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (settlements.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-12 text-center">
        <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4"><CheckCircle size={32} /></div>
        <h3 className="text-xl font-bold text-emerald-900">Zero Balances!</h3>
        <p className="text-emerald-700 mt-2 font-medium">Everyone is paid up and ready for the next adventure.</p>
      </div>
    );
  }

  // Ensure base currency is always available in selector and shown first
  const selectorCurrencies = Array.from(new Set([baseCurrency, ...enabledCurrencies])).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold"><Info size={18} className="text-indigo-500" /><span>Optimized repayment path.</span></div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VIEW IN:</span>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {selectorCurrencies.map(curr => (
              <button 
                key={curr}
                onClick={() => setDisplayCurrency(curr)}
                className={`px-3 py-1 rounded-md text-[10px] font-black transition-all uppercase ${displayCurrency === curr ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {settlements.map((s, idx) => {
          const fromPart = participants.find(p => p.id === s.fromId);
          const toPart = participants.find(p => p.id === s.toId);
          const fromTheme = getParticipantTheme(fromPart?.color);
          const toTheme = getParticipantTheme(toPart?.color);
          const rawAmount = s.amount * (rates[displayCurrency] || 1);
          const displayAmount = formatValue(rawAmount);

          return (
            <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-indigo-200 transition-all">
              <div className="flex items-center gap-6 flex-1 w-full">
                <div className="text-right flex-1">
                  <div className={`font-black text-xl flex items-center justify-end gap-2 ${fromTheme.text}`}>
                    <span>{s.from}</span>
                    <span className="text-2xl">{fromPart?.mascot}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">owes</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all flex items-center justify-center">
                  <ArrowRight size={24} strokeWidth={3} />
                </div>
                <div className="flex-1">
                  <div className={`font-black text-xl flex items-center gap-2 ${toTheme.text}`}>
                    <span className="text-2xl">{toPart?.mascot}</span>
                    <span>{s.to}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">receives</div>
                </div>
              </div>
              <div className="flex items-center gap-8 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-50 pt-6 md:pt-0 md:pl-8">
                <div className="flex-1 md:flex-none text-center md:text-right">
                  <span className="text-3xl font-black text-slate-900 tracking-tight">{displayAmount}</span>
                  <span className="text-[10px] font-bold text-slate-400 ml-1 uppercase">{displayCurrency}</span>
                </div>
                <button 
                  onClick={() => {
                    setSettlingItem(s);
                    setSettleAmount(formatValue(rawAmount));
                    setSettleCurrency(displayCurrency);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl text-[10px] font-black shadow-lg shadow-indigo-100 transition-all active:scale-95 uppercase tracking-widest"
                >
                  Settle
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {settlingItem && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900">Finalize Settlement</h3>
              <button onClick={() => setSettlingItem(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-2"><X size={28} /></button>
            </div>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed font-bold uppercase tracking-tight">
              Recording this will clear the debt between <span className="text-indigo-600">{settlingItem.from}</span> and <span className="text-indigo-600">{settlingItem.to}</span>.
            </p>
            
            <form onSubmit={handleSettleSubmit} className="space-y-8">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Amount Paid</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    className="w-full px-5 py-5 bg-white rounded-2xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-black text-2xl text-slate-900 transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                    value={settleAmount} 
                    onChange={e => setSettleAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Currency</label>
                  <select 
                    className="w-full px-3 py-5 bg-white rounded-2xl border-2 border-slate-200 outline-none text-base font-black text-slate-900 focus:border-indigo-500 transition-all cursor-pointer shadow-sm appearance-none text-center"
                    value={settleCurrency}
                    onChange={e => setSettleCurrency(e.target.value)}
                  >
                    {enabledCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  type="submit" 
                  disabled={isProcessing}
                  className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-widest"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                  Complete Payment
                </button>
                <button 
                  type="button"
                  onClick={() => setSettleAmount(formatValue(settlingItem.amount * (rates[settleCurrency] || 1)))}
                  className="w-full bg-slate-100 text-slate-400 py-4 rounded-[1.5rem] font-black text-xs hover:bg-slate-200 transition-colors uppercase tracking-widest"
                >
                  Use Suggested Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
