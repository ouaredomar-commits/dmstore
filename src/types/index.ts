export type OrderStatus =
  | 'pending_confirmation' // En attente de confirmation (Appel / WhatsApp)
  | 'needs_review'         // À vérifier (Commande suspecte ou signalée)
  | 'confirmed'            // Confirmée par téléphone / WhatsApp
  | 'processing'           // En préparation
  | 'ready_to_ship'        // Prête à expédier
  | 'shipped'              // Expédiée
  | 'in_transit'           // En transit
  | 'out_for_delivery'     // En cours de livraison
  | 'delivered'            // Livrée & payée
  | 'delivery_failed'      // Échec livraison
  | 'returning'            // Retour en cours
  | 'returned'             // Retournée
  | 'cancelled';           // Annulée

export type OrderRiskLevel = 'low' | 'medium' | 'high';

export interface OrderContactAttempt {
  id: string;
  timestamp: string;
  channel: 'phone_call' | 'whatsapp' | 'sms_manual' | 'admin_review';
  outcome:
    | 'confirmed'
    | 'no_answer'
    | 'callback_requested'
    | 'needs_callback'
    | 'wrong_number'
    | 'refused_cancelled'
    | 'cancelled_by_customer';
  note?: string;
  operator: string;
}

export interface ProductOptionValue {
  id: string;
  label: string;
  colorHex?: string;
}

export interface ProductOption {
  id: string;
  name: string; // Ex: Taille, Couleur, Modèle, Pointure, Capacité
  style: 'buttons' | 'color_swatches' | 'dropdown';
  values: ProductOptionValue[];
}

export interface ProductImageItem {
  id: string;
  url: string;
  isPrimary?: boolean;
  source: 'upload' | 'url';
  fileName?: string;
  sizeBytes?: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  color?: string;
  size?: string;
  priceModifier?: number;
  stock: number;
  sku: string;
}

export interface BilingualCategoryName {
  fr: string;
  ar: string;
}

export interface SubCategoryItem {
  id: string;           // Identifiant technique stable (ex: 'sub-multimedia-ecrans')
  name: string;         // Libellé modifiable (ex: 'Multimédia & Écrans')
  description?: string; // Exemples / description
  order: number;
  isActive: boolean;
}

export interface CategoryItem {
  id: string;           // Identifiant technique stable (ex: 'cat-auto-moto')
  name: string;         // Libellé français principal (pour rétrocompatibilité)
  nameTranslations?: BilingualCategoryName; // Objet bilingue { fr, ar }
  icon?: string;        // Nom de l'icône Lucide (ex: 'Car', 'Cpu', 'Laptop'...)
  slug: string;
  description?: string;
  order: number;
  isActive: boolean;
  subcategories: SubCategoryItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;           // Identifiant ou slug de la catégorie principale (ex: 'cat-auto-moto', 'uncategorized')
  categoryId?: string;        // Identifiant technique stable de la catégorie (alias explicite)
  categoryLabel: string;      // Libellé affiché de la catégorie
  subcategory?: string;       // Nom en français de la sous-catégorie (ex: 'Multimédia & Écrans')
  subcategoryId?: string;     // Identifiant de la sous-catégorie (ex: 'sub-multimedia-ecrans')
  subcategoryLabel?: string;  // Libellé affiché de la sous-catégorie
  price: number;              // Prix de vente effectif (DZD)
  originalPrice?: number;     // Ancien prix normal barré (DZD) si prix réduit
  purchaseCost: number;       // Coût d'achat (DZD)
  advertisingCost: number;    // Coût pub estimé (DZD)
  packagingCost: number;      // Coût emballage (DZD)
  sku: string;
  stockQuantity: number;
  description: string;
  features: string[];
  imageUrls: string[];
  images?: ProductImageItem[];
  options?: ProductOption[];
  variants: ProductVariant[];
  isActive: boolean;
  isFeatured?: boolean;
  createdAt: string;
  updatedAt?: string;
  _optimisticStatus?: 'saving' | 'deleting' | 'error';
  _tempId?: string;
}

