
import { createClient } from '@supabase/supabase-js';

/**
 * 🛠️ CREDENTIALS CONFIGURED:
 * We have hardcoded these values to ensure the app works immediately on Cloudflare Pages.
 * The 'Anon Key' is public-safe and designed for client-side use.
 */
const HARDCODED_URL = 'https://gwhbaquirhfawqigjocc.supabase.co'; 
const HARDCODED_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3aGJhcXVpcmhmYXdxaWdqb2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzc2NjMsImV4cCI6MjA4NTk1MzY2M30.8lKT-SY8t-N0wtSxIIP4LH4i9YqKzGJP_34BFlhFjsY';

/**
 * Detection Logic:
 * Checks environment variables first, falls back to hardcoded values.
 */
const getEnv = (key: string) => {
  try {
    // Fix: Cast import.meta to any to resolve property 'env' does not exist error.
    const meta = import.meta as any;
    if (typeof meta !== 'undefined' && meta.env && meta.env[key]) {
      return meta.env[key];
    }
  } catch (e) {}
  
  try {
    // Try Process standard
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}
  
  return '';
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL') || HARDCODED_URL;
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || HARDCODED_ANON_KEY;

const isConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

if (!isConfigured) {
  console.error("Supabase Error: Failed to detect credentials from any source.");
}

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : new Proxy({} as any, {
      get(_, prop) {
        throw new Error(`Supabase Error: Config missing. Check services/supabase.ts`);
      }
    });
