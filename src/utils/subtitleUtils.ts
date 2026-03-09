import { SubLine } from '../types/subtitle';

export function parseSrt(raw: string): SubLine[] {
    // Strip BOM if present, normalise all line endings to \n
    const normalised = raw
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    const rows = normalised.split('\n');
    const timecodeRe = /(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})(?:\s+.*)?$/;

    const lines: SubLine[] = [];
    let autoId = 1;
    let currentId: number | null = null;
    let currentStart: number | null = null;
    let currentEnd: number | null = null;
    let currentText: string[] = [];

    const flushCue = () => {
        if (currentStart === null || currentEnd === null) return;
        const text = currentText.join('\n').trim();
        if (!text) return;
        const id = currentId ?? autoId;
        lines.push({ id, start: currentStart, end: currentEnd, text });
        autoId = Math.max(autoId, id + 1);
    };

    for (const rawRow of rows) {
        const row = rawRow.trim();
        if (!row) {
            flushCue();
            currentId = null;
            currentStart = null;
            currentEnd = null;
            currentText = [];
            continue;
        }

        if (/^(WEBVTT|NOTE|STYLE|REGION)\b/i.test(row)) {
            continue;
        }

        const timeMatch = row.match(timecodeRe);
        if (timeMatch) {
            flushCue();
            currentId = null;
            currentStart = srtTimeToSec(timeMatch[1]);
            currentEnd = srtTimeToSec(timeMatch[2]);
            currentText = [];
            continue;
        }

        if (currentStart !== null && currentEnd !== null) {
            currentText.push(rawRow.trimEnd());
            continue;
        }

        if (/^\d+$/.test(row)) {
            currentId = Number(row);
        }
    }

    flushCue();
    return lines;
}

export function srtTimeToSec(t: string): number {
    const [hms, ms] = t.replace(',', '.').split('.');
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + s + Number('0.' + ms);
}

export function hmsToSec(hms: string): number {
    // Expected format: HH:MM:SS or MM:SS
    const parts = hms.split(':').map(Number);
    if (parts.length === 3) {
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    } else if (parts.length === 2) {
        return (parts[0] || 0) * 60 + (parts[1] || 0);
    }
    return Number(hms) || 0;
}

export function secToVttTime(sec: number): string {
    const totalMs = Math.max(0, Math.round(sec * 1000));
    const h = Math.floor(totalMs / 3600000);
    const m = Math.floor((totalMs % 3600000) / 60000);
    const s = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export function secToSrtTime(sec: number): string {
    const totalMs = Math.max(0, Math.round(sec * 1000));
    const h = Math.floor(totalMs / 3600000);
    const m = Math.floor((totalMs % 3600000) / 60000);
    const s = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

export function linesToVtt(lines: SubLine[], offsetSec: number): string {
    let vtt = 'WEBVTT\n\n';
    for (const l of lines) {
        const s = Math.max(0, l.start + offsetSec);
        const e = Math.max(s + 0.1, l.end + offsetSec);
        vtt += `${l.id}\n${secToVttTime(s)} --> ${secToVttTime(e)}\n${l.text}\n\n`;
    }
    return vtt;
}

export function linesToSrt(lines: SubLine[], offsetSec: number): string {
    return lines.map((l, i) => {
        const s = Math.max(0, l.start + offsetSec);
        const e = Math.max(s + 0.1, l.end + offsetSec);
        return `${i + 1}\n${secToSrtTime(s)} --> ${secToSrtTime(e)}\n${l.text}`;
    }).join('\n\n');
}

export function downloadText(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

export function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
