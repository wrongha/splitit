
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gwhbaquirhfawqigjocc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3aGJhcXVpcmhmYXdxaWdqb2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzc2NjMsImV4cCI6MjA4NTk1MzY2M30.8lKT-SY8t-N0wtSxIIP4LH4i9YqKzGJP_34BFlhFjsY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
