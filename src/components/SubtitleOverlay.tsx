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

// ─── Watermark Overlay ───────────────────────────────────────────────────────

const WatermarkOverlay: React.FC<{ style: SubStyle }> = ({ style }) => {
    const wm = style.watermark;
    if (!wm || !wm.enabled) return null;

    const fillOpacity = wm.opacity / 100;
    
    // Convert hex color to rgba
    const hex = wm.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const textColor = `rgba(${r},${g},${b},${fillOpacity})`;

    const positionStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${wm.xPct}%`,
        top: `${wm.yPct}%`,
        color: textColor,
        fontSize: `${wm.fontSize}px`,
        fontWeight: 'bold',
        pointerEvents: 'none',
        zIndex: 20, // Above everything
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        // In the example, it has a slight black stroke or shadow for visibility
        WebkitTextStroke: '1px rgba(0,0,0,0.5)',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
    };

    return <div style={positionStyle}>{wm.text}</div>;
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
            
            {/* Watermark Overlay */}
            <WatermarkOverlay style={style} />

            {/* Translated subtitle text */}
            {activeLine && (
                <div
                    className="absolute pointer-events-none px-4 flex"
                    style={{ 
                        zIndex: 10,
                        inset: 0,
                        alignItems: style.alignment >= 7 ? 'flex-start' : style.alignment >= 4 ? 'center' : 'flex-end',
                        justifyContent: style.alignment % 3 === 1 ? 'flex-start' : style.alignment % 3 === 2 ? 'center' : 'flex-end',
                        paddingBottom: style.alignment <= 3 ? `${style.marginV}px` : undefined,
                        paddingTop: style.alignment >= 7 ? `${style.marginV}px` : undefined,
                        paddingLeft: style.alignment % 3 === 1 ? `${style.marginH}px` : undefined,
                        paddingRight: style.alignment % 3 === 0 ? `${style.marginH}px` : undefined,
                    }}
                >
                    <div
                        style={{
                            background: `rgba(0,0,0,${bgAlpha})`,
                            fontSize: `${style.fontSize}px`,
                            lineHeight: 1.4,
                            padding: `${style.paddingV}px ${style.paddingH}px`,
                            borderRadius: '6px',
                            textAlign: 'center',
                            maxWidth: '90%',
                            fontFamily: 'inherit',
                        }}
                    >
                        <span style={{
                            display: 'inline-grid',
                            gridTemplateColumns: '1fr',
                            gridTemplateRows: '1fr',
                            alignItems: 'center',
                            justifyItems: 'center'
                        }}>
                            {/* Background Stroke */}
                            {style.strokeEnabled && (
                                <span style={{
                                    gridColumn: 1,
                                    gridRow: 1,
                                    WebkitTextStroke: `${style.strokeSize * 2}px ${style.strokeColor}`,
                                    color: 'transparent',
                                    zIndex: 0,
                                    whiteSpace: 'pre-line',
                                }}>
                                    {activeLine.text}
                                </span>
                            )}
                            {/* Foreground Fill */}
                            <span style={{
                                gridColumn: 1,
                                gridRow: 1,
                                color: style.color,
                                WebkitTextStroke: '0px',
                                zIndex: 1,
                                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                                whiteSpace: 'pre-line',
                            }}>
                                {activeLine.text}
                            </span>
                        </span>
                    </div>
                </div>
            )}
        </>
    );
};

export default SubtitleOverlay;
