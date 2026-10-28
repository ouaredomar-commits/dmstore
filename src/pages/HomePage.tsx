import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { CategoryFilter } from '../components/CategoryFilter';
import { UNCATEGORIZED_ID, resolveProductCategory } from '../data/initialCategories';
import {
  Truck,
  ShieldCheck,
  PhoneCall,
  ArrowRight,
  MapPin,
  Clock,
  CreditCard,
  MessageCircle,
  Package,
  CheckCircle2,
  Star,
  Zap,
  ChevronDown,
} from 'lucide-react';

const HOME_PRODUCTS_PER_PAGE = 12;

export const HomePage: React.FC = () => {
  const {
    products,
    isCatalogLoading,
    isCatalogSyncing,
    catalogError,
    refreshCatalogFromServer,
    categories,
    wilayas,
    navigateTo,
    contactPhone,
    contactWhatsApp,
    setIsCardModalOpen,
    businessCardImageUrl,
    setSelectedProductSlug,
  } = useStore();

  const [selectedCalcWilaya, setSelectedCalcWilaya] = useState<string>('16'); // Alger by default
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState<number>(HOME_PRODUCTS_PER_PAGE);

  const activeCategories = useMemo(
    () =>
      categories
        .filter((c) => c.isActive !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [categories]
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive !== false),
    [products]
  );

  const hasUncategorizedProducts = useMemo(
    () =>
      activeProducts.some((p) => resolveProductCategory(p, categories).isUncategorized),
    [activeProducts, categories]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: activeProducts.length };
    activeProducts.forEach((p) => {
      const res = resolveProductCategory(p, categories);
      if (!res.isUncategorized && res.categoryId) {
        counts[res.categoryId] = (counts[res.categoryId] || 0) + 1;
      }
    });
    return counts;
  }, [activeProducts, categories]);

  useEffect(() => {
    setVisibleCount(HOME_PRODUCTS_PER_PAGE);
  }, [selectedCategory, selectedSubcategory]);

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    setSelectedSubcategory('all');
  };

  const filteredHomeProducts = useMemo(() => {
    return activeProducts.filter((product) => {
      const catInfo = resolveProductCategory(product, categories);

      if (selectedCategory !== 'all') {
        if (selectedCategory === UNCATEGORIZED_ID) {
          if (!catInfo.isUncategorized) return false;
        } else if (
          catInfo.categoryId !== selectedCategory &&
          catInfo.categorySlug !== selectedCategory
        ) {
          return false;
        }
      }

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

      return true;
    });
  }, [activeProducts, categories, selectedCategory, selectedSubcategory]);

  const displayedHomeProducts = filteredHomeProducts.slice(0, visibleCount);
  const hasMoreHomeProducts = visibleCount < filteredHomeProducts.length;
  const currentWilaya = wilayas.find((w) => w.code === selectedCalcWilaya) || wilayas[15];

  // Star product for Hero Spotlight
  const heroStarProduct = products.find((p) => p.isFeatured && p.isActive) || activeProducts[0] || products[0];

  const handleHeroProductClick = () => {
    if (heroStarProduct) {
      setSelectedProductSlug(heroStarProduct.slug);
      navigateTo(`/produit/${heroStarProduct.slug}`);
    }
  };

  return (
    <div className="space-y-16 sm:space-y-20 pb-20 bg-white">
      {/* =========================================================================
          1. Hero Section (Présentation & Offre Phare)
          ========================================================================= */}
      <section className="relative overflow-hidden pt-8 sm:pt-14 pb-14 border-b border-[#E2E8F0] bg-gradient-to-b from-[#F4F6F8]/90 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Headlines & Direct Action */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Highlight Kicker */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#004C3F] text-xs font-bold tracking-wide">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#004C3F]" />
                <span>LIVRAISON RAPIDE 58 WILAYAS · PAIEMENT COD GARANTI</span>
              </div>

              {/* Main Headline in 'Lecture & Confort' (#212B36) */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#212B36] tracking-tight leading-[1.12] font-['Plus_Jakarta_Sans']">
                La qualité premium,{' '}
                <span className="text-[#FF6500]">
                  livrée partout en Algérie.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-[#637381] max-w-2xl leading-relaxed">
                Commandez en toute sécurité sans carte bancaire : vous payez uniquement à la réception de votre colis.
                Montres connectées, audio haute fidélité et accessoires lifestyle vérifiés.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                {/* Primary Bouton d'Action (#FF6500) */}
                <button
                  onClick={() => navigateTo('/boutique')}
                  className="py-3.5 px-6 rounded-xl bg-[#FF6500] hover:bg-[#E55B00] active:bg-[#CC5100] text-white font-black text-sm transition-all shadow-lg shadow-orange-500/30 flex items-center gap-2 cursor-pointer"
                >
                  <span>Découvrir la Boutique</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* WhatsApp Action with 'Garanties & Confiance' green (#004C3F) */}
                <a
                  href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20souhaite%20passer%20commande.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3.5 px-5 rounded-xl bg-[#004C3F] hover:bg-[#00382E] text-white font-bold text-sm transition-colors shadow-xs flex items-center gap-2.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Commander sur WhatsApp</span>
                </a>
              </div>

              {/* Quick trust micro-indicators */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-[#637381]">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="w-4 h-4 text-[#004C3F]" />
                  <span className="text-[#212B36]">Paiement à la livraison (COD)</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <Truck className="w-4 h-4 text-[#FF6500]" />
                  <span className="text-[#212B36]">58 Wilayas desservies</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <PhoneCall className="w-4 h-4 text-[#004C3F]" />
                  <span className="text-[#212B36]">Support 7j/7</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Star Product Showcase Card */}
            {heroStarProduct && (
              <div className="lg:col-span-5">
                <div
                  onClick={handleHeroProductClick}
                  className="group relative bg-white border border-[#DFE3E8] hover:border-[#FF6500]/60 rounded-3xl p-6 sm:p-7 shadow-xl hover:shadow-2xl transition-all cursor-pointer"
                >
                  {/* Floating badge */}
                  <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-[#FF6500] border border-orange-200 text-xs font-bold">
                      <Zap className="w-3.5 h-3.5 fill-[#FF6500]" />
                      <span>OFFRE PHARE DU MOMENT</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      En Stock ({heroStarProduct.stockQuantity} ex.)
                    </span>
                  </div>

                  {/* Product visual & details */}
                  <div className="mt-4 space-y-4">
                    <div className="aspect-4/3 w-full rounded-2xl overflow-hidden bg-slate-100 relative">
                      <img
                        src={heroStarProduct.imageUrls[0]}
                        alt={heroStarProduct.name}
                        width={640}
                        height={480}
                        loading="eager"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {heroStarProduct.originalPrice && (
                        <div className="absolute top-3 left-3 bg-[#FF6500] text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-md">
                          -{Math.round(((heroStarProduct.originalPrice - heroStarProduct.price) / heroStarProduct.originalPrice) * 100)}% RÉDUCTION
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1 text-amber-500 mb-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        ))}
                        <span className="text-[11px] font-bold text-[#637381] ml-1">(4.9/5 · Avis Clients)</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-[#212B36] group-hover:text-[#FF6500] transition-colors font-['Plus_Jakarta_Sans'] line-clamp-1">
                        {heroStarProduct.name}
                      </h3>
                      <p className="text-xs text-[#637381] line-clamp-2 mt-1">
                        {heroStarProduct.description}
                      </p>
                    </div>

                    {/* Price and CTA */}
                    <div className="pt-2 flex items-center justify-between border-t border-[#E2E8F0]">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl sm:text-2xl font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                            {heroStarProduct.price.toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-[#FF6500]">DZD</span>
                          {heroStarProduct.originalPrice && (
                            <span className="text-xs text-[#919EAB] line-through">
                              {heroStarProduct.originalPrice.toLocaleString()} DZD
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-emerald-700 font-semibold block">
                          Paiement à la réception du colis
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHeroProductClick();
                        }}
                        className="py-2.5 px-4 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <span>Voir l'offre</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. Sélection Shopping & Accessoires (Catalogue & Filtrage par Catégorie)
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#FF6500]">
              Sélection Shopping & Accessoires
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#212B36] tracking-tight mt-1 font-['Plus_Jakarta_Sans']">
              Explorez Notre Catalogue ({filteredHomeProducts.length} article{filteredHomeProducts.length > 1 ? 's' : ''})
            </h2>
          </div>
          <button
            onClick={() => navigateTo('/boutique')}
            className="text-xs font-bold text-[#FF6500] hover:text-[#E55B00] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Ouvrir la boutique complète ({activeProducts.length} articles)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Barre de filtrage horizontale mobile-first des 15 catégories */}
        <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-4 sm:p-5">
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

        {/* Grille Produits ou État de Chargement (Skeleton) / Erreur / Vide */}
        {catalogError && filteredHomeProducts.length === 0 ? (
          <div className="bg-red-50/80 border border-red-200 rounded-2xl py-12 px-4 text-center space-y-3">
            <Package className="w-10 h-10 text-red-500 mx-auto" />
            <h3 className="text-base font-bold text-[#212B36]">
              Impossible de charger le catalogue officiel
            </h3>
            <p className="text-xs text-[#637381] max-w-md mx-auto">
              {catalogError}
            </p>
            <button
              type="button"
              onClick={() => void refreshCatalogFromServer()}
              className="mt-2 px-5 py-2.5 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Réessayer le chargement
            </button>
          </div>
        ) : isCatalogLoading && activeProducts.length === 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#637381] bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-4 py-2.5">
              <span className="font-semibold text-[#212B36] flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-[#FF6500] border-t-transparent rounded-full animate-spin inline-block" />
                Chargement du catalogue officiel DzMahall...
              </span>
              <span className="text-[11px]">Synchronisation serveur</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {Array.from({ length: 6 }).map((_, idx) => (
                <ProductCardSkeleton key={`home-skel-${idx}`} />
              ))}
            </div>
          </div>
        ) : filteredHomeProducts.length === 0 ? (
          <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl py-12 px-4 text-center space-y-3">
            <Package className="w-10 h-10 text-[#919EAB] mx-auto" />
            <h3 className="text-base font-bold text-[#212B36]">
              Aucun produit trouvé dans cette catégorie pour le moment
            </h3>
            <p className="text-xs text-[#637381] max-w-sm mx-auto">
              Sélectionnez une autre catégorie ou réinitialisez le filtre pour afficher tous les produits disponibles.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedSubcategory('all');
              }}
              className="mt-2 px-4 py-2 bg-white hover:bg-slate-100 text-[#212B36] text-xs font-bold rounded-xl transition-colors border border-[#DFE3E8] cursor-pointer"
            >
              Tous les produits
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
              {displayedHomeProducts.map((product, idx) => (
                <ProductCard key={product.id} product={product} priority={idx < 3} />
              ))}
            </div>

            {hasMoreHomeProducts && (
              <div className="flex flex-col items-center justify-center gap-3 pt-2">
                <p className="text-xs text-[#637381] font-medium">
                  Affichage de <strong className="text-[#212B36]">{displayedHomeProducts.length}</strong> sur{' '}
                  <strong className="text-[#212B36]">{filteredHomeProducts.length}</strong> produits
                </p>
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + HOME_PRODUCTS_PER_PAGE)}
                  className="px-6 py-3 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-black rounded-xl shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <span>Voir plus de produits</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* =========================================================================
          3. Piliers de Confiance & Simulateur Frais de Livraison
             (Positionnés après la Sélection Shopping & Accessoires comme demandé)
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* En-tête de section logistique */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#004C3F] bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block">
            ENGAGEMENTS & LOGISTIQUE EN ALGÉRIE
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#212B36] font-['Plus_Jakarta_Sans']">
            Livraison Rapide, Paiement Sécurisé & Support Dédié
          </h2>
          <p className="text-xs sm:text-sm text-[#637381]">
            Nous nous assurons que votre commande arrive entre vos mains en parfait état, avec les meilleurs tarifs de livraison dans les 58 wilayas.
          </p>
        </div>

        {/* Les 3 Piliers de Confiance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pilier 1: Paiement à la Livraison (COD) */}
          <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-6 space-y-3 hover:border-emerald-300 transition-colors shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#004C3F]">
              <ShieldCheck className="w-6 h-6 text-[#004C3F]" />
            </div>
            <h3 className="text-base font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">
              Paiement à la Livraison (COD)
            </h3>
            <p className="text-xs text-[#637381] leading-relaxed">
              Zéro risque : vous réglez en dinars algériens (DZD) uniquement après que le livreur vous a remis le colis en main propre. Vous vérifiez votre commande avant tout paiement.
            </p>
          </div>

          {/* Pilier 2: Couverture 58 Wilayas */}
          <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-6 space-y-3 hover:border-orange-300 transition-colors shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-[#FF6500]">
              <Truck className="w-6 h-6 text-[#FF6500]" />
            </div>
            <h3 className="text-base font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">
              Couverture 58 Wilayas
            </h3>
            <p className="text-xs text-[#637381] leading-relaxed">
              Expédition rapide par transporteurs reconnus (Yalidine, Guepex...) avec suivi en temps réel et option de retrait économique en bureau Stop Desk ou à domicile.
            </p>
          </div>

          {/* Pilier 3: Support Client 7j/7 */}
          <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-6 space-y-3 hover:border-emerald-300 transition-colors shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#004C3F]">
              <PhoneCall className="w-6 h-6 text-[#004C3F]" />
            </div>
            <h3 className="text-base font-bold text-[#212B36] font-['Plus_Jakarta_Sans']">
              Support Client 7j/7
            </h3>
            <p className="text-xs text-[#637381] leading-relaxed">
              Une équipe joignable en continu par appel et WhatsApp au <strong className="text-[#212B36]">{contactPhone}</strong> pour confirmer vos commandes et vous assister à tout moment.
            </p>
          </div>
        </div>

        {/* Simulateur Frais de Livraison (Interactif 58 Wilayas) */}
        <div className="bg-white border-2 border-[#DFE3E8] rounded-3xl p-6 sm:p-10 shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Explications à gauche */}
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-[#FF6500] border border-orange-200 text-xs font-bold">
                <Truck className="w-3.5 h-3.5" />
                <span>SIMULATEUR DE TARIFS</span>
              </div>
              <h3 className="text-2xl font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                Simulateur Frais de Livraison
              </h3>
              <p className="text-xs sm:text-sm text-[#637381] leading-relaxed">
                Consultez en direct les tarifs officiels de livraison vers votre wilaya pour une expédition à domicile ou en point relais Stop Desk.
              </p>
              <div className="pt-2 space-y-2 text-xs text-[#212B36] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Aucun frais caché, prix exact affiché</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Confirmation préalable par téléphone avant expédition</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Suivi de votre colis en direct sur notre plateforme</span>
                </div>
              </div>
            </div>

            {/* Boîte interactive à droite */}
            <div className="lg:col-span-7 bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-6 sm:p-7 space-y-5">
              {/* Wilaya Picker */}
              <div>
                <label className="block text-xs font-bold text-[#212B36] mb-1.5">
                  Sélectionnez votre Wilaya :
                </label>
                <select
                  value={selectedCalcWilaya}
                  onChange={(e) => setSelectedCalcWilaya(e.target.value)}
                  className="w-full bg-white border border-[#DFE3E8] rounded-xl px-4 py-3 text-xs sm:text-sm text-[#212B36] font-bold focus:outline-hidden focus:border-[#FF6500] cursor-pointer shadow-2xs"
                >
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.code} - {w.name} ({w.nameAr})
                    </option>
                  ))}
                </select>
              </div>

              {/* Delivery Comparison Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Domicile */}
                <div className="bg-white p-4 rounded-xl border border-[#DFE3E8] space-y-1.5 shadow-2xs">
                  <span className="text-[11px] uppercase font-bold text-[#637381] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FF6500]" /> Livraison à Domicile
                  </span>
                  <p className="text-2xl font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                    {currentWilaya.homeDeliveryFee} <span className="text-xs text-[#FF6500] font-bold">DZD</span>
                  </p>
                  <p className="text-[11px] text-[#637381] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#919EAB]" /> Délai estimé : {currentWilaya.estimatedDeliveryHours}
                  </p>
                </div>

                {/* Stop Desk */}
                <div className="bg-white p-4 rounded-xl border border-[#DFE3E8] space-y-1.5 shadow-2xs">
                  <span className="text-[11px] uppercase font-bold text-[#637381] flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-[#004C3F]" /> Point Relais (Stop Desk)
                  </span>
                  <p className="text-2xl font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                    {currentWilaya.deskDeliveryFee} <span className="text-xs text-[#004C3F] font-bold">DZD</span>
                  </p>
                  <p className="text-[11px] text-[#637381] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#919EAB]" /> Retrait sous 24h à 48h
                  </p>
                </div>
              </div>

              {/* Communes preview */}
              <div className="text-[11px] text-[#637381] bg-white p-3 rounded-xl border border-[#DFE3E8]">
                <span className="font-bold text-[#212B36]">Communes desservies pour {currentWilaya.name} : </span>
                <span>{currentWilaya.communes.slice(0, 6).join(', ')}{currentWilaya.communes.length > 6 ? '...' : ''}</span>
              </div>

              {/* Action CTA */}
              <button
                onClick={() => navigateTo('/boutique')}
                className="w-full py-3 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-black rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-500/20"
              >
                <span>Commander un article pour {currentWilaya.name}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. Carte de Visite & Identité Officielle DzMahall
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-3xl p-8 sm:p-12 relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#DFE3E8] text-[#004C3F] text-xs font-bold">
                <CreditCard className="w-3.5 h-3.5 text-[#004C3F]" />
                <span>IDENTITÉ OFFICIELLE DZMAHALL</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#212B36] font-['Plus_Jakarta_Sans']">
                Boutique Officielle · Shopping & Accessoires Algérie
              </h2>
              <p className="text-sm text-[#637381] leading-relaxed max-w-xl">
                Retrouvez notre carte de visite officielle avec QR code interactif, nos coordonnées directes et l'ensemble de nos canaux sociaux vérifiés (Boutique, Instagram, Facebook et TikTok).
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => setIsCardModalOpen(true)}
                  className="py-3 px-5 rounded-xl bg-[#FF6500] hover:bg-[#E55B00] text-white font-extrabold text-xs transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Afficher la Carte de Visite Officielle</span>
                </button>
                <a
                  href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20vous%20contacte%20depuis%20le%20site.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-5 rounded-xl bg-[#004C3F] hover:bg-[#00382E] text-white font-bold text-xs transition-colors flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Contacter {contactPhone}</span>
                </a>
              </div>
            </div>

            <div className="md:col-span-4 flex justify-center">
              <div
                onClick={() => setIsCardModalOpen(true)}
                className="group relative cursor-pointer rounded-2xl overflow-hidden border-2 border-[#DFE3E8] hover:border-[#FF6500] shadow-xl transition-all hover:scale-103 bg-white p-2"
              >
                <img
                  src={businessCardImageUrl}
                  alt="Aperçu carte DzMahall"
                  className="max-h-64 object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-[#212B36]/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                  <span className="px-3 py-1.5 bg-[#FF6500] text-white font-bold text-xs rounded-lg shadow-sm">
                    Agrandir la carte
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
