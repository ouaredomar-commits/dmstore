import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { CarrierConfig, CarrierConnectionStatus, DeliveryServiceType, NotificationRecipient } from '../../types';
import {
  MapPin,
  Save,
  CheckCircle2,
  Lock,
  Key,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertTriangle,
  Mail,
  Bell,
  Truck,
  Server,
  Plus,
  Trash2,
  Send,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Info,
  Check,
  X,
  Zap,
  Globe,
  Phone,
  Store,
} from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const {
    // Wilayas & Tarifs
    wilayas,
    updateWilayaRates,
    // Boutique
    contactPhone,
    contactWhatsApp,
    storeDomain,
    brandName,
    businessCardImageUrl,
    setIsCardModalOpen,
    // Admin Credentials
    adminCredentials,
    updateAdminCredentials,
    // Email Notifications & SMTP
    notificationRecipients,
    emailProviderStatus,
    refreshEmailProviderStatus,
    refreshNotificationRecipientsFromServer,
    addNotificationRecipient,
    updateNotificationRecipient,
    deleteNotificationRecipient,
    sendTestNotificationEmail,
    verifySmtpConnection,
    saveSmtpAppPassword,
    deleteSmtpConfiguration,
    // Carriers
    carriers,
    refreshCarriersFromServer,
    updateCarrier,
    testCarrierConnection,
  } = useStore();

  // Active section tab
  const [activeSection, setActiveSection] = useState<'all' | 'notifications' | 'carriers' | 'rates' | 'store'>('all');

  // ==========================================
  // SECTION 1 & 2: NOTIFICATIONS E-MAIL & SMTP GMAIL
  // ==========================================
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [confirmDeleteRecipientId, setConfirmDeleteRecipientId] = useState<string | null>(null);

  // SMTP Gmail configuration form
  const [smtpHostInput, setSmtpHostInput] = useState('smtp.gmail.com');
  const [smtpPortInput, setSmtpPortInput] = useState<number>(465);
  const [smtpSecureInput, setSmtpSecureInput] = useState<boolean>(true);
  const [smtpUserInput, setSmtpUserInput] = useState('ouaredomar@gmail.com');
  const [smtpFromInput, setSmtpFromInput] = useState('DZMahall <ouaredomar@gmail.com>');
  const [smtpPassInput, setSmtpPassInput] = useState('');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [confirmDeleteSmtp, setConfirmDeleteSmtp] = useState(false);

  // Status & action loading states
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isDeletingSmtp, setIsDeletingSmtp] = useState(false);
  const [isSendingTestMail, setIsSendingTestMail] = useState(false);
  const [notificationFeedback, setNotificationFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    detail?: string;
  } | null>(null);

  useEffect(() => {
    if (emailProviderStatus) {
      if (emailProviderStatus.smtpHost) setSmtpHostInput(emailProviderStatus.smtpHost);
      if (emailProviderStatus.smtpPort) setSmtpPortInput(emailProviderStatus.smtpPort);
      if (emailProviderStatus.smtpSecure !== undefined) setSmtpSecureInput(emailProviderStatus.smtpSecure);
      if (emailProviderStatus.smtpUser) setSmtpUserInput(emailProviderStatus.smtpUser);
      if (emailProviderStatus.smtpFrom) setSmtpFromInput(emailProviderStatus.smtpFrom);
    }
  }, [emailProviderStatus]);

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setIsAddingRecipient(true);
    setNotificationFeedback(null);
    try {
      const res = await addNotificationRecipient({
        email: newEmail.trim(),
        label: newLabel.trim() || undefined,
        isActive: true,
        notifyOnNewOrder: true,
      });
      if (res.success) {
        setNewEmail('');
        setNewLabel('');
        setNotificationFeedback({
          type: 'success',
          title: 'Destinataire ajouté avec succès',
          detail: res.message,
        });
      } else {
        setNotificationFeedback({
          type: 'error',
          title: 'Erreur lors de l\'ajout',
          detail: res.message,
        });
      }
    } finally {
      setIsAddingRecipient(false);
    }
  };

  const handleToggleRecipient = async (r: NotificationRecipient, field: 'isActive' | 'notifyOnNewOrder') => {
    await updateNotificationRecipient(r.id, { [field]: !r[field] });
  };

  const handleDeleteRecipient = async (id: string) => {
    const res = await deleteNotificationRecipient(id);
    setConfirmDeleteRecipientId(null);
    if (res.success) {
      setNotificationFeedback({
        type: 'success',
        title: 'Destinataire supprimé',
        detail: res.message,
      });
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSmtp(true);
    setNotificationFeedback(null);
    try {
      const res = await saveSmtpAppPassword(smtpPassInput, {
        smtpHost: smtpHostInput,
        smtpPort: smtpPortInput,
        smtpSecure: smtpSecureInput,
        smtpUser: smtpUserInput,
        smtpFrom: smtpFromInput,
      });
      if (res.success) {
        setSmtpPassInput('');
        setNotificationFeedback({
          type: res.verified ? 'success' : 'warning',
          title: res.verified ? 'Configuration SMTP Gmail validée et enregistrée' : 'Paramètres enregistrés',
          detail: res.message,
        });
      } else {
        setNotificationFeedback({
          type: 'error',
          title: 'Échec de la validation SMTP',
          detail: res.message || res.errorDetail,
        });
      }
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleTestSmtpConnection = async () => {
    setIsTestingSmtp(true);
    setNotificationFeedback(null);
    try {
      const res = await verifySmtpConnection();
      if (res.success) {
        setNotificationFeedback({
          type: 'success',
          title: 'Connexion SMTP Gmail réussie',
          detail: res.message,
        });
      } else {
        setNotificationFeedback({
          type: 'error',
          title: 'Refus de connexion SMTP',
          detail: res.message || res.errorDetail,
        });
      }
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleDeleteSmtpConfig = async () => {
    setIsDeletingSmtp(true);
    setNotificationFeedback(null);
    try {
      const res = await deleteSmtpConfiguration();
      setConfirmDeleteSmtp(false);
      setSmtpPassInput('');
      if (res.success) {
        setNotificationFeedback({
          type: 'success',
          title: 'Configuration SMTP supprimée',
          detail: res.message,
        });
      } else {
        setNotificationFeedback({
          type: 'error',
          title: 'Erreur de suppression',
          detail: res.message,
        });
      }
    } finally {
      setIsDeletingSmtp(false);
    }
  };

  const handleSendTestMail = async (targetEmail?: string) => {
    setIsSendingTestMail(true);
    setNotificationFeedback(null);
    try {
      const res = await sendTestNotificationEmail(targetEmail);
      if (res.success) {
        setNotificationFeedback({
          type: 'success',
          title: 'E-mail de notification test envoyé avec succès',
          detail: res.message,
        });
      } else {
        setNotificationFeedback({
          type: 'error',
          title: 'Échec de l\'envoi de l\'e-mail test',
          detail: res.message || res.errorDetail,
        });
      }
    } finally {
      setIsSendingTestMail(false);
    }
  };

  // ==========================================
  // SECTION 3: SOCIÉTÉS DE LIVRAISON (12 CARRIERS)
  // ==========================================
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>('guepex');
  const activeCarrier = carriers.find((c) => c.id === selectedCarrierId) || carriers[0];

  const [carrierEnv, setCarrierEnv] = useState<'production' | 'test'>('production');
  const [carrierStatus, setCarrierStatus] = useState<CarrierConnectionStatus>('not_configured');
  const [carrierFields, setCarrierFields] = useState<{ [key: string]: string }>({});
  const [revealedFieldKeys, setRevealedFieldKeys] = useState<Set<string>>(new Set());
  const [guepexDefaultService, setGuepexDefaultService] = useState<DeliveryServiceType>('economique');

  const [isSavingCarrier, setIsSavingCarrier] = useState(false);
  const [isTestingCarrier, setIsTestingCarrier] = useState(false);
  const [carrierFeedback, setCarrierFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    detail?: string;
  } | null>(null);

  useEffect(() => {
    if (activeCarrier) {
      setCarrierEnv(activeCarrier.environment || 'production');
      setCarrierStatus(activeCarrier.status || 'not_configured');
      const initialFields: { [key: string]: string } = {};
      activeCarrier.fields.forEach((f) => {
        initialFields[f.key] = f.type === 'password' && f.hasSavedSecret ? '' : f.value || '';
      });
      setCarrierFields(initialFields);
      setRevealedFieldKeys(new Set());
      if (activeCarrier.id === 'guepex' && activeCarrier.defaultServiceType) {
        setGuepexDefaultService(activeCarrier.defaultServiceType);
      }
    }
  }, [activeCarrier?.id]);

  const toggleFieldVisibility = (fieldKey: string) => {
    setRevealedFieldKeys((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  const handleSaveCarrier = async () => {
    if (!activeCarrier) return;
    setIsSavingCarrier(true);
    setCarrierFeedback(null);
    try {
      const updatedFields = activeCarrier.fields.map((f) => {
        const enteredVal = carrierFields[f.key];
        const isSecretField = f.type === 'password';
        // Si mot de passe/secret et champ vide alors qu'un secret est déjà sauvegardé, préserver avec bullets
        const valueToSend = isSecretField && (!enteredVal || enteredVal.trim() === '') && f.hasSavedSecret
          ? '••••••••'
          : enteredVal ?? f.value;
        return {
          ...f,
          value: valueToSend,
        };
      });

      const ok = await updateCarrier(activeCarrier.id, {
        status: carrierStatus,
        environment: carrierEnv,
        fields: updatedFields,
      });

      if (ok) {
        setCarrierFeedback({
          type: 'success',
          title: `Configuration enregistrée pour ${activeCarrier.name}`,
          detail: 'Les identifiants sont chiffrés sur le serveur (AES-256-GCM) et resteront persistants.',
        });
      } else {
        setCarrierFeedback({
          type: 'error',
          title: 'Erreur lors de la sauvegarde du transporteur',
          detail: 'Veuillez vérifier les informations et réessayer.',
        });
      }
    } finally {
      setIsSavingCarrier(false);
    }
  };

  const handleTestCarrierConnection = async () => {
    if (!activeCarrier) return;
    setIsTestingCarrier(true);
    setCarrierFeedback(null);
    try {
      const overrideFields = activeCarrier.fields
        .filter((f) => carrierFields[f.key] && carrierFields[f.key].trim() !== '')
        .map((f) => ({ key: f.key, value: carrierFields[f.key] }));

      const res = await testCarrierConnection(activeCarrier.id, overrideFields.length > 0 ? overrideFields : undefined);
      if (res.success) {
        setCarrierFeedback({
          type: 'success',
          title: `Connexion API ${activeCarrier.name} réussie !`,
          detail: `${res.message}${res.diagnostic ? ` — ${res.diagnostic}` : ''}`,
        });
      } else {
        setCarrierFeedback({
          type: 'error',
          title: `Échec du test de connexion API ${activeCarrier.name}`,
          detail: `${res.message}${res.diagnostic ? ` — ${res.diagnostic}` : ''}`,
        });
      }
    } finally {
      setIsTestingCarrier(false);
    }
  };

  // ==========================================
  // SECTION 4: TARIFS 58 WILAYAS
  // ==========================================
  const [rates, setRates] = useState<{
    [code: string]: { home: number; desk: number; express: number; eco: number };
  }>(() => {
    const initial: {
      [code: string]: { home: number; desk: number; express: number; eco: number };
    } = {};
    wilayas.forEach((w) => {
      initial[w.code] = {
        home: w.homeDeliveryFee,
        desk: w.deskDeliveryFee,
        express: w.expressDeliveryFee || Math.max(500, w.homeDeliveryFee + 100),
        eco: w.ecoDeliveryFee || Math.max(350, Math.round(w.homeDeliveryFee * 0.85)),
      };
    });
    return initial;
  });

  const [filterWilaya, setFilterWilaya] = useState('');
  const [saveRatesSuccess, setSaveRatesSuccess] = useState(false);

  const handleRateChange = (
    code: string,
    type: 'home' | 'desk' | 'express' | 'eco',
    val: number
  ) => {
    setRates((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        [type]: val,
      },
    }));
  };

  const handleSaveAllRates = () => {
    Object.keys(rates).forEach((code) => {
      updateWilayaRates(
        code,
        rates[code].home,
        rates[code].desk,
        rates[code].express,
        rates[code].eco
      );
    });
    setSaveRatesSuccess(true);
    setTimeout(() => setSaveRatesSuccess(false), 3500);
  };

  const filteredWilayas = wilayas.filter(
    (w) =>
      w.name.toLowerCase().includes(filterWilaya.toLowerCase()) ||
      w.code.includes(filterWilaya)
  );

  // ==========================================
  // SECTION 5 & 6: SÉCURITÉ ADMIN & IDENTITÉ
  // ==========================================
  const [editUsername, setEditUsername] = useState(adminCredentials.username);
  const [editPassword, setEditPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [credMessage, setCredMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (editPassword !== confirmPassword) {
      setCredMessage({ text: 'Les deux mots de passe saisis ne correspondent pas.', type: 'error' });
      return;
    }
    const res = updateAdminCredentials(editUsername, editPassword);
    if (res.success) {
      setCredMessage({ text: res.message, type: 'success' });
      setEditPassword('');
      setConfirmPassword('');
      setTimeout(() => setCredMessage(null), 4000);
    } else {
      setCredMessage({ text: res.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header & Quick Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#DFE3E8]">
        <div>
          <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider">
            Centre de Configuration Unifié
          </span>
          <h1 className="text-2xl font-black text-[#212B36] mt-0.5 font-['Plus_Jakarta_Sans']">
            Paramètres Généraux de DzMahall
          </h1>
          <p className="text-xs text-[#637381] mt-0.5">
            Gestion centralisée et persistance sécurisée des e-mails, SMTP, transporteurs, tarifs 58 wilayas et accès admin.
          </p>
        </div>

        {/* Section Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl">
          <button
            onClick={() => setActiveSection('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeSection === 'all'
                ? 'bg-[#FF6500] text-white shadow-xs'
                : 'text-[#637381] hover:text-[#212B36]'
            }`}
          >
            Tout afficher
          </button>
          <button
            onClick={() => setActiveSection('notifications')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'notifications'
                ? 'bg-[#FF6500] text-white shadow-xs'
                : 'text-[#637381] hover:text-[#212B36]'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>E-mails & SMTP</span>
          </button>
          <button
            onClick={() => setActiveSection('carriers')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'carriers'
                ? 'bg-[#FF6500] text-white shadow-xs'
                : 'text-[#637381] hover:text-[#212B36]'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Transporteurs</span>
          </button>
          <button
            onClick={() => setActiveSection('rates')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'rates'
                ? 'bg-[#FF6500] text-white shadow-xs'
                : 'text-[#637381] hover:text-[#212B36]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Tarifs 58 Wilayas</span>
          </button>
          <button
            onClick={() => setActiveSection('store')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'store'
                ? 'bg-[#FF6500] text-white shadow-xs'
                : 'text-[#637381] hover:text-[#212B36]'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Boutique & Sécurité</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1 & 2 : NOTIFICATIONS E-MAIL & CONFIGURATION SMTP GMAIL           */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'notifications') && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0]">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#FF6500] flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                Notifications E-mail & SMTP Gmail
              </h2>
              <p className="text-xs text-[#637381]">
                Réception automatique des alertes de nouvelles commandes et configuration persistante du serveur SMTP.
              </p>
            </div>
          </div>

          {notificationFeedback && (
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 text-xs ${
                notificationFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-[#004C3F]'
                  : notificationFeedback.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {notificationFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              )}
              <div className="flex-1">
                <span className="font-bold block">{notificationFeedback.title}</span>
                {notificationFeedback.detail && (
                  <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">{notificationFeedback.detail}</p>
                )}
              </div>
              <button
                onClick={() => setNotificationFeedback(null)}
                className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1A. DESTINATAIRES DES NOTIFICATIONS */}
            <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="text-xs font-bold text-[#212B36] uppercase tracking-wider flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-[#FF6500]" />
                    <span>Adresses Destinataires des Commandes</span>
                  </h3>
                  <p className="text-[11px] text-[#637381] mt-0.5">
                    Chaque adresse active recevra un e-mail détaillé à chaque nouvelle commande validée.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSendTestMail()}
                  disabled={isSendingTestMail || notificationRecipients.length === 0}
                  className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-[#FF6500] border border-orange-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${isSendingTestMail ? 'animate-spin' : ''}`} />
                  <span>{isSendingTestMail ? 'Envoi...' : 'Tester l\'envoi'}</span>
                </button>
              </div>

              {/* Add recipient form */}
              <form onSubmit={handleAddRecipient} className="space-y-3 p-3.5 bg-[#F4F6F8] rounded-2xl border border-[#DFE3E8]">
                <span className="text-[11px] font-bold text-[#212B36] block">Ajouter une nouvelle adresse destinataire</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="contact@dzmahall.store"
                    required
                    className="w-full px-3 py-2 bg-white border border-[#DFE3E8] rounded-xl text-xs text-[#212B36] focus:border-[#FF6500] focus:outline-hidden"
                  />
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Libellé (ex: Gérant / Logistique)"
                    className="w-full px-3 py-2 bg-white border border-[#DFE3E8] rounded-xl text-xs text-[#212B36] focus:border-[#FF6500] focus:outline-hidden"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isAddingRecipient || !newEmail.trim()}
                    className="px-4 py-2 bg-[#FF6500] hover:bg-[#E55B00] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingRecipient ? 'Ajout...' : 'Ajouter le destinataire'}</span>
                  </button>
                </div>
              </form>

              {/* Recipients list */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[#637381] uppercase tracking-wider block">
                  Destinataires enregistrés ({notificationRecipients.length})
                </span>
                {notificationRecipients.length === 0 ? (
                  <p className="text-xs text-[#919EAB] p-4 text-center border border-dashed border-[#DFE3E8] rounded-2xl">
                    Aucun destinataire configuré. Ajoutez une adresse ci-dessus.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {notificationRecipients.map((r) => (
                      <div
                        key={r.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                          r.isActive ? 'bg-white border-[#DFE3E8]' : 'bg-[#F4F6F8]/60 border-dashed border-[#DFE3E8] opacity-70'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#212B36] truncate">{r.email}</span>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                r.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {r.isActive ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#637381] block mt-0.5">
                            {r.label || 'Destinataire des commandes'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Toggle Active Switch */}
                          <button
                            type="button"
                            onClick={() => handleToggleRecipient(r, 'isActive')}
                            title={r.isActive ? 'Désactiver temporairement' : 'Activer'}
                            className="text-xs text-[#637381] hover:text-[#212B36] cursor-pointer"
                          >
                            {r.isActive ? (
                              <ToggleRight className="w-5 h-5 text-[#004C3F]" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-[#919EAB]" />
                            )}
                          </button>

                          {/* Quick test mail to single address */}
                          <button
                            type="button"
                            onClick={() => handleSendTestMail(r.email)}
                            title="Envoyer un e-mail de test à cette adresse"
                            disabled={isSendingTestMail}
                            className="p-1.5 text-[#637381] hover:text-[#FF6500] hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete recipient */}
                          {confirmDeleteRecipientId === r.id ? (
                            <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg p-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteRecipient(r.id)}
                                className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Confirmer
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteRecipientId(null)}
                                className="p-0.5 text-gray-500 hover:text-gray-700 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRecipientId(r.id)}
                              title="Supprimer cette adresse"
                              className="p-1.5 text-[#637381] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 1B. CONFIGURATION SMTP GMAIL SÉCURISÉE & PERSISTANTE */}
            <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="text-xs font-bold text-[#212B36] uppercase tracking-wider flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-[#004C3F]" />
                    <span>Configuration SMTP Gmail (Persistance Sécurisée)</span>
                  </h3>
                  <p className="text-[11px] text-[#637381] mt-0.5">
                    Le mot de passe d'application est chiffré (AES-256-GCM) et conservé après republication.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      emailProviderStatus?.passDefined
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        emailProviderStatus?.passDefined ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span>
                      {emailProviderStatus?.passDefined
                        ? 'SMTP Configuré & Persistant'
                        : 'Non configuré'}
                    </span>
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveSmtp} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-[#212B36] mb-1">Serveur SMTP Hôte</label>
                    <input
                      type="text"
                      value={smtpHostInput}
                      onChange={(e) => setSmtpHostInput(e.target.value)}
                      placeholder="smtp.gmail.com"
                      required
                      className="w-full px-3 py-2 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl text-xs font-mono text-[#212B36] focus:border-[#FF6500] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#212B36] mb-1">Port & Sécurité</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={smtpPortInput}
                        onChange={(e) => setSmtpPortInput(Number(e.target.value))}
                        placeholder="465"
                        required
                        className="w-24 px-3 py-2 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl text-xs font-mono text-[#212B36] focus:border-[#FF6500] focus:outline-hidden"
                      />
                      <label className="flex items-center gap-1.5 text-[11px] text-[#637381] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={smtpSecureInput}
                          onChange={(e) => setSmtpSecureInput(e.target.checked)}
                          className="rounded text-[#004C3F]"
                        />
                        <span>SSL / TLS (Sécurisé)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#212B36] mb-1">Utilisateur SMTP (Gmail)</label>
                    <input
                      type="email"
                      value={smtpUserInput}
                      onChange={(e) => setSmtpUserInput(e.target.value)}
                      placeholder="ouaredomar@gmail.com"
                      required
                      className="w-full px-3 py-2 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl text-xs font-mono text-[#212B36] focus:border-[#FF6500] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#212B36] mb-1">Nom Expéditeur (From)</label>
                    <input
                      type="text"
                      value={smtpFromInput}
                      onChange={(e) => setSmtpFromInput(e.target.value)}
                      placeholder="DZMahall <ouaredomar@gmail.com>"
                      required
                      className="w-full px-3 py-2 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl text-xs text-[#212B36] focus:border-[#FF6500] focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Mot de passe d'application Google (16 caractères) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-[#212B36]">
                      Mot de passe d'application Google (16 caractères)
                    </label>
                    {emailProviderStatus?.passDefined && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                        ✓ Secret actuellement chiffré sur le serveur
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? 'text' : 'password'}
                      value={smtpPassInput}
                      onChange={(e) => setSmtpPassInput(e.target.value)}
                      placeholder={
                        emailProviderStatus?.passDefined
                          ? '•••••••••••••••• (Laisser vide pour conserver le mot de passe actuel)'
                          : 'abcd efgh ijkl mnop'
                      }
                      className="w-full pl-3 pr-10 py-2.5 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl text-xs font-mono text-[#212B36] focus:border-[#FF6500] focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#919EAB] hover:text-[#212B36] cursor-pointer"
                    >
                      {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#637381] mt-1 leading-relaxed">
                    Générez ce code sans espaces sur <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-[#FF6500] underline font-bold">Google Mots de passe d'application</a>. Il sera conservé de manière persistante.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSavingSmtp}
                      className="py-2.5 px-4 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold text-xs rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingSmtp ? 'Validation & Sauvegarde...' : 'Enregistrer la configuration SMTP'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTestSmtpConnection}
                      disabled={isTestingSmtp}
                      className="py-2.5 px-3.5 bg-white hover:bg-[#F4F6F8] border border-[#DFE3E8] text-[#212B36] font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingSmtp ? 'animate-spin' : ''}`} />
                      <span>{isTestingSmtp ? 'Test en cours...' : 'Tester la connexion'}</span>
                    </button>
                  </div>

                  {/* Explicit delete button */}
                  {confirmDeleteSmtp ? (
                    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl p-1.5">
                      <span className="text-[10px] text-red-700 font-bold px-1">Supprimer définitivement ?</span>
                      <button
                        type="button"
                        onClick={handleDeleteSmtpConfig}
                        disabled={isDeletingSmtp}
                        className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        {isDeletingSmtp ? 'Suppression...' : 'Oui, supprimer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSmtp(false)}
                        className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSmtp(true)}
                      className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer la configuration SMTP</span>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3 : SOCIÉTÉS DE LIVRAISON (12 TRANSPORTEURS ALGÉRIE)              */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'carriers') && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0]">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#FF6500] flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                Sociétés de Livraison & Intégrations API (12 Transporteurs Algérie)
              </h2>
              <p className="text-xs text-[#637381]">
                Configuration sécurisée, conservation des clés d'API (AES-256), mode Express/Économique pour Guepex et tests réels.
              </p>
            </div>
          </div>

          {carrierFeedback && (
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 text-xs ${
                carrierFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-[#004C3F]'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {carrierFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              )}
              <div className="flex-1">
                <span className="font-bold block">{carrierFeedback.title}</span>
                {carrierFeedback.detail && (
                  <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">{carrierFeedback.detail}</p>
                )}
              </div>
              <button onClick={() => setCarrierFeedback(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Carrier Selector Grid */}
          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-5 shadow-xs">
            <span className="text-[11px] font-bold text-[#637381] uppercase tracking-wider block mb-3">
              Sélectionnez un transporteur à configurer
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {carriers.map((c) => {
                const isSelected = c.id === selectedCarrierId;
                const isConnected = c.status === 'connected';
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCarrierId(c.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#FF6500] bg-orange-50/50 shadow-xs ring-2 ring-[#FF6500]/20'
                        : 'border-[#DFE3E8] bg-white hover:bg-[#F4F6F8]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-black text-[#212B36] truncate">{c.name}</span>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isConnected ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-gray-300'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-[#637381] block truncate">{c.wilayaCoverage || '58 Wilayas'}</span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-[#DFE3E8]/60 flex items-center justify-between text-[9px] font-bold">
                      <span className={isConnected ? 'text-emerald-700' : 'text-gray-400'}>
                        {isConnected ? 'Connecté' : 'Inactif'}
                      </span>
                      <span className="text-[#919EAB] uppercase font-mono">{c.environment}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Carrier Configuration Panel */}
          {activeCarrier && (
            <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                      Configuration : {activeCarrier.name}
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-[#F4F6F8] border border-[#DFE3E8] text-[#637381]">
                      {activeCarrier.adapterFamily}
                    </span>
                  </div>
                  <p className="text-xs text-[#637381] mt-0.5 leading-relaxed">{activeCarrier.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Environment Switch */}
                  <div className="flex items-center gap-1.5 p-1 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setCarrierEnv('test')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        carrierEnv === 'test' ? 'bg-white text-[#212B36] shadow-2xs' : 'text-[#637381]'
                      }`}
                    >
                      Test / Bac à sable
                    </button>
                    <button
                      type="button"
                      onClick={() => setCarrierEnv('production')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        carrierEnv === 'production' ? 'bg-[#004C3F] text-white shadow-2xs' : 'text-[#637381]'
                      }`}
                    >
                      Production Réelle
                    </button>
                  </div>

                  {/* Status Toggle */}
                  <button
                    type="button"
                    onClick={() => setCarrierStatus(carrierStatus === 'connected' ? 'disabled' : 'connected')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                      carrierStatus === 'connected'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-gray-100 text-gray-600 border-gray-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${carrierStatus === 'connected' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    <span>{carrierStatus === 'connected' ? 'Transporteur Connecté' : 'Transporteur Désactivé'}</span>
                  </button>
                </div>
              </div>

              {/* Guepex Exclusive Feature: Default Service Type Choice */}
              {activeCarrier.id === 'guepex' && (
                <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#212B36] flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#FF6500]" />
                      <span>Type de livraison par défaut pour Guepex</span>
                    </span>
                    <span className="text-[10px] text-[#FF6500] font-bold uppercase font-mono">
                      Endpoint: api.guepex.com
                    </span>
                  </div>
                  <p className="text-[11px] text-[#637381] leading-relaxed">
                    Choisissez le mode de livraison par défaut appliqué aux expéditions Guepex. Ce choix est respecté et transmis au serveur via <code className="bg-white px-1 py-0.5 rounded border border-orange-200 text-[#FF6500]">delivery_type: "eco" | "express"</code>.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setGuepexDefaultService('economique')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        guepexDefaultService === 'economique'
                          ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-white/60 border-[#DFE3E8] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#004C3F]">Économique 48h (eco)</span>
                        {guepexDefaultService === 'economique' && <Check className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <span className="text-[10px] text-[#637381] mt-0.5 block">
                        Tarif avantageux, délai moyen 48h sur les 58 wilayas.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGuepexDefaultService('express')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        guepexDefaultService === 'express'
                          ? 'bg-white border-[#FF6500] ring-2 ring-orange-500/20 shadow-xs'
                          : 'bg-white/60 border-[#DFE3E8] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#FF6500]">Express 24h (express)</span>
                        {guepexDefaultService === 'express' && <Check className="w-4 h-4 text-[#FF6500]" />}
                      </div>
                      <span className="text-[10px] text-[#637381] mt-0.5 block">
                        Priorité maximale, livraison rapide en 24h ouvrées.
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* API Credentials Input Form */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-[#212B36] uppercase tracking-wider block">
                  Identifiants API & Paramètres ({activeCarrier.name})
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeCarrier.fields.map((f) => {
                    const isRevealed = revealedFieldKeys.has(f.key);
                    const enteredVal = carrierFields[f.key] ?? '';
                    const isSecret = f.type === 'password';
                    const isConfiguredOnServer = f.hasSavedSecret;

                    return (
                      <div key={f.key} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#212B36] flex items-center gap-1.5">
                            {isSecret && <Key className="w-3.5 h-3.5 text-[#FF6500]" />}
                            <span>{f.label}</span>
                            {f.required && <span className="text-red-500">*</span>}
                          </label>

                          {isSecret && isConfiguredOnServer && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              ✓ Secret chiffré sur le serveur
                            </span>
                          )}
                        </div>

                        <div className="relative">
                          <input
                            type={isSecret && !isRevealed ? 'password' : 'text'}
                            value={enteredVal}
                            onChange={(e) =>
                              setCarrierFields((prev) => ({
                                ...prev,
                                [f.key]: e.target.value,
                              }))
                            }
                            placeholder={
                              isSecret && isConfiguredOnServer
                                ? '•••••••••••••••• (Laisser vide pour préserver)'
                                : f.placeholder || f.label
                            }
                            className="w-full px-3 py-2.5 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl text-xs font-mono text-[#212B36] focus:border-[#FF6500] focus:outline-hidden"
                          />

                          {isSecret && (
                            <button
                              type="button"
                              onClick={() => toggleFieldVisibility(f.key)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#919EAB] hover:text-[#212B36] cursor-pointer"
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {f.helperText && (
                          <span className="text-[10px] text-[#637381] block leading-tight">{f.helperText}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Carrier Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveCarrier}
                    disabled={isSavingCarrier}
                    className="py-2.5 px-5 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold text-xs rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingCarrier ? 'Sauvegarde...' : `Enregistrer ${activeCarrier.name}`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestCarrierConnection}
                    disabled={isTestingCarrier}
                    className="py-2.5 px-4 bg-white hover:bg-[#F4F6F8] border border-[#DFE3E8] text-[#212B36] font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingCarrier ? 'animate-spin' : ''}`} />
                    <span>{isTestingCarrier ? 'Test de l\'API...' : 'Tester la connexion API en direct'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-[#637381] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#004C3F]" />
                  <span>Chiffrement AES-256-GCM actif. Les clés sont préservées lors des rechargements.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4 : GRILLE TARIFAIRE DES 58 WILAYAS                                */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'rates') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0]">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#FF6500] flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                Tarifs de Livraison (58 Wilayas d'Algérie)
              </h2>
              <p className="text-xs text-[#637381]">
                Ajustez les tarifs applicables à domicile, stop desk, express 24h et économique 48h.
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
              <input
                type="text"
                placeholder="Filtrer une wilaya ou code (ex: 16, Alger, Oran)..."
                value={filterWilaya}
                onChange={(e) => setFilterWilaya(e.target.value)}
                className="w-full sm:w-72 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3.5 py-2 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:border-[#FF6500] focus:outline-hidden"
              />

              <button
                onClick={handleSaveAllRates}
                className="py-2.5 px-5 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold text-xs rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer tous les tarifs</span>
              </button>
            </div>

            {saveRatesSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-2 text-xs text-[#004C3F]">
                <CheckCircle2 className="w-4 h-4 text-[#004C3F] shrink-0" />
                <span className="font-medium">
                  Les tarifs des 58 wilayas ont été enregistrés avec succès sur le serveur et le cache local !
                </span>
              </div>
            )}

            <div className="overflow-x-auto max-h-[550px] border border-[#DFE3E8] rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#F4F6F8] text-[#637381] uppercase tracking-wider font-bold border-b border-[#DFE3E8] z-10">
                  <tr>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Wilaya</th>
                    <th className="py-2.5 px-3">Domicile (DZD)</th>
                    <th className="py-2.5 px-3">Stop Desk (DZD)</th>
                    <th className="py-2.5 px-3 text-[#FF6500]">⚡ Express 24h (DZD)</th>
                    <th className="py-2.5 px-3 text-emerald-700">🌱 Économique 48h (DZD)</th>
                    <th className="py-2.5 px-3">Délai estimé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredWilayas.map((w) => (
                    <tr key={w.code} className="hover:bg-[#F4F6F8]/60 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-[#FF6500]">{w.code}</td>
                      <td className="py-2 px-3 font-bold text-[#212B36]">
                        {w.name} <span className="text-[11px] text-[#637381]">({w.nameAr})</span>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={rates[w.code]?.home ?? w.homeDeliveryFee}
                          onChange={(e) => handleRateChange(w.code, 'home', Number(e.target.value))}
                          className="w-24 bg-[#F4F6F8] border border-[#DFE3E8] rounded-lg px-2.5 py-1 text-[#212B36] font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={rates[w.code]?.desk ?? w.deskDeliveryFee}
                          onChange={(e) => handleRateChange(w.code, 'desk', Number(e.target.value))}
                          className="w-24 bg-[#F4F6F8] border border-[#DFE3E8] rounded-lg px-2.5 py-1 text-[#004C3F] font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={rates[w.code]?.express ?? (w.expressDeliveryFee || w.homeDeliveryFee + 100)}
                          onChange={(e) => handleRateChange(w.code, 'express', Number(e.target.value))}
                          className="w-24 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1 text-amber-950 font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={rates[w.code]?.eco ?? (w.ecoDeliveryFee || Math.round(w.homeDeliveryFee * 0.85))}
                          onChange={(e) => handleRateChange(w.code, 'eco', Number(e.target.value))}
                          className="w-24 bg-emerald-50 border border-emerald-300 rounded-lg px-2.5 py-1 text-emerald-950 font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 text-[#637381] font-mono">{w.estimatedDeliveryHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5 & 6 : IDENTITÉ BOUTIQUE & IDENTIFIANTS ADMIN                    */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'store') && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0]">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#FF6500] flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                Identité de la Boutique & Sécurité Administrateur
              </h2>
              <p className="text-xs text-[#637381]">
                Coordonnées officielles de la boutique et gestion des accès du compte administrateur.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Store Identity */}
            <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <h3 className="text-xs font-bold text-[#212B36] uppercase tracking-wider flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-[#FF6500]" />
                  <span>Identité & Carte de Visite Officielle</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(true)}
                  className="px-2.5 py-1 text-xs font-bold text-[#FF6500] bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer"
                >
                  Voir la carte de visite
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-[#F4F6F8] rounded-2xl border border-[#DFE3E8] flex items-center justify-between">
                  <span className="text-[#637381] font-medium">Nom Commercial</span>
                  <span className="font-black text-[#212B36]">{brandName}</span>
                </div>
                <div className="p-3 bg-[#F4F6F8] rounded-2xl border border-[#DFE3E8] flex items-center justify-between">
                  <span className="text-[#637381] font-medium">Téléphone & WhatsApp</span>
                  <span className="font-black text-[#FF6500] tracking-wider font-mono">{contactPhone}</span>
                </div>
                <div className="p-3 bg-[#F4F6F8] rounded-2xl border border-[#DFE3E8] flex items-center justify-between">
                  <span className="text-[#637381] font-medium">Domaine Officiel</span>
                  <span className="font-black text-[#212B36]">{storeDomain}</span>
                </div>
              </div>
            </div>

            {/* Admin Credentials */}
            <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="text-xs font-bold text-[#212B36] uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#004C3F]" />
                    <span>Sécurité & Accès Administrateur</span>
                  </h3>
                  <p className="text-[11px] text-[#637381]">Chiffrement cryptographique SHA-256</p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#004C3F] border border-emerald-200 text-[10px] font-bold">
                  <Lock className="w-3 h-3" />
                  <span>Accès Protégé</span>
                </span>
              </div>

              {credMessage && (
                <div
                  className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold ${
                    credMessage.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-[#004C3F]'
                      : 'bg-red-50 border border-red-200 text-red-600'
                  }`}
                >
                  {credMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#004C3F] shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{credMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveCredentials} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#212B36] mb-1">
                    Nom d'utilisateur / E-mail admin
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="admin ou ouaredomar@gmail.com"
                    required
                    className="w-full px-3 py-2 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl text-xs font-bold text-[#212B36] focus:border-[#FF6500] focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#212B36] mb-1">Nouveau mot de passe</label>
                    <div className="relative">
                      <input
                        type={showCredPassword ? 'text' : 'password'}
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Nouveau mot de passe"
                        required
                        className="w-full pl-3 pr-8 py-2 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl text-xs font-bold text-[#212B36] focus:border-[#FF6500] focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCredPassword(!showCredPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#919EAB] hover:text-[#212B36] cursor-pointer"
                      >
                        {showCredPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#212B36] mb-1">Confirmer le mot de passe</label>
                    <input
                      type={showCredPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Répétez le mot de passe"
                      required
                      className="w-full px-3 py-2 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl text-xs font-bold text-[#212B36] focus:border-[#FF6500] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="py-2 px-4 bg-[#004C3F] hover:bg-[#00382E] text-white font-bold text-xs rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Mettre à jour mes identifiants</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