export interface CartItem {
  product: Product;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;        // Ex: DZM-2026-1042
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerPhone: string;
  wilayaCode: string;         // '01' à '58'
  wilayaName: string;
  commune: string;
  deliveryAddress?: string;
  deliveryMode: 'home' | 'desk'; // 🏠 Domicile ou 🏢 Point Relais / Stop Desk
  deskName?: string;
  deliveryServiceType?: 'express' | 'economique'; // ⚡ Express (24h) ou 🌱 Économique (48h)
  isFreeShippingExplicit?: boolean; // Vrai UNIQUEMENT si l'administrateur a explicitement validé la gratuité (jamais par défaut)
  freeShippingJustification?: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  shippingFee?: number;       // Alias direct frais de livraison
  discount: number;
  totalAmount: number;        // Total à payer à la livraison (DZD)
  total?: number;             // Alias direct montant total
  paymentMethod: 'COD';       // Paiement à la livraison
  paymentStatus: 'pending' | 'collected';
  status: OrderStatus;

  // Transporteur & Expédition
  carrierId?: string;         // 'yalidine', 'guepex', 'ecotrack', etc.
  carrierName?: string;
  shippingCompanyId?: string; // Identifiant société de livraison
  shippingCompanyNameSnapshot?: string; // Snapshot nom du transporteur
  trackingNumber?: string;
  carrierTrackingUrl?: string;
  trackingStatus?: 'created' | 'picked_up' | 'in_transit' | 'delivered' | 'returned';

  // Attribution Landing Page & Produit
  landingPageId?: string;
  landingPageSlug?: string;
  landingPageTitle?: string;
  productId?: string;
  selectedVariantId?: string;

  // Paramètres publicitaires UTM
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;

  notes?: string;
  statusHistory: {
    status: OrderStatus;
    timestamp: string;
    note?: string;
    updatedBy?: string;
  }[];

  // Protection Anti-Fraude & Vérification avant expédition
  normalizedPhone?: string;
  riskLevel?: OrderRiskLevel;
  riskScore?: number;
  riskReasons?: string[];
  phoneDuplicateFlags?: PhoneDuplicateAlertFlags;
  idempotencyKey?: string;
  confirmationHistory?: OrderContactAttempt[];
  contactAttempts?: OrderContactAttempt[];

  // État de notification e-mail distinct du statut commercial (PARTIE 3)
  notificationStatus?: 'pending' | 'sent' | 'failed' | 'not_configured' | 'skipped_no_recipients' | 'duplicate_prevented';
  notificationError?: string;

  // Archivage / Suppression logique sécurisée (Réservée Admin)
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
}

export interface OrderDeletionAuditLog {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  orderStatusBefore: OrderStatus;
  hadTrackingNumber: boolean;
  trackingNumber?: string;
  carrierId?: string;
  mode: 'archive' | 'permanent' | 'restore';
  reason?: string;
  adminUser: string;
  adminRole: string;
  timestamp: string;
  result: 'archived' | 'deleted' | 'restored';
}

export type DeliveryServiceType = 'express' | 'economique';

export type GuepexApiDeliveryType = 'express' | 'eco';

export interface GuepexTariffQuote {
  serviceType: DeliveryServiceType;
  apiDeliveryType?: GuepexApiDeliveryType;
  fee: number;
  source: 'guepex_api' | 'dzmahall_config' | 'manual_override';
  isVerified: boolean;
  message?: string;
}

export interface ShipmentDiagnosticProof {
  carrierId: string;
  orderNumber: string;
  orderOrigin: 'landing_page' | 'storefront_or_admin';
  selectedServiceType: DeliveryServiceType | null;
  normalizedApiValue: GuepexApiDeliveryType | null;
  apiFieldName: string | null;
  serviceChoiceSource: 'shipment_option' | 'order_persisted' | 'carrier_config' | 'missing_or_invalid' | 'not_applicable';
  shippingFeeDzd: number;
  codTotalDzd: number;
  requestResult: 'dry_run_ready' | 'live_created' | 'duplicate_prevented' | 'blocked_validation' | 'api_error';
  confirmedServiceTypeByGuepex: string | null;
  confirmationNote: string;
  timestamp: string;
}

export interface Wilaya {
  code: string;
  name: string;
  nameAr: string;
  homeDeliveryFee: number;
  deskDeliveryFee: number;
  expressDeliveryFee?: number;
  ecoDeliveryFee?: number;
  estimatedDeliveryHours: string;
  communes: string[];
  deskAvailable: boolean;
}

export type CarrierAdapterFamily =
  | 'yalidine'
  | 'guepex'
  | 'ecotrack'
  | 'procolis_zrexpress'
  | 'maystro'
  | 'noest'
  | 'pending_docs';

