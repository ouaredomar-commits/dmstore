import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import {
  UNCATEGORIZED_ID,
  UNCATEGORIZED_LABEL,
  resolveProductCategory,
} from '../../data/initialCategories';
import { ProductFormModal } from './ProductFormModal';
import { ProductImportModal } from './ProductImportModal';
import { CategoryManagerModal } from './CategoryManagerModal';
import {
  exportProductsToCsv,
  exportProductsToXlsx,
  generateProductCsvTemplate,
  downloadFile,
} from '../../utils/importUtils';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Layers,
  Sparkles,
  Upload,
  Download,
  FileSpreadsheet,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Archive,
  X,
  FileText,
  FolderTree,
} from 'lucide-react';

export const AdminProducts: React.FC = () => {
  const {
    products,
    isCatalogLoading,
    isCatalogSyncing,
    pendingProductIds,
    catalogError,
    isFirebaseConnected,
    refreshCatalog,
    categories,
    orders,
    landingPages,
    addProduct,
    updateProduct,
    deleteProduct,
    importProductsBatch,
    syncLocalToCloud,
    navigateTo,
  } = useStore();

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'low_stock'>('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  // Modals & UI State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Notifications & Async status
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncLocalToCloud();
      showNotification('Synchronisation réussie ! Tous les produits sont en ligne.');
    } catch {
      showNotification('Erreur de synchronisation cloud.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsFormModalOpen(true);
  };

  const handleSaveProduct = (
    productData: Omit<Product, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    // Fermeture immédiate de la modale : le produit apparaît instantanément dans la liste avec l'état « Enregistrement… »
    setIsFormModalOpen(false);
    setEditingProduct(null);

    if (existingId) {
      void updateProduct(existingId, productData)
        .then(() => {
          showNotification(`Le produit « ${productData.name} » a été mis à jour avec succès.`);
        })
        .catch((err: any) => {
          const rawMsg = err?.message || 'Erreur réseau lors de la mise à jour';
          showNotification(
            `Échec de la mise à jour (${rawMsg}) : les modifications ont été annulées.`,
            'error'
          );
        });
    } else {
      void addProduct(productData)
        .then(() => {
          showNotification(`Le produit « ${productData.name} » a été enregistré dans le catalogue.`);
        })
        .catch((err: any) => {
          const rawMsg = err?.message || 'Erreur réseau lors de la sauvegarde';
          showNotification(
            `Échec de l'enregistrement (${rawMsg}) : l'entrée temporaire « ${productData.name} » a été retirée.`,
            'error'
          );
        });
    }
  };

  // Safe Deletion with historic order protection & Optimistic UI + Rollback notification
  const handleConfirmDelete = async (forcePermanent = false) => {
    if (!productToDelete || isDeleting) return;
    const targetId = productToDelete.id;
    const targetName = productToDelete.name;

    if (!forcePermanent) {
      setIsDeleting(true);
      try {
        await updateProduct(targetId, { isActive: false });
        showNotification(`Le produit « ${targetName} » a été désactivé (archivé).`);
      } catch (err: any) {
        showNotification(
          `Échec de la désactivation : ${err?.message || 'Erreur réseau'}`,
          'error'
        );
      } finally {
        setIsDeleting(false);
        setProductToDelete(null);
      }
      return;
    }

    // Suppression définitive optimiste : fermeture immédiate de la modale et retrait instantané de la liste
    setProductToDelete(null);
    try {
      const res = await deleteProduct(targetId);
      if (res.success) {
        showNotification(`Le produit « ${targetName} » a été définitivement supprimé.`);
      } else {
        showNotification(
          `Échec de la suppression (${res.error || 'Erreur réseau'}) : « ${targetName} » a été restauré.`,
          'error'
        );
      }
    } catch (err: any) {
      showNotification(
        `Erreur inattendue lors de la suppression : ${err?.message || 'Erreur inconnue'}`,
        'error'
      );
    }
  };

  const activeFilterCategoryObj = categories.find((c) => c.id === selectedCategory);

  // Filtered products list
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const catInfo = resolveProductCategory(p, categories);

      // Search
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        catInfo.categoryName.toLowerCase().includes(q) ||
        catInfo.subcategoryName.toLowerCase().includes(q) ||
        (p.categoryLabel && p.categoryLabel.toLowerCase().includes(q));

      // Category & Subcategory
      let matchesCategory = true;
      if (selectedCategory !== 'all') {
        if (selectedCategory === UNCATEGORIZED_ID) {
          matchesCategory = catInfo.isUncategorized;
        } else {
          matchesCategory = catInfo.categoryId === selectedCategory;
        }
      }

      let matchesSubcategory = true;
      if (selectedCategory !== 'all' && selectedCategory !== UNCATEGORIZED_ID && selectedSubcategory !== 'all') {
        matchesSubcategory =
          catInfo.subcategoryId === selectedSubcategory ||
          catInfo.subcategoryName === selectedSubcategory;
      }

      // Status
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = p.isActive;
      else if (statusFilter === 'inactive') matchesStatus = !p.isActive;
      else if (statusFilter === 'low_stock') matchesStatus = p.stockQuantity <= 15;

      return matchesSearch && matchesCategory && matchesSubcategory && matchesStatus;
    });
  }, [products, categories, search, selectedCategory, selectedSubcategory, statusFilter]);

  // Pagination calculation
  const totalFiltered = filtered.length;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalFiltered / (pageSize as number)));

  // Ensure current page is valid when filter changes
  const validCurrentPage = Math.min(currentPage, totalPages);
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  const paginatedProducts = useMemo(() => {
    if (pageSize === 'all') return filtered;
    const startIndex = (validCurrentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, validCurrentPage, pageSize]);

  const startIndex = pageSize === 'all' ? 0 : (validCurrentPage - 1) * (pageSize as number);
  const endIndex = pageSize === 'all' ? totalFiltered : Math.min(startIndex + (pageSize as number), totalFiltered);

  // Historic orders linked to product targeted for deletion
  const linkedOrdersForTarget = productToDelete
    ? orders.filter((o) => o.items?.some((i) => i.productId === productToDelete.id))
    : [];

  const linkedLandingPagesForTarget = productToDelete
    ? landingPages.filter((lp) => lp.productId === productToDelete.id)
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-20 right-6 z-50 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs animate-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success' ? 'bg-[#212B36]' : 'bg-[#D82C0D]'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-white shrink-0" />
          )}
          <span className="font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Title & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#DFE3E8]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider">
              Catalogue & Gestion des Stocks
            </span>
            {isCatalogLoading || isCatalogSyncing || pendingProductIds.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                <RefreshCw className="w-2.5 h-2.5 text-amber-700 animate-spin" />
                {isCatalogLoading && products.length === 0
                  ? 'Chargement initial du catalogue officiel…'
                  : pendingProductIds.length > 0
                  ? `Synchronisation en cours (${pendingProductIds.length})…`
                  : 'Actualisation du catalogue…'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#004C3F] border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isFirebaseConnected
                  ? 'Serveur Officiel + Cloud Firestore Synchronisés'
                  : 'Catalogue Serveur Officiel Actif'}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-[#212B36] mt-0.5 font-['Plus_Jakarta_Sans']">
            Gestion des Produits (
            {isCatalogLoading && products.length === 0
              ? 'Chargement…'
              : `${products.length} enregistrés`}
            )
          </h1>
          <p className="text-xs text-[#637381] mt-0.5">
            Ajoutez, modifiez, importez en masse par fichier (CSV, XLSX, JSON) ou exportez votre catalogue complet.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Menu Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="py-2.5 px-3 bg-[#F4F6F8] hover:bg-slate-200 border border-[#DFE3E8] text-[#212B36] font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-[#212B36]" />
              <span>Exporter</span>
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-[#DFE3E8] rounded-2xl shadow-xl z-30 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    exportProductsToCsv(products);
                    setIsExportMenuOpen(false);
                    showNotification(`Exportation CSV de ${products.length} produit(s) lancée.`);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#212B36] hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#FF6500]" />
                  <span>Exporter tout en CSV ({products.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportProductsToXlsx(products);
                    setIsExportMenuOpen(false);
                    showNotification(`Exportation Excel de ${products.length} produit(s) lancée.`);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#212B36] hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Exporter tout en Excel XLSX</span>
                </button>
                {filtered.length !== products.length && (
                  <button
                    type="button"
                    onClick={() => {
                      exportProductsToCsv(filtered);
                      setIsExportMenuOpen(false);
                      showNotification(`Exportation CSV des ${filtered.length} produit(s) filtrés lancée.`);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#212B36] hover:bg-slate-100 flex items-center gap-2 cursor-pointer border-t border-[#DFE3E8]"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>Exporter la sélection ({filtered.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const csv = generateProductCsvTemplate();
                    downloadFile(csv, 'modele_import_produits_dzmahall.csv', 'text/csv;charset=utf-8;');
                    setIsExportMenuOpen(false);
                    showNotification('Modèle CSV d\'importation téléchargé.');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer border-t border-[#DFE3E8]"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Télécharger le modèle CSV</span>
                </button>
              </div>
            )}
          </div>

          {/* Sync Button */}
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="py-2.5 px-3 bg-[#F4F6F8] hover:bg-slate-200 border border-[#DFE3E8] text-[#212B36] font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 shadow-2xs"
            title="Envoyer tous les produits locaux vers la base Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#004C3F] ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Synchronisation...' : 'Synchroniser Cloud'}</span>
          </button>

          {/* Categories Manager Button */}
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="py-2.5 px-3.5 bg-[#F4F6F8] hover:bg-slate-200 border border-[#DFE3E8] text-[#212B36] font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
            title="Ajouter, renommer, réorganiser ou désactiver des catégories et sous-catégories"
          >
            <FolderTree className="w-4 h-4 text-[#FF6500]" />
            <span>Catégories ({categories.length})</span>
          </button>

          {/* Bulk Import Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            title="Importer des produits par lot depuis CSV, Excel XLSX, JSON ou XML"
          >
            <Upload className="w-4 h-4" />
            <span>Importer des produits</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={handleOpenAddModal}
            className="py-2.5 px-4 bg-[#FF6500] hover:bg-[#E55B00] active:bg-[#CC5100] text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-orange-500/20 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Produit</span>
          </button>
        </div>
      </div>

      {/* Filters, Search & View Controls */}
      <div className="bg-white border border-[#DFE3E8] rounded-3xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#919EAB] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par nom, référence SKU..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#637381] hover:text-[#212B36] cursor-pointer"
              >
                Effacer
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedSubcategory('all');
                setCurrentPage(1);
              }}
              className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-xs text-[#212B36] font-semibold focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
            >
              <option value="all">Toutes les catégories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                  {!cat.isActive ? ' (Inactive)' : ''}
                </option>
              ))}
              <option value={UNCATEGORIZED_ID}>{UNCATEGORIZED_LABEL}</option>
            </select>

            {/* Subcategory Filter (when a main category is selected) */}
            {activeFilterCategoryObj && activeFilterCategoryObj.subcategories.length > 0 && (
              <select
                value={selectedSubcategory}
                onChange={(e) => {
                  setSelectedSubcategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-xs text-[#212B36] font-semibold focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
              >
                <option value="all">Toutes les sous-catégories</option>
                {activeFilterCategoryObj.subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-xs text-[#212B36] font-semibold focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs uniquement</option>
              <option value="inactive">Désactivés uniquement</option>
              <option value="low_stock">Stock faible (≤ 15)</option>
            </select>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#DFE3E8]">
              <span className="text-[11px] text-[#637381] font-semibold hidden sm:inline">Lignes/page :</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value;
                  setPageSize(val === 'all' ? 'all' : Number(val));
                  setCurrentPage(1);
                }}
                className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-2 py-2 text-xs text-[#212B36] font-semibold focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="all">Tous</option>
              </select>
            </div>
          </div>
        </div>

        {/* Counter Bar */}
        <div className="flex items-center justify-between text-xs text-[#637381] pt-2 border-t border-[#F4F6F8]">
          <div>
            Affichage de <strong className="text-[#212B36]">{totalFiltered > 0 ? startIndex + 1 : 0}</strong> à{' '}
            <strong className="text-[#212B36]">{endIndex}</strong> sur{' '}
            <strong className="text-[#212B36]">{totalFiltered}</strong> produit(s) filtré(s){' '}
            <span className="text-[#919EAB]">({products.length} enregistrés au total)</span>
          </div>

          {search || selectedCategory !== 'all' || selectedSubcategory !== 'all' || statusFilter !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('all');
                setSelectedSubcategory('all');
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className="text-[#FF6500] font-bold hover:underline cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          ) : null}
        </div>
      </div>

      {/* Error Banner with Retry if initial catalog fetch failed */}
      {catalogError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#D82C0D] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[#212B36]">
                Erreur de synchronisation avec le catalogue officiel
              </p>
              <p className="text-xs text-[#637381] mt-0.5">{catalogError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refreshCatalog()}
            className="px-3.5 py-2 bg-[#D82C0D] hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCatalogSyncing ? 'animate-spin' : ''}`} />
            <span>Réessayer</span>
          </button>
        </div>
      )}

      {/* Initial Fetch Loading Banner */}
      {isCatalogLoading && products.length === 0 && (
        <div className="bg-white border border-[#DFE3E8] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xs">
          <RefreshCw className="w-4 h-4 text-[#FF6500] animate-spin shrink-0" />
          <span className="text-xs font-semibold text-[#212B36]">
            Récupération du catalogue officiel en cours… Veuillez patienter.
          </span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#DFE3E8] rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F4F6F8] text-[#637381] uppercase tracking-wider font-bold border-b border-[#DFE3E8]">
                <th className="py-3.5 px-4">Produit & Galerie</th>
                <th className="py-3.5 px-4">Catégorie</th>
                <th className="py-3.5 px-4">Prix de Vente</th>
                <th className="py-3.5 px-4">Coût d'Achat</th>
                <th className="py-3.5 px-4">Marge Brute</th>
                <th className="py-3.5 px-4">Stock & Déclinaisons</th>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE3E8]">
              {isCatalogLoading && products.length === 0 ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`admin-skel-${idx}`} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0" />
                        <div className="space-y-2">
                          <div className="h-3.5 w-40 bg-slate-200 rounded-md" />
                          <div className="h-2.5 w-24 bg-slate-100 rounded-md" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 w-28 bg-slate-200 rounded-md" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-20 bg-slate-200 rounded-md" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 w-16 bg-slate-100 rounded-md" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 w-16 bg-emerald-100 rounded-md" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 w-12 bg-slate-200 rounded-md" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-14 bg-slate-100 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-7 w-24 bg-slate-100 rounded-lg ml-auto" />
                    </td>
                  </tr>
                ))
              ) : catalogError && products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#637381]">
                    <p className="font-bold text-[#D82C0D]">Catalogue temporairement indisponible</p>
                    <p className="text-xs mt-1">{catalogError}</p>
                    <button
                      type="button"
                      onClick={() => void refreshCatalog()}
                      className="mt-3 px-4 py-2 bg-[#212B36] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCatalogSyncing ? 'animate-spin' : ''}`} />
                      <span>Réessayer maintenant</span>
                    </button>
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#637381]">
                    <p className="font-bold text-[#212B36]">Aucun produit trouvé</p>
                    <p className="text-xs mt-1">Modifiez vos critères de recherche ou ajoutez un nouveau produit.</p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product, rowIdx) => {
                  const margin = product.price - (product.purchaseCost || 0);
                  const isLowStock = product.stockQuantity <= 15;
                  const hasDiscount = !!(product.originalPrice && product.originalPrice > product.price);
                  const discountPct = hasDiscount
                    ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)
                    : 0;

                  const imageCount = product.imageUrls?.length || 1;
                  const variantCount = product.variants?.length || 1;
                  const isOptimisticSaving =
                    product._optimisticStatus === 'saving' ||
                    pendingProductIds.includes(product.id);

                  return (
                    <tr
                      key={product._tempId || product.id}
                      className={`hover:bg-[#F4F6F8]/60 transition-colors ${
                        isOptimisticSaving ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Produit & Visuel */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-xl bg-[#F4F6F8] overflow-hidden shrink-0 border border-[#DFE3E8]">
                            <img
                              src={product.imageUrls[0]}
                              alt={product.name}
                              width={48}
                              height={48}
                              loading={rowIdx < 6 ? 'eager' : 'lazy'}
                              decoding="async"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {imageCount > 1 && (
                              <span className="absolute bottom-0 right-0 bg-[#212B36]/80 text-white text-[9px] font-mono px-1 rounded-tl-md">
                                +{imageCount - 1}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-[#212B36] line-clamp-1">{product.name}</p>
                              {isOptimisticSaving && (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-700" />
                                  Enregistrement…
                                </span>
                              )}
                              {product.isFeatured && (
                                <span className="bg-orange-100 text-[#FF6500] text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase shrink-0">
                                  Top
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-[#637381] font-mono">
                                SKU : {product.sku}
                              </span>
                              {variantCount > 1 && (
                                <span className="text-[10px] text-[#FF6500] font-semibold flex items-center gap-0.5">
                                  <Layers className="w-2.5 h-2.5" /> {variantCount} var.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Catégorie & Sous-catégorie */}
                      <td className="py-3.5 px-4">
                        {(() => {
                          const catInfo = resolveProductCategory(product, categories);
                          if (catInfo.isUncategorized) {
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold w-fit">
                                  {UNCATEGORIZED_LABEL}
                                </span>
                                {catInfo.legacyLabel && (
                                  <span className="text-[10px] text-[#637381]">
                                    Ancien libellé : {catInfo.legacyLabel}
                                  </span>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-[#212B36]">
                                {catInfo.categoryName}
                              </span>
                              {catInfo.subcategoryName && (
                                <span className="text-[11px] text-[#FF6500] font-medium">
                                  {catInfo.subcategoryName}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Prix de vente & réduction */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                              {product.price.toLocaleString()} DZD
                            </span>
                            {hasDiscount && (
                              <span className="bg-[#D82C0D] text-white text-[9px] font-black px-1 py-0.2 rounded-sm">
                                -{discountPct}%
                              </span>
                            )}
                          </div>
                          {hasDiscount && (
                            <span className="text-[10px] text-[#919EAB] line-through tabular-nums font-mono">
                              {product.originalPrice?.toLocaleString()} DZD
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Coût Achat */}
                      <td className="py-3.5 px-4 text-[#637381] tabular-nums font-mono">
                        {(product.purchaseCost || 0).toLocaleString()} DZD
                      </td>

                      {/* Marge Brute */}
                      <td className="py-3.5 px-4 font-bold text-[#004C3F] tabular-nums font-mono">
                        +{margin.toLocaleString()} DZD
                      </td>

                      {/* Stock Restant */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              isLowStock ? 'text-[#D82C0D]' : 'text-[#212B36]'
                            }`}
                          >
                            {product.stockQuantity} ex.
                          </span>
                          {isLowStock && (
                            <span title="Alerte stock faible (<= 15)">
                              <AlertTriangle className="w-3.5 h-3.5 text-[#D82C0D]" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Statut Toggle */}
                      <td className="py-3.5 px-4">
                        <button
                          disabled={isOptimisticSaving}
                          onClick={() =>
                            updateProduct(product.id, { isActive: !product.isActive })
                          }
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors cursor-pointer disabled:opacity-50 ${
                            product.isActive
                              ? 'bg-emerald-100 text-[#004C3F]'
                              : 'bg-slate-100 text-[#637381]'
                          }`}
                          title="Cliquer pour activer/désactiver le produit"
                        >
                          {product.isActive ? 'Actif' : 'Désactivé'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        <button
                          disabled={isOptimisticSaving}
                          onClick={() => navigateTo('/admin/landing-pages/new')}
                          className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 disabled:opacity-40 text-[#FF6500] transition-colors cursor-pointer border border-orange-200"
                          title="Générer une Landing Page pour ce produit"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={isOptimisticSaving}
                          onClick={() => handleOpenEditModal(product)}
                          className="p-1.5 rounded-lg bg-[#F4F6F8] hover:bg-slate-200 disabled:opacity-40 text-[#212B36] transition-colors cursor-pointer border border-[#DFE3E8]"
                          title="Modifier le produit complet"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={isOptimisticSaving}
                          onClick={() => setProductToDelete(product)}
                          className="p-1.5 rounded-lg bg-[#F4F6F8] hover:bg-red-50 disabled:opacity-40 text-[#919EAB] hover:text-[#D82C0D] transition-colors cursor-pointer border border-[#DFE3E8]"
                          title="Supprimer ou archiver ce produit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pageSize !== 'all' && totalPages > 1 && (
          <div className="p-4 bg-[#F4F6F8] border-t border-[#DFE3E8] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#637381]">
              Page <strong className="text-[#212B36]">{validCurrentPage}</strong> sur{' '}
              <strong className="text-[#212B36]">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={validCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-[#DFE3E8] bg-white text-xs font-bold text-[#212B36] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Précédent</span>
              </button>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - validCurrentPage) <= 1)
                .map((p, idx, arr) => (
                  <React.Fragment key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-1 text-xs text-[#919EAB]">...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`w-7 h-7 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        p === validCurrentPage
                          ? 'bg-[#FF6500] text-white shadow-2xs'
                          : 'bg-white text-[#212B36] border border-[#DFE3E8] hover:bg-slate-100'
                      }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}

              <button
                type="button"
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl border border-[#DFE3E8] bg-white text-xs font-bold text-[#212B36] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <span>Suivant</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation & Historic Protection Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white border border-[#DFE3E8] rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-[#D82C0D] flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                    Suppression de produit
                  </h3>
                  <p className="text-xs text-[#637381]">« {productToDelete.name} »</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="w-8 h-8 rounded-xl bg-[#F4F6F8] text-[#637381] hover:text-[#212B36] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Historic orders check */}
            {linkedOrdersForTarget.length > 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2 text-amber-950">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Préservation de l'historique des commandes :</span>
                </div>
                <p className="leading-relaxed">
                  Ce produit est rattaché à <strong>{linkedOrdersForTarget.length} commande(s) client(s)</strong> dans votre historique. Une suppression définitive rendrait ces commandes orphelines.
                </p>
                <p className="font-semibold text-amber-900">
                  Il est fortement recommandé de le <strong>désactiver (archiver)</strong> plutôt que de le supprimer définitivement.
                </p>
              </div>
            ) : linkedLandingPagesForTarget.length > 0 ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs space-y-1 text-blue-950">
                <strong className="block font-bold">Landing Page(s) active(s) :</strong>
                <span>Ce produit est associé à {linkedLandingPagesForTarget.length} landing page(s) commerciale(s).</span>
              </div>
            ) : (
              <p className="text-xs text-[#637381] leading-relaxed">
                Êtes-vous sûr de vouloir supprimer définitivement ce produit du catalogue ? Cette action retirera la fiche du catalogue public.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#DFE3E8] bg-white text-xs font-bold text-[#637381] hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>

              {linkedOrdersForTarget.length > 0 ? (
                <>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleConfirmDelete(false)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Désactiver (Recommandé)</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleConfirmDelete(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Forcer suppression</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleConfirmDelete(true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? 'Suppression...' : 'Supprimer définitivement'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add & Edit Modal */}
      <ProductFormModal
        isOpen={isFormModalOpen}
        product={editingProduct}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveProduct}
      />

      {/* Multi-step Import Modal */}
      <ProductImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingProducts={products}
        onImportBatch={importProductsBatch}
        onSuccessNotification={(msg) => showNotification(msg)}
      />

      {/* Category & Subcategory Organization Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
      />
    </div>
  );
};
