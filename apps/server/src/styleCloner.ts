import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ENV, nodeBin } from './env.js';
import { logActivity, syncStyle, type StyleRecord } from './supabase.js';

function execFileSafe(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: false });
    let out = '';
    let err = '';
    child.stdout.on('data', (c: Buffer) => (out += c.toString('utf8')));
    child.stderr.on('data', (c: Buffer) => (err += c.toString('utf8')));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`));
    });
  });
}

/**
 * Pola Copy Style ala Tayang Studio:
 * 1. Download video via yt-dlp
 * 2. Ambil 48 frame merata ke 4 contact sheet 4x3 via ffmpeg (Windows-safe)
 * 3. Minta Claude Code membaca sheet dan menghasilkan style.json
 */
export async function cloneStyleFromUrl(url: string): Promise<StyleRecord> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-style-'));
  const sheetsDir = path.join(workDir, 'sheets');
  await fs.mkdir(sheetsDir, { recursive: true });

  try {
    await execFileSafe(
      'yt-dlp',
      ['-f', 'bv*[height<=1080]+ba/b[height<=1080]/b', '-o', path.join(workDir, 'source.%(ext)s'), url],
      workDir,
    );

    const files = await fs.readdir(workDir);
    const sourceFile = files.find((f) => f.startsWith('source.'));
    if (!sourceFile) throw new Error('File video dari yt-dlp tidak ditemukan');
    const sourcePath = path.join(workDir, sourceFile);

    const durRaw = await execFileSafe(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', sourcePath],
      workDir,
    );
    const duration = Math.max(1, parseFloat(durRaw.trim()) || 30);

    await execFileSafe(
      'ffmpeg',
      [
        '-y',
        '-i',
        sourcePath,
        '-vf',
        `fps=48/${duration.toFixed(2)},scale=320:-2,tile=4x3`,
        '-frames:v',
        '4',
        '-q:v',
        '4',
        path.join(sheetsDir, 'sheet-%02d.jpg'),
      ],
      workDir,
    );

    const styleJsonPath = path.join(workDir, 'style.json');
    const prompt = [
      `Analisis contact sheet di folder "${sheetsDir}" (sheet-01.jpg s.d. sheet-04.jpg).`,
      `Tulis file JSON valid ke "${styleJsonPath}" dengan schema:`,
      '{ "name": string, "prompt": string, "build_recipe": string, "palette": ["#RRGGBB"], "notes": { "camera": string, "pacing": string, "type": string, "color": string, "captions": string, "transitions": string } }',
      'Fokus pada gaya visual Remotion (tipografi, warna, pacing, layout, transisi). Jangan menyalin isi/teks video asli.',
    ].join('\n');

    await execFileSafe(nodeBin('claude'), ['-p', prompt], workDir);

    const raw = JSON.parse(await fs.readFile(styleJsonPath, 'utf8')) as Partial<StyleRecord>;
    const style: StyleRecord = {
      id: `style-${Date.now().toString(36)}`,
      name: raw.name || 'Copied Style',
      owner: ENV.USER_NAME,
      source_url: url,
      engine: 'remotion',
      prompt: raw.prompt || 'Modern motion graphics style',
      build_recipe: raw.build_recipe ?? null,
      palette: Array.isArray(raw.palette) ? raw.palette.slice(0, 8) : [],
      notes: raw.notes ?? {},
    };

    await syncStyle(style);
    await logActivity(`Menambahkan style baru: ${style.name}`);
    return style;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
