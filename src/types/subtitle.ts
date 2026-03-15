export interface SubLine {
    id: number;
    start: number;  // seconds
    end: number;    // seconds
    text: string;
}

export interface BlurRectStyle {
    enabled: boolean;
    /** Free-position: X offset from left edge, % of video width  (0–100) */
    xPct: number;
    /** Free-position: Y offset from top edge, % of video height (0–100) */
    yPct: number;
    widthPct: number;    // % of video width,  1–100
    heightPct: number;   // % of video height, 1–100
    opacity: number;     // 0–100 fill opacity
    blurStrength: number; // 0–30 px blur radius (0 = solid only)
    color: string;       // hex fill color e.g. '#ffffff'
    // Legacy – kept for backward compat; ignored when xPct/yPct are used
    position?: 'bottom' | 'middle' | 'top';
}

export interface WatermarkStyle {
    enabled: boolean;
    text: string;
    xPct: number;
    yPct: number;
    fontSize: number;
    color: string;
    opacity: number;
}

export interface SubStyle {
    fontSize: number;
    color: string;
    bgOpacity: number;
    strokeEnabled: boolean;
    strokeColor: string;
    strokeSize: number;
    alignment: number;
    marginV: number;
    marginH: number;
    /** Horizontal padding (left + right) applied around subtitle text, in pixels */
    paddingH: number;
    /** Vertical padding (top + bottom) applied around subtitle text, in pixels */
    paddingV: number;
    blurRect: BlurRectStyle;
    watermark?: WatermarkStyle;
}
