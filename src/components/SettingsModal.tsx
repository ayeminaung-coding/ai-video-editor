import React, { useState } from 'react';
import { useSettings, ApiProvider } from '../contexts/SettingsContext';

const SettingsModal: React.FC = () => {
    const { settings, updateSettings, isModalOpen, setIsModalOpen } = useSettings();

    // Local state for the form so we don't save on every keystroke
    const [localProvider, setLocalProvider] = useState<ApiProvider>(settings.provider);
    const [localProjectId, setLocalProjectId] = useState(settings.vertexProjectId);
    const [localRegion, setLocalRegion] = useState(settings.vertexRegion);
    const [localApiKey, setLocalApiKey] = useState(settings.studioApiKey);
    const [localModel, setLocalModel] = useState(settings.modelName);

    // Sync state if modal is opened (in case settings changed elsewhere)
    React.useEffect(() => {
        if (isModalOpen) {
            setLocalProvider(settings.provider);
            setLocalProjectId(settings.vertexProjectId);
            setLocalRegion(settings.vertexRegion);
            setLocalApiKey(settings.studioApiKey);
            setLocalModel(settings.modelName);
        }
    }, [isModalOpen, settings]);

    if (!isModalOpen) return null;

    const handleSave = () => {
        updateSettings({
            provider: localProvider,
            vertexProjectId: localProjectId,
            vertexRegion: localRegion,
            studioApiKey: localApiKey,
            modelName: localModel,
        });
        setIsModalOpen(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-surface-primary border border-border-primary rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
                    <h2 className="text-xl font-bold text-text-primary">API Settings</h2>
                    <button
                        onClick={() => setIsModalOpen(false)}
                        className="text-text-secondary hover:text-text-primary transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">

                    {/* Provider Toggle */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-text-secondary uppercase tracking-wider">AI Service Provider</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setLocalProvider('studio')}
                                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors border ${localProvider === 'studio'
                                    ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                                    : 'bg-surface-secondary border-border-primary text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                Google AI Studio
                                <span className="block text-xs opacity-75 mt-1 font-normal">Free API Key</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLocalProvider('vertex')}
                                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors border ${localProvider === 'vertex'
                                    ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                                    : 'bg-surface-secondary border-border-primary text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                Google Vertex AI
                                <span className="block text-xs opacity-75 mt-1 font-normal">Enterprise GCP</span>
                            </button>
                        </div>

                        {localProvider === 'studio' ? (
                            <p className="text-xs text-accent-warning">Requires a free Gemini API key from AI Studio.</p>
                        ) : (
                            <p className="text-xs text-text-tertiary">Requires a GOOGLE_APPLICATION_CREDENTIALS json file on the backend server.</p>
                        )}
                    </div>

                    <hr className="border-border-primary" />

                    {/* Provider Specific Settings */}
                    <div className="space-y-4">
                        {localProvider === 'studio' ? (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-text-secondary">GEMINI_API_KEY</label>
                                <input
                                    type="password"
                                    value={localApiKey}
                                    onChange={(e) => setLocalApiKey(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className="w-full bg-surface-secondary border border-border-primary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                                />
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-text-secondary">GCP_PROJECT_ID</label>
                                    <input
                                        type="text"
                                        value={localProjectId}
                                        onChange={(e) => setLocalProjectId(e.target.value)}
                                        placeholder="E.g., personal-ai-12345"
                                        className="w-full bg-surface-secondary border border-border-primary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                                    />
                                    <p className="text-xs text-text-tertiary">Leave blank to use the .env default.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-text-secondary">GCP_REGION</label>
                                    <input
                                        type="text"
                                        value={localRegion}
                                        onChange={(e) => setLocalRegion(e.target.value)}
                                        placeholder="us-central1"
                                        className="w-full bg-surface-secondary border border-border-primary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                                    />
                                </div>
                            </>
                        )}

                        <div className="space-y-2 pt-2">
                            <label className="block text-sm font-medium text-text-secondary">Gemini Model Name</label>
                            <input
                                type="text"
                                value={localModel}
                                onChange={(e) => setLocalModel(e.target.value)}
                                placeholder="gemini-2.0-flash"
                                className="w-full bg-surface-secondary border border-border-primary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 font-mono text-sm"
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => setLocalModel('gemini-2.0-flash')}
                                    className="text-xs px-2 py-1 rounded bg-surface-secondary border border-border-primary text-text-secondary hover:text-text-primary"
                                >gemini-2.0-flash</button>
                                <button
                                    onClick={() => setLocalModel('gemini-3.1-flash-lite-preview')}
                                    className="text-xs px-2 py-1 rounded bg-surface-secondary border border-border-primary text-text-secondary hover:text-text-primary"
                                >gemini-3.1-flash-lite (Studio Only)</button>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border-primary flex justify-end gap-3 bg-surface-secondary/50">
                    <button
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 rounded-lg font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-accent-primary hover:bg-accent-primary-dark text-white rounded-lg font-medium transition-colors shadow-glow"
                    >
                        Save Settings
                    </button>
                </div>

            </div>
        </div>
    );
};

export default SettingsModal;
