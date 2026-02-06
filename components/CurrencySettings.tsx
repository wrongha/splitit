
import React, { useState } from 'react';
import { X, Globe, Check, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Currency } from '../types';
import { GoogleGenAI } from '@google/genai';

interface CurrencySettingsProps {
  currencies: Currency[];
  onClose: () => void;
  onUpdate: () => void;
}

export const CurrencySettings: React.FC<CurrencySettingsProps> = ({ currencies, onClose, onUpdate }) => {
  const [updating, setUpdating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchLatestRates = async () => {
    setUpdating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currencyCodes = currencies.map(c => c.code).join(', ');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Provide current mid-market exchange rates for these currencies relative to 1 USD: ${currencyCodes}. 
                   Format as a pure JSON object: {"CODE": rate_number}. 
                   Example: {"EUR": 0.92, "JPY": 151.4}`
      });
      
      const text = response.text || '{}';
      const cleanJson = text.replace(/```json|```/g, '').trim();
      const newRates = JSON.parse(cleanJson);
      
      // Update DB
      const updates = Object.entries(newRates).map(([code, rate]) => ({
        code,
        rate_to_usd: rate,
        updated_at: new Date().toISOString()
      }));

      for (const update of updates) {
        await supabase
          .from('currencies')
          .update({ rate_to_usd: update.rate_to_usd, updated_at: update.updated_at })
          .eq('code', update.code);
      }
      
      onUpdate();
    } catch (err) {
      console.error("Rate update failed:", err);
      alert("Could not fetch latest rates. Please check your API key.");
    } finally {
      setUpdating(false);
    }
  };

  const toggleCurrency = async (code: string, currentStatus: boolean) => {
    // Prevent disabling all currencies
    const enabledCount = currencies.filter(c => c.is_enabled).length;
    if (currentStatus && enabledCount <= 1) {
      alert("At least one currency must be enabled.");
      return;
    }

    setToggling(code);
    const { error } = await supabase
      .from('currencies')
      .update({ is_enabled: !currentStatus })
      .eq('code', code);
    
    if (!error) onUpdate();
    setToggling(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Currency Center</h3>
            <p className="text-sm text-slate-500 font-medium">Manage global rates and active currencies.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-white rounded-full">
            <X size={28} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
            <div className="flex items-center gap-4 text-indigo-700">
              <div className="bg-white p-3 rounded-xl shadow-sm"><RefreshCw className={updating ? 'animate-spin' : ''} size={24} /></div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wider opacity-70">Exchange Rates</p>
                <p className="font-medium">Powered by real-time market data.</p>
              </div>
            </div>
            <button 
              onClick={fetchLatestRates}
              disabled={updating}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
            >
              {updating ? <Loader2 size={18} className="animate-spin" /> : <Globe size={18} />}
              Update All Rates
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currencies.map(c => (
              <button
                key={c.code}
                onClick={() => toggleCurrency(c.code, c.is_enabled)}
                disabled={toggling === c.code}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                  c.is_enabled 
                    ? 'border-indigo-600 bg-white shadow-sm' 
                    : 'border-slate-100 bg-slate-50/50 grayscale opacity-60'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 flex items-center justify-center rounded-xl text-xl font-bold ${
                    c.is_enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {c.symbol}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900">{c.code}</p>
                    <p className="text-xs text-slate-500 font-bold">1 USD = {c.rate_to_usd.toFixed(2)}</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                  c.is_enabled ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                }`}>
                  {toggling === c.code ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : c.is_enabled ? (
                    <Check size={14} strokeWidth={4} />
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>
        
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          Changes apply instantly to all active trips
        </div>
      </div>
    </div>
  );
};
