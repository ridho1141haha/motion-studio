import { createClient } from '@supabase/supabase-js';

export interface HealthInfo {
  ok: boolean;
  userName: string;
  renderProfile: 'nvidia' | 'cpu-safe';
  supabaseEnabled: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface QuotaInfo {
  configured: boolean;
  characterCount: number;
  characterLimit: number;
  tier: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  owner: string;
  status: 'draft' | 'scripting' | 'building' | 'qa' | 'rendering' | 'ready' | 'posted';
  style_id?: string | null;
  duration_sec?: number;
  notes?: string;
  updated_at?: string;
}

export interface StyleItem {
  id: string;
  name: string;
  owner: string;
  source_url?: string | null;
  prompt: string;
  palette?: string[];
}

export async function fetchHealth(): Promise<HealthInfo> {
  const res = await fetch('/api/health');
  return res.json();
}

export async function fetchQuota(): Promise<QuotaInfo> {
  const res = await fetch('/api/media/quota');
  return res.json();
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  const data = await res.json();
  return data.projects ?? [];
}

export async function createProject(payload: {
  title: string;
  durationSec: number;
  notes?: string;
  styleId?: string;
}): Promise<Project> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateProjectStatus(id: string, status: Project['status']) {
  await fetch(`/api/projects/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function fetchArtifacts(id: string): Promise<{ renders: string[]; postJson: Record<string, unknown> | null }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}/artifacts`);
  return res.json();
}

export async function fetchStyles(): Promise<StyleItem[]> {
  const res = await fetch('/api/styles');
  const data = await res.json();
  return data.styles ?? [];
}

export async function cloneStyle(url: string): Promise<StyleItem> {
  const res = await fetch('/api/styles/clone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function subscribeTeamUpdates(health: HealthInfo, onChange: () => void): () => void {
  if (!health.supabaseEnabled || !health.supabaseUrl || !health.supabaseAnonKey) return () => {};
  const sb = createClient(health.supabaseUrl, health.supabaseAnonKey);
  const channel = sb
    .channel('team-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'styles' }, onChange)
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}
