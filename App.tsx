
import React, { useState, useEffect, useCallback } from 'react';
import { TripDashboard } from './components/TripDashboard';
import { TripDetails, getParticipantTheme } from './components/TripDetails';
import { UserSelectionScreen } from './components/UserSelectionScreen';
import { Plane, Globe, RefreshCw, Loader2, LogOut } from 'lucide-react';
import { supabase } from './services/supabase';
import { Currency, UserProfile } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isNewTripFlow, setIsNewTripFlow] = useState(false);
  const [globalCurrencies, setGlobalCurrencies] = useState<Currency[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    // Check for persisted user
    const savedUser = localStorage.getItem('split_it_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const handleUserSelect = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.name !== 'Guest') {
        localStorage.setItem('split_it_user', JSON.stringify(user));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('split_it_user');
    window.location.hash = '';
  };

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

  useEffect(() => {
    fetchGlobalRates();
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const isNew = hash.endsWith('/new');
      const tripId = isNew ? hash.replace('/new', '').split('/')[1] : (hash.startsWith('trip/') ? hash.split('/')[1] : null);
      
      setSelectedTripId(tripId);
      setIsNewTripFlow(isNew);
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [fetchGlobalRates]);

  const navigateToDashboard = () => {
    window.location.hash = '';
  };

  const handleSelectTrip = (id: string, isNew: boolean = false) => {
    window.location.hash = isNew ? `trip/${id}/new` : `trip/${id}`;
  };

  const ratesMap = globalCurrencies.reduce((acc, c) => ({ ...acc, [c.code]: c.rate_to_usd }), {} as Record<string, number>);
  const userTheme = currentUser ? getParticipantTheme(currentUser.color) : null;

  if (!currentUser) {
    return <UserSelectionScreen onSelectUser={handleUserSelect} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={navigateToDashboard}
          >
            <div className="bg-indigo-600 p-2 rounded-lg text-white group-hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 group-active:scale-95">
              <Plane size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none tracking-tight">Split-It</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Travel Smarter</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 bg-white border border-slate-100 rounded-xl hover:border-indigo-100 hover:shadow-sm transition-all group"
              title="Switch User"
            >
              <div className={`w-7 h-7 rounded-md flex items-center justify-center text-sm ${userTheme?.bg} ${userTheme?.text}`}>
                {currentUser.mascot}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-[11px] font-black text-slate-900 leading-none">{currentUser.name}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 group-hover:text-indigo-500 transition-colors">Switch</p>
              </div>
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
            autoOpenAdd={isNewTripFlow}
          />
        ) : (
          <TripDashboard 
            onSelectTrip={handleSelectTrip} 
            currentUser={currentUser}
            allAvailableCurrencies={globalCurrencies}
          />
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
