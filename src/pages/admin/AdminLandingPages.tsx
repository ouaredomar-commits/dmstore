import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { LandingPage, LandingPageSection, Product } from '../../types';
import { generateSmartLandingPage, GenerationParams } from '../../utils/landingPageGenerator';
import { LandingPageView } from '../LandingPageView';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Eye,
  Globe,
  Sparkles,
  Layers,
  ArrowUp,
  ArrowDown,
  Check,
  Smartphone,
  Monitor,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sliders,
  Palette,
  FileText,
  X,
  RotateCcw,
  Truck,
  Link as LinkIcon,
} from 'lucide-react';

interface AdminLandingPagesProps {
  initialSubView?: 'list' | 'new' | 'edit' | 'preview';
  initialPageId?: string;
}

export const AdminLandingPages: React.FC<AdminLandingPagesProps> = ({
  initialSubView = 'list',
  initialPageId,
}) => {
  const {
    landingPages,
    products,
    carriers,
    addLandingPage,
    updateLandingPage,
    deleteLandingPage,
    duplicateLandingPage,
    navigateTo,
  } = useStore();

  const [view, setView] = useState<'list' | 'new' | 'edit' | 'preview'>(initialSubView);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(
    initialPageId || (landingPages[0]?.id || null)
  );

  // Search & Filters in List View
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Deletion confirmation modal
  const [pageToDelete, setPageToDelete] = useState<LandingPage | null>(null);

  // New Page creation wizard state
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');
  const [wizardProductId, setWizardProductId] = useState<string>(products[0]?.id || '');
  const [wizardCarrierId, setWizardCarrierId] = useState<string>(
    carriers.find((c) => c.status === 'connected')?.id || carriers[0]?.id || 'yalidine'
  );
  const [wizardGuepexServiceType, setWizardGuepexServiceType] = useState<'express' | 'economique' | ''>('');
  const [wizardGoal, setWizardGoal] = useState<GenerationParams['goal']>('direct_sale');
  const [wizardAudience, setWizardAudience] = useState<GenerationParams['audience']>('general_algeria');
  const [wizardLanguage, setWizardLanguage] = useState<GenerationParams['language']>('fr');
  const [wizardTone, setWizardTone] = useState<GenerationParams['tone']>('punchy');
  const [wizardOffer, setWizardOffer] = useState<string>('');
  const [wizardArguments, setWizardArguments] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Editor State
  const [editorPage, setEditorPage] = useState<LandingPage | null>(null);
  const [editorActiveTab, setEditorActiveTab] = useState<'sections' | 'design' | 'seo'>('sections');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [editorErrorMsg, setEditorErrorMsg] = useState<string | null>(null);

  // Current page for edit/preview
  const activePage = landingPages.find((p) => p.id === selectedPageId) || landingPages[0];

  // Open editor with fresh copy
  const handleOpenEdit = (page: LandingPage) => {
    setSelectedPageId(page.id);
    setEditorPage(JSON.parse(JSON.stringify(page)));
    setView('edit');
  };

  // Open preview
  const handleOpenPreview = (page: LandingPage) => {
    setSelectedPageId(page.id);
    setView('preview');
  };

  // Duplicate page
  const handleDuplicate = async (page: LandingPage) => {
    try {
      const duplicated = await duplicateLandingPage(page.id);
      setSelectedPageId(duplicated.id);
      setSaveSuccessMsg(`Page dupliquée avec succès : « ${duplicated.title} »`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle publish
  const handleToggleStatus = async (page: LandingPage) => {
    const nextStatus = page.status === 'published' ? 'draft' : 'published';
    await updateLandingPage(page.id, { status: nextStatus });
  };

  // Handle deletion confirmation
  const handleConfirmDelete = async () => {
    if (!pageToDelete) return;
    await deleteLandingPage(pageToDelete.id);
    setPageToDelete(null);
  };

  // Handle copy public link
  const handleCopyLink = (lp: LandingPage) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dzmahall.store';
    const fullUrl = `${origin}/lp/${lp.slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(lp.slug);
    setSaveSuccessMsg(`Lien public copié : ${fullUrl}`);
    setTimeout(() => {
      setCopiedSlug(null);
      setSaveSuccessMsg(null);
    }, 3000);
  };

  // Launch AI / Smart Generation
  const handleGenerateSmartPage = async () => {
    const targetProduct = products.find((p) => p.id === wizardProductId) || products[0];
    const targetCarrier = carriers.find((c) => c.id === wizardCarrierId) || carriers[0];
    if (!targetProduct) return;

    setIsGenerating(true);
    await new Promise((res) => setTimeout(res, 600)); // Smooth feedback

    const generated = generateSmartLandingPage({
      product: targetProduct,
      goal: wizardGoal,
      audience: wizardAudience,
      language: wizardLanguage,
      tone: wizardTone,
      shippingCompanyId: targetCarrier.id,
      shippingCompanyNameSnapshot: targetCarrier.name,
      customOffer: wizardOffer.trim() || undefined,
      customArguments: wizardArguments.trim() || undefined,
    });

    const newPage = await addLandingPage({
      ...generated,
      deliveryServiceType:
        targetCarrier.id === 'guepex' && (wizardGuepexServiceType === 'express' || wizardGuepexServiceType === 'economique')
          ? wizardGuepexServiceType
          : undefined,
    });
    setIsGenerating(false);
    handleOpenEdit(newPage);
  };

  // Launch Manual Blank Page
  const handleCreateManualPage = async () => {
    const targetProduct = products.find((p) => p.id === wizardProductId) || products[0];
    const targetCarrier = carriers.find((c) => c.id === wizardCarrierId) || carriers[0];
    const generated = generateSmartLandingPage({
      product: targetProduct,
      goal: 'direct_sale',
      audience: 'general_algeria',
      language: 'fr',
      tone: 'punchy',
      shippingCompanyId: targetCarrier.id,
      shippingCompanyNameSnapshot: targetCarrier.name,
    });
    const newPage = await addLandingPage({
      ...generated,
      title: `Nouvelle Page — ${targetProduct?.name || 'Produit'}`,
      status: 'draft',
      shippingCompanyId: targetCarrier.id,
      shippingCompanyNameSnapshot: targetCarrier.name,
      deliveryServiceType:
        targetCarrier.id === 'guepex' && (wizardGuepexServiceType === 'express' || wizardGuepexServiceType === 'economique')
          ? wizardGuepexServiceType
          : undefined,
    });
    handleOpenEdit(newPage);
  };

  // Save changes from editor with slug uniqueness validation
  const handleSaveEditor = async () => {
    if (!editorPage) return;
    setEditorErrorMsg(null);

    const cleanSlug = editorPage.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanSlug) {
      setEditorErrorMsg('Le slug d\'URL est obligatoire.');
      return;
    }

    const isDuplicate = landingPages.some(
      (p) => p.id !== editorPage.id && p.slug.trim().toLowerCase() === cleanSlug
    );
    if (isDuplicate) {
      setEditorErrorMsg(`Le slug « ${cleanSlug} » est déjà utilisé par une autre landing page. Choisissez un slug unique.`);
      return;
    }

    const targetCarrier = carriers.find((c) => c.id === editorPage.shippingCompanyId) || carriers[0];
    const updatedData: LandingPage = {
      ...editorPage,
      slug: cleanSlug,
      shippingCompanyId: targetCarrier.id,
      shippingCompanyNameSnapshot: targetCarrier.name,
    };

    setEditorPage(updatedData);
    await updateLandingPage(editorPage.id, updatedData);
    setSaveSuccessMsg('Modifications enregistrées avec succès dans Firebase Firestore !');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Filtered pages for list
  const filteredPages = landingPages.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ==========================================
  // VIEW 1: LIST OF LANDING PAGES
  // ==========================================
  if (view === 'list') {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#002244] tracking-tight">
              Constructeur de Landing Pages
            </h1>
            <p className="text-xs text-[#637381] mt-1">
              Créez des pages de vente immersives à fort taux de conversion pour le marché algérien.
            </p>
          </div>

          <button
            onClick={() => setView('new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF6500] hover:bg-[#e05900] text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Créer une Landing Page</span>
          </button>
        </div>

        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-2xl border border-[#DFE3E8] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#919EAB] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par titre ou slug..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#DFE3E8] text-xs font-semibold focus:outline-hidden focus:border-[#FF6500]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-[#637381] font-medium hidden sm:inline">Statut :</span>
            <div className="flex bg-[#F4F6F8] p-1 rounded-xl text-xs font-bold w-full sm:w-auto">
              {(['all', 'published', 'draft', 'archived'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-[11px] ${
                    statusFilter === st
                      ? 'bg-white text-[#002244] shadow-2xs'
                      : 'text-[#637381] hover:text-[#212B36]'
                  }`}
                >
                  {st === 'all' && 'Toutes'}
                  {st === 'published' && 'Publiées'}
                  {st === 'draft' && 'Brouillons'}
                  {st === 'archived' && 'Archivées'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Landing Pages Table / Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPages.map((lp) => {
            const product = products.find((p) => p.id === lp.productId);
            const thumb = product?.imageUrls?.[0] || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80';
            const conversionRate =
              lp.viewsCount > 0 ? ((lp.ordersCount / lp.viewsCount) * 100).toFixed(1) : '0.0';

            return (
              <div
                key={lp.id}
                className="bg-white rounded-3xl border border-[#DFE3E8] overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Card Header & Thumbnail */}
                  <div className="relative aspect-16/9 bg-[#F4F6F8] overflow-hidden border-b border-[#DFE3E8]">
                    <img
                      src={thumb}
                      alt={lp.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          lp.status === 'published'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : lp.status === 'draft'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-500 text-white shadow-xs'
                        }`}
                      >
                        {lp.status === 'published' ? '● En ligne' : lp.status === 'draft' ? 'Brouillon' : 'Archivée'}
                      </span>
                    </div>

                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white text-[11px] font-mono px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#FF6500]" />
                      <span>{lp.sections.filter((s) => s.enabled).length} sections</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3">
                    <h3 className="font-extrabold text-sm sm:text-base text-[#002244] line-clamp-1">
                      {lp.title}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-[#637381]">
                      <span className="font-bold text-[#FF6500]">Produit :</span>
                      <span className="truncate">{product?.name || 'Produit inconnu'}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#637381]">
                      <Truck className="w-3.5 h-3.5 text-[#FF6500] shrink-0" />
                      <span className="font-bold text-[#002244]">Transporteur :</span>
                      <span className="truncate font-semibold">{lp.shippingCompanyNameSnapshot || 'Yalidine Fast Logistics'}</span>
                    </div>

                    <div className="text-[11px] font-mono text-[#637381] bg-[#F4F6F8] p-2 rounded-xl flex items-center justify-between gap-2 border border-[#DFE3E8]/60">
                      <button
                        type="button"
                        onClick={() => navigateTo(`/lp/${lp.slug}`)}
                        className="truncate text-[#002244] hover:text-[#FF6500] hover:underline font-mono text-left cursor-pointer"
                        title="Ouvrir la page"
                      >
                        /lp/{lp.slug}
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(lp)}
                          title="Copier le lien public"
                          className="text-xs text-[#FF6500] hover:text-[#e05900] font-sans font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 cursor-pointer transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedSlug === lp.slug ? 'Copié !' : 'Copier'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateTo(`/lp/${lp.slug}`)}
                          title="Ouvrir la page en direct"
                          className="text-[#002244] hover:text-[#FF6500] p-1 rounded-lg cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats metrics */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#DFE3E8] text-center">
                      <div className="bg-[#F4F6F8] p-2 rounded-xl">
                        <div className="text-[10px] text-[#637381]">Visites</div>
                        <div className="text-sm font-extrabold text-[#002244] font-mono">
                          {lp.viewsCount || 0}
                        </div>
                      </div>
                      <div className="bg-[#F4F6F8] p-2 rounded-xl">
                        <div className="text-[10px] text-[#637381]">Commandes</div>
                        <div className="text-sm font-extrabold text-emerald-600 font-mono">
                          {lp.ordersCount || 0}
                        </div>
                      </div>
                      <div className="bg-[#F4F6F8] p-2 rounded-xl">
                        <div className="text-[10px] text-[#637381]">Conversion</div>
                        <div className="text-sm font-extrabold text-[#FF6500] font-mono">
                          {conversionRate}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-4 bg-[#F4F6F8]/60 border-t border-[#DFE3E8] flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(lp)}
                      title="Modifier la landing page"
                      className="p-2 rounded-xl bg-white border border-[#DFE3E8] hover:border-[#FF6500] text-[#002244] hover:text-[#FF6500] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenPreview(lp)}
                      title="Prévisualiser sur mobile & écran"
                      className="p-2 rounded-xl bg-white border border-[#DFE3E8] hover:border-[#FF6500] text-[#002244] hover:text-[#FF6500] transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(lp)}
                      title="Dupliquer cette page"
                      className="p-2 rounded-xl bg-white border border-[#DFE3E8] hover:border-[#FF6500] text-[#002244] hover:text-[#FF6500] transition-colors cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(lp)}
                      title={lp.status === 'published' ? 'Mettre en brouillon' : 'Publier la page'}
                      className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer ${
                        lp.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-white text-[#637381] border-[#DFE3E8] hover:bg-slate-50'
                      }`}
                    >
                      {lp.status === 'published' ? 'Publiée' : 'Publier'}
                    </button>
                  </div>

                  <button
                    onClick={() => setPageToDelete(lp)}
                    title="Supprimer la page"
                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredPages.length === 0 && (
          <div className="p-12 text-center bg-white rounded-3xl border border-[#DFE3E8] space-y-4">
            <Layers className="w-12 h-12 text-[#919EAB] mx-auto" />
            <h3 className="text-base font-bold text-[#002244]">Aucune landing page trouvée</h3>
            <p className="text-xs text-[#637381] max-w-sm mx-auto">
              {searchQuery
                ? 'Aucun résultat ne correspond à votre recherche.'
                : 'Commencez par générer votre première page de vente assistée par IA pour booster vos commandes en Algérie.'}
            </p>
            <button
              onClick={() => setView('new')}
              className="px-4 py-2 bg-[#FF6500] text-white text-xs font-bold rounded-xl"
            >
              Créer une page
            </button>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {pageToDelete && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#DFE3E8] space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#002244]">Supprimer définitivement ?</h3>
                <p className="text-xs text-[#637381] mt-1 leading-relaxed">
                  Êtes-vous sûr de vouloir supprimer la landing page <strong className="text-[#002244]">{pageToDelete.title}</strong> ?
                  Les commandes historiques associées à cette page resteront intactes.
                </p>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setPageToDelete(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#DFE3E8] text-xs font-bold text-[#637381] hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 cursor-pointer"
                >
                  Oui, supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: NEW LANDING PAGE WIZARD
  // ==========================================
  if (view === 'new') {
    const selectedProd = products.find((p) => p.id === wizardProductId) || products[0];

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between border-b border-[#DFE3E8] pb-4">
          <div>
            <button
              onClick={() => setView('list')}
              className="text-xs font-bold text-[#637381] hover:text-[#002244] mb-1 inline-flex items-center gap-1"
            >
              ← Retour à la liste
            </button>
            <h1 className="text-2xl font-extrabold text-[#002244]">
              Nouvelle Landing Page
            </h1>
          </div>

          <div className="flex bg-[#F4F6F8] p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setCreationMode('ai')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                creationMode === 'ai'
                  ? 'bg-[#FF6500] text-white shadow-2xs'
                  : 'text-[#637381] hover:text-[#002244]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Génération Intelligente IA</span>
            </button>
            <button
              onClick={() => setCreationMode('manual')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                creationMode === 'manual'
                  ? 'bg-white text-[#002244] shadow-2xs'
                  : 'text-[#637381] hover:text-[#002244]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Création Manuelle</span>
            </button>
          </div>
        </div>

        {/* Wizard Form */}
        <div className="bg-white rounded-3xl border border-[#DFE3E8] p-6 sm:p-8 shadow-sm space-y-6">
          {/* Step 1: Product Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-[#002244] uppercase tracking-wider">
              1. Choisissez le produit du catalogue
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-1">
              {products.map((p) => {
                const isSelected = wizardProductId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setWizardProductId(p.id)}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#FF6500] bg-orange-50/50 shadow-xs ring-2 ring-orange-500/20'
                        : 'border-[#DFE3E8] hover:border-slate-300'
                    }`}
                  >
                    <img
                      src={p.imageUrls[0]}
                      alt={p.name}
                      className="w-12 h-12 rounded-xl object-cover border border-[#DFE3E8] shrink-0"
                    />
                    <div className="truncate flex-1">
                      <div className="text-xs font-bold text-[#002244] truncate">{p.name}</div>
                      <div className="text-[11px] text-[#637381] flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-bold text-[#FF6500]">{p.price} DZD</span>
                        <span>•</span>
                        <span>Stock: {p.stockQuantity}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Mandatory Carrier Selection */}
          <div className="space-y-3 pt-4 border-t border-[#DFE3E8]">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#002244] uppercase tracking-wider">
                2. Société de livraison obligatoire
              </label>
              <span className="text-[11px] font-bold text-[#FF6500] bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                Requis
              </span>
            </div>
            <p className="text-xs text-[#637381]">
              Associez la société de livraison qui acheminera par défaut les colis commandés depuis cette landing page.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {carriers.map((c) => {
                const isSelected = wizardCarrierId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setWizardCarrierId(c.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#FF6500] bg-orange-50/50 shadow-xs ring-2 ring-orange-500/20'
                        : 'border-[#DFE3E8] bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Truck className={`w-4 h-4 ${isSelected ? 'text-[#FF6500]' : 'text-[#637381]'}`} />
                      <span className="text-xs font-extrabold text-[#002244]">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.status === 'connected'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-[#637381]'
                        }`}
                      >
                        {c.status === 'connected' ? '● Connecté API' : 'Traitement Manuel'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {wizardCarrierId === 'guepex' && (
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2 mt-3">
                <label className="block text-xs font-extrabold text-indigo-950">
                  Niveau de service Guepex pour les commandes de cette Landing Page :
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setWizardGuepexServiceType('economique')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      wizardGuepexServiceType === 'economique'
                        ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20'
                        : 'border-indigo-200 bg-white hover:border-emerald-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-[#002244]">
                      🌱 Économique (48h)
                    </div>
                    <div className="text-[10px] font-mono text-emerald-700 mt-0.5">
                      API Guepex : delivery_type = &quot;eco&quot;
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardGuepexServiceType('express')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      wizardGuepexServiceType === 'express'
                        ? 'border-[#FF6500] bg-orange-50 ring-2 ring-orange-500/20'
                        : 'border-indigo-200 bg-white hover:border-orange-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-[#002244]">
                      ⚡ Express (24h)
                    </div>
                    <div className="text-[10px] font-mono text-[#FF6500] mt-0.5">
                      API Guepex : delivery_type = &quot;express&quot;
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AI Mode Specific Controls */}
          {creationMode === 'ai' ? (
            <div className="space-y-6 pt-4 border-t border-[#DFE3E8]">
              <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-200 text-xs text-[#002244] flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[#FF6500] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">Générateur Assisté par IA conforme au catalogue réel</div>
                  <p className="text-[#637381] leading-relaxed">
                    L'IA va composer automatiquement 9 sections complètes (Bandeau promo, Hero, Bénéfices, Fiche technique, Galerie, Avis vérifiés, FAQ, Formulaire COD et Garanties) en s'appuyant rigoureusement sur les informations réelles de <strong>{selectedProd?.name}</strong>.
                  </p>
                </div>
              </div>

              {/* Goal & Audience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#002244] mb-1.5">
                    Objectif Commercial
                  </label>
                  <select
                    value={wizardGoal}
                    onChange={(e) => setWizardGoal(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFE3E8] text-xs font-semibold bg-white cursor-pointer"
                  >
                    <option value="direct_sale">Vente directe express (Meilleur taux COD)</option>
                    <option value="flash_sale">Vente Flash / Promo déstockage</option>
                    <option value="product_launch">Lancement exclusif 2026</option>
                    <option value="bundle_promo">Offre pack promo (Ex: 2 achetés)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#002244] mb-1.5">
                    Public Cible en Algérie
                  </label>
                  <select
                    value={wizardAudience}
                    onChange={(e) => setWizardAudience(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFE3E8] text-xs font-semibold bg-white cursor-pointer"
                  >
                    <option value="general_algeria">Grand public algérien (Tous profils)</option>
                    <option value="tech_enthusiasts">Passionnés de Tech & Gadgets</option>
                    <option value="family_home">Familles & Foyer</option>
                    <option value="professionals">Professionnels & Cadres</option>
                  </select>
                </div>
              </div>

              {/* Language & Tone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#002244] mb-1.5">
                    Langue Principale
                  </label>
                  <select
                    value={wizardLanguage}
                    onChange={(e) => setWizardLanguage(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFE3E8] text-xs font-semibold bg-white cursor-pointer"
                  >
                    <option value="fr">Français (Recommandé commerce Algérie)</option>
                    <option value="ar">العربية (Arabe standard)</option>
                    <option value="darija">Darija algérien adapté</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#002244] mb-1.5">
                    Ton Commercial
                  </label>
                  <select
                    value={wizardTone}
                    onChange={(e) => setWizardTone(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFE3E8] text-xs font-semibold bg-white cursor-pointer"
                  >
                    <option value="punchy">Dynamique & Percutant (Convaincant)</option>
                    <option value="luxury">Luxe & Épuré (Haut de gamme)</option>
                    <option value="urgent">Urgent & Direct (Pression temporelle)</option>
                    <option value="friendly">Chaleureux & Rassurant</option>
                  </select>
                </div>
              </div>

              {/* Custom commercial offer */}
              <div>
                <label className="block text-xs font-bold text-[#002244] mb-1.5">
                  Offre Commerciale Spécifique (Optionnel)
                </label>
                <input
                  type="text"
                  value={wizardOffer}
                  onChange={(e) => setWizardOffer(e.target.value)}
                  placeholder="Ex : Remise de 1000 DZD + 2ème accessoire offert pour les 50 premiers !"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFE3E8] text-xs font-semibold focus:outline-hidden focus:border-[#FF6500]"
                />
              </div>

              {/* Action Button */}
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-5 py-3 rounded-xl border border-[#DFE3E8] text-xs font-bold text-[#637381] hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleGenerateSmartPage}
                  className="px-6 py-3 rounded-xl bg-[#FF6500] hover:bg-[#e05900] disabled:bg-slate-300 text-white text-xs font-extrabold shadow-lg shadow-orange-500/20 inline-flex items-center gap-2 cursor-pointer transition-all"
                >
                  {isGenerating ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      <span>Génération en cours...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Générer la Landing Page</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Manual Mode */
            <div className="space-y-4 pt-4 border-t border-[#DFE3E8]">
              <p className="text-xs text-[#637381]">
                Créez une structure de page vierge basée sur le produit sélectionné, puis personnalisez librement chaque section dans l'éditeur visuel.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-5 py-3 rounded-xl border border-[#DFE3E8] text-xs font-bold text-[#637381] hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCreateManualPage}
                  className="px-6 py-3 rounded-xl bg-[#002244] hover:bg-[#00172E] text-white text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-2"
                >
                  <span>Créer et Ouvrir l'Éditeur</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: FULL VISUAL BUILDER & EDITOR
  // ==========================================
  if (view === 'edit' && editorPage) {
    const product = products.find((p) => p.id === editorPage.productId) || products[0];

    // Helper functions to mutate sections
    const updateSectionData = (sectionId: string, newData: any) => {
      setEditorPage((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, data: { ...s.data, ...newData } } : s)),
        };
      });
    };

    const updateSectionTitle = (sectionId: string, title: string, subtitle?: string) => {
      setEditorPage((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId ? { ...s, title, ...(subtitle !== undefined ? { subtitle } : {}) } : s
          ),
        };
      });
    };

    const toggleSectionEnabled = (sectionId: string) => {
      setEditorPage((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, enabled: !s.enabled } : s)),
        };
      });
    };

    const moveSection = (index: number, direction: 'up' | 'down') => {
      setEditorPage((prev) => {
        if (!prev) return null;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= prev.sections.length) return prev;
        const newSections = [...prev.sections];
        const temp = newSections[index];
        newSections[index] = newSections[targetIndex];
        newSections[targetIndex] = temp;
        return { ...prev, sections: newSections };
      });
    };

    const deleteSection = (sectionId: string) => {
      setEditorPage((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          sections: prev.sections.filter((s) => s.id !== sectionId),
        };
      });
    };

    const duplicateSection = (section: LandingPageSection) => {
      setEditorPage((prev) => {
        if (!prev) return null;
        const copy: LandingPageSection = {
          ...section,
          id: `sec-${Date.now()}`,
          title: `${section.title || 'Section'} (Copie)`,
        };
        return {
          ...prev,
          sections: [...prev.sections, copy],
        };
      });
    };

    const addSectionOfType = (type: LandingPageSection['type']) => {
      const newSec: LandingPageSection = {
        id: `sec-${Date.now()}`,
        type,
        enabled: true,
        title: `Nouvelle section ${type}`,
        data: {},
      };
      setEditorPage((prev) => (prev ? { ...prev, sections: [...prev.sections, newSec] } : null));
    };

    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Top Action Bar */}
        <div className="bg-white p-4 rounded-3xl border border-[#DFE3E8] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 sticky top-2 z-30">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setView('list')}
              className="p-2 rounded-xl border border-[#DFE3E8] hover:bg-slate-50 text-xs font-bold text-[#637381] cursor-pointer"
            >
              ← Retour
            </button>
            <div className="truncate">
              <input
                type="text"
                value={editorPage.title}
                onChange={(e) => setEditorPage({ ...editorPage, title: e.target.value })}
                className="text-base sm:text-lg font-extrabold text-[#002244] bg-transparent border-b border-transparent hover:border-[#DFE3E8] focus:border-[#FF6500] focus:outline-hidden px-1"
              />
              <div className="text-[11px] text-[#637381] flex items-center gap-2 px-1">
                <span>Slug: /lp/{editorPage.slug}</span>
                <span>•</span>
                <span className="text-[#FF6500] font-bold">{product?.name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            {/* Status toggle */}
            <select
              value={editorPage.status}
              onChange={(e) => setEditorPage({ ...editorPage, status: e.target.value as any })}
              className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                editorPage.status === 'published'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <option value="draft">Brouillon</option>
              <option value="published">Publiée en ligne</option>
              <option value="archived">Archivée</option>
            </select>

            <button
              onClick={() => handleCopyLink(editorPage)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#DFE3E8] hover:border-[#FF6500] text-[#002244] hover:text-[#FF6500] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Copier le lien public"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedSlug === editorPage.slug ? 'Copié !' : 'Copier lien'}</span>
            </button>

            <button
              onClick={() => navigateTo(`/lp/${editorPage.slug}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#DFE3E8] hover:border-[#FF6500] text-[#002244] hover:text-[#FF6500] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Ouvrir la page en direct"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voir en direct</span>
            </button>

            <button
              onClick={() => {
                setSelectedPageId(editorPage.id);
                setView('preview');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#DFE3E8] hover:border-[#FF6500] text-[#002244] rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Aperçu</span>
            </button>

            <button
              onClick={handleSaveEditor}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF6500] hover:bg-[#e05900] text-white rounded-xl text-xs font-extrabold shadow-md shadow-orange-500/20 cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {editorErrorMsg && (
          <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{editorErrorMsg}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-[#DFE3E8] gap-4">
          <button
            onClick={() => setEditorActiveTab('sections')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer ${
              editorActiveTab === 'sections'
                ? 'border-[#FF6500] text-[#FF6500]'
                : 'border-transparent text-[#637381] hover:text-[#002244]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Sections & Blocs ({editorPage.sections.length})</span>
          </button>
          <button
            onClick={() => setEditorActiveTab('design')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer ${
              editorActiveTab === 'design'
                ? 'border-[#FF6500] text-[#FF6500]'
                : 'border-transparent text-[#637381] hover:text-[#002244]'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Style & Thème</span>
          </button>
          <button
            onClick={() => setEditorActiveTab('seo')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer ${
              editorActiveTab === 'seo'
                ? 'border-[#FF6500] text-[#FF6500]'
                : 'border-transparent text-[#637381] hover:text-[#002244]'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>SEO, Transporteur & Tracking</span>
          </button>
        </div>

        {/* TAB 1: SECTIONS */}
        {editorActiveTab === 'sections' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#637381] font-semibold">
                Glissez ou utilisez les flèches pour réorganiser l'ordre des blocs de la page.
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#637381]">Ajouter un bloc :</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addSectionOfType(e.target.value as any);
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl border border-[#DFE3E8] bg-white text-xs font-bold text-[#002244] cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>+ Choisir un bloc</option>
                  <option value="promo_banner">Bandeau Promo / Timer</option>
                  <option value="hero">Section Principale Hero</option>
                  <option value="benefits">Bénéfices & Avantages</option>
                  <option value="features">Fiche Caractéristiques</option>
                  <option value="gallery">Galerie Photos</option>
                  <option value="testimonials">Avis Clients Vérifiés</option>
                  <option value="faq">Questions Fréquentes (FAQ)</option>
                  <option value="order_form">Formulaire de Commande COD</option>
                  <option value="guarantee">Badges de Garantie</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {editorPage.sections.map((section, idx) => (
                <div
                  key={section.id}
                  className={`bg-white rounded-2xl border transition-all ${
                    section.enabled
                      ? 'border-[#DFE3E8] shadow-xs'
                      : 'border-dashed border-[#DFE3E8] opacity-60 bg-[#F4F6F8]/50'
                  }`}
                >
                  {/* Section Title Bar */}
                  <div className="p-4 flex items-center justify-between gap-3 border-b border-[#DFE3E8]/60 bg-[#F4F6F8]/40">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-[#002244] text-white text-[11px] font-mono flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-[#002244] uppercase tracking-wider font-mono">
                        {section.type}
                      </span>
                      {section.title && (
                        <span className="text-xs text-[#637381] font-semibold hidden sm:inline">
                          — {section.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveSection(idx, 'up')}
                        disabled={idx === 0}
                        title="Monter"
                        className="p-1.5 rounded-lg border border-[#DFE3E8] bg-white text-[#637381] disabled:opacity-30 hover:text-[#002244] cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveSection(idx, 'down')}
                        disabled={idx === editorPage.sections.length - 1}
                        title="Descendre"
                        className="p-1.5 rounded-lg border border-[#DFE3E8] bg-white text-[#637381] disabled:opacity-30 hover:text-[#002244] cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleSectionEnabled(section.id)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                          section.enabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {section.enabled ? 'Actif' : 'Masqué'}
                      </button>
                      <button
                        onClick={() => duplicateSection(section)}
                        title="Dupliquer"
                        className="p-1.5 rounded-lg border border-[#DFE3E8] bg-white text-[#637381] hover:text-[#002244] cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteSection(section.id)}
                        title="Supprimer"
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Section Content Fields */}
                  <div className="p-4 space-y-3">
                    {/* Common Title & Subtitle */}
                    {['hero', 'benefits', 'features', 'gallery', 'testimonials', 'faq', 'order_form'].includes(section.type) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#637381] mb-1">
                            Titre du bloc
                          </label>
                          <input
                            type="text"
                            value={section.title || ''}
                            onChange={(e) => updateSectionTitle(section.id, e.target.value, section.subtitle)}
                            className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-semibold focus:outline-hidden focus:border-[#FF6500]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#637381] mb-1">
                            Sous-titre / Description courte
                          </label>
                          <input
                            type="text"
                            value={section.subtitle || ''}
                            onChange={(e) => updateSectionTitle(section.id, section.title || '', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-semibold focus:outline-hidden focus:border-[#FF6500]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Promo Banner specific */}
                    {section.type === 'promo_banner' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-[#637381] mb-1">
                            Texte du bandeau
                          </label>
                          <input
                            type="text"
                            value={section.data?.text || ''}
                            onChange={(e) => updateSectionData(section.id, { text: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#637381] mb-1">
                            Couleur du fond
                          </label>
                          <input
                            type="text"
                            value={section.data?.bgColor || '#FF6500'}
                            onChange={(e) => updateSectionData(section.id, { bgColor: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* Hero specific */}
                    {section.type === 'hero' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#637381] mb-1">
                            Badge accroche (ex: VENTE FLASH)
                          </label>
                          <input
                            type="text"
                            value={section.data?.badge || ''}
                            onChange={(e) => updateSectionData(section.id, { badge: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#637381] mb-1">
                            Texte du bouton CTA
                          </label>
                          <input
                            type="text"
                            value={section.data?.ctaText || ''}
                            onChange={(e) => updateSectionData(section.id, { ctaText: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-semibold"
                          />
                        </div>
                      </div>
                    )}

                    {/* Order form specific */}
                    {section.type === 'order_form' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#637381] mb-1">
                            Avis d'urgence / Alerte stock
                          </label>
                          <input
                            type="text"
                            value={section.data?.urgentNotice || ''}
                            onChange={(e) => updateSectionData(section.id, { urgentNotice: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#637381] mb-1">
                            Libellé du bouton de confirmation
                          </label>
                          <input
                            type="text"
                            value={section.data?.buttonLabel || ''}
                            onChange={(e) => updateSectionData(section.id, { buttonLabel: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-semibold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: DESIGN & THEME */}
        {editorActiveTab === 'design' && (
          <div className="bg-white p-6 rounded-3xl border border-[#DFE3E8] shadow-xs space-y-6 max-w-2xl">
            <h3 className="font-extrabold text-sm text-[#002244]">Palette & Couleurs Commerciales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#637381] mb-1">
                  Couleur Principale (Fond / Titres sombres)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editorPage.themeColor || '#002244'}
                    onChange={(e) => setEditorPage({ ...editorPage, themeColor: e.target.value })}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-[#DFE3E8]"
                  />
                  <input
                    type="text"
                    value={editorPage.themeColor || '#002244'}
                    onChange={(e) => setEditorPage({ ...editorPage, themeColor: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#637381] mb-1">
                  Couleur d'Accentuation (Boutons CTA & Remises)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editorPage.accentColor || '#FF6500'}
                    onChange={(e) => setEditorPage({ ...editorPage, accentColor: e.target.value })}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-[#DFE3E8]"
                  />
                  <input
                    type="text"
                    value={editorPage.accentColor || '#FF6500'}
                    onChange={(e) => setEditorPage({ ...editorPage, accentColor: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#DFE3E8]">
              <span className="text-xs text-[#637381]">
                Astuce : DzMahall utilise par défaut l'orange dynamique <code className="text-[#FF6500] font-bold">#FF6500</code> et le bleu marine <code className="text-[#002244] font-bold">#002244</code> pour un contraste optimal sur mobile en plein soleil.
              </span>
            </div>
          </div>
        )}

        {/* TAB 3: SEO, TRANSPORTEUR & TRACKING */}
        {editorActiveTab === 'seo' && (
          <div className="bg-white p-6 rounded-3xl border border-[#DFE3E8] shadow-xs space-y-6 max-w-2xl">
            <div>
              <h3 className="font-extrabold text-sm text-[#002244]">Société de Livraison & Expédition</h3>
              <p className="text-xs text-[#637381] mt-0.5">
                Chaque commande issue de cette landing page sera automatiquement attribuée à ce transporteur.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#002244] uppercase tracking-wider">
                Société de livraison obligatoire :
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {carriers.map((c) => {
                  const isSelected = (editorPage.shippingCompanyId || 'yalidine') === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setEditorPage({
                          ...editorPage,
                          shippingCompanyId: c.id,
                          shippingCompanyNameSnapshot: c.name,
                        })
                      }
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#FF6500] bg-orange-50/50 shadow-xs ring-2 ring-orange-500/20'
                          : 'border-[#DFE3E8] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Truck className={`w-4 h-4 ${isSelected ? 'text-[#FF6500]' : 'text-[#637381]'}`} />
                        <span className="text-xs font-bold text-[#002244]">{c.name}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.status === 'connected'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-[#637381]'
                        }`}
                      >
                        {c.status === 'connected' ? '● Connecté API' : 'Traitement Manuel'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {editorPage.shippingCompanyId === 'guepex' && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2 mt-3">
                  <label className="block text-xs font-extrabold text-indigo-950">
                    Niveau de service Guepex pour les commandes issues de cette Landing Page :
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setEditorPage({
                          ...editorPage,
                          deliveryServiceType: 'economique',
                        })
                      }
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        editorPage.deliveryServiceType === 'economique'
                          ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20'
                          : 'border-indigo-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-[#002244]">
                        🌱 Économique (48h)
                      </div>
                      <div className="text-[10px] font-mono text-emerald-700 mt-0.5">
                        API Guepex : delivery_type = &quot;eco&quot;
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditorPage({
                          ...editorPage,
                          deliveryServiceType: 'express',
                        })
                      }
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        editorPage.deliveryServiceType === 'express'
                          ? 'border-[#FF6500] bg-orange-50 ring-2 ring-orange-500/20'
                          : 'border-indigo-200 bg-white hover:border-orange-300'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-[#002244]">
                        ⚡ Express (24h)
                      </div>
                      <div className="text-[10px] font-mono text-[#FF6500] mt-0.5">
                        API Guepex : delivery_type = &quot;express&quot;
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#DFE3E8] space-y-4">
              <h3 className="font-extrabold text-sm text-[#002244]">Référencement SEO & URL Publique</h3>

              {/* Slug with uniqueness validation */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#637381]">
                    Slug d'URL (identifiant unique de la page)
                  </label>
                  {(() => {
                    const cleanSlug = editorPage.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                    const isDup = landingPages.some(
                      (p) => p.id !== editorPage.id && p.slug.trim().toLowerCase() === cleanSlug
                    );
                    if (!cleanSlug) {
                      return <span className="text-[10px] font-bold text-red-600">Requis</span>;
                    }
                    if (isDup) {
                      return (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                          ⚠️ Slug déjà utilisé
                        </span>
                      );
                    }
                    return (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Slug unique & disponible
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-[#F4F6F8] border border-r-0 border-[#DFE3E8] rounded-l-xl text-xs text-[#637381] font-mono">
                    dzmahall.store/lp/
                  </span>
                  <input
                    type="text"
                    value={editorPage.slug}
                    onChange={(e) => setEditorPage({ ...editorPage, slug: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-r-xl border border-[#DFE3E8] text-xs font-mono font-bold focus:outline-hidden focus:border-[#FF6500]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#637381] mb-1">
                  Titre SEO (Meta Title)
                </label>
                <input
                  type="text"
                  value={editorPage.seoTitle || ''}
                  onChange={(e) => setEditorPage({ ...editorPage, seoTitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-semibold focus:outline-hidden focus:border-[#FF6500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#637381] mb-1">
                  Description SEO (Meta Description)
                </label>
                <textarea
                  rows={2}
                  value={editorPage.seoDescription || ''}
                  onChange={(e) => setEditorPage({ ...editorPage, seoDescription: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-semibold focus:outline-hidden focus:border-[#FF6500]"
                />
              </div>
            </div>

            {/* Meta Pixel Integration */}
            <div className="pt-4 border-t border-[#DFE3E8] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-[#002244]">Meta Pixel (Facebook Ads)</h3>
                  <p className="text-[11px] text-[#637381]">
                    Suivi des conversions d'achats et visites pour vos campagnes publicitaires Facebook & Instagram.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Optionnel
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#637381] mb-1">
                  Identifiant Pixel Meta (Pixel ID)
                </label>
                <input
                  type="text"
                  value={editorPage.pixelId || ''}
                  onChange={(e) => setEditorPage({ ...editorPage, pixelId: e.target.value.trim() })}
                  placeholder="Ex : 98402941839201"
                  className="w-full px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-mono font-bold focus:outline-hidden focus:border-[#FF6500]"
                />
              </div>
              <p className="text-[11px] text-[#637381] leading-relaxed">
                🔒 <strong>Garantie de confidentialité :</strong> Aucune donnée personnelle du client (nom, numéro de téléphone, commune) n'est transmise à Meta. Seuls les événements anonymes <code>PageView</code> et <code>Purchase</code> (valeur en DZD et référence produit) sont envoyés.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 4: LIVE PREVIEW WITH DEVICE TOGGLE
  // ==========================================
  if (view === 'preview') {
    const pageToPreview = editorPage || activePage;

    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Top Control Bar */}
        <div className="bg-white p-3 sm:p-4 rounded-3xl border border-[#DFE3E8] shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => (editorPage ? setView('edit') : setView('list'))}
              className="px-3 py-2 rounded-xl border border-[#DFE3E8] text-xs font-bold text-[#637381] hover:bg-slate-50 cursor-pointer"
            >
              ← Retour {editorPage ? 'à l\'Éditeur' : 'à la Liste'}
            </button>
            <div className="hidden sm:block">
              <span className="text-xs font-bold text-[#002244]">{pageToPreview.title}</span>
              <span className="text-[11px] text-[#637381] ml-2">(/lp/{pageToPreview.slug})</span>
            </div>
          </div>

          {/* Device Switcher */}
          <div className="flex items-center gap-1 bg-[#F4F6F8] p-1 rounded-xl">
            <button
              onClick={() => setPreviewDevice('desktop')}
              className={`p-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold ${
                previewDevice === 'desktop'
                  ? 'bg-white text-[#002244] shadow-2xs'
                  : 'text-[#637381] hover:text-[#002244]'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span className="hidden sm:inline">Ordinateur</span>
            </button>
            <button
              onClick={() => setPreviewDevice('mobile')}
              className={`p-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold ${
                previewDevice === 'mobile'
                  ? 'bg-white text-[#002244] shadow-2xs'
                  : 'text-[#637381] hover:text-[#002244]'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">Smartphone (375px)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {pageToPreview.status === 'published' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleCopyLink(pageToPreview)}
                  className="px-3 py-2 rounded-xl border border-[#DFE3E8] bg-white text-xs font-bold text-[#002244] hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Copier l'URL publique de la landing page"
                >
                  {copiedSlug === pageToPreview.slug ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Lien copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#637381]" />
                      <span>Copier lien</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo(`/lp/${pageToPreview.slug}`)}
                  className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700 hover:bg-blue-100 cursor-pointer flex items-center gap-1.5"
                  title="Ouvrir la landing page publique dans le navigateur"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Voir en direct</span>
                </button>
              </>
            ) : (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                Brouillon privé
              </span>
            )}

            <button
              onClick={() => handleOpenEdit(pageToPreview)}
              className="px-4 py-2 bg-[#FF6500] hover:bg-[#e05900] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Modifier la page
            </button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="bg-[#DFE3E8]/60 p-4 sm:p-8 rounded-3xl min-h-[600px] flex items-center justify-center overflow-x-auto">
          <div
            className={`transition-all duration-300 bg-white shadow-2xl rounded-3xl overflow-hidden border border-[#DFE3E8] ${
              previewDevice === 'mobile'
                ? 'w-[375px] min-h-[700px] border-8 border-slate-800 rounded-[40px]'
                : 'w-full max-w-5xl'
            }`}
          >
            <LandingPageView pageData={pageToPreview} isPreview={true} />
          </div>
        </div>
      </div>
    );
  }

  return null;
};
