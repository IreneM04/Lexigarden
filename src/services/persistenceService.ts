import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type GameState } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

export async function saveGame(userId: string, state: GameState) {
  const supabase = getSupabase();
  
  if (!supabase) {
    // Fallback to localStorage if Supabase is not configured
    localStorage.setItem(`wordfarm_save_${userId}`, JSON.stringify(state));
    return;
  }

  const { error } = await supabase
    .from('saves')
    .upsert({ 
      user_id: userId, 
      state: state,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) console.error('Error saving game:', error);
}

export async function loadGame(userId: string): Promise<GameState | null> {
  const supabase = getSupabase();

  if (!supabase) {
    const localSave = localStorage.getItem(`wordfarm_save_${userId}`);
    return localSave ? JSON.parse(localSave) : null;
  }

  const { data, error } = await supabase
    .from('saves')
    .select('state')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error loading game:', error);
    return null;
  }

  return data?.state as GameState;
}
