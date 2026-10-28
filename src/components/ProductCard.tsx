import React from 'react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { resolveProductCategory } from '../data/initialCategories';
import { ShoppingBag, ShieldCheck, Zap, RefreshCw } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export const ProductCardSkeleton: React.FC = () => (
  <div
    className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden flex flex-col animate-pulse"
    aria-hidden="true"
  >
    <div className="aspect-4/3 w-full bg-slate-200/80" />
    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
      <div className="space-y-2">
        <div className="h-3 w-24 bg-slate-200 rounded-md" />
        <div className="h-4 w-4/5 bg-slate-200 rounded-md" />
        <div className="h-3 w-3/5 bg-slate-100 rounded-md" />
      </div>
      <div className="pt-2 border-t border-[#F4F6F8] space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-28 bg-slate-200 rounded-md" />
          <div className="h-3 w-14 bg-slate-100 rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-9 bg-slate-100 rounded-xl" />
          <div className="h-9 bg-orange-100/70 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

export const ProductCard: React.FC<ProductCardProps> = ({ product, priority = false }) => {
  const { navigateTo, setSelectedProductSlug, addToCart, categories } = useStore();
  const isOptimisticSaving = product._optimisticStatus === 'saving';

  const catInfo = resolveProductCategory(product, categories);
  const displayCategoryLabel = catInfo.isUncategorized
    ? catInfo.legacyLabel || catInfo.categoryName
    : catInfo.subcategoryName
      ? `${catInfo.categoryName} · ${catInfo.subcategoryName}`
      : catInfo.categoryName;

  const handleOpenDetail = () => {
    if (isOptimisticSaving) return;
    setSelectedProductSlug(product.slug);
    navigateTo(`/produit/${product.slug}`);
  };

  const handleQuickBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOptimisticSaving) return;
    addToCart(product, 1);
    navigateTo('/commande');
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOptimisticSaving) return;
    addToCart(product, 1);
  };

  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null;

  return (
    <div
      onClick={handleOpenDetail}
      className={`group relative bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden hover:border-[#DFE3E8] hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-200 flex flex-col ${
        isOptimisticSaving ? 'opacity-90 cursor-wait' : 'cursor-pointer'
      }`}
    >
      {/* Image Container with explicit 4:3 aspect ratio and fixed intrinsic dimensions to prevent CLS */}
      <div className="relative aspect-4/3 w-full bg-[#F4F6F8] overflow-hidden">
        <img
          src={product.imageUrls[0]}
          alt={product.name}
          width={640}
          height={480}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-300"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLElement).setAttribute(
              'src',
              'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80'
            );
          }}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {isOptimisticSaving && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-xs flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Enregistrement…</span>
            </span>
          )}
          {/* Urgence & Rareté (#D82C0D) */}
          {discountPercent && (
            <span className="bg-[#D82C0D] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs uppercase tracking-wide">
              -{discountPercent}%
            </span>
          )}
          {product.isFeatured && (
            <span className="bg-[#FF6500] text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs uppercase tracking-wide">
              Top Vente
            </span>
          )}
        </div>

        {/* Subtle COD guarantee pill overlay with 'Garanties & Confiance' green (#004C3F) */}
        <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] text-[#212B36] flex items-center justify-between border border-[#E2E8F0] shadow-xs">
          <span className="flex items-center gap-1 font-semibold text-[#004C3F]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#004C3F]" /> Paiement à la réception
          </span>
          <span className="text-[#FF6500] font-bold">58 Wilayas</span>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Category in muted lecture text */}
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[#637381] line-clamp-1">
            {displayCategoryLabel}
          </div>

          {/* Product Name in 'Lecture & Confort' (#212B36) */}
          <h3 className="text-sm sm:text-base font-bold text-[#212B36] group-hover:text-[#FF6500] transition-colors line-clamp-2 mt-1 font-['Plus_Jakarta_Sans']">
            {product.name}
          </h3>

          {/* Key Feature 1-line */}
          <p className="text-xs text-[#637381] line-clamp-1 mt-1">
            {product.features[0] || product.description}
          </p>
        </div>

        {/* Pricing & Stock */}
        <div className="pt-2 border-t border-[#F4F6F8]">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                {product.price.toLocaleString()} <span className="text-xs text-[#FF6500] font-bold">DZD</span>
              </span>
              {product.originalPrice && (
                <span className="text-xs text-[#919EAB] line-through tabular-nums">
                  {product.originalPrice.toLocaleString()} DZD
                </span>
              )}
            </div>

            <span className="text-[11px] text-[#004C3F] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#004C3F]" /> En stock
            </span>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-1">
            <button
              onClick={handleAddToCart}
              disabled={isOptimisticSaving}
              className="py-2 px-2.5 rounded-xl bg-[#F4F6F8] hover:bg-slate-200 disabled:opacity-50 text-[#212B36] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-[#DFE3E8] cursor-pointer"
              title="Ajouter au panier"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#FF6500]" />
              <span>Panier</span>
            </button>

            {/* Primary Action Button (#FF6500) */}
            <button
              onClick={handleQuickBuy}
              disabled={isOptimisticSaving}
              className="py-2 px-2.5 rounded-xl bg-[#FF6500] hover:bg-[#E55B00] active:bg-[#CC5100] disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-orange-500/20 cursor-pointer"
              title="Acheter directement avec paiement à la livraison"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Commander</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
