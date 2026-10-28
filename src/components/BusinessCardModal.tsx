import React from 'react';
import { useStore } from '../context/StoreContext';
import { X, Phone, MessageCircle, ShieldCheck, MapPin } from 'lucide-react';

export const BusinessCardModal: React.FC = () => {
  const { isCardModalOpen, setIsCardModalOpen, contactPhone, contactWhatsApp, businessCardImageUrl } = useStore();

  if (!isCardModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F4F6F8]">
          <div>
            <h3 className="text-base font-bold text-[#212B36] flex items-center gap-2 font-['Plus_Jakarta_Sans']">
              <span>Carte Officielle DzMahall</span>
              <span className="text-[10px] bg-emerald-100 text-[#004C3F] border border-emerald-300 font-bold px-2 py-0.5 rounded-full">
                Vérifié
              </span>
            </h3>
            <p className="text-xs text-[#637381]">Coordonnées et QR code officiel de la boutique</p>
          </div>
          <button
            onClick={() => setIsCardModalOpen(false)}
            className="p-1.5 rounded-lg text-[#637381] hover:text-[#212B36] hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Image & Details */}
        <div className="overflow-y-auto p-6 space-y-4">
          <div className="flex justify-center bg-[#F4F6F8] rounded-2xl p-3 border border-[#E2E8F0]">
            <img
              src={businessCardImageUrl}
              alt="Carte de visite officielle DzMahall"
              className="max-h-[380px] w-auto object-contain rounded-xl shadow-md"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="bg-[#F4F6F8] rounded-2xl p-4 border border-[#DFE3E8] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#637381] flex items-center gap-1.5 font-medium">
                <Phone className="w-3.5 h-3.5 text-[#FF6500]" /> Téléphone / WhatsApp :
              </span>
              <span className="font-bold text-[#212B36] tracking-wider">{contactPhone}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#637381] flex items-center gap-1.5 font-medium">
                <MapPin className="w-3.5 h-3.5 text-[#FF6500]" /> Couverture nationale :
              </span>
              <span className="font-semibold text-[#212B36]">58 Wilayas d'Algérie</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#637381] flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#004C3F]" /> Mode de règlement :
              </span>
              <span className="font-bold text-[#004C3F]">Paiement à la livraison (COD)</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <a
              href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20souhaite%20des%20renseignements%20sur%20un%20produit.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#004C3F] hover:bg-[#00382E] text-white text-xs font-bold transition-colors shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Direct</span>
            </a>
            <a
              href={`tel:${contactPhone.replace(/\s+/g, '')}`}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] text-xs font-bold transition-colors border border-[#DFE3E8]"
            >
              <Phone className="w-4 h-4 text-[#FF6500]" />
              <span>Appeler</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
