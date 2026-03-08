// src/translateApi.ts
// API client for the FastAPI backend — used by TranslatePage.tsx

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _envUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
// In dev: use '' so Vite proxy forwards /api → localhost:8000 (no CORS issues)
// In prod: set VITE_API_URL to your deployed backend URL
const BASE_URL: string = (_envUrl && _envUrl.trim() !== '') ? _envUrl.trim().replace(/\/$/, '') : '';


export interface SrtLineRaw {
    start: number;  // seconds
    end: number;
    zh: string;
    my: string;
}

export interface SplitResult {
    split_at: number;
    method: 'silence' | 'midpoint';
    part1_duration: number;
    part2_duration: number;
    total_duration: number;
}

export interface TranslationStatus {
    video_id: string;
    status: 'uploaded' | 'split' | 'translating' | 'done' | 'error';
    translation: {
        part1: SrtLineRaw[];
        part2: SrtLineRaw[];
    } | null;
    srt: {
        part1: string;
        part2: string;
    } | null;
    error: string | null;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function apiUploadVideo(file: File): Promise<{ video_id: string }> {
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${BASE_URL}/api/video/upload`, {
        method: 'POST',
        body: form,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Upload failed (${res.status})`);
    }

    return res.json();
}

// ─── Split ────────────────────────────────────────────────────────────────────

export async function apiSplitVideo(
    videoId: string,
    splitAt?: number  // seconds — if provided, forces a hard cut at that point
): Promise<SplitResult> {
    const url = splitAt != null
        ? `${BASE_URL}/api/video/split/${videoId}?split_at=${splitAt}`
        : `${BASE_URL}/api/video/split/${videoId}`;

    const res = await fetch(url, { method: 'POST' });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Split failed (${res.status})`);
    }

    return res.json();
}

// ─── Translate (start) ────────────────────────────────────────────────────────

export async function apiStartTranslation(videoId: string, settingsOverrides?: any): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/video/translate/${videoId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: settingsOverrides ? JSON.stringify(settingsOverrides) : undefined,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Translation start failed (${res.status})`);
    }
}

// ─── Poll status ──────────────────────────────────────────────────────────────

export async function apiGetStatus(videoId: string): Promise<TranslationStatus> {
    const res = await fetch(`${BASE_URL}/api/video/status/${videoId}`);

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Status check failed (${res.status})`);
    }

    return res.json();
}

/**
 * Poll /status until the job is done or errored.
 * Calls onProgress with the current status string every interval.
 */
export async function apiPollUntilDone(
    videoId: string,
    onProgress: (status: TranslationStatus) => void,
    intervalMs = 3000,
    timeoutMs = 300_000  // 5 min max
): Promise<TranslationStatus> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const statusData = await apiGetStatus(videoId);
        onProgress(statusData);

        if (statusData.status === 'done') return statusData;
        if (statusData.status === 'error') throw new Error(statusData.error ?? 'Translation failed');

        await new Promise(r => setTimeout(r, intervalMs));
    }

    throw new Error('Translation timed out after 5 minutes');
}
