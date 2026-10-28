import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
  Search,
  Truck,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';

export const OrderTrackingPage: React.FC = () => {
  const { trackOrderByQuery, contactWhatsApp, contactPhone } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const found = await trackOrderByQuery(cleanQuery);
      setSearchedOrder(found);
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusStepIndex = (status: OrderStatus): number => {
    switch (status) {
      case 'pending_confirmation':
        return 0;
      case 'confirmed':
        return 1;
      case 'processing':
      case 'ready_to_ship':
        return 2;
      case 'shipped':
      case 'in_transit':
        return 3;
      case 'out_for_delivery':
        return 4;
      case 'delivered':
        return 5;
      case 'delivery_failed':
      case 'returning':
      case 'returned':
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };

  const stages = [
    { title: 'Commande Reçue', desc: 'Enregistrée sur DzMahall.store' },
    { title: 'Confirmée par Appel', desc: 'Validée par notre opérateur' },
    { title: 'En Préparation', desc: "Emballée avec étiquette d'expédition" },
    { title: 'Expédiée', desc: 'Prise en charge par le transporteur' },
    { title: 'En Cours de Livraison', desc: 'Livreur en route vers votre adresse' },
    { title: 'Colis Livré & Réglé', desc: 'Montant encaissé en espèces' },
  ];

  const currentStep = searchedOrder ? getStatusStepIndex(searchedOrder.status) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 bg-white">
      {/* Page Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#004C3F] text-xs font-bold uppercase tracking-wider">
          <Truck className="w-3.5 h-3.5 text-[#004C3F]" />
          <span>Suivi National 58 Wilayas</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-[#212B36] tracking-tight font-['Plus_Jakarta_Sans']">
          Suivre l'État de Votre Commande
        </h1>
        <p className="text-xs sm:text-sm text-[#637381] max-w-lg mx-auto">
          Entrez votre numéro de commande (ex :{' '}
          <span className="font-mono text-[#212B36] font-bold">DZM-2026-1042</span>) ou le numéro
          de téléphone utilisé lors de votre achat.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#919EAB] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Numéro de commande ou tél (ex: 0550123456)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="px-5 py-3 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-60"
        >
          {isSearching ? 'Recherche...' : 'Rechercher'}
        </button>
      </form>

      {/* Result Display */}
      {searchedOrder ? (
        <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-3xl p-6 sm:p-8 space-y-8 shadow-md">
          {/* Header of Order */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DFE3E8]">
            <div>
              <span className="text-[11px] text-[#637381] font-medium">Référence commande</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl font-black text-[#212B36] font-mono tracking-wider">
                  {searchedOrder.orderNumber}
                </span>
                <span className="px-2.5 py-0.5 bg-orange-100 text-[#FF6500] border border-orange-200 rounded-full text-xs font-bold uppercase">
                  {searchedOrder.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[11px] text-[#637381] font-medium">
                Montant à régler au livreur
              </span>
              <p className="text-2xl font-black text-[#FF6500] tabular-nums font-['Plus_Jakarta_Sans']">
                {searchedOrder.totalAmount.toLocaleString()} DZD
              </p>
            </div>
          </div>

          {/* Delivery Timeline */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#637381] font-['Plus_Jakarta_Sans']">
              Progression de l'acheminement
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              {stages.map((stage, idx) => {
                const isPassed = currentStep >= idx;
                const isCurrent = currentStep === idx;

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-orange-50 border-[#FF6500] text-[#212B36] shadow-xs'
                        : isPassed
                        ? 'bg-white border-emerald-300 text-[#212B36]'
                        : 'bg-white/60 border-[#DFE3E8] text-[#919EAB]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold font-mono">0{idx + 1}</span>
                      {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-[#004C3F]" />}
                    </div>
                    <h4 className="text-xs font-bold leading-snug">{stage.title}</h4>
                    <p className="text-[10px] text-[#637381] mt-1">{stage.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Carrier & Tracking Link */}
          {searchedOrder.trackingNumber && (
            <div className="p-4 bg-white rounded-2xl border border-[#DFE3E8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] text-[#637381] block font-medium">
                  Transporteur assigné
                </span>
                <span className="text-sm font-bold text-[#212B36] flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#FF6500]" />
                  {searchedOrder.carrierName || 'Yalidine Fast Logistics'}
                </span>
                <p className="text-xs text-[#637381] mt-0.5">
                  N° d'expédition :{' '}
                  <span className="font-mono text-[#212B36] font-bold">
                    {searchedOrder.trackingNumber}
                  </span>
                </p>
              </div>

              {searchedOrder.carrierTrackingUrl && (
                <a
                  href={searchedOrder.carrierTrackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-4 rounded-xl bg-[#F4F6F8] hover:bg-slate-200 text-[#FF6500] text-xs font-bold border border-[#DFE3E8] transition-colors flex items-center gap-1.5"
                >
                  <span>Suivre sur le portail transporteur</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Delivery & Items Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Delivery address */}
            <div className="p-4 bg-white rounded-2xl border border-[#DFE3E8] space-y-2 text-xs">
              <span className="font-bold text-[#212B36] uppercase text-[11px] tracking-wider block font-['Plus_Jakarta_Sans']">
                Destinataire & Destination
              </span>
              <p className="text-[#212B36] font-bold">{searchedOrder.customerName}</p>
              <p className="text-[#212B36] font-medium">
                {searchedOrder.wilayaName} ({searchedOrder.commune})
              </p>
              <div className="pt-1 text-[11px] text-[#FF6500] font-bold">
                Mode : {searchedOrder.deliveryMode === 'home' ? '🏠 À Domicile' : '🏢 Retrait Stop Desk'}
              </div>
            </div>

            {/* Articles */}
            <div className="p-4 bg-white rounded-2xl border border-[#DFE3E8] space-y-2 text-xs">
              <span className="font-bold text-[#212B36] uppercase text-[11px] tracking-wider block font-['Plus_Jakarta_Sans']">
                Articles commandés
              </span>
              <div className="space-y-1.5">
                {searchedOrder.items.map((it: any, i: number) => (
                  <div key={i} className="flex justify-between text-[#212B36]">
                    <span className="line-clamp-1">
                      {it.quantity}× {it.productName}
                    </span>
                    <span className="font-bold tabular-nums text-[#212B36] shrink-0 ml-2 font-['Plus_Jakarta_Sans']">
                      {it.totalPrice.toLocaleString()} DZD
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-[#DFE3E8] flex justify-between text-[#637381] text-[11px]">
                <span>Frais de livraison :</span>
                <span className="text-[#004C3F] font-bold">+{searchedOrder.shippingCost} DZD</span>
              </div>
            </div>
          </div>

          {/* Help box */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs">
            <span className="text-[#212B36]">
              Besoin de modifier l'adresse ou le créneau de livraison ?
            </span>
            <a
              href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20souhaite%20des%20informations%20sur%20ma%20commande%20${searchedOrder.orderNumber}.`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#004C3F] hover:bg-[#00382E] text-white font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Contacter le support ({contactPhone})</span>
            </a>
          </div>
        </div>
      ) : hasSearched && !isSearching ? (
        <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-3xl p-10 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-[#FF6500] mx-auto" />
          <h3 className="text-base font-bold text-[#212B36]">Aucune commande trouvée</h3>
          <p className="text-xs text-[#637381] max-w-md mx-auto">
            Vérifiez l'orthographe de votre numéro de commande (ex: DZM-2026-...) ou assurez-vous
            d'avoir saisi le même numéro de téléphone que lors de votre commande.
          </p>
        </div>
      ) : null}
    </div>
  );
};
