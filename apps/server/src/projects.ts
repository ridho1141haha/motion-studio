import fs from 'node:fs/promises';
import path from 'node:path';
import { ENV, PROJECTS_DIR, TEMPLATE_DIR, renderAccelerationFlag } from './env.js';
import { logActivity, syncProject, type ProjectRecord, type StyleRecord } from './supabase.js';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'video';
}

export async function createLocalProject(opts: {
  title: string;
  durationSec?: number;
  notes?: string;
  style?: StyleRecord | null;
}): Promise<ProjectRecord> {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  const slug = slugify(opts.title);
  const id = `${slug}-${Date.now().toString(36)}`;
  const dir = path.join(PROJECTS_DIR, id);

  await fs.cp(TEMPLATE_DIR, dir, { recursive: true });
  await fs.mkdir(path.join(dir, 'renders'), { recursive: true });
  await fs.mkdir(path.join(dir, 'stills'), { recursive: true });
  await fs.mkdir(path.join(dir, 'public'), { recursive: true });

  const renderFlag = renderAccelerationFlag();
  const brief = [
    `# ${opts.title}`,
    '',
    `- Project ID: ${id}`,
    `- Owner: ${ENV.USER_NAME}`,
    `- Target durasi: ${opts.durationSec ?? 30} detik (9:16, 1080x1920, 30 fps)`,
    `- Render profile: ${ENV.RENDER_PROFILE}`,
    `- Render command: \`npx remotion render src/index.ts MainVideo renders/final.mp4 ${renderFlag}\``.trim(),
    opts.notes ? `- Catatan: ${opts.notes}` : '',
    '',
    '## Style',
    opts.style
      ? [
          `Nama: ${opts.style.name}`,
          opts.style.prompt,
          opts.style.build_recipe ? `Resep teknis: ${opts.style.build_recipe}` : '',
          opts.style.palette?.length ? `Palette: ${opts.style.palette.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : 'Clean modern motion graphics dengan tipografi tebal, kontras tinggi, dan animasi spring halus.',
  ]
    .filter(Boolean)
    .join('\n');

  await fs.writeFile(path.join(dir, 'BRIEF.md'), brief, 'utf8');

  const record: ProjectRecord = {
    id,
    slug,
    title: opts.title,
    owner: ENV.USER_NAME,
    status: 'draft',
    style_id: opts.style?.id ?? null,
    duration_sec: opts.durationSec ?? 30,
    notes: opts.notes ?? '',
  };

  await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify(record, null, 2), 'utf8');
  await syncProject(record);
  await logActivity(`Membuat proyek baru: ${opts.title}`, id);
  return record;
}

export async function listLocalProjects(): Promise<ProjectRecord[]> {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  const list: ProjectRecord[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      const raw = await fs.readFile(path.join(PROJECTS_DIR, e.name, 'project.json'), 'utf8');
      list.push(JSON.parse(raw) as ProjectRecord);
    } catch {
      // Abaikan folder non-proyek
    }
  }
  return list.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
}

export async function getProjectArtifacts(projectId: string) {
  const dir = path.join(PROJECTS_DIR, path.basename(projectId));
  let renders: string[] = [];
  try {
    renders = (await fs.readdir(path.join(dir, 'renders'))).filter((f) => f.endsWith('.mp4'));
  } catch {
    renders = [];
  }
  let postJson: Record<string, unknown> | null = null;
  try {
    postJson = JSON.parse(await fs.readFile(path.join(dir, 'post.json'), 'utf8'));
  } catch {
    postJson = null;
  }
  return { renders, postJson };
}
