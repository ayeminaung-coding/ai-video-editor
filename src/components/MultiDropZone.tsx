import React, { useState } from 'react';

const MultiDropZone: React.FC<{
    accept: string;
    icon: string;
    label: string;
    sublabel: string;
    onFiles: (files: File[]) => void;
    color?: string;
}> = ({ accept, icon, label, sublabel, onFiles, color = 'accent-primary' }) => {
    const [drag, setDrag] = useState(false);
    return (
        <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { 
                e.preventDefault(); 
                setDrag(false); 
                const files = Array.from(e.dataTransfer.files); 
                if (files.length > 0) onFiles(files); 
            }}
            className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200
        ${drag ? `border-${color} bg-${color}/5 scale-[1.01]` : 'border-border-primary hover:border-border-secondary'}`}
        >
            <input
                type="file"
                multiple
                accept={accept}
                className="absolute inset-0 opacity-0 cursor-pointer"
                onClick={e => {
                    (e.currentTarget as HTMLInputElement).value = '';
                }}
                onChange={e => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) onFiles(files);
                    e.currentTarget.value = '';
                }}
            />
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-sm font-semibold text-text-primary truncate">
                {label}
            </div>
            <div className="text-xs text-text-tertiary mt-0.5">{sublabel}</div>
        </div>
    );
};

export default MultiDropZone;
