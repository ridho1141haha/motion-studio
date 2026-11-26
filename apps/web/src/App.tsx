import React, { useEffect, useState } from 'react';
import { Clapperboard, FileCode2, FolderKanban, Palette, Play, RefreshCw, Send, Sparkles } from 'lucide-react';
import {
  cloneStyle,
  createProject,
  fetchArtifacts,
  fetchHealth,
  fetchProjects,
  fetchQuota,
  fetchStyles,
  subscribeTeamUpdates,
  updateProjectStatus,
  type HealthInfo,
  type Project,
  type QuotaInfo,
  type StyleItem,
} from './api';

type Tab = 'studio' | 'board' | 'styles' | 'skill';

const STATUS_BADGE: Record<Project['status'], string> = {
  draft: 'bg-slate-800 text-slate-300',
  scripting: 'bg-amber-900/60 text-amber-300',
  building: 'bg-blue-900/60 text-blue-300',
  qa: 'bg-purple-900/60 text-purple-300',
  rendering: 'bg-indigo-900/60 text-indigo-300',
  ready: 'bg-emerald-900/60 text-emerald-300',
  posted: 'bg-teal-900/60 text-teal-200',
};

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('studio');
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [styles, setStyles] = useState<StyleItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [filterOwner, setFilterOwner] = useState<'all' | 'mine' | 'team'>('all');

  // Form buat proyek baru
  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState(30);
  const [newStyleId, setNewStyleId] = useState('');

  // Studio chat + preview
  const [prompt, setPrompt] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [renders, setRenders] = useState<string[]>([]);
  const [postJson, setPostJson] = useState<Record<string, unknown> | null>(null);

  // Copy style & Skill editor
  const [styleUrl, setStyleUrl] = useState('');
  const [cloning, setCloning] = useState(false);
  const [skillText, setSkillText] = useState('');
  const [skillSaved, setSkillSaved] = useState(false);

  const refreshAll = async () => {
    const [p, s, q] = await Promise.all([fetchProjects(), fetchStyles(), fetchQuota().catch(() => null)]);
    setProjects(p);
    setStyles(s);
    if (q) setQuota(q);
  };

  useEffect(() => {
    fetchHealth().then((h) => {
      setHealth(h);
      void refreshAll();
    });
    fetch('/api/skill')
      .then((r) => r.json())
      .then((d) => setSkillText(d.content ?? ''));
  }, []);

  useEffect(() => {
    if (!health) return;
    return subscribeTeamUpdates(health, () => {
      void refreshAll();
    });
  }, [health]);

  useEffect(() => {
    if (!activeId) return;
    fetchArtifacts(activeId).then((a) => {
      setRenders(a.renders);
      setPostJson(a.postJson);
    });
  }, [activeId, running]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const p = await createProject({
      title: newTitle.trim(),
      durationSec: newDuration,
      styleId: newStyleId || undefined,
    });
    setNewTitle('');
    setActiveId(p.id);
    setLogs([`Proyek "${p.title}" siap. Kirim instruksi ke Claude Code untuk mulai membuat script.`]);
    void refreshAll();
  };

  const handleSendPrompt = async () => {
    if (!activeId || !prompt.trim() || running) return;
    setRunning(true);
    setLogs((prev) => [...prev, `> ${prompt}`]);
    const currentPrompt = prompt;
    setPrompt('');

    const res = await fetch(`/api/projects/${encodeURIComponent(activeId)}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: currentPrompt }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setLogs((prev) => [...prev, text]);
      }
    }
    setRunning(false);
    void refreshAll();
  };

  const handleCloneStyle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!styleUrl.trim()) return;
    setCloning(true);
    try {
      await cloneStyle(styleUrl.trim());
      setStyleUrl('');
      await refreshAll();
    } finally {
      setCloning(false);
    }
  };

  const handleSaveSkill = async () => {
    await fetch('/api/skill', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: skillText }),
    });
    setSkillSaved(true);
    setTimeout(() => setSkillSaved(false), 2000);
  };

  const filteredProjects = projects.filter((p) => {
    if (filterOwner === 'mine') return p.owner === health?.userName;
    if (filterOwner === 'team') return p.owner !== health?.userName;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-5 py-3 flex items-center justify-between bg-slate-900/70">
        <div className="flex items-center gap-3">
          <Clapperboard className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold tracking-tight">Motion Studio</span>
          {health && (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {health.userName} · {health.renderProfile === 'nvidia' ? 'RTX GPU' : 'CPU-Safe'}
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              health?.supabaseEnabled ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
            }`}
          >
            {health?.supabaseEnabled ? 'Supabase Live' : 'Mode Lokal'}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          {quota?.configured && (
            <span>
              ElevenLabs:{' '}
              <strong className="text-slate-200">
                {(quota.characterLimit - quota.characterCount).toLocaleString('id-ID')}
              </strong>{' '}
              / {quota.characterLimit.toLocaleString('id-ID')} char
            </span>
          )}
          <button onClick={refreshAll} className="p-1.5 rounded hover:bg-slate-800 text-slate-300" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Nav Tabs */}
      <nav className="border-b border-slate-800 px-5 flex gap-2 bg-slate-900/40">
        {[
          { id: 'studio', label: 'Studio', icon: Play },
          { id: 'board', label: `Team Board (${projects.length})`, icon: FolderKanban },
          { id: 'styles', label: `Styles (${styles.length})`, icon: Palette },
          { id: 'skill', label: 'SKILL.md', icon: FileCode2 },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition ${
                tab === t.id
                  ? 'border-indigo-400 text-white font-medium'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Main */}
      <main className="flex-1 p-5 max-w-7xl w-full mx-auto">
        {tab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Kiri: Buat Proyek + Chat Claude */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <form onSubmit={handleCreateProject} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-2">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Topik video baru (mis: Kenapa Gunung Merapi Aktif?)"
                  className="flex-1 min-w-52 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={newStyleId}
                  onChange={(e) => setNewStyleId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Style Default</option>
                  {styles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.owner})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm"
                  title="Durasi (detik)"
                />
                <button className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-medium">
                  Buat Proyek
                </button>
              </form>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 flex-1">
                <div className="flex items-center justify-between">
                  <select
                    value={activeId}
                    onChange={(e) => setActiveId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="">-- Pilih proyek lokal --</option>
                    {projects
                      .filter((p) => p.owner === health?.userName)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} [{p.status}]
                        </option>
                      ))}
                  </select>
                  <span className="text-xs text-slate-400">
                    Alur: Script → Approve → Audio ElevenLabs → Remotion → 4x3 QA → Render
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 h-80 overflow-y-auto font-mono text-xs space-y-1.5 text-slate-300">
                  {logs.length === 0 ? (
                    <p className="text-slate-500">Pilih atau buat proyek, lalu kirim prompt ke Claude Code.</p>
                  ) : (
                    logs.map((line, i) => (
                      <pre key={i} className="whitespace-pre-wrap break-words">
                        {line}
                      </pre>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
                    disabled={!activeId || running}
                    placeholder="Contoh: Buatkan script 30 detik dulu untuk aku review"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendPrompt}
                    disabled={!activeId || running}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    {running ? 'Berjalan...' : 'Kirim'}
                  </button>
                </div>
              </div>
            </div>

            {/* Kanan: Preview Video + post.json */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-medium mb-3">Preview Render Lokal</h2>
                {activeId && renders.length > 0 ? (
                  <video
                    key={renders[0]}
                    controls
                    className="w-full max-h-[420px] rounded-lg bg-black"
                    src={`/api/projects/${encodeURIComponent(activeId)}/renders/${encodeURIComponent(renders[0])}`}
                  />
                ) : (
                  <div className="h-72 rounded-lg border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                    Belum ada file MP4 di folder renders/
                  </div>
                )}
              </div>

              {postJson && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
                  <h3 className="font-medium text-indigo-300">Siap Posting (post.json)</h3>
                  <p className="font-semibold">{String(postJson.title ?? '')}</p>
                  <p className="text-slate-300 text-xs">{String(postJson.description ?? '')}</p>
                  {Array.isArray(postJson.hashtags) && (
                    <p className="text-xs text-indigo-400">
                      {postJson.hashtags.map((h) => `#${String(h)}`).join(' ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'board' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Team Board (Saling Pantau Realtime)</h2>
              <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                {(['all', 'mine', 'team'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterOwner(f)}
                    className={`px-3 py-1 rounded ${filterOwner === f ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  >
                    {f === 'all' ? 'Semua' : f === 'mine' ? 'Punya Saya' : 'Punya Teman'}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-950/60 text-xs text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Judul / Topik</th>
                    <th className="px-4 py-3">Pemilik</th>
                    <th className="px-4 py-3">Durasi</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredProjects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium">{p.title}</td>
                      <td className="px-4 py-3 text-slate-300">{p.owner}</td>
                      <td className="px-4 py-3 text-slate-400">{p.duration_sec ?? 30} dtk</td>
                      <td className="px-4 py-3">
                        <select
                          value={p.status}
                          onChange={(e) => updateProjectStatus(p.id, e.target.value as Project['status'])}
                          className={`text-xs px-2 py-1 rounded font-medium ${STATUS_BADGE[p.status]}`}
                        >
                          {Object.keys(STATUS_BADGE).map((s) => (
                            <option key={s} value={s} className="bg-slate-900 text-slate-100">
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Belum ada proyek.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'styles' && (
          <div className="space-y-5">
            <form onSubmit={handleCloneStyle} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-2">
              <input
                value={styleUrl}
                onChange={(e) => setStyleUrl(e.target.value)}
                placeholder="Tempel link TikTok / Reels / YouTube Shorts untuk Copy Style (4x3 contact sheet)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
              <button
                disabled={cloning}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                {cloning ? 'Menganalisis...' : 'Copy Style'}
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {styles.map((s) => (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{s.name}</h3>
                    <span className="text-xs text-slate-400">by {s.owner}</span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-3">{s.prompt}</p>
                  {s.palette && s.palette.length > 0 && (
                    <div className="flex gap-1.5 pt-1">
                      {s.palette.map((hex) => (
                        <span
                          key={hex}
                          className="w-5 h-5 rounded border border-slate-700"
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'skill' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Editor skills/SKILL.md</h2>
              <button
                onClick={handleSaveSkill}
                className="bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg text-sm font-medium"
              >
                {skillSaved ? 'Tersimpan!' : 'Simpan SKILL.md'}
              </button>
            </div>
            <textarea
              value={skillText}
              onChange={(e) => setSkillText(e.target.value)}
              className="w-full h-[540px] bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200"
            />
          </div>
        )}
      </main>
    </div>
  );
};
