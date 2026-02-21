import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

declare global {
    interface Window {
        __pwa_deferred_prompt?: BeforeInstallPromptEvent | null;
        __show_pwa_install_prompt?: () => void;
    }
}

const isStandaloneMode = () => {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    const nav = navigator as Navigator & { standalone?: boolean };
    return Boolean(nav.standalone);
};

export default function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isStandaloneMode()) return;

        const dismissed = localStorage.getItem('pwa_install_dismissed_v2') === 'true';
        if (dismissed) return;

        const handleInstalled = () => {
            setDeferredPrompt(null);
            setIsVisible(false);
            window.__pwa_deferred_prompt = null;
            window.__show_pwa_install_prompt = undefined;
            localStorage.removeItem('pwa_install_dismissed_v2');
        };

        const handleAvailable = () => {
            const promptEvent = window.__pwa_deferred_prompt || null;
            if (!promptEvent) return;
            window.__show_pwa_install_prompt = () => {
                setDeferredPrompt(promptEvent);
                setIsVisible(true);
            };
            setDeferredPrompt(promptEvent);
            setIsVisible(true);
        };

        window.addEventListener('pwa:available', handleAvailable);
        window.addEventListener('appinstalled', handleInstalled);
        handleAvailable();

        return () => {
            window.removeEventListener('pwa:available', handleAvailable);
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    const handleDismiss = () => {
        localStorage.setItem('pwa_install_dismissed_v2', 'true');
        setIsVisible(false);
    };

    if (!isVisible || !deferredPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:max-w-md z-50">
            <div className="bg-white border border-slate-200 shadow-2xl shadow-slate-300/30 rounded-3xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                    <Download size={22} />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-black text-slate-900">Install this app</p>
                    <p className="text-xs text-slate-500 font-medium">Get faster access from your home screen.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDismiss}
                        className="px-3 py-2 text-xs font-black text-slate-400 hover:text-slate-600 transition"
                    >
                        Not now
                    </button>
                    <button
                        onClick={handleInstall}
                        className="px-4 py-2 text-xs font-black text-white bg-slate-900 hover:bg-black rounded-xl shadow-lg transition active:scale-95"
                    >
                        Install
                    </button>
                </div>
            </div>
        </div>
    );
}
