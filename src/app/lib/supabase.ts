import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://tbbkzsjbxgauxlkoscdb.supabase.co'
export const supabaseAnonKey = 'sb_publishable_eI3gCuSDVtGg9x-K8puWrQ__4m8_HdD'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // This tells Supabase to forget the user the moment the tab is closed
    storage: window.sessionStorage, 
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});