import React from 'react';
import { useStore } from '../context/StoreContext';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    removeFromCart,
    updateCartQuantity,
    cartSubtotal,
    navigateTo,
  } = useStore();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md h-full bg-white border-l border-[#E2E8F0] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E2E8F0] bg-[#F4F6F8]">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#FF6500]" />
            <h2 className="text-base font-bold text-[#212B36]">Mon Panier</h2>
            <span className="text-xs text-[#637381]">({cart.length} article{cart.length > 1 ? 's' : ''})</span>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-1.5 rounded-lg text-[#637381] hover:text-[#212B36] hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-[#637381]">
              <div className="w-16 h-16 rounded-full bg-[#F4F6F8] flex items-center justify-center mb-3">
                <ShoppingBag className="w-8 h-8 text-[#919EAB]" />
              </div>
              <p className="text-sm font-bold text-[#212B36]">Votre panier est vide</p>
              <p className="text-xs text-[#637381] mt-1 max-w-xs">
                Découvrez nos accessoires premium avec livraison partout en Algérie.
              </p>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  navigateTo('/boutique');
                }}
                className="mt-6 px-5 py-2.5 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Explorer la boutique
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={`${item.product.id}-${item.variantId || 'default'}`}
                className="flex gap-4 p-3.5 bg-[#F4F6F8] rounded-xl border border-[#DFE3E8] items-center"
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-lg bg-white overflow-hidden shrink-0 border border-[#E2E8F0]">
                  <img
                    src={item.product.imageUrls[0]}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-[#212B36] line-clamp-1">{item.product.name}</h4>
                  {item.variantName && (
                    <p className="text-[11px] text-[#FF6500] font-semibold">{item.variantName}</p>
                  )}
                  <p className="text-xs font-black text-[#212B36] mt-1 tabular-nums font-['Plus_Jakarta_Sans']">
                    {(item.unitPrice * item.quantity).toLocaleString()} DZD
                  </p>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border border-[#DFE3E8] rounded-lg bg-white overflow-hidden">
                      <button
                        onClick={() =>
                          updateCartQuantity(item.product.id, item.quantity - 1, item.variantId)
                        }
                        className="p-1 text-[#637381] hover:text-[#212B36] hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-bold text-[#212B36] tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateCartQuantity(item.product.id, item.quantity + 1, item.variantId)
                        }
                        className="p-1 text-[#637381] hover:text-[#212B36] hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id, item.variantId)}
                      className="p-1 text-[#919EAB] hover:text-[#D82C0D] transition-colors ml-auto cursor-pointer"
                      title="Supprimer l'article"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-[#E2E8F0] bg-white space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#637381] font-medium">Sous-total articles :</span>
              <span className="font-black text-[#212B36] tabular-nums text-lg font-['Plus_Jakarta_Sans']">
                {cartSubtotal.toLocaleString()} DZD
              </span>
            </div>

            {/* Garanties & Confiance badge (#004C3F) */}
            <div className="flex items-center gap-2 text-[11px] text-[#004C3F] bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-[#004C3F] shrink-0" />
              <span className="font-medium">Paiement 100% à la livraison (COD) après inspection de votre colis.</span>
            </div>

            {/* Bouton d'Action CTA (#FF6500) */}
            <button
              onClick={() => {
                setIsCartOpen(false);
                navigateTo('/commande');
              }}
              className="w-full py-3.5 px-4 bg-[#FF6500] hover:bg-[#E55B00] active:bg-[#CC5100] text-white font-extrabold text-sm rounded-xl transition-all shadow-md shadow-orange-500/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Passer la commande (COD)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
