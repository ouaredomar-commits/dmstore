import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { DzMahallLogo } from './DzMahallLogo';
import { ShoppingBag, MessageCircle, CreditCard, Menu, X, CheckCircle2 } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentRoute,
    navigateTo,
    cartCount,
    setIsCartOpen,
    contactWhatsApp,
    setIsCardModalOpen,
  } = useStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Accueil', path: '/' },
    { label: 'Boutique', path: '/boutique' },
    { label: 'Vente Flash ⚡', path: '/lp/montre-connectee-ultra-pro' },
    { label: 'Suivi Commande', path: '/suivi-commande' },
    { label: 'Livraison 58 Wilayas', path: '/livraison' },
    { label: 'Contact', path: '/contact' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-xs">
      {/* Top micro-banner highlighting 58 Wilayas & COD with 'Garanties & Confiance' green (#004C3F) */}
      <div className="bg-[#004C3F] py-1.5 px-4 text-center text-[11px] font-bold tracking-wide text-white uppercase flex items-center justify-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#B4CCF5]" />
        <span>✦ LIVRAISON RAPIDE 58 WILAYAS ✦</span>
        <span className="hidden sm:inline">· PAIEMENT À LA RÉCEPTION DU COLIS (COD) ·</span>
        <button
          onClick={() => setIsCardModalOpen(true)}
          className="underline hover:text-[#B4CCF5] font-semibold cursor-pointer ml-1 inline-flex items-center gap-1 transition-colors"
        >
          <CreditCard className="w-3 h-3" />
          <span>Voir Carte Officielle</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Brand Wordmark with authentic DzMahall Logo */}
        <button
          onClick={() => navigateTo('/')}
          className="flex items-center text-left cursor-pointer group"
        >
          <DzMahallLogo size="md" showText={true} showSubtitle={true} theme="light" />
        </button>

        {/* Zone 2: Concise Single-line Nav Links (desktop) adhering to Lecture & Confort (#212B36) */}
        <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold uppercase tracking-wider text-[#212B36]">
          {navLinks.map((link) => {
            const isActive = currentRoute === link.path;
            return (
              <button
                key={link.path}
                onClick={() => navigateTo(link.path)}
                className={`whitespace-nowrap transition-colors py-1 cursor-pointer relative ${
                  isActive
                    ? 'text-[#FF6500] font-bold'
                    : 'text-[#212B36] hover:text-[#FF6500]'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6500] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions (WhatsApp, Cart CTA) */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* WhatsApp Direct Order Button with 'Garanties & Confiance' green (#004C3F) */}
          <a
            href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20souhaite%20commander%20ou%20poser%20une%20question.`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#004C3F] hover:bg-[#00382E] text-white text-xs font-bold transition-all shadow-xs"
            title="Commander directement par WhatsApp (+213 660 769 386)"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">WhatsApp</span>
          </a>

          {/* Primary Cart CTA Button (#FF6500) */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 rounded-xl bg-[#FF6500] hover:bg-[#E55B00] active:bg-[#CC5100] text-white transition-colors cursor-pointer flex items-center justify-center shadow-md shadow-orange-500/25"
            aria-label="Voir le panier"
          >
            <ShoppingBag className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#212B36] text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow border-2 border-white tabular-nums">
                {cartCount}
              </span>
            )}
          </button>

          {/* Mobile hamburger menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-[#212B36] hover:bg-[#F4F6F8] transition-colors"
            aria-label="Menu de navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-[#E2E8F0] px-4 py-4 space-y-2 shadow-lg">
          {navLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => {
                navigateTo(link.path);
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
                currentRoute === link.path
                  ? 'bg-orange-50 text-[#FF6500] font-bold'
                  : 'text-[#212B36] hover:bg-[#F4F6F8]'
              }`}
            >
              {link.label}
            </button>
          ))}
          <div className="pt-2 border-t border-[#E2E8F0] flex gap-2">
            <a
              href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20souhaite%20commander.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#004C3F] text-white text-xs font-bold rounded-lg"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Direct</span>
            </a>
            <button
              onClick={() => {
                setIsCardModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="px-3 py-2.5 bg-[#F4F6F8] text-[#212B36] text-xs font-bold rounded-lg border border-[#DFE3E8]"
            >
              Carte
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
