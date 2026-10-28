import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { LandingPage, Product, CartItem, Wilaya } from '../types';
import { DzMahallLogo } from '../components/DzMahallLogo';
import { normalizeAndValidateAlgerianPhone } from '../utils/orderSecurity';
import { PhoneOrderAlertBanner } from '../components/PhoneOrderAlertBanner';
import {
  matchLandingPage,
  normalizeLandingPageSlug,
  extractCoreLandingPageSlug,
} from '../utils/landingPageMatcher';
import {
  ShieldCheck,
  Truck,
  PhoneCall,
  Clock,
  CheckCircle,
  Star,
  ChevronDown,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Headphones,
  Check,
  AlertTriangle,
  BatteryCharging,
  Activity,
  Zap,
  MapPin,
  MessageCircle,
} from 'lucide-react';

interface LandingPageViewProps {
  slug?: string;
  pageData?: LandingPage;
  isPreview?: boolean;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  slug,
  pageData: propPageData,
  isPreview = false,
}) => {
  const {
    landingPages,
    products,
    isCatalogLoading,
    wilayas,
    submitSecureOrder,
    navigateTo,
    incrementLandingPageView,
    contactWhatsApp,
    contactPhone,
  } = useStore();

  // Normalize and clean slug
  const normalizedSlug = slug
    ? decodeURIComponent(slug).trim().toLowerCase().replace(/^\/+|\/+$/g, '')
    : '';

  // Server-side dedicated fast fetch state (<15KB, <5ms)
  const [serverData, setServerData] = useState<{
    page: LandingPage;
    product: Product;
    wilayas?: Wilaya[];
  } | null>(null);
  const [fetchStatus, setFetchStatus] = useState<
    'idle' | 'loading' | 'success' | 'not_found' | 'draft_blocked' | 'network_error'
  >('idle');
  const [fetchErrorMsg, setFetchErrorMsg] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  // Intelligent multi-tier matching from local store context
  const localMatch = useMemo(() => {
    if (propPageData) {
      return {
        page: propPageData,
        matchType: 'exact' as const,
        isDraft: propPageData.status !== 'published',
      };
    }
    if (!normalizedSlug) return null;
    return matchLandingPage(landingPages, normalizedSlug, {
      products,
      allowDraft: isPreview,
    });
  }, [propPageData, normalizedSlug, landingPages, products, isPreview]);

  // Primary authoritative page resolution
  const activePage: LandingPage | undefined =
    propPageData || localMatch?.page || serverData?.page;

  // Strict security guard: Draft or Archived pages are strictly inaccessible in public mode
  const isDraftBlocked = Boolean(
    activePage && !isPreview && activePage.status !== 'published'
  );
  const page: LandingPage | undefined = isDraftBlocked ? undefined : activePage;

  // Associated product resolution: matches by ID, then by slug, preserving exact product data
  const product: Product | undefined = useMemo(() => {
    if (serverData?.product) return serverData.product;
    if (!page) return products[0];
    const foundById = products.find((p) => p.id === page.productId);
    if (foundById) return foundById;

    const pageNorm = normalizeLandingPageSlug(page.slug || '');
    const pageCore = extractCoreLandingPageSlug(pageNorm);
    const foundBySlug = products.find((p) => {
      const pNorm = normalizeLandingPageSlug(p.slug || '');
      const pCore = extractCoreLandingPageSlug(pNorm);
      return (
        pNorm === pageNorm ||
        (pCore && pCore === pageCore) ||
        (pageCore && pNorm.includes(pageCore)) ||
        (pNorm && pageNorm.includes(pNorm))
      );
    });
    return foundBySlug || products[0];
  }, [page, products, serverData]);

  // Lightweight public landing page fetch: resolves directly from server in <5ms without full catalog sync
  useEffect(() => {
    if (!normalizedSlug || propPageData) return;

    let isMounted = true;
    if (!page) {
      setFetchStatus('loading');
    }

    const loadDirectLandingPage = async () => {
      try {
        const res = await fetch(`/api/lp/${encodeURIComponent(normalizedSlug)}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!isMounted) return;

        if (res.status === 404) {
          setFetchStatus('not_found');
          return;
        }

        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          if (body?.isDraft && !isPreview) {
            setFetchStatus('draft_blocked');
            return;
          }
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data && data.success && data.page) {
          setServerData({
            page: data.page,
            product: data.product,
            wilayas: data.wilayas,
          });
          setFetchStatus('success');
          setFetchErrorMsg(null);
        } else {
          setFetchStatus('not_found');
        }
      } catch (err: any) {
        if (!isMounted) return;
        // Si la page est déjà trouvée localement, on n'affiche pas d'erreur réseau
        if (!page) {
          setFetchStatus('network_error');
          setFetchErrorMsg('La connexion avec le serveur DzMahall a pris trop de temps.');
        }
      }
    };

    void loadDirectLandingPage();

    return () => {
      isMounted = false;
    };
  }, [normalizedSlug, isPreview, retryTrigger]);

  // Capture UTM parameters from URL query string
  const [utmParams, setUtmParams] = useState<{
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  }>({});

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const extracted: Record<string, string> = {};
      const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
      utmKeys.forEach((key) => {
        const val = searchParams.get(key);
        if (val) extracted[key] = val;
      });
      setUtmParams(extracted);
    } catch (e) {
      // ignore in non-browser env
    }
  }, []);

  // Initialize and track Meta Pixel if configured on this landing page (no PII sent)
  useEffect(() => {
    if (!page?.pixelId || typeof window === 'undefined') return;
    const win = window as any;
    if (!win.fbq) {
      const fbq: any = function () {
        fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
      };
      if (!win._fbq) win._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      win.fbq = fbq;
    }
    try {
      win.fbq('init', page.pixelId);
      win.fbq('track', 'PageView');
    } catch (err) {
      console.warn('Meta Pixel PageView error', err);
    }
  }, [page?.pixelId]);

  // Increment view count if not in preview mode
  useEffect(() => {
    if (!isPreview && page) {
      incrementLandingPageView(page.slug);
    }
  }, [page?.slug, isPreview]);

  // Order form state
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product?.variants?.[0]?.id || ''
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [wilayaCode, setWilayaCode] = useState<string>('16'); // Alger default
  const [commune, setCommune] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryMode, setDeliveryMode] = useState<'home' | 'desk'>('home');
  const [deskName, setDeskName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Anti-spam & Idempotency state
  const [honeypot, setHoneypot] = useState<string>('');
  const formLoadedAtRef = useRef<number>(Date.now());
  const idempotencyKeyRef = useRef<string>(
    `idem_lp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  );
  const [requiresChallenge, setRequiresChallenge] = useState<boolean>(false);
  const [challengeAccepted, setChallengeAccepted] = useState<boolean>(false);
  const [challengeReasons, setChallengeReasons] = useState<string[]>([]);

  // Form submission status
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successOrderNumber, setSuccessOrderNumber] = useState<string | null>(null);

  // Gallery state
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Countdown timer state for promo banner
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number }>({
    minutes: 42,
    seconds: 18,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { minutes: prev.minutes - 1, seconds: 59 };
        }
        return { minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update commune list when wilaya changes
  const effectiveWilayas =
    serverData?.wilayas && serverData.wilayas.length > 0 ? serverData.wilayas : wilayas;
  const currentWilaya =
    effectiveWilayas.find((w) => w.code === wilayaCode) || effectiveWilayas[15];
  useEffect(() => {
    if (currentWilaya && currentWilaya.communes.length > 0) {
      setCommune(currentWilaya.communes[0]);
    }
  }, [wilayaCode, currentWilaya]);

  // Calculate pricing
  const variant = product?.variants?.find((v) => v.id === selectedVariantId);
  const unitPrice =
    product && variant && variant.priceModifier
      ? product.price + variant.priceModifier
      : product?.price || 0;
  const originalPrice = product?.originalPrice || Math.round(unitPrice * 1.3);
  const discountPercent =
    originalPrice > unitPrice ? Math.round(((originalPrice - unitPrice) / originalPrice) * 100) : 0;

  const isGuepexLandingPage = page?.shippingCompanyId === 'guepex';
  const landingServiceType = page?.deliveryServiceType;
  const shippingCost = (() => {
    if (isGuepexLandingPage && landingServiceType === 'economique') {
      return Math.max(
        350,
        Math.round(
          currentWilaya?.ecoDeliveryFee ||
            (deliveryMode === 'desk'
              ? Math.max(350, currentWilaya?.deskDeliveryFee || 350)
              : Math.max(450, Math.round((currentWilaya?.homeDeliveryFee || 600) * 0.85)))
        )
      );
    }
    if (isGuepexLandingPage && landingServiceType === 'express') {
      return Math.max(
        350,
        Math.round(
          currentWilaya?.expressDeliveryFee ||
            (deliveryMode === 'desk'
              ? Math.max(450, (currentWilaya?.deskDeliveryFee || 350) + 100)
              : Math.max(600, (currentWilaya?.homeDeliveryFee || 600) + 100))
        )
      );
    }
    return deliveryMode === 'home'
      ? currentWilaya?.homeDeliveryFee || 600
      : currentWilaya?.deskDeliveryFee || 350;
  })();
  const subtotal = unitPrice * quantity;
  const totalAmount = subtotal + shippingCost;

  const orderFormRef = useRef<HTMLDivElement>(null);

  const scrollToOrderForm = () => {
    orderFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    if (!product) {
      setErrorMessage('Erreur : Aucun produit associé à cette page.');
      return;
    }

    if (customerName.trim().length < 2) {
      setErrorMessage('Veuillez renseigner votre nom et prénom complets.');
      return;
    }

    const phoneValidation = normalizeAndValidateAlgerianPhone(customerPhone);
    if (!phoneValidation.isValid) {
      setErrorMessage(
        phoneValidation.errorMessage ||
          'Numéro de téléphone algérien invalide (ex: 0550 12 34 56 ou 0660 76 93 86).'
      );
      return;
    }

    if (commune.trim().length < 2) {
      setErrorMessage('Veuillez préciser votre commune.');
      return;
    }

    if (requiresChallenge && !challengeAccepted) {
      setErrorMessage('Veuillez cocher la case de confirmation supplémentaire pour valider la commande.');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderItem: CartItem = {
        product,
        variantId: variant?.id,
        variantName: variant?.name,
        quantity,
        unitPrice,
      };

      const result = await submitSecureOrder({
        customerName: customerName.trim(),
        customerPhone: phoneValidation.normalized,
        wilayaCode,
        commune: commune.trim(),
        deliveryAddress: deliveryAddress.trim() || undefined,
        deliveryMode,
        deskName: deliveryMode === 'desk' ? (deskName.trim() || `Stop Desk ${currentWilaya.name}`) : undefined,
        notes: notes.trim()
          ? `[Landing Page: ${page?.title || 'Direct'}] ${notes.trim()}`
          : `[Landing Page: ${page?.title || 'Direct'}]`,
        items: [orderItem],
        landingPageId: page?.id,
        landingPageSlug: page?.slug,
        landingPageTitle: page?.title,
        shippingCompanyId: page?.shippingCompanyId || 'yalidine',
        shippingCompanyNameSnapshot: page?.shippingCompanyNameSnapshot || 'Yalidine Fast Logistics',
        deliveryServiceType: page?.deliveryServiceType,
        shippingFee: shippingCost,
        utm_source: utmParams.utm_source,
        utm_medium: utmParams.utm_medium,
        utm_campaign: utmParams.utm_campaign,
        utm_content: utmParams.utm_content,
        utm_term: utmParams.utm_term,
        honeypot,
        formElapsedMs: Date.now() - formLoadedAtRef.current,
        idempotencyKey: idempotencyKeyRef.current,
        challengeConfirmed: challengeAccepted,
      });

      if (result.requiresAdditionalConfirmation && !challengeAccepted) {
        setRequiresChallenge(true);
        setChallengeReasons(result.riskReasons || []);
        setErrorMessage(
          result.message ||
            'Une confirmation supplémentaire est requise avant l\'enregistrement de cette commande.'
        );
        setIsSubmitting(false);
        return;
      }

      if (!result.allowed || !result.order) {
        setErrorMessage(
          result.message || 'Impossible de valider votre commande. Veuillez vérifier vos informations.'
        );
        setIsSubmitting(false);
        return;
      }

      // Fire Meta Pixel Purchase event safely (STRICTLY NO PII TRANSMITTED)
      if (page?.pixelId && typeof window !== 'undefined' && (window as any).fbq) {
        try {
          (window as any).fbq('track', 'Purchase', {
            value: result.order.totalAmount,
            currency: 'DZD',
            content_name: page.title,
            content_ids: [product.id],
            content_type: 'product',
            num_items: quantity,
          });
        } catch (pxErr) {
          console.warn('Meta Pixel Purchase error', pxErr);
        }
      }

      setSuccessOrderNumber(result.order.orderNumber);
      setRequiresChallenge(false);
      setChallengeAccepted(false);
      idempotencyKeyRef.current = `idem_lp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      setIsSubmitting(false);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage('Une erreur est survenue lors de l\'enregistrement de votre commande. Veuillez réessayer.');
    }
  };

  // 1. Écran de protection Brouillon / En cours de préparation
  if (isDraftBlocked || fetchStatus === 'draft_blocked') {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-[#DFE3E8]">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-[#002244]">Offre en cours de préparation</h2>
          <p className="text-xs text-[#637381] leading-relaxed">
            Cette offre commerciale est actuellement en cours de finalisation par l'équipe DzMahall. Elle sera très bientôt disponible à la commande.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => navigateTo('/boutique')}
              className="flex-1 py-3 bg-[#FF6500] hover:bg-[#e05900] text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all"
            >
              Voir le catalogue
            </button>
            <button
              onClick={() => navigateTo('/')}
              className="py-3 px-4 bg-white border border-[#DFE3E8] hover:bg-slate-50 text-[#002244] font-bold rounded-xl text-xs cursor-pointer transition-all"
            >
              Accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Écran de chargement ultra-rapide et poli
  if (!page && (fetchStatus === 'loading' || (isCatalogLoading && fetchStatus === 'idle'))) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-[#DFE3E8]">
          <div className="w-12 h-12 border-3 border-[#FF6500] border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-lg font-black text-[#002244]">Chargement de votre offre...</h2>
          <p className="text-xs text-[#637381]">
            Récupération directe et vérification des stocks DzMahall.
          </p>
        </div>
      </div>
    );
  }

  // 3. Écran d'incident réseau temporaire avec bouton Réessayer (NE RENVOIE JAMAIS UNE FAUSSE 404)
  if (!page && fetchStatus === 'network_error') {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-[#DFE3E8]">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <RefreshCw className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-[#002244]">Connexion au serveur ralentie</h2>
          <p className="text-xs text-[#637381] leading-relaxed">
            {fetchErrorMsg || "Le chargement de l'offre commerciale a été ralenti par votre connexion réseau. La page existe bien, veuillez réessayer."}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                setFetchStatus('loading');
                setRetryTrigger((prev) => prev + 1);
              }}
              className="w-full py-3 bg-[#FF6500] hover:bg-[#e05900] text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Réessayer le chargement</span>
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => navigateTo('/boutique')}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#002244] font-bold rounded-xl text-xs cursor-pointer transition-all"
              >
                Explorer la boutique
              </button>
              <button
                onClick={() => navigateTo('/')}
                className="py-2.5 px-4 bg-white border border-[#DFE3E8] hover:bg-slate-50 text-[#002244] font-bold rounded-xl text-xs cursor-pointer transition-all"
              >
                Accueil
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Véritable 404 : Landing page définitivement introuvable après confirmation du backend
  if (!page || !product) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-[#DFE3E8]">
          <div className="w-16 h-16 rounded-2xl bg-orange-100 text-[#FF6500] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-[#002244]">Landing Page Introuvable (404)</h2>
          <p className="text-xs text-[#637381] leading-relaxed">
            La page commerciale {normalizedSlug ? <strong className="text-[#002244] font-mono block mt-1">« /lp/{normalizedSlug} »</strong> : ''} n'existe pas ou son lien a été modifié par l'administrateur de DzMahall.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => navigateTo('/boutique')}
              className="flex-1 py-3 bg-[#FF6500] hover:bg-[#e05900] text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all"
            >
              Explorer la boutique
            </button>
            <button
              onClick={() => navigateTo('/')}
              className="py-3 px-4 bg-white border border-[#DFE3E8] hover:bg-slate-50 text-[#002244] font-bold rounded-xl text-xs cursor-pointer transition-all"
            >
              Accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper to render dynamic icon
  const renderIcon = (name: string) => {
    switch (name) {
      case 'ShieldCheck':
        return <ShieldCheck className="w-6 h-6 text-[#FF6500]" />;
      case 'PhoneCall':
        return <PhoneCall className="w-6 h-6 text-[#FF6500]" />;
      case 'BatteryCharging':
        return <BatteryCharging className="w-6 h-6 text-[#FF6500]" />;
      case 'Activity':
        return <Activity className="w-6 h-6 text-[#FF6500]" />;
      case 'Truck':
        return <Truck className="w-6 h-6 text-[#FF6500]" />;
      case 'RefreshCw':
        return <RefreshCw className="w-6 h-6 text-[#FF6500]" />;
      case 'Headphones':
        return <Headphones className="w-6 h-6 text-[#FF6500]" />;
      default:
        return <CheckCircle className="w-6 h-6 text-[#FF6500]" />;
    }
  };

  const images = product?.imageUrls || [];

  return (
    <div className="min-h-screen bg-white text-[#212B36] font-['DM_Sans'] antialiased selection:bg-[#FF6500] selection:text-white">
      {/* Preview indicator if preview mode */}
      {isPreview && (
        <div className="bg-[#002244] text-white py-2 px-4 text-xs font-bold text-center flex items-center justify-center gap-2 border-b border-orange-500 sticky top-0 z-50 shadow-md">
          <Sparkles className="w-3.5 h-3.5 text-[#FF6500] animate-pulse" />
          <span>MODE PRÉVISUALISATION — LANDING PAGE COMMERCIALE DZMAHALL</span>
          <span className="bg-orange-500/20 text-[#FF6500] px-2 py-0.5 rounded text-[10px] uppercase font-mono">
            {page.status}
          </span>
        </div>
      )}

      {/* Render sections in order */}
      {page.sections.map((section) => {
        if (!section.enabled) return null;

        // 1. Promo Banner Section
        if (section.type === 'promo_banner') {
          return (
            <div
              key={section.id}
              style={{
                backgroundColor: section.data?.bgColor || '#FF6500',
                color: section.data?.textColor || '#FFFFFF',
              }}
              className="py-2.5 px-4 text-center text-xs sm:text-sm font-bold shadow-sm"
            >
              <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2">
                <span>{section.data?.text || 'Offre Spéciale DzMahall : Remise immédiate + Stock limité !'}</span>
                <div className="inline-flex items-center gap-1.5 bg-black/20 px-2.5 py-0.5 rounded-full text-xs font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Expire dans :{' '}
                    <span className="font-bold">
                      {String(timeLeft.minutes).padStart(2, '0')}:
                      {String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          );
        }

        // 2. Header with Logo & Badges
        return null;
      })}

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#DFE3E8] py-3.5 px-4 sm:px-6 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DzMahallLogo size="md" showText={true} showSubtitle={true} theme="light" />
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs font-bold text-[#637381]">
            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Paiement à la Réception</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>Livraison 58 Wilayas</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20souhaite%20des%20informations%20sur%20${encodeURIComponent(product?.name || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Direct</span>
            </a>
            <button
              onClick={scrollToOrderForm}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF6500] hover:bg-[#e05900] text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 cursor-pointer transition-transform active:scale-95"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Commander</span>
            </button>
          </div>
        </div>
      </header>

      {/* Render Main Content Sections */}
      {page.sections.map((section) => {
        if (!section.enabled) return null;

        // Hero Section
        if (section.type === 'hero') {
          return (
            <section key={section.id} className="py-8 sm:py-14 px-4 sm:px-6 bg-gradient-to-b from-[#F4F6F8]/60 to-white">
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                {/* Visual / Gallery Column */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="relative aspect-square w-full rounded-3xl bg-white border border-[#DFE3E8] overflow-hidden shadow-lg group">
                    <img
                      src={images[activeImageIndex] || product?.imageUrls?.[0] || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80'}
                      alt={product?.name || 'Produit DzMahall'}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {discountPercent > 0 && (
                      <span className="absolute top-4 left-4 bg-[#FF6500] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md font-mono">
                        -{discountPercent}% OFF
                      </span>
                    )}
                    <span className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>Inspectez avant de payer</span>
                    </span>
                  </div>

                  {/* Thumbnail Row */}
                  {images.length > 1 && (
                    <div className="flex gap-2.5 overflow-x-auto pb-1">
                      {images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`w-18 h-18 rounded-2xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                            activeImageIndex === idx
                              ? 'border-[#FF6500] shadow-md scale-105'
                              : 'border-[#DFE3E8] opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={img} alt="Aperçu" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Copy & CTA Column */}
                <div className="lg:col-span-6 space-y-6">
                  {section.data?.badge && (
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100 text-[#FF6500] text-xs font-bold border border-orange-200">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>{section.data.badge}</span>
                    </div>
                  )}

                  <h1 className="text-2xl sm:text-4xl font-extrabold text-[#002244] leading-tight tracking-tight">
                    {section.title || product?.name}
                  </h1>

                  <p className="text-sm sm:text-base text-[#637381] leading-relaxed">
                    {section.subtitle || product?.description}
                  </p>

                  {/* Pricing Box */}
                  <div className="p-5 rounded-2xl bg-white border border-[#DFE3E8] shadow-sm flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <div className="text-xs font-semibold text-[#637381] uppercase tracking-wider">
                        Prix Promotionnel DzMahall
                      </div>
                      <div className="flex items-baseline gap-3 mt-1">
                        <span className="text-3xl font-extrabold text-[#FF6500]">
                          {unitPrice.toLocaleString('fr-FR')} <span className="text-lg">DZD</span>
                        </span>
                        {originalPrice > unitPrice && (
                          <span className="text-base text-[#919EAB] line-through font-medium">
                            {originalPrice.toLocaleString('fr-FR')} DZD
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold">
                      Économisez {(originalPrice - unitPrice).toLocaleString('fr-FR')} DZD
                    </div>
                  </div>

                  {/* Bullet Highlights */}
                  {section.data?.bullets && Array.isArray(section.data.bullets) && (
                    <div className="space-y-2.5">
                      {section.data.bullets.map((bullet: string, bIdx: number) => (
                        <div key={bIdx} className="flex items-start gap-3 text-xs sm:text-sm font-medium text-[#212B36]">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA Action */}
                  <div className="pt-2 space-y-3">
                    <button
                      onClick={scrollToOrderForm}
                      className="w-full py-4 px-6 rounded-2xl bg-[#FF6500] hover:bg-[#e05900] text-white font-extrabold text-base shadow-xl shadow-orange-500/25 flex items-center justify-center gap-3 cursor-pointer transition-all hover:scale-[1.01] active:scale-98"
                    >
                      <ShoppingBag className="w-5 h-5" />
                      <span>{section.data?.ctaText || 'Commander Maintenant (Paiement à la Réception)'}</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                    {section.data?.subCta && (
                      <p className="text-center text-xs text-emerald-700 font-semibold flex items-center justify-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        <span>{section.data.subCta}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        }

        // Benefits Section
        if (section.type === 'benefits') {
          return (
            <section key={section.id} className="py-12 sm:py-16 px-4 sm:px-6 bg-white border-y border-[#DFE3E8]">
              <div className="max-w-6xl mx-auto">
                <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
                  <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider">
                    Bénéfices & Avantages
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002244]">
                    {section.title || 'Pourquoi Choisir ce Produit ?'}
                  </h2>
                  {section.subtitle && (
                    <p className="text-sm text-[#637381]">{section.subtitle}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {section.data?.items?.map((item: any, iIdx: number) => (
                    <div
                      key={iIdx}
                      className="p-6 rounded-3xl bg-[#F4F6F8]/60 border border-[#DFE3E8] hover:border-[#FF6500]/50 hover:bg-white hover:shadow-lg transition-all duration-300 group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-orange-100 group-hover:bg-[#FF6500] text-[#FF6500] group-hover:text-white flex items-center justify-center mb-4 transition-colors">
                        {renderIcon(item.icon)}
                      </div>
                      <h3 className="text-base font-bold text-[#002244] mb-2">{item.title}</h3>
                      <p className="text-xs text-[#637381] leading-relaxed">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        }

        // Features & Specs Section
        if (section.type === 'features') {
          return (
            <section key={section.id} className="py-12 sm:py-16 px-4 sm:px-6 bg-[#F4F6F8]/40">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10 space-y-2">
                  <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider">
                    Transparence & Qualité
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002244]">
                    {section.title || 'Caractéristiques Techniques'}
                  </h2>
                  {section.subtitle && (
                    <p className="text-sm text-[#637381]">{section.subtitle}</p>
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-[#DFE3E8] shadow-xs overflow-hidden">
                  <div className="divide-y divide-[#DFE3E8]">
                    {section.data?.specs?.map((spec: any, sIdx: number) => (
                      <div
                        key={sIdx}
                        className="py-3.5 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#F4F6F8]/50 transition-colors"
                      >
                        <span className="text-xs font-bold text-[#637381]">{spec.label}</span>
                        <span className="text-xs sm:text-sm font-semibold text-[#002244] sm:text-right">
                          {spec.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        }

        // Gallery Section
        if (section.type === 'gallery') {
          return (
            <section key={section.id} className="py-12 sm:py-16 px-4 sm:px-6 bg-white border-y border-[#DFE3E8]">
              <div className="max-w-6xl mx-auto">
                <div className="text-center mb-10 space-y-2">
                  <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider">
                    Galerie Réelle
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002244]">
                    {section.title || 'Découvrez le Produit en Détail'}
                  </h2>
                  {section.subtitle && (
                    <p className="text-sm text-[#637381]">{section.subtitle}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {section.data?.images?.map((gImg: any, gIdx: number) => (
                    <div
                      key={gIdx}
                      className="rounded-3xl overflow-hidden bg-[#F4F6F8] border border-[#DFE3E8] shadow-sm group"
                    >
                      <div className="aspect-4/3 overflow-hidden">
                        <img
                          src={gImg.url}
                          alt={gImg.caption || 'Photo produit'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      {gImg.caption && (
                        <div className="p-4 bg-white text-xs font-bold text-[#002244] border-t border-[#DFE3E8]">
                          {gImg.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        }

        // Testimonials Section
        if (section.type === 'testimonials') {
          return (
            <section key={section.id} className="py-12 sm:py-16 px-4 sm:px-6 bg-[#F4F6F8]/50">
              <div className="max-w-6xl mx-auto">
                <div className="text-center mb-10 space-y-2">
                  <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider">
                    Retours d'Expérience
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002244]">
                    {section.title || 'Avis Clients Vérifiés en Algérie'}
                  </h2>
                  {section.subtitle && (
                    <p className="text-sm text-[#637381]">{section.subtitle}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {section.data?.reviews?.map((review: any, rIdx: number) => (
                    <div
                      key={rIdx}
                      className="p-6 rounded-3xl bg-white border border-[#DFE3E8] shadow-xs flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-1 text-amber-400">
                          {Array.from({ length: review.rating || 5 }).map((_, sIdx) => (
                            <Star key={sIdx} className="w-4 h-4 fill-current" />
                          ))}
                        </div>
                        <p className="text-xs sm:text-sm text-[#212B36] italic leading-relaxed">
                          « {review.text} »
                        </p>
                      </div>

                      <div className="pt-4 mt-4 border-t border-[#DFE3E8] flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-[#002244]">{review.author}</div>
                          <div className="text-[#637381] flex items-center gap-1 text-[11px]">
                            <MapPin className="w-3 h-3 text-[#FF6500]" />
                            <span>{review.city}</span>
                          </div>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Achat vérifié
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        }

        // FAQ Section
        if (section.type === 'faq') {
          return (
            <section key={section.id} className="py-12 sm:py-16 px-4 sm:px-6 bg-white border-y border-[#DFE3E8]">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10 space-y-2">
                  <span className="text-xs font-bold text-[#FF6500] uppercase tracking-wider">
                    Réponses Claires
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002244]">
                    {section.title || 'Questions Fréquentes'}
                  </h2>
                  {section.subtitle && (
                    <p className="text-sm text-[#637381]">{section.subtitle}</p>
                  )}
                </div>

                <div className="space-y-3">
                  {section.data?.questions?.map((item: any, qIdx: number) => (
                    <details
                      key={qIdx}
                      className="group bg-[#F4F6F8]/60 border border-[#DFE3E8] rounded-2xl p-5 open:bg-white open:shadow-md transition-all duration-200 cursor-pointer"
                    >
                      <summary className="font-bold text-sm sm:text-base text-[#002244] flex items-center justify-between list-none">
                        <span>{item.q}</span>
                        <ChevronDown className="w-4 h-4 text-[#FF6500] transition-transform duration-300 group-open:rotate-180 shrink-0 ml-2" />
                      </summary>
                      <p className="mt-3 text-xs sm:text-sm text-[#637381] leading-relaxed pt-2 border-t border-[#DFE3E8]">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          );
        }

        // Direct Order Form Section
        if (section.type === 'order_form') {
          return (
            <section
              key={section.id}
              ref={orderFormRef}
              className="py-12 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-white via-orange-50/20 to-white"
            >
              <div className="max-w-3xl mx-auto">
                {/* Form Card */}
                <div className="bg-white rounded-3xl border-2 border-[#FF6500] shadow-2xl p-6 sm:p-10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-[#FF6500] text-white text-[11px] font-bold px-4 py-1 rounded-bl-2xl uppercase tracking-wider font-mono">
                    Formulaire Express COD
                  </div>

                  <div className="text-center mb-8 space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002244]">
                      {section.title || 'Finalisez Votre Commande'}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#637381]">
                      {section.subtitle || 'Paiement à la livraison après inspection de votre colis.'}
                    </p>
                    {section.data?.urgentNotice && (
                      <div className="inline-block bg-orange-100 text-[#FF6500] text-xs font-bold px-3 py-1 rounded-full border border-orange-200 mt-2">
                        {section.data.urgentNotice}
                      </div>
                    )}
                  </div>

                  {/* Success State */}
                  {successOrderNumber ? (
                    <div className="py-8 text-center space-y-5 animate-in fade-in duration-300">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                        <CheckCircle className="w-10 h-10" />
                      </div>
                      <h3 className="text-2xl font-extrabold text-[#002244]">
                        Commande Confirmée avec Succès !
                      </h3>
                      <div className="p-4 bg-[#F4F6F8] rounded-2xl max-w-md mx-auto border border-[#DFE3E8] space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#637381]">Numéro de commande :</span>
                          <span className="font-mono font-bold text-[#FF6500]">{successOrderNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#637381]">Montant à payer au livreur :</span>
                          <span className="font-bold text-[#002244]">{totalAmount.toLocaleString('fr-FR')} DZD</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#637381]">Destination :</span>
                          <span className="font-semibold text-[#002244]">{commune}, {currentWilaya.name}</span>
                        </div>
                      </div>
                      <p className="text-xs text-[#637381] max-w-md mx-auto">
                        Notre équipe de confirmation va vous appeler sur le <strong className="text-[#002244]">{customerPhone}</strong> pour valider l'expédition. Préparez le montant en espèces pour le livreur.
                      </p>
                      <div className="flex justify-center gap-3 pt-2">
                        <a
                          href={`https://wa.me/${contactWhatsApp}?text=Bonjour%20DzMahall,%20je%20viens%20de%20passer%20la%20commande%20${successOrderNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Confirmer sur WhatsApp</span>
                        </a>
                        <button
                          onClick={() => {
                            setSuccessOrderNumber(null);
                            setCustomerName('');
                            setCustomerPhone('');
                          }}
                          className="px-5 py-2.5 bg-white border border-[#DFE3E8] text-[#212B36] rounded-xl text-xs font-bold hover:bg-slate-50"
                        >
                          Nouvelle commande
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleOrderSubmit} className="space-y-6">
                      {/* Honeypot anti-bot invisible field */}
                      <div className="sr-only" aria-hidden="true">
                        <label htmlFor="lp_website_url_hp">Ne pas remplir ce champ</label>
                        <input
                          id="lp_website_url_hp"
                          name="lp_website_url_hp"
                          type="text"
                          tabIndex={-1}
                          autoComplete="off"
                          value={honeypot}
                          onChange={(e) => setHoneypot(e.target.value)}
                        />
                      </div>

                      {errorMessage && (
                        <div className="p-3.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{errorMessage}</span>
                        </div>
                      )}

                      {/* Carrier Assurance Badge */}
                      <div className="p-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-2xl border border-blue-200/80 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-[#002244]">
                          <Truck className="w-4 h-4 text-[#FF6500] shrink-0" />
                          <span className="font-medium">Transporteur officiel assigné :</span>
                        </div>
                        <span className="font-extrabold text-[#002244] bg-white px-2.5 py-1 rounded-xl border border-blue-200 text-[11px] shadow-2xs">
                          {page.shippingCompanyNameSnapshot || 'Yalidine Fast Logistics'}
                        </span>
                      </div>

                      {/* Variant Selection if available */}
                      {product?.variants && product.variants.length > 1 && (
                        <div>
                          <label className="block text-xs font-bold text-[#002244] mb-2">
                            1. Choisissez votre Modèle / Couleur :
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {product.variants.map((v) => {
                              const isSelected = selectedVariantId === v.id;
                              return (
                                <button
                                  type="button"
                                  key={v.id}
                                  onClick={() => setSelectedVariantId(v.id)}
                                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                                    isSelected
                                      ? 'border-[#FF6500] bg-orange-50/50 shadow-xs'
                                      : 'border-[#DFE3E8] bg-white hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    {v.color && (
                                      <span
                                        className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                                        style={{ backgroundColor: v.color }}
                                      />
                                    )}
                                    <span className="text-xs font-bold text-[#002244]">{v.name}</span>
                                  </div>
                                  <span className="text-[11px] font-mono text-[#637381]">
                                    {v.stock > 0 ? `${v.stock} en stock` : 'Rupture'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Quantity Selector */}
                      <div>
                        <label className="block text-xs font-bold text-[#002244] mb-2">
                          2. Quantité désirée :
                        </label>
                        <div className="flex items-center gap-3">
                          {[1, 2, 3].map((qty) => (
                            <button
                              type="button"
                              key={qty}
                              onClick={() => setQuantity(qty)}
                              className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                quantity === qty
                                  ? 'border-[#FF6500] bg-[#FF6500] text-white shadow-md shadow-orange-500/20'
                                  : 'border-[#DFE3E8] bg-white text-[#212B36] hover:bg-slate-50'
                              }`}
                            >
                              {qty} {qty > 1 ? 'articles' : 'article'}
                              {qty === 2 && ' (Le + Populaire)'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="space-y-4">
                        <label className="block text-xs font-bold text-[#002244]">
                          3. Vos Coordonnées de Livraison :
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <input
                              type="text"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              placeholder="Nom et Prénom *"
                              required
                              className="w-full px-3.5 py-3 rounded-xl border border-[#DFE3E8] text-xs font-semibold focus:outline-hidden focus:border-[#FF6500] bg-[#F4F6F8]/30"
                            />
                          </div>

                          <div>
                            <input
                              type="tel"
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              placeholder="Numéro de Téléphone (ex: 0660...) *"
                              required
                              className="w-full px-3.5 py-3 rounded-xl border border-[#DFE3E8] text-xs font-semibold focus:outline-hidden focus:border-[#FF6500] bg-[#F4F6F8]/30"
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

                        {/* Wilaya & Commune */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-[#637381] mb-1">
                              Wilaya (58 Wilayas)
                            </label>
                            <select
                              value={wilayaCode}
                              onChange={(e) => setWilayaCode(e.target.value)}
                              className="w-full px-3.5 py-3 rounded-xl border border-[#DFE3E8] text-xs font-semibold focus:outline-hidden focus:border-[#FF6500] bg-white cursor-pointer"
                            >
                              {effectiveWilayas.map((w) => (
                                <option key={w.code} value={w.code}>
                                  {w.code} - {w.name} ({w.nameAr})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-[#637381] mb-1">
                              Commune
                            </label>
                            <input
                              type="text"
                              value={commune}
                              onChange={(e) => setCommune(e.target.value)}
                              placeholder="Commune *"
                              required
                              className="w-full px-3.5 py-3 rounded-xl border border-[#DFE3E8] text-xs font-semibold focus:outline-hidden focus:border-[#FF6500] bg-[#F4F6F8]/30"
                            />
                          </div>
                        </div>

                        {/* Delivery Mode: Domicile vs Stop Desk */}
                        <div>
                          <label className="block text-[11px] font-semibold text-[#637381] mb-1.5">
                            Mode de Réception
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setDeliveryMode('home')}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                deliveryMode === 'home'
                                  ? 'border-[#FF6500] bg-orange-50/50 shadow-2xs'
                                  : 'border-[#DFE3E8] bg-white'
                              }`}
                            >
                              <div className="text-xs font-bold text-[#002244]">🏠 À Domicile (Bab Edar)</div>
                              <div className="text-[11px] text-[#637381] mt-0.5">
                                +{currentWilaya.homeDeliveryFee} DZD
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeliveryMode('desk')}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                deliveryMode === 'desk'
                                  ? 'border-[#FF6500] bg-orange-50/50 shadow-2xs'
                                  : 'border-[#DFE3E8] bg-white'
                              }`}
                            >
                              <div className="text-xs font-bold text-[#002244]">🏢 Bureau / Stop Desk</div>
                              <div className="text-[11px] text-[#637381] mt-0.5">
                                +{currentWilaya.deskDeliveryFee} DZD (Économique)
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Address */}
                        <div>
                          <input
                            type="text"
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Adresse précise ou quartier (ex: Cité 500 logts, Rue Principale)"
                            className="w-full px-3.5 py-3 rounded-xl border border-[#DFE3E8] text-xs font-semibold focus:outline-hidden focus:border-[#FF6500] bg-[#F4F6F8]/30"
                          />
                        </div>
                      </div>

                      {/* Total Calculation Card */}
                      <div className="p-4 rounded-2xl bg-[#002244] text-white space-y-2 text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>Sous-total ({quantity} article{quantity > 1 ? 's' : ''}) :</span>
                          <span className="font-mono">{subtotal.toLocaleString('fr-FR')} DZD</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Frais de livraison ({currentWilaya.name}) :</span>
                          <span className="font-mono">+{shippingCost.toLocaleString('fr-FR')} DZD</span>
                        </div>
                        <div className="pt-2 border-t border-slate-700 flex justify-between items-baseline text-sm font-bold">
                          <span>Total à payer au livreur :</span>
                          <span className="text-xl font-extrabold text-[#FF6500]">
                            {totalAmount.toLocaleString('fr-FR')} DZD
                          </span>
                        </div>
                      </div>

                      {/* High-risk additional confirmation challenge */}
                      {requiresChallenge && (
                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 space-y-2 text-xs">
                          <div className="font-bold text-amber-900 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-[#FF6500] shrink-0" />
                            <span>Vérification anti-erreur de commande COD</span>
                          </div>
                          {challengeReasons.length > 0 && (
                            <ul className="list-disc pl-4 text-[11px] text-amber-800 space-y-0.5">
                              {challengeReasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          )}
                          <label className="flex items-start gap-2 cursor-pointer pt-1 font-semibold text-amber-950">
                            <input
                              type="checkbox"
                              checked={challengeAccepted}
                              onChange={(e) => setChallengeAccepted(e.target.checked)}
                              className="mt-0.5 accent-[#FF6500]"
                            />
                            <span>
                              Je confirme que cette commande ({totalAmount.toLocaleString('fr-FR')} DZD) est réelle et que je suis joignable sur le numéro {customerPhone}.
                            </span>
                          </label>
                        </div>
                      )}

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 px-6 rounded-2xl bg-[#FF6500] hover:bg-[#e05900] disabled:bg-slate-300 text-white font-extrabold text-base shadow-xl shadow-orange-500/25 flex items-center justify-center gap-3 cursor-pointer transition-all active:scale-98"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            <span>{section.data?.buttonLabel || 'Confirmer Ma Commande (Paiement à Réception)'}</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center justify-center gap-4 text-[11px] text-[#637381] text-center">
                        <span className="flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Sans carte bancaire
                        </span>
                        <span className="flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Vérification avant paiement
                        </span>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </section>
          );
        }

        // Guarantee Badges
        if (section.type === 'guarantee') {
          return (
            <section key={section.id} className="py-10 px-4 sm:px-6 bg-[#002244] text-white">
              <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {section.data?.items?.map((gItem: any, gIdx: number) => (
                  <div key={gIdx} className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-[#FF6500] flex items-center justify-center shrink-0">
                      {renderIcon(gItem.icon)}
                    </div>
                    <div>
                      <div className="text-xs font-bold">{gItem.title}</div>
                      <div className="text-[11px] text-slate-300">{gItem.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        return null;
      })}

      {/* Footer */}
      <footer className="py-8 px-4 text-center bg-[#00172E] text-slate-400 text-xs border-t border-slate-800 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <DzMahallLogo size="sm" showText={true} showSubtitle={false} theme="dark" />
        </div>
        <p>© 2026 DzMahall. Commerce électronique professionnel en Algérie.</p>
        <div className="flex justify-center gap-4 text-[11px] text-slate-500">
          <span>Livraison express 58 Wilayas</span>
          <span>•</span>
          <span>Paiement à la livraison (Cash on Delivery)</span>
          <span>•</span>
          <span>Service Client : {contactPhone}</span>
        </div>
      </footer>
    </div>
  );
};
