
import { createClient } from '@supabase/supabase-js';

/**
 * Cloudflare Pages & Vite Compatibility:
 * 1. For security, Vite only exposes variables prefixed with VITE_ to the browser.
 * 2. We use static string access (process.env.VAR) so the build tool 
 *    can find and replace these values during deployment.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Configuration check
const isConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

if (!isConfigured) {
  console.group("🔧 Supabase Setup Guide");
  console.error("Status: Configuration Missing");
  console.info("Action Required: In your Cloudflare Pages Dashboard (Settings > Environment variables):");
  console.info("1. Rename SUPABASE_URL to VITE_SUPABASE_URL");
  console.info("2. Rename SUPABASE_ANON_KEY to VITE_SUPABASE_ANON_KEY");
  console.info("3. IMPORTANT: You must trigger a NEW DEPLOYMENT for these to work.");
  console.groupEnd();
}

/**
 * Export the client if configured, otherwise a proxy that provides clear errors.
 */
export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : new Proxy({} as any, {
      get(_, prop) {
        throw new Error(
          `Supabase Error: Credentials missing. Use VITE_ prefix in Cloudflare dashboard and RE-DEPLOY.`
        );
      }
    });
