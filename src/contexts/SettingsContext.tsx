import React, { createContext, useContext, useState, useEffect } from 'react';

export type ApiProvider = 'vertex' | 'studio';

export interface ApiSettings {
    provider: ApiProvider;
    vertexProjectId: string;
    vertexRegion: string;
    studioApiKey: string;
    modelName: string;
}

interface SettingsContextType {
    settings: ApiSettings;
    updateSettings: (newSettings: Partial<ApiSettings>) => void;
    isModalOpen: boolean;
    setIsModalOpen: (isOpen: boolean) => void;
}

const defaultSettings: ApiSettings = {
    provider: 'vertex',
    vertexProjectId: '',
    vertexRegion: 'us-central1',
    studioApiKey: '',
    modelName: 'gemini-2.0-flash', // default fallback
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<ApiSettings>(defaultSettings);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('ai_video_editor_settings');
        if (saved) {
            try {
                setSettings({ ...defaultSettings, ...JSON.parse(saved) });
            } catch (e) {
                console.error('Failed to parse settings', e);
            }
        }
    }, []);

    const updateSettings = (newSettings: Partial<ApiSettings>) => {
        setSettings((prev) => {
            const updated = { ...prev, ...newSettings };

            // Auto-switch default models based on provider if the user hasn't explicitly set one, 
            // or if they switch providers and the current model is incompatible.
            if (newSettings.provider) {
                if (newSettings.provider === 'studio' && updated.modelName === 'gemini-2.0-flash') {
                    updated.modelName = 'gemini-3.1-flash-lite-preview';
                } else if (newSettings.provider === 'vertex' && updated.modelName === 'gemini-3.1-flash-lite-preview') {
                    updated.modelName = 'gemini-2.0-flash';
                }
            }

            localStorage.setItem('ai_video_editor_settings', JSON.stringify(updated));
            return updated;
        });
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, isModalOpen, setIsModalOpen }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
