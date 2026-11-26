import fs from 'node:fs/promises';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { runClaudeInProject } from './claude.js';
import { generateSfx, generateVoiceWithTimestamps, getElevenLabsQuota } from './elevenlabs.js';
import { ENV, PROJECTS_DIR, SKILL_PATH } from './env.js';
import { createLocalProject, getProjectArtifacts, listLocalProjects } from './projects.js';
import { cloneStyleFromUrl } from './styleCloner.js';
import { getSupabase, logActivity, syncProject, type ProjectRecord } from './supabase.js';

const app = new Hono();
app.use('*', cors());

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    userName: ENV.USER_NAME,
    renderProfile: ENV.RENDER_PROFILE,
    supabaseEnabled: Boolean(getSupabase()),
    supabaseUrl: ENV.SUPABASE_URL,
    supabaseAnonKey: ENV.SUPABASE_ANON_KEY,
  }),
);

app.get('/api/media/quota', async (c) => {
  try {
    return c.json(await getElevenLabsQuota());
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.post('/api/media/voice', async (c) => {
  try {
    const body = await c.req.json<{ projectId: string; text: string; voiceId?: string; outName?: string }>();
    const res = await generateVoiceWithTimestamps(body);
    await logActivity(`Generate voiceover (${res.durationSec}s)`, body.projectId);
    return c.json(res);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.post('/api/media/sfx', async (c) => {
  try {
    const body = await c.req.json<{ projectId: string; prompt: string; durationSec?: number; outName?: string }>();
    const res = await generateSfx(body);
    return c.json(res);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.get('/api/projects', async (c) => {
  const local = await listLocalProjects();
  const sb = getSupabase();
  if (!sb) return c.json({ projects: local, source: 'local' });

  const { data, error } = await sb.from('projects').select('*').order('updated_at', { ascending: false }).limit(100);
  if (error) return c.json({ projects: local, source: 'local', warning: error.message });
  return c.json({ projects: data ?? local, source: 'supabase' });
});

app.post('/api/projects', async (c) => {
  const body = await c.req.json<{ title: string; durationSec?: number; notes?: string; styleId?: string }>();
  let style = null;
  const sb = getSupabase();
  if (body.styleId && sb) {
    const { data } = await sb.from('styles').select('*').eq('id', body.styleId).maybeSingle();
    style = data;
  }
  const project = await createLocalProject({ ...body, style });
  return c.json(project, 201);
});

app.patch('/api/projects/:id/status', async (c) => {
  const id = path.basename(c.req.param('id'));
  const { status } = await c.req.json<{ status: ProjectRecord['status'] }>();
  const sb = getSupabase();
  if (sb) {
    await sb.from('projects').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  }
  const pFile = path.join(PROJECTS_DIR, id, 'project.json');
  try {
    const current = JSON.parse(await fs.readFile(pFile, 'utf8')) as ProjectRecord;
    current.status = status;
    current.updated_at = new Date().toISOString();
    await fs.writeFile(pFile, JSON.stringify(current, null, 2), 'utf8');
    await syncProject(current);
  } catch {
    // Proyek milik teman (tidak ada di disk lokal)
  }
  await logActivity(`Ubah status -> ${status}`, id);
  return c.json({ ok: true, id, status });
});

app.get('/api/projects/:id/artifacts', async (c) => {
  const id = path.basename(c.req.param('id'));
  return c.json(await getProjectArtifacts(id));
});

app.get('/api/projects/:id/renders/:file', async (c) => {
  const id = path.basename(c.req.param('id'));
  const file = path.basename(c.req.param('file'));
  const fullPath = path.join(PROJECTS_DIR, id, 'renders', file);
  try {
    const data = await fs.readFile(fullPath);
    return new Response(data, { headers: { 'Content-Type': 'video/mp4' } });
  } catch {
    return c.json({ error: 'File render tidak ditemukan' }, 404);
  }
});

app.post('/api/projects/:id/chat', async (c) => {
  const id = path.basename(c.req.param('id'));
  const { prompt } = await c.req.json<{ prompt: string }>();

  return streamSSE(c, async (stream) => {
    await logActivity(`Menjalankan Claude Code di proyek ${id}`, id);
    await runClaudeInProject(id, prompt, (ev) => {
      void stream.writeSSE({ event: ev.type, data: ev.data });
    });
  });
});

app.get('/api/styles', async (c) => {
  const sb = getSupabase();
  if (!sb) return c.json({ styles: [] });
  const { data } = await sb.from('styles').select('*').order('created_at', { ascending: false });
  return c.json({ styles: data ?? [] });
});

app.post('/api/styles/clone', async (c) => {
  try {
    const { url } = await c.req.json<{ url: string }>();
    const style = await cloneStyleFromUrl(url);
    return c.json(style, 201);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.get('/api/skill', async (c) => {
  const content = await fs.readFile(SKILL_PATH, 'utf8').catch(() => '');
  return c.json({ content });
});

app.put('/api/skill', async (c) => {
  const { content } = await c.req.json<{ content: string }>();
  await fs.writeFile(SKILL_PATH, content, 'utf8');
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port: ENV.PORT }, () => {
  console.log(`[studio-server] berjalan di http://localhost:${ENV.PORT} (${ENV.USER_NAME} | ${ENV.RENDER_PROFILE})`);
});
