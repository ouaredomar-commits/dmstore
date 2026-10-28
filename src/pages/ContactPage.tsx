import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
  Phone,
  MessageCircle,
  MapPin,
  Send,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';

export const ContactPage: React.FC = () => {
  const { contactPhone, contactWhatsApp, storeDomain, setIsCardModalOpen } = useStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const text = `Bonjour DzMahall,\nNom : ${name || 'Client'}\nTéléphone : ${phone || 'Non renseigné'}\nMessage : ${message}`;
    const url = `https://wa.me/${contactWhatsApp}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setSubmitted(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 bg-white">
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-widest text-[#FF6500]">
          Support & Coordonnées
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-[#212B36] tracking-tight font-['Plus_Jakarta_Sans']">
          Contactez l'Équipe DzMahall
        </h1>
        <p className="text-xs sm:text-sm text-[#637381] max-w-2xl">
          Une question sur un produit, une commande en cours ou les délais vers votre wilaya ? Notre service client est à votre écoute 7j/7.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Direct Contacts & Business Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-3xl p-6 sm:p-7 space-y-5 shadow-md">
            <h2 className="text-sm font-bold text-[#212B36] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
              Coordonnées Officielles
            </h2>

            <div className="space-y-4 text-xs">
              {/* WhatsApp direct (#004C3F) */}
              <div className="flex items-start gap-3.5 p-3.5 bg-white rounded-2xl border border-[#DFE3E8] shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#004C3F] flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[#637381] block text-[11px] font-medium">Commande & Contact WhatsApp</span>
                  <a
                    href={`https://wa.me/${contactWhatsApp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-extrabold text-[#212B36] hover:text-[#004C3F] transition-colors tracking-wider"
                  >
                    {contactPhone}
                  </a>
                  <p className="text-[11px] text-[#919EAB] mt-0.5">Réponse rapide dans l'heure</p>
                </div>
              </div>

              {/* Téléphone */}
              <div className="flex items-start gap-3.5 p-3.5 bg-white rounded-2xl border border-[#DFE3E8] shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#FF6500] flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[#637381] block text-[11px] font-medium">Appels Directs</span>
                  <a
                    href={`tel:${contactPhone.replace(/\s+/g, '')}`}
                    className="text-sm font-extrabold text-[#212B36] hover:text-[#FF6500] transition-colors tracking-wider"
                  >
                    {contactPhone}
                  </a>
                  <p className="text-[11px] text-[#919EAB] mt-0.5">Disponible du Samedi au Jeudi, 9h - 20h</p>
                </div>
              </div>

              {/* Couverture & Service */}
              <div className="flex items-start gap-3.5 p-3.5 bg-white rounded-2xl border border-[#DFE3E8] shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#004C3F] flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[#637381] block text-[11px] font-medium">Territoire d'Intervention</span>
                  <p className="text-xs font-bold text-[#212B36]">Livraison dans les 58 Wilayas</p>
                  <p className="text-[11px] text-[#004C3F] font-semibold mt-0.5">Paiement à la livraison garanti</p>
                </div>
              </div>
            </div>

            {/* Official Card Banner */}
            <div className="pt-2">
              <button
                onClick={() => setIsCardModalOpen(true)}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-[#212B36] text-xs font-bold rounded-xl transition-colors border border-[#DFE3E8] flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <CreditCard className="w-4 h-4 text-[#FF6500]" />
                <span>Consulter la Carte de Visite Officielle</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Direct Fast Message via WhatsApp */}
        <div className="lg:col-span-7 bg-[#F4F6F8] border border-[#DFE3E8] rounded-3xl p-6 sm:p-8 space-y-6 shadow-md">
          <div>
            <h2 className="text-base font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">
              Envoyez-nous un Message Direct
            </h2>
            <p className="text-xs text-[#637381] mt-1">
              Votre message sera immédiatement transmis à notre équipe d'assistance par WhatsApp.
            </p>
          </div>

          {submitted && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-3 text-xs text-[#004C3F]">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#004C3F]" />
              <span className="font-medium">Votre message a été transmis vers notre conversation WhatsApp officielle !</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#212B36] mb-1">
                  Votre Nom
                </label>
                <input
                  type="text"
                  placeholder="Ex: Yasmine Belkacem"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#212B36] mb-1">
                  Votre Téléphone (05 / 06 / 07)
                </label>
                <input
                  type="tel"
                  placeholder="Ex: 0550 12 34 56"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#212B36] mb-1">
                Votre Message *
              </label>
              <textarea
                rows={4}
                placeholder="Renseignements sur un produit, demande de suivi de commande, etc."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500] resize-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[#004C3F] hover:bg-[#00382E] text-white font-bold text-xs rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Envoyer vers WhatsApp ({contactPhone})</span>
            </button>
          </form>

          <div className="pt-2 border-t border-[#DFE3E8] text-center text-[11px] text-[#919EAB]">
            {storeDomain} · Paiement à la livraison · Service Client 7j/7
          </div>
        </div>
      </div>
    </div>
  );
};
