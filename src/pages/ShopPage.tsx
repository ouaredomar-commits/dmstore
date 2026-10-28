import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { CategoryFilter } from '../components/CategoryFilter';
import {
  UNCATEGORIZED_ID,
  resolveProductCategory,
} from '../data/initialCategories';
import { Search, Package, ShieldCheck, ChevronDown } from 'lucide-react';

const PRODUCTS_PER_PAGE = 12;

export const ShopPage: React.FC = () => {
  const {
    products,
    isCatalogLoading,
    isCatalogSyncing,
    catalogError,
    refreshCatalogFromServer,
    categories,
    currentRoute,
  } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'price-asc' | 'price-desc'>('featured');
  const [visibleCount, setVisibleCount] = useState<number>(PRODUCTS_PER_PAGE);

  // Active categories ordered by `order`
  const activeCategories = useMemo(
    () =>
      categories
        .filter((c) => c.isActive !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [categories]
  );

  // Sync optional `?categorie=` URL query parameter
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get('categorie') || params.get('category');
    if (catParam) {
      const found = activeCategories.find(
        (c) => c.id === catParam || c.slug === catParam
      );
      if (found) {
        setSelectedCategory(found.id);
        setSelectedSubcategory('all');
      }
    }
  }, [currentRoute, activeCategories]);

  // Check if there are active products that resolve to 'uncategorized'
  const hasUncategorizedProducts = useMemo(
    () =>
      products.some(
        (p) => p.isActive !== false && resolveProductCategory(p, categories).isUncategorized
      ),
    [products, categories]
  );

  // Compute product count per category for badge indicators
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    products.forEach((p) => {
      if (p.isActive === false) return;
      counts.all += 1;
      const res = resolveProductCategory(p, categories);
      if (!res.isUncategorized && res.categoryId) {
        counts[res.categoryId] = (counts[res.categoryId] || 0) + 1;
      }
    });
    return counts;
  }, [products, categories]);

  // Reset pagination when filters or search change
  useEffect(() => {
    setVisibleCount(PRODUCTS_PER_PAGE);
  }, [selectedCategory, selectedSubcategory, searchQuery, sortBy]);

  // Reset subcategory when main category changes
  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    setSelectedSubcategory('all');
  };

  const filteredProducts = products
    .filter((product) => {
      if (product.isActive === false) return false;

      const catInfo = resolveProductCategory(product, categories);

      // Filter by Main Category
      if (selectedCategory !== 'all') {
        if (selectedCategory === UNCATEGORIZED_ID) {
          if (!catInfo.isUncategorized) return false;
        } else {
          if (
            catInfo.categoryId !== selectedCategory &&
            catInfo.categorySlug !== selectedCategory
          ) {
            return false;
          }
        }
      }

      // Filter by Subcategory
      if (
        selectedCategory !== 'all' &&
        selectedCategory !== UNCATEGORIZED_ID &&
        selectedSubcategory !== 'all'
      ) {
        if (
          catInfo.subcategoryId !== selectedSubcategory &&
          catInfo.subcategoryName !== selectedSubcategory
        ) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (product.name || '').toLowerCase().includes(q);
        const descMatch = (product.description || '').toLowerCase().includes(q);
        const featMatch = Array.isArray(product.features)
          ? product.features.some((f) => (f || '').toLowerCase().includes(q))
          : false;
        const catMatch =
          catInfo.categoryName.toLowerCase().includes(q) ||
          catInfo.categoryNameAr.toLowerCase().includes(q) ||
          catInfo.subcategoryName.toLowerCase().includes(q) ||
          (product.categoryLabel || '').toLowerCase().includes(q);
        return nameMatch || descMatch || featMatch || catMatch;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'newest') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      }
      const featDiff = (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      if (featDiff !== 0) return featDiff;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

  const displayedProducts = filteredProducts.slice(0, visibleCount);
  const hasMoreProducts = visibleCount < filteredProducts.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 bg-white">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#FF6500] uppercase tracking-widest">
          <span>DzMahall Store</span>
          <span>·</span>
          <span>Livraison 58 Wilayas</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h1 className="text-3xl sm:text-4xl font-black text-[#212B36] tracking-tight font-['Plus_Jakarta_Sans']">
            Catalogue Produits & Accessoires
          </h1>
          <span className="text-xs font-bold text-[#637381]">
            {filteredProducts.length} article{filteredProducts.length > 1 ? 's' : ''} trouvé{filteredProducts.length > 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[#637381] max-w-2xl">
          Sélection haut de gamme avec paiement à la livraison (COD). Tous nos articles sont vérifiés et garantis.
        </p>
      </div>

      {/* Filter and Search Bar with 'Bordures & Structure' (#F4F6F8) */}
      <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#919EAB] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par produit, catégorie, sous-catégorie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#DFE3E8] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-[#637381] font-medium hidden sm:inline">Trier par :</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-[#DFE3E8] rounded-xl px-3 py-2.5 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500] cursor-pointer font-medium"
            >
              <option value="featured">Populaires en priorité</option>
              <option value="newest">Plus récents d'abord</option>
              <option value="price-asc">Prix : croissant (DZD)</option>
              <option value="price-desc">Prix : décroissant (DZD)</option>
            </select>
          </div>
        </div>

        {/* Mobile-first Horizontal Scrollable Category & Subcategory Filter */}
        <CategoryFilter
          categories={activeCategories}
          selectedCategory={selectedCategory}
          selectedSubcategory={selectedSubcategory}
          onSelectCategory={handleSelectCategory}
          onSelectSubcategory={setSelectedSubcategory}
          hasUncategorizedProducts={hasUncategorizedProducts}
          categoryCounts={categoryCounts}
        />
      </div>

      {/* Products Grid */}
      {catalogError && filteredProducts.length === 0 ? (
        <div className="bg-red-50/80 border border-red-200 rounded-2xl py-16 px-4 text-center space-y-3">
          <Package className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="text-base font-bold text-[#212B36]">
            Impossible de charger le catalogue officiel
          </h3>
          <p className="text-xs text-[#637381] max-w-md mx-auto">
            {catalogError}
          </p>
          <button
            onClick={() => void refreshCatalogFromServer()}
            className="mt-2 px-5 py-2.5 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Réessayer le chargement
          </button>
        </div>
      ) : isCatalogLoading && products.length === 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#637381] bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-4 py-2.5">
            <span className="font-semibold text-[#212B36] flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-[#FF6500] border-t-transparent rounded-full animate-spin inline-block" />
              Synchronisation du catalogue officiel DzMahall...
            </span>
            <span className="text-[11px]">Récupération depuis le serveur</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {Array.from({ length: 6 }).map((_, idx) => (
              <ProductCardSkeleton key={`shop-skel-${idx}`} />
            ))}
          </div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl py-16 px-4 text-center space-y-3">
          <Package className="w-12 h-12 text-[#919EAB] mx-auto" />
          <h3 className="text-base font-bold text-[#212B36]">Aucun produit ne correspond à votre recherche</h3>
          <p className="text-xs text-[#637381] max-w-sm mx-auto">
            Essayez d'ajuster vos filtres de catégorie ou effectuez une recherche avec d'autres mots-clés.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedSubcategory('all');
              setSearchQuery('');
            }}
            className="mt-2 px-4 py-2 bg-white hover:bg-slate-100 text-[#212B36] text-xs font-bold rounded-xl transition-colors border border-[#DFE3E8] cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {isCatalogSyncing && (
            <div className="flex items-center justify-between text-[11px] text-[#004C3F] bg-emerald-50/70 border border-emerald-200 rounded-xl px-3.5 py-2">
              <span className="font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Aperçu instantané affiché · Vérification des dernières mises à jour du catalogue en cours…
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {displayedProducts.map((product, idx) => (
              <ProductCard key={product.id} product={product} priority={idx < 3} />
            ))}
          </div>

          {hasMoreProducts && (
            <div className="flex flex-col items-center justify-center gap-3 pt-2">
              <p className="text-xs text-[#637381] font-medium">
                Affichage de <strong className="text-[#212B36]">{displayedProducts.length}</strong> sur{' '}
                <strong className="text-[#212B36]">{filteredProducts.length}</strong> produits
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setVisibleCount((prev) => prev + PRODUCTS_PER_PAGE)}
                  className="px-6 py-3 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-black rounded-xl shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <span>Voir plus de produits</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {filteredProducts.length - visibleCount > PRODUCTS_PER_PAGE && (
                  <button
                    onClick={() => setVisibleCount(filteredProducts.length)}
                    className="px-4 py-3 bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] text-xs font-bold rounded-xl border border-[#DFE3E8] transition-colors cursor-pointer"
                  >
                    Tout afficher ({filteredProducts.length})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trust banner bottom with 'Garanties & Confiance' (#004C3F) */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#212B36]">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#004C3F] shrink-0" />
          <span>
            <strong className="text-[#004C3F]">Paiement sécurisé à la livraison (COD)</strong> : Aucun paiement préalable requis.
          </span>
        </div>
        <div className="text-[#FF6500] font-black">
          Expédition sous 24h ouvrées
        </div>
      </div>
    </div>
  );
};
