import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.join(REPO_ROOT, '.env') });

export const ENV = {
  USER_NAME: (process.env.USER_NAME || 'Creator').trim(),
  RENDER_PROFILE: (process.env.RENDER_PROFILE === 'nvidia' ? 'nvidia' : 'cpu-safe') as 'nvidia' | 'cpu-safe',
  PORT: Number(process.env.PORT || 8787),
  ELEVENLABS_API_KEY: (process.env.ELEVENLABS_API_KEY || '').trim(),
  ELEVENLABS_DEFAULT_VOICE_ID: (process.env.ELEVENLABS_DEFAULT_VOICE_ID || 'pNInz6obpgDQGcFmaJgB').trim(),
  SUPABASE_URL: (process.env.SUPABASE_URL || '').trim(),
  SUPABASE_ANON_KEY: (process.env.SUPABASE_ANON_KEY || '').trim(),
};

export const PROJECTS_DIR = path.join(REPO_ROOT, 'projects');
export const TEMPLATE_DIR = path.join(REPO_ROOT, 'templates', 'remotion-base');
export const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'SKILL.md');

export function renderAccelerationFlag(): string {
  return ENV.RENDER_PROFILE === 'nvidia' ? '--hardware-acceleration=if-possible' : '';
}

/** Windows memerlukan .cmd untuk CLI berbasis Node (npx, npm, claude). */
export function nodeBin(cmd: string): string {
  return process.platform === 'win32' ? `${cmd}.cmd` : cmd;
}
