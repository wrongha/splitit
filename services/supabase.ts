
import { createClient } from '@supabase/supabase-js';

// These should be set as Environment Variables in your hosting provider (e.g., Cloudflare Pages)
// Using optional chaining and fallback to empty string to prevent ReferenceErrors
const SUPABASE_URL = (typeof process !== 'undefined' ? process.env?.SUPABASE_URL : '') || '';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' ? process.env?.SUPABASE_ANON_KEY : '') || '';

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isConfigured) {
  console.error(
    "Supabase configuration is missing. Please ensure SUPABASE_URL and SUPABASE_ANON_KEY " +
    "are set in your environment variables (Cloudflare Pages Secrets or .env file)."
  );
}

/**
 * We only initialize the client if the required keys are present.
 * If they are missing, we export a Proxy object that will throw a descriptive 
 * error if any part of the app attempts to use it. This prevents the 
 * "supabaseUrl is required" crash at load time.
 */
export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : new Proxy({} as any, {
      get(_, prop) {
        throw new Error(
          `Supabase Client Error: Attempted to call '${String(prop)}' but credentials are missing. ` +
          `Check your environment variables for SUPABASE_URL and SUPABASE_ANON_KEY.`
        );
      }
    });
