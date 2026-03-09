import React, { useState } from 'react';

const DropZone: React.FC<{
    accept: string;
    icon: string;
    label: string;
    sublabel: string;
    onFile: (f: File) => void;
    fileName?: string;
    color?: string;
}> = ({ accept, icon, label, sublabel, onFile, fileName, color = 'accent-primary' }) => {
    const [drag, setDrag] = useState(false);
    return (
        <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
            className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200
        ${drag ? `border-${color} bg-${color}/5 scale-[1.01]` : fileName ? 'border-accent-success/50 bg-accent-success/5' : 'border-border-primary hover:border-border-secondary'}`}
        >
            <input
                type="file"
                accept={accept}
                className="absolute inset-0 opacity-0 cursor-pointer"
                onClick={e => {
                    (e.currentTarget as HTMLInputElement).value = '';
                }}
                onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                    e.currentTarget.value = '';
                }}
            />
            <div className="text-2xl mb-1">{fileName ? '✅' : icon}</div>
            <div className="text-sm font-semibold text-text-primary truncate">
                {fileName ? fileName : label}
            </div>
            <div className="text-xs text-text-tertiary mt-0.5">{fileName ? 'Click to replace' : sublabel}</div>
        </div>
    );
};

export default DropZone;
