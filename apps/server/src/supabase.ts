import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV } from './env.js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) return null;
  if (!client) {
    client = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
  }
  return client;
}

export interface ProjectRecord {
  id: string;
  slug: string;
  title: string;
  owner: string;
  status: 'draft' | 'scripting' | 'building' | 'qa' | 'rendering' | 'ready' | 'posted';
  style_id?: string | null;
  duration_sec?: number;
  notes?: string;
  post_json?: Record<string, unknown> | null;
  updated_at?: string;
}

export interface StyleRecord {
  id: string;
  name: string;
  owner: string;
  source_url?: string | null;
  engine: 'remotion';
  prompt: string;
  build_recipe?: string | null;
  palette?: string[];
  notes?: Record<string, string>;
}

export async function syncProject(record: ProjectRecord): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('projects').upsert(
    { ...record, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) console.error('[supabase] syncProject error:', error.message);
}

export async function logActivity(message: string, projectId?: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('activity_logs').insert({
    owner: ENV.USER_NAME,
    project_id: projectId ?? null,
    message,
  });
  if (error) console.error('[supabase] logActivity error:', error.message);
}

export async function syncStyle(style: StyleRecord): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('styles').upsert(style, { onConflict: 'id' });
  if (error) console.error('[supabase] syncStyle error:', error.message);
}
