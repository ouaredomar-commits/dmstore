import React from 'react';
import { useStore } from '../context/StoreContext';
import { DzMahallLogo } from './DzMahallLogo';
import { Phone, MessageCircle, MapPin, ShieldCheck, CreditCard, ChevronRight } from 'lucide-react';

export const Footer: React.FC = () => {
  const { navigateTo, contactPhone, contactWhatsApp, storeDomain, setIsCardModalOpen } = useStore();

  return (
    <footer className="bg-[#F4F6F8] border-t border-[#E2E8F0] pt-16 pb-12 text-[#637381]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main 4-column footer */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-[#DFE3E8]">
          {/* Col 1: Brand & Tagline */}
          <div className="space-y-4">
            <DzMahallLogo size="md" showText={true} showSubtitle={true} theme="light" />
            <p className="text-xs text-[#637381] leading-relaxed">
              La qualité premium, livrée partout en Algérie. Commandez en toute sérénité avec le paiement à la réception de votre colis.
            </p>
            <div className="pt-1">
              <button
                onClick={() => setIsCardModalOpen(true)}
                className="inline-flex items-center gap-2 text-xs font-bold text-[#FF6500] hover:text-[#E55B00] transition-colors cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Afficher la carte de visite officielle</span>
              </button>
            </div>
          </div>

          {/* Col 2: Navigation rapide */}
          <div>
            <h4 className="text-xs font-bold text-[#212B36] uppercase tracking-wider mb-4 font-['Plus_Jakarta_Sans']">
              Boutique & Services
            </h4>
            <ul className="space-y-2.5 text-xs text-[#637381]">
              <li>
                <button
                  onClick={() => navigateTo('/boutique')}
                  className="hover:text-[#FF6500] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-[#919EAB]" />
                  Catalogue Accessoires
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('/suivi-commande')}
                  className="hover:text-[#FF6500] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-[#919EAB]" />
                  Suivre mon colis (58 Wilayas)
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('/livraison')}
                  className="hover:text-[#FF6500] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-[#919EAB]" />
                  Tarifs & Délais de livraison
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('/commande')}
                  className="hover:text-[#FF6500] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-[#919EAB]" />
                  Commander en ligne (COD)
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Informations légales */}
          <div>
            <h4 className="text-xs font-bold text-[#212B36] uppercase tracking-wider mb-4 font-['Plus_Jakarta_Sans']">
              Sécurité & Confiance
            </h4>
            <ul className="space-y-2.5 text-xs text-[#637381]">
              <li>
                <button
                  onClick={() => navigateTo('/conditions-generales')}
                  className="hover:text-[#FF6500] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-[#919EAB]" />
                  Conditions Générales de Vente
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('/politique-confidentialite')}
                  className="hover:text-[#FF6500] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-[#919EAB]" />
                  Politique de Confidentialité
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('/contact')}
                  className="hover:text-[#FF6500] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-[#919EAB]" />
                  Support Client & Réclamations
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact & Réseaux */}
          <div>
            <h4 className="text-xs font-bold text-[#212B36] uppercase tracking-wider mb-4 font-['Plus_Jakarta_Sans']">
              Contact & WhatsApp
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-[#FF6500] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#212B36] tracking-wider">{contactPhone}</p>
                  <p className="text-[11px] text-[#637381]">Appel & WhatsApp 7j/7</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-[#FF6500] shrink-0" />
                <span className="text-[#212B36] font-medium">Algérie · Livraison dans les 58 Wilayas</span>
              </div>

              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#004C3F] shrink-0" />
                <span className="text-[#004C3F] font-bold">Paiement à la livraison · Vérification avant achat</span>
              </div>

              <div className="pt-2">
                <a
                  href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20souhaite%20commander.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#004C3F] hover:bg-[#00382E] text-white font-bold text-xs transition-colors shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Discussion WhatsApp Directe</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#919EAB]">
          <p>© {new Date().getFullYear()} {storeDomain} — Tous droits réservés.</p>
          <div className="flex items-center gap-5 text-[#637381] font-semibold">
            <span className="hidden sm:inline text-slate-400">Suivez DzMahall :</span>
            
            {/* Instagram */}
            <a
              href="https://www.instagram.com/dzmahall/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#637381] hover:text-[#E1306C] transition-colors p-1"
              aria-label="Instagram officiel DzMahall"
              title="Instagram @dzmahall"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span>Instagram</span>
            </a>

            {/* Facebook */}
            <a
              href="https://www.facebook.com/profile.php?id=100069818106984"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#637381] hover:text-[#1877F2] transition-colors p-1"
              aria-label="Facebook officiel DzMahall"
              title="Facebook DzMahall"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook</span>
            </a>

            {/* TikTok */}
            <a
              href="https://www.tiktok.com/@dzmahall"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#637381] hover:text-[#000000] transition-colors p-1"
              aria-label="TikTok officiel DzMahall"
              title="TikTok @dzmahall"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.79 1.34-.02 2.56-.84 3.08-2.07.25-.56.33-1.18.33-1.8V.02h-.09z"/>
              </svg>
              <span>TikTok</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
