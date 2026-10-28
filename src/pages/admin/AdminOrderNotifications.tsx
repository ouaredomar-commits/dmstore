import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { NotificationRecipient, OrderNotificationLog } from '../../types';
import {
  Bell,
  Mail,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Server,
  Clock,
  ShoppingBag,
  Sparkles,
  Info,
  ToggleLeft,
  ToggleRight,
  KeyRound,
} from 'lucide-react';

export const AdminOrderNotifications: React.FC = () => {
  const {
    notificationRecipients,
    orderNotifications,
    orders,
    emailProviderStatus,
    refreshEmailProviderStatus,
    refreshOrdersFromServer,
    addNotificationRecipient,
    updateNotificationRecipient,
    deleteNotificationRecipient,
    refreshNotificationRecipientsFromServer,
    sendTestNotificationEmail,
    retryOrderNotification,
    verifySmtpConnection,
    saveSmtpAppPassword,
    deleteSmtpConfiguration,
  } = useStore();

  // Form state for adding a new recipient
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [newNotifyOnOrder, setNewNotifyOnOrder] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete confirmation state (no window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Feedback banner state
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    detail?: string;
  } | null>(null);

  // Loading states for test & retry
  const [testingTarget, setTestingTarget] = useState<string | null>(null);
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);
  const [isRefreshingConfig, setIsRefreshingConfig] = useState(false);
  const [isVerifyingSmtp, setIsVerifyingSmtp] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(true);
  const [smtpUserInput, setSmtpUserInput] = useState('ouaredomar@gmail.com');
  const [smtpFromInput, setSmtpFromInput] = useState('DZMahall <ouaredomar@gmail.com>');
  const [smtpPortInput, setSmtpPortInput] = useState<number>(465);
  const [appPasswordInput, setAppPasswordInput] = useState('');
  const [isSavingAppPassword, setIsSavingAppPassword] = useState(false);
  const [confirmDeleteSmtp, setConfirmDeleteSmtp] = useState(false);
  const [isDeletingSmtp, setIsDeletingSmtp] = useState(false);
  const [configSyncStatus, setConfigSyncStatus] = useState<'saved' | 'dirty' | 'error'>('saved');

  useEffect(() => {
    void refreshEmailProviderStatus().then((st) => {
      if (st?.configState === 'not_configured' || st?.explicitlyDeleted) {
        setSmtpUserInput('');
        setSmtpFromInput('');
        setSmtpPortInput(465);
        setAppPasswordInput('');
      } else {
        if (st?.smtpUser) setSmtpUserInput(st.smtpUser);
        if (st?.smtpFrom || st?.senderEmail) setSmtpFromInput(st.smtpFrom || st.senderEmail);
        if (st?.smtpPort) setSmtpPortInput(st.smtpPort);
      }
      setConfigSyncStatus('saved');
    });
    void refreshNotificationRecipientsFromServer();
    void refreshOrdersFromServer();
  }, []);

  const activeRecipientsCount = notificationRecipients.filter(
    (r) => r.isActive && r.notifyOnNewOrder
  ).length;

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!newEmail.trim()) {
      setFeedback({
        type: 'error',
        title: 'Veuillez saisir une adresse e-mail.',
      });
      return;
    }

    setIsAdding(true);
    try {
      const res = await addNotificationRecipient({
        email: newEmail,
        label: newLabel || 'Équipe Commandes DZMahall',
        isActive: newIsActive,
        notifyOnNewOrder: newNotifyOnOrder,
      });

      if (res.success) {
        setNewEmail('');
        setNewLabel('');
        setNewIsActive(true);
        setNewNotifyOnOrder(true);
        setConfigSyncStatus('saved');
        setFeedback({
          type: 'success',
          title: res.message,
        });
      } else {
        setConfigSyncStatus('error');
        setFeedback({
          type: 'error',
          title: res.message,
        });
      }
    } catch (err: any) {
      setConfigSyncStatus('error');
      setFeedback({
        type: 'error',
        title: err?.message || 'Erreur lors de l’ajout du destinataire.',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const startEditing = (recipient: NotificationRecipient) => {
    setEditingId(recipient.id);
    setEditEmail(recipient.email);
    setEditLabel(recipient.label || '');
    setConfirmDeleteId(null);
    setConfigSyncStatus('dirty');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditEmail('');
    setEditLabel('');
    setConfigSyncStatus('saved');
  };

  const handleSaveEdit = async (id: string) => {
    setFeedback(null);
    setIsSavingEdit(true);
    try {
      const res = await updateNotificationRecipient(id, {
        email: editEmail,
        label: editLabel,
      });
      if (res.success) {
        setEditingId(null);
        setConfigSyncStatus('saved');
        setFeedback({
          type: 'success',
          title: res.message,
        });
      } else {
        setConfigSyncStatus('error');
        setFeedback({
          type: 'error',
          title: res.message,
        });
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleActive = async (recipient: NotificationRecipient) => {
    setFeedback(null);
    const nextState = !recipient.isActive;
    const res = await updateNotificationRecipient(recipient.id, {
      isActive: nextState,
    });
    if (res.success) {
      setConfigSyncStatus('saved');
      setFeedback({
        type: 'success',
        title: `Adresse « ${recipient.email} » ${nextState ? 'activée' : 'désactivée temporairement'}.`,
      });
    } else {
      setConfigSyncStatus('error');
      setFeedback({
        type: 'error',
        title: res.message,
      });
    }
  };

  const handleToggleNotifyOnNewOrder = async (recipient: NotificationRecipient) => {
    setFeedback(null);
    const nextState = !recipient.notifyOnNewOrder;
    const res = await updateNotificationRecipient(recipient.id, {
      notifyOnNewOrder: nextState,
    });
    if (res.success) {
      setConfigSyncStatus('saved');
      setFeedback({
        type: 'success',
        title: nextState
          ? `« ${recipient.email} » recevra désormais les alertes de nouvelles commandes.`
          : `« ${recipient.email} » ne recevra plus les alertes de nouvelles commandes.`,
      });
    } else {
      setConfigSyncStatus('error');
      setFeedback({
        type: 'error',
        title: res.message,
      });
    }
  };

  const handleDelete = async (id: string) => {
    setFeedback(null);
    const res = await deleteNotificationRecipient(id);
    setConfirmDeleteId(null);
    setConfigSyncStatus(res.success ? 'saved' : 'error');
    setFeedback({
      type: res.success ? 'success' : 'error',
      title: res.message,
    });
  };

  const handleSendTest = async (targetEmail?: string) => {
    setFeedback(null);
    const key = targetEmail || 'ALL_ACTIVE';
    setTestingTarget(key);
    try {
      const res = await sendTestNotificationEmail(targetEmail);
      if (res.success) {
        setFeedback({
          type: 'success',
          title: res.message,
          detail: res.testedRecipients?.length
            ? `Destinataires testés : ${res.testedRecipients.join(', ')}`
            : undefined,
        });
      } else if (res.status === 'not_configured') {
        setShowSetupGuide(true);
        setFeedback({
          type: 'warning',
          title: res.message,
          detail: res.errorDetail,
        });
      } else {
        setFeedback({
          type: 'error',
          title: res.message,
          detail: res.errorDetail,
        });
      }
    } finally {
      setTestingTarget(null);
    }
  };

  const handleRetryOrder = async (orderId: string) => {
    setFeedback(null);
    setRetryingOrderId(orderId);
    try {
      const res = await retryOrderNotification(orderId);
      if (res.success) {
        setFeedback({
          type: 'success',
          title: res.message,
        });
      } else if (res.status === 'not_configured') {
        setShowSetupGuide(true);
        setFeedback({
          type: 'warning',
          title: res.message,
          detail: res.errorDetail,
        });
      } else {
        setFeedback({
          type: 'error',
          title: res.message,
          detail: res.errorDetail,
        });
      }
    } finally {
      setRetryingOrderId(null);
    }
  };

  const handleRefreshConfig = async () => {
    setIsRefreshingConfig(true);
    try {
      await Promise.all([
        refreshEmailProviderStatus(),
        refreshNotificationRecipientsFromServer(),
        refreshOrdersFromServer(),
      ]);
      setConfigSyncStatus('saved');
      setFeedback({
        type: 'success',
        title: 'Configurations (destinataires & SMTP) rechargées depuis le serveur.',
      });
    } finally {
      setIsRefreshingConfig(false);
    }
  };

  const handleVerifySmtp = async () => {
    setFeedback(null);
    setIsVerifyingSmtp(true);
    try {
      const res = await verifySmtpConnection();
      setFeedback({
        type: res.success ? 'success' : 'error',
        title: res.message,
        detail: res.errorDetail,
      });
    } finally {
      setIsVerifyingSmtp(false);
    }
  };

  const handleSaveAppPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const cleanedPass = appPasswordInput.replace(/\s+/g, '');
    const hasSavedValidPassword =
      Boolean(emailProviderStatus?.passDefined) &&
      Boolean(emailProviderStatus?.isValidAppPasswordFormat);

    if (!smtpUserInput.trim()) {
      setFeedback({
        type: 'error',
        title: 'Veuillez saisir l’adresse Gmail expéditrice (SMTP_USER).',
      });
      return;
    }

    if (!cleanedPass && !hasSavedValidPassword) {
      setFeedback({
        type: 'error',
        title:
          'Configuration SMTP incomplète : veuillez saisir votre mot de passe d’application Google de 16 caractères (SMTP_PASS).',
      });
      return;
    }

    setIsSavingAppPassword(true);
    try {
      const cleanUser = smtpUserInput.trim();
      const cleanFrom = smtpFromInput.trim() || `DZMahall <${cleanUser}>`;
      const res = await saveSmtpAppPassword(appPasswordInput, {
        smtpHost: 'smtp.gmail.com',
        smtpUser: cleanUser,
        smtpPort: smtpPortInput,
        smtpSecure: smtpPortInput === 465,
        smtpFrom: cleanFrom,
      });
      setSmtpFromInput(cleanFrom);
      setConfirmDeleteSmtp(false);

      if (res.success) {
        setAppPasswordInput('');
        setConfigSyncStatus('saved');
        setFeedback({
          type: res.verified === false ? 'warning' : 'success',
          title: res.message,
          detail: res.errorDetail,
        });
      } else {
        setConfigSyncStatus('error');
        setFeedback({
          type: 'error',
          title: res.message,
          detail: res.errorDetail,
        });
      }
    } finally {
      setIsSavingAppPassword(false);
    }
  };

  const handleDeleteSmtpConfig = async () => {
    setFeedback(null);
    setIsDeletingSmtp(true);
    try {
      const res = await deleteSmtpConfiguration();
      if (res.success && res.verifiedDeleted) {
        setConfirmDeleteSmtp(false);
        setAppPasswordInput('');
        setSmtpUserInput('');
        setSmtpFromInput('');
        setSmtpPortInput(465);
        setFeedback({
          type: 'warning',
          title: 'Configuration SMTP non configurée — Paramètres SMTP Gmail supprimés.',
          detail: res.message,
        });
      } else {
        setFeedback({
          type: 'error',
          title: res.message || 'Échec lors de la suppression de la configuration SMTP Gmail.',
          detail: res.errorDetail,
        });
      }
    } finally {
      setIsDeletingSmtp(false);
    }
  };

  const resolvedConfigState: 'configured' | 'incomplete' | 'not_configured' =
    emailProviderStatus?.configState ||
    (emailProviderStatus?.configured && emailProviderStatus?.isValidAppPasswordFormat
      ? 'configured'
      : emailProviderStatus?.explicitlyDeleted
      ? 'not_configured'
      : 'incomplete');

  const hasSavedValidPassword =
    Boolean(emailProviderStatus?.passDefined) &&
    Boolean(emailProviderStatus?.isValidAppPasswordFormat);

  const renderStatusBadge = (status: OrderNotificationLog['status']) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Envoyé</span>
          </span>
        );
      case 'not_configured':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>En attente configuration SMTP/API</span>
          </span>
        );
      case 'skipped_no_recipients':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Info className="w-3.5 h-3.5" />
            <span>Aucun destinataire actif</span>
          </span>
        );
      case 'duplicate_prevented':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Déjà envoyé (Anti-doublon)</span>
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3.5 h-3.5" />
            <span>Échec d'envoi</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-[#DFE3E8] p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF6500]/10 border border-[#FF6500]/20 text-[#FF6500] flex items-center justify-center shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[#212B36]">
                Notifications de commandes
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#004C3F]/10 text-[#004C3F] border border-[#004C3F]/20">
                {activeRecipientsCount} destinataire(s) actif(s)
              </span>
              {configSyncStatus === 'saved' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Enregistré</span>
                </span>
              )}
              {configSyncStatus === 'dirty' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Modifications non enregistrées</span>
                </span>
              )}
              {configSyncStatus === 'error' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Erreur de sauvegarde</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#637381] mt-1">
              Gérez les adresses e-mail qui reçoivent automatiquement une alerte dès qu'une commande est validée sur la boutique publique ou sur une Landing Page.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRefreshConfig}
            disabled={isRefreshingConfig}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#212B36] border border-[#DFE3E8] text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-[#004C3F] ${isRefreshingConfig ? 'animate-spin' : ''}`} />
            <span>Recharger depuis le serveur</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendTest()}
            disabled={testingTarget !== null || notificationRecipients.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6500] hover:bg-[#e05800] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm shadow-orange-500/20"
          >
            {testingTarget === 'ALL_ACTIVE' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Envoyer un e-mail de test</span>
          </button>
        </div>
      </div>

      {/* Server Email Configuration Status Card */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 transition-all ${
          resolvedConfigState === 'configured'
            ? 'bg-emerald-50/70 border-emerald-200'
            : resolvedConfigState === 'not_configured'
            ? 'bg-slate-100/90 border-slate-300'
            : 'bg-amber-50/80 border-amber-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                resolvedConfigState === 'configured'
                  ? 'bg-emerald-600 text-white'
                  : resolvedConfigState === 'not_configured'
                  ? 'bg-slate-600 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-black text-[#212B36]">
                  État du serveur d'envoi d'e-mails :
                </h2>
                {resolvedConfigState === 'configured' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{emailProviderStatus?.statusLabel || 'Configuration SMTP configurée'}</span>
                  </span>
                ) : resolvedConfigState === 'not_configured' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Configuration SMTP non configurée</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{emailProviderStatus?.statusLabel || 'Configuration SMTP incomplète'}</span>
                  </span>
                )}

                {hasSavedValidPassword ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#004C3F]/10 text-[#004C3F] border border-[#004C3F]/25">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Mot de passe SMTP enregistré</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>
                      {emailProviderStatus?.passwordStatusLabel || 'Mot de passe SMTP non enregistré'}
                    </span>
                  </span>
                )}
              </div>

              {resolvedConfigState === 'not_configured' ? (
                <p className="text-xs text-red-800 font-semibold mt-1">
                  La configuration SMTP Gmail a été supprimée ou n'est pas configurée. L'envoi des e-mails est désactivé jusqu'à l'enregistrement d'une nouvelle configuration.
                </p>
              ) : (
                <p className="text-xs text-[#475569] mt-1">
                  Expéditeur configuré :{' '}
                  <span className="font-mono font-bold text-[#212B36]">
                    {emailProviderStatus?.senderEmail || 'Non défini'}
                  </span>{' '}
                  • Serveur :{' '}
                  <span className="font-mono font-bold text-[#212B36]">
                    {emailProviderStatus?.smtpHost || 'smtp.gmail.com'}:
                    {emailProviderStatus?.smtpPort || 465} (
                    {emailProviderStatus?.smtpSecure === false ? 'STARTTLS' : 'SSL/TLS'})
                  </span>
                </p>
              )}

              {emailProviderStatus?.authWarning && (
                <div className="mt-2.5 p-3 rounded-xl bg-white border border-amber-300 text-xs text-amber-950 space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5 text-[#D82C0D]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Diagnostic SMTP Gmail (535-5.7.8) :</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">{emailProviderStatus.authWarning}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleVerifySmtp}
              disabled={isVerifyingSmtp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#002244] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingSmtp ? 'animate-spin' : ''}`} />
              <span>Tester la connexion SMTP</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSetupGuide((prev) => !prev)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-[#212B36] border border-[#DFE3E8] text-xs font-bold cursor-pointer transition-colors"
            >
              {showSetupGuide ? 'Masquer le panneau SMTP' : 'Gérer la configuration SMTP'}
            </button>
            <button
              type="button"
              onClick={handleRefreshConfig}
              disabled={isRefreshingConfig}
              className="p-2 rounded-xl bg-white hover:bg-slate-50 text-[#637381] hover:text-[#212B36] border border-[#DFE3E8] cursor-pointer transition-colors"
              title="Actualiser l'état de la configuration serveur"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingConfig ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {showSetupGuide && (
          <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-4 text-xs">
            {/* Dedicated Server-Side Gmail SMTP Configuration Form */}
            <form
              onSubmit={handleSaveAppPassword}
              className="bg-white rounded-xl p-4 sm:p-5 border border-[#DFE3E8] space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
                <div>
                  <h3 className="font-black text-[#212B36] text-sm flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#FF6500]" />
                    <span>Configuration Serveur SMTP Gmail</span>
                  </h3>
                  <p className="text-[11px] text-[#637381] mt-0.5">
                    Les paramètres SMTP et le mot de passe d'application Google sont chiffrés (AES-256-GCM) et stockés exclusivement côté serveur. Le mot de passe complet n'est jamais réaffiché.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F4F6F8] text-[#212B36] font-mono text-[11px] font-bold border border-[#DFE3E8]">
                    SMTP_HOST : smtp.gmail.com
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F4F6F8] text-[#212B36] font-mono text-[11px] font-bold border border-[#DFE3E8]">
                    SMTP_SECURE : {smtpPortInput === 465 ? 'true' : 'false'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#212B36] mb-1">
                    Compte Gmail expéditeur (<code className="font-mono">SMTP_USER</code>)
                  </label>
                  <input
                    type="email"
                    required
                    value={smtpUserInput}
                    onChange={(e) => {
                      setSmtpUserInput(e.target.value);
                      setConfigSyncStatus('dirty');
                    }}
                    placeholder="ex: ouaredomar@gmail.com"
                    className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] font-mono text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#212B36] mb-1">
                    Nom & Adresse affichés (<code className="font-mono">SMTP_FROM</code>)
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpFromInput}
                    onChange={(e) => {
                      setSmtpFromInput(e.target.value);
                      setConfigSyncStatus('dirty');
                    }}
                    placeholder="DZMahall <ouaredomar@gmail.com>"
                    className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] font-mono text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#212B36] mb-1">
                    Port & Sécurité (<code className="font-mono">SMTP_PORT / SMTP_SECURE</code>)
                  </label>
                  <select
                    value={smtpPortInput}
                    onChange={(e) => {
                      setSmtpPortInput(Number(e.target.value));
                      setConfigSyncStatus('dirty');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] font-mono text-xs text-[#212B36] bg-white focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
                  >
                    <option value={465}>Port 465 — SSL/TLS implicite (SMTP_SECURE=true)</option>
                    <option value={587}>Port 587 — STARTTLS (SMTP_SECURE=false)</option>
                  </select>
                </div>
              </div>

              <div className="pt-1 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-[11px] font-bold text-[#212B36]">
                      Mot de passe d'application Google de 16 caractères (<code className="font-mono">SMTP_PASS</code>)
                    </label>
                    {hasSavedValidPassword && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#004C3F]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mot de passe SMTP enregistré (laissez vide pour le conserver)</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#637381]">
                    {hasSavedValidPassword ? (
                      <>
                        Un mot de passe d'application de 16 caractères est déjà enregistré de manière sécurisée.{' '}
                        <strong className="text-[#212B36]">
                          Un champ vide lors d'une modification ne supprime pas le secret existant.
                        </strong>{' '}
                        Saisissez une nouvelle valeur uniquement si vous souhaitez remplacer le mot de passe actuel.
                      </>
                    ) : (
                      <>
                        Générez une clé de 16 lettres dans{' '}
                        <span className="font-mono font-semibold text-[#212B36]">
                          Compte Google → Sécurité → Validation en 2 étapes → Mots de passe des applications
                        </span>{' '}
                        (<span className="font-mono">myaccount.google.com/apppasswords</span>). Les espaces sont supprimés automatiquement.
                      </>
                    )}
                  </p>
                  <input
                    type="password"
                    value={appPasswordInput}
                    onChange={(e) => {
                      setAppPasswordInput(e.target.value);
                      setConfigSyncStatus('dirty');
                    }}
                    placeholder={
                      hasSavedValidPassword
                        ? '•••••••••••••••• (Mot de passe SMTP enregistré — laisser vide pour conserver)'
                        : 'ex: xxxx xxxx xxxx xxxx (16 caractères Google App Password)'
                    }
                    autoComplete="new-password"
                    className="w-full max-w-lg mt-1 px-3 py-2 rounded-xl border border-[#DFE3E8] font-mono text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="submit"
                    disabled={isSavingAppPassword}
                    className="px-4 py-2.5 rounded-xl bg-[#004C3F] hover:bg-[#00382e] disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    {isSavingAppPassword
                      ? 'Enregistrement...'
                      : hasSavedValidPassword && !appPasswordInput.trim()
                      ? 'Enregistrer les paramètres SMTP'
                      : `Enregistrer la configuration SMTP (Port ${smtpPortInput})`}
                  </button>

                  <button
                    type="button"
                    onClick={handleVerifySmtp}
                    disabled={isVerifyingSmtp}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#002244] hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingSmtp ? 'animate-spin' : ''}`} />
                    <span>Tester la connexion SMTP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmDeleteSmtp(true)}
                    disabled={isDeletingSmtp}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer la configuration SMTP Gmail</span>
                  </button>
                </div>
              </div>

              {/* Explicit Confirmation Dialog for SMTP Configuration Deletion */}
              {confirmDeleteSmtp && (
                <div className="mt-3 p-4 rounded-xl bg-red-50 border border-red-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-black text-red-900">
                        Confirmation requise : Supprimer la configuration SMTP Gmail ?
                      </p>
                      <p className="text-[11px] text-red-800 leading-relaxed">
                        Cette action supprimera définitivement tous les paramètres SMTP enregistrés (ainsi que le mot de passe d'application Google <code className="font-mono">SMTP_PASS</code>) de leur emplacement de stockage serveur et{' '}
                        <strong>interrompra l'envoi des e-mails jusqu'à une nouvelle configuration</strong>. Les commandes COD, les clients, les produits et l'historique ne seront pas affectés.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSmtp(false)}
                      disabled={isDeletingSmtp}
                      className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSmtpConfig}
                      disabled={isDeletingSmtp}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {isDeletingSmtp
                          ? 'Suppression et vérification...'
                          : 'Confirmer la suppression définitive'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </form>

            <div className="bg-white rounded-xl p-3.5 border border-[#DFE3E8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-black text-[#212B36] mb-1">
                  Persistance serveur & Variables d'environnement (Côté serveur uniquement)
                </p>
                <p className="text-[#637381] text-[11px]">
                  La configuration enregistrée ci-dessus est chiffrée dans le coffre serveur (<code className="font-mono">.aistudio/smtp-config.json</code> & état serveur persistant). Lors d'une republication depuis AI Studio, les configurations enregistrées dans l'environnement AI Studio ou dans les secrets de déploiement (<code className="font-mono">SMTP_PASS</code>) sont automatiquement conservées :
                </p>
              </div>
              <pre className="bg-[#212B36] text-emerald-300 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto shrink-0">
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=${smtpPortInput}
SMTP_SECURE=${smtpPortInput === 465 ? 'true' : 'false'}
SMTP_USER=${smtpUserInput || 'ouaredomar@gmail.com'}
SMTP_PASS=****************
SMTP_FROM="${smtpFromInput || 'DZMahall <ouaredomar@gmail.com>'}"`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Alert Banner */}
      {feedback && (
        <div
          className={`rounded-2xl border p-4 flex items-start justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedback.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedback.type === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            {feedback.type === 'warning' && (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            {feedback.type === 'error' && (
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs sm:text-sm font-bold">{feedback.title}</p>
              {feedback.detail && (
                <p className="text-xs opacity-85 mt-1 font-mono break-all">
                  {feedback.detail}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Add & Manage Recipient Email Addresses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Add Recipient Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#DFE3E8] p-5 sm:p-6 shadow-xs h-fit">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-[#004C3F]/10 text-[#004C3F] flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#212B36]">
                Ajouter une adresse destinataire
              </h2>
              <p className="text-xs text-[#637381]">
                Enregistrée durablement sur le serveur principal et synchronisée dans Firebase Firestore
              </p>
            </div>
          </div>

          <form onSubmit={handleAddRecipient} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#212B36] mb-1.5">
                Adresse e-mail <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#637381] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setConfigSyncStatus(e.target.value.trim() ? 'dirty' : 'saved');
                  }}
                  placeholder="ex: commandes@dzmahall.store"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#DFE3E8] text-xs sm:text-sm text-[#212B36] focus:outline-hidden focus:border-[#FF6500]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#212B36] mb-1.5">
                Nom ou service (optionnel)
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => {
                  setNewLabel(e.target.value);
                  if (newEmail.trim()) setConfigSyncStatus('dirty');
                }}
                placeholder="ex: Gérant / Service Confirmation COD"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFE3E8] text-xs sm:text-sm text-[#212B36] focus:outline-hidden focus:border-[#FF6500]"
              />
            </div>

            <div className="space-y-2.5 bg-[#F4F6F8] p-3.5 rounded-xl border border-[#E2E8F0]">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-bold text-[#212B36]">
                  Adresse active
                </span>
                <input
                  type="checkbox"
                  checked={newIsActive}
                  onChange={(e) => setNewIsActive(e.target.checked)}
                  className="w-4 h-4 accent-[#FF6500] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-bold text-[#212B36]">
                  Recevoir les notifications de nouvelles commandes
                </span>
                <input
                  type="checkbox"
                  checked={newNotifyOnOrder}
                  onChange={(e) => setNewNotifyOnOrder(e.target.checked)}
                  className="w-4 h-4 accent-[#004C3F] rounded cursor-pointer"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isAdding}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#004C3F] hover:bg-[#00382e] disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{isAdding ? 'Ajout en cours...' : 'Ajouter cette adresse e-mail'}</span>
            </button>
          </form>
        </div>

        {/* Recipients List */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#DFE3E8] p-5 sm:p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-black text-[#212B36]">
                Adresses e-mail destinataires ({notificationRecipients.length})
              </h2>
              <p className="text-xs text-[#637381]">
                Activez, désactivez, modifiez ou testez chaque adresse individuellement sans toucher au code.
              </p>
            </div>
          </div>

          {notificationRecipients.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-[#F4F6F8] border border-dashed border-[#CBD5E1]">
              <Mail className="w-10 h-10 text-[#637381] mx-auto mb-2.5 opacity-60" />
              <p className="text-sm font-bold text-[#212B36]">
                Aucune adresse e-mail configurée pour le moment
              </p>
              <p className="text-xs text-[#637381] max-w-md mx-auto mt-1">
                Ajoutez une ou plusieurs adresses e-mail dans le formulaire ci-contre pour recevoir automatiquement toutes les nouvelles commandes COD.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notificationRecipients.map((recipient) => {
                const isEditing = editingId === recipient.id;
                const isConfirmingDelete = confirmDeleteId === recipient.id;
                const isReceiving = recipient.isActive && recipient.notifyOnNewOrder;

                return (
                  <div
                    key={recipient.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isReceiving
                        ? 'bg-white border-[#DFE3E8] shadow-2xs'
                        : 'bg-slate-50/80 border-slate-200 opacity-85'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-[#637381] mb-1">
                              Adresse e-mail
                            </label>
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-[#DFE3E8] text-xs font-bold text-[#212B36]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-[#637381] mb-1">
                              Libellé / Service
                            </label>
                            <input
                              type="text"
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-[#DFE3E8] text-xs text-[#212B36]"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-3 py-1.5 rounded-lg border border-[#DFE3E8] text-xs font-bold text-[#637381] hover:text-[#212B36] cursor-pointer"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            disabled={isSavingEdit}
                            onClick={() => handleSaveEdit(recipient.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#004C3F] text-white text-xs font-bold cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Enregistrer</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-black text-[#212B36] break-all">
                                {recipient.email}
                              </span>
                              {isReceiving ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Actif • Reçoit les commandes
                                </span>
                              ) : !recipient.isActive ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                  Désactivé temporairement
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Alertes commandes désactivées
                                </span>
                              )}
                            </div>
                            {recipient.label && (
                              <p className="text-xs text-[#637381] mt-0.5">
                                {recipient.label}
                              </p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSendTest(recipient.email)}
                              disabled={testingTarget !== null}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#FF6500] border border-orange-200 text-[11px] font-bold transition-colors cursor-pointer"
                              title="Envoyer un e-mail de test à cette adresse"
                            >
                              {testingTarget === recipient.email ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              <span>Tester</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => startEditing(recipient)}
                              className="p-1.5 rounded-lg text-[#637381] hover:text-[#212B36] hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Modifier l'adresse"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                                <span className="text-[10px] font-bold text-red-700">
                                  Supprimer ?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(recipient.id)}
                                  className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold cursor-pointer"
                                >
                                  Oui
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-0.5 rounded bg-white text-slate-600 text-[10px] font-bold border border-slate-200 cursor-pointer"
                                >
                                  Non
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(recipient.id)}
                                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Supprimer l'adresse"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Toggles Bar */}
                        <div className="pt-2.5 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex flex-wrap items-center gap-4">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(recipient)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer text-[#212B36]"
                            >
                              {recipient.isActive ? (
                                <ToggleRight className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-slate-400" />
                              )}
                              <span>
                                {recipient.isActive ? 'Adresse active' : 'Adresse désactivée'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleNotifyOnNewOrder(recipient)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer text-[#212B36]"
                            >
                              {recipient.notifyOnNewOrder ? (
                                <ToggleRight className="w-5 h-5 text-[#FF6500]" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-slate-400" />
                              )}
                              <span>Alertes nouvelles commandes</span>
                            </button>
                          </div>

                          {recipient.lastNotifiedAt && (
                            <span className="text-[11px] text-[#637381] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                Dernière alerte :{' '}
                                {new Date(recipient.lastNotifiedAt).toLocaleString('fr-FR')}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Order Notification History & Retry Panel */}
      <div className="bg-white rounded-2xl border border-[#DFE3E8] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-black text-[#212B36]">
              Journal des notifications de commandes ({orderNotifications.length})
            </h2>
            <p className="text-xs text-[#637381]">
              Suivez l'état d'envoi de chaque commande (Boutique publique & Landing Pages) et relancez un envoi en un clic si nécessaire.
            </p>
          </div>
        </div>

        {orderNotifications.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-2xl bg-[#F4F6F8] border border-dashed border-[#CBD5E1]">
            <Bell className="w-9 h-9 text-[#637381] mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-[#212B36]">
              Aucune notification de commande enregistrée pour l'instant
            </p>
            <p className="text-xs text-[#637381] mt-1">
              Dès qu'un client valide une nouvelle commande sur la boutique publique ou sur une Landing Page, l'alerte e-mail et son statut apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] font-black uppercase text-[#637381] bg-[#F8FAFC]">
                  <th className="py-3 px-3.5">Commande & Date</th>
                  <th className="py-3 px-3.5">Client & Livraison</th>
                  <th className="py-3 px-3.5">Origine</th>
                  <th className="py-3 px-3.5">Destinataires</th>
                  <th className="py-3 px-3.5">Statut</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs">
                {orderNotifications.map((log) => {
                  const isLanding = log.sourceLabel?.toLowerCase().includes('landing');
                  const canRetry = orders.some((o) => o.id === log.orderId);

                  return (
                    <tr key={log.id} className="hover:bg-[#F8FAFC]/80">
                      <td className="py-3.5 px-3.5 align-top">
                        <div className="font-black text-[#212B36]">
                          #{log.orderNumber}
                        </div>
                        <div className="text-[11px] font-bold text-[#FF6500]">
                          {Number(log.totalAmount || 0).toLocaleString('fr-DZ')} DZD
                        </div>
                        <div className="text-[11px] text-[#637381] mt-0.5">
                          {new Date(log.updatedAt || log.createdAt).toLocaleString('fr-FR')}
                        </div>
                      </td>

                      <td className="py-3.5 px-3.5 align-top">
                        <div className="font-bold text-[#212B36]">{log.customerName}</div>
                        <div className="text-[11px] font-mono text-[#637381]">
                          {log.customerPhone}
                        </div>
                        <div className="text-[11px] text-[#637381]">
                          {log.wilayaName} — {log.commune}
                        </div>
                      </td>

                      <td className="py-3.5 px-3.5 align-top">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isLanding
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-teal-50 text-[#004C3F] border border-teal-200'
                          }`}
                        >
                          {isLanding ? (
                            <Sparkles className="w-3 h-3" />
                          ) : (
                            <ShoppingBag className="w-3 h-3" />
                          )}
                          <span>{log.sourceLabel || 'Boutique publique'}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-3.5 align-top">
                        {log.recipients && log.recipients.length > 0 ? (
                          <div className="space-y-0.5">
                            {log.recipients.map((email) => (
                              <div
                                key={email}
                                className="text-[11px] font-mono text-[#212B36] bg-slate-100 px-2 py-0.5 rounded w-fit"
                              >
                                {email}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#637381] italic">
                            Aucun destinataire actif
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3.5 align-top">
                        {renderStatusBadge(log.status)}
                        <div className="text-[11px] text-[#637381] mt-1 max-w-xs">
                          {log.message}
                        </div>
                        {log.errorDetail && (
                          <div className="text-[10px] font-mono text-red-600 mt-1 max-w-xs break-all bg-red-50/70 px-2 py-1 rounded border border-red-100">
                            {log.errorDetail}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3.5 align-top text-right">
                        {canRetry && (
                          <button
                            type="button"
                            disabled={retryingOrderId === log.orderId}
                            onClick={() => handleRetryOrder(log.orderId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-[#212B36] border border-[#DFE3E8] text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${
                                retryingOrderId === log.orderId ? 'animate-spin text-[#FF6500]' : ''
                              }`}
                            />
                            <span>Réessayer</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
