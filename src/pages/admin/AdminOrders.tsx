import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus, PhoneDuplicateAlertFlags, CancellationOrigin, DeliveryServiceType, GuepexTariffQuote, ShipmentDiagnosticProof } from '../../types';
import { normalizeAndValidateAlgerianPhone } from '../../utils/orderSecurity';
import {
  Search,
  Printer,
  Download,
  MessageCircle,
  Truck,
  X,
  ShieldAlert,
  ShieldCheck,
  PhoneCall,
  CheckCircle2,
  Ban,
  Clock,
  RefreshCw,
  Mail,
  AlertTriangle,
  History,
  Zap,
  Gift,
  Trash2,
  Archive,
} from 'lucide-react';

export const AdminOrders: React.FC = () => {
  const {
    orders,
    orderNotifications,
    landingPages,
    refreshOrdersFromServer,
    retryOrderNotification,
    updateOrderStatus,
    updateOrderCarrier,
    shipOrderViaCarrier,
    getGuepexTariffQuote,
    recordOrderContactAttempt,
    upsertWatchlistPhone,
    deleteOrder,
    orderDeletionAuditLogs,
    adminUser,
    adminRole,
    carriers,
    wilayas,
    contactPhone,
  } = useStore();

  const isStrictAdmin = (adminUser?.role || adminRole) === 'admin';

  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [retryingEmailOrderId, setRetryingEmailOrderId] = useState<string | null>(null);

  useEffect(() => {
    void refreshOrdersFromServer();
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshingOrders(true);
    try {
      await refreshOrdersFromServer();
    } finally {
      setIsRefreshingOrders(false);
    }
  };

  const handleRetryEmailFromOrder = async (orderId: string) => {
    setRetryingEmailOrderId(orderId);
    try {
      await retryOrderNotification(orderId);
      await refreshOrdersFromServer();
    } finally {
      setRetryingEmailOrderId(null);
    }
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [phoneAlertFilter, setPhoneAlertFilter] = useState<string>('all');
  const [wilayaFilter, setWilayaFilter] = useState<string>('all');
  const [carrierFilter, setCarrierFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [archiveFilter, setArchiveFilter] = useState<'active_only' | 'archived_only' | 'all'>('active_only');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleteMode, setDeleteMode] = useState<'archive' | 'permanent'>('archive');
  const [deleteReason, setDeleteReason] = useState<string>('Commande test / doublon / erreur de saisie');
  const [confirmSensitiveDelete, setConfirmSensitiveDelete] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [editTrackingOrder, setEditTrackingOrder] = useState<Order | null>(null);
  const [newCarrierId, setNewCarrierId] = useState('');
  const [newTrackingNum, setNewTrackingNum] = useState('');
  const [isDispatchingApi, setIsDispatchingApi] = useState(false);
  const [confirmLiveApiShip, setConfirmLiveApiShip] = useState(false);
  const [apiShipFeedback, setApiShipFeedback] = useState<{
    success: boolean;
    dryRun?: boolean;
    trackingNumber?: string;
    message: string;
    errorDetail?: string;
    payloadPreview?: unknown;
    shipmentDiagnostic?: ShipmentDiagnosticProof;
  } | null>(null);

  // Guepex Service Type (Express 24h vs Économique 48h) — Aucun choix "express" imposé par défaut !
  const [guepexServiceType, setGuepexServiceType] = useState<DeliveryServiceType | ''>('');
  const [guepexQuote, setGuepexQuote] = useState<GuepexTariffQuote | null>(null);
  const [isCalculatingGuepexQuote, setIsCalculatingGuepexQuote] = useState(false);
  const [allowExplicitFreeShipping, setAllowExplicitFreeShipping] = useState(false);
  const [isExplicitFreeShippingConfirmed, setIsExplicitFreeShippingConfirmed] = useState(false);
  const [freeShippingJustification, setFreeShippingJustification] = useState('');

  const isSelectedGuepex =
    newCarrierId === 'guepex' ||
    carriers.find((c) => c.id === newCarrierId)?.adapterFamily === 'guepex';

  useEffect(() => {
    if (!editTrackingOrder || !isSelectedGuepex || !guepexServiceType) {
      setGuepexQuote(null);
      return;
    }
    let isCancelled = false;
    setIsCalculatingGuepexQuote(true);
    getGuepexTariffQuote(
      editTrackingOrder.wilayaCode,
      guepexServiceType,
      editTrackingOrder.deliveryMode === 'desk'
    )
      .then((quote) => {
        if (!isCancelled) {
          setGuepexQuote(quote);
        }
      })
      .catch((err) => {
        console.warn('Error fetching Guepex quote:', err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsCalculatingGuepexQuote(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [editTrackingOrder, newCarrierId, guepexServiceType, isSelectedGuepex]);

  // Pre-shipping confirmation & anti-fraud review modal state
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [attemptChannel, setAttemptChannel] = useState<'phone_call' | 'whatsapp' | 'admin_review'>('phone_call');
  const [attemptOutcome, setAttemptOutcome] = useState<
    'confirmed' | 'no_answer' | 'wrong_number' | 'cancelled_by_customer' | 'needs_callback'
  >('confirmed');
  const [attemptNote, setAttemptNote] = useState('');
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);

  const getCancelOriginForOrder = (ord: Order): { origin: CancellationOrigin; reason: string } => {
    if (ord.status !== 'cancelled') return { origin: 'unknown', reason: '' };
    const attempts = ord.contactAttempts || ord.confirmationHistory || [];
    for (const att of attempts) {
      if (att.outcome === 'cancelled_by_customer' || att.outcome === 'refused_cancelled') {
        return {
          origin: 'customer',
          reason: att.note || 'Annulée à la demande du client lors de l’appel de confirmation',
        };
      }
      if (att.outcome === 'wrong_number') {
        return {
          origin: 'admin_or_carrier',
          reason: att.note || 'Annulée par l’opérateur (faux numéro / injoignable)',
        };
      }
    }
    const cancelHist = (ord.statusHistory || []).filter((h) => h.status === 'cancelled');
    const lastCancel = cancelHist[cancelHist.length - 1];
    const noteLower = (lastCancel?.note || ord.notes || '').toLowerCase();
    if (
      noteLower.includes('par le client') ||
      noteLower.includes('client a annul') ||
      noteLower.includes('demande du client')
    ) {
      return { origin: 'customer', reason: lastCancel?.note || 'Annulée par le client' };
    }
    return {
      origin: 'admin_or_carrier',
      reason:
        lastCancel?.note ||
        `Annulée par ${lastCancel?.updatedBy || 'l’administrateur / transporteur'}`,
    };
  };

  const areOrderItemsSame = (a: Order, b: Order): boolean => {
    if (!a.items.length || !b.items.length || a.items.length !== b.items.length) return false;
    const sigA = a.items
      .map((i) => `${i.productId}:${i.variantId || 'default'}:${i.quantity}`)
      .sort()
      .join('|');
    const sigB = b.items
      .map((i) => `${i.productId}:${i.variantId || 'default'}:${i.quantity}`)
      .sort()
      .join('|');
    return sigA === sigB;
  };

  const computeOrderPhoneFlags = (targetOrder: Order): PhoneDuplicateAlertFlags => {
    const norm =
      targetOrder.normalizedPhone ||
      normalizeAndValidateAlgerianPhone(targetOrder.customerPhone).normalized;
    if (!norm) {
      return (
        targetOrder.phoneDuplicateFlags || {
          hasPreviousOrders: false,
          previousOrdersCount: 0,
          isReturningDeliveredCustomer: false,
          hasCancelledOrders: false,
          cancelledOrdersCount: 0,
          cancelledOrderDates: [],
          cancelledByCustomerCount: 0,
          cancelledByAdminOrCarrierCount: 0,
          hasRecentActiveOrder: false,
          recentActiveOrdersCount: 0,
          hasRecentIdenticalOrder: false,
        }
      );
    }

    const otherOrders = orders.filter((o) => {
      if (o.id === targetOrder.id) return false;
      const oNorm =
        o.normalizedPhone || normalizeAndValidateAlgerianPhone(o.customerPhone).normalized;
      return oNorm === norm;
    });

    const cancelledOrders = otherOrders.filter((o) => o.status === 'cancelled');
    let byCustomer = 0;
    let byAdmin = 0;
    for (const cOrd of cancelledOrders) {
      const info = getCancelOriginForOrder(cOrd);
      if (info.origin === 'customer') byCustomer += 1;
      else byAdmin += 1;
    }

    const activeStatuses: OrderStatus[] = [
      'pending_confirmation',
      'needs_review',
      'confirmed',
      'processing',
      'ready_to_ship',
    ];
    const targetTime = new Date(targetOrder.createdAt).getTime();
    const recentActive = otherOrders.filter((o) => {
      if (!activeStatuses.includes(o.status)) return false;
      const oTime = new Date(o.createdAt).getTime();
      return !isNaN(targetTime) && !isNaN(oTime) && Math.abs(targetTime - oTime) <= 48 * 3600 * 1000;
    });

    const hasRecentIdentical = recentActive.some((o) => areOrderItemsSame(targetOrder, o));

    return {
      hasPreviousOrders: otherOrders.length > 0,
      previousOrdersCount: otherOrders.length,
      isReturningDeliveredCustomer: otherOrders.some((o) => o.status === 'delivered'),
      hasCancelledOrders: cancelledOrders.length > 0,
      cancelledOrdersCount: cancelledOrders.length,
      cancelledOrderDates: cancelledOrders.map((o) => o.createdAt),
      cancelledByCustomerCount: byCustomer,
      cancelledByAdminOrCarrierCount: byAdmin,
      hasRecentActiveOrder: recentActive.length > 0,
      recentActiveOrdersCount: recentActive.length,
      hasRecentIdenticalOrder: hasRecentIdentical,
    };
  };

  const filteredOrders = orders.filter((o) => {
    if (archiveFilter === 'active_only' && o.isArchived) return false;
    if (archiveFilter === 'archived_only' && !o.isArchived) return false;
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (riskFilter !== 'all') {
      const level = o.riskLevel || 'low';
      if (riskFilter === 'suspicious') {
        if (level === 'low' && o.status !== 'needs_review') return false;
      } else if (level !== riskFilter) {
        return false;
      }
    }
    if (phoneAlertFilter !== 'all') {
      const pFlags = computeOrderPhoneFlags(o);
      if (phoneAlertFilter === 'needs_phone_verification') {
        if (!pFlags.hasPreviousOrders && !pFlags.hasCancelledOrders && !pFlags.hasRecentActiveOrder) {
          return false;
        }
      } else if (phoneAlertFilter === 'used_before') {
        if (!pFlags.hasPreviousOrders) return false;
      } else if (phoneAlertFilter === 'previously_cancelled') {
        if (!pFlags.hasCancelledOrders) return false;
      } else if (phoneAlertFilter === 'recent_duplicate') {
        if (!pFlags.hasRecentActiveOrder) return false;
      }
    }
    if (wilayaFilter !== 'all' && o.wilayaCode !== wilayaFilter) return false;
    
    // Carrier filter
    if (carrierFilter !== 'all') {
      const orderCarrier = o.shippingCompanyId || o.carrierId;
      if (orderCarrier !== carrierFilter) return false;
    }

    // Origin filter (Store vs Landing Page)
    if (originFilter === 'store_only') {
      if (o.landingPageId || o.landingPageSlug) return false;
    } else if (originFilter === 'lp_only') {
      if (!o.landingPageId && !o.landingPageSlug) return false;
    } else if (originFilter !== 'all') {
      if (o.landingPageId !== originFilter && o.landingPageSlug !== originFilter) return false;
    }

    // Date filter
    if (dateFilter !== 'all') {
      const orderTime = new Date(o.createdAt).getTime();
      const now = Date.now();
      if (dateFilter === 'today') {
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        if (orderTime < oneDayAgo) return false;
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        if (orderTime < sevenDaysAgo) return false;
      } else if (dateFilter === '30days') {
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        if (orderTime < thirtyDaysAgo) return false;
      }
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const numMatch = o.orderNumber.toLowerCase().includes(q);
      const nameMatch = o.customerName.toLowerCase().includes(q);
      const phoneMatch = o.customerPhone.includes(q);
      const lpMatch = (o.landingPageTitle || o.landingPageSlug || '').toLowerCase().includes(q);
      const utmMatch = (o.utm_source || o.utm_campaign || '').toLowerCase().includes(q);
      const carrierMatch = (o.shippingCompanyNameSnapshot || o.carrierName || '').toLowerCase().includes(q);
      return numMatch || nameMatch || phoneMatch || lpMatch || utmMatch || carrierMatch;
    }
    return true;
  });

  const statuses: { value: OrderStatus; label: string }[] = [
    { value: 'pending_confirmation', label: 'À confirmer (Appel)' },
    { value: 'needs_review', label: 'À vérifier (Suspecte)' },
    { value: 'confirmed', label: 'Confirmée' },
    { value: 'processing', label: 'En préparation' },
    { value: 'ready_to_ship', label: 'Prête à expédier' },
    { value: 'shipped', label: 'Expédiée' },
    { value: 'in_transit', label: 'En transit' },
    { value: 'out_for_delivery', label: 'En cours de livraison' },
    { value: 'delivered', label: 'Livrée & Encaissée' },
    { value: 'delivery_failed', label: 'Échec de livraison' },
    { value: 'returned', label: 'Retournée au dépôt' },
    { value: 'cancelled', label: 'Annulée' },
  ];

  const handlePrint = (order: Order) => {
    setSelectedOrder(order);
    setIsPrintModalOpen(true);
  };

  const handleOpenTrackingModal = (order: Order) => {
    setEditTrackingOrder(order);
    const assigned = order.shippingCompanyId || order.carrierId || 'yalidine';
    setNewCarrierId(assigned);
    setNewTrackingNum(order.trackingNumber || '');
    setConfirmLiveApiShip(false);
    setApiShipFeedback(null);
    // Lire uniquement le choix réellement enregistré sur la commande (sans imposer 'express' par défaut)
    setGuepexServiceType(order.deliveryServiceType || '');
    setAllowExplicitFreeShipping(Boolean(order.isFreeShippingExplicit));
    setIsExplicitFreeShippingConfirmed(Boolean(order.isFreeShippingExplicit));
    setFreeShippingJustification(order.freeShippingJustification || '');
  };

  const handleSelectGuepexServiceType = async (chosenType: DeliveryServiceType) => {
    setGuepexServiceType(chosenType);
    setApiShipFeedback(null);
    if (!editTrackingOrder) return;
    const quote = await getGuepexTariffQuote(
      editTrackingOrder.wilayaCode,
      chosenType,
      editTrackingOrder.deliveryMode === 'desk'
    );
    setGuepexQuote(quote);
    // Enregistrer immédiatement le choix et synchroniser le tarif dans la commande avant toute transmission API
    updateOrderCarrier(
      editTrackingOrder.id,
      newCarrierId || 'guepex',
      newTrackingNum || editTrackingOrder.trackingNumber,
      `Choix du type de livraison Guepex : ${
        chosenType === 'express' ? 'Express (delivery_type: "express")' : 'Économique (delivery_type: "eco")'
      } — Tarif : ${quote.fee} DA`,
      chosenType,
      quote.fee
    );
    setEditTrackingOrder((prev) => {
      if (!prev) return null;
      const sub = Math.round(
        Number(prev.subtotal || Math.max(0, prev.totalAmount - (prev.shippingCost || 0)))
      );
      const nextTotal = prev.isFreeShippingExplicit ? sub : sub + quote.fee;
      return {
        ...prev,
        carrierId: newCarrierId || 'guepex',
        shippingCompanyId: newCarrierId || 'guepex',
        deliveryServiceType: chosenType,
        shippingCost: prev.isFreeShippingExplicit ? 0 : quote.fee,
        shippingFee: prev.isFreeShippingExplicit ? 0 : quote.fee,
        totalAmount: nextTotal,
        total: nextTotal,
      };
    });
  };

  const handleSaveTracking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTrackingOrder) return;
    if (isSelectedGuepex && !guepexServiceType) {
      setApiShipFeedback({
        success: false,
        message:
          'Choix obligatoire pour Guepex : veuillez sélectionner explicitement « Express » ou « Économique » avant d’enregistrer.',
      });
      return;
    }
    updateOrderCarrier(
      editTrackingOrder.id,
      newCarrierId,
      newTrackingNum,
      undefined,
      isSelectedGuepex && guepexServiceType ? guepexServiceType : editTrackingOrder.deliveryServiceType,
      isSelectedGuepex && guepexQuote ? guepexQuote.fee : undefined
    );
    setEditTrackingOrder(null);
  };

  const handleDispatchViaCarrierApi = async (dryRun: boolean) => {
    if (!editTrackingOrder || isDispatchingApi) return;
    if (!dryRun && !confirmLiveApiShip) return;

    if (isSelectedGuepex && (!guepexServiceType || (guepexServiceType !== 'express' && guepexServiceType !== 'economique'))) {
      setApiShipFeedback({
        success: false,
        message:
          'Choix obligatoire pour Guepex : veuillez sélectionner explicitement « Express » ou « Économique » avant l’envoi.',
      });
      return;
    }

    let resolvedGuepexFee = guepexQuote?.fee;
    if (
      isSelectedGuepex &&
      guepexServiceType &&
      (!resolvedGuepexFee || guepexQuote?.serviceType !== guepexServiceType)
    ) {
      const freshQuote = await getGuepexTariffQuote(
        editTrackingOrder.wilayaCode,
        guepexServiceType,
        editTrackingOrder.deliveryMode === 'desk'
      );
      setGuepexQuote(freshQuote);
      resolvedGuepexFee = freshQuote.fee;
    }

    const calculatedShippingFee =
      allowExplicitFreeShipping && isExplicitFreeShippingConfirmed
        ? 0
        : isSelectedGuepex && resolvedGuepexFee
        ? resolvedGuepexFee
        : editTrackingOrder.shippingFee || editTrackingOrder.shippingCost || 0;

    if (calculatedShippingFee <= 0 && (!allowExplicitFreeShipping || !isExplicitFreeShippingConfirmed)) {
      setApiShipFeedback({
        success: false,
        message:
          'Frais de livraison à 0 DA non autorisés par défaut. Aucune livraison gratuite n’est appliquée automatiquement. Veuillez sélectionner un service vérifié ou cocher expressément la confirmation de gratuité offerte.',
      });
      return;
    }

    // S'assurer que l'objet commande porte le choix réellement sélectionné et le tarif synchronisé avant l'envoi
    const orderWithSavedChoice: Order =
      isSelectedGuepex && guepexServiceType
        ? {
            ...editTrackingOrder,
            deliveryServiceType: guepexServiceType,
            shippingCost: calculatedShippingFee,
            shippingFee: calculatedShippingFee,
          }
        : editTrackingOrder;

    setIsDispatchingApi(true);
    setApiShipFeedback(null);
    try {
      const res = await shipOrderViaCarrier(orderWithSavedChoice, newCarrierId, {
        dryRun,
        confirmLiveCreation: confirmLiveApiShip,
        serviceType: isSelectedGuepex && guepexServiceType ? guepexServiceType : undefined,
        shippingFee: calculatedShippingFee,
        allowExplicitFreeShipping,
        isExplicitFreeShippingConfirmed,
        freeShippingJustification: allowExplicitFreeShipping ? freeShippingJustification : undefined,
      });
      setApiShipFeedback({
        success: res.success,
        dryRun: res.dryRun,
        trackingNumber: res.trackingNumber,
        message: res.message,
        errorDetail: res.errorDetail,
        payloadPreview: res.requestPreview?.payload,
        shipmentDiagnostic: res.shipmentDiagnostic,
      });
      if (res.success && !res.dryRun && res.trackingNumber) {
        setNewTrackingNum(res.trackingNumber);
      }
    } finally {
      setIsDispatchingApi(false);
    }
  };

  const handleSaveContactAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewOrder || isSavingAttempt) return;
    setIsSavingAttempt(true);
    try {
      await recordOrderContactAttempt(reviewOrder.id, {
        channel: attemptChannel,
        outcome: attemptOutcome,
        note: attemptNote.trim() || undefined,
      });
      setAttemptNote('');
      setReviewOrder(null);
    } finally {
      setIsSavingAttempt(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Numero_Commande',
      'Date',
      'Origine',
      'Landing_Page_Slug',
      'Client',
      'Telephone',
      'Wilaya_Code',
      'Wilaya_Nom',
      'Commune',
      'Mode_Livraison',
      'Sous_Total',
      'Frais_Livraison',
      'Total_COD_DZD',
      'Statut',
      'Transporteur',
      'Tracking_Number',
      'UTM_Source',
      'UTM_Campaign',
    ];

    const rows = orders.map((o) => [
      `"${o.orderNumber}"`,
      `"${o.createdAt.slice(0, 10)}"`,
      `"${o.landingPageSlug ? 'Landing Page' : 'Boutique Principale'}"`,
      `"${o.landingPageSlug || ''}"`,
      `"${o.customerName.replace(/"/g, '""')}"`,
      `"${o.customerPhone}"`,
      `"${o.wilayaCode}"`,
      `"${o.wilayaName}"`,
      `"${o.commune.replace(/"/g, '""')}"`,
      `"${o.deliveryMode}"`,
      o.subtotal,
      o.shippingCost,
      o.totalAmount,
      `"${o.status}"`,
      `"${o.shippingCompanyNameSnapshot || o.carrierName || ''}"`,
      `"${o.trackingNumber || ''}"`,
      `"${o.utm_source || ''}"`,
      `"${o.utm_campaign || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `commandes_dzmahall_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenDeleteModal = (order: Order) => {
    if (!isStrictAdmin) return;
    setOrderToDelete(order);
    setDeleteMode('archive');
    setDeleteReason('Commande test / doublon / erreur de saisie');
    setConfirmSensitiveDelete(false);
    setDeleteFeedback(null);
  };

  const handleConfirmDeleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToDelete || !isStrictAdmin || isDeletingOrder) return;

    const isShippedOrDelivered =
      ['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(orderToDelete.status) ||
      Boolean(orderToDelete.trackingNumber);

    if ((isShippedOrDelivered || deleteMode === 'permanent') && !confirmSensitiveDelete) {
      setDeleteFeedback({
        type: 'error',
        message:
          'Veuillez cocher la case de confirmation renforcée avant de procéder à cette opération.',
      });
      return;
    }

    setIsDeletingOrder(true);
    setDeleteFeedback(null);
    try {
      const res = await deleteOrder(orderToDelete.id, {
        mode: deleteMode,
        reason: deleteReason.trim() || 'Action administrateur',
      });
      if (res.success) {
        if (reviewOrder?.id === orderToDelete.id && deleteMode === 'permanent') {
          setReviewOrder(null);
        }
        setOrderToDelete(null);
        setDeleteFeedback({
          type: 'success',
          message: res.message,
        });
      } else {
        setDeleteFeedback({
          type: 'error',
          message: res.message,
        });
      }
    } finally {
      setIsDeletingOrder(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DFE3E8]">
        <div>
          <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider">
            Gestion des Commandes COD
          </span>
          <h1 className="text-2xl font-black text-[#212B36] mt-0.5 font-['Plus_Jakarta_Sans']">
            Commandes & Expéditions ({filteredOrders.length})
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isStrictAdmin && (
            <select
              value={archiveFilter}
              onChange={(e) => setArchiveFilter(e.target.value as any)}
              className="py-2.5 px-3 bg-white text-[#212B36] text-xs font-bold rounded-xl border border-[#DFE3E8] cursor-pointer shadow-xs"
              title="Filtrer les commandes actives ou archivées"
            >
              <option value="active_only">
                Actives uniquement ({orders.filter((o) => !o.isArchived).length})
              </option>
              <option value="archived_only">
                Archivées ({orders.filter((o) => o.isArchived).length})
              </option>
              <option value="all">Toutes ({orders.length})</option>
            </select>
          )}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshingOrders}
            className="py-2.5 px-3.5 bg-white hover:bg-slate-50 text-[#212B36] text-xs font-bold rounded-xl transition-colors border border-[#DFE3E8] flex items-center gap-2 cursor-pointer shadow-xs"
            title="Synchroniser les commandes depuis la base de données serveur"
          >
            <RefreshCw className={`w-4 h-4 text-[#004C3F] ${isRefreshingOrders ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="py-2.5 px-4 bg-white hover:bg-slate-50 text-[#212B36] text-xs font-bold rounded-xl transition-colors border border-[#DFE3E8] flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-[#FF6500]" />
            <span>Exporter en CSV</span>
          </button>
        </div>
      </div>

      {deleteFeedback && !orderToDelete && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold ${
            deleteFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {deleteFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{deleteFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#DFE3E8] rounded-3xl p-4 space-y-3 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-[#919EAB] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher (n°, client, tél, LP, UTM, transporteur)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
            />
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
            >
              <option value="all">Tous les statuts ({orders.length})</option>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} ({orders.filter((o) => o.status === s.value).length})
                </option>
              ))}
            </select>
          </div>

          {/* Wilaya Filter */}
          <div className="md:col-span-3">
            <select
              value={wilayaFilter}
              onChange={(e) => setWilayaFilter(e.target.value)}
              className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
            >
              <option value="all">Toutes les wilayas (58)</option>
              {wilayas.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="md:col-span-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500] cursor-pointer font-medium"
            >
              <option value="all">Toutes dates</option>
              <option value="today">Aujourd'hui</option>
              <option value="7days">7 derniers jours</option>
              <option value="30days">30 derniers jours</option>
            </select>
          </div>
        </div>

        {/* Row 2: Origin, Carrier, Phone Duplicate Alerts & Anti-Fraud Risk filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-[#DFE3E8]/60">
          {/* Origin filter */}
          <div className="md:col-span-3 flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#637381] shrink-0">Origine :</span>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500] cursor-pointer font-medium"
            >
              <option value="all">Toutes (Boutique + LP)</option>
              <option value="store_only">Boutique Principale</option>
              <option value="lp_only">Toutes les Landing Pages</option>
              {landingPages.map((lp) => (
                <option key={lp.id} value={lp.id}>
                  LP : {lp.title} (/lp/{lp.slug})
                </option>
              ))}
            </select>
          </div>

          {/* Carrier filter */}
          <div className="md:col-span-3 flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#637381] shrink-0">Transporteur :</span>
            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500] cursor-pointer font-medium"
            >
              <option value="all">Tous les transporteurs</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status === 'connected' ? 'Connecté API' : 'Manuel'})
                </option>
              ))}
            </select>
          </div>

          {/* Phone Duplicate & Cancelled Alert filter */}
          <div className="md:col-span-3 flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#637381] shrink-0">Alerte N° :</span>
            <select
              value={phoneAlertFilter}
              onChange={(e) => setPhoneAlertFilter(e.target.value)}
              className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500] cursor-pointer font-medium"
            >
              <option value="all">Tous les numéros</option>
              <option value="needs_phone_verification">Nécessitant vérification n°</option>
              <option value="used_before">Numéro déjà utilisé</option>
              <option value="previously_cancelled">Commande précédente annulée</option>
              <option value="recent_duplicate">Commande récente possible en double</option>
            </select>
          </div>

          {/* Risk filter */}
          <div className="md:col-span-3 flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#637381] shrink-0">Risque COD :</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500] cursor-pointer font-medium"
            >
              <option value="all">Tous les niveaux de risque</option>
              <option value="suspicious">Suspectes / À vérifier uniquement</option>
              <option value="high">Risque élevé</option>
              <option value="medium">Risque moyen</option>
              <option value="low">Risque faible</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-[#DFE3E8] rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F4F6F8] text-[#637381] uppercase tracking-wider font-bold border-b border-[#DFE3E8]">
                <th className="py-3 px-3.5">Réf & Date</th>
                <th className="py-3 px-3.5">Origine</th>
                <th className="py-3 px-3.5">Client & Contact</th>
                <th className="py-3 px-3.5">Destination</th>
                <th className="py-3 px-3.5">Articles</th>
                <th className="py-3 px-3.5">Total COD</th>
                <th className="py-3 px-3.5">Statut Logistique</th>
                <th className="py-3 px-3.5">Transporteur & Suivi</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#919EAB]">
                    Aucune commande trouvée avec les critères actuels.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
                  const intlPhone = cleanPhone.startsWith('0') ? `213${cleanPhone.slice(1)}` : cleanPhone;

                  return (
                    <tr key={order.id} className="hover:bg-[#F4F6F8]/60 transition-colors">
                      {/* Réf & Date */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-[#FF6500] block text-xs">
                            {order.orderNumber}
                          </span>
                          {order.isArchived && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[9px] font-bold uppercase">
                              Archivée
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#919EAB]">
                          {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Origine */}
                      <td className="py-3.5 px-3.5">
                        {order.landingPageSlug ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 text-[#FF6500] border border-orange-200 text-[11px] font-bold">
                              <span>🎯 LP</span>
                              <span className="truncate max-w-[110px]" title={order.landingPageTitle || order.landingPageSlug}>
                                {order.landingPageTitle || order.landingPageSlug}
                              </span>
                            </span>
                            {order.utm_source && (
                              <span className="block text-[10px] text-[#637381] font-mono" title={`Campagne: ${order.utm_campaign || 'N/A'}`}>
                                ads: {order.utm_source}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-[#002244] border border-slate-200 text-[11px] font-bold">
                            🛍️ Boutique
                          </span>
                        )}
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-3.5">
                        <span className="font-bold text-[#212B36] block">{order.customerName}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-[#637381] font-mono">
                            {order.customerPhone}
                          </span>
                          <a
                            href={`https://wa.me/${intlPhone}?text=Bonjour%20${encodeURIComponent(order.customerName)},%20c'est%20DzMahall%20concernant%20votre%20commande%20${order.orderNumber}.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#004C3F] hover:text-[#00382E] transition-colors"
                            title="Ouvrir WhatsApp client"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        {/* Indicateurs visuels Anti-Doublons & Commandes Annulées (Section 3) */}
                        {(() => {
                          const pFlags = computeOrderPhoneFlags(order);
                          if (
                            !pFlags.hasPreviousOrders &&
                            !pFlags.hasCancelledOrders &&
                            !pFlags.hasRecentActiveOrder
                          ) {
                            return null;
                          }
                          return (
                            <div className="mt-1.5 flex flex-col items-start gap-1">
                              {pFlags.hasCancelledOrders && (
                                <button
                                  type="button"
                                  onClick={() => setReviewOrder(order)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold cursor-pointer hover:bg-rose-200 text-left"
                                  title={`Attention : ${pFlags.cancelledOrdersCount} commande(s) précédente(s) associée(s) à ce numéro a/ont été annulée(s). Cliquez pour consulter les dates et l'historique.`}
                                >
                                  <Ban className="w-3 h-3 text-rose-600 shrink-0" />
                                  <span>
                                    Commande précédente annulée
                                    {pFlags.cancelledOrdersCount > 1
                                      ? ` (${pFlags.cancelledOrdersCount})`
                                      : ''}
                                  </span>
                                </button>
                              )}

                              {pFlags.hasRecentActiveOrder && (
                                <button
                                  type="button"
                                  onClick={() => setReviewOrder(order)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold cursor-pointer hover:bg-amber-200 text-left"
                                  title="Une commande récente existe déjà pour ce numéro. Cliquez pour comparer les produits, quantités et dates."
                                >
                                  <Clock className="w-3 h-3 text-[#FF6500] shrink-0" />
                                  <span>Commande récente possible en double</span>
                                </button>
                              )}

                              {pFlags.hasPreviousOrders && (
                                <button
                                  type="button"
                                  onClick={() => setReviewOrder(order)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-[#002244] border border-blue-200 text-[10px] font-semibold cursor-pointer hover:bg-blue-100 text-left"
                                  title={`Ce numéro apparaît dans ${pFlags.previousOrdersCount} autre(s) commande(s). Cliquez pour voir l'historique complet.`}
                                >
                                  <History className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span>
                                    Numéro déjà utilisé ({pFlags.previousOrdersCount})
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Destination */}
                      <td className="py-3.5 px-3.5">
                        <span className="font-bold text-[#212B36] block">
                          {order.wilayaCode} - {order.wilayaName}
                        </span>
                        <span className="text-[10px] text-[#637381]">
                          {order.commune} · {order.deliveryMode === 'home' ? 'Domicile' : 'Stop Desk'}
                        </span>
                      </td>

                      {/* Articles */}
                      <td className="py-3.5 px-3.5">
                        <span className="font-semibold text-[#212B36] block line-clamp-1">
                          {order.items.map((it) => `${it.quantity}× ${it.productName}`).join(', ')}
                        </span>
                        <span className="text-[10px] text-[#919EAB]">
                          {order.items.reduce((s, i) => s + i.quantity, 0)} unité(s)
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-3.5">
                        <span className="font-black text-[#212B36] tabular-nums text-sm block font-['Plus_Jakarta_Sans']">
                          {order.totalAmount.toLocaleString()} DZD
                        </span>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <span className="text-[10px] text-[#637381]">
                            {order.isFreeShippingExplicit
                              ? '🎁 Port Offert (Validé)'
                              : `dont ${order.shippingFee || order.shippingCost || 0} DZD livr.`}
                          </span>
                          {order.deliveryServiceType && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold w-fit ${
                                order.deliveryServiceType === 'express'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              }`}
                            >
                              <span>
                                {order.deliveryServiceType === 'express' ? '⚡ Express 24h' : '🌱 Éco 48h'}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status Dropdown & Anti-Fraud Risk */}
                      <td className="py-3.5 px-3.5 space-y-1.5">
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                          className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase border cursor-pointer focus:outline-hidden block ${
                            order.status === 'delivered'
                              ? 'bg-emerald-50 text-[#004C3F] border-emerald-300'
                              : order.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : order.status === 'needs_review'
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : order.status === 'pending_confirmation'
                              ? 'bg-orange-50 text-[#FF6500] border-orange-200'
                              : order.status === 'cancelled' || order.status === 'returned'
                              ? 'bg-red-50 text-[#D82C0D] border-red-200'
                              : 'bg-slate-100 text-[#212B36] border-slate-300'
                          }`}
                        >
                          {statuses.map((s) => (
                            <option key={s.value} value={s.value} className="bg-white text-[#212B36]">
                              {s.label}
                            </option>
                          ))}
                        </select>

                        {/* Risk Badge & Confirmation History */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {order.riskLevel === 'high' ? (
                            <button
                              type="button"
                              onClick={() => setReviewOrder(order)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold cursor-pointer hover:bg-rose-200"
                              title={(order.riskReasons || []).join(' • ') || 'Risque élevé détecté'}
                            >
                              <ShieldAlert className="w-3 h-3" />
                              <span>Risque élevé</span>
                            </button>
                          ) : order.riskLevel === 'medium' || order.status === 'needs_review' ? (
                            <button
                              type="button"
                              onClick={() => setReviewOrder(order)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold cursor-pointer hover:bg-amber-200"
                              title={(order.riskReasons || []).join(' • ') || 'Vérification recommandée'}
                            >
                              <ShieldAlert className="w-3 h-3" />
                              <span>Risque moyen</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Risque faible</span>
                            </span>
                          )}

                          {order.contactAttempts && order.contactAttempts.length > 0 && (
                            <span
                              onClick={() => setReviewOrder(order)}
                              className="text-[10px] text-[#637381] underline cursor-pointer font-mono"
                              title="Voir l'historique des appels de confirmation"
                            >
                              {order.contactAttempts.length} appel(s)
                            </span>
                          )}
                        </div>

                        {/* Statut indépendant de la notification e-mail (n'affecte jamais la commande) */}
                        {(() => {
                          const notifLog = orderNotifications.find((l) => l.orderId === order.id);
                          const notifStatus = order.notificationStatus || notifLog?.status;
                          if (!notifStatus) return null;

                          if (notifStatus === 'sent' || notifStatus === 'duplicate_prevented') {
                            return (
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                                <Mail className="w-3 h-3" />
                                <span>E-mail : Envoyé</span>
                              </div>
                            );
                          }
                          if (notifStatus === 'failed' || notifStatus === 'not_configured') {
                            return (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold"
                                  title={
                                    order.notificationError ||
                                    notifLog?.errorDetail ||
                                    notifLog?.message ||
                                    'La commande est enregistrée mais la notification e-mail a échoué.'
                                  }
                                >
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>E-mail : Échec SMTP</span>
                                </span>
                                <button
                                  type="button"
                                  disabled={retryingEmailOrderId === order.id}
                                  onClick={() => handleRetryEmailFromOrder(order.id)}
                                  className="text-[10px] font-bold text-[#FF6500] hover:underline cursor-pointer"
                                  title="Relancer uniquement l'envoi de l'e-mail de notification"
                                >
                                  {retryingEmailOrderId === order.id ? '...' : 'Relancer'}
                                </button>
                              </div>
                            );
                          }
                          if (notifStatus === 'pending') {
                            return (
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium">
                                <Clock className="w-3 h-3" />
                                <span>E-mail : En cours...</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>

                      {/* Carrier & Tracking */}
                      <td className="py-3.5 px-3.5">
                        <div>
                          <div className="flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-[#FF6500] shrink-0" />
                            <span className="text-[11px] font-bold text-[#212B36] truncate">
                              {order.shippingCompanyNameSnapshot || order.carrierName || 'Yalidine Fast Logistics'}
                            </span>
                          </div>
                          {order.deliveryServiceType && (
                            <span
                              className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                order.deliveryServiceType === 'express'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              }`}
                            >
                              {order.deliveryServiceType === 'express'
                                ? '⚡ Express (API: express)'
                                : '🌱 Économique (API: eco)'}
                            </span>
                          )}
                          {order.trackingNumber ? (
                            <div className="text-[10px] font-mono text-[#FF6500] font-bold flex items-center gap-1.5 mt-0.5">
                              <span>{order.trackingNumber}</span>
                              <button
                                onClick={() => handleOpenTrackingModal(order)}
                                className="text-[#637381] hover:text-[#002244] underline cursor-pointer text-[10px] font-sans"
                                title="Modifier transporteur ou tracking"
                              >
                                (changer)
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenTrackingModal(order)}
                              className="text-[11px] text-[#FF6500] hover:text-[#E55B00] font-bold underline cursor-pointer mt-0.5 block"
                            >
                              + Assigner tracking
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setReviewOrder(order)}
                          className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#FF6500] transition-colors cursor-pointer border border-orange-200"
                          title="Vérifier & Confirmer la commande (Appel / WhatsApp / Anti-Fraude)"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handlePrint(order)}
                          className="p-1.5 rounded-lg bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] transition-colors cursor-pointer border border-[#DFE3E8]"
                          title="Imprimer bordereau 10x15cm"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenTrackingModal(order)}
                          className="p-1.5 rounded-lg bg-[#F4F6F8] hover:bg-slate-200 text-[#FF6500] transition-colors cursor-pointer border border-[#DFE3E8]"
                          title="Modifier le suivi transporteur"
                        >
                          <Truck className="w-3.5 h-3.5" />
                        </button>
                        {isStrictAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(order)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-[#D82C0D] transition-colors cursor-pointer border border-red-200"
                            title="Supprimer ou archiver la commande (Réservé Administrateur)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Edit Carrier & Tracking Number */}
      {editTrackingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#212B36] flex items-center gap-2 font-['Plus_Jakarta_Sans']">
                <Truck className="w-4 h-4 text-[#FF6500]" />
                <span>Expédition & Transporteur — {editTrackingOrder.orderNumber}</span>
              </h3>
              <button
                onClick={() => setEditTrackingOrder(null)}
                className="text-[#919EAB] hover:text-[#212B36]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTracking} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#212B36] font-semibold mb-1">
                  Société de livraison partenaire :
                </label>
                <select
                  value={newCarrierId}
                  onChange={(e) => {
                    setNewCarrierId(e.target.value);
                    setApiShipFeedback(null);
                    setConfirmLiveApiShip(false);
                  }}
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-medium"
                >
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (
                      {c.status === 'connected'
                        ? 'Connecté API'
                        : c.status === 'pending_docs'
                        ? 'En attente doc API'
                        : 'Manuel / Non connecté'}
                      )
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#637381] mt-1">
                  ℹ️ Tout changement de transporteur est conservé avec horodatage dans le journal d'audit de la commande.
                </p>
              </div>

              {/* API Dispatch Box */}
              <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#DFE3E8] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#212B36]">
                    Création automatique du colis via API :
                  </span>
                  <span className="text-[10px] text-[#637381] font-mono">
                    {editTrackingOrder.deliveryMode === 'desk' ? '🏢 Stop Desk' : '🏠 Domicile'} •{' '}
                    {editTrackingOrder.wilayaCode} - {editTrackingOrder.wilayaName}
                  </span>
                </div>

                {/* Section Spécifique Guepex : Choix obligatoire Express vs Économique & Tarifs réels */}
                {isSelectedGuepex && (
                  <div className="p-3 rounded-2xl bg-white border border-amber-300 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-[#212B36] flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#FF6500]" />
                        <span>Type de livraison Guepex (Choix explicite requis) :</span>
                      </label>
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                        {guepexServiceType
                          ? guepexServiceType === 'express'
                            ? 'Sélectionné : Express ("express")'
                            : 'Sélectionné : Économique ("eco")'
                          : 'Sélection requise'}
                      </span>
                    </div>

                    {!guepexServiceType && (
                      <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold">
                        ⚠️ Aucun type de livraison n’est sélectionné par défaut. Veuillez choisir explicitement entre <strong>Express</strong> et <strong>Économique</strong>.
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectGuepexServiceType('express')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          guepexServiceType === 'express'
                            ? 'bg-amber-50 border-[#FF6500] ring-2 ring-[#FF6500]/20 text-[#212B36]'
                            : 'bg-[#F4F6F8] border-[#DFE3E8] text-[#637381] hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-[#212B36]">⚡ Express (24h)</span>
                          <span className="text-[9px] font-mono font-bold bg-amber-200/80 text-amber-950 px-1.5 py-0.5 rounded">
                            delivery_type: &quot;express&quot;
                          </span>
                        </div>
                        <p className="text-[10px] font-semibold text-[#FF6500] mt-1">
                          {isCalculatingGuepexQuote && guepexServiceType === 'express'
                            ? 'Calcul tarif...'
                            : guepexQuote && guepexServiceType === 'express'
                            ? `${guepexQuote.fee} DZD`
                            : 'Tarif Express 24h'}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectGuepexServiceType('economique')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          guepexServiceType === 'economique'
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-[#212B36]'
                            : 'bg-[#F4F6F8] border-[#DFE3E8] text-[#637381] hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-[#212B36]">🌱 Économique (48h)</span>
                          <span className="text-[9px] font-mono font-bold bg-emerald-200/80 text-emerald-950 px-1.5 py-0.5 rounded">
                            delivery_type: &quot;eco&quot;
                          </span>
                        </div>
                        <p className="text-[10px] font-semibold text-emerald-700 mt-1">
                          {isCalculatingGuepexQuote && guepexServiceType === 'economique'
                            ? 'Calcul tarif...'
                            : guepexQuote && guepexServiceType === 'economique'
                            ? `${guepexQuote.fee} DZD`
                            : 'Tarif Économique 48h'}
                        </p>
                      </button>
                    </div>

                    {/* Source du tarif & validation */}
                    {guepexQuote && guepexServiceType && (
                      <div className="p-2 rounded-xl bg-[#F4F6F8] border border-[#DFE3E8] text-[10px] text-[#637381] flex items-center justify-between">
                        <span>{guepexQuote.message}</span>
                        <span className="font-bold text-[#004C3F] shrink-0 ml-2">
                          ✓ {guepexQuote.source === 'guepex_api' ? 'API Guepex' : 'Grille DZMahall'}
                        </span>
                      </div>
                    )}

                    {/* RÈGLE 1 & 3 : Gestion stricte des frais et Livraison gratuite explicite */}
                    <div className="pt-2 border-t border-[#DFE3E8] space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-[#212B36]">
                          <input
                            type="checkbox"
                            checked={allowExplicitFreeShipping}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setAllowExplicitFreeShipping(checked);
                              if (!checked) {
                                setIsExplicitFreeShippingConfirmed(false);
                              }
                            }}
                            className="rounded border-[#DFE3E8] text-[#FF6500]"
                          />
                          <Gift className="w-3.5 h-3.5 text-[#FF6500]" />
                          <span>Livraison gratuite offerte par le marchand</span>
                        </label>
                        <span className="text-[9px] text-[#637381]">Désactivée par défaut</span>
                      </div>

                      {allowExplicitFreeShipping && (
                        <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 space-y-2 text-[11px]">
                          <p className="text-orange-950 font-bold">
                            ⚠️ Confirmation obligatoire de gratuité :
                          </p>
                          <label className="flex items-start gap-2 cursor-pointer text-orange-900">
                            <input
                              type="checkbox"
                              checked={isExplicitFreeShippingConfirmed}
                              onChange={(e) => setIsExplicitFreeShippingConfirmed(e.target.checked)}
                              className="mt-0.5 rounded border-orange-300 text-[#FF6500]"
                            />
                            <span>
                              Je confirme expressément prendre en charge les frais de livraison à ma charge pour cette commande (0 DA facturé au client).
                            </span>
                          </label>

                          <div>
                            <input
                              type="text"
                              value={freeShippingJustification}
                              onChange={(e) => setFreeShippingJustification(e.target.value)}
                              placeholder="Motif / Justification (ex: Geste commercial, offre promo)"
                              className="w-full bg-white border border-orange-300 rounded-lg px-2.5 py-1 text-[11px] text-[#212B36]"
                            />
                          </div>
                        </div>
                      )}

                      {/* Montants cohérents transmis à Guepex */}
                      {(() => {
                        const productSubtotal = Math.round(
                          Number(
                            editTrackingOrder.subtotal ||
                              Math.max(0, editTrackingOrder.totalAmount - (editTrackingOrder.shippingCost || 0))
                          )
                        );
                        const effectiveFee =
                          allowExplicitFreeShipping && isExplicitFreeShippingConfirmed
                            ? 0
                            : guepexQuote?.fee || editTrackingOrder.shippingFee || editTrackingOrder.shippingCost || 400;
                        const totalCodToCollect = allowExplicitFreeShipping && isExplicitFreeShippingConfirmed
                          ? productSubtotal
                          : productSubtotal + effectiveFee;

                        return (
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[10px] space-y-1 text-[#212B36]">
                            <div className="flex justify-between">
                              <span className="text-[#637381]">Sous-total produits :</span>
                              <span className="font-mono font-bold">{productSubtotal.toLocaleString()} DZD</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#637381]">
                                Frais {guepexServiceType === 'economique' ? 'Économique (48h)' : guepexServiceType === 'express' ? 'Express (24h)' : 'livraison'} :
                              </span>
                              <span className="font-mono font-bold">
                                {allowExplicitFreeShipping && isExplicitFreeShippingConfirmed ? (
                                  <span className="text-emerald-700">0 DZD (Offert)</span>
                                ) : (
                                  `${effectiveFee.toLocaleString()} DZD`
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-xs">
                              <span>Total COD à encaisser (Client) :</span>
                              <span className="font-mono text-[#FF6500]">{totalCodToCollect.toLocaleString()} DZD</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                <label className="flex items-start gap-2 text-[11px] text-[#637381] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmLiveApiShip}
                    onChange={(e) => setConfirmLiveApiShip(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Confirmer la création d'un colis réel chez ce transporteur (protection anti-doublon active).
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isDispatchingApi}
                    onClick={() => handleDispatchViaCarrierApi(true)}
                    className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-[#DFE3E8] text-[#212B36] font-bold text-[11px] cursor-pointer"
                  >
                    Aperçu JSON (Dry-Run)
                  </button>
                  <button
                    type="button"
                    disabled={
                      isDispatchingApi ||
                      !confirmLiveApiShip ||
                      (isSelectedGuepex && !guepexServiceType) ||
                      (isSelectedGuepex &&
                        allowExplicitFreeShipping &&
                        !isExplicitFreeShippingConfirmed)
                    }
                    onClick={() => handleDispatchViaCarrierApi(false)}
                    className="py-2 px-3 rounded-xl bg-[#212B36] hover:bg-slate-800 disabled:opacity-45 text-white font-bold text-[11px] cursor-pointer"
                  >
                    {isDispatchingApi ? 'Envoi API...' : 'Créer le colis via API'}
                  </button>
                </div>

                {apiShipFeedback && (
                  <div
                    className={`p-2.5 rounded-xl border text-[11px] space-y-2 ${
                      apiShipFeedback.success
                        ? 'bg-emerald-50 border-emerald-300 text-[#004C3F]'
                        : 'bg-red-50 border-red-200 text-[#D82C0D]'
                    }`}
                  >
                    <p className="font-bold">{apiShipFeedback.message}</p>
                    {apiShipFeedback.errorDetail &&
                      apiShipFeedback.errorDetail !== apiShipFeedback.message && (
                        <p className="text-[10px] font-mono opacity-90">
                          Détail API : {apiShipFeedback.errorDetail}
                        </p>
                      )}
                    {apiShipFeedback.shipmentDiagnostic && (
                      <div className="p-2.5 rounded-lg bg-white/90 border border-slate-200 text-[#212B36] space-y-1 text-[10px] font-mono">
                        <div className="font-extrabold text-[#002244] uppercase tracking-wider font-sans text-[9px]">
                          Preuve d’exécution Guepex (Étape 4)
                        </div>
                        <div>
                          • Type sélectionné :{' '}
                          <strong>{apiShipFeedback.shipmentDiagnostic.selectedServiceType || 'Aucun'}</strong>
                        </div>
                        <div>
                          • Valeur normalisée retenue :{' '}
                          <strong className="text-emerald-700">
                            {apiShipFeedback.shipmentDiagnostic.normalizedApiValue
                              ? `"${apiShipFeedback.shipmentDiagnostic.normalizedApiValue}"`
                              : 'Aucune'}
                          </strong>
                        </div>
                        <div>
                          • Champ API utilisé :{' '}
                          <strong>{apiShipFeedback.shipmentDiagnostic.apiFieldName || 'N/A'}</strong>
                        </div>
                        <div>
                          • Résultat requête :{' '}
                          <strong>{apiShipFeedback.shipmentDiagnostic.requestResult}</strong>
                        </div>
                        <div>
                          • Confirmé par Guepex :{' '}
                          <strong>
                            {apiShipFeedback.shipmentDiagnostic.confirmedServiceTypeByGuepex ||
                              apiShipFeedback.shipmentDiagnostic.confirmationNote}
                          </strong>
                        </div>
                      </div>
                    )}
                    {Boolean(apiShipFeedback.payloadPreview) && (
                      <pre className="p-2 rounded-lg bg-[#212B36] text-emerald-300 font-mono text-[10px] overflow-x-auto max-h-40">
                        {JSON.stringify(apiShipFeedback.payloadPreview, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[#212B36] font-semibold mb-1">
                  Numéro de suivi / Colis (Tracking ID) :
                </label>
                <input
                  type="text"
                  placeholder="Ex: yal_dz_98402941"
                  value={newTrackingNum}
                  onChange={(e) => setNewTrackingNum(e.target.value)}
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditTrackingOrder(null)}
                  className="px-4 py-2 bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] rounded-xl font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF6500] hover:bg-[#E55B00] text-white rounded-xl font-bold cursor-pointer shadow-xs"
                >
                  Enregistrer l'expédition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Printable 10x15cm Algerian Carrier Shipping Label */}
      {isPrintModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#212B36] flex items-center gap-2 font-['Plus_Jakarta_Sans']">
                <Printer className="w-4 h-4 text-[#FF6500]" />
                <span>Bordereau Transporteur (Format 10 × 15 cm)</span>
              </h3>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="text-[#919EAB] hover:text-[#212B36]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* The printable card */}
            <div
              id="printable-shipping-label"
              className="bg-white text-black p-4 rounded-xl border border-gray-300 text-xs font-sans space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-black pb-2">
                <div>
                  <h2 className="text-base font-black tracking-tight uppercase">DzMahall Store</h2>
                  <p className="text-[10px] text-gray-700">Expéditeur : Boutique en Ligne DzMahall</p>
                  <p className="text-[10px] font-bold">Tél expéditeur : {contactPhone}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold border border-black px-1.5 py-0.5">
                    {selectedOrder.carrierName || 'YALIDINE FAST LOGISTICS'}
                  </span>
                  <p className="text-xs font-mono font-black mt-1">
                    {selectedOrder.trackingNumber || 'YAL-AUTOGE-9410'}
                  </p>
                </div>
              </div>

              {/* Destination Wilaya in HUGE BOLD */}
              <div className="bg-gray-100 p-2.5 rounded border border-gray-300 flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-600 block">WILAYA DESTINATION</span>
                  <span className="text-xl font-black tracking-tight uppercase">
                    {selectedOrder.wilayaCode} - {selectedOrder.wilayaName}
                  </span>
                  <p className="text-[11px] font-bold text-gray-800">Commune : {selectedOrder.commune}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black uppercase bg-black text-white px-2 py-1 rounded">
                    {selectedOrder.deliveryMode === 'home' ? 'DOMICILE' : 'STOP DESK'}
                  </span>
                </div>
              </div>

              {/* Customer Info */}
              <div className="border border-gray-300 p-2.5 rounded space-y-1">
                <span className="text-[9px] uppercase font-bold text-gray-500 block">DESTINATAIRE</span>
                <p className="text-sm font-black text-black">{selectedOrder.customerName}</p>
                <p className="text-xs font-mono font-bold text-black">Tél : {selectedOrder.customerPhone}</p>
                {selectedOrder.deliveryAddress && (
                  <p className="text-[10px] text-gray-700">Adresse : {selectedOrder.deliveryAddress}</p>
                )}
              </div>

              {/* COD Amount in HUGE BOLD */}
              <div className="bg-amber-100 p-3 rounded border-2 border-amber-500 text-center space-y-0.5">
                <span className="text-[10px] uppercase font-black text-amber-900 block">
                  MONTANT TOTAL À ENCAISSER (COD)
                </span>
                <span className="text-2xl font-black text-black tabular-nums">
                  {selectedOrder.totalAmount.toLocaleString()} DZD
                </span>
                <p className="text-[9px] text-amber-800 font-semibold">
                  Paiement en espèces à la livraison · Vérification colis autorisée
                </p>
              </div>

              {/* Barcode representation */}
              <div className="text-center pt-1 border-t border-gray-200">
                <div className="font-mono text-lg font-black tracking-widest text-black">
                  ||||| | |||| ||||| |||| |||| ||
                </div>
                <span className="text-[9px] font-mono text-gray-500">
                  {selectedOrder.orderNumber}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] text-xs font-bold rounded-xl cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Lancer l'impression</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pre-Shipping Phone/WhatsApp Confirmation & Anti-Fraud Audit */}
      {reviewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 w-full max-w-xl space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-sm font-black text-[#212B36] flex items-center gap-2 font-['Plus_Jakarta_Sans']">
                  <PhoneCall className="w-4 h-4 text-[#FF6500]" />
                  <span>Confirmation avant expédition · {reviewOrder.orderNumber}</span>
                </h3>
                <p className="text-[11px] text-[#637381] mt-0.5">
                  Client : <strong>{reviewOrder.customerName}</strong> ({reviewOrder.customerPhone}) — {reviewOrder.wilayaCode} {reviewOrder.wilayaName}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-[#212B36] bg-[#F4F6F8] px-2 py-0.5 rounded border border-[#DFE3E8]">
                    Transporteur : {reviewOrder.shippingCompanyNameSnapshot || reviewOrder.carrierName || 'Yalidine Fast Logistics'}
                  </span>
                  {reviewOrder.deliveryServiceType && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        reviewOrder.deliveryServiceType === 'express'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      Type choisi :{' '}
                      {reviewOrder.deliveryServiceType === 'express'
                        ? '⚡ Express (24h — delivery_type: "express")'
                        : '🌱 Économique (48h — delivery_type: "eco")'}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setReviewOrder(null)}
                className="text-[#919EAB] hover:text-[#212B36] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Risk Reasons Banner */}
            {reviewOrder.riskReasons && reviewOrder.riskReasons.length > 0 ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5 text-xs">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#FF6500] shrink-0" />
                  <span>
                    Signaux de vigilance détectés (Risque {reviewOrder.riskLevel === 'high' ? 'élevé' : 'moyen'}) :
                  </span>
                </div>
                <ul className="list-disc pl-5 text-[11px] text-amber-800 space-y-0.5">
                  {reviewOrder.riskReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Aucun signal de fraude détecté sur cette commande (Risque faible).</span>
              </div>
            )}

            {/* Quick Phone Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-[#F4F6F8] border border-[#DFE3E8] text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-[#637381] block">Contact direct</span>
                <span className="font-mono font-bold text-[#212B36] text-sm">{reviewOrder.customerPhone}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${reviewOrder.customerPhone}`}
                  className="px-3 py-1.5 rounded-xl bg-[#002244] text-white font-bold flex items-center gap-1.5 hover:bg-slate-800"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Appeler</span>
                </a>
                <a
                  href={`https://wa.me/213${reviewOrder.customerPhone.replace(/^0/, '')}?text=${encodeURIComponent(
                    `Bonjour ${reviewOrder.customerName}, c'est la boutique DZMahall. Nous vous contactons pour confirmer votre commande ${reviewOrder.orderNumber} d'un montant de ${reviewOrder.totalAmount} DZD vers ${reviewOrder.commune} (${reviewOrder.wilayaName}). Confirmez-vous l'expédition ?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1.5 hover:bg-emerald-700"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp pré-rempli</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    upsertWatchlistPhone({
                      phone: reviewOrder.customerPhone,
                      status: 'watched',
                      reason: `Signalé depuis la commande ${reviewOrder.orderNumber}`,
                      durationHours: 720,
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 font-bold hover:bg-amber-200 cursor-pointer"
                  title="Placer ce numéro sous surveillance (30 jours)"
                >
                  Surveiller n°
                </button>
              </div>
            </div>

            {/* Historique complet des commandes liées au même numéro de téléphone (Réservé Admin) */}
            {(() => {
              const revNorm =
                reviewOrder.normalizedPhone ||
                normalizeAndValidateAlgerianPhone(reviewOrder.customerPhone).normalized;
              const pFlags = computeOrderPhoneFlags(reviewOrder);
              const samePhoneOrders = orders
                .filter((o) => {
                  const oNorm =
                    o.normalizedPhone ||
                    normalizeAndValidateAlgerianPhone(o.customerPhone).normalized;
                  return revNorm && oNorm === revNorm;
                })
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

              return (
                <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#DFE3E8] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#002244] flex items-center gap-1.5">
                      <History className="w-4 h-4 text-[#FF6500]" />
                      <span>
                        Historique du numéro normalisé ({revNorm || reviewOrder.customerPhone}) —{' '}
                        {samePhoneOrders.length} commande(s)
                      </span>
                    </span>
                    {pFlags.isReturningDeliveredCustomer && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        Client habituel (déjà livré)
                      </span>
                    )}
                  </div>

                  {/* Alertes détaillées A, B, C pour l'administrateur */}
                  {pFlags.hasCancelledOrders && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 space-y-1">
                      <p className="font-bold">
                        Attention : une commande précédente associée à ce numéro a été annulée. Vérification recommandée avant expédition.
                      </p>
                      <p className="text-[11px] text-rose-800">
                        Total annulées : <strong>{pFlags.cancelledOrdersCount} commande(s)</strong> (dont{' '}
                        <strong>{pFlags.cancelledByCustomerCount}</strong> annulée(s) par le client et{' '}
                        <strong>{pFlags.cancelledByAdminOrCarrierCount}</strong> par l’administrateur / transporteur).
                      </p>
                      {pFlags.cancelledOrderDates.length > 0 && (
                        <p className="text-[11px] text-rose-700 font-mono">
                          Date(s) d’annulation :{' '}
                          {pFlags.cancelledOrderDates
                            .map((d) =>
                              new Date(d).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            )
                            .join(' • ')}
                        </p>
                      )}
                    </div>
                  )}

                  {pFlags.hasRecentActiveOrder && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-0.5">
                      <p className="font-bold">
                        Une commande récente existe déjà pour ce numéro. Vérifiez qu'il ne s'agit pas d'un doublon avant de continuer.
                      </p>
                      <p className="text-[11px] text-amber-800">
                        {pFlags.hasRecentIdenticalOrder
                          ? 'Doublon probable : les mêmes produits et quantités figurent dans une commande récente en cours.'
                          : 'Nouvelle commande ou complément : les articles ou quantités diffèrent de la commande récente.'}
                      </p>
                    </div>
                  )}

                  {pFlags.hasPreviousOrders && !pFlags.hasCancelledOrders && !pFlags.hasRecentActiveOrder && (
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[#002244] text-[11px]">
                      <strong>Attention : ce numéro de téléphone a déjà été utilisé pour une commande. Vérifiez l'historique avant de continuer.</strong>{' '}
                      Il peut s'agir d'un client habituel et cela ne constitue pas une preuve de fraude.
                    </div>
                  )}

                  {/* Liste des commandes associées au numéro */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {samePhoneOrders.map((histOrd) => {
                      const isCurrent = histOrd.id === reviewOrder.id;
                      const isIdenticalItems =
                        !isCurrent && areOrderItemsSame(reviewOrder, histOrd);
                      const cancelOrigin =
                        histOrd.status === 'cancelled'
                          ? getCancelOriginForOrder(histOrd)
                          : null;
                      const statusLabel =
                        statuses.find((s) => s.value === histOrd.status)?.label || histOrd.status;

                      return (
                        <div
                          key={histOrd.id}
                          className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                            isCurrent
                              ? 'bg-white border-[#FF6500] ring-1 ring-[#FF6500]/30'
                              : histOrd.status === 'cancelled'
                              ? 'bg-rose-50/60 border-rose-200'
                              : 'bg-white border-[#DFE3E8]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[#FF6500]">
                                {histOrd.orderNumber}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded bg-orange-100 text-[#FF6500] font-bold text-[9px] uppercase">
                                  Commande actuelle
                                </span>
                              )}
                              {isIdenticalItems && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[9px]">
                                  Mêmes produits & quantités
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#637381] font-mono">
                              {new Date(histOrd.createdAt).toLocaleString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[#212B36]">
                            <span className="font-semibold truncate">
                              {histOrd.items
                                .map((it) => `${it.quantity}× ${it.productName}`)
                                .join(', ')}
                            </span>
                            <span className="font-black tabular-nums shrink-0">
                              {histOrd.totalAmount.toLocaleString()} DZD
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                            <span className="text-[10px] text-[#637381]">
                              Client : {histOrd.customerName} ({histOrd.wilayaCode} {histOrd.wilayaName})
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                histOrd.status === 'cancelled'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : histOrd.status === 'delivered'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-[#212B36]'
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>

                          {cancelOrigin && (
                            <div className="text-[10px] text-rose-800 bg-rose-100/70 px-2 py-1 rounded-lg font-medium">
                              <strong>
                                {cancelOrigin.origin === 'customer'
                                  ? 'Annulée par le client :'
                                  : 'Annulée par l’administrateur / transporteur :'}
                              </strong>{' '}
                              {cancelOrigin.reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Previous Contact Attempts History */}
            {reviewOrder.contactAttempts && reviewOrder.contactAttempts.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase text-[#637381] block">
                  Historique des tentatives de contact ({reviewOrder.contactAttempts.length})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {reviewOrder.contactAttempts.map((att) => (
                    <div
                      key={att.id}
                      className="p-2.5 rounded-xl bg-[#F4F6F8] border border-[#DFE3E8] flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-bold text-[#212B36] uppercase">
                          {att.channel === 'phone_call'
                            ? '📞 Appel'
                            : att.channel === 'whatsapp'
                            ? '💬 WhatsApp'
                            : '🛡️ Revue Admin'}
                        </span>
                        <span className="mx-1.5 text-[#919EAB]">•</span>
                        <span className="font-semibold text-[#FF6500]">{att.outcome}</span>
                        {att.note && <p className="text-[#637381] mt-0.5">{att.note}</p>}
                      </div>
                      <span className="text-[10px] text-[#919EAB] font-mono shrink-0">
                        {new Date(att.timestamp).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form to record a new confirmation attempt */}
            <form onSubmit={handleSaveContactAttempt} className="space-y-3 pt-2 border-t border-[#E2E8F0] text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#212B36] mb-1">Canal utilisé :</label>
                  <select
                    value={attemptChannel}
                    onChange={(e) => setAttemptChannel(e.target.value as any)}
                    className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 font-semibold"
                  >
                    <option value="phone_call">Appel téléphonique</option>
                    <option value="whatsapp">Message WhatsApp</option>
                    <option value="admin_review">Validation manuelle Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#212B36] mb-1">Résultat du contact :</label>
                  <select
                    value={attemptOutcome}
                    onChange={(e) => setAttemptOutcome(e.target.value as any)}
                    className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 font-semibold"
                  >
                    <option value="confirmed">✅ Client confirmé (Passer en Confirmée)</option>
                    <option value="no_answer">⏳ Pas de réponse / Messagerie (À rappeler)</option>
                    <option value="needs_callback">🔄 Client demande un rappel plus tard</option>
                    <option value="wrong_number">❌ Faux numéro / Injoignable (Annuler)</option>
                    <option value="cancelled_by_customer">🚫 Annulée par le client (Annuler)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#212B36] mb-1">
                  Note d'opérateur (horaire de livraison souhaité, remarque) :
                </label>
                <input
                  type="text"
                  value={attemptNote}
                  onChange={(e) => setAttemptNote(e.target.value)}
                  placeholder="Ex: Confirmé par appel à 14h20, livrer demain matin..."
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div>
                  {isStrictAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(reviewOrder)}
                      className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-[#D82C0D] border border-red-200 rounded-xl font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer la commande</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewOrder(null)}
                    className="px-4 py-2 bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] rounded-xl font-bold cursor-pointer"
                  >
                    Fermer
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAttempt}
                    className="px-4 py-2 bg-[#FF6500] hover:bg-[#E55B00] text-white rounded-xl font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Enregistrer la tentative</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin-Only Order Deletion / Archival with Safety Warnings */}
      {isStrictAdmin && orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-black text-[#D82C0D] flex items-center gap-2 font-['Plus_Jakarta_Sans']">
                <Trash2 className="w-4 h-4" />
                <span>Supprimer la commande · {orderToDelete.orderNumber}</span>
              </h3>
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={() => setOrderToDelete(null)}
                className="text-[#919EAB] hover:text-[#212B36] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Order Identity Summary */}
            <div className="p-3.5 rounded-2xl bg-[#F4F6F8] border border-[#DFE3E8] text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-[#FF6500] text-sm">
                  {orderToDelete.orderNumber}
                </span>
                <span className="font-black text-[#212B36] text-sm">
                  {orderToDelete.totalAmount.toLocaleString()} DZD
                </span>
              </div>
              <div className="flex items-center justify-between text-[#212B36]">
                <span>
                  Client : <strong>{orderToDelete.customerName}</strong> ({orderToDelete.customerPhone})
                </span>
                <span className="px-2 py-0.5 rounded bg-white border border-[#DFE3E8] font-bold text-[10px] uppercase">
                  {statuses.find((s) => s.value === orderToDelete.status)?.label || orderToDelete.status}
                </span>
              </div>
              <div className="text-[11px] text-[#637381]">
                Destination : {orderToDelete.wilayaCode} - {orderToDelete.wilayaName} ({orderToDelete.commune}) • Transporteur :{' '}
                <strong>
                  {orderToDelete.shippingCompanyNameSnapshot || orderToDelete.carrierName || 'Non assigné'}
                </strong>
                {orderToDelete.trackingNumber ? ` (Tracking : ${orderToDelete.trackingNumber})` : ''}
              </div>
            </div>

            {/* Warning when order is already shipped, delivered, or has a tracking number */}
            {(['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(orderToDelete.status) ||
              Boolean(orderToDelete.trackingNumber)) && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1.5">
                <div className="font-black flex items-center gap-1.5 text-[#D82C0D]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Attention : commande déjà transmise au transporteur ou livrée</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Cette commande possède le statut{' '}
                  <strong>
                    {statuses.find((s) => s.value === orderToDelete.status)?.label || orderToDelete.status}
                  </strong>
                  {orderToDelete.trackingNumber ? (
                    <>
                      {' '}
                      et le numéro de suivi <code className="font-mono font-bold">{orderToDelete.trackingNumber}</code>
                    </>
                  ) : null}
                  . La suppression dans DZMahall <strong>n'annule pas automatiquement</strong> l'expédition chez Guepex ou chez le transporteur externe.
                </p>
              </div>
            )}

            {/* Commercial Data Protection Notice */}
            <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 text-[#002244] text-[11px] space-y-1">
              <p className="font-bold">Protection des données commerciales :</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Les autres commandes de ce client sont intégralement conservées.</li>
                <li>Les produits du catalogue, les stocks et les configurations transporteurs ne sont pas modifiés.</li>
                <li>Un journal d'audit horodaté est enregistré côté serveur.</li>
              </ul>
            </div>

            <form onSubmit={handleConfirmDeleteOrder} className="space-y-3.5 text-xs">
              <div className="space-y-2">
                <label className="block font-bold text-[#212B36]">Mode de suppression :</label>
                <label
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                    deleteMode === 'archive'
                      ? 'bg-emerald-50/70 border-emerald-400'
                      : 'bg-white border-[#DFE3E8]'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === 'archive'}
                    onChange={() => setDeleteMode('archive')}
                    className="mt-0.5 accent-[#004C3F]"
                  />
                  <div>
                    <span className="font-bold text-[#212B36] flex items-center gap-1.5">
                      <Archive className="w-3.5 h-3.5 text-[#004C3F]" />
                      <span>Archiver la commande (Suppression logique recommandée)</span>
                    </span>
                    <span className="text-[11px] text-[#637381] block mt-0.5">
                      Retire la commande de la vue active tout en conservant sa trace pour la comptabilité et l'historique anti-fraude.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                    deleteMode === 'permanent'
                      ? 'bg-red-50/80 border-red-400'
                      : 'bg-white border-[#DFE3E8]'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === 'permanent'}
                    onChange={() => setDeleteMode('permanent')}
                    className="mt-0.5 accent-[#D82C0D]"
                  />
                  <div>
                    <span className="font-bold text-[#D82C0D] flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer définitivement de la base de données</span>
                    </span>
                    <span className="text-[11px] text-red-800 block mt-0.5">
                      Action irréversible : supprime la commande du serveur et de Firestore, et empêche toute réapparition ultérieure.
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block font-bold text-[#212B36] mb-1">
                  Motif de la suppression / de l'archivage (Journal d'audit) :
                </label>
                <input
                  type="text"
                  required
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Ex: Commande test, doublon, erreur de saisie..."
                  className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] bg-[#F4F6F8] text-[#212B36]"
                />
              </div>

              {(['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(orderToDelete.status) ||
                Boolean(orderToDelete.trackingNumber) ||
                deleteMode === 'permanent') && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmSensitiveDelete}
                    onChange={(e) => setConfirmSensitiveDelete(e.target.checked)}
                    className="mt-0.5 accent-[#D82C0D]"
                  />
                  <span className="text-[11px] font-bold leading-snug">
                    Je confirme vouloir{' '}
                    {deleteMode === 'permanent'
                      ? 'supprimer définitivement'
                      : 'archiver'}{' '}
                    la commande {orderToDelete.orderNumber} et je comprends que les colis déjà transmis au transporteur ne sont pas annulés automatiquement.
                  </span>
                </label>
              )}

              {deleteFeedback && (
                <div
                  className={`p-3 rounded-xl border text-[11px] font-bold ${
                    deleteFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  {deleteFeedback.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeletingOrder}
                  onClick={() => setOrderToDelete(null)}
                  className="px-4 py-2 bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] rounded-xl font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isDeletingOrder}
                  className={`px-4 py-2 text-white rounded-xl font-bold cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50 ${
                    deleteMode === 'permanent'
                      ? 'bg-[#D82C0D] hover:bg-red-700'
                      : 'bg-[#004C3F] hover:bg-[#00382e]'
                  }`}
                >
                  {deleteMode === 'permanent' ? (
                    <Trash2 className="w-3.5 h-3.5" />
                  ) : (
                    <Archive className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isDeletingOrder
                      ? 'Traitement serveur en cours...'
                      : deleteMode === 'permanent'
                      ? 'Confirmer la suppression définitive'
                      : 'Confirmer l’archivage'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
