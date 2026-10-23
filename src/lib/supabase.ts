import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Supabase is optional during local UI development. Never use a service-role key here.
export const supabase = url && publicKey ? createClient(url, publicKey) : null;
export const isSupabaseConfigured = supabase !== null;
