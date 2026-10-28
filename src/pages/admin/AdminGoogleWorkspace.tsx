import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  FileSpreadsheet,
  Mail,
  HardDrive,
  Calendar,
  CheckCircle2,
  Download,
  Key,
} from 'lucide-react';

export const AdminGoogleWorkspace: React.FC = () => {
  const { orders } = useStore();

  const [sheetsConnected, setSheetsConnected] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('contact@dzmahall.store');
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);

  const handleExportCSVForSheets = () => {
    const headers = [
      'ID_Commande',
      'Date_Commande',
      'Nom_Client',
      'Telephone_Client',
      'Wilaya_Code',
      'Wilaya_Nom',
      'Commune',
      'Mode_Livraison',
      'Total_COD_DZD',
      'Statut_Livraison',
      'Transporteur',
      'Tracking_Number'
    ];

    const rows = orders.map((o) => [
      `"${o.orderNumber}"`,
      `"${o.createdAt.slice(0, 10)}"`,
      `"${o.customerName.replace(/"/g, '""')}"`,
      `"${o.customerPhone}"`,
      `"${o.wilayaCode}"`,
      `"${o.wilayaName}"`,
      `"${o.commune.replace(/"/g, '""')}"`,
      `"${o.deliveryMode}"`,
      o.totalAmount,
      `"${o.status}"`,
      `"${o.carrierName || ''}"`,
      `"${o.trackingNumber || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dzmahall_google_sheets_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSyncStatusMessage('Export CSV prêt ! Vous pouvez l\'importer directement dans Fichier > Importer sur Google Sheets.');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DFE3E8]">
        <div>
          <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider">
            Intégrations & Automatisation
          </span>
          <h1 className="text-2xl font-black text-[#212B36] mt-0.5 font-['Plus_Jakarta_Sans']">
            Google Workspace (Sheets, Gmail, Drive)
          </h1>
          <p className="text-xs text-[#637381] mt-0.5">
            Synchronisation de vos commandes, alertes par e-mail et archivage sécurisé des bordereaux.
          </p>
        </div>
      </div>

      {syncStatusMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-xs text-[#004C3F]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#004C3F] shrink-0" />
            <span className="font-medium">{syncStatusMessage}</span>
          </div>
          <button
            onClick={() => setSyncStatusMessage(null)}
            className="text-xs underline text-[#637381] hover:text-[#212B36]"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Service 1: Google Sheets */}
        <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#004C3F] flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">Google Sheets</h3>
                <p className="text-xs text-[#637381]">Export & Synchronisation des commandes COD</p>
              </div>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                sheetsConnected
                  ? 'bg-emerald-100 text-[#004C3F]'
                  : 'bg-slate-100 text-[#637381]'
              }`}
            >
              {sheetsConnected ? 'Connecté' : 'Non Connecté'}
            </span>
          </div>

          <p className="text-xs text-[#637381] leading-relaxed">
            Chaque nouvelle commande validée peut alimenter automatiquement une ligne de votre tableur Google Sheets (Nom, Tél, Wilaya, Total COD, Statut).
          </p>

          <div className="space-y-3 pt-2 text-xs">
            <div>
              <label className="block text-[#212B36] font-semibold mb-1">
                ID du tableur Google Sheets cible :
              </label>
              <input
                type="text"
                placeholder="Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-mono text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!spreadsheetId.trim()) {
                    alert('Veuillez d\'abord saisir un identifiant de tableur Google Sheets valide.');
                    return;
                  }
                  setSheetsConnected(!sheetsConnected);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  sheetsConnected
                    ? 'bg-red-100 text-[#D82C0D] border border-red-200 hover:bg-red-200'
                    : 'bg-[#004C3F] hover:bg-[#00382E] text-white shadow-xs'
                }`}
              >
                {sheetsConnected ? 'Déconnecter Google Sheets' : 'Connecter via OAuth 2.0'}
              </button>

              <button
                type="button"
                onClick={handleExportCSVForSheets}
                className="py-2 px-3 bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] text-xs font-bold rounded-xl border border-[#DFE3E8] flex items-center gap-1.5 cursor-pointer"
                title="Exporter immédiatement pour import manuel"
              >
                <Download className="w-3.5 h-3.5 text-[#FF6500]" />
                <span>Export CSV direct</span>
              </button>
            </div>
          </div>
        </div>

        {/* Service 2: Gmail */}
        <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 text-[#FF6500] flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">Gmail Notifications</h3>
                <p className="text-xs text-[#637381]">Alertes commandes et ruptures de stock</p>
              </div>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                gmailConnected
                  ? 'bg-emerald-100 text-[#004C3F]'
                  : 'bg-slate-100 text-[#637381]'
              }`}
            >
              {gmailConnected ? 'Connecté' : 'Non Connecté'}
            </span>
          </div>

          <p className="text-xs text-[#637381] leading-relaxed">
            Recevez un récapitulatif par e-mail dès qu'une commande est passée dans les 58 wilayas, ainsi que des alertes lorsque le stock d'un produit passe sous le seuil critique.
          </p>

          <div className="space-y-3 pt-2 text-xs">
            <div>
              <label className="block text-[#212B36] font-semibold mb-1">
                Adresse e-mail de réception :
              </label>
              <input
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36]"
              />
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setGmailConnected(!gmailConnected)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  gmailConnected
                    ? 'bg-red-100 text-[#D82C0D] border border-red-200'
                    : 'bg-[#FF6500] hover:bg-[#E55B00] text-white shadow-xs'
                }`}
              >
                {gmailConnected ? 'Désactiver les alertes Gmail' : 'Activer les alertes e-mail'}
              </button>
            </div>
          </div>
        </div>

        {/* Service 3: Google Drive */}
        <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-[#004C3F] flex items-center justify-center">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">Google Drive</h3>
                <p className="text-xs text-[#637381]">Sauvegarde automatique des bordereaux et exports</p>
              </div>
            </div>

            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-[#637381]">
              Optionnel
            </span>
          </div>

          <p className="text-xs text-[#637381] leading-relaxed">
            Archivez de façon sécurisée vos bordereaux de transport au format PDF dans un dossier dédié sur votre Google Drive d'entreprise.
          </p>
        </div>

        {/* Service 4: Google Calendar */}
        <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-[#FF6500] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">Google Calendar</h3>
                <p className="text-xs text-[#637381]">Planification des ramassages de colis</p>
              </div>
            </div>

            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-[#637381]">
              Optionnel
            </span>
          </div>

          <p className="text-xs text-[#637381] leading-relaxed">
            Créez des événements de ramassage quotidien pour vos passages de camionnettes de transport (Yalidine, Guepex).
          </p>
        </div>
      </div>

      {/* Setup Guide Banner */}
      <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 space-y-3 text-xs text-[#212B36] shadow-xs">
        <div className="flex items-center gap-2 font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">
          <Key className="w-4 h-4 text-[#FF6500]" />
          <span>Procédure de Configuration Google Cloud Console :</span>
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-[#637381] text-xs">
          <li>Accédez à Google Cloud Console et activez les API Google Sheets et Gmail.</li>
          <li>Créez un identifiant client OAuth 2.0 de type "Application Web".</li>
          <li>Autorisez les scopes <code className="text-[#FF6500] font-bold">https://www.googleapis.com/auth/spreadsheets</code> et <code className="text-[#FF6500] font-bold">https://www.googleapis.com/auth/gmail.send</code>.</li>
          <li>En l'absence de clé OAuth active, utilisez le bouton d'export CSV pour importer vos commandes manuellement dans Google Sheets.</li>
        </ol>
      </div>
    </div>
  );
};
