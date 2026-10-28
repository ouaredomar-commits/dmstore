import React, { useState, useRef } from 'react';
import { Product } from '../../types';
import {
  DZ_PRODUCT_FIELDS,
  ColumnMapping,
  RowValidationResult,
  autoDetectColumnMapping,
  parseCsvText,
  parseXlsxBuffer,
  parseJsonText,
  parseXmlText,
  validateImportRows,
  generateProductCsvTemplate,
  downloadFile,
  exportProductsToXlsx,
  exportErrorsToCsv,
  isSafeRemoteUrl,
  RawRowData,
} from '../../utils/importUtils';
import {
  X,
  Upload,
  FileSpreadsheet,
  Globe,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Download,
  AlertCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldAlert,
  Pause,
  Play,
  Check,
  FileText,
} from 'lucide-react';

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  onImportBatch: (
    productsToImport: Product[],
    mode: 'add_new' | 'update_existing' | 'create_new_sku',
    onProgress?: (processed: number, total: number) => void
  ) => Promise<{ added: number; updated: number; skipped: number }>;
  onSuccessNotification: (msg: string) => void;
}

type ImportStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ProductImportModal: React.FC<ProductImportModalProps> = ({
  isOpen,
  onClose,
  existingProducts,
  onImportBatch,
  onSuccessNotification,
}) => {
  const [currentStep, setCurrentStep] = useState<ImportStep>(1);

  // Step 1: Source & file state
  const [sourceType, setSourceType] = useState<'file' | 'url'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string>('');
  const [isLoadingSource, setIsLoadingSource] = useState<boolean>(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Step 2 & 3: Parsed raw data & mapping
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [detectedRows, setDetectedRows] = useState<RawRowData[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});

  // Step 4 & 5: Validation state
  const [validationResults, setValidationResults] = useState<RowValidationResult[]>([]);

  // Step 6: Duplicate handling mode
  const [duplicateMode, setDuplicateMode] = useState<'add_new' | 'update_existing' | 'create_new_sku'>('add_new');

  // Step 7: Progress & execution state
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [importSummary, setImportSummary] = useState<{ added: number; updated: number; skipped: number } | null>(null);

  if (!isOpen) return null;

  // Reset modal state
  const handleReset = () => {
    setCurrentStep(1);
    setSelectedFile(null);
    setRemoteUrl('');
    setIsLoadingSource(false);
    setSourceError(null);
    setDetectedHeaders([]);
    setDetectedRows([]);
    setColumnMapping({});
    setValidationResults([]);
    setIsImporting(false);
    setIsPaused(false);
    setImportProgress({ processed: 0, total: 0 });
    setImportSummary(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Download templates
  const handleDownloadCsvTemplate = () => {
    const csv = generateProductCsvTemplate();
    downloadFile(csv, 'modele_import_produits_dzmahall.csv', 'text/csv;charset=utf-8;');
  };

  const handleDownloadXlsxTemplate = () => {
    // Generate dummy products for xlsx template
    const sampleProducts: Product[] = [
      {
        id: 'prod-sample-1',
        name: 'Écouteurs Pro Sans Fil ANC V3',
        slug: 'ecouteurs-pro-sans-fil-anc-v3',
        category: 'audio-wear',
        categoryLabel: 'Audio & Son',
        price: 3900,
        originalPrice: 5500,
        purchaseCost: 1800,
        advertisingCost: 450,
        packagingCost: 120,
        sku: 'DZM-EAR-V3',
        stockQuantity: 40,
        description: 'Écouteurs haute définition avec réduction active du bruit et autonomie 30h.',
        features: ['Réduction de bruit ANC', 'Bluetooth 5.3', 'Autonomie 30h'],
        imageUrls: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80'],
        variants: [{ id: 'v1', name: 'Standard', stock: 40, sku: 'DZM-EAR-V3-STD' }],
        isActive: true,
        isFeatured: true,
        createdAt: '2026-03-01T00:00:00Z',
      },
    ];
    exportProductsToXlsx(sampleProducts);
  };

  // Step 1: Process file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setSourceError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setSourceError(null);
    }
  };

  // Step 1 -> Step 2: Read source file or URL
  const handleLoadSource = async () => {
    setIsLoadingSource(true);
    setSourceError(null);

    try {
      let headers: string[] = [];
      let rows: RawRowData[] = [];

      if (sourceType === 'file') {
        if (!selectedFile) {
          throw new Error('Veuillez sélectionner un fichier CSV, Excel, JSON ou XML.');
        }

        const fileName = selectedFile.name.toLowerCase();

        if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
          const text = await selectedFile.text();
          const parsed = parseCsvText(text);
          headers = parsed.headers;
          rows = parsed.rows;
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          const buffer = await selectedFile.arrayBuffer();
          const parsed = parseXlsxBuffer(buffer);
          headers = parsed.headers;
          rows = parsed.rows;
        } else if (fileName.endsWith('.json')) {
          const text = await selectedFile.text();
          const parsed = parseJsonText(text);
          headers = parsed.headers;
          rows = parsed.rows;
        } else if (fileName.endsWith('.xml')) {
          const text = await selectedFile.text();
          const parsed = parseXmlText(text);
          headers = parsed.headers;
          rows = parsed.rows;
        } else {
          throw new Error('Format de fichier non pris en charge. Formats acceptés : CSV, XLSX, XLS, JSON, XML.');
        }
      } else {
        // Remote URL source
        const cleanUrl = remoteUrl.trim();
        if (!cleanUrl) {
          throw new Error('Veuillez saisir une URL de fichier catalogue distante.');
        }

        // Anti-SSRF safe check
        const safeCheck = isSafeRemoteUrl(cleanUrl);
        if (!safeCheck.safe) {
          throw new Error(`Accès distant refusé : ${safeCheck.reason}`);
        }

        const response = await fetch(cleanUrl, {
          headers: { Accept: 'text/csv, application/json, text/xml, application/xml, */*' },
        });

        if (!response.ok) {
          throw new Error(`Impossible de récupérer le fichier distant (Code HTTP ${response.status} : ${response.statusText}).`);
        }

        const contentType = response.headers.get('content-type') || '';
        const urlLower = cleanUrl.toLowerCase();

        if (contentType.includes('json') || urlLower.endsWith('.json')) {
          const jsonText = await response.text();
          const parsed = parseJsonText(jsonText);
          headers = parsed.headers;
          rows = parsed.rows;
        } else if (contentType.includes('xml') || urlLower.endsWith('.xml')) {
          const xmlText = await response.text();
          const parsed = parseXmlText(xmlText);
          headers = parsed.headers;
          rows = parsed.rows;
        } else {
          const csvText = await response.text();
          const parsed = parseCsvText(csvText);
          headers = parsed.headers;
          rows = parsed.rows;
        }
      }

      if (rows.length === 0) {
        throw new Error('Le fichier ne contient aucune ligne de données exploitable.');
      }

      setDetectedHeaders(headers);
      setDetectedRows(rows);

      // Auto detect mappings
      const initialMapping = autoDetectColumnMapping(headers);
      setColumnMapping(initialMapping);

      setCurrentStep(2);
    } catch (err: any) {
      setSourceError(err?.message || 'Erreur lors de la lecture du fichier source.');
    } finally {
      setIsLoadingSource(false);
    }
  };

  // Step 3 -> Step 4 & 5: Validate mapped rows
  const handleValidateMapping = () => {
    // Check if required fields are mapped
    const hasNameMapping = Object.values(columnMapping).includes('name');
    const hasPriceMapping = Object.values(columnMapping).includes('price');

    if (!hasNameMapping || !hasPriceMapping) {
      alert('Veuillez au minimum associer une colonne pour le « Nom du Produit » et le « Prix de Vente »');
      return;
    }

    const results = validateImportRows(detectedRows, columnMapping, existingProducts);
    setValidationResults(results);
    setCurrentStep(4);
  };

  // Step 6: Confirmation & execute import
  const handleStartImport = async () => {
    setIsImporting(true);
    setCurrentStep(7);

    // Filter rows to import based on duplicateMode and validity
    const validRows = validationResults.filter((r) => r.isValid);
    const productsToProcess: Product[] = [];

    validRows.forEach((r) => {
      if (!r.parsedProduct) return;
      if (r.isDuplicate && duplicateMode === 'add_new') {
        // Skip
        return;
      }
      productsToProcess.push(r.parsedProduct as Product);
    });

    setImportProgress({ processed: 0, total: productsToProcess.length });

    try {
      const summary = await onImportBatch(productsToProcess, duplicateMode, (processed, total) => {
        setImportProgress({ processed, total });
      });

      setImportSummary(summary);
      onSuccessNotification(`Importation terminée : ${summary.added} produit(s) ajouté(s), ${summary.updated} mis à jour.`);
    } catch (err: any) {
      alert(`Erreur pendant l'importation : ${err?.message || 'Erreur inconnue'}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Download error report
  const handleDownloadErrorReport = () => {
    exportErrorsToCsv(validationResults);
  };

  // Calculations for Step 5 summary
  const totalRows = validationResults.length;
  const validCount = validationResults.filter((r) => r.isValid && !r.isDuplicate).length;
  const duplicateCount = validationResults.filter((r) => r.isDuplicate).length;
  const errorCount = validationResults.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#DFE3E8] rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DFE3E8] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF6500]">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                Assistant d'Importation en Masse de Produits
              </h2>
              <p className="text-xs text-[#637381]">
                Étape {currentStep} sur 7 :{' '}
                {currentStep === 1 && 'Choisir le fichier source (CSV, XLSX, JSON, XML)'}
                {currentStep === 2 && 'Aperçu des lignes détectées'}
                {currentStep === 3 && 'Associer les colonnes aux champs DzMahall'}
                {currentStep === 4 && 'Validation et détection des erreurs / doublons'}
                {currentStep === 5 && 'Bilan de validation'}
                {currentStep === 6 && 'Gestion des doublons et confirmation'}
                {currentStep === 7 && 'Progression et résultat final'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-[#F4F6F8] hover:bg-slate-200 text-[#637381] hover:text-[#212B36] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-2.5 bg-[#F4F6F8] border-b border-[#DFE3E8] flex items-center justify-between text-[11px] font-bold text-[#637381] overflow-x-auto no-scrollbar">
          {[
            { num: 1, label: 'Fichier' },
            { num: 2, label: 'Aperçu' },
            { num: 3, label: 'Mapping' },
            { num: 4, label: 'Validation' },
            { num: 5, label: 'Bilan' },
            { num: 6, label: 'Options' },
            { num: 7, label: 'Résultat' },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-1.5 shrink-0 ${
                currentStep === s.num
                  ? 'text-[#FF6500]'
                  : currentStep > s.num
                  ? 'text-emerald-700'
                  : 'text-[#919EAB]'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  currentStep === s.num
                    ? 'bg-[#FF6500] text-white'
                    : currentStep > s.num
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-[#DFE3E8] text-[#637381]'
                }`}
              >
                {currentStep > s.num ? '✓' : s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
              {s.num < 7 && <ChevronRight className="w-3.5 h-3.5 mx-1 text-[#DFE3E8]" />}
            </div>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* =========================================================================
              ÉTAPE 1 : CHOISIR LE FICHIER OU LA SOURCE
              ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Type Switcher */}
              <div className="flex items-center gap-2 p-1 bg-[#F4F6F8] rounded-2xl w-fit">
                <button
                  type="button"
                  onClick={() => setSourceType('file')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    sourceType === 'file'
                      ? 'bg-white text-[#212B36] shadow-xs'
                      : 'text-[#637381] hover:text-[#212B36]'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#FF6500]" />
                  <span>Fichier Local (CSV / XLSX / JSON / XML)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('url')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    sourceType === 'url'
                      ? 'bg-white text-[#212B36] shadow-xs'
                      : 'text-[#637381] hover:text-[#212B36]'
                  }`}
                >
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>URL de Flux / Fichier Distant</span>
                </button>
              </div>

              {sourceError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Erreur de chargement :</strong>
                    <span>{sourceError}</span>
                  </div>
                </div>
              )}

              {sourceType === 'file' ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#DFE3E8] hover:border-[#FF6500] rounded-3xl p-8 sm:p-12 text-center bg-[#F4F6F8]/40 hover:bg-orange-50/20 transition-all cursor-pointer space-y-4"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.json,.xml"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-3xl bg-white shadow-md border border-[#DFE3E8] mx-auto flex items-center justify-center text-[#FF6500]">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#212B36]">
                      {selectedFile ? selectedFile.name : 'Glissez-déposez votre fichier ici'}
                    </h3>
                    <p className="text-xs text-[#637381] mt-1">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} Ko — Cliquez pour changer`
                        : 'Formats acceptés : CSV, Excel (.xlsx, .xls), JSON, XML'}
                    </p>
                  </div>
                  {!selectedFile && (
                    <button
                      type="button"
                      className="px-4 py-2 bg-white border border-[#DFE3E8] rounded-xl text-xs font-bold text-[#212B36] hover:bg-slate-100 shadow-2xs"
                    >
                      Parcourir les fichiers de mon ordinateur
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 bg-[#F4F6F8] p-6 rounded-3xl border border-[#DFE3E8]">
                  <div>
                    <label className="block text-xs font-bold text-[#212B36] mb-1">
                      URL publique du fichier (CSV, JSON, XML) :
                    </label>
                    <input
                      type="url"
                      placeholder="https://exemple.com/catalogue-produits.csv"
                      value={remoteUrl}
                      onChange={(e) => setRemoteUrl(e.target.value)}
                      className="w-full bg-white border border-[#DFE3E8] rounded-xl px-4 py-2.5 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500]"
                    />
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Sécurité garantie :</strong> Les adresses locales privées (localhost, 127.0.0.1, réseau local 192.168.*) et les endpoints internes sont automatiquement bloqués.
                    </span>
                  </div>
                </div>
              )}

              {/* Template download helpers */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="block text-[#212B36]">Besoin d'un modèle prêt à remplir ?</strong>
                    <span className="text-[#637381]">Téléchargez un modèle vierge avec les colonnes attendues pour DzMahall.</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-xl font-bold hover:bg-emerald-100/60 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Modèle CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadXlsxTemplate}
                    className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-xl font-bold hover:bg-emerald-100/60 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Modèle Excel XLSX</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              ÉTAPE 2 : APERÇU DES LIGNES DÉTECTÉES
              ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#212B36]">
                    Aperçu des données brutes détectées
                  </h3>
                  <p className="text-xs text-[#637381]">
                    {detectedRows.length} ligne(s) détectée(s) et {detectedHeaders.length} colonne(s).
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                  {detectedRows.length} lignes prêtes
                </span>
              </div>

              <div className="border border-[#DFE3E8] rounded-2xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F4F6F8] border-b border-[#DFE3E8] text-[#637381] font-bold">
                        <th className="py-2.5 px-3">#</th>
                        {detectedHeaders.map((h, i) => (
                          <th key={i} className="py-2.5 px-3 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFE3E8]">
                      {detectedRows.slice(0, 5).map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-[#919EAB] font-mono">{rowIdx + 1}</td>
                          {detectedHeaders.map((h, colIdx) => (
                            <td key={colIdx} className="py-2.5 px-3 text-[#212B36] max-w-[200px] truncate">
                              {String(row[h] || '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {detectedRows.length > 5 && (
                  <div className="p-2.5 bg-[#F4F6F8] text-center text-xs text-[#637381] border-t border-[#DFE3E8]">
                    + {detectedRows.length - 5} autre(s) ligne(s) non affichée(s) dans cet aperçu
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              ÉTAPE 3 : MAPPING DES COLONNES
              ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h3 className="text-sm font-bold text-[#212B36]">
                  Associez chaque colonne source à un champ DzMahall
                </h3>
                <p className="text-xs text-[#637381]">
                  Les champs « Nom du Produit » et « Prix de Vente » sont obligatoires.
                </p>
              </div>

              <div className="space-y-3">
                {detectedHeaders.map((header) => {
                  const currentMappedKey = columnMapping[header] || '';
                  const sampleValue = detectedRows[0]?.[header];

                  return (
                    <div
                      key={header}
                      className="p-3 bg-[#F4F6F8] rounded-2xl border border-[#DFE3E8] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-[200px]">
                        <span className="font-bold text-xs text-[#212B36]">{header}</span>
                        {sampleValue !== undefined && (
                          <p className="text-[11px] text-[#637381] truncate max-w-xs mt-0.5">
                            Exemple : <span className="text-[#212B36] font-mono">"{String(sampleValue).slice(0, 40)}"</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-[#919EAB] shrink-0 hidden sm:block" />
                        <select
                          value={currentMappedKey}
                          onChange={(e) =>
                            setColumnMapping({
                              ...columnMapping,
                              [header]: e.target.value,
                            })
                          }
                          className="bg-white border border-[#DFE3E8] rounded-xl px-3 py-2 text-xs font-semibold text-[#212B36] focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
                        >
                          <option value="">— Ignorer cette colonne —</option>
                          {DZ_PRODUCT_FIELDS.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label} {f.required ? '(* Obligatoire)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================================
              ÉTAPE 4 & 5 : VALIDATION & BILAN AVANT ÉCRITURE
              ========================================================================= */}
          {(currentStep === 4 || currentStep === 5) && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-[#DFE3E8]">
                  <span className="text-[10px] uppercase font-bold text-[#637381] block">Total Lignes</span>
                  <span className="text-xl font-black text-[#212B36] mt-1 block">{totalRows}</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Lignes Valides</span>
                  <span className="text-xl font-black text-emerald-800 mt-1 block">{validCount}</span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Doublons SKU</span>
                  <span className="text-xl font-black text-amber-800 mt-1 block">{duplicateCount}</span>
                </div>
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
                  <span className="text-[10px] uppercase font-bold text-red-800 block">Erreurs Bloquantes</span>
                  <span className="text-xl font-black text-red-800 mt-1 block">{errorCount}</span>
                </div>
              </div>

              {/* Error & Warning Details Table */}
              {errorCount > 0 || duplicateCount > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#212B36] uppercase tracking-wider">
                      Détail des anomalies détectées ({errorCount + duplicateCount})
                    </h4>
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      className="px-3 py-1.5 bg-[#F4F6F8] hover:bg-slate-200 border border-[#DFE3E8] rounded-xl text-xs font-bold text-[#212B36] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#FF6500]" />
                      <span>Télécharger le rapport d'erreurs CSV</span>
                    </button>
                  </div>

                  <div className="border border-[#DFE3E8] rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F4F6F8] text-[#637381] font-bold border-b border-[#DFE3E8] sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Ligne</th>
                          <th className="py-2 px-3">Produit</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Détail du problème</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DFE3E8]">
                        {validationResults
                          .filter((r) => !r.isValid || r.isDuplicate)
                          .map((r) => (
                            <tr key={r.rowNumber} className={!r.isValid ? 'bg-red-50/50' : 'bg-amber-50/40'}>
                              <td className="py-2 px-3 font-mono font-bold text-[#637381]">{r.rowNumber}</td>
                              <td className="py-2 px-3 font-medium text-[#212B36] max-w-[150px] truncate">
                                {r.parsedProduct?.name || 'Inconnu'}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-[#637381]">
                                {r.parsedProduct?.sku || 'N/A'}
                              </td>
                              <td className="py-2 px-3">
                                {!r.isValid ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                    Erreur
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Doublon
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-[11px] text-red-900">
                                {r.errors.length > 0 ? r.errors.join(' | ') : r.duplicateReason}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm">Toutes les lignes sont valides !</h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Aucune erreur bloquante ni doublon n'a été détecté dans votre fichier.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              ÉTAPE 6 : GESTION DES DOUBLONS & CONFIRMATION
              ========================================================================= */}
          {currentStep === 6 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-sm font-bold text-[#212B36]">
                  Comment souhaitez-vous gérer les doublons de références (SKU) ?
                </h3>
                <p className="text-xs text-[#637381]">
                  {duplicateCount} doublon(s) identifié(s) par rapport aux produits existants.
                </p>
              </div>

              <div className="space-y-3">
                <label
                  onClick={() => setDuplicateMode('add_new')}
                  className={`p-4 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                    duplicateMode === 'add_new'
                      ? 'border-[#FF6500] bg-orange-50/30 ring-2 ring-orange-500/10'
                      : 'border-[#DFE3E8] bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicateMode"
                    checked={duplicateMode === 'add_new'}
                    onChange={() => setDuplicateMode('add_new')}
                    className="mt-1 text-[#FF6500] focus:ring-[#FF6500]"
                  />
                  <div>
                    <strong className="block text-xs font-bold text-[#212B36]">
                      1. Ajouter uniquement les nouveaux produits (Ignorer les doublons)
                    </strong>
                    <span className="text-[11px] text-[#637381] mt-0.5 block leading-relaxed">
                      Recommandé : Seuls les produits dont le SKU n'existe pas encore seront créés. Vos fiches actuelles restent strictement intactes.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setDuplicateMode('update_existing')}
                  className={`p-4 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                    duplicateMode === 'update_existing'
                      ? 'border-[#FF6500] bg-orange-50/30 ring-2 ring-orange-500/10'
                      : 'border-[#DFE3E8] bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicateMode"
                    checked={duplicateMode === 'update_existing'}
                    onChange={() => setDuplicateMode('update_existing')}
                    className="mt-1 text-[#FF6500] focus:ring-[#FF6500]"
                  />
                  <div>
                    <strong className="block text-xs font-bold text-[#212B36]">
                      2. Mettre à jour les produits existants ayant le même SKU
                    </strong>
                    <span className="text-[11px] text-[#637381] mt-0.5 block leading-relaxed">
                      Les prix, stocks et descriptions des produits existants correspondant aux SKUs du fichier seront synchronisés et actualisés.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setDuplicateMode('create_new_sku')}
                  className={`p-4 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                    duplicateMode === 'create_new_sku'
                      ? 'border-[#FF6500] bg-orange-50/30 ring-2 ring-orange-500/10'
                      : 'border-[#DFE3E8] bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicateMode"
                    checked={duplicateMode === 'create_new_sku'}
                    onChange={() => setDuplicateMode('create_new_sku')}
                    className="mt-1 text-[#FF6500] focus:ring-[#FF6500]"
                  />
                  <div>
                    <strong className="block text-xs font-bold text-[#212B36]">
                      3. Créer de nouveaux articles avec un SKU dérivé
                    </strong>
                    <span className="text-[11px] text-[#637381] mt-0.5 block leading-relaxed">
                      Tous les articles du fichier seront ajoutés en tant que nouvelles fiches, avec un suffixe SKU unique généré automatiquement.
                    </span>
                  </div>
                </label>
              </div>

              <div className="p-4 bg-slate-50 border border-[#DFE3E8] rounded-2xl text-xs space-y-2">
                <h4 className="font-bold text-[#212B36]">Récapitulatif de l'opération :</h4>
                <ul className="list-disc list-inside text-[#637381] space-y-1">
                  <li>Total lignes valides : <strong className="text-[#212B36]">{validCount + duplicateCount}</strong></li>
                  <li>Lignes invalides ignorées : <strong className="text-red-700">{errorCount}</strong></li>
                  <li>Mode de traitement des doublons : <strong className="text-[#212B36]">{duplicateMode}</strong></li>
                  <li>Aucun produit existant du catalogue ne sera supprimé.</li>
                </ul>
              </div>
            </div>
          )}

          {/* =========================================================================
              ÉTAPE 7 : PROGRESSION ET RÉSULTAT FINAL
              ========================================================================= */}
          {currentStep === 7 && (
            <div className="space-y-6 text-center py-6 animate-in fade-in duration-200">
              {isImporting ? (
                <div className="space-y-5 max-w-md mx-auto">
                  <RefreshCw className="w-12 h-12 text-[#FF6500] animate-spin mx-auto" />
                  <div>
                    <h3 className="text-lg font-bold text-[#212B36]">
                      Importation et synchronisation Cloud en cours...
                    </h3>
                    <p className="text-xs text-[#637381] mt-1">
                      Traitement sécurisé par lots Firestore ({importProgress.processed} / {importProgress.total})
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#DFE3E8] rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-[#FF6500] h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${
                          importProgress.total > 0
                            ? Math.round((importProgress.processed / importProgress.total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#212B36]">
                    {importProgress.total > 0
                      ? Math.round((importProgress.processed / importProgress.total) * 100)
                      : 0}
                    % effectué
                  </span>
                </div>
              ) : importSummary ? (
                <div className="space-y-5 max-w-lg mx-auto">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                      Importation terminée avec succès !
                    </h3>
                    <p className="text-xs text-[#637381] mt-1">
                      Les produits sont désormais enregistrés en base Cloud et visibles dans votre boutique.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">Créés</span>
                      <span className="text-lg font-black text-emerald-900 mt-0.5 block">{importSummary.added}</span>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
                      <span className="text-[10px] uppercase font-bold text-blue-800 block">Mis à jour</span>
                      <span className="text-lg font-black text-blue-900 mt-0.5 block">{importSummary.updated}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-[#DFE3E8] rounded-2xl">
                      <span className="text-[10px] uppercase font-bold text-[#637381] block">Ignorés</span>
                      <span className="text-lg font-black text-[#212B36] mt-0.5 block">{importSummary.skipped}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full py-3 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    Fermer et afficher le catalogue
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#DFE3E8] bg-[#F4F6F8] flex items-center justify-between shrink-0">
          <div>
            {currentStep > 1 && currentStep < 7 && !isImporting && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1) as ImportStep)}
                className="px-4 py-2 bg-white border border-[#DFE3E8] hover:bg-slate-100 text-[#212B36] font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Précédent</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 7 && (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-[#DFE3E8] bg-white hover:bg-slate-100 text-[#637381] font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
            )}

            {currentStep === 1 && (
              <button
                type="button"
                disabled={isLoadingSource || (sourceType === 'file' ? !selectedFile : !remoteUrl.trim())}
                onClick={handleLoadSource}
                className="px-5 py-2.5 bg-[#FF6500] hover:bg-[#E55B00] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {isLoadingSource ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Chargement...</span>
                  </>
                ) : (
                  <>
                    <span>Lire le fichier et continuer</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2.5 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Passer au mapping des colonnes</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleValidateMapping}
                className="px-5 py-2.5 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Valider les données</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {(currentStep === 4 || currentStep === 5) && (
              <button
                type="button"
                onClick={() => setCurrentStep(6)}
                disabled={validCount === 0 && duplicateCount === 0}
                className="px-5 py-2.5 bg-[#FF6500] hover:bg-[#E55B00] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Configurer les options de doublons</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 6 && (
              <button
                type="button"
                onClick={handleStartImport}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Lancer l'importation définitive ({validCount + (duplicateMode !== 'add_new' ? duplicateCount : 0)} produits)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
