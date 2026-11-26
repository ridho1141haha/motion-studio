# Motion Studio MVP (Local-First + Supabase Team Sync)

Aplikasi studio video *motion graphics* lokal untuk kerja mandiri berdua (Windows) dengan **Claude Code (Claude Max)**, **ElevenLabs Creator (Voice + Timestamps + SFX)**, **Remotion**, dan **Supabase Free Tier** untuk saling pantau *realtime*.

## Prasyarat (Di Kedua PC Windows)

1. **Node.js 22+** & **pnpm** (`npm i -g pnpm`)
2. **Claude Code CLI** sudah terpasang dan login ke akun Claude Max (`claude --version`)
3. **FFmpeg & FFprobe** ada di PATH (`winget install Gyan.FFmpeg`)
4. **yt-dlp** (untuk fitur Copy Style dari TikTok/YouTube/Reels: `winget install yt-dlp.yt-dlp`)

## Setup Cepat (5 Menit)

### 1. Setup Supabase (Cukup 1x untuk Berdua)
1. Buat project gratis di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, paste seluruh isi file `supabase/schema.sql`, lalu klik **Run**.
3. Ambil **Project URL** dan **anon public key** di *Project Settings -> API*.

### 2. Konfigurasi `.env` di Masing-masing PC
Copy `.env.example` menjadi `.env`, lalu sesuaikan:
- **Di laptopmu (AMD Ryzen 5 Pro)**:
  `USER_NAME=Ridho`
  `RENDER_PROFILE=cpu-safe`
- **Di PC temanmu (RTX 5070)**:
  `USER_NAME=Teman`
  `RENDER_PROFILE=nvidia`
- Isi `ELEVENLABS_API_KEY`, `SUPABASE_URL`, dan `SUPABASE_ANON_KEY` yang sama di kedua mesin.

### 3. Install & Jalankan
```powershell
pnpm install
pnpm dev
```
Buka browser di `http://localhost:5173`. Backend lokal berjalan di `http://localhost:8787`.

## Alur Kerja Utama
1. **Team Board**: Cek dulu topik apa yang sedang/sudah dibuat temanmu (realtime dari Supabase) supaya tidak bentrok.
2. **Styles**: Pilih preset style bersama, atau tempel link video TikTok/Reels/YouTube untuk mengekstrak *contact sheet* 4x3 dan resep gaya baru.
3. **Studio**: Buat proyek baru -> Claude menyusun script -> setelah disetujui, Claude memanggil proxy lokal `/api/media/voice` (ElevenLabs *with-timestamps*) & `/api/media/sfx` -> membangun scene Remotion -> menjalankan **4x3 Contact Sheet Frame Check** -> merender MP4 lokal -> menulis `post.json` siap *copy-paste*.
