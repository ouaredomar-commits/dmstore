import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, CheckCircle2, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_STORAGE_KEY = 'dzmahall_pwa_install_dismissed_v1';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isIOSModalOpen, setIsIOSModalOpen] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect if already running in installed standalone mode
    const checkStandalone = () => {
      const standaloneMatch =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(standaloneMatch);
    };

    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = () => checkStandalone();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    // Detect iPhone / iPad / iPod on iOS
    const ua = window.navigator.userAgent || '';
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOSDevice(isIOS);

    // Capture official Android/Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setIsIOSModalOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsIOSModalOpen(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors
    }
  };

  const handleAndroidInstallClick = async () => {
    if (!deferredPrompt || isInstalling) return;
    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
      } else {
        handleDismiss();
      }
    } catch (err) {
      console.warn('PWA install prompt error:', err);
    } finally {
      setIsInstalling(false);
    }
  };

  // Never show if already installed in standalone mode or if user dismissed the invitation
  if (isStandalone || isDismissed) {
    return null;
  }

  // Never show a non-functional install button: only render if Android beforeinstallprompt is ready OR on iPhone/iPad
  const canInstallOnAndroid = Boolean(deferredPrompt);
  const canShowIOSGuide = isIOSDevice && !deferredPrompt;

  if (!canInstallOnAndroid && !canShowIOSGuide) {
    return null;
  }

  return (
    <>
      {/* Discreet Bottom Floating Invitation */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-sm z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-[#002244] text-white rounded-2xl p-3.5 sm:p-4 shadow-xl border border-white/15 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="DzMahall"
              className="w-11 h-11 rounded-xl object-contain bg-white p-1 shrink-0 shadow-xs"
            />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold text-white truncate font-['Plus_Jakarta_Sans']">
                Installer DzMahall
              </p>
              <p className="text-[11px] text-slate-300 leading-tight line-clamp-2">
                {canInstallOnAndroid
                  ? 'Accès rapide depuis votre écran d’accueil'
                  : 'Ajoutez la boutique sur votre iPhone'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canInstallOnAndroid ? (
              <button
                type="button"
                onClick={handleAndroidInstallClick}
                disabled={isInstalling}
                className="px-3.5 py-2 rounded-xl bg-[#FF6500] hover:bg-[#E55B00] active:bg-[#CC5100] text-white text-xs font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-60 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Installer l'application</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsIOSModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#FF6500] hover:bg-[#E55B00] active:bg-[#CC5100] text-white text-xs font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Installer</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Fermer l'invitation d'installation"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Explanatory Modal for iPhone / iPad (iOS Safari) */}
      {isIOSModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
          onClick={() => setIsIOSModalOpen(false)}
        >
          <div
            className="bg-white text-[#212B36] w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl border border-[#DFE3E8] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/apple-touch-icon.png"
                  alt="DzMahall"
                  className="w-12 h-12 rounded-2xl border border-[#DFE3E8] object-contain bg-white p-1 shadow-xs"
                />
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF6500] block">
                    Application Mobile iOS
                  </span>
                  <h3 className="text-base font-black text-[#002244] font-['Plus_Jakarta_Sans']">
                    Installer DzMahall sur iPhone
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIOSModalOpen(false)}
                className="p-1.5 rounded-xl bg-[#F4F6F8] text-[#637381] hover:text-[#212B36] transition-colors cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#637381] leading-relaxed">
              Ajoutez DzMahall sur votre écran d'accueil pour ouvrir la boutique en plein écran comme une application mobile :
            </p>

            <ol className="space-y-3 text-xs">
              <li className="flex items-center gap-3 p-3 rounded-2xl bg-[#F4F6F8] border border-[#DFE3E8]">
                <span className="w-6 h-6 rounded-full bg-[#002244] text-white font-black text-[11px] flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="font-bold text-[#212B36]">
                  1. Ouvrir DzMahall dans Safari.
                </span>
              </li>

              <li className="flex items-center gap-3 p-3 rounded-2xl bg-[#F4F6F8] border border-[#DFE3E8]">
                <span className="w-6 h-6 rounded-full bg-[#002244] text-white font-black text-[11px] flex items-center justify-center shrink-0">
                  2
                </span>
                <div className="flex items-center justify-between flex-1 gap-2">
                  <span className="font-bold text-[#212B36]">
                    2. Appuyer sur le bouton de partage.
                  </span>
                  <span className="p-1.5 rounded-lg bg-white border border-[#DFE3E8] text-[#FF6500] shrink-0">
                    <Share className="w-4 h-4" />
                  </span>
                </div>
              </li>

              <li className="flex items-center gap-3 p-3 rounded-2xl bg-[#F4F6F8] border border-[#DFE3E8]">
                <span className="w-6 h-6 rounded-full bg-[#002244] text-white font-black text-[11px] flex items-center justify-center shrink-0">
                  3
                </span>
                <div className="flex items-center justify-between flex-1 gap-2">
                  <span className="font-bold text-[#212B36]">
                    3. Sélectionner « Sur l'écran d'accueil ».
                  </span>
                  <span className="p-1.5 rounded-lg bg-white border border-[#DFE3E8] text-[#002244] shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </span>
                </div>
              </li>

              <li className="flex items-center gap-3 p-3 rounded-2xl bg-[#F4F6F8] border border-[#DFE3E8]">
                <span className="w-6 h-6 rounded-full bg-[#FF6500] text-white font-black text-[11px] flex items-center justify-center shrink-0">
                  4
                </span>
                <div className="flex items-center justify-between flex-1 gap-2">
                  <span className="font-bold text-[#212B36]">
                    4. Confirmer avec « Ajouter ».
                  </span>
                  <span className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#004C3F] shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                </div>
              </li>
            </ol>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs font-semibold text-[#637381] hover:text-[#212B36] transition-colors cursor-pointer"
              >
                Ne plus afficher
              </button>
              <button
                type="button"
                onClick={() => setIsIOSModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-[#002244] hover:bg-[#003366] text-white text-xs font-extrabold transition-colors cursor-pointer"
              >
                J'ai compris
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