export type CarrierConnectionStatus =
  | 'connected'
  | 'not_configured'
  | 'incomplete'
  | 'invalid_credentials'
  | 'network_error'
  | 'pending_docs'
  | 'error'
  | 'disabled';

export interface CarrierFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  value: string;
  placeholder?: string;
  required: boolean;
  helperText?: string;
  hasSavedSecret?: boolean;
}

export interface CarrierConfig {
  id: string;
  name: string;
  logoUrl?: string;
  description: string;
  status: CarrierConnectionStatus;
  environment: 'production' | 'test';
  adapterFamily?: CarrierAdapterFamily;
  platformLabel?: string;
  docStatus?: 'official_verified' | 'ecotrack_verified' | 'pending_documentation';
  pendingDocsRequirements?: string[];
  testEndpointInfo?: string;
  parcelEndpointInfo?: string;
  lastTestedAt?: string;
  lastError?: string;
  lastDiagnostic?: string;
  supportsWebhooks: boolean;
  supportsLabelPrinting: boolean;
  supportsTracking: boolean;
  fields: CarrierFieldConfig[];
  officialPortalUrl: string;
  trackingUrlTemplate?: string;
  defaultServiceType?: DeliveryServiceType;
  wilayaCoverage?: string;
}

export interface ProfitabilityInputs {
  sellingPrice: number;        // DZD
  purchaseCost: number;        // DZD
  adCostPerOrder: number;      // DZD (CPA)
  packagingCost: number;       // DZD
  shippingFeeSeller: number;   // DZD (frais vendeur si offerts)
  returnCost: number;          // DZD (frais retour transporteur)
  confirmationRate: number;    // %
  deliveryRate: number;        // %
  ordersTarget: number;        // Quantité de commandes
}

export type LandingPageSectionType =
  | 'promo_banner'
  | 'hero'
  | 'benefits'
  | 'features'
  | 'gallery'
  | 'testimonials'
  | 'faq'
  | 'order_form'
  | 'guarantee';

export interface LandingPageSection {
  id: string;
  type: LandingPageSectionType;
  enabled: boolean;
  title?: string;
  subtitle?: string;
  data: Record<string, any>;
}

