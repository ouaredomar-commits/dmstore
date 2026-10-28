import React, { useState, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { normalizeAndValidateAlgerianPhone } from '../utils/orderSecurity';
import { PhoneOrderAlertBanner } from '../components/PhoneOrderAlertBanner';
import {
  ShieldCheck,
  Truck,
  Phone,
  MessageCircle,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Package,
  ShoppingBag,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    cartSubtotal,
    submitSecureOrder,
    wilayas,
    products,
    addToCart,
    navigateTo,
    contactPhone,
    contactWhatsApp,
  } = useStore();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedWilaya, setSelectedWilaya] = useState('16'); // Alger default
  const [commune, setCommune] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'home' | 'desk'>('home');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresChallenge, setRequiresChallenge] = useState(false);
  const [challengeConfirmed, setChallengeConfirmed] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);

  const formOpenedAtRef = useRef<number>(Date.now());
  const idempotencyKeyRef = useRef<string>(
    `chk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  const currentWilaya = wilayas.find((w) => w.code === selectedWilaya) || wilayas[15];
  const shippingFee = deliveryMode === 'home' ? currentWilaya.homeDeliveryFee : currentWilaya.deskDeliveryFee;
  const totalAmount = cartSubtotal + shippingFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError('');

    if (cart.length === 0) {
      setFormError('Votre panier est vide. Veuillez ajouter un article pour commander.');
      return;
    }

    if (!customerName.trim() || customerName.trim().length < 2) {
      setFormError('Veuillez renseigner votre nom et prénom complets.');
      return;
    }

    const phoneValidation = normalizeAndValidateAlgerianPhone(customerPhone);
    if (!phoneValidation.isValid) {
      setFormError(
        phoneValidation.errorMessage ||
          'Numéro de téléphone invalide. Utilisez un format algérien valide (ex: 0550 12 34 56, 0660 76 93 86).'
      );
      return;
    }

    if (!commune.trim()) {
      setFormError('Veuillez spécifier votre commune de résidence.');
      return;
    }

    if (deliveryMode === 'home' && !deliveryAddress.trim()) {
      setFormError('Veuillez préciser votre adresse exacte pour la livraison à domicile.');
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
        deskName: deliveryMode === 'desk' ? `Bureau Stop Desk ${currentWilaya.name}` : undefined,
        notes: notes.trim() || undefined,
        honeypot,
        formElapsedMs,
        idempotencyKey: idempotencyKeyRef.current,
        challengeConfirmed,
        source: 'storefront',
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
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }

      setConfirmedOrder(result.order);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If order confirmed
  if (confirmedOrder) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 bg-white">
        <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-3xl p-8 sm:p-10 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-[#004C3F] text-white rounded-full flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FF6500]">
              Commande Confirmée
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
              Merci pour votre confiance, {confirmedOrder.customerName} !
            </h1>
            <p className="text-xs sm:text-sm text-[#637381] max-w-lg mx-auto">
              Votre commande porte la référence officielle :
            </p>
            <div className="inline-block px-4 py-1.5 bg-white border border-[#DFE3E8] rounded-xl font-mono text-lg font-black text-[#FF6500] tracking-wider shadow-xs">
              {confirmedOrder.orderNumber}
            </div>
          </div>

          {/* Details summary */}
          <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] text-left space-y-3 text-xs shadow-xs">
            <div className="flex justify-between pb-2 border-b border-[#F4F6F8] text-[#637381]">
              <span>Articles commandés :</span>
              <span className="text-[#212B36] font-bold">{confirmedOrder.items.length} produit(s)</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-[#F4F6F8] text-[#637381]">
              <span>Destination :</span>
              <span className="text-[#212B36] font-bold">
                {confirmedOrder.wilayaName} ({confirmedOrder.commune})
              </span>
            </div>
            <div className="flex justify-between pb-2 border-b border-[#F4F6F8] text-[#637381]">
              <span>Mode de livraison :</span>
              <span className="text-[#212B36] font-bold">
                {confirmedOrder.deliveryMode === 'home' ? '🏠 À Domicile' : '🏢 Bureau Stop Desk'}
              </span>
            </div>
            <div className="flex justify-between pt-1 text-sm font-bold text-[#212B36]">
              <span>Total à régler à la livraison :</span>
              <span className="text-[#FF6500] font-black tabular-nums text-lg font-['Plus_Jakarta_Sans']">
                {confirmedOrder.totalAmount.toLocaleString()} DZD
              </span>
            </div>
          </div>

          <p className="text-xs text-[#637381] leading-relaxed max-w-md mx-auto">
            Notre service client vous contactera par téléphone au{' '}
            <strong className="text-[#212B36]">{confirmedOrder.customerPhone}</strong> pour valider l'expédition avec le transporteur.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20viens%20d'enregistrer%20ma%20commande%20${confirmedOrder.orderNumber}%20au%20nom%20de%20${encodeURIComponent(confirmedOrder.customerName)}.`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto py-3 px-6 bg-[#004C3F] hover:bg-[#00382E] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Confirmer aussi sur WhatsApp</span>
            </a>

            <button
              onClick={() => navigateTo('/suivi-commande')}
              className="w-full sm:w-auto py-3 px-6 bg-white hover:bg-slate-100 text-[#212B36] font-bold text-xs rounded-xl transition-colors border border-[#DFE3E8] cursor-pointer"
            >
              Suivre mon colis
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If cart is empty
  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6 bg-white">
        <div className="w-16 h-16 bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl flex items-center justify-center mx-auto text-[#637381]">
          <ShoppingBag className="w-8 h-8 text-[#919EAB]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[#212B36] font-['Plus_Jakarta_Sans']">Votre panier est actuellement vide</h1>
          <p className="text-xs text-[#637381] max-w-md mx-auto">
            Choisissez l'un de nos articles premium ci-dessous pour lancer votre commande avec livraison rapide dans les 58 wilayas.
          </p>
        </div>

        <div className="pt-6">
          <h2 className="text-sm font-bold text-[#212B36] uppercase tracking-wider mb-4 font-['Plus_Jakarta_Sans']">
            Articles recommandés
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {products.slice(0, 3).map((p) => (
              <div
                key={p.id}
                className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-4 flex flex-col justify-between"
              >
                <div className="aspect-square rounded-xl bg-white overflow-hidden mb-3 border border-[#E2E8F0]">
                  <img
                    src={p.imageUrls[0]}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h3 className="text-xs font-bold text-[#212B36] line-clamp-1">{p.name}</h3>
                <p className="text-xs font-extrabold text-[#FF6500] mt-1 tabular-nums font-['Plus_Jakarta_Sans']">
                  {p.price.toLocaleString()} DZD
                </p>
                <button
                  onClick={() => addToCart(p, 1)}
                  className="mt-3 w-full py-2 bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Ajouter au panier
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 bg-white">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-[#FF6500]">
          Tunnel de Commande Algérie
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#212B36] tracking-tight mt-1 font-['Plus_Jakarta_Sans']">
          Finaliser ma Commande (Paiement à la livraison)
        </h1>
        <p className="text-xs sm:text-sm text-[#637381] mt-1">
          Aucun paiement par carte bancaire requis. Vous vérifiez votre colis et réglez en dinars directement au livreur.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Client & Delivery Information (7 cols) */}
        <div className="lg:col-span-7 bg-[#F4F6F8] border border-[#DFE3E8] rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-[#DFE3E8]">
            <MapPin className="w-4 h-4 text-[#FF6500]" />
            <h2 className="text-sm font-bold text-[#212B36] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
              1. Informations de Livraison (58 Wilayas)
            </h2>
          </div>

          <form onSubmit={handleSubmitOrder} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-[#D82C0D]/30 rounded-xl text-xs text-[#D82C0D] flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#D82C0D]" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#212B36] mb-1">
                  Nom et Prénom *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mourad Benali"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#212B36] mb-1">
                  Téléphone Portable (05 / 06 / 07) *
                </label>
                <input
                  type="tel"
                  placeholder="Ex: 0660 76 93 86"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
                  required
                />
                <PhoneOrderAlertBanner
                  phone={customerPhone}
                  items={cart.map((c) => ({
                    productId: c.product.id,
                    variantId: c.variantId,
                    quantity: c.quantity,
                  }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Wilaya Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#212B36] mb-1">
                  Wilaya *
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
                  className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3 py-2.5 text-xs sm:text-sm text-[#212B36] focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
                >
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.code} - {w.name} ({w.nameAr})
                    </option>
                  ))}
                </select>
              </div>

              {/* Commune Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#212B36] mb-1">
                  Commune *
                </label>
                <input
                  type="text"
                  list="checkout-communes"
                  placeholder="Tapez le nom de votre commune"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
                  required
                />
                <datalist id="checkout-communes">
                  {currentWilaya.communes.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Delivery mode */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-[#212B36]">
                Mode de livraison :
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryMode('home')}
                  className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer flex flex-col gap-1 ${
                    deliveryMode === 'home'
                      ? 'bg-orange-50 border-[#FF6500] text-[#212B36] shadow-xs'
                      : 'bg-white border-[#DFE3E8] text-[#637381]'
                  }`}
                >
                  <span className="text-xs font-bold text-[#212B36] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FF6500]" /> Livraison à Domicile
                  </span>
                  <span className="text-xs text-[#FF6500] font-black tabular-nums">
                    +{currentWilaya.homeDeliveryFee} DZD
                  </span>
                  <span className="text-[10px] text-[#637381]">
                    Délai estimé : {currentWilaya.estimatedDeliveryHours}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMode('desk')}
                  className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer flex flex-col gap-1 ${
                    deliveryMode === 'desk'
                      ? 'bg-emerald-50 border-[#004C3F] text-[#212B36] shadow-xs'
                      : 'bg-white border-[#DFE3E8] text-[#637381]'
                  }`}
                >
                  <span className="text-xs font-bold text-[#212B36] flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#004C3F]" /> Point Relais / Stop Desk
                  </span>
                  <span className="text-xs text-[#004C3F] font-black tabular-nums">
                    +{currentWilaya.deskDeliveryFee} DZD
                  </span>
                  <span className="text-[10px] text-[#637381]">
                    Retrait en agence express
                  </span>
                </button>
              </div>
            </div>

            {/* Detailed Address */}
            {deliveryMode === 'home' && (
              <div>
                <label className="block text-xs font-semibold text-[#212B36] mb-1">
                  Adresse complète pour le livreur *
                </label>
                <input
                  type="text"
                  placeholder="Rue, quartier, numéro de villa ou bloc d'immeuble..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500]"
                  required
                />
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-[#212B36] mb-1">
                Remarque ou instruction particulière (facultatif)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Disponible après 16h, appeler au deuxième numéro..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2 text-xs text-[#212B36] placeholder:text-[#919EAB] focus:outline-hidden focus:border-[#FF6500] resize-none"
              />
            </div>

            {/* Invisible Anti-Bot Honeypot */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="checkout-website-url">Site web (ne pas remplir)</label>
              <input
                id="checkout-website-url"
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
                    Je confirme que le numéro <strong>{customerPhone}</strong> est bien joignable par téléphone pour valider la livraison de ma commande de{' '}
                    <strong>{totalAmount.toLocaleString()} DZD</strong>.
                  </span>
                </label>
              </div>
            )}

            {/* Submit: Bouton d'Action (#FF6500) */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-[#FF6500] hover:bg-[#E55B00] active:bg-[#CC5100] disabled:opacity-60 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>VÉRIFICATION EN COURS...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>CONFIRMER LA COMMANDE ({totalAmount.toLocaleString()} DZD)</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-[#637381] mt-2">
                Paiement à la livraison · Vous ne payez rien maintenant.
              </p>
            </div>
          </form>
        </div>

        {/* Right Summary: Items & Price breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-[#DFE3E8] rounded-3xl p-6 sm:p-7 space-y-6 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <h2 className="text-sm font-bold text-[#212B36] uppercase tracking-wider flex items-center gap-2 font-['Plus_Jakarta_Sans']">
              <Package className="w-4 h-4 text-[#FF6500]" />
              <span>Résumé de votre commande</span>
            </h2>
            <span className="text-xs text-[#637381]">({cart.length} article{cart.length > 1 ? 's' : ''})</span>
          </div>

          {/* Items list */}
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {cart.map((item) => (
              <div
                key={`${item.product.id}-${item.variantId || 'default'}`}
                className="flex items-center gap-3 p-3 bg-[#F4F6F8] rounded-2xl border border-[#DFE3E8]"
              >
                <div className="w-14 h-14 rounded-xl bg-white overflow-hidden shrink-0 border border-[#E2E8F0]">
                  <img
                    src={item.product.imageUrls[0]}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-[#212B36] line-clamp-1">{item.product.name}</h4>
                  {item.variantName && (
                    <span className="text-[10px] text-[#FF6500] font-semibold">{item.variantName}</span>
                  )}
                  <div className="flex justify-between items-baseline mt-1 text-xs text-[#637381]">
                    <span>Quantité : {item.quantity}</span>
                    <span className="font-bold text-[#212B36] tabular-nums font-['Plus_Jakarta_Sans']">
                      {(item.unitPrice * item.quantity).toLocaleString()} DZD
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing detail */}
          <div className="p-4 bg-[#F4F6F8] rounded-2xl border border-[#DFE3E8] space-y-2.5 text-xs">
            <div className="flex justify-between text-[#637381]">
              <span>Sous-total articles :</span>
              <span className="font-bold text-[#212B36] tabular-nums">{cartSubtotal.toLocaleString()} DZD</span>
            </div>
            <div className="flex justify-between text-[#637381]">
              <span>
                Frais d'expédition ({currentWilaya.name} · {deliveryMode === 'home' ? 'Domicile' : 'Stop Desk'}) :
              </span>
              <span className="font-bold text-[#004C3F] tabular-nums">+{shippingFee} DZD</span>
            </div>
            <div className="pt-2 border-t border-[#DFE3E8] flex justify-between items-baseline">
              <span className="font-bold text-[#212B36] text-sm">TOTAL À PAYER AU LIVREUR :</span>
              <span className="text-xl font-black text-[#FF6500] tabular-nums font-['Plus_Jakarta_Sans']">
                {totalAmount.toLocaleString()} DZD
              </span>
            </div>
          </div>

          {/* Support callout */}
          <div className="p-3 bg-[#F4F6F8] rounded-2xl border border-[#DFE3E8] flex items-center justify-between text-xs text-[#637381]">
            <span className="flex items-center gap-1.5 font-medium">
              <Phone className="w-3.5 h-3.5 text-[#FF6500]" /> Assistance commande :
            </span>
            <span className="font-bold text-[#212B36] tracking-wider">{contactPhone}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
