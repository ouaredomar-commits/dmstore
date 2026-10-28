import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Search, Truck, Clock, ShieldCheck } from 'lucide-react';

export const DeliveryInfoPage: React.FC = () => {
  const { wilayas } = useStore();
  const [search, setSearch] = useState('');

  const filtered = wilayas.filter(
    (w) =>
      w.code.includes(search) ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.nameAr.includes(search) ||
      w.communes.some((c) => c.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 bg-white">
      {/* Title */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-widest text-[#FF6500]">
          Politique & Tarifs
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-[#212B36] tracking-tight font-['Plus_Jakarta_Sans']">
          Livraison dans les 58 Wilayas d'Algérie
        </h1>
        <p className="text-xs sm:text-sm text-[#637381] max-w-2xl">
          Découvrez la grille tarifaire transparente et les délais moyens d'acheminement à domicile ou en point relais Stop Desk.
        </p>
      </div>

      {/* 3 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-5 space-y-2">
          <ShieldCheck className="w-6 h-6 text-[#004C3F]" />
          <h3 className="text-sm font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">Paiement à la Livraison (COD)</h3>
          <p className="text-xs text-[#637381]">
            Vous ne payez rien d'avance. Réglez uniquement après inspection visuelle de votre colis.
          </p>
        </div>
        <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-5 space-y-2">
          <Truck className="w-6 h-6 text-[#FF6500]" />
          <h3 className="text-sm font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">Stop Desk ou Domicile</h3>
          <p className="text-xs text-[#637381]">
            Faites-vous livrer chez vous ou économisez sur les frais en retirant votre colis dans un bureau express.
          </p>
        </div>
        <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-5 space-y-2">
          <Clock className="w-6 h-6 text-[#004C3F]" />
          <h3 className="text-sm font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">Délais Express 24h - 48h</h3>
          <p className="text-xs text-[#637381]">
            Expédition rapide vers le Centre, l'Est, l'Ouest et liaisons régulières vers le Grand Sud.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-[#919EAB] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par wilaya, code (ex: 16) ou commune..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#DFE3E8] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
          />
        </div>
        <div className="text-xs text-[#637381]">
          Affichage de <strong className="text-[#212B36] font-bold">{filtered.length}</strong> wilayas sur 58
        </div>
      </div>

      {/* 58 Wilayas Table */}
      <div className="bg-white border border-[#DFE3E8] rounded-3xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F4F6F8] text-[#637381] uppercase tracking-wider font-bold border-b border-[#DFE3E8]">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Wilaya</th>
                <th className="py-3 px-4">Nom Arabe</th>
                <th className="py-3 px-4">🏠 Domicile (DZD)</th>
                <th className="py-3 px-4">🏢 Stop Desk (DZD)</th>
                <th className="py-3 px-4">Délai Indicatif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filtered.map((w) => (
                <tr key={w.code} className="hover:bg-[#F4F6F8]/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-[#FF6500]">{w.code}</td>
                  <td className="py-3 px-4 font-bold text-[#212B36]">{w.name}</td>
                  <td className="py-3 px-4 font-medium text-[#637381] font-sans" dir="rtl">
                    {w.nameAr}
                  </td>
                  <td className="py-3 px-4 font-bold text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                    {w.homeDeliveryFee} DZD
                  </td>
                  <td className="py-3 px-4 font-bold text-[#004C3F] tabular-nums font-['Plus_Jakarta_Sans']">
                    {w.deskDeliveryFee} DZD
                  </td>
                  <td className="py-3 px-4 text-[#637381]">{w.estimatedDeliveryHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
