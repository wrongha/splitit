
import { createClient } from '@supabase/supabase-js';

/**
 * Cloudflare Pages and most bundlers perform static string replacement.
 * We use direct access here so the build tool can find and replace these 
 * literals with your actual values from the dashboard.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Check if replacement happened successfully
const isConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

if (!isConfigured) {
  console.error(
    "Supabase configuration is missing. \n" +
    "1. Ensure variables are added in Cloudflare Pages (Settings > Environment variables).\n" +
    "2. Ensure you have triggered a NEW DEPLOYMENT after adding the variables.\n" +
    "3. Check that the names match: SUPABASE_URL and SUPABASE_ANON_KEY."
  );
}

/**
 * Export the client if configured, otherwise a proxy that warns on usage.
 */
export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : new Proxy({} as any, {
      get(_, prop) {
        throw new Error(
          `Supabase Client Error: Attempted to call '${String(prop)}' but credentials are missing. ` +
          `Please check your Cloudflare Pages environment variables.`
        );
      }
    });
