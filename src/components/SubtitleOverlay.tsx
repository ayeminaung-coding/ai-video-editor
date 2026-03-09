import React from 'react';
import { SubLine, SubStyle } from '../types/subtitle';

// ─── Blur Rectangle Overlay ───────────────────────────────────────────────────

const BlurRectOverlay: React.FC<{ style: SubStyle }> = ({ style }) => {
    const br = style.blurRect;
    if (!br.enabled) return null;

    const fillOpacity = br.opacity / 100;
    const blurPx = br.blurStrength;

    // Convert hex color to rgba
    const hex = br.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const bgColor = `rgba(${r},${g},${b},${fillOpacity})`;

    const positionStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${br.xPct ?? 0}%`,
        top: `${br.yPct ?? 0}%`,
        width: `${br.widthPct ?? 100}%`,
        height: `${br.heightPct}%`,
        background: bgColor,
        backdropFilter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
        WebkitBackdropFilter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
        pointerEvents: 'none',
        zIndex: 5,
        transition: 'all 0.15s ease',
    };

    return <div style={positionStyle} />;
};

// ─── Subtitle Text Overlay ────────────────────────────────────────────────────

const SubtitleOverlay: React.FC<{
    lines: SubLine[];
    currentTime: number;
    offsetSec: number;
    style: SubStyle;
}> = ({ lines, currentTime, offsetSec, style }) => {
    const activeLine = lines.find(l => {
        const s = l.start + offsetSec;
        const e = l.end + offsetSec;
        return currentTime >= s && currentTime <= e;
    });

    const bgAlpha = style.bgOpacity / 100;

    return (
        <>
            {/* Blur rectangle to cover original/hardcoded subtitles */}
            <BlurRectOverlay style={style} />

            {/* Translated subtitle text */}
            {activeLine && (
                <div
                    className={`absolute left-0 right-0 flex justify-center pointer-events-none px-4 ${style.position === 'bottom' ? 'bottom-8' : 'top-4'}`}
                    style={{ zIndex: 10 }}
                >
                    <div
                        style={{
                            background: `rgba(0,0,0,${bgAlpha})`,
                            color: style.color,
                            fontSize: `${style.fontSize}px`,
                            lineHeight: 1.4,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            textAlign: 'center',
                            maxWidth: '90%',
                            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                            fontFamily: 'inherit',
                            whiteSpace: 'pre-line',
                        }}
                    >
                        {activeLine.text}
                    </div>
                </div>
            )}
        </>
    );
};

export default SubtitleOverlay;
