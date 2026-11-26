import fs from 'node:fs/promises';
import path from 'node:path';
import { ENV, PROJECTS_DIR } from './env.js';

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

/** Konversi character-level alignment ElevenLabs menjadi word-level timestamps untuk subtitle Remotion. */
function charsToWords(chars: string[], starts: number[], ends: number[]): WordTimestamp[] {
  const words: WordTimestamp[] = [];
  let buf = '';
  let wStart = -1;
  let wEnd = 0;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? '';
    if (/\s/.test(ch)) {
      if (buf.trim()) {
        words.push({ word: buf.trim(), start: wStart, end: wEnd });
      }
      buf = '';
      wStart = -1;
    } else {
      if (wStart < 0) wStart = starts[i] ?? 0;
      wEnd = ends[i] ?? wStart;
      buf += ch;
    }
  }
  if (buf.trim()) {
    words.push({ word: buf.trim(), start: wStart, end: wEnd });
  }
  return words;
}

export async function getElevenLabsQuota() {
  if (!ENV.ELEVENLABS_API_KEY) {
    return { configured: false, characterCount: 0, characterLimit: 0, tier: 'unconfigured' };
  }
  const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
    headers: { 'xi-api-key': ENV.ELEVENLABS_API_KEY },
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs quota error (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    character_count?: number;
    character_limit?: number;
    tier?: string;
    next_character_count_reset_unix?: number;
  };
  return {
    configured: true,
    characterCount: data.character_count ?? 0,
    characterLimit: data.character_limit ?? 0,
    tier: data.tier ?? 'unknown',
    resetUnix: data.next_character_count_reset_unix ?? null,
  };
}

export async function generateVoiceWithTimestamps(opts: {
  projectId: string;
  text: string;
  voiceId?: string;
  outName?: string;
}) {
  if (!ENV.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY belum diisi di .env');

  const voiceId = opts.voiceId || ENV.ELEVENLABS_DEFAULT_VOICE_ID;
  const outName = path.basename(opts.outName || 'voiceover.mp3');
  const publicDir = path.join(PROJECTS_DIR, opts.projectId, 'public');
  await fs.mkdir(publicDir, { recursive: true });

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ENV.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: opts.text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs TTS error (${res.status}): ${await res.text()}`);
  }

  const payload = (await res.json()) as {
    audio_base64: string;
    alignment?: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    };
  };

  const audioPath = path.join(publicDir, outName);
  await fs.writeFile(audioPath, Buffer.from(payload.audio_base64, 'base64'));

  const words = payload.alignment
    ? charsToWords(
        payload.alignment.characters,
        payload.alignment.character_start_times_seconds,
        payload.alignment.character_end_times_seconds,
      )
    : [];

  const durationSec = words.length ? Number(words[words.length - 1]!.end.toFixed(2)) : 0;
  const tsPath = path.join(publicDir, 'timestamps.json');
  await fs.writeFile(tsPath, JSON.stringify({ audioFile: outName, durationSec, words }, null, 2), 'utf8');

  return { audioFile: `public/${outName}`, timestampsFile: 'public/timestamps.json', durationSec, wordCount: words.length };
}

export async function generateSfx(opts: {
  projectId: string;
  prompt: string;
  durationSec?: number;
  outName?: string;
}) {
  if (!ENV.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY belum diisi di .env');

  const outName = path.basename(opts.outName || 'sfx.mp3');
  const publicDir = path.join(PROJECTS_DIR, opts.projectId, 'public', 'sfx');
  await fs.mkdir(publicDir, { recursive: true });

  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': ENV.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: opts.prompt,
      duration_seconds: opts.durationSec ?? 2.0,
      prompt_influence: 0.35,
    }),
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs SFX error (${res.status}): ${await res.text()}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(publicDir, outName);
  await fs.writeFile(outPath, buf);

  return { file: `public/sfx/${outName}`, bytes: buf.length };
}