export interface LandingPage {
  id: string;
  slug: string;
  title: string;
  productId: string;
  shippingCompanyId: string;           // Société de livraison obligatoire
  shippingCompanyNameSnapshot: string; // Nom du transporteur (snapshot)
  deliveryServiceType?: DeliveryServiceType; // Niveau de service pour Guepex ('express' | 'economique')
  status: 'draft' | 'published' | 'archived';
  themeColor: string;
  accentColor: string;
  headline: string;
  seoTitle: string;
  seoDescription: string;
  pixelId?: string;                   // Meta Pixel ID
  viewsCount: number;
  ordersCount: number;
  sections: LandingPageSection[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  username: string;
  role: 'admin' | 'manager' | 'operator';
  email?: string;
  name?: string;
  lastLoginAt: string;
}

export interface AdminCredentials {
  username: string;
  password: string;
}

export interface NotificationRecipient {
  id: string;
  email: string;
  label?: string;
  isActive: boolean;
  notifyOnNewOrder: boolean;
  createdAt: string;
  updatedAt?: string;
  lastNotifiedAt?: string;
  lastTestSentAt?: string;
  lastTestStatus?: 'sent' | 'failed' | 'not_configured';
}

export type OrderNotificationStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'not_configured'
  | 'skipped_no_recipients'
  | 'duplicate_prevented';

export interface OrderNotificationLog {
  id: string; // Same as orderId for strict 1:1 idempotency per order
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  wilayaName: string;
  commune: string;
  totalAmount: number;
  sourceLabel: string;
  subject: string;
  recipients: string[];
  status: OrderNotificationStatus;
  provider: string;
  message: string;
  errorDetail?: string;
  attemptsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailProviderStatus {
  configured: boolean;
  configState?: 'configured' | 'incomplete' | 'not_configured';
  statusLabel?: string;
  passwordStatusLabel?: string;
  explicitlyDeleted?: boolean;
  provider: 'smtp' | 'resend' | 'brevo' | 'none';
  providerLabel: string;
  senderEmail: string;
  smtpFrom?: string;
  missingVars: string[];
  setupInstructions: string[];
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  passDefined?: boolean;
  passLength?: number;
  isValidAppPasswordFormat?: boolean;
  authWarning?: string;
  lastVerifyStatus?: 'verified' | 'auth_failed' | 'network_error' | 'not_tested';
  lastVerifyMessage?: string;
  updatedAt?: string;
}

export type WatchlistStatus = 'watched' | 'blocked' | 'trusted';

export interface FraudWatchlistEntry {
  id: string; // Numéro normalisé (ex: 0550123456)
  phone: string;
  status: WatchlistStatus;
  reason: string;
  notes?: string;
  expiresAt?: string; // ISO date d'expiration optionnelle du blocage
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FraudProtectionSettings {
  id: string; // 'global'
  enabled: boolean;
  maxOrdersPerPhonePerHour: number;
  maxOrdersPerPhonePerDay: number;
  maxOrdersPerSessionPerHour: number;
  duplicateWindowMinutes: number;
  minFormFillTimeMs: number;
  highQuantityThreshold: number;
  highAmountThreshold: number;
  autoFlagMediumRiskAsNeedsReview: boolean;
  requireChallengeOnHighRisk: boolean;
  defaultBlockDurationHours: number;
  updatedAt: string;
  updatedBy?: string;
}

export type SecurityEventType =
  | 'bot_honeypot'
  | 'fast_submission'
  | 'rate_limit_phone'
  | 'rate_limit_session'
  | 'blocked_phone'
  | 'price_manipulation_attempt'
  | 'stock_insufficient'
  | 'duplicate_order_prevented'
  | 'suspicious_order_flagged'
  | 'invalid_payload'
  | 'unauthorized_admin_attempt';

export interface SecurityEventLog {
  id: string;
  timestamp: string;
  eventType: SecurityEventType;
  severity: 'low' | 'medium' | 'high';
  phone?: string;
  sessionFingerprint?: string; // Hash anonymisé court (jamais l'IP en clair)
  source: 'storefront' | 'product_page' | 'landing_page' | 'api' | 'admin';
  reason: string;
  actionTaken: 'blocked' | 'flagged_needs_review' | 'challenge_required' | 'deduplicated';
  orderNumber?: string;
  metadata?: string;
}

export type CancellationOrigin = 'customer' | 'admin_or_carrier' | 'unknown';

export interface PhoneDuplicateAlertFlags {
  /** A. Numéro déjà utilisé dans au moins une commande précédente */
  hasPreviousOrders: boolean;
  previousOrdersCount: number;
  /** Indique si le numéro possède au moins une commande livrée avec succès (client habituel) */
  isReturningDeliveredCustomer: boolean;
  /** B. Au moins une commande précédente dont le statut commercial est réellement 'cancelled' */
  hasCancelledOrders: boolean;
  cancelledOrdersCount: number;
  cancelledOrderDates: string[];
  cancelledByCustomerCount: number;
  cancelledByAdminOrCarrierCount: number;
  /** C. Commande récente en attente ou en cours de traitement */
  hasRecentActiveOrder: boolean;
  recentActiveOrdersCount: number;
  /** Indique si la commande récente porte sur les mêmes produits et quantités */
  hasRecentIdenticalOrder: boolean;
}

/**
 * Réponse publique sécurisée (zéro donnée personnelle d'un autre client exposée)
 */
export interface PublicPhoneCheckResult {
  isValidPhone: boolean;
  normalizedPhone: string;
  formattedPhone: string;
  hasPreviousOrders: boolean;
  isReturningCustomerHint: boolean;
  hasCancelledOrders: boolean;
  hasRecentActiveOrder: boolean;
  isSameItemsRecentOrder: boolean;
  alerts: {
    usedBeforeAlert?: string;
    usedBeforeSubtext?: string;
    cancelledAlert?: string;
    recentOrderAlert?: string;
    recentOrderSubtext?: string;
  };
}

export interface AdminPhoneHistoryOrderItem {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  wilayaCode: string;
  wilayaName: string;
  commune: string;
  totalAmount: number;
  status: OrderStatus;
  itemsSummary: string;
  items: {
    productId: string;
    productName: string;
    variantName?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  cancellationOrigin?: CancellationOrigin;
  cancellationReasonNote?: string;
  isCurrentOrder?: boolean;
}

export interface AdminPhoneHistorySummary {
  normalizedPhone: string;
  formattedPhone: string;
  totalOrdersCount: number;
  flags: PhoneDuplicateAlertFlags;
  orders: AdminPhoneHistoryOrderItem[];
}
