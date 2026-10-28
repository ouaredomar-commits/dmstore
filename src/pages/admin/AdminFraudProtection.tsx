import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { FraudProtectionSettings, Order } from '../../types';
import { normalizeAndValidateAlgerianPhone } from '../../utils/orderSecurity';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Ban,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Plus,
  Sliders,
  Activity,
  PhoneCall,
  Play,
  Clock,
  Lock,
  UserCheck,
} from 'lucide-react';

export const AdminFraudProtection: React.FC = () => {
  const {
    orders,
    updateOrderStatus,
    fraudWatchlist,
    fraudSettings,
    securityEvents,
    refreshFraudOverview,
    upsertWatchlistPhone,
    removeWatchlistPhone,
    saveFraudSettings,
    runSecuritySelfTests,
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState<
    'suspicious' | 'watchlist' | 'thresholds' | 'audit_tests'
  >('suspicious');

  // Phone history search
  const [phoneSearch, setPhoneSearch] = useState('');

  // Watchlist form state
  const [newPhone, setNewPhone] = useState('');
  const [newStatus, setNewStatus] = useState<'watched' | 'blocked' | 'trusted'>('watched');
  const [newReason, setNewReason] = useState('');
  const [newDurationHours, setNewDurationHours] = useState<number>(168); // 7 days default
  const [watchlistFeedback, setWatchlistFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Settings form state
  const [localSettings, setLocalSettings] = useState<FraudProtectionSettings>(fraudSettings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  // 12 Mandatory Security Tests state
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{
    passed: number;
    total: number;
    allPassed: boolean;
    results: { id: number; name: string; passed: boolean; expected: string; actual: string }[];
  } | null>(null);

  useEffect(() => {
    refreshFraudOverview();
  }, []);

  useEffect(() => {
    setLocalSettings(fraudSettings);
  }, [fraudSettings]);

  // Suspicious orders list
  const suspiciousOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status === 'needs_review' ||
        o.riskLevel === 'high' ||
        o.riskLevel === 'medium' ||
        (o.riskReasons && o.riskReasons.length > 0)
    );
  }, [orders]);

  // Aggregated phone intelligence across all orders
  const phoneHistoryStats = useMemo(() => {
    const map = new Map<
      string,
      {
        phone: string;
        names: Set<string>;
        wilayas: Set<string>;
        totalOrders: number;
        confirmedCount: number;
        deliveredCount: number;
        cancelledCount: number;
        failedOrReturnedCount: number;
        needsReviewCount: number;
        totalAmountDzd: number;
        lastOrderAt: string;
        orders: Order[];
      }
    >();

    orders.forEach((o) => {
      const parsed = normalizeAndValidateAlgerianPhone(o.customerPhone);
      const key = parsed.isValid ? parsed.normalized : o.customerPhone.replace(/\s+/g, '');
      const existing = map.get(key) || {
        phone: key,
        names: new Set<string>(),
        wilayas: new Set<string>(),
        totalOrders: 0,
        confirmedCount: 0,
        deliveredCount: 0,
        cancelledCount: 0,
        failedOrReturnedCount: 0,
        needsReviewCount: 0,
        totalAmountDzd: 0,
        lastOrderAt: o.createdAt,
        orders: [],
      };

      existing.names.add(o.customerName);
      existing.wilayas.add(`${o.wilayaCode}-${o.wilayaName}`);
      existing.totalOrders += 1;
      existing.totalAmountDzd += o.totalAmount;
      if (o.status === 'confirmed' || o.status === 'processing' || o.status === 'shipped') {
        existing.confirmedCount += 1;
      }
      if (o.status === 'delivered') existing.deliveredCount += 1;
      if (o.status === 'cancelled') existing.cancelledCount += 1;
      if (o.status === 'delivery_failed' || o.status === 'returned') {
        existing.failedOrReturnedCount += 1;
      }
      if (o.status === 'needs_review') existing.needsReviewCount += 1;
      if (new Date(o.createdAt).getTime() > new Date(existing.lastOrderAt).getTime()) {
        existing.lastOrderAt = o.createdAt;
      }
      existing.orders.push(o);
      map.set(key, existing);
    });

    const list = Array.from(map.values()).sort(
      (a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
    );

    if (!phoneSearch.trim()) return list;
    const q = phoneSearch.toLowerCase().trim();
    return list.filter(
      (item) =>
        item.phone.includes(q) ||
        Array.from(item.names).some((n) => n.toLowerCase().includes(q)) ||
        Array.from(item.wilayas).some((w) => w.toLowerCase().includes(q))
    );
  }, [orders, phoneSearch]);

  const handleAddWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setWatchlistFeedback(null);

    const parsed = normalizeAndValidateAlgerianPhone(newPhone);
    if (!parsed.isValid) {
      setWatchlistFeedback({
        type: 'error',
        text: parsed.errorMessage || 'Numéro algérien invalide (ex: 0550123456).',
      });
      return;
    }

    if (!newReason.trim()) {
      setWatchlistFeedback({
        type: 'error',
        text: 'Veuillez indiquer un motif (ex: 3 colis refusés, faux numéro, etc.).',
      });
      return;
    }

    const res = await upsertWatchlistPhone({
      phone: parsed.normalized,
      status: newStatus,
      reason: newReason.trim(),
      durationHours: newDurationHours > 0 ? newDurationHours : null,
    });

    if (res.ok) {
      setWatchlistFeedback({
        type: 'success',
        text: `Le numéro ${parsed.normalized} a été enregistré dans la liste (${
          newStatus === 'blocked'
            ? 'Bloqué'
            : newStatus === 'watched'
            ? 'Surveillé'
            : 'Client fiable'
        }).`,
      });
      setNewPhone('');
      setNewReason('');
    } else {
      setWatchlistFeedback({
        type: 'error',
        text: res.error || 'Erreur lors de l\'enregistrement.',
      });
    }
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSavedMsg(null);
    const ok = await saveFraudSettings(localSettings);
    setIsSavingSettings(false);
    setSettingsSavedMsg(
      ok
        ? 'Paramètres anti-fraude et seuils serveur enregistrés avec succès.'
        : 'Erreur lors de la sauvegarde des paramètres.'
    );
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await runSecuritySelfTests();
      setTestResults(res);
    } finally {
      setIsRunningTests(false);
    }
  };

  const activeBlockedCount = fraudWatchlist.filter((w) => w.status === 'blocked').length;
  const activeWatchedCount = fraudWatchlist.filter((w) => w.status === 'watched').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DFE3E8]">
        <div>
          <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Cybersécurité COD & Prévention des Fausses Commandes</span>
          </span>
          <h1 className="text-2xl font-black text-[#212B36] mt-0.5 font-['Plus_Jakarta_Sans']">
            Protection Anti-Fraude & Anti-Spam
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refreshFraudOverview()}
            className="py-2.5 px-4 bg-white hover:bg-slate-50 text-[#212B36] text-xs font-bold rounded-xl transition-colors border border-[#DFE3E8] flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#FF6500]" />
            <span>Actualiser</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('audit_tests');
              handleRunTests();
            }}
            className="py-2.5 px-4 bg-[#002244] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Play className="w-3.5 h-3.5 text-[#FF6500]" />
            <span>Tester les 12 scénarios</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-[#DFE3E8] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#637381] font-bold">
            <span>Commandes à vérifier</span>
            <ShieldAlert className="w-4 h-4 text-[#FF6500]" />
          </div>
          <p className="text-2xl font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
            {suspiciousOrders.length}
          </p>
          <p className="text-[11px] text-[#637381]">
            Isolées avant expédition (risque moyen ou élevé)
          </p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-[#DFE3E8] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#637381] font-bold">
            <span>Numéros sous surveillance</span>
            <Eye className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
            {activeWatchedCount}
          </p>
          <p className="text-[11px] text-[#637381]">
            Marquage automatique « À vérifier »
          </p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-[#DFE3E8] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#637381] font-bold">
            <span>Numéros bloqués (Temporaire/Perm)</span>
            <Ban className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
            {activeBlockedCount}
          </p>
          <p className="text-[11px] text-[#637381]">
            Rejet serveur immédiat sans décrémenter le stock
          </p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-[#DFE3E8] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#637381] font-bold">
            <span>Attaques / Spams neutralisés</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
            {securityEvents.length}
          </p>
          <p className="text-[11px] text-[#637381]">
            Bots, honeypots, prix falsifiés & rafales bloqués
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-[#DFE3E8] shadow-2xs">
        <button
          onClick={() => setActiveSubTab('suspicious')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'suspicious'
              ? 'bg-[#FF6500] text-white shadow-xs'
              : 'text-[#637381] hover:text-[#212B36] hover:bg-[#F4F6F8]'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Commandes suspectes & Historique N° ({suspiciousOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('watchlist')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'watchlist'
              ? 'bg-[#FF6500] text-white shadow-xs'
              : 'text-[#637381] hover:text-[#212B36] hover:bg-[#F4F6F8]'
          }`}
        >
          <Ban className="w-4 h-4" />
          <span>Numéros Surveillés / Bloqués ({fraudWatchlist.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('thresholds')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'thresholds'
              ? 'bg-[#FF6500] text-white shadow-xs'
              : 'text-[#637381] hover:text-[#212B36] hover:bg-[#F4F6F8]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Seuils Anti-Spam & Règles COD</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit_tests')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'audit_tests'
              ? 'bg-[#FF6500] text-white shadow-xs'
              : 'text-[#637381] hover:text-[#212B36] hover:bg-[#F4F6F8]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Journal Sécurité & 12 Tests Obligatoires</span>
        </button>
      </div>

      {/* TAB 1: SUSPICIOUS ORDERS & PHONE HISTORY */}
      {activeSubTab === 'suspicious' && (
        <div className="space-y-6">
          {/* Suspicious Orders Table */}
          <div className="bg-white border border-[#DFE3E8] rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#DFE3E8] flex items-center justify-between bg-[#F4F6F8]/50">
              <div>
                <h2 className="text-sm font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                  Commandes signalées « À vérifier » ou à risque ({suspiciousOrders.length})
                </h2>
                <p className="text-[11px] text-[#637381]">
                  Ces commandes ne sont jamais supprimées silencieusement : vérifiez le motif et confirmez-les par appel avant expédition.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F4F6F8] text-[#637381] uppercase tracking-wider font-bold border-b border-[#DFE3E8]">
                    <th className="py-3 px-4">Commande</th>
                    <th className="py-3 px-4">Client & Téléphone</th>
                    <th className="py-3 px-4">Wilaya & Total</th>
                    <th className="py-3 px-4">Niveau de Risque</th>
                    <th className="py-3 px-4">Raisons du signalement</th>
                    <th className="py-3 px-4 text-right">Décision Rapide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {suspiciousOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#919EAB]">
                        Aucune commande suspecte en attente de vérification.
                      </td>
                    </tr>
                  ) : (
                    suspiciousOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-[#F4F6F8]/60">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-[#FF6500] block">
                            {o.orderNumber}
                          </span>
                          <span className="text-[10px] text-[#637381] uppercase font-bold">
                            Statut : {o.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-[#212B36] block">{o.customerName}</span>
                          <span className="font-mono text-[11px] text-[#637381]">
                            {o.customerPhone}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-[#212B36] block">
                            {o.wilayaCode} - {o.wilayaName}
                          </span>
                          <span className="font-mono font-bold text-[#FF6500]">
                            {o.totalAmount.toLocaleString()} DZD
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${
                              o.riskLevel === 'high'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            {o.riskLevel === 'high' ? 'Risque élevé' : 'Risque moyen'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <ul className="list-disc pl-4 text-[11px] text-[#212B36] space-y-0.5">
                            {(o.riskReasons && o.riskReasons.length > 0
                              ? o.riskReasons
                              : ['Marquée manuellement à vérifier']
                            ).map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => updateOrderStatus(o.id, 'confirmed')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                            title="Valider et passer en Confirmée"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => updateOrderStatus(o.id, 'cancelled')}
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold cursor-pointer"
                            title="Annuler la commande et libérer le stock"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() =>
                              upsertWatchlistPhone({
                                phone: o.customerPhone,
                                status: 'blocked',
                                reason: `Bloqué suite à la commande suspecte ${o.orderNumber}`,
                                durationHours: 168,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-black text-white text-[11px] font-bold cursor-pointer"
                            title="Bloquer ce numéro pour 7 jours"
                          >
                            Bloquer N° (7j)
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Phone History Lookup */}
          <div className="bg-white border border-[#DFE3E8] rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#DFE3E8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F4F6F8]/50">
              <div>
                <h2 className="text-sm font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                  Historique de fiabilité par numéro de téléphone ({phoneHistoryStats.length} numéros)
                </h2>
                <p className="text-[11px] text-[#637381]">
                  Détectez les numéros ayant plusieurs refus de livraison, annulations ou changements de noms/wilayas.
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[#919EAB] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(e.target.value)}
                  placeholder="Rechercher un n° (0550...), nom, wilaya..."
                  className="w-full bg-white border border-[#DFE3E8] rounded-xl pl-9 pr-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F4F6F8] text-[#637381] uppercase tracking-wider font-bold border-b border-[#DFE3E8]">
                    <th className="py-3 px-4">Numéro Normalisé</th>
                    <th className="py-3 px-4">Noms utilisés</th>
                    <th className="py-3 px-4">Wilayas</th>
                    <th className="py-3 px-4">Commandes</th>
                    <th className="py-3 px-4">Livrées / Confirmées</th>
                    <th className="py-3 px-4">Refus / Retours / Annulées</th>
                    <th className="py-3 px-4 text-right">Action Liste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {phoneHistoryStats.slice(0, 25).map((stat) => {
                    const watchEntry = fraudWatchlist.find((w) => w.phone === stat.phone);
                    return (
                      <tr key={stat.phone} className="hover:bg-[#F4F6F8]/60">
                        <td className="py-3 px-4 font-mono font-bold text-[#212B36]">
                          {stat.phone}
                          {watchEntry && (
                            <span
                              className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
                                watchEntry.status === 'blocked'
                                  ? 'bg-red-100 text-red-800'
                                  : watchEntry.status === 'watched'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {watchEntry.status === 'blocked'
                                ? 'Bloqué'
                                : watchEntry.status === 'watched'
                                ? 'Surveillé'
                                : 'Fiable'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#212B36]">
                            {Array.from(stat.names).join(', ')}
                          </span>
                          {stat.names.size > 1 && (
                            <span className="ml-1.5 text-[10px] text-amber-700 font-bold">
                              ({stat.names.size} noms différents)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-[#637381]">
                          {Array.from(stat.wilayas).join(', ')}
                        </td>
                        <td className="py-3 px-4 font-bold">
                          {stat.totalOrders} ({stat.totalAmountDzd.toLocaleString()} DZD)
                        </td>
                        <td className="py-3 px-4 text-emerald-700 font-bold">
                          {stat.deliveredCount} livrées · {stat.confirmedCount} en cours
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-bold ${
                              stat.failedOrReturnedCount + stat.cancelledCount > 0
                                ? 'text-red-600'
                                : 'text-[#637381]'
                            }`}
                          >
                            {stat.failedOrReturnedCount} échecs/retours · {stat.cancelledCount} annulées
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() =>
                              upsertWatchlistPhone({
                                phone: stat.phone,
                                status: 'watched',
                                reason: 'Mis sous surveillance depuis l\'historique client',
                                durationHours: 720,
                              })
                            }
                            className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold cursor-pointer"
                          >
                            Surveiller
                          </button>
                          <button
                            onClick={() =>
                              upsertWatchlistPhone({
                                phone: stat.phone,
                                status: 'blocked',
                                reason: 'Bloqué depuis l\'historique client (refus/abus)',
                                durationHours: 168,
                              })
                            }
                            className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold cursor-pointer"
                          >
                            Bloquer (7j)
                          </button>
                          <button
                            onClick={() =>
                              upsertWatchlistPhone({
                                phone: stat.phone,
                                status: 'trusted',
                                reason: 'Client régulier vérifié',
                                durationHours: null,
                              })
                            }
                            className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold cursor-pointer"
                          >
                            Client Fiable
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WATCHLIST / BLOCKLIST / TRUSTED NUMBERS */}
      {activeSubTab === 'watchlist' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add Phone Form */}
          <div className="lg:col-span-4 bg-white border border-[#DFE3E8] rounded-3xl p-5 space-y-4 shadow-xs h-fit">
            <h2 className="text-sm font-black text-[#212B36] flex items-center gap-2 font-['Plus_Jakarta_Sans']">
              <Plus className="w-4 h-4 text-[#FF6500]" />
              <span>Ajouter ou modifier un numéro</span>
            </h2>
            <p className="text-[11px] text-[#637381]">
              En Algérie, les opérateurs (Mobilis, Djezzy, Ooredoo) peuvent réattribuer un numéro inactif : privilégiez un blocage temporaire (7 ou 30 jours) ou une mise sous surveillance.
            </p>

            {watchlistFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold border ${
                  watchlistFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {watchlistFeedback.text}
              </div>
            )}

            <form onSubmit={handleAddWatchlist} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#212B36] mb-1">
                  Numéro de téléphone algérien :
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Ex: 0550 12 34 56 ou +213 660..."
                  required
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-[#212B36] mb-1">Statut d'action :</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 font-bold"
                >
                  <option value="watched">⚠️ Surveillé (Autoriser mais marquer « À vérifier »)</option>
                  <option value="blocked">🚫 Bloqué (Rejeter la commande côté serveur)</option>
                  <option value="trusted">✅ Client Fiable (Liste blanche)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#212B36] mb-1">
                  Durée d'application :
                </label>
                <select
                  value={newDurationHours}
                  onChange={(e) => setNewDurationHours(Number(e.target.value))}
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 font-semibold"
                >
                  <option value={24}>24 heures (1 jour)</option>
                  <option value={72}>72 heures (3 jours)</option>
                  <option value={168}>7 jours (Recommandé)</option>
                  <option value={720}>30 jours (1 mois)</option>
                  <option value={2160}>90 jours (3 mois)</option>
                  <option value={0}>Permanent (Sans expiration)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#212B36] mb-1">
                  Motif précis (visible uniquement par l'admin) :
                </label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Ex: 2 colis retournés sans réponse téléphonique"
                  required
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold rounded-xl cursor-pointer transition-colors shadow-xs"
              >
                Enregistrer dans la liste
              </button>
            </form>
          </div>

          {/* Watchlist Table */}
          <div className="lg:col-span-8 bg-white border border-[#DFE3E8] rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#DFE3E8] bg-[#F4F6F8]/50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                  Répertoire des numéros configurés ({fraudWatchlist.length})
                </h2>
                <p className="text-[11px] text-[#637381]">
                  Cette liste est strictement privée (protégée par règles Firestore & API Admin). Aucun visiteur public ne peut la consulter.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F4F6F8] text-[#637381] uppercase tracking-wider font-bold border-b border-[#DFE3E8]">
                    <th className="py-3 px-4">Numéro</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Motif</th>
                    <th className="py-3 px-4">Expiration</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {fraudWatchlist.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[#919EAB]">
                        Aucun numéro surveillé ou bloqué actuellement.
                      </td>
                    </tr>
                  ) : (
                    fraudWatchlist.map((entry) => (
                      <tr key={entry.phone} className="hover:bg-[#F4F6F8]/60">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#212B36]">
                          {entry.phone}
                        </td>
                        <td className="py-3.5 px-4">
                          {entry.status === 'blocked' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-100 text-red-800 border border-red-300 text-[10px] font-bold uppercase">
                              <Ban className="w-3 h-3" /> Bloqué
                            </span>
                          ) : entry.status === 'watched' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold uppercase">
                              <Eye className="w-3 h-3" /> Surveillé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold uppercase">
                              <UserCheck className="w-3 h-3" /> Fiable
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#212B36]">{entry.reason}</td>
                        <td className="py-3.5 px-4 text-[11px] text-[#637381]">
                          {entry.expiresAt ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(entry.expiresAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          ) : (
                            'Permanent'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => removeWatchlistPhone(entry.phone)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                            title="Retirer ce numéro de la liste"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: THRESHOLDS & COD RULES */}
      {activeSubTab === 'thresholds' && (
        <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 shadow-xs max-w-3xl">
          <h2 className="text-base font-black text-[#212B36] font-['Plus_Jakarta_Sans'] mb-1">
            Configuration des seuils Anti-Spam, Doublons & Risque COD
          </h2>
          <p className="text-xs text-[#637381] mb-5">
            Ces règles sont appliquées de manière autoritaire par le serveur avant toute création de commande. Les connexions familiales ou réseaux mobiles partagés (4G/5G NAT algérien) sont protégés contre les faux positifs.
          </p>

          {settingsSavedMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              {settingsSavedMsg}
            </div>
          )}

          <form onSubmit={handleSaveThresholds} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[#212B36] mb-1">
                  Max commandes par numéro (par heure) :
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={localSettings.maxOrdersPerPhonePerHour}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      maxOrdersPerPhonePerHour: Number(e.target.value),
                    })
                  }
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-[#212B36] mb-1">
                  Max commandes par numéro (par 24 heures) :
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={localSettings.maxOrdersPerPhonePerDay}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      maxOrdersPerPhonePerDay: Number(e.target.value),
                    })
                  }
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-[#212B36] mb-1">
                  Max commandes par session/IP (par heure) :
                </label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={localSettings.maxOrdersPerSessionPerHour}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      maxOrdersPerSessionPerHour: Number(e.target.value),
                    })
                  }
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-[#212B36] mb-1">
                  Fenêtre de détection de doublon exact (minutes) :
                </label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={localSettings.duplicateWindowMinutes}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      duplicateWindowMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-[#212B36] mb-1">
                  Seuil de montant COD élevé (DZD) :
                </label>
                <input
                  type="number"
                  min={5000}
                  step={1000}
                  value={localSettings.highAmountThreshold}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      highAmountThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-[#212B36] mb-1">
                  Seuil de quantité d'articles inhabituelle :
                </label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={localSettings.highQuantityThreshold}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      highQuantityThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 font-bold"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-[#212B36]">
                <input
                  type="checkbox"
                  checked={localSettings.enabled}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, enabled: e.target.checked })
                  }
                  className="accent-[#FF6500] w-4 h-4"
                />
                <span>Activer le moteur anti-spam, le piège invisible (Honeypot) et la détection de saisie ultra-rapide</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-[#212B36]">
                <input
                  type="checkbox"
                  checked={localSettings.autoFlagMediumRiskAsNeedsReview}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      autoFlagMediumRiskAsNeedsReview: e.target.checked,
                    })
                  }
                  className="accent-[#FF6500] w-4 h-4"
                />
                <span>Marquer automatiquement les commandes à risque moyen ou surveillées en statut « À vérifier »</span>
              </label>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-6 py-3 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold rounded-xl cursor-pointer shadow-xs"
              >
                {isSavingSettings ? 'Enregistrement...' : 'Sauvegarder les règles de protection'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: SECURITY LOGS & 12 MANDATORY SELF-TESTS */}
      {activeSubTab === 'audit_tests' && (
        <div className="space-y-6">
          {/* 12 Mandatory Tests Runner Card */}
          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-[#212B36] font-['Plus_Jakarta_Sans'] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Banc d'essai automatisé : 12 Scénarios de Sécurité COD</span>
                </h2>
                <p className="text-xs text-[#637381]">
                  Exécute en temps réel les 12 cas de test obligatoires dans un bac à sable serveur isolé (aucune fausse commande n'est ajoutée à vos commandes réelles).
                </p>
              </div>
              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="px-5 py-2.5 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-2 shrink-0 shadow-xs"
              >
                {isRunningTests ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>Relancer les 12 tests</span>
              </button>
            </div>

            {testResults && (
              <div className="space-y-3">
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                    testResults.allPassed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}
                >
                  <span>
                    Résultat global : {testResults.passed} / {testResults.total} scénarios validés avec succès
                  </span>
                  <span className="uppercase px-2.5 py-0.5 rounded-lg bg-white border">
                    {testResults.allPassed ? '✅ 100% CONFORME' : '⚠️ VÉRIFICATION REQUISE'}
                  </span>
                </div>

                <div className="overflow-x-auto border border-[#DFE3E8] rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F4F6F8] text-[#637381] uppercase font-bold border-b border-[#DFE3E8]">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Scénario testé</th>
                        <th className="py-2.5 px-3">Comportement attendu</th>
                        <th className="py-2.5 px-3">Résultat obtenu</th>
                        <th className="py-2.5 px-3 text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {testResults.results.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 px-3 font-mono font-bold">{r.id}</td>
                          <td className="py-2.5 px-3 font-bold text-[#212B36]">{r.name}</td>
                          <td className="py-2.5 px-3 text-[#637381]">{r.expected}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#212B36]">
                            {r.actual}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {r.passed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                RÉUSSI
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px]">
                                ÉCHEC
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Security Events Log */}
          <div className="bg-white border border-[#DFE3E8] rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#DFE3E8] bg-[#F4F6F8]/50">
              <h2 className="text-sm font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                Journal des événements de sécurité ({securityEvents.length})
              </h2>
              <p className="text-[11px] text-[#637381]">
                Historique horodaté des tentatives bloquées ou signalées (les empreintes réseau sont hachées pour respecter la confidentialité).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F4F6F8] text-[#637381] uppercase font-bold border-b border-[#DFE3E8]">
                    <th className="py-3 px-4">Date & Heure</th>
                    <th className="py-3 px-4">Type d'événement</th>
                    <th className="py-3 px-4">Sévérité</th>
                    <th className="py-3 px-4">Téléphone</th>
                    <th className="py-3 px-4">Détails techniques</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {securityEvents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#919EAB]">
                        Aucun événement suspect enregistré pour le moment.
                      </td>
                    </tr>
                  ) : (
                    securityEvents.slice(0, 50).map((ev) => (
                      <tr key={ev.id} className="hover:bg-[#F4F6F8]/60">
                        <td className="py-3 px-4 font-mono text-[11px] text-[#637381]">
                          {new Date(ev.timestamp).toLocaleString('fr-FR')}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#212B36]">
                          {ev.eventType}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              ev.severity === 'high'
                                ? 'bg-red-100 text-red-800'
                                : ev.severity === 'medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {ev.severity}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">{ev.phone || '—'}</td>
                        <td className="py-3 px-4 text-[#212B36]">{ev.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
