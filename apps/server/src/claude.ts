import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ENV, PROJECTS_DIR, SKILL_PATH, nodeBin } from './env.js';

export interface ClaudeRunEvent {
  type: 'stdout' | 'stderr' | 'done' | 'error';
  data: string;
}

/**
 * Menjalankan Claude Code CLI secara non-interaktif di dalam folder proyek.
 * Menggunakan akun Claude Max yang sudah login di mesin lokal.
 */
export async function runClaudeInProject(
  projectId: string,
  userPrompt: string,
  onEvent: (ev: ClaudeRunEvent) => void,
): Promise<number> {
  const cwd = path.join(PROJECTS_DIR, path.basename(projectId));
  const skill = await fs.readFile(SKILL_PATH, 'utf8').catch(() => '');

  const fullPrompt = [
    skill,
    '---',
    `Folder proyek aktif: ${cwd}`,
    `STUDIO_API_URL=http://localhost:${ENV.PORT}`,
    `PROJECT_ID=${projectId}`,
    '',
    'Permintaan kreator:',
    userPrompt,
  ].join('\n');

  return new Promise((resolve) => {
    const child = spawn(
      nodeBin('claude'),
      ['-p', fullPrompt, '--output-format', 'stream-json', '--verbose'],
      {
        cwd,
        env: {
          ...process.env,
          STUDIO_API_URL: `http://localhost:${ENV.PORT}`,
          PROJECT_ID: projectId,
        },
        shell: false,
      },
    );

    child.stdout.on('data', (chunk: Buffer) => {
      onEvent({ type: 'stdout', data: chunk.toString('utf8') });
    });

    child.stderr.on('data', (chunk: Buffer) => {
      onEvent({ type: 'stderr', data: chunk.toString('utf8') });
    });

    child.on('error', (err) => {
      onEvent({
        type: 'error',
        data: `Gagal menjalankan Claude CLI (${err.message}). Pastikan 'claude' sudah terpasang & login.`,
      });
      resolve(1);
    });

    child.on('close', (code) => {
      onEvent({ type: 'done', data: String(code ?? 0) });
      resolve(code ?? 0);
    });
  });
}
