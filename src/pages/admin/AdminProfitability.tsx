import React, { useState } from 'react';
import {
  TrendingUp,
} from 'lucide-react';

export const AdminProfitability: React.FC = () => {
  const [sellingPrice, setSellingPrice] = useState<number>(4900);
  const [purchaseCost, setPurchaseCost] = useState<number>(2200);
  const [adCostPerOrder, setAdCostPerOrder] = useState<number>(650);
  const [packagingCost, setPackagingCost] = useState<number>(150);
  const [shippingFeeSeller, setShippingFeeSeller] = useState<number>(0);
  const [returnCost, setReturnCost] = useState<number>(400);
  const [confirmationRate, setConfirmationRate] = useState<number>(85);
  const [deliveryRate, setDeliveryRate] = useState<number>(75);
  const [totalOrdersTarget, setTotalOrdersTarget] = useState<number>(100);

  const confirmedOrders = Math.round(totalOrdersTarget * (confirmationRate / 100));
  const deliveredOrders = Math.round(confirmedOrders * (deliveryRate / 100));
  const returnedOrders = confirmedOrders - deliveredOrders;

  const totalRevenue = deliveredOrders * sellingPrice;
  const productCost = deliveredOrders * purchaseCost;
  const totalAdCost = totalOrdersTarget * adCostPerOrder;
  const totalPackagingCost = confirmedOrders * packagingCost;
  const totalReturnFees = returnedOrders * returnCost;
  const totalSellerShipping = deliveredOrders * shippingFeeSeller;

  const totalExpenses =
    productCost + totalAdCost + totalPackagingCost + totalReturnFees + totalSellerShipping;

  const netProfitTotal = totalRevenue - totalExpenses;
  const netProfitPerDelivered = deliveredOrders > 0 ? Math.round(netProfitTotal / deliveredOrders) : 0;
  const netMarginPercent = totalRevenue > 0 ? Math.round((netProfitTotal / totalRevenue) * 100) : 0;

  const computeScenario = (conf: number, del: number) => {
    const confOrd = Math.round(totalOrdersTarget * (conf / 100));
    const delOrd = Math.round(confOrd * (del / 100));
    const retOrd = confOrd - delOrd;
    const rev = delOrd * sellingPrice;
    const exp =
      delOrd * purchaseCost +
      totalOrdersTarget * adCostPerOrder +
      confOrd * packagingCost +
      retOrd * returnCost;
    const net = rev - exp;
    return { conf, del, delOrd, net, margin: rev > 0 ? Math.round((net / rev) * 100) : 0 };
  };

  const optimistic = computeScenario(92, 85);
  const realistic = computeScenario(confirmationRate, deliveryRate);
  const pessimistic = computeScenario(75, 55);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DFE3E8]">
        <div>
          <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider">
            Finance & Modélisation
          </span>
          <h1 className="text-2xl font-black text-[#212B36] mt-0.5 font-['Plus_Jakarta_Sans']">
            Calculateur de Rentabilité E-Commerce Algérie (COD)
          </h1>
          <p className="text-xs text-[#637381] mt-0.5">
            Prenez en compte les retours, confirmations téléphoniques et coûts publicitaires réels.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Inputs (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-[#212B36] uppercase tracking-wider pb-2 border-b border-[#E2E8F0] font-['Plus_Jakarta_Sans']">
            Paramètres Économiques
          </h2>

          <div className="space-y-3.5 text-xs">
            {/* Prix de vente */}
            <div>
              <label className="block text-[#212B36] font-semibold mb-1 flex justify-between">
                <span>Prix de Vente Client (DZD)</span>
                <span className="text-[#FF6500] font-bold">{sellingPrice.toLocaleString()} DZD</span>
              </label>
              <input
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-mono font-bold"
              />
            </div>

            {/* Coût d'achat */}
            <div>
              <label className="block text-[#212B36] font-semibold mb-1 flex justify-between">
                <span>Coût d'Achat Produit (DZD)</span>
                <span className="text-[#637381] font-bold">{purchaseCost.toLocaleString()} DZD</span>
              </label>
              <input
                type="number"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(Number(e.target.value))}
                className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-mono"
              />
            </div>

            {/* Coût pub / CPA */}
            <div>
              <label className="block text-[#212B36] font-semibold mb-1 flex justify-between">
                <span>Coût Publicitaire moyen par commande (CPA DZD)</span>
                <span className="text-[#637381] font-bold">{adCostPerOrder} DZD</span>
              </label>
              <input
                type="number"
                value={adCostPerOrder}
                onChange={(e) => setAdCostPerOrder(Number(e.target.value))}
                className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-mono"
              />
            </div>

            {/* Packaging */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#212B36] font-semibold mb-1">
                  Packaging / Carton (DZD)
                </label>
                <input
                  type="number"
                  value={packagingCost}
                  onChange={(e) => setPackagingCost(Number(e.target.value))}
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-mono"
                />
              </div>

              <div>
                <label className="block text-[#212B36] font-semibold mb-1">
                  Frais retour transporteur (DZD)
                </label>
                <input
                  type="number"
                  value={returnCost}
                  onChange={(e) => setReturnCost(Number(e.target.value))}
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-mono text-[#D82C0D]"
                />
              </div>
            </div>

            {/* Ratios Algérie */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[#212B36] font-semibold mb-1 flex justify-between">
                  <span>Confirmation</span>
                  <span className="text-[#FF6500] font-bold">{confirmationRate}%</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={confirmationRate}
                  onChange={(e) => setConfirmationRate(Number(e.target.value))}
                  className="w-full accent-[#FF6500] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[#212B36] font-semibold mb-1 flex justify-between">
                  <span>Livraison Réelle</span>
                  <span className="text-[#004C3F] font-bold">{deliveryRate}%</span>
                </label>
                <input
                  type="range"
                  min="40"
                  max="95"
                  value={deliveryRate}
                  onChange={(e) => setDeliveryRate(Number(e.target.value))}
                  className="w-full accent-[#004C3F] cursor-pointer"
                />
              </div>
            </div>

            {/* Quantité du lot */}
            <div>
              <label className="block text-[#212B36] font-semibold mb-1">
                Volume de commandes simulé :
              </label>
              <input
                type="number"
                value={totalOrdersTarget}
                onChange={(e) => setTotalOrdersTarget(Number(e.target.value))}
                className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-mono"
              />
            </div>
          </div>
        </div>

        {/* Right Outputs & Scenarios (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Profit Card */}
          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 sm:p-7 space-y-6 shadow-xs">
            <h2 className="text-sm font-bold text-[#212B36] uppercase tracking-wider pb-2 border-b border-[#E2E8F0] font-['Plus_Jakarta_Sans']">
              Résultats Financiers Estimés ({totalOrdersTarget} commandes brutes)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#F4F6F8] p-4 rounded-2xl border border-[#DFE3E8] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#637381]">
                  Bénéfice Net Total
                </span>
                <p
                  className={`text-2xl font-black tabular-nums font-['Plus_Jakarta_Sans'] ${
                    netProfitTotal >= 0 ? 'text-[#004C3F]' : 'text-[#D82C0D]'
                  }`}
                >
                  {netProfitTotal.toLocaleString()} DZD
                </p>
                <p className="text-[10px] text-[#637381]">Marge nette : {netMarginPercent}%</p>
              </div>

              <div className="bg-[#F4F6F8] p-4 rounded-2xl border border-[#DFE3E8] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#637381]">
                  Net / Colis Livré
                </span>
                <p className="text-2xl font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                  {netProfitPerDelivered.toLocaleString()} DZD
                </p>
                <p className="text-[10px] text-[#637381]">{deliveredOrders} colis encaissés</p>
              </div>

              <div className="bg-[#F4F6F8] p-4 rounded-2xl border border-[#DFE3E8] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#637381]">
                  Chiffre d'Affaires
                </span>
                <p className="text-2xl font-black text-[#FF6500] tabular-nums font-['Plus_Jakarta_Sans']">
                  {totalRevenue.toLocaleString()} DZD
                </p>
                <p className="text-[10px] text-[#637381]">Dépenses : {totalExpenses.toLocaleString()} DZD</p>
              </div>
            </div>

            {/* Detailed decomposition */}
            <div className="bg-[#F4F6F8] rounded-2xl p-4 border border-[#DFE3E8] space-y-2 text-xs">
              <span className="font-bold text-[#212B36] block mb-2">Décomposition des coûts du lot :</span>
              <div className="flex justify-between text-[#637381]">
                <span>Coût d'achat ({deliveredOrders} unités livrées) :</span>
                <span className="font-mono text-[#212B36] font-bold">{productCost.toLocaleString()} DZD</span>
              </div>
              <div className="flex justify-between text-[#637381]">
                <span>Publicité totale ({totalOrdersTarget} commandes cibles) :</span>
                <span className="font-mono text-[#212B36] font-bold">{totalAdCost.toLocaleString()} DZD</span>
              </div>
              <div className="flex justify-between text-[#637381]">
                <span>Emballages ({confirmedOrders} colis expédiés) :</span>
                <span className="font-mono text-[#212B36] font-bold">{totalPackagingCost.toLocaleString()} DZD</span>
              </div>
              <div className="flex justify-between text-[#637381]">
                <span>Frais de retours payés au transporteur ({returnedOrders} retours) :</span>
                <span className="font-mono text-[#D82C0D] font-bold">+{totalReturnFees.toLocaleString()} DZD</span>
              </div>
            </div>
          </div>

          {/* 3 Scenarios Comparison Table */}
          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#212B36] uppercase tracking-wider flex items-center gap-2 font-['Plus_Jakarta_Sans']">
              <TrendingUp className="w-4 h-4 text-[#FF6500]" />
              <span>Comparatif des 3 Scénarios Opérationnels</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Optimiste */}
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#004C3F] uppercase text-[10px]">Scénario Optimiste</span>
                  <span className="text-[10px] font-bold text-[#637381]">{optimistic.del}% livr.</span>
                </div>
                <p className="text-lg font-black text-[#004C3F] tabular-nums font-['Plus_Jakarta_Sans']">
                  {optimistic.net.toLocaleString()} DZD
                </p>
                <p className="text-[10px] text-[#637381]">
                  {optimistic.delOrd} colis livrés · Marge : {optimistic.margin}%
                </p>
              </div>

              {/* Réaliste */}
              <div className="bg-orange-50/60 p-4 rounded-2xl border border-orange-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#FF6500] uppercase text-[10px]">Scénario Réaliste</span>
                  <span className="text-[10px] font-bold text-[#637381]">{realistic.del}% livr.</span>
                </div>
                <p className="text-lg font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                  {realistic.net.toLocaleString()} DZD
                </p>
                <p className="text-[10px] text-[#637381]">
                  {realistic.delOrd} colis livrés · Marge : {realistic.margin}%
                </p>
              </div>

              {/* Prudent */}
              <div className="bg-[#F4F6F8] p-4 rounded-2xl border border-[#DFE3E8] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#637381] uppercase text-[10px]">Scénario Prudent</span>
                  <span className="text-[10px] font-bold text-[#637381]">{pessimistic.del}% livr.</span>
                </div>
                <p className="text-lg font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                  {pessimistic.net.toLocaleString()} DZD
                </p>
                <p className="text-[10px] text-[#637381]">
                  {pessimistic.delOrd} colis livrés · Marge : {pessimistic.margin}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
