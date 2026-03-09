// src/ocrApi.ts - Frontend API Client for OCR extraction

export interface OcrStatusResponse {
    video_id: string;
    status: 'idle' | 'translating' | 'processing' | 'done' | 'error';
    ocr_data: any[] | null;
    error: string | null;
    ocr_progress?: number;
}

export async function apiPollOcrStatus(
    videoId: string,
    onTick?: (status: OcrStatusResponse) => void
): Promise<OcrStatusResponse> {
    const maxErrors = 5;
    let errCount = 0;

    while (true) {
        try {
            const res = await fetch(`/api/ocr/status/${videoId}`);
            const data: OcrStatusResponse = await res.json();
            onTick?.(data);

            if (data.status === 'done' || data.status === 'error') {
                return data;
            }
            // If processing, wait 3 seconds and poll again
            await new Promise(r => setTimeout(r, 3000));
        } catch (err: any) {
            errCount++;
            console.error(`Status check failed (${errCount}/${maxErrors}):`, err);
            if (errCount >= maxErrors) {
                return {
                    video_id: videoId,
                    status: 'error',
                    ocr_data: null,
                    error: `Failed to poll OCR status after ${maxErrors} attempts.`,
                };
            }
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
}
