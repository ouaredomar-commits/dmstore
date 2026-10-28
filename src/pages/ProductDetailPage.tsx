import React, { useState, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { resolveProductCategory } from '../data/initialCategories';
import { normalizeAndValidateAlgerianPhone } from '../utils/orderSecurity';
import { PhoneOrderAlertBanner } from '../components/PhoneOrderAlertBanner';
import {
  ShieldCheck,
  Truck,
  MessageCircle,
  Check,
  Plus,
  Minus,
  ArrowLeft,
  Zap,
  ShoppingBag,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ProductDetailPageProps {
  slug: string;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ slug }) => {
  const {
    products,
    isCatalogLoading,
    catalogError,
    refreshCatalogFromServer,
    categories,
    wilayas,
    addToCart,
    submitSecureOrder,
    navigateTo,
    contactPhone,
    contactWhatsApp,
  } = useStore();

  const product = products.find((p) => p.slug === slug || p.id === slug);
  const catInfo = resolveProductCategory(product, categories);
  const displayCategoryLabel = catInfo.isUncategorized
    ? catInfo.legacyLabel || catInfo.categoryName
    : catInfo.subcategoryName
      ? `${catInfo.categoryName} · ${catInfo.subcategoryName}`
      : catInfo.categoryName;

  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product?.variants?.[0]?.id || ''
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedImage, setSelectedImage] = useState<string>(product?.imageUrls?.[0] || '');

  // Synchronisation lors du changement de produit
  React.useEffect(() => {
    if (product) {
      setSelectedImage(product.imageUrls[0] || '');
      if (product.variants && product.variants.length > 0) {
        setSelectedVariantId(product.variants[0].id);
      }
    }
  }, [product?.id, product?.slug]);

  // Direct express COD form embedded in PDP
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedWilaya, setSelectedWilaya] = useState('16'); // Alger
  const [commune, setCommune] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'home' | 'desk'>('home');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresChallenge, setRequiresChallenge] = useState(false);
  const [challengeConfirmed, setChallengeConfirmed] = useState(false);
  const [orderSuccessId, setOrderSuccessId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const formOpenedAtRef = useRef<number>(Date.now());
  const idempotencyKeyRef = useRef<string>(
    `pdp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  const currentWilaya = wilayas.find((w) => w.code === selectedWilaya) || wilayas[15];
  const shippingFee = deliveryMode === 'home' ? currentWilaya.homeDeliveryFee : currentWilaya.deskDeliveryFee;
  const currentVariant = product?.variants?.find((v) => v.id === selectedVariantId);
  const unitPrice = product
    ? currentVariant && currentVariant.priceModifier
      ? product.price + currentVariant.priceModifier
      : product.price
    : 0;
  const subtotal = unitPrice * quantity;
  const totalAmount = subtotal + shippingFee;

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-white">
        <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-3xl p-8 text-center space-y-4">
          {isCatalogLoading ? (
            <>
              <div className="w-8 h-8 border-3 border-[#FF6500] border-t-transparent rounded-full animate-spin mx-auto" />
              <h2 className="text-lg font-extrabold text-[#212B36]">
                Chargement de la fiche produit...
              </h2>
              <p className="text-xs text-[#637381]">
                Synchronisation avec le catalogue officiel DzMahall.
              </p>
            </>
          ) : catalogError ? (
            <>
              <ShoppingBag className="w-12 h-12 text-red-500 mx-auto" />
              <h2 className="text-lg font-extrabold text-[#212B36]">
                Impossible de charger ce produit
              </h2>
              <p className="text-xs text-[#637381] max-w-md mx-auto">{catalogError}</p>
              <button
                onClick={() => void refreshCatalogFromServer()}
                className="px-5 py-2.5 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Réessayer
              </button>
            </>
          ) : (
            <>
              <ShoppingBag className="w-12 h-12 text-[#919EAB] mx-auto" />
              <h2 className="text-lg font-extrabold text-[#212B36]">
                Produit introuvable ou retiré du catalogue
              </h2>
              <p className="text-xs text-[#637381] max-w-md mx-auto">
                Cet article n'est plus disponible dans le catalogue actuel de DzMahall.
              </p>
              <button
                onClick={() => navigateTo('/boutique')}
                className="px-5 py-2.5 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Découvrir le catalogue actuel
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedVariantId);
  };

  const handleDirectOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError('');

    if (!customerName.trim() || customerName.trim().length < 2) {
      setFormError('Veuillez indiquer votre nom et prénom complets.');
      return;
    }

    const phoneValidation = normalizeAndValidateAlgerianPhone(customerPhone);
    if (!phoneValidation.isValid) {
      setFormError(
        phoneValidation.errorMessage ||
          'Numéro invalide. Indiquez un numéro algérien valide (ex: 0550 12 34 56, 0660 76 93 86).'
      );
      return;
    }

    if (!commune.trim()) {
      setFormError('Veuillez choisir ou saisir votre commune.');
      return;
    }

    if (deliveryMode === 'home' && !deliveryAddress.trim()) {
      setFormError('Veuillez renseigner votre adresse de livraison à domicile.');
      return;
    }

    if (requiresChallenge && !challengeConfirmed) {
      setFormError('Veuillez cocher la case de confirmation ci-dessous pour finaliser votre commande.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formElapsedMs = Math.max(1500, Date.now() - formOpenedAtRef.current);
      const result = await submitSecureOrder({
        customerName: customerName.trim(),
        customerPhone: phoneValidation.normalized,
        wilayaCode: selectedWilaya,
        commune: commune.trim(),
        deliveryAddress: deliveryMode === 'home' ? deliveryAddress.trim() : undefined,
        deliveryMode,
        deskName: deliveryMode === 'desk' ? `Stop Desk ${currentWilaya.name}` : undefined,
        items: [
          {
            product,
            variantId: selectedVariantId,
            variantName: currentVariant?.name,
            quantity,
            unitPrice,
          },
        ],
        honeypot,
        formElapsedMs,
        idempotencyKey: idempotencyKeyRef.current,
        challengeConfirmed,
        source: 'product_page',
      });

      if (!result.allowed) {
        if (result.requiresConfirmationChallenge) {
          setRequiresChallenge(true);
        }
        setFormError(result.message);
        setIsSubmitting(false);
        return;
      }

      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }

      if (result.order) {
        setOrderSuccessId(result.order.orderNumber);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-white">
      {/* Back button */}
      <button
        onClick={() => navigateTo('/boutique')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#637381] hover:text-[#212B36] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour au catalogue</span>
      </button>

      {/* Main PDP Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Gallery (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Main Photo */}
          <div className="aspect-4/3 sm:aspect-square w-full rounded-3xl bg-[#F4F6F8] border border-[#DFE3E8] overflow-hidden relative shadow-md">
            <img
              src={selectedImage}
              alt={product.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLElement).setAttribute(
                  'src',
                  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80'
                );
              }}
            />
            {/* Urgence & Rareté / COD Badge */}
            <div className="absolute top-3 left-3 bg-[#004C3F] text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-xs uppercase tracking-wide">
              Paiement à la livraison
            </div>
          </div>

          {/* Thumbnails */}
          {product.imageUrls.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
              {product.imageUrls.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                    selectedImage === img
                      ? 'border-[#FF6500] shadow-md shadow-orange-500/20'
                      : 'border-[#DFE3E8] opacity-80 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt={`Vue ${idx + 1}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).setAttribute(
                        'src',
                        'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80'
                      );
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Product Description */}
          <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-[#212B36] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
              Description du produit
            </h3>
            <p className="text-xs sm:text-sm text-[#637381] leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>

          {/* Features check list */}
          <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-[#212B36] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
              Caractéristiques principales
            </h3>
            <ul className="space-y-2 text-xs text-[#212B36]">
              {product.features.map((feat, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#004C3F] shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Contiguous Purchase Module & COD Order Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[#DFE3E8] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            {/* Title & Metadata */}
            <div>
              <div className="text-xs uppercase font-bold text-[#FF6500] tracking-wider">
                {displayCategoryLabel}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#212B36] mt-1 font-['Plus_Jakarta_Sans']">
                {product.name}
              </h1>
              <div className="flex items-center gap-3 text-xs text-[#637381] mt-2">
                <span>Réf : {product.sku}</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#004C3F] font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> En stock ({product.stockQuantity} exemplaires disponibles)
                </span>
              </div>
            </div>

            {/* Price section in #F4F6F8 */}
            <div className="p-4 bg-[#F4F6F8] rounded-2xl border border-[#DFE3E8] flex items-baseline justify-between">
              <div>
                <span className="text-xs text-[#637381] block mb-0.5">Prix unitaire</span>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl font-black text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                    {unitPrice.toLocaleString()}{' '}
                    <span className="text-base text-[#FF6500] font-bold">DZD</span>
                  </span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <>
                      <span className="text-sm text-[#919EAB] line-through tabular-nums font-mono">
                        {product.originalPrice.toLocaleString()} DZD
                      </span>
                      <span className="bg-[#D82C0D] text-white text-xs font-black px-2 py-0.5 rounded-md shadow-xs">
                        -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block bg-emerald-50 border border-emerald-200 text-[#004C3F] text-xs font-bold px-3 py-1 rounded-full">
                  Paiement à la livraison
                </span>
              </div>
            </div>

            {/* Variant selector */}
            {product.variants.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#212B36] uppercase tracking-wider">
                  Choisir une variante :
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {product.variants.map((v) => {
                    const active = selectedVariantId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          active
                            ? 'bg-orange-50 border-[#FF6500] text-[#212B36] shadow-xs'
                            : 'bg-[#F4F6F8] border-[#DFE3E8] text-[#212B36] hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {v.color && (
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                              style={{ backgroundColor: v.color }}
                            />
                          )}
                          <span className="text-xs font-bold">{v.name}</span>
                        </div>
                        {active && <Check className="w-4 h-4 text-[#FF6500] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Stepper & Add to cart button */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center border border-[#DFE3E8] rounded-xl bg-[#F4F6F8] p-1">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 text-[#637381] hover:text-[#212B36] transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 text-sm font-extrabold text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 text-[#637381] hover:text-[#212B36] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 py-3 px-4 bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] text-xs font-bold rounded-xl transition-colors border border-[#DFE3E8] flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-[#FF6500]" />
                <span>Ajouter au Panier</span>
              </button>
            </div>

            {/* Express Algerian COD Order Form Section */}
            <div className="pt-6 border-t border-[#E2E8F0] space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-[#212B36] flex items-center gap-2 font-['Plus_Jakarta_Sans']">
                  <Zap className="w-4 h-4 text-[#FF6500] fill-[#FF6500]" />
                  <span>Commande Express (Paiement à la livraison)</span>
                </h3>
                <p className="text-xs text-[#637381]">
                  Remplissez vos coordonnées ci-dessous pour valider immédiatement votre commande.
                </p>
              </div>

              {orderSuccessId ? (
                <div className="bg-emerald-50 border border-emerald-300 rounded-3xl p-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-[#004C3F] text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                    Commande Validée avec Succès !
                  </h4>
                  <p className="text-xs text-[#212B36]">
                    Numéro de commande :{' '}
                    <strong className="text-[#FF6500] tracking-wider font-mono text-sm">
                      {orderSuccessId}
                    </strong>
                  </p>
                  <p className="text-xs text-[#637381] max-w-md mx-auto">
                    Notre équipe vous appellera au <strong className="text-[#212B36]">{customerPhone}</strong> dans les plus brefs délais pour confirmer l'expédition vers {currentWilaya.name}.
                  </p>
                  <div className="pt-3 flex justify-center gap-3">
                    <a
                      href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20viens%20de%20passer%20la%20commande%20${orderSuccessId}%20pour%20${encodeURIComponent(product.name)}.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-[#004C3F] hover:bg-[#00382E] text-white text-xs font-bold rounded-xl flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Confirmer sur WhatsApp</span>
                    </a>
                    <button
                      onClick={() => navigateTo('/suivi-commande')}
                      className="px-4 py-2.5 bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] text-xs font-bold rounded-xl border border-[#DFE3E8]"
                    >
                      Suivre mon colis
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleDirectOrder} className="space-y-4">
                  {formError && (
                    <div className="p-3 bg-red-50 border border-[#D82C0D]/30 rounded-xl text-xs text-[#D82C0D] font-medium">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Nom */}
                    <div>
                      <label className="block text-xs font-semibold text-[#212B36] mb-1">
                        Nom et Prénom *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Karim Boukhalfa"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
                        required
                      />
                    </div>

                    {/* Téléphone Algérien */}
                    <div>
                      <label className="block text-xs font-semibold text-[#212B36] mb-1">
                        Numéro de Téléphone (05 / 06 / 07) *
                      </label>
                      <input
                        type="tel"
                        placeholder="Ex: 0550 12 34 56"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
                        required
                      />
                      <PhoneOrderAlertBanner
                        phone={customerPhone}
                        items={
                          product
                            ? [
                                {
                                  productId: product.id,
                                  variantId: selectedVariantId,
                                  quantity,
                                },
                              ]
                            : []
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Wilaya */}
                    <div>
                      <label className="block text-xs font-semibold text-[#212B36] mb-1">
                        Wilaya de destination *
                      </label>
                      <select
                        value={selectedWilaya}
                        onChange={(e) => {
                          setSelectedWilaya(e.target.value);
                          const w = wilayas.find((item) => item.code === e.target.value);
                          if (w && w.communes.length > 0) {
                            setCommune(w.communes[0]);
                          }
                        }}
                        className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
                      >
                        {wilayas.map((w) => (
                          <option key={w.code} value={w.code}>
                            {w.code} - {w.name} ({w.nameAr})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Commune */}
                    <div>
                      <label className="block text-xs font-semibold text-[#212B36] mb-1">
                        Commune *
                      </label>
                      <input
                        type="text"
                        list="communes-list"
                        placeholder="Ex: Hydra, Rouïba, etc."
                        value={commune}
                        onChange={(e) => setCommune(e.target.value)}
                        className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
                        required
                      />
                      <datalist id="communes-list">
                        {currentWilaya.communes.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Mode de Livraison */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#212B36]">
                      Mode de livraison :
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setDeliveryMode('home')}
                        className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer flex flex-col gap-1 ${
                          deliveryMode === 'home'
                            ? 'bg-orange-50 border-[#FF6500] text-[#212B36]'
                            : 'bg-[#F4F6F8] border-[#DFE3E8] text-[#637381]'
                        }`}
                      >
                        <span className="text-xs font-bold text-[#212B36] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#FF6500]" /> À Domicile
                        </span>
                        <span className="text-[11px] text-[#FF6500] font-black tabular-nums">
                          {currentWilaya.homeDeliveryFee} DZD
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeliveryMode('desk')}
                        className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer flex flex-col gap-1 ${
                          deliveryMode === 'desk'
                            ? 'bg-emerald-50 border-[#004C3F] text-[#212B36]'
                            : 'bg-[#F4F6F8] border-[#DFE3E8] text-[#637381]'
                        }`}
                      >
                        <span className="text-xs font-bold text-[#212B36] flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-[#004C3F]" /> Bureau / Stop Desk
                        </span>
                        <span className="text-[11px] text-[#004C3F] font-black tabular-nums">
                          {currentWilaya.deskDeliveryFee} DZD
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Delivery address if home */}
                  {deliveryMode === 'home' && (
                    <div>
                      <label className="block text-xs font-semibold text-[#212B36] mb-1">
                        Adresse détaillée *
                      </label>
                      <input
                        type="text"
                        placeholder="N° bâtiment, rue, quartier, repère..."
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
                        required
                      />
                    </div>
                  )}

                  {/* Transparent price summary in #F4F6F8 */}
                  <div className="bg-[#F4F6F8] p-4 rounded-2xl border border-[#DFE3E8] space-y-2 text-xs">
                    <div className="flex justify-between text-[#637381]">
                      <span>Article(s) : {quantity} × {unitPrice.toLocaleString()} DZD</span>
                      <span className="text-[#212B36] tabular-nums font-bold">{subtotal.toLocaleString()} DZD</span>
                    </div>
                    <div className="flex justify-between text-[#637381]">
                      <span>Livraison ({currentWilaya.name} · {deliveryMode === 'home' ? 'Domicile' : 'Stop Desk'}) :</span>
                      <span className="text-[#004C3F] tabular-nums font-bold">+{shippingFee} DZD</span>
                    </div>
                    <div className="pt-2 border-t border-[#DFE3E8] flex justify-between items-baseline">
                      <span className="font-bold text-[#212B36] text-sm">TOTAL À PAYER À LA LIVRAISON :</span>
                      <span className="text-xl font-black text-[#FF6500] tabular-nums font-['Plus_Jakarta_Sans']">
                        {totalAmount.toLocaleString()} DZD
                      </span>
                    </div>
                  </div>

                  {/* Invisible Anti-Bot Honeypot */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="pdp-website-url">Site web (ne pas remplir)</label>
                    <input
                      id="pdp-website-url"
                      type="text"
                      name="website_url"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  {requiresChallenge && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-2">
                      <p className="text-xs font-bold text-amber-900">
                        Vérification supplémentaire avant expédition :
                      </p>
                      <label className="flex items-start gap-2.5 text-xs text-amber-950 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={challengeConfirmed}
                          onChange={(e) => setChallengeConfirmed(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-[#FF6500] rounded cursor-pointer"
                        />
                        <span>
                          Je confirme que le numéro <strong>{customerPhone}</strong> est bien joignable pour valider ma commande de <strong>{totalAmount.toLocaleString()} DZD</strong>.
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Submit Button: Bouton d'Action (#FF6500) */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 bg-[#FF6500] hover:bg-[#E55B00] active:bg-[#CC5100] disabled:opacity-60 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>VÉRIFICATION DE LA COMMANDE...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 fill-white" />
                        <span>CONFIRMER MA COMMANDE (PAIEMENT À LA LIVRAISON)</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-[#637381]">
                    En confirmant, vous vous engagez à régler le livreur lors de la réception de votre colis.
                  </p>
                </form>
              )}
            </div>

            {/* Direct WhatsApp Callout with #004C3F */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2.5 text-[#212B36]">
                <MessageCircle className="w-5 h-5 text-[#004C3F] shrink-0" />
                <span>Vous préférez commander directement par WhatsApp ?</span>
              </div>
              <a
                href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20souhaite%20commander%20l'article%20:%20${encodeURIComponent(product.name)}.`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-[#004C3F] hover:bg-[#00382E] text-white font-bold rounded-xl shrink-0 transition-colors"
              >
                Commander ici
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
