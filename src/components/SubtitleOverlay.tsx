import React from 'react';
import { SubLine, SubStyle } from '../types/subtitle';

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

    if (!activeLine) return null;

    const bgAlpha = style.bgOpacity / 100;

    return (
        <div
            className={`absolute left-0 right-0 flex justify-center pointer-events-none px-4 ${style.position === 'bottom' ? 'bottom-8' : 'top-4'}`}
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
    );
};

export default SubtitleOverlay;
