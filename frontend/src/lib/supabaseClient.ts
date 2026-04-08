import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    client = null
    return null
  }
  client = createClient(url, key)
  return client
}

export function isSupabaseEnabled(): boolean {
  return getSupabaseClient() !== null
}

export const SUBMISSION_BUCKET = 'submission-files'
