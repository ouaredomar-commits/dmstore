import React from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Package,
  Clock,
  Truck,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab }) => {
  const { orders, products, carriers, landingPages } = useStore();

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === 'pending_confirmation').length;
  const inTransitOrders = orders.filter((o) => o.status === 'shipped' || o.status === 'in_transit' || o.status === 'out_for_delivery').length;
  const deliveredOrders = orders.filter((o) => o.status === 'delivered').length;
  const returnedOrders = orders.filter((o) => o.status === 'returned' || o.status === 'delivery_failed').length;

  const collectedRevenue = orders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const pipelineRevenue = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'returned' && o.status !== 'delivery_failed')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const deliveryRate =
    deliveredOrders + returnedOrders > 0
      ? Math.round((deliveredOrders / (deliveredOrders + returnedOrders)) * 100)
      : 82;

  const confirmationRate =
    totalOrders > 0
      ? Math.round(((totalOrders - pendingOrders) / totalOrders) * 100)
      : 90;

  const lowStockProducts = products.filter((p) => p.stockQuantity <= 25);
  const connectedCarriers = carriers.filter((c) => c.status === 'connected').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DFE3E8]">
        <div>
          <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider">
            Supervision Opérationnelle
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#212B36] tracking-tight mt-0.5 font-['Plus_Jakarta_Sans']">
            Tableau de Bord DzMahall
          </h1>
          <p className="text-xs text-[#637381] mt-0.5">
            Flux de commandes COD, logistique 58 Wilayas et performances de livraison.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab('landing-pages')}
            className="py-2.5 px-3.5 bg-white border border-[#DFE3E8] hover:border-[#FF6500] text-[#002244] font-bold text-xs rounded-xl transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF6500]" />
            <span>Landing Pages ({landingPages.length})</span>
          </button>
          <button
            onClick={() => onNavigateTab('orders')}
            className="py-2.5 px-4 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            Traiter les Commandes ({pendingOrders})
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Chiffre d'Affaires Encaissé COD (#004C3F) */}
        <div className="bg-white border border-[#DFE3E8] rounded-3xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#637381]">
              CA Encaissé (Livré)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#004C3F] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
              {collectedRevenue.toLocaleString()}
            </span>{' '}
            <span className="text-sm font-bold text-[#004C3F]">DZD</span>
          </div>
          <div className="text-[11px] text-[#637381] flex items-center gap-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-[#004C3F]" />
            <span>Pipeline total : {pipelineRevenue.toLocaleString()} DZD</span>
          </div>
        </div>

        {/* KPI 2: Commandes à Confirmer (#FF6500) */}
        <div className="bg-white border border-[#DFE3E8] rounded-3xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#637381]">
              À Confirmer (Appels)
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#FF6500] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
              {pendingOrders}
            </span>
            <span className="text-xs text-[#637381] ml-2">nouvelles commandes</span>
          </div>
          <p className="text-[11px] text-[#FF6500] font-bold">
            Appels téléphoniques prioritaires
          </p>
        </div>

        {/* KPI 3: En Cours d'Acheminement */}
        <div className="bg-white border border-[#DFE3E8] rounded-3xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#637381]">
              En Transit / Livraison
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#004C3F] flex items-center justify-center">
              <Truck className="w-4 h-4 text-[#004C3F]" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
              {inTransitOrders}
            </span>
            <span className="text-xs text-[#637381] ml-2">colis chez transporteur</span>
          </div>
          <p className="text-[11px] text-[#637381]">
            Suivi temps réel Yalidine & Guepex
          </p>
        </div>

        {/* KPI 4: Taux de Livraison COD (#004C3F) */}
        <div className="bg-white border border-[#DFE3E8] rounded-3xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#637381]">
              Taux de Réussite COD
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#004C3F] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
              {deliveryRate}%
            </span>
            <span className="text-xs text-[#637381] ml-2">colis finalisés</span>
          </div>
          <p className="text-[11px] text-[#004C3F] font-bold">
            Confirmation : {confirmationRate}%
          </p>
        </div>
      </div>

      {/* Middle Section: Commandes Récentes + Alertes Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Orders Table (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-[#DFE3E8] rounded-3xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#212B36] uppercase tracking-wider flex items-center gap-2 font-['Plus_Jakarta_Sans']">
              <Package className="w-4 h-4 text-[#FF6500]" />
              <span>Dernières Commandes COD</span>
            </h2>
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-bold text-[#FF6500] hover:text-[#E55B00] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Voir tout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F4F6F8] text-[#637381] uppercase tracking-wider font-bold border-b border-[#DFE3E8]">
                  <th className="py-2.5 px-3">Réf</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Wilaya</th>
                  <th className="py-2.5 px-3">Montant (DZD)</th>
                  <th className="py-2.5 px-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="hover:bg-[#F4F6F8]/60 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#FF6500]">
                      {order.orderNumber}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-[#212B36]">{order.customerName}</p>
                      <p className="text-[10px] text-[#637381]">{order.customerPhone}</p>
                    </td>
                    <td className="py-2.5 px-3 text-[#212B36] font-medium">
                      {order.wilayaName}
                    </td>
                    <td className="py-2.5 px-3 font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                      {order.totalAmount.toLocaleString()} DZD
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          order.status === 'delivered'
                            ? 'bg-emerald-100 text-[#004C3F]'
                            : order.status === 'pending_confirmation'
                            ? 'bg-orange-100 text-[#FF6500]'
                            : 'bg-slate-100 text-[#212B36]'
                        }`}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Alerts & Logistics Connectors Status (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Stock Alerts in 'Urgence & Rareté' (#D82C0D) */}
          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#212B36] uppercase tracking-wider flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D82C0D]" />
                <span>Alertes Stock Faible</span>
              </h3>
              <span className="text-[10px] bg-red-100 text-[#D82C0D] px-2 py-0.5 rounded-full font-bold">
                {lowStockProducts.length} articles
              </span>
            </div>

            <div className="space-y-2">
              {lowStockProducts.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 bg-[#F4F6F8] rounded-xl border border-[#DFE3E8] flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-[#212B36] truncate">{p.name}</p>
                    <p className="text-[10px] text-[#637381]">Réf : {p.sku}</p>
                  </div>
                  <span className="font-mono font-bold text-[#D82C0D] tabular-nums shrink-0">
                    {p.stockQuantity} ex.
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => onNavigateTab('products')}
              className="w-full py-2 bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] text-xs font-bold rounded-xl transition-colors border border-[#DFE3E8] cursor-pointer"
            >
              Gérer les approvisionnements
            </button>
          </div>

          {/* Quick Carrier Status */}
          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#212B36] uppercase tracking-wider flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
                <Truck className="w-3.5 h-3.5 text-[#004C3F]" />
                <span>Transporteurs Connectés</span>
              </h3>
              <span className="text-[10px] text-[#004C3F] font-bold">
                {connectedCarriers} actifs
              </span>
            </div>

            <p className="text-xs text-[#637381]">
              Yalidine Fast Logistics & Guepex Express synchronisés avec bordereaux 10x15cm.
            </p>

            <button
              onClick={() => onNavigateTab('carriers')}
              className="w-full py-2 bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] text-xs font-bold rounded-xl transition-colors border border-[#DFE3E8] cursor-pointer"
            >
              Configurer les clés d'API (8 transporteurs)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
