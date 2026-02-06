
import React, { useState, useEffect, useCallback } from 'react';
import { TripDashboard } from './components/TripDashboard';
import { TripDetails } from './components/TripDetails';
import { Plane, Globe, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from './services/supabase';
import { Currency } from './types';

const App: React.FC = () => {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [globalCurrencies, setGlobalCurrencies] = useState<Currency[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const fetchGlobalRates = useCallback(async () => {
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .order('code', { ascending: true });
    
    if (!error && data) {
      setGlobalCurrencies(data);
      const latest = data.reduce((prev, current) => 
        (new Date(prev.updated_at) > new Date(current.updated_at)) ? prev : current
      );
      setLastSync(new Date(latest.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, []);

  const syncWithMarket = async () => {
    setSyncing(true);
    try {
      const response = await fetch('https://api.frankfurter.app/latest?from=USD');
      const data = await response.json();
      
      if (data && data.rates) {
        const updates = Object.entries(data.rates).map(([code, rate]) => ({
          code,
          rate_to_usd: rate,
          updated_at: new Date().toISOString()
        }));

        // Also update USD explicitly
        updates.push({ code: 'USD', rate_to_usd: 1, updated_at: new Date().toISOString() });

        for (const update of updates) {
          await supabase
            .from('currencies')
            .update({ rate_to_usd: update.rate_to_usd, updated_at: update.updated_at })
            .eq('code', update.code);
        }
        await fetchGlobalRates();
      }
    } catch (err) {
      console.error("Failed to sync rates:", err);
      alert("Rate sync failed. Please check your connection.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchGlobalRates();
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setSelectedTripId(hash.startsWith('trip/') ? hash.split('/')[1] : null);
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [fetchGlobalRates]);

  const navigateToDashboard = () => {
    window.location.hash = '';
  };

  const ratesMap = globalCurrencies.reduce((acc, c) => ({ ...acc, [c.code]: c.rate_to_usd }), {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={navigateToDashboard}
          >
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white group-hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 group-active:scale-95">
              <Plane size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-none">Split-It</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Travel Smarter</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Market Sync</span>
              <span className="text-xs font-bold text-slate-600">{lastSync ? `Last updated ${lastSync}` : 'Rates pending...'}</span>
            </div>
            <button 
              onClick={syncWithMarket}
              disabled={syncing}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all font-bold text-sm ${
                syncing 
                  ? 'border-slate-100 bg-slate-50 text-slate-400' 
                  : 'border-indigo-100 bg-indigo-50 text-indigo-700 hover:border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {syncing ? 'Syncing...' : 'Sync Rates'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {selectedTripId ? (
          <TripDetails 
            tripId={selectedTripId} 
            onBack={navigateToDashboard}
            globalRates={ratesMap}
            allAvailableCurrencies={globalCurrencies}
          />
        ) : (
          <TripDashboard onSelectTrip={(id) => window.location.hash = `trip/${id}`} />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 mt-12">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-slate-400 text-xs font-medium">
            &copy; {new Date().getFullYear()} Split-It Expenses. Market data via Frankfurter API.
          </div>
          <div className="flex gap-6 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span className="hover:text-indigo-600 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-indigo-600 cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-indigo-600 cursor-pointer transition-colors">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
