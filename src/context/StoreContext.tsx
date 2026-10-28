import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Product,
  CartItem,
  Order,
  OrderStatus,
  CarrierConfig,
  Wilaya,
  LandingPage,
  AdminUser,
  AdminCredentials,
  CategoryItem,
  SubCategoryItem,
  NotificationRecipient,
  OrderNotificationLog,
  EmailProviderStatus,
  FraudWatchlistEntry,
  FraudProtectionSettings,
  SecurityEventLog,
  OrderContactAttempt,
  DeliveryServiceType,
  GuepexTariffQuote,
  ShipmentDiagnosticProof,
  OrderDeletionAuditLog,
} from '../types';
import { DEFAULT_FRAUD_SETTINGS } from '../utils/orderSecurity';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import {
  INITIAL_CATEGORIES,
  LEGACY_PLACEHOLDER_CATEGORY_IDS,
  slugifyCategoryName,
} from '../data/initialCategories';
import { INITIAL_CARRIERS } from '../data/initialCarriers';
import { INITIAL_ORDERS } from '../data/initialOrders';
import { INITIAL_LANDING_PAGES } from '../data/initialLandingPages';
import { ALGERIA_WILAYAS } from '../data/wilayas';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  testConnection,
  subscribeToProducts,
  saveProductToFirestore,
  saveProductsBatchToFirestore,
  deleteProductFromFirestore,
  subscribeToOrders,
  saveOrderToFirestore,
  deleteOrderFromFirestore,
  seedInitialOrdersIfEmpty,
  findOrderByQueryFromFirestore,
  subscribeToLandingPages,
  saveLandingPageToFirestore,
  deleteLandingPageFromFirestore,
  seedInitialLandingPagesIfEmpty,
  subscribeToCategories,
  saveCategoryToFirestore,
  saveCategoriesBatchToFirestore,
  seedInitialCategoriesIfEmpty,
  subscribeToNotificationRecipients,
  getActiveNotificationRecipientsFromFirestore,
  saveNotificationRecipientToFirestore,
  deleteNotificationRecipientFromFirestore,
  subscribeToOrderNotifications,
  getOrderNotificationFromFirestore,
  saveOrderNotificationToFirestore,
} from '../firebase/firestoreService';

/**
 * Pure TypeScript SHA-256 implementation so admin credentials are verified via cryptographic digest
 * without exposing plaintext passwords in the client code or browser storage.
 */
function sha256Hex(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      void i2;
    }
    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

const AUTHORIZED_ADMIN_HASHES = [
  '0eff30316afbff492b7c5a16adf1e742841f70cc6e2179ac2aa0d813c36834df',
  '6051fc84a7a0d74c225fb18a496b09952da5642e60723ecae543298edd7d82d6',
];
const AUTHORIZED_ADMIN_IDENTIFIERS = ['admin', 'ouaredomar@gmail.com', 'dzmahall'];

interface StoreContextType {
  // Cloud Sync
  isFirebaseConnected: boolean;
  syncLocalToCloud: () => Promise<void>;

  // Navigation
  currentRoute: string;
  navigateTo: (route: string) => void;
  selectedProductSlug: string | null;
  setSelectedProductSlug: (slug: string | null) => void;
  selectedOrderId: string | null;
  setSelectedOrderId: (orderId: string | null) => void;

  // Cart
  cart: CartItem[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (product: Product, quantity?: number, variantId?: string) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateCartQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;

  // Products & Authoritative Catalog Sync
  products: Product[];
  isCatalogLoading: boolean;
  isCatalogSyncing: boolean;
  lastCatalogSyncedAt: string | null;
  pendingProductIds: string[];
  catalogError: string | null;
  refreshCatalogFromServer: (options?: { delayMs?: number; simulateError?: boolean }) => Promise<void>;
  refreshCatalog: (options?: { delayMs?: number; simulateError?: boolean }) => Promise<void>;
  addProduct: (
    product: Omit<Product, 'id' | 'createdAt'>,
    options?: { simulateNetworkError?: boolean; delayMs?: number }
  ) => Promise<Product>;
  updateProduct: (
    id: string,
    updates: Partial<Product>,
    options?: { simulateNetworkError?: boolean; delayMs?: number }
  ) => Promise<void>;
  deleteProduct: (
    id: string,
    options?: { simulateNetworkError?: boolean; delayMs?: number }
  ) => Promise<{ success: boolean; error?: string; rolledBack?: boolean }>;
  importProductsBatch: (
    incomingProducts: Product[],
    mode: 'add_new' | 'update_existing' | 'create_new_sku',
    onProgress?: (processed: number, total: number) => void
  ) => Promise<{ added: number; updated: number; skipped: number }>;

  // Categories & Subcategories
  categories: CategoryItem[];
  addCategory: (data: { name: string; description?: string }) => Promise<CategoryItem>;
  updateCategory: (id: string, updates: Partial<CategoryItem>) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;
  addSubCategory: (categoryId: string, data: { name: string; description?: string }) => Promise<void>;
  updateSubCategory: (categoryId: string, subCategoryId: string, updates: Partial<SubCategoryItem>) => Promise<void>;
  reorderSubCategories: (categoryId: string, orderedSubIds: string[]) => Promise<void>;

  // Landing Pages
  landingPages: LandingPage[];
  selectedLandingPageSlug: string | null;
  setSelectedLandingPageSlug: (slug: string | null) => void;
  addLandingPage: (page: Omit<LandingPage, 'id' | 'createdAt' | 'updatedAt' | 'viewsCount' | 'ordersCount'>) => Promise<LandingPage>;
  updateLandingPage: (id: string, updates: Partial<LandingPage>) => Promise<void>;
  deleteLandingPage: (id: string) => Promise<void>;
  duplicateLandingPage: (id: string) => Promise<LandingPage>;
  incrementLandingPageView: (slugOrId: string) => void;

  // Orders
  orders: Order[];
  createOrder: (orderData: {
    customerName: string;
    customerPhone: string;
    wilayaCode: string;
    commune: string;
    deliveryAddress?: string;
    deliveryMode: 'home' | 'desk';
    deskName?: string;
    notes?: string;
    items?: CartItem[];
    // Attribution Landing Page & Transporteur
    landingPageId?: string;
    landingPageSlug?: string;
    landingPageTitle?: string;
    shippingCompanyId?: string;
    shippingCompanyNameSnapshot?: string;
    shippingFee?: number;
    // Paramètres UTM
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  }) => Order;
  trackOrderByQuery: (queryStr: string) => Promise<Order | null>;
  refreshOrdersFromServer: () => Promise<Order[]>;
  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  updateOrderCarrier: (
    orderId: string,
    carrierId: string,
    trackingNumber?: string,
    note?: string,
    deliveryServiceType?: DeliveryServiceType,
    shippingFee?: number
  ) => void;
  orderDeletionAuditLogs: OrderDeletionAuditLog[];
  deleteOrder: (
    orderId: string,
    options?: { mode?: 'archive' | 'permanent' | 'restore'; reason?: string }
  ) => Promise<{
    success: boolean;
    message: string;
    mode?: 'archive' | 'permanent' | 'restore';
    order?: Order;
    deletedOrderId?: string;
    warnings?: string[];
  }>;

  // Carriers & Shipping
  carriers: CarrierConfig[];
  refreshCarriersFromServer: () => Promise<CarrierConfig[]>;
  updateCarrier: (
    id: string,
    updates: Partial<CarrierConfig> & { clearSecretKeys?: string[] }
  ) => Promise<boolean>;
  testCarrierConnection: (
    id: string,
    overrideFields?: { key: string; value: string }[]
  ) => Promise<{
    success: boolean;
    status?: string;
    message: string;
    diagnostic?: string;
    endpointTested?: string;
  }>;
  shipOrderViaCarrier: (
    order: Order,
    carrierId: string,
    options?: {
      dryRun?: boolean;
      confirmLiveCreation?: boolean;
      serviceType?: DeliveryServiceType;
      shippingFee?: number;
      allowExplicitFreeShipping?: boolean;
      isExplicitFreeShippingConfirmed?: boolean;
      freeShippingJustification?: string;
    }
  ) => Promise<{
    success: boolean;
    dryRun?: boolean;
    duplicatePrevented?: boolean;
    trackingNumber?: string;
    message: string;
    requestPreview?: {
      method: string;
      url: string;
      headers: Record<string, string>;
      payload: any;
    };
    shipmentDiagnostic?: ShipmentDiagnosticProof;
    order?: Order;
    errorDetail?: string;
  }>;
  getGuepexTariffQuote: (
    wilayaCode: string,
    serviceType: DeliveryServiceType,
    isStopDesk?: boolean
  ) => Promise<GuepexTariffQuote>;
  runCarrierDiagnostics: () => Promise<any>;
  wilayas: Wilaya[];
  updateWilayaRates: (
    code: string,
    homeFee: number,
    deskFee: number,
    expressFee?: number,
    ecoFee?: number
  ) => void;

  // Brand / Contact Info (from uploaded business card)
  brandName: string;
  contactPhone: string;
  contactWhatsApp: string;
  storeDomain: string;
  businessCardImageUrl: string;
  isCardModalOpen: boolean;
  setIsCardModalOpen: (open: boolean) => void;

  // Admin state & Security
  isAdminLoggedIn: boolean;
  isAdminAuthorized: boolean;
  adminAccessDenied: boolean;
  clearAdminAccessDenied: () => void;
  setIsAdminLoggedIn: (logged: boolean) => void;
  adminRole: 'admin' | 'manager' | 'operator';
  setAdminRole: (role: 'admin' | 'manager' | 'operator') => void;
  adminUser: AdminUser | null;
  adminCredentials: AdminCredentials;
  loginAdmin: (username: string, password: string, role?: 'admin' | 'manager' | 'operator') => { success: boolean; accessDenied?: boolean; error?: string };
  loginAdminWithGoogle: () => Promise<{ success: boolean; accessDenied?: boolean; error?: string }>;
  logoutAdmin: () => void;
  updateAdminCredentials: (newUsername: string, newPassword: string) => { success: boolean; message: string };

  // Order Email Notifications (Admin & Server-Side Dispatch)
  notificationRecipients: NotificationRecipient[];
  orderNotifications: OrderNotificationLog[];
  emailProviderStatus: EmailProviderStatus | null;
  refreshEmailProviderStatus: () => Promise<EmailProviderStatus | null>;
  refreshNotificationRecipientsFromServer: () => Promise<NotificationRecipient[]>;
  addNotificationRecipient: (data: {
    email: string;
    label?: string;
    isActive?: boolean;
    notifyOnNewOrder?: boolean;
  }) => Promise<{ success: boolean; message: string; recipient?: NotificationRecipient }>;
  updateNotificationRecipient: (
    id: string,
    updates: Partial<Pick<NotificationRecipient, 'email' | 'label' | 'isActive' | 'notifyOnNewOrder'>>
  ) => Promise<{ success: boolean; message: string }>;
  deleteNotificationRecipient: (id: string) => Promise<{ success: boolean; message: string }>;
  sendTestNotificationEmail: (targetEmail?: string) => Promise<{
    success: boolean;
    status: string;
    message: string;
    errorDetail?: string;
    testedRecipients?: string[];
  }>;
  retryOrderNotification: (orderId: string) => Promise<{
    success: boolean;
    status: string;
    message: string;
    errorDetail?: string;
  }>;
  verifySmtpConnection: () => Promise<{
    success: boolean;
    status: string;
    message: string;
    errorDetail?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser?: string;
    passLength?: number;
    isValidAppPasswordFormat?: boolean;
  }>;
  saveSmtpAppPassword: (
    appPassword: string,
    options?: {
      smtpHost?: string;
      smtpUser?: string;
      smtpPort?: number;
      smtpSecure?: boolean;
      smtpFrom?: string;
    }
  ) => Promise<{
    success: boolean;
    saved?: boolean;
    verified?: boolean;
    status?: string;
    message: string;
    errorDetail?: string;
  }>;
  deleteSmtpConfiguration: () => Promise<{
    success: boolean;
    verifiedDeleted?: boolean;
    status?: string;
    message: string;
    errorDetail?: string;
  }>;

  // Anti-Spam, Anti-Fake COD Orders & Pre-Shipping Confirmation
  submitSecureOrder: (orderData: {
    customerName: string;
    customerPhone: string;
    wilayaCode: string;
    commune: string;
    deliveryAddress?: string;
    deliveryMode: 'home' | 'desk';
    deskName?: string;
    notes?: string;
    items?: CartItem[];
    landingPageId?: string;
    landingPageSlug?: string;
    landingPageTitle?: string;
    shippingCompanyId?: string;
    shippingCompanyNameSnapshot?: string;
    deliveryServiceType?: DeliveryServiceType;
    shippingFee?: number;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    honeypot?: string;
    formElapsedMs?: number;
    idempotencyKey?: string;
    challengeConfirmed?: boolean;
    source?: 'storefront' | 'product_page' | 'landing_page' | 'api';
  }) => Promise<{
    allowed: boolean;
    code: string;
    message: string;
    order?: Order;
    duplicatePrevented?: boolean;
    requiresConfirmationChallenge?: boolean;
    requiresAdditionalConfirmation?: boolean;
    riskLevel?: 'low' | 'medium' | 'high';
    riskReasons?: string[];
  }>;
  recordOrderContactAttempt: (
    orderId: string,
    attempt: {
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
    }
  ) => Promise<void>;
  fraudWatchlist: FraudWatchlistEntry[];
  fraudSettings: FraudProtectionSettings;
  securityEvents: SecurityEventLog[];
  refreshFraudOverview: () => Promise<void>;
  upsertWatchlistPhone: (data: {
    phone: string;
    status: 'watched' | 'blocked' | 'trusted';
    reason: string;
    notes?: string;
    durationHours?: number | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  removeWatchlistPhone: (phone: string) => Promise<boolean>;
  saveFraudSettings: (settings: Partial<FraudProtectionSettings>) => Promise<boolean>;
  runSecuritySelfTests: () => Promise<{
    passed: number;
    total: number;
    allPassed: boolean;
    results: { id: number; name: string; passed: boolean; expected: string; actual: string }[];
  }>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Brand settings directly extracted from uploaded photo
  const brandName = 'DzMahall';
  const contactPhone = '+213 660 769 386';
  const contactWhatsApp = '213660769386';
  const storeDomain = 'DzMahall.store';
  const businessCardImageUrl = '/assets/aistudio/carte_visite_dzmahall_1080x1920_d725b011.png';

  // Navigation: Dynamically read from browser URL on initial load and refresh
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    if (typeof window === 'undefined') return '/';
    const pathname = window.location.pathname || '/';
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    if (hash.startsWith('#/')) {
      return hash.slice(1);
    }
    return pathname + search;
  });
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);

  // Admin Credentials & Security (stored as SHA-256 hash, never plaintext)
  const [adminCredentials, setAdminCredentials] = useState<AdminCredentials>(() => {
    try {
      const saved = localStorage.getItem('dzmahall_admin_credentials_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.username) {
          return {
            username: String(parsed.username),
            password: String(parsed.passwordHash || ''),
          };
        }
      }
      // Migrate legacy stored credentials if present in browser storage
      const legacy = localStorage.getItem('dzmahall_admin_credentials');
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (parsedLegacy && parsedLegacy.username && parsedLegacy.password) {
          const hashed = sha256Hex(String(parsedLegacy.password));
          localStorage.setItem(
            'dzmahall_admin_credentials_v2',
            JSON.stringify({ username: parsedLegacy.username, passwordHash: hashed })
          );
          localStorage.removeItem('dzmahall_admin_credentials');
          return { username: String(parsedLegacy.username), password: hashed };
        }
      }
    } catch (e) {
      console.warn(e);
    }
    return {
      username: 'admin',
      password: '',
    };
  });

  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => {
    try {
      const isAuth = sessionStorage.getItem('dzmahall_admin_auth') === 'true';
      const savedUser = sessionStorage.getItem('dzmahall_admin_user');
      if (isAuth && savedUser) {
        const parsed = JSON.parse(savedUser) as AdminUser;
        if (
          parsed &&
          parsed.username &&
          ['admin', 'manager', 'operator'].includes(parsed.role)
        ) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    try {
      const isAuth = sessionStorage.getItem('dzmahall_admin_auth') === 'true';
      const savedUser = sessionStorage.getItem('dzmahall_admin_user');
      if (!isAuth || !savedUser) return false;
      const parsed = JSON.parse(savedUser);
      return Boolean(
        parsed &&
          parsed.username &&
          ['admin', 'manager', 'operator'].includes(parsed.role)
      );
    } catch {
      return false;
    }
  });

  const [adminAccessDenied, setAdminAccessDenied] = useState<boolean>(false);

  const [adminRole, setAdminRole] = useState<'admin' | 'manager' | 'operator'>(() => {
    try {
      const role = sessionStorage.getItem('dzmahall_admin_role') as any;
      if (['admin', 'manager', 'operator'].includes(role)) return role;
    } catch {}
    return 'admin';
  });

  const isAdminAuthorized = Boolean(
    isAdminLoggedIn &&
      !adminAccessDenied &&
      adminUser &&
      ['admin', 'manager', 'operator'].includes(adminUser.role)
  );

  const assertAdminAuthorized = () => {
    if (!isAdminAuthorized) {
      throw new Error('Accès refusé : opération réservée aux administrateurs autorisés.');
    }
  };

  const LEGACY_DEMO_PRODUCT_IDS = new Set<string>([
    'prod-1',
    'prod-2',
    'prod-3',
    'prod-4',
    'prod-5',
    'prod-6',
    'prod-7',
    'prod-8',
  ]);

  const [deletedProductIds, setDeletedProductIds] = useState<string[]>(() => {
    const base = new Set<string>(Array.from(LEGACY_DEMO_PRODUCT_IDS));
    try {
      const saved = localStorage.getItem('dzmahall_deleted_product_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          for (const id of parsed) {
            if (typeof id === 'string' && id.trim()) base.add(id.trim());
          }
        }
      }
    } catch {}
    return Array.from(base);
  });

  // Never initialize products with INITIAL_PRODUCTS; use cached non-deleted products while fetching authoritative server catalog
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('dzmahall_products');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      const excluded = new Set<string>(deletedProductIds);
      return parsed.filter(
        (p: any) =>
          p &&
          p.id &&
          !String(p.id).startsWith('temp-prod-') &&
          !excluded.has(String(p.id))
      );
    } catch {
      return [];
    }
  });

  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(true);
  const [isCatalogSyncing, setIsCatalogSyncing] = useState<boolean>(false);
  const [lastCatalogSyncedAt, setLastCatalogSyncedAt] = useState<string | null>(null);
  const [pendingProductIds, setPendingProductIds] = useState<string[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Refs de coordination asynchrone pour éviter les fermetures (closures) périmées et les écrasements d'état
  const deletedProductIdsRef = useRef<Set<string>>(new Set(deletedProductIds));
  const pendingDeletesRef = useRef<Map<string, { product: Product; index: number }>>(new Map());
  const pendingAddsRef = useRef<Map<string, Product>>(new Map());
  const productsRef = useRef<Product[]>(products);
  const catalogMutationSeqRef = useRef<number>(0);
  const lastCatalogSyncTimeRef = useRef<number>(0);
  const hasInitialServerCatalogLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    const nextSet = new Set<string>([
      ...Array.from(LEGACY_DEMO_PRODUCT_IDS),
      ...deletedProductIds,
      ...Array.from(pendingDeletesRef.current.keys()),
    ]);
    deletedProductIdsRef.current = nextSet;
  }, [deletedProductIds]);

  const syncPendingProductIdsState = () => {
    const ids = new Set<string>([
      ...Array.from(pendingDeletesRef.current.keys()),
      ...Array.from(pendingAddsRef.current.keys()),
    ]);
    setPendingProductIds(Array.from(ids));
  };

  // Orders are strictly restricted to authenticated & authorized admins
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentPublicOrders, setRecentPublicOrders] = useState<Order[]>([]);
  const [notificationRecipients, setNotificationRecipients] = useState<NotificationRecipient[]>(() => {
    try {
      const saved = localStorage.getItem('dzmahall_notification_recipients');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'rec-default-admin',
        email: 'ouaredomar@gmail.com',
        label: 'Administrateur Principal',
        isActive: true,
        notifyOnNewOrder: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ];
  });
  const [orderNotifications, setOrderNotifications] = useState<OrderNotificationLog[]>([]);
  const [emailProviderStatus, setEmailProviderStatus] = useState<EmailProviderStatus | null>(null);

  const [carriers, setCarriers] = useState<CarrierConfig[]>(() => {
    try {
      const saved = localStorage.getItem('dzmahall_carriers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_CARRIERS;
  });

  const [wilayas, setWilayas] = useState<Wilaya[]>(() => {
    try {
      const saved = localStorage.getItem('dzmahall_wilayas');
      return saved ? JSON.parse(saved) : ALGERIA_WILAYAS;
    } catch {
      return ALGERIA_WILAYAS;
    }
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('dzmahall_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [landingPages, setLandingPages] = useState<LandingPage[]>(() => {
    try {
      const saved = localStorage.getItem('dzmahall_landing_pages');
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list) && list.length > 0) {
          const existingIds = new Set(list.map((p) => p.id));
          const missingOfficial = INITIAL_LANDING_PAGES.filter((ip) => !existingIds.has(ip.id));
          return [...list, ...missingOfficial];
        }
      }
      return INITIAL_LANDING_PAGES;
    } catch {
      return INITIAL_LANDING_PAGES;
    }
  });

  const mergeWithOfficialCategories = (list: CategoryItem[]): CategoryItem[] => {
    const officialMap = new Map(INITIAL_CATEGORIES.map((c) => [c.id, c]));
    const cleaned = list
      .filter((c) => c && c.id && !LEGACY_PLACEHOLDER_CATEGORY_IDS.has(c.id))
      .map((c) => {
        const official = officialMap.get(c.id);
        if (!official) return c;
        return {
          ...official,
          ...c,
          icon: c.icon || official.icon,
          nameTranslations: c.nameTranslations || official.nameTranslations,
          subcategories:
            Array.isArray(c.subcategories) && c.subcategories.length > 0
              ? c.subcategories
              : official.subcategories,
        };
      });

    const existingIds = new Set(cleaned.map((c) => c.id));
    const missingOfficial = INITIAL_CATEGORIES.filter((ic) => !existingIds.has(ic.id));
    return [...cleaned, ...missingOfficial].sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const [categories, setCategories] = useState<CategoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('dzmahall_categories');
      if (saved) {
        const parsed: CategoryItem[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergeWithOfficialCategories(parsed);
        }
      }
      return INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  const [selectedLandingPageSlug, setSelectedLandingPageSlug] = useState<string | null>(null);

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  // Sauvegarde persistante dans le cache local du navigateur pour affichage instantané sans clignotement
  useEffect(() => {
    try {
      if (notificationRecipients.length > 0) {
        localStorage.setItem('dzmahall_notification_recipients', JSON.stringify(notificationRecipients));
      }
    } catch {}
  }, [notificationRecipients]);

  useEffect(() => {
    try {
      if (carriers.length > 0) {
        localStorage.setItem('dzmahall_carriers', JSON.stringify(carriers));
      }
    } catch {}
  }, [carriers]);

  // Source unique de vérité : Récupération du catalogue officiel depuis le serveur (/api/catalog)
  // Ne remplace jamais les données réelles par des produits de démonstration en cas d'échec,
  // et n'écrase jamais une modification optimiste ou confirmée plus récente (Test #7).
  const refreshCatalogFromServer = async (options?: {
    delayMs?: number;
    simulateError?: boolean;
  }): Promise<void> => {
    const requestMutationSeq = catalogMutationSeqRef.current;
    setIsCatalogSyncing(true);

    try {
      const simErr =
        options?.simulateError ||
        (typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('simulateCatalogError') === '1');
      const queryParams = new URLSearchParams();
      if (simErr) queryParams.set('simulateError', '1');
      if (options?.delayMs && options.delayMs > 0) {
        queryParams.set('delayMs', String(options.delayMs));
      }
      const qs = queryParams.toString();
      const endpoint = qs ? `/api/catalog?${qs}` : '/api/catalog';

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data || data.success === false) {
        throw new Error(data?.message || 'Catalogue indisponible');
      }

      // Protection contre les réponses réseau reçues dans le désordre (Test obligatoire #7) :
      // Si une mutation locale (ajout, modification ou suppression) a démarré après le lancement
      // de ce GET, on n'écrase pas la liste des produits avec cet instantané antérieur.
      if (catalogMutationSeqRef.current !== requestMutationSeq) {
        return;
      }

      const serverDeletedSet = new Set<string>([
        ...Array.from(LEGACY_DEMO_PRODUCT_IDS),
        ...Array.from(pendingDeletesRef.current.keys()),
      ]);
      if (Array.isArray(data.deletedProductIds)) {
        for (const id of data.deletedProductIds) {
          if (typeof id === 'string' && id.trim()) {
            serverDeletedSet.add(id.trim());
          }
        }
      }
      deletedProductIdsRef.current = serverDeletedSet;
      const nextDeletedIds = Array.from(serverDeletedSet);
      setDeletedProductIds((prev) => {
        if (
          prev.length === nextDeletedIds.length &&
          nextDeletedIds.every((id) => prev.includes(id))
        ) {
          return prev;
        }
        return nextDeletedIds;
      });
      try {
        localStorage.setItem('dzmahall_deleted_product_ids', JSON.stringify(nextDeletedIds));
      } catch {}

      if (Array.isArray(data.products)) {
        const cleanServerProducts = (data.products as Product[]).filter(
          (p) =>
            p &&
            p.id &&
            !serverDeletedSet.has(p.id) &&
            !pendingDeletesRef.current.has(p.id)
        );

        // Préserver les ajouts optimistes éventuellement en cours
        const optimisticInFlight = Array.from(pendingAddsRef.current.values());
        const mergedProducts = [
          ...optimisticInFlight.filter(
            (opt) => !cleanServerProducts.some((sp) => sp.id === opt.id)
          ),
          ...cleanServerProducts,
        ];

        setProducts((prev) => {
          // Éviter le clignotement / re-rendu inutile à l'actualisation si le catalogue serveur correspond déjà au cache local
          if (
            prev.length === mergedProducts.length &&
            prev.every(
              (p, idx) =>
                p.id === mergedProducts[idx]?.id &&
                p.updatedAt === mergedProducts[idx]?.updatedAt &&
                p.stockQuantity === mergedProducts[idx]?.stockQuantity &&
                p.price === mergedProducts[idx]?.price &&
                p.isActive === mergedProducts[idx]?.isActive &&
                p._optimisticStatus === mergedProducts[idx]?._optimisticStatus
            )
          ) {
            return prev;
          }
          return mergedProducts;
        });
        try {
          localStorage.setItem('dzmahall_products', JSON.stringify(cleanServerProducts));
        } catch {}
      }

      if (Array.isArray(data.categories) && data.categories.length > 0) {
        setCategories(mergeWithOfficialCategories(data.categories));
      }

      if (Array.isArray(data.landingPages) && data.landingPages.length > 0) {
        setLandingPages(data.landingPages);
      }

      if (Array.isArray(data.wilayas) && data.wilayas.length > 0) {
        setWilayas(data.wilayas);
      }

      hasInitialServerCatalogLoadedRef.current = true;
      lastCatalogSyncTimeRef.current = Date.now();
      setLastCatalogSyncedAt(new Date().toISOString());
      setCatalogError(null);
    } catch (err) {
      console.warn('Failed to fetch authoritative catalog from server:', err);
      setCatalogError(
        'Impossible de charger le catalogue officiel depuis le serveur. Veuillez vérifier votre connexion et réessayer.'
      );
      // En cas de simulation d'erreur ou de nouvel appareil sans cache valide, ne jamais afficher INITIAL_PRODUCTS
      if (
        options?.simulateError ||
        (typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('simulateCatalogError') === '1')
      ) {
        setProducts([]);
      }
    } finally {
      setIsCatalogLoading(false);
      setIsCatalogSyncing(false);
    }
  };

  // Chargement initial + synchronisation automatique raisonnée au retour sur l'onglet
  useEffect(() => {
    void refreshCatalogFromServer();

    if (typeof window === 'undefined') return;
    const handleFocusOrVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // Ne pas lancer de rafraîchissement concurrent si une mutation optimiste est en cours
      // ou si la dernière synchronisation date de moins de 15 secondes
      if (
        pendingAddsRef.current.size > 0 ||
        pendingDeletesRef.current.size > 0 ||
        Date.now() - lastCatalogSyncTimeRef.current < 15000
      ) {
        return;
      }
      void refreshCatalogFromServer();
    };
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, []);

  // Synchronisation secondaire avec Firebase Firestore (uniquement si le quota Firestore est disponible)
  // Ne réinjecte jamais les anciens produits de démonstration ni les produits supprimés.
  useEffect(() => {
    let isMounted = true;
    let unsubscribeProducts = () => {};
    let unsubscribeCategories = () => {};
    let unsubscribeLandingPages = () => {};
    let unsubscribeRecipients = () => {};

    testConnection().then((connected) => {
      if (!isMounted) return;
      setIsFirebaseConnected(connected);
      if (!connected) {
        return;
      }

      unsubscribeProducts = subscribeToProducts(
        (cloudProducts) => {
          if (!cloudProducts || cloudProducts.length === 0) return;
          // Attendre que le catalogue officiel du serveur (/api/catalog) ait chargé la liste faisant foi
          // des produits et des IDs supprimés, et ignorer tout instantané pendant une mutation optimiste
          if (
            !hasInitialServerCatalogLoadedRef.current ||
            pendingDeletesRef.current.size > 0 ||
            pendingAddsRef.current.size > 0
          ) {
            return;
          }

          // Utiliser systématiquement la référence à jour des IDs supprimés (et non une closure périmée)
          const excluded = new Set<string>([
            ...Array.from(LEGACY_DEMO_PRODUCT_IDS),
            ...Array.from(deletedProductIdsRef.current),
            ...Array.from(pendingDeletesRef.current.keys()),
          ]);

          // Nettoyage proactif : si un produit supprimé sur le serveur est encore présent dans Firestore,
          // le purger silencieusement de Firestore pour éviter toute réapparition future.
          for (const cp of cloudProducts) {
            if (cp && cp.id && excluded.has(cp.id)) {
              deleteProductFromFirestore(cp.id).catch(() => {});
            }
          }

          setProducts((prevServerProducts) => {
            const validCloud = cloudProducts.filter(
              (p) => p && p.id && !excluded.has(p.id) && !String(p.id).startsWith('temp-prod-')
            );
            if (validCloud.length === 0) return prevServerProducts;

            // Le catalogue serveur (/api/catalog) est la source faisant autorité.
            // On préserve systématiquement tous les produits confirmés du serveur et on intègre
            // les mises à jour Firestore pertinentes (ex: ajustement de stock en temps réel).
            const serverIdSet = new Set(prevServerProducts.map((p) => p.id));
            const cloudMap = new Map<string, Product>();
            for (const cp of validCloud) {
              cloudMap.set(cp.id, cp);
            }

            const updatedProducts: Product[] = [];
            for (const sp of prevServerProducts) {
              if (excluded.has(sp.id)) continue;
              const cloudVersion = cloudMap.get(sp.id);
              if (!cloudVersion) {
                updatedProducts.push(sp);
              } else {
                const serverTime = sp.updatedAt ? new Date(sp.updatedAt).getTime() : 0;
                const cloudTime = cloudVersion.updatedAt
                  ? new Date(cloudVersion.updatedAt).getTime()
                  : 0;
                updatedProducts.push(serverTime >= cloudTime ? sp : cloudVersion);
              }
            }

            // Si un nouveau produit a été créé dans le cloud par un autre terminal et n'est pas encore sur ce serveur
            for (const cp of validCloud) {
              if (!serverIdSet.has(cp.id) && !excluded.has(cp.id)) {
                updatedProducts.push(cp);
                // Synchroniser immédiatement et de façon durable avec le serveur autoritaire
                fetch('/api/catalog/products', {
                  method: 'POST',
                  headers: getAdminApiHeaders(),
                  body: JSON.stringify({ product: cp }),
                }).catch(() => {});
              }
            }

            const sorted = updatedProducts.sort((a, b) => {
              const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
            });

            // Éviter tout re-rendu inutile si la liste est identique
            if (
              sorted.length === prevServerProducts.length &&
              sorted.every(
                (item, idx) =>
                  item.id === prevServerProducts[idx]?.id &&
                  item.updatedAt === prevServerProducts[idx]?.updatedAt &&
                  item.stockQuantity === prevServerProducts[idx]?.stockQuantity &&
                  item.price === prevServerProducts[idx]?.price &&
                  item.isActive === prevServerProducts[idx]?.isActive &&
                  item._optimisticStatus === prevServerProducts[idx]?._optimisticStatus
              )
            ) {
              return prevServerProducts;
            }

            return sorted;
          });
        },
        () => {
          setIsFirebaseConnected(false);
        }
      );

      unsubscribeCategories = subscribeToCategories(
        (cloudCategories) => {
          if (cloudCategories && cloudCategories.length > 0) {
            setCategories(mergeWithOfficialCategories(cloudCategories));
          }
        },
        () => {
          setIsFirebaseConnected(false);
        }
      );

      unsubscribeLandingPages = subscribeToLandingPages(
        (cloudPages) => {
          if (cloudPages && cloudPages.length > 0) {
            setLandingPages(cloudPages);
          }
        },
        () => {
          setIsFirebaseConnected(false);
        }
      );

      unsubscribeRecipients = subscribeToNotificationRecipients(
        (cloudRecipients) => {
          if (cloudRecipients && cloudRecipients.length > 0) {
            setNotificationRecipients((prev) => {
              const byId = new Map(prev.map((r) => [r.id, r]));
              for (const cr of cloudRecipients) {
                byId.set(cr.id, { ...(byId.get(cr.id) || {}), ...cr });
              }
              return Array.from(byId.values());
            });
          }
        },
        () => {
          setIsFirebaseConnected(false);
        }
      );
    });

    return () => {
      isMounted = false;
      unsubscribeProducts();
      unsubscribeCategories();
      unsubscribeLandingPages();
      unsubscribeRecipients();
    };
  }, []);

  const [fraudWatchlist, setFraudWatchlist] = useState<FraudWatchlistEntry[]>([]);
  const [fraudSettings, setFraudSettings] = useState<FraudProtectionSettings>(DEFAULT_FRAUD_SETTINGS);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventLog[]>([]);
  const [orderDeletionAuditLogs, setOrderDeletionAuditLogs] = useState<OrderDeletionAuditLog[]>([]);
  const deletedOrderIdsRef = useRef<Set<string>>(new Set());

  const mergeOrdersList = (primary: Order[], secondary: Order[]): Order[] => {
    const byId = new Map<string, Order>();
    for (const o of secondary) {
      if (o && o.id && !deletedOrderIdsRef.current.has(o.id)) {
        byId.set(o.id, o);
      }
    }
    for (const o of primary) {
      if (o && o.id && !deletedOrderIdsRef.current.has(o.id)) {
        const existing = byId.get(o.id);
        if (!existing) {
          byId.set(o.id, o);
        } else {
          const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const incomingTime = o.updatedAt ? new Date(o.updatedAt).getTime() : 0;
          byId.set(
            o.id,
            incomingTime >= existingTime
              ? { ...existing, ...o }
              : { ...o, ...existing }
          );
        }
      }
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  // Chargement autoritaire des commandes, destinataires et journaux depuis le serveur (/api/orders & /api/notifications/recipients)
  useEffect(() => {
    if (!isAdminAuthorized) {
      setOrders([]);
      setOrderNotifications([]);
      setFraudWatchlist([]);
      setSecurityEvents([]);
      setOrderDeletionAuditLogs([]);
      return;
    }

    let isMounted = true;
    let unsubscribeOrders = () => {};
    let unsubscribeOrderNotifs = () => {};

    const loadAuthoritativeAdminData = async () => {
      try {
        const [ordersRes, rcptRes, carriersRes, statusRes] = await Promise.all([
          fetch('/api/orders', { headers: getAdminApiHeaders() }),
          fetch('/api/notifications/recipients', { headers: getAdminApiHeaders() }),
          fetch('/api/carriers', { headers: getAdminApiHeaders() }),
          fetch('/api/notifications/config-status', { headers: getAdminApiHeaders() }),
        ]);

        if (isMounted && ordersRes.ok) {
          const data = await ordersRes.json();
          if (Array.isArray(data.deletedOrderIds)) {
            for (const delId of data.deletedOrderIds) {
              if (typeof delId === 'string' && delId.trim()) {
                deletedOrderIdsRef.current.add(delId.trim());
              }
            }
          }
          if (Array.isArray(data.deletionAuditLogs)) {
            setOrderDeletionAuditLogs(data.deletionAuditLogs);
          }
          if (Array.isArray(data.orders)) {
            setOrders(data.orders.filter((o: Order) => o && o.id && !deletedOrderIdsRef.current.has(o.id)));
          }
          if (Array.isArray(data.notificationLogs)) {
            setOrderNotifications(data.notificationLogs);
          }
        }

        if (isMounted && rcptRes.ok) {
          const rcptData = await rcptRes.json();
          if (Array.isArray(rcptData.recipients)) {
            setNotificationRecipients(rcptData.recipients);
          }
          const logs = rcptData.notificationLogs || rcptData.logs;
          if (Array.isArray(logs)) {
            setOrderNotifications(logs);
          }
        }

        if (isMounted && carriersRes.ok) {
          const cData = await carriersRes.json();
          if (Array.isArray(cData.carriers) && cData.carriers.length > 0) {
            setCarriers(cData.carriers);
          }
        }

        if (isMounted && statusRes.ok) {
          const sData = await statusRes.json();
          setEmailProviderStatus(sData);
        }
      } catch (err) {
        console.warn('Could not load authoritative admin orders from server:', err);
      }
    };

    void loadAuthoritativeAdminData();

    if (isFirebaseConnected) {
      unsubscribeOrders = subscribeToOrders(
        (cloudOrders) => {
          if (cloudOrders && cloudOrders.length > 0) {
            const validCloudOrders = cloudOrders.filter(
              (o) => o && o.id && !deletedOrderIdsRef.current.has(o.id)
            );
            if (validCloudOrders.length > 0) {
              setOrders((prev) => mergeOrdersList(prev, validCloudOrders));
            }
          }
        },
        (err) => {
          console.warn('Firestore orders subscription unavailable, keeping server orders:', err);
        }
      );

      unsubscribeOrderNotifs = subscribeToOrderNotifications(
        (cloudLogs) => {
          if (cloudLogs && cloudLogs.length > 0) {
            setOrderNotifications((prev) => {
              const map = new Map<string, OrderNotificationLog>();
              for (const l of cloudLogs) map.set(l.id, l);
              for (const l of prev) map.set(l.id, l);
              return Array.from(map.values());
            });
          }
        },
        (err) => {
          console.warn('Firestore order notifications subscription unavailable:', err);
        }
      );
    }

    return () => {
      isMounted = false;
      unsubscribeOrders();
      unsubscribeOrderNotifs();
    };
  }, [isAdminAuthorized, isFirebaseConnected]);

  // Save confirmed public catalog changes locally as non-authoritative cache preview (exclude temp optimistic items)
  useEffect(() => {
    try {
      const confirmedOnly = products.filter(
        (p) => p && p.id && !p.id.startsWith('temp-prod-') && !p._optimisticStatus
      );
      localStorage.setItem('dzmahall_products', JSON.stringify(confirmedOnly));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('dzmahall_categories', JSON.stringify(categories));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [categories]);

  useEffect(() => {
    if (!isAdminAuthorized) {
      // Remove any legacy browser-stored carrier credentials
      try {
        sessionStorage.removeItem('dzmahall_carriers');
      } catch {
        // ignore
      }
      return;
    }
    void refreshCarriersFromServer();
  }, [isAdminAuthorized]);

  useEffect(() => {
    try {
      localStorage.setItem('dzmahall_wilayas', JSON.stringify(wilayas));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [wilayas]);

  useEffect(() => {
    try {
      localStorage.setItem('dzmahall_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [cart]);

  // Sync state when user clicks browser Back/Forward buttons or changes URL
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLocationChange = () => {
      const pathname = window.location.pathname || '/';
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      const fullRoute = hash.startsWith('#/') ? hash.slice(1) : pathname + search;
      setCurrentRoute(fullRoute || '/');
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateTo = (route: string) => {
    setCurrentRoute(route);
    if (typeof window !== 'undefined') {
      const currentFull = window.location.pathname + window.location.search;
      if (currentFull !== route) {
        window.history.pushState(null, '', route);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Cart logic
  const addToCart = (product: Product, quantity = 1, variantId?: string) => {
    setCart((prev) => {
      const variant = variantId ? product.variants.find((v) => v.id === variantId) : undefined;
      const unitPrice = variant && variant.priceModifier ? product.price + variant.priceModifier : product.price;
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.variantId === variantId
      );

      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
        };
        return next;
      }

      return [
        ...prev,
        {
          product,
          variantId,
          variantName: variant?.name,
          quantity,
          unitPrice,
        },
      ];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string, variantId?: string) => {
    setCart((prev) =>
      prev.filter((item) => !(item.product.id === productId && item.variantId === variantId))
    );
  };

  const updateCartQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId && item.variantId === variantId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // Products CRUD with Optimistic UI, Selective Rollback & Authoritative Server Persistence
  const addProduct = async (
    productData: Omit<Product, 'id' | 'createdAt'>,
    options?: { simulateNetworkError?: boolean; delayMs?: number }
  ): Promise<Product> => {
    assertAdminAuthorized();
    catalogMutationSeqRef.current += 1;

    const nowIso = new Date().toISOString();
    const randomSuffix = `${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const tempId = `temp-prod-${randomSuffix}`;
    const finalId = `prod-${randomSuffix}`;

    const baseProduct: Product = {
      ...productData,
      id: finalId,
      price: Number(productData.price) || 0,
      stockQuantity: Number(productData.stockQuantity) || 0,
      isActive: productData.isActive !== false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const optimisticProduct: Product = {
      ...baseProduct,
      id: tempId,
      _tempId: tempId,
      _optimisticStatus: 'saving',
    };

    // 1. Insertion optimiste immédiate dans l'état React (avec indicateur « Enregistrement… »)
    pendingAddsRef.current.set(tempId, optimisticProduct);
    syncPendingProductIdsState();

    setProducts((prev) => [
      optimisticProduct,
      ...prev.filter((p) => p.id !== tempId && p.id !== finalId),
    ]);

    try {
      // 2. Envoi de la requête POST au backend autoritaire
      const headers: Record<string, string> = {
        ...getAdminApiHeaders(),
      };
      if (options?.simulateNetworkError) {
        headers['x-simulate-network-error'] = '1';
      }

      const res = await fetch('/api/catalog/products', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          product: baseProduct,
          ...(options?.simulateNetworkError ? { simulateNetworkError: true } : {}),
          ...(options?.delayMs ? { delayMs: options.delayMs } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData?.message || 'Erreur lors de la sauvegarde du produit sur le serveur.'
        );
      }

      const data = await res.json();
      const savedProduct: Product = {
        ...(data.product || baseProduct),
        _optimisticStatus: undefined,
        _tempId: undefined,
      };

      // 3. Confirmation serveur : retrait du suivi temporaire et remplacement sans doublon
      pendingAddsRef.current.delete(tempId);
      deletedProductIdsRef.current.delete(savedProduct.id);
      syncPendingProductIdsState();

      setProducts((prev) => {
        const next: Product[] = [];
        let replaced = false;
        for (const item of prev) {
          if (
            item.id === tempId ||
            item._tempId === tempId ||
            item.id === savedProduct.id
          ) {
            if (!replaced) {
              next.push(savedProduct);
              replaced = true;
            }
          } else if (!deletedProductIdsRef.current.has(item.id)) {
            next.push(item);
          }
        }
        if (!replaced) {
          next.unshift(savedProduct);
        }
        return next;
      });

      // 4. Synchronisation secondaire non bloquante vers Firestore
      if (isFirebaseConnected) {
        saveProductToFirestore(savedProduct).catch((e) =>
          console.warn('Secondary Firestore product sync skipped:', e)
        );
      }

      return savedProduct;
    } catch (err: any) {
      // 5. Rollback ciblé en cas d'échec : retrait de l'entrée temporaire sans affecter les autres produits
      pendingAddsRef.current.delete(tempId);
      syncPendingProductIdsState();

      setProducts((prev) =>
        prev.filter((p) => p.id !== tempId && p._tempId !== tempId)
      );

      throw err instanceof Error
        ? err
        : new Error("Échec de l'enregistrement du produit sur le serveur.");
    }
  };

  const updateProduct = async (
    id: string,
    updates: Partial<Product>,
    options?: { simulateNetworkError?: boolean; delayMs?: number }
  ): Promise<void> => {
    assertAdminAuthorized();
    catalogMutationSeqRef.current += 1;

    const currentList = productsRef.current;
    const existingProduct = currentList.find((p) => p.id === id);
    if (!existingProduct) {
      throw new Error('Produit introuvable dans le catalogue.');
    }

    const previousSnapshot: Product = { ...existingProduct };
    const updatedProduct: Product = {
      ...existingProduct,
      ...updates,
      id: existingProduct.id,
      createdAt: existingProduct.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _optimisticStatus: 'saving',
    };

    // 1. Mise à jour optimiste immédiate
    setProducts((prev) => prev.map((p) => (p.id === id ? updatedProduct : p)));

    try {
      const headers: Record<string, string> = {
        ...getAdminApiHeaders(),
      };
      if (options?.simulateNetworkError) {
        headers['x-simulate-network-error'] = '1';
      }

      const cleanPayload: Product = { ...updatedProduct };
      delete cleanPayload._optimisticStatus;
      delete cleanPayload._tempId;

      const res = await fetch(`/api/catalog/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          product: cleanPayload,
          ...(options?.simulateNetworkError ? { simulateNetworkError: true } : {}),
          ...(options?.delayMs ? { delayMs: options.delayMs } : {}),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData?.message || 'Erreur lors de la mise à jour du produit sur le serveur.'
        );
      }
      const data = await res.json();
      const confirmedProduct: Product = {
        ...(data.product || cleanPayload),
        _optimisticStatus: undefined,
        _tempId: undefined,
      };

      setProducts((prev) => prev.map((p) => (p.id === id ? confirmedProduct : p)));

      if (isFirebaseConnected) {
        saveProductToFirestore(confirmedProduct).catch((e) =>
          console.warn('Secondary Firestore product update skipped:', e)
        );
      }
    } catch (err: any) {
      // Rollback vers l'état précédent de ce produit uniquement
      setProducts((prev) => prev.map((p) => (p.id === id ? previousSnapshot : p)));
      throw err instanceof Error
        ? err
        : new Error('Erreur lors de la mise à jour du produit.');
    }
  };

  const deleteProduct = async (
    id: string,
    options?: { simulateNetworkError?: boolean; delayMs?: number }
  ): Promise<{ success: boolean; error?: string; rolledBack?: boolean }> => {
    try {
      assertAdminAuthorized();
    } catch (authErr: any) {
      return {
        success: false,
        error: authErr?.message || 'Accès refusé',
      };
    }

    // Protection contre les clics répétés pendant une suppression déjà en cours
    if (pendingDeletesRef.current.has(id)) {
      return {
        success: false,
        error: 'Suppression déjà en cours pour ce produit.',
      };
    }

    catalogMutationSeqRef.current += 1;

    // 1. Sauvegarder la référence et la position exacte du produit pour un rollback ciblé si nécessaire
    const currentList = productsRef.current;
    const targetIndex = currentList.findIndex((p) => p.id === id);
    const targetProduct = targetIndex >= 0 ? { ...currentList[targetIndex] } : undefined;

    pendingDeletesRef.current.set(id, {
      product: targetProduct || ({ id } as Product),
      index: targetIndex >= 0 ? targetIndex : 0,
    });
    deletedProductIdsRef.current.add(id);
    syncPendingProductIdsState();

    // 2. Retirer immédiatement le produit de l'état React (Optimistic UI : disparition instantanée sans attente)
    setProducts((prev) => prev.filter((p) => p.id !== id));

    try {
      const queryParams = new URLSearchParams();
      if (options?.simulateNetworkError) queryParams.set('simulateError', '1');
      if (options?.delayMs && options.delayMs > 0) {
        queryParams.set('delayMs', String(options.delayMs));
      }
      const qs = queryParams.toString();
      const url = `/api/catalog/products/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`;

      const headers: Record<string, string> = {
        ...getAdminApiHeaders(),
      };
      if (options?.simulateNetworkError) {
        headers['x-simulate-network-error'] = '1';
      }

      // 3. Envoyer la requête de suppression au backend autoritaire
      const res = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData?.message || 'Erreur lors de la suppression sur le serveur'
        );
      }

      const data = await res.json();

      // 4. Confirmation serveur : maintenir le produit supprimé définitivement
      pendingDeletesRef.current.delete(id);
      syncPendingProductIdsState();

      const updatedDeletedSet = new Set<string>([
        ...Array.from(LEGACY_DEMO_PRODUCT_IDS),
        ...Array.from(deletedProductIdsRef.current),
        id,
      ]);
      if (Array.isArray(data.deletedProductIds)) {
        for (const delId of data.deletedProductIds) {
          if (typeof delId === 'string' && delId.trim()) {
            updatedDeletedSet.add(delId.trim());
          }
        }
      }
      deletedProductIdsRef.current = updatedDeletedSet;
      const nextDeletedList = Array.from(updatedDeletedSet);
      setDeletedProductIds(nextDeletedList);
      try {
        localStorage.setItem(
          'dzmahall_deleted_product_ids',
          JSON.stringify(nextDeletedList)
        );
      } catch {}

      // Filtrage fonctionnel sûr : ne jamais remplacer tout le tableau par un snapshot qui écraserait d'autres actions
      setProducts((prev) =>
        prev.filter((p) => p.id !== id && !deletedProductIdsRef.current.has(p.id))
      );

      // 5. Suppression secondaire sur Firestore en arrière-plan
      if (isFirebaseConnected) {
        deleteProductFromFirestore(id).catch((e) =>
          console.warn('Secondary Firestore product delete skipped:', e)
        );
      }

      return { success: true };
    } catch (err: any) {
      // 6. Rollback sélectif en cas d'échec confirmé : restaurer uniquement ce produit à sa position initiale
      const savedEntry = pendingDeletesRef.current.get(id);
      pendingDeletesRef.current.delete(id);
      if (!LEGACY_DEMO_PRODUCT_IDS.has(id)) {
        deletedProductIdsRef.current.delete(id);
        setDeletedProductIds((prev) => prev.filter((item) => item !== id));
      }
      syncPendingProductIdsState();

      if (savedEntry?.product && savedEntry.product.name) {
        setProducts((prev) => {
          if (prev.some((p) => p.id === id)) return prev;
          const next = [...prev];
          const insertAt = Math.min(Math.max(0, savedEntry.index), next.length);
          next.splice(insertAt, 0, savedEntry.product);
          return next;
        });
      }

      return {
        success: false,
        error: err?.message || 'Erreur réseau lors de la suppression du produit.',
        rolledBack: true,
      };
    }
  };

  const importProductsBatch = async (
    incomingProducts: Product[],
    mode: 'add_new' | 'update_existing' | 'create_new_sku',
    onProgress?: (processed: number, total: number) => void
  ): Promise<{ added: number; updated: number; skipped: number }> => {
    assertAdminAuthorized();
    catalogMutationSeqRef.current += 1;
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const finalProductsToPersist: Product[] = [];
    let updatedList = productsRef.current.filter(
      (p) => !deletedProductIdsRef.current.has(p.id) && !pendingDeletesRef.current.has(p.id)
    );

    incomingProducts.forEach((inc) => {
      const existingIndex = updatedList.findIndex(
        (p) =>
          p.sku.trim().toUpperCase() === inc.sku.trim().toUpperCase() ||
          p.id === inc.id
      );

      if (existingIndex > -1) {
        if (mode === 'add_new') {
          skippedCount++;
        } else if (mode === 'update_existing') {
          const existing = updatedList[existingIndex];
          const merged: Product = {
            ...existing,
            ...inc,
            id: existing.id,
            createdAt: existing.createdAt || inc.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          updatedList[existingIndex] = merged;
          finalProductsToPersist.push(merged);
          updatedCount++;
        } else if (mode === 'create_new_sku') {
          const newSku = `${inc.sku}-IMP-${Math.floor(100 + Math.random() * 900)}`;
          const cloned: Product = {
            ...inc,
            id: `prod-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
            sku: newSku,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          updatedList.unshift(cloned);
          finalProductsToPersist.push(cloned);
          addedCount++;
        }
      } else {
        const newProd: Product = {
          ...inc,
          id: inc.id || `prod-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          createdAt: inc.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updatedList.unshift(newProd);
        finalProductsToPersist.push(newProd);
        addedCount++;
      }
    });

    // Si un produit réimporté avait été supprimé auparavant, le retirer de la liste d'exclusion
    for (const persisted of finalProductsToPersist) {
      deletedProductIdsRef.current.delete(persisted.id);
    }

    // Update local state immediately
    setProducts(updatedList);

    // 1. Persist batch to authoritative backend server
    if (finalProductsToPersist.length > 0) {
      const res = await fetch('/api/catalog/products/batch', {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({ products: finalProductsToPersist }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          const cleanServerList = (data.products as Product[]).filter(
            (p) =>
              p &&
              p.id &&
              !deletedProductIdsRef.current.has(p.id) &&
              !pendingDeletesRef.current.has(p.id)
          );
          setProducts(cleanServerList);
          try {
            localStorage.setItem('dzmahall_products', JSON.stringify(cleanServerList));
          } catch {}
        }
      }
      if (onProgress) {
        onProgress(finalProductsToPersist.length, finalProductsToPersist.length);
      }

      // 2. Best-effort batch save to Firestore if connected
      if (isFirebaseConnected) {
        saveProductsBatchToFirestore(finalProductsToPersist, onProgress).catch((e) =>
          console.warn('Secondary Firestore batch import skipped:', e)
        );
      }
    }

    return { added: addedCount, updated: updatedCount, skipped: skippedCount };
  };

  useEffect(() => {
    try {
      localStorage.setItem('dzmahall_landing_pages', JSON.stringify(landingPages));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [landingPages]);

  const addLandingPage = async (pageData: Omit<LandingPage, 'id' | 'createdAt' | 'updatedAt' | 'viewsCount' | 'ordersCount'>): Promise<LandingPage> => {
    assertAdminAuthorized();
    const defaultCarrier = carriers.find((c) => c.status === 'connected') || carriers[0];
    const newPage: LandingPage = {
      ...pageData,
      shippingCompanyId: pageData.shippingCompanyId || defaultCarrier.id,
      shippingCompanyNameSnapshot: pageData.shippingCompanyNameSnapshot || defaultCarrier.name,
      id: `lp-${Date.now()}`,
      viewsCount: 0,
      ordersCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLandingPages((prev) => [newPage, ...prev]);
    await fetch('/api/catalog/landing-pages', {
      method: 'POST',
      headers: getAdminApiHeaders(),
      body: JSON.stringify({ page: newPage }),
    }).catch(() => {});
    if (isFirebaseConnected) {
      saveLandingPageToFirestore(newPage).catch(() => {});
    }
    return newPage;
  };

  const updateLandingPage = async (id: string, updates: Partial<LandingPage>): Promise<void> => {
    assertAdminAuthorized();
    let updatedPage: LandingPage | null = null;
    setLandingPages((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          updatedPage = {
            ...p,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          return updatedPage;
        }
        return p;
      })
    );
    if (updatedPage) {
      await fetch('/api/catalog/landing-pages', {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({ page: updatedPage }),
      }).catch(() => {});
      if (isFirebaseConnected) {
        saveLandingPageToFirestore(updatedPage).catch(() => {});
      }
    }
  };

  const deleteLandingPage = async (id: string): Promise<void> => {
    assertAdminAuthorized();
    setLandingPages((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/catalog/landing-pages/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminApiHeaders(),
    }).catch(() => {});
    if (isFirebaseConnected) {
      deleteLandingPageFromFirestore(id).catch(() => {});
    }
  };

  const duplicateLandingPage = async (id: string): Promise<LandingPage> => {
    assertAdminAuthorized();
    const source = landingPages.find((p) => p.id === id);
    if (!source) throw new Error('Page introuvable');
    const newPage: LandingPage = {
      ...source,
      id: `lp-${Date.now()}`,
      slug: `${source.slug}-copie-${Math.floor(100 + Math.random() * 900)}`,
      title: `${source.title} (Copie)`,
      status: 'draft',
      viewsCount: 0,
      ordersCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLandingPages((prev) => [newPage, ...prev]);
    await fetch('/api/catalog/landing-pages', {
      method: 'POST',
      headers: getAdminApiHeaders(),
      body: JSON.stringify({ page: newPage }),
    }).catch(() => {});
    if (isFirebaseConnected) {
      saveLandingPageToFirestore(newPage).catch(() => {});
    }
    return newPage;
  };

  const incrementLandingPageView = (slugOrId: string) => {
    setLandingPages((prev) =>
      prev.map((p) => {
        if (p.id === slugOrId || p.slug === slugOrId) {
          const updated = { ...p, viewsCount: (p.viewsCount || 0) + 1 };
          if (isFirebaseConnected) {
            saveLandingPageToFirestore(updated).catch(() => {});
          }
          return updated;
        }
        return p;
      })
    );
  };

  // Categories & Subcategories Management (with duplicate prevention & stable technical IDs)
  const addCategory = async (data: { name: string; description?: string }): Promise<CategoryItem> => {
    assertAdminAuthorized();
    const cleanName = data.name.trim();
    if (!cleanName) {
      throw new Error('Le nom de la catégorie est obligatoire.');
    }

    const duplicate = categories.some(
      (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Une catégorie nommée « ${cleanName} » existe déjà.`);
    }

    const baseSlug = slugifyCategoryName(cleanName) || `cat-${Date.now()}`;
    let candidateId = `cat-${baseSlug}`;
    if (categories.some((c) => c.id === candidateId)) {
      candidateId = `cat-${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const maxOrder = categories.reduce((max, c) => Math.max(max, c.order || 0), 0);
    const nowIso = new Date().toISOString();

    const newCategory: CategoryItem = {
      id: candidateId,
      name: cleanName,
      slug: baseSlug,
      description: data.description?.trim() || '',
      order: maxOrder + 1,
      isActive: true,
      subcategories: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await fetch('/api/catalog/categories', {
      method: 'POST',
      headers: getAdminApiHeaders(),
      body: JSON.stringify({ category: newCategory }),
    }).catch(() => {});
    if (isFirebaseConnected) {
      saveCategoryToFirestore(newCategory).catch(() => {});
    }
    setCategories((prev) =>
      [...prev.filter((c) => c.id !== newCategory.id), newCategory].sort(
        (a, b) => (a.order || 0) - (b.order || 0)
      )
    );
    return newCategory;
  };

  const updateCategory = async (id: string, updates: Partial<CategoryItem>): Promise<void> => {
    assertAdminAuthorized();
    const existing = categories.find((c) => c.id === id);
    if (!existing) {
      throw new Error('Catégorie introuvable.');
    }

    if (updates.name !== undefined) {
      const cleanName = updates.name.trim();
      if (!cleanName) {
        throw new Error('Le libellé de la catégorie ne peut pas être vide.');
      }
      const duplicate = categories.some(
        (c) => c.id !== id && c.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`Une autre catégorie porte déjà le nom « ${cleanName} ».`);
      }
      updates.name = cleanName;
    }

    const updatedCat: CategoryItem = {
      ...existing,
      ...updates,
      id: existing.id, // L'identifiant technique reste strictement stable
      updatedAt: new Date().toISOString(),
    };

    await fetch('/api/catalog/categories', {
      method: 'POST',
      headers: getAdminApiHeaders(),
      body: JSON.stringify({ category: updatedCat }),
    }).catch(() => {});
    if (isFirebaseConnected) {
      saveCategoryToFirestore(updatedCat).catch(() => {});
    }
    setCategories((prev) =>
      prev
        .map((c) => (c.id === id ? updatedCat : c))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
    );
  };

  const reorderCategories = async (orderedIds: string[]): Promise<void> => {
    assertAdminAuthorized();
    const reordered: CategoryItem[] = [];
    orderedIds.forEach((id, index) => {
      const cat = categories.find((c) => c.id === id);
      if (cat) {
        reordered.push({
          ...cat,
          order: index + 1,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    await fetch('/api/catalog/categories', {
      method: 'POST',
      headers: getAdminApiHeaders(),
      body: JSON.stringify({ categories: reordered }),
    }).catch(() => {});
    if (isFirebaseConnected) {
      saveCategoriesBatchToFirestore(reordered).catch(() => {});
    }
    setCategories(reordered);
  };

  const addSubCategory = async (
    categoryId: string,
    data: { name: string; description?: string }
  ): Promise<void> => {
    assertAdminAuthorized();
    const existingCat = categories.find((c) => c.id === categoryId);
    if (!existingCat) {
      throw new Error('Catégorie parente introuvable.');
    }

    const cleanName = data.name.trim();
    if (!cleanName) {
      throw new Error('Le nom de la sous-catégorie est obligatoire.');
    }

    const duplicate = existingCat.subcategories.some(
      (s) => s.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(
        `La sous-catégorie « ${cleanName} » existe déjà dans « ${existingCat.name} ».`
      );
    }

    const baseSlug = slugifyCategoryName(cleanName) || `sub-${Date.now()}`;
    let candidateId = `sub-${baseSlug}`;
    if (existingCat.subcategories.some((s) => s.id === candidateId)) {
      candidateId = `sub-${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const maxOrder = existingCat.subcategories.reduce(
      (max, s) => Math.max(max, s.order || 0),
      0
    );

    const newSub: SubCategoryItem = {
      id: candidateId,
      name: cleanName,
      description: data.description?.trim() || '',
      order: maxOrder + 1,
      isActive: true,
    };

    const updatedCat: CategoryItem = {
      ...existingCat,
      subcategories: [...existingCat.subcategories, newSub],
      updatedAt: new Date().toISOString(),
    };

    await fetch('/api/catalog/categories', {
      method: 'POST',
      headers: getAdminApiHeaders(),
      body: JSON.stringify({ category: updatedCat }),
    }).catch(() => {});
    if (isFirebaseConnected) {
      saveCategoryToFirestore(updatedCat).catch(() => {});
    }
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? updatedCat : c)));
  };

  const updateSubCategory = async (
    categoryId: string,
    subCategoryId: string,
    updates: Partial<SubCategoryItem>
  ): Promise<void> => {
    assertAdminAuthorized();
    const existingCat = categories.find((c) => c.id === categoryId);
    if (!existingCat) {
      throw new Error('Catégorie parente introuvable.');
    }

    const existingSub = existingCat.subcategories.find((s) => s.id === subCategoryId);
    if (!existingSub) {
      throw new Error('Sous-catégorie introuvable.');
    }

    if (updates.name !== undefined) {
      const cleanName = updates.name.trim();
      if (!cleanName) {
        throw new Error('Le libellé de la sous-catégorie ne peut pas être vide.');
      }
      const duplicate = existingCat.subcategories.some(
        (s) =>
          s.id !== subCategoryId && s.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) {
        throw new Error(
          `Une autre sous-catégorie porte déjà le nom « ${cleanName} » dans cette catégorie.`
        );
      }
      updates.name = cleanName;
    }

    const updatedSubcategories = existingCat.subcategories
      .map((s) =>
        s.id === subCategoryId
          ? {
              ...s,
              ...updates,
              id: s.id, // Identifiant technique stable
            }
          : s
      )
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const updatedCat: CategoryItem = {
      ...existingCat,
      subcategories: updatedSubcategories,
      updatedAt: new Date().toISOString(),
    };

    await fetch('/api/catalog/categories', {
      method: 'POST',
      headers: getAdminApiHeaders(),
      body: JSON.stringify({ category: updatedCat }),
    }).catch(() => {});
    if (isFirebaseConnected) {
      saveCategoryToFirestore(updatedCat).catch(() => {});
    }
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? updatedCat : c)));
  };

  const reorderSubCategories = async (
    categoryId: string,
    orderedSubIds: string[]
  ): Promise<void> => {
    assertAdminAuthorized();
    const existingCat = categories.find((c) => c.id === categoryId);
    if (!existingCat) return;

    const reorderedSubs = orderedSubIds
      .map((subId, index) => {
        const sub = existingCat.subcategories.find((s) => s.id === subId);
        if (!sub) return null;
        return {
          ...sub,
          order: index + 1,
        };
      })
      .filter((s): s is SubCategoryItem => s !== null);

    const updatedCat: CategoryItem = {
      ...existingCat,
      subcategories: reorderedSubs,
      updatedAt: new Date().toISOString(),
    };

    await fetch('/api/catalog/categories', {
      method: 'POST',
      headers: getAdminApiHeaders(),
      body: JSON.stringify({ category: updatedCat }),
    }).catch(() => {});
    if (isFirebaseConnected) {
      saveCategoryToFirestore(updatedCat).catch(() => {});
    }
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? updatedCat : c)));
  };

  const syncLocalToCloud = async () => {
    assertAdminAuthorized();
    catalogMutationSeqRef.current += 1;

    // Filtrer rigoureusement avec les refs à jour (sans produits supprimés ni temporaires)
    const cleanProductsToSync = productsRef.current
      .filter(
        (p) =>
          p &&
          p.id &&
          !String(p.id).startsWith('temp-prod-') &&
          !deletedProductIdsRef.current.has(p.id) &&
          !pendingDeletesRef.current.has(p.id)
      )
      .map(({ _optimisticStatus, _tempId, ...rest }) => rest);

    const res = await fetch('/api/catalog/sync-public', {
      method: 'POST',
      headers: getAdminApiHeaders(),
      body: JSON.stringify({
        products: cleanProductsToSync,
        categories,
        landingPages,
        wilayas,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products)) {
        const syncedProducts = (data.products as Product[]).filter(
          (p) =>
            p &&
            p.id &&
            !deletedProductIdsRef.current.has(p.id) &&
            !pendingDeletesRef.current.has(p.id)
        );
        setProducts(syncedProducts);
        try {
          localStorage.setItem('dzmahall_products', JSON.stringify(syncedProducts));
        } catch {}
      }
    }
    if (isFirebaseConnected) {
      // Purger d'abord de Firestore tous les IDs supprimés afin qu'aucun produit supprimé ne persiste dans le cloud
      for (const deletedId of Array.from(deletedProductIdsRef.current)) {
        await deleteProductFromFirestore(deletedId).catch(() => {});
      }
      for (const c of categories) {
        await saveCategoryToFirestore(c).catch(() => {});
      }
      for (const p of cleanProductsToSync) {
        await saveProductToFirestore(p).catch(() => {});
      }
      for (const o of orders) {
        await saveOrderToFirestore(o).catch(() => {});
      }
      for (const lp of landingPages) {
        await saveLandingPageToFirestore(lp).catch(() => {});
      }
    }
    lastCatalogSyncTimeRef.current = Date.now();
    setLastCatalogSyncedAt(new Date().toISOString());
  };

  // Order placement & atomic stock decrementation
  const createOrder = ({
    customerName,
    customerPhone,
    wilayaCode,
    commune,
    deliveryAddress,
    deliveryMode,
    deskName,
    notes,
    items,
    landingPageId,
    landingPageSlug,
    landingPageTitle,
    shippingCompanyId,
    shippingCompanyNameSnapshot,
    shippingFee,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
  }: {
    customerName: string;
    customerPhone: string;
    wilayaCode: string;
    commune: string;
    deliveryAddress?: string;
    deliveryMode: 'home' | 'desk';
    deskName?: string;
    notes?: string;
    items?: CartItem[];
    landingPageId?: string;
    landingPageSlug?: string;
    landingPageTitle?: string;
    shippingCompanyId?: string;
    shippingCompanyNameSnapshot?: string;
    shippingFee?: number;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  }): Order => {
    const targetItems = items && items.length > 0 ? items : cart;
    const wilaya = wilayas.find((w) => w.code === wilayaCode) || wilayas[15]; // Default Alger
    const defaultShippingCost = deliveryMode === 'home' ? wilaya.homeDeliveryFee : wilaya.deskDeliveryFee;
    const finalShippingFee = typeof shippingFee === 'number' ? shippingFee : defaultShippingCost;

    const orderItems = targetItems.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      variantId: item.variantId,
      variantName: item.variantName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.unitPrice * item.quantity,
    }));

    const subtotal = orderItems.reduce((acc, item) => acc + item.totalPrice, 0);
    const totalAmount = subtotal + finalShippingFee;
    const orderNumber = `DZM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    const assignedCarrierId = shippingCompanyId || 'yalidine';
    const foundCarrier = carriers.find((c) => c.id === assignedCarrierId);
    const assignedCarrierName = shippingCompanyNameSnapshot || foundCarrier?.name || 'Yalidine Fast Logistics';

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      createdAt: now,
      updatedAt: now,
      customerName,
      customerPhone,
      wilayaCode,
      wilayaName: wilaya.name,
      commune,
      deliveryAddress,
      deliveryMode,
      deskName,
      items: orderItems,
      subtotal,
      shippingCost: finalShippingFee,
      shippingFee: finalShippingFee,
      discount: 0,
      totalAmount,
      total: totalAmount,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      status: 'pending_confirmation',
      carrierId: assignedCarrierId,
      carrierName: assignedCarrierName,
      shippingCompanyId: assignedCarrierId,
      shippingCompanyNameSnapshot: assignedCarrierName,
      landingPageId,
      landingPageSlug,
      landingPageTitle,
      productId: orderItems[0]?.productId,
      selectedVariantId: orderItems[0]?.variantId,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      notes,
      statusHistory: [
        {
          status: 'pending_confirmation',
          timestamp: now,
          note: landingPageTitle
            ? `Commande passée depuis la landing page « ${landingPageTitle} ». Société de livraison : ${assignedCarrierName}.`
            : 'Commande enregistrée avec succès. Paiement à la livraison.',
        },
      ],
    };

    // Decrement stock quantity atomically
    setProducts((prev) =>
      prev.map((prod) => {
        const ordered = targetItems.find((it) => it.product.id === prod.id);
        if (ordered) {
          const newQty = Math.max(0, prod.stockQuantity - ordered.quantity);
          return { ...prod, stockQuantity: newQty };
        }
        return prod;
      })
    );

    // Atomically increment ordersCount for the landing page
    if (landingPageId || landingPageSlug) {
      setLandingPages((prev) =>
        prev.map((lp) => {
          if (lp.id === landingPageId || lp.slug === landingPageSlug) {
            const updated = { ...lp, ordersCount: (lp.ordersCount || 0) + 1 };
            saveLandingPageToFirestore(updated).catch(() => {});
            return updated;
          }
          return lp;
        })
      );
    }

    if (isAdminAuthorized) {
      setOrders((prev) => [newOrder, ...prev]);
    }
    setRecentPublicOrders((prev) => [newOrder, ...prev.slice(0, 9)]);
    saveOrderToFirestore(newOrder);

    // Trigger automatic server-side email alert in background (non-blocking: never cancels or slows order creation)
    void dispatchOrderEmailNotificationNonBlocking(newOrder, false);

    // Clear cart if ordered from cart
    if (!items || items.length === 0) {
      clearCart();
    }

    return newOrder;
  };

  const refreshOrdersFromServer = async (): Promise<Order[]> => {
    if (!isAdminAuthorized) return [];
    try {
      const res = await fetch('/api/orders', {
        method: 'GET',
        headers: getAdminApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.deletedOrderIds)) {
          for (const delId of data.deletedOrderIds) {
            if (typeof delId === 'string' && delId.trim()) {
              deletedOrderIdsRef.current.add(delId.trim());
            }
          }
        }
        if (Array.isArray(data.deletionAuditLogs)) {
          setOrderDeletionAuditLogs(data.deletionAuditLogs);
        }
        if (Array.isArray(data.orders)) {
          const cleanOrders = data.orders.filter(
            (o: Order) => o && o.id && !deletedOrderIdsRef.current.has(o.id)
          );
          setOrders(cleanOrders);
          if (Array.isArray(data.notificationLogs)) {
            setOrderNotifications(data.notificationLogs);
          }
          return cleanOrders;
        }
      }
    } catch (err) {
      console.warn('Could not refresh orders from server:', err);
    }
    return orders;
  };

  const deleteOrder = async (
    orderId: string,
    options?: { mode?: 'archive' | 'permanent' | 'restore'; reason?: string }
  ): Promise<{
    success: boolean;
    message: string;
    mode?: 'archive' | 'permanent' | 'restore';
    order?: Order;
    deletedOrderId?: string;
    warnings?: string[];
  }> => {
    assertAdminAuthorized();
    const effectiveRole = adminUser?.role || adminRole;
    if (effectiveRole !== 'admin') {
      return {
        success: false,
        message:
          'Accès refusé : seule une session Administrateur principal (rôle "admin") est autorisée à supprimer ou archiver une commande.',
      };
    }

    const mode = options?.mode || 'permanent';
    const reason = options?.reason || '';

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({ mode, reason }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return {
          success: false,
          message:
            data?.message ||
            `Impossible de ${
              mode === 'archive' ? 'archiver' : mode === 'restore' ? 'restaurer' : 'supprimer'
            } la commande sur le serveur (Code ${res.status}).`,
        };
      }

      if (mode === 'permanent') {
        deletedOrderIdsRef.current.add(orderId);
        if (isFirebaseConnected) {
          void deleteOrderFromFirestore(orderId);
        }
      } else if (data.order && isFirebaseConnected) {
        void saveOrderToFirestore(data.order);
      }

      if (Array.isArray(data.deletedOrderIds)) {
        for (const delId of data.deletedOrderIds) {
          if (typeof delId === 'string' && delId.trim()) {
            deletedOrderIdsRef.current.add(delId.trim());
          }
        }
      }
      if (Array.isArray(data.deletionAuditLogs)) {
        setOrderDeletionAuditLogs(data.deletionAuditLogs);
      }
      if (Array.isArray(data.orders)) {
        setOrders(
          data.orders.filter((o: Order) => o && o.id && !deletedOrderIdsRef.current.has(o.id))
        );
      } else if (mode === 'permanent') {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else if (data.order) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
      }

      return {
        success: true,
        message: String(data.message || 'Opération effectuée avec succès.'),
        mode: data.mode || mode,
        order: data.order,
        deletedOrderId: data.deletedOrderId,
        warnings: Array.isArray(data.warnings) ? data.warnings : undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        message:
          'Erreur réseau : impossible de contacter le serveur pour confirmer l’opération. La commande n’a pas été modifiée.',
      };
    }
  };

  const trackOrderByQuery = async (queryStr: string): Promise<Order | null> => {
    const clean = queryStr.trim().toLowerCase();
    if (!clean) return null;
    const cleanDigits = clean.replace(/\s+/g, '');

    // 1. Check recent orders placed in this session first
    const localFound = recentPublicOrders.find(
      (o) =>
        o.orderNumber.toLowerCase() === clean ||
        (cleanDigits.length >= 8 && o.customerPhone.replace(/\s+/g, '').toLowerCase() === cleanDigits)
    );
    if (localFound) return localFound;

    // 2. Query authoritative backend endpoint (/api/orders/track)
    try {
      const res = await fetch(`/api/orders/track?q=${encodeURIComponent(queryStr.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.order) {
          return data.order as Order;
        }
      }
    } catch {
      // ignore and try fallback
    }

    // 3. Query Firestore if connected
    if (isFirebaseConnected) {
      const cloudOrder = await findOrderByQueryFromFirestore(queryStr);
      if (cloudOrder) return cloudOrder;
    }

    // 4. Fallback to initial seeded sample orders if exact reference matches
    const sampleFound = INITIAL_ORDERS.find(
      (o) =>
        o.orderNumber.toLowerCase() === clean ||
        (cleanDigits.length >= 8 && o.customerPhone.replace(/\s+/g, '').toLowerCase() === cleanDigits)
    );
    return sampleFound || null;
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus, note?: string) => {
    assertAdminAuthorized();
    const now = new Date().toISOString();
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId) {
          const updated: Order = {
            ...order,
            status,
            updatedAt: now,
            paymentStatus: status === 'delivered' ? 'collected' : order.paymentStatus,
            statusHistory: [
              ...order.statusHistory,
              {
                status,
                timestamp: now,
                note: note || `Statut mis à jour vers : ${status}`,
                updatedBy: 'Admin DzMahall',
              },
            ],
          };
          if (isFirebaseConnected) {
            void saveOrderToFirestore(updated);
          }
          return updated;
        }
        return order;
      })
    );

    fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: getAdminApiHeaders(),
      body: JSON.stringify({ status, note }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data?.order) {
            setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
          }
        }
      })
      .catch(() => {});
  };

  const updateOrderCarrier = (
    orderId: string,
    carrierId: string,
    trackingNumber?: string,
    note?: string,
    deliveryServiceType?: DeliveryServiceType,
    shippingFee?: number
  ) => {
    assertAdminAuthorized();
    const carrier = carriers.find((c) => c.id === carrierId);
    const trackingUrl = carrier?.trackingUrlTemplate && trackingNumber
      ? carrier.trackingUrlTemplate.replace('{TRACKING}', trackingNumber)
      : undefined;
    const now = new Date().toISOString();

    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId) {
          const isAlreadyShipped = Boolean(order.trackingNumber && order.trackingNumber.trim() !== '');
          const oldCarrier = order.shippingCompanyNameSnapshot || order.carrierName || 'Non défini';
          const newCarrier = carrier?.name || carrierId;
          const carrierChanged = order.carrierId !== carrierId;
          const resolvedServiceType = isAlreadyShipped
            ? order.deliveryServiceType
            : deliveryServiceType || order.deliveryServiceType;

          let nextShippingCost = order.shippingCost;
          if (!isAlreadyShipped && !order.isFreeShippingExplicit) {
            if (typeof shippingFee === 'number' && shippingFee > 0) {
              nextShippingCost = Math.round(shippingFee);
            } else if (carrierId === 'guepex' && resolvedServiceType) {
              const wilayaNum = parseInt(String(order.wilayaCode).replace(/^0+/, ''), 10) || 16;
              const wilayaObj =
                wilayas.find((w) => parseInt(w.code.replace(/^0+/, ''), 10) === wilayaNum) ||
                wilayas[0];
              const isDesk = order.deliveryMode === 'desk';
              if (resolvedServiceType === 'economique') {
                nextShippingCost = Math.max(
                  350,
                  Math.round(
                    wilayaObj.ecoDeliveryFee ||
                      (isDesk
                        ? Math.max(350, wilayaObj.deskDeliveryFee)
                        : Math.max(450, Math.round(wilayaObj.homeDeliveryFee * 0.85)))
                  )
                );
              } else {
                nextShippingCost = Math.max(
                  350,
                  Math.round(
                    wilayaObj.expressDeliveryFee ||
                      (isDesk
                        ? Math.max(450, wilayaObj.deskDeliveryFee + 100)
                        : Math.max(600, wilayaObj.homeDeliveryFee + 100))
                  )
                );
              }
            }
          }

          const sub = Math.round(
            Number(order.subtotal || Math.max(0, order.totalAmount - (order.shippingCost || 0)))
          );
          const nextTotal = order.isFreeShippingExplicit
            ? sub - (order.discount || 0)
            : sub + nextShippingCost - (order.discount || 0);

          const serviceSuffix = resolvedServiceType
            ? ` [Type : ${resolvedServiceType === 'express' ? 'Express (express)' : 'Économique (eco)'} — Frais : ${nextShippingCost} DA]`
            : '';

          const updated: Order = {
            ...order,
            carrierId,
            carrierName: newCarrier,
            shippingCompanyId: carrierId,
            shippingCompanyNameSnapshot: newCarrier,
            deliveryServiceType: resolvedServiceType,
            shippingCost: nextShippingCost,
            shippingFee: nextShippingCost,
            totalAmount: nextTotal,
            total: nextTotal,
            trackingNumber: trackingNumber !== undefined ? trackingNumber : order.trackingNumber,
            carrierTrackingUrl: trackingUrl !== undefined ? trackingUrl : order.carrierTrackingUrl,
            updatedAt: now,
            statusHistory: [
              ...order.statusHistory,
              {
                status: order.status,
                timestamp: now,
                note: note || (carrierChanged
                  ? `Transporteur modifié : « ${oldCarrier} » → « ${newCarrier} »${serviceSuffix}${trackingNumber ? ` (N° suivi : ${trackingNumber})` : ''}`
                  : `Informations transporteur mises à jour (${newCarrier})${serviceSuffix}${trackingNumber ? ` (N° suivi : ${trackingNumber})` : ''}`),
                updatedBy: 'Admin DzMahall',
              },
            ],
          };
          if (isFirebaseConnected) {
            void saveOrderToFirestore(updated);
          }
          return updated;
        }
        return order;
      })
    );

    fetch(`/api/orders/${encodeURIComponent(orderId)}/carrier`, {
      method: 'PATCH',
      headers: getAdminApiHeaders(),
      body: JSON.stringify({
        carrierId,
        carrierName: carrier?.name || carrierId,
        trackingNumber,
        trackingUrl,
        note,
        deliveryServiceType,
        shippingFee,
      }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data?.order) {
            setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
            if (isFirebaseConnected) {
              void saveOrderToFirestore(data.order);
            }
          }
        }
      })
      .catch(() => {});
  };

  // Carrier server-side configuration, real connection test & parcel creation
  const refreshCarriersFromServer = async (): Promise<CarrierConfig[]> => {
    if (!isAdminAuthorized) return carriers;
    try {
      const res = await fetch('/api/carriers', {
        headers: getAdminApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.carriers) && data.carriers.length > 0) {
          setCarriers(data.carriers);
          return data.carriers;
        }
      }
    } catch (err) {
      console.warn('Could not fetch server carriers config:', err);
    }
    return carriers;
  };

  const updateCarrier = async (
    id: string,
    updates: Partial<CarrierConfig> & { clearSecretKeys?: string[] }
  ): Promise<boolean> => {
    assertAdminAuthorized();
    try {
      const res = await fetch(`/api/carriers/${encodeURIComponent(id)}/config`, {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({
          environment: updates.environment,
          status: updates.status,
          clearSecretKeys: updates.clearSecretKeys,
          fields: updates.fields?.map((f) => ({ key: f.key, value: f.value })),
        }),
      });
      if (!res.ok) {
        return false;
      }
      const data = await res.json();
      if (!data?.success) {
        return false;
      }
      if (Array.isArray(data.carriers)) {
        setCarriers(data.carriers);
      }
      // Recharger immédiatement depuis la source persistante serveur pour vérifier la cohérence
      await refreshCarriersFromServer();
      return true;
    } catch {
      return false;
    }
  };

  const testCarrierConnection = async (
    id: string,
    overrideFields?: { key: string; value: string }[]
  ): Promise<{
    success: boolean;
    status?: string;
    message: string;
    diagnostic?: string;
    endpointTested?: string;
  }> => {
    assertAdminAuthorized();
    try {
      const res = await fetch(`/api/carriers/${encodeURIComponent(id)}/test`, {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({
          fields: overrideFields,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.carriers)) {
        setCarriers(data.carriers);
      }
      return {
        success: Boolean(data.success),
        status: data.status,
        message: data.message || 'Test terminé.',
        diagnostic: data.diagnostic,
        endpointTested: data.endpointTested,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'network_error',
        message: 'Erreur de communication avec le serveur DZMahall lors du test transporteur.',
        diagnostic: err?.message || String(err),
      };
    }
  };

  const shipOrderViaCarrier = async (
    order: Order,
    carrierId: string,
    options?: {
      dryRun?: boolean;
      confirmLiveCreation?: boolean;
      serviceType?: DeliveryServiceType;
      shippingFee?: number;
      allowExplicitFreeShipping?: boolean;
      isExplicitFreeShippingConfirmed?: boolean;
      freeShippingJustification?: string;
    }
  ) => {
    assertAdminAuthorized();
    try {
      const res = await fetch(`/api/carriers/${encodeURIComponent(carrierId)}/ship`, {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({
          order,
          dryRun: Boolean(options?.dryRun),
          confirmLiveCreation: Boolean(options?.confirmLiveCreation),
          serviceType: options?.serviceType,
          shippingFee: options?.shippingFee,
          allowExplicitFreeShipping: options?.allowExplicitFreeShipping,
          isExplicitFreeShippingConfirmed: options?.isExplicitFreeShippingConfirmed,
          freeShippingJustification: options?.freeShippingJustification,
        }),
      });
      const data = await res.json();
      if (data?.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, ...data.order } : o))
        );
      }
      if (data.success && !options?.dryRun && data.trackingNumber) {
        const effectiveServiceType = options?.serviceType || data.order?.deliveryServiceType || order.deliveryServiceType;
        const serviceLabel = effectiveServiceType
          ? ` [${effectiveServiceType === 'express' ? '⚡ Express 24h (express)' : '🌱 Économique 48h (eco)'}]`
          : '';
        updateOrderCarrier(
          order.id,
          carrierId,
          String(data.trackingNumber),
          `Colis créé via API officielle (${data.trackingNumber})${serviceLabel}`,
          effectiveServiceType
        );
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: 'Impossible de contacter le serveur pour la création du colis.',
        errorDetail: err?.message || String(err),
      };
    }
  };

  const getGuepexTariffQuote = async (
    wilayaCode: string,
    serviceType: DeliveryServiceType,
    isStopDesk = false
  ): Promise<GuepexTariffQuote> => {
    assertAdminAuthorized();
    try {
      const res = await fetch(
        `/api/carriers/guepex/tariffs?wilayaCode=${encodeURIComponent(
          wilayaCode
        )}&serviceType=${encodeURIComponent(serviceType)}&isStopDesk=${isStopDesk ? '1' : '0'}`,
        {
          headers: getAdminApiHeaders(),
        }
      );
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Could not fetch Guepex tariff quote:', err);
    }

    // Fallback localement si serveur injoignable
    const wilayaNumber = parseInt(String(wilayaCode).replace(/^0+/, ''), 10) || 16;
    const wilayaObj =
      wilayas.find((w) => parseInt(w.code.replace(/^0+/, ''), 10) === wilayaNumber) || wilayas[0];
    const fee =
      serviceType === 'express'
        ? wilayaObj.expressDeliveryFee ||
          (isStopDesk
            ? Math.max(450, wilayaObj.deskDeliveryFee + 100)
            : Math.max(600, wilayaObj.homeDeliveryFee + 100))
        : wilayaObj.ecoDeliveryFee ||
          (isStopDesk
            ? Math.max(350, wilayaObj.deskDeliveryFee)
            : Math.max(450, Math.round(wilayaObj.homeDeliveryFee * 0.85)));

    return {
      serviceType,
      fee: Math.max(350, Math.round(fee)),
      source: 'dzmahall_config',
      isVerified: true,
      message: `Tarif calculé d'après la grille DZMahall (${wilayaObj.name} - ${
        serviceType === 'express' ? 'Express 24h' : 'Économique 48h'
      }) : ${Math.max(350, Math.round(fee))} DZD.`,
    };
  };

  const runCarrierDiagnostics = async () => {
    assertAdminAuthorized();
    const res = await fetch('/api/carriers/run-diagnostics', {
      method: 'POST',
      headers: getAdminApiHeaders(),
    });
    return await res.json();
  };

  const updateWilayaRates = (
    code: string,
    homeFee: number,
    deskFee: number,
    expressFee?: number,
    ecoFee?: number
  ) => {
    assertAdminAuthorized();
    setWilayas((prev) =>
      prev.map((w) => {
        if (w.code !== code) return w;
        const updatedWilaya = {
          ...w,
          homeDeliveryFee: homeFee,
          deskDeliveryFee: deskFee,
          ...(expressFee !== undefined ? { expressDeliveryFee: expressFee } : {}),
          ...(ecoFee !== undefined ? { ecoDeliveryFee: ecoFee } : {}),
        };
        void fetch(`/api/catalog/wilayas/${encodeURIComponent(code)}`, {
          method: 'PUT',
          headers: getAdminApiHeaders(),
          body: JSON.stringify({ wilaya: updatedWilaya }),
        }).catch(() => {});
        return updatedWilaya;
      })
    );
  };

  const clearAdminAccessDenied = () => {
    setAdminAccessDenied(false);
  };

  const loginAdmin = (
    usernameInput: string,
    passwordInput: string,
    chosenRole: 'admin' | 'manager' | 'operator' = 'admin'
  ): { success: boolean; accessDenied?: boolean; error?: string } => {
    const cleanUser = usernameInput.trim().toLowerCase();
    const cleanStoredUser = adminCredentials.username.trim().toLowerCase();

    // 1. Verify if account identifier belongs to an authorized administrator
    const isAuthorizedIdentifier =
      cleanUser === cleanStoredUser ||
      AUTHORIZED_ADMIN_IDENTIFIERS.includes(cleanUser);

    if (!isAuthorizedIdentifier) {
      // Account is not recognized as an authorized administrator
      setAdminAccessDenied(true);
      setIsAdminLoggedIn(false);
      setAdminUser(null);
      return {
        success: false,
        accessDenied: true,
        error: 'Accès refusé : ce compte ne dispose pas des droits administrateur sur DzMahall.',
      };
    }

    // 2. Verify password via SHA-256 cryptographic hash (never plaintext comparison)
    const inputHash = sha256Hex(passwordInput);
    const isPasswordValid =
      (adminCredentials.password && inputHash === adminCredentials.password) ||
      AUTHORIZED_ADMIN_HASHES.includes(inputHash);

    if (!isPasswordValid) {
      return {
        success: false,
        error: 'Mot de passe incorrect. Veuillez vérifier vos identifiants.',
      };
    }

    const validRole: 'admin' | 'manager' | 'operator' = ['admin', 'manager', 'operator'].includes(chosenRole)
      ? chosenRole
      : 'admin';

    const newUser: AdminUser = {
      username: cleanUser,
      role: validRole,
      email: cleanUser.includes('@') ? cleanUser : 'admin@dzmahall.store',
      name: cleanUser === 'ouaredomar@gmail.com' ? 'Omar Ouared' : 'Administrateur DzMahall',
      lastLoginAt: new Date().toISOString(),
    };

    setAdminAccessDenied(false);
    setAdminUser(newUser);
    setIsAdminLoggedIn(true);
    setAdminRole(validRole);

    try {
      sessionStorage.setItem('dzmahall_admin_auth', 'true');
      sessionStorage.setItem('dzmahall_admin_role', validRole);
      sessionStorage.setItem('dzmahall_admin_user', JSON.stringify(newUser));
    } catch (e) {
      console.warn('Session storage error', e);
    }

    return { success: true };
  };

  const loginAdminWithGoogle = async (): Promise<{
    success: boolean;
    accessDenied?: boolean;
    error?: string;
  }> => {
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const userEmail = (credential.user.email || '').trim().toLowerCase();
      const storedAdminUser = adminCredentials.username.trim().toLowerCase();

      const isAuthorizedEmail =
        userEmail === 'ouaredomar@gmail.com' ||
        (storedAdminUser.includes('@') && userEmail === storedAdminUser);

      if (!isAuthorizedEmail) {
        await signOut(auth).catch(() => {});
        setAdminAccessDenied(true);
        setIsAdminLoggedIn(false);
        setAdminUser(null);
        return {
          success: false,
          accessDenied: true,
          error: `Accès refusé : le compte « ${userEmail || 'inconnu'} » n'est pas autorisé à administrer DzMahall.`,
        };
      }

      const newUser: AdminUser = {
        username: userEmail,
        role: 'admin',
        email: userEmail,
        name: credential.user.displayName || 'Omar Ouared',
        lastLoginAt: new Date().toISOString(),
      };

      setAdminAccessDenied(false);
      setAdminUser(newUser);
      setIsAdminLoggedIn(true);
      setAdminRole('admin');

      try {
        sessionStorage.setItem('dzmahall_admin_auth', 'true');
        sessionStorage.setItem('dzmahall_admin_role', 'admin');
        sessionStorage.setItem('dzmahall_admin_user', JSON.stringify(newUser));
      } catch (e) {
        console.warn('Session storage error', e);
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'La connexion Google a été annulée ou a échoué.',
      };
    }
  };

  const logoutAdmin = () => {
    setIsAdminLoggedIn(false);
    setAdminAccessDenied(false);
    setAdminUser(null);
    setOrders([]);
    signOut(auth).catch(() => {});
    try {
      sessionStorage.removeItem('dzmahall_admin_auth');
      sessionStorage.removeItem('dzmahall_admin_role');
      sessionStorage.removeItem('dzmahall_admin_user');
      localStorage.removeItem('dzmahall_orders');
    } catch (e) {
      console.warn('Session clear error', e);
    }
  };

  const updateAdminCredentials = (newUsername: string, newPassword: string): { success: boolean; message: string } => {
    if (!isAdminAuthorized) {
      return { success: false, message: 'Accès refusé : vous devez être connecté en tant qu\'administrateur.' };
    }
    if (!newUsername.trim() || newUsername.length < 3) {
      return { success: false, message: 'Le nom d\'utilisateur doit comporter au moins 3 caractères.' };
    }
    if (!newPassword || newPassword.length < 5) {
      return { success: false, message: 'Le mot de passe doit comporter au moins 5 caractères.' };
    }

    const passwordHash = sha256Hex(newPassword);
    const updated: AdminCredentials = {
      username: newUsername.trim(),
      password: passwordHash,
    };

    setAdminCredentials(updated);
    try {
      localStorage.setItem(
        'dzmahall_admin_credentials_v2',
        JSON.stringify({ username: updated.username, passwordHash })
      );
      localStorage.removeItem('dzmahall_admin_credentials');
    } catch (e) {
      console.warn(e);
    }

    return { success: true, message: 'Vos nouveaux identifiants d\'accès ont été enregistrés avec succès !' };
  };

  // Helper to build admin verification headers for server-side API calls
  const getAdminApiHeaders = (): Record<string, string> => {
    return {
      'Content-Type': 'application/json',
      'x-dzmahall-admin-user': adminUser?.username || adminCredentials.username || 'admin',
      'x-dzmahall-admin-role': adminUser?.role || adminRole || 'admin',
      'x-dzmahall-admin-hash': adminCredentials.password || AUTHORIZED_ADMIN_HASHES[0],
    };
  };

  const refreshEmailProviderStatus = async (): Promise<EmailProviderStatus | null> => {
    if (!isAdminAuthorized) return null;
    try {
      const response = await fetch('/api/notifications/config-status', {
        method: 'GET',
        headers: getAdminApiHeaders(),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as EmailProviderStatus;
      setEmailProviderStatus(data);
      return data;
    } catch (err) {
      console.warn('Could not fetch email provider status:', err);
      return null;
    }
  };

  useEffect(() => {
    if (isAdminAuthorized) {
      void refreshEmailProviderStatus();
    }
  }, [isAdminAuthorized]);

  const validateEmailFormat = (rawEmail: string): boolean => {
    const clean = rawEmail.trim();
    return clean.length >= 5 && clean.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(clean);
  };

  const refreshNotificationRecipientsFromServer = async (): Promise<NotificationRecipient[]> => {
    if (!isAdminAuthorized) return notificationRecipients;
    try {
      const res = await fetch('/api/notifications/recipients', {
        method: 'GET',
        headers: getAdminApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.recipients)) {
          setNotificationRecipients(data.recipients);
          const logs = data.notificationLogs || data.logs;
          if (Array.isArray(logs)) {
            setOrderNotifications(logs);
          }
          return data.recipients;
        }
      }
    } catch (err) {
      console.warn('Could not refresh notification recipients from server:', err);
    }
    return notificationRecipients;
  };

  const addNotificationRecipient = async ({
    email,
    label,
    isActive = true,
    notifyOnNewOrder = true,
  }: {
    email: string;
    label?: string;
    isActive?: boolean;
    notifyOnNewOrder?: boolean;
  }): Promise<{ success: boolean; message: string; recipient?: NotificationRecipient }> => {
    assertAdminAuthorized();
    const cleanEmail = email.trim().toLowerCase();

    if (!validateEmailFormat(cleanEmail)) {
      return {
        success: false,
        message: 'Veuillez saisir une adresse e-mail valide (ex: contact@dzmahall.store).',
      };
    }

    const duplicate = notificationRecipients.find(
      (r) => r.email.trim().toLowerCase() === cleanEmail
    );
    if (duplicate) {
      return {
        success: false,
        message: `L'adresse « ${cleanEmail} » est déjà enregistrée dans la liste des destinataires.`,
      };
    }

    const now = new Date().toISOString();
    const newRecipient: NotificationRecipient = {
      id: `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      email: cleanEmail,
      label: label?.trim() || 'Destinataire Commandes',
      isActive,
      notifyOnNewOrder,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const res = await fetch('/api/notifications/recipients', {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({ recipient: newRecipient }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return {
          success: false,
          message:
            data?.message ||
            'Erreur serveur : impossible d’enregistrer cette adresse destinataire. Vos adresses existantes restent intactes.',
        };
      }

      const savedRecipient: NotificationRecipient = data.recipient || newRecipient;
      if (Array.isArray(data.recipients)) {
        setNotificationRecipients(data.recipients);
      } else {
        await refreshNotificationRecipientsFromServer();
      }

      if (isFirebaseConnected) {
        void saveNotificationRecipientToFirestore(savedRecipient);
      }

      return {
        success: true,
        message: `L'adresse « ${cleanEmail} » a été enregistrée et confirmée sur le serveur.`,
        recipient: savedRecipient,
      };
    } catch (err) {
      return {
        success: false,
        message:
          'Erreur réseau : impossible de contacter le serveur pour enregistrer l’adresse e-mail.',
      };
    }
  };

  const updateNotificationRecipient = async (
    id: string,
    updates: Partial<Pick<NotificationRecipient, 'email' | 'label' | 'isActive' | 'notifyOnNewOrder'>>
  ): Promise<{ success: boolean; message: string }> => {
    assertAdminAuthorized();
    const existing = notificationRecipients.find((r) => r.id === id);
    if (!existing) {
      return { success: false, message: 'Destinataire introuvable.' };
    }

    let nextEmail = existing.email;
    if (updates.email !== undefined) {
      const cleanEmail = updates.email.trim().toLowerCase();
      if (!validateEmailFormat(cleanEmail)) {
        return {
          success: false,
          message: 'Format d’adresse e-mail invalide.',
        };
      }
      const duplicate = notificationRecipients.find(
        (r) => r.id !== id && r.email.trim().toLowerCase() === cleanEmail
      );
      if (duplicate) {
        return {
          success: false,
          message: `L'adresse « ${cleanEmail} » existe déjà dans la liste.`,
        };
      }
      nextEmail = cleanEmail;
    }

    const updatedRecipient: NotificationRecipient = {
      ...existing,
      ...updates,
      email: nextEmail,
      label: updates.label !== undefined ? updates.label.trim() : existing.label,
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/notifications/recipients', {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({ recipient: updatedRecipient }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return {
          success: false,
          message:
            data?.message ||
            'Erreur serveur : les modifications du destinataire n’ont pas pu être enregistrées.',
        };
      }

      if (Array.isArray(data.recipients)) {
        setNotificationRecipients(data.recipients);
      } else {
        await refreshNotificationRecipientsFromServer();
      }

      if (isFirebaseConnected) {
        void saveNotificationRecipientToFirestore(data.recipient || updatedRecipient);
      }

      return {
        success: true,
        message: 'Paramètres du destinataire enregistrés et confirmés sur le serveur.',
      };
    } catch (err) {
      return {
        success: false,
        message: 'Erreur réseau lors de la sauvegarde du destinataire.',
      };
    }
  };

  const deleteNotificationRecipient = async (
    id: string
  ): Promise<{ success: boolean; message: string }> => {
    assertAdminAuthorized();
    const existing = notificationRecipients.find((r) => r.id === id);
    try {
      const res = await fetch(`/api/notifications/recipients/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAdminApiHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return {
          success: false,
          message:
            data?.message ||
            'Erreur serveur : impossible de supprimer cette adresse destinataire.',
        };
      }

      if (Array.isArray(data.recipients)) {
        setNotificationRecipients(data.recipients);
      } else {
        setNotificationRecipients((prev) => prev.filter((r) => r.id !== id));
      }

      if (isFirebaseConnected) {
        void deleteNotificationRecipientFromFirestore(id);
      }

      return {
        success: true,
        message: existing
          ? `L'adresse « ${existing.email} » a été supprimée du serveur.`
          : 'Adresse supprimée avec succès.',
      };
    } catch (err) {
      return {
        success: false,
        message: 'Erreur réseau : impossible de supprimer l’adresse destinataire.',
      };
    }
  };

  const verifySmtpConnection = async () => {
    assertAdminAuthorized();
    try {
      const res = await fetch('/api/notifications/verify-smtp', {
        method: 'POST',
        headers: getAdminApiHeaders(),
      });
      const data = await res.json();
      await refreshEmailProviderStatus();
      return {
        success: Boolean(data.success),
        status: String(data.status || (data.success ? 'verified' : 'failed')),
        message: String(data.message || 'Vérification SMTP terminée.'),
        errorDetail: data.errorDetail,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpSecure: data.smtpSecure,
        smtpUser: data.smtpUser,
        passLength: data.passLength,
        isValidAppPasswordFormat: data.isValidAppPasswordFormat,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'network_error',
        message: 'Impossible de contacter le serveur pour vérifier la connexion SMTP.',
        errorDetail: err?.message || String(err),
      };
    }
  };

  const saveSmtpAppPassword = async (
    appPassword: string,
    options?: {
      smtpHost?: string;
      smtpUser?: string;
      smtpPort?: number;
      smtpSecure?: boolean;
      smtpFrom?: string;
    }
  ) => {
    assertAdminAuthorized();
    try {
      const res = await fetch('/api/notifications/smtp-config', {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({
          smtpPass: appPassword,
          smtpHost: options?.smtpHost,
          smtpUser: options?.smtpUser,
          smtpPort: options?.smtpPort,
          smtpSecure: options?.smtpSecure,
          smtpFrom: options?.smtpFrom,
        }),
      });
      const data = await res.json();
      await refreshEmailProviderStatus();
      return {
        success: Boolean(data.success),
        saved: Boolean(data.saved),
        verified: Boolean(data.verified),
        status: data.status,
        message: String(data.message || 'Paramètres Gmail SMTP mis à jour.'),
        errorDetail: data.errorDetail,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'network_error',
        message: 'Impossible d’enregistrer la configuration Gmail SMTP sur le serveur.',
        errorDetail: err?.message || String(err),
      };
    }
  };

  const deleteSmtpConfiguration = async () => {
    assertAdminAuthorized();
    try {
      const res = await fetch('/api/notifications/smtp-config', {
        method: 'DELETE',
        headers: getAdminApiHeaders(),
      });
      const data = await res.json();
      const updatedStatus = await refreshEmailProviderStatus();
      const verifiedOnClient =
        Boolean(data.success) &&
        Boolean(data.verifiedDeleted) &&
        updatedStatus?.configState === 'not_configured' &&
        !updatedStatus?.passDefined;

      if (!verifiedOnClient) {
        return {
          success: false,
          verifiedDeleted: false,
          status: updatedStatus?.configState || 'error',
          message:
            data.message ||
            'La suppression de la configuration SMTP n’a pas pu être confirmée par le serveur.',
        };
      }

      return {
        success: true,
        verifiedDeleted: true,
        status: 'not_configured',
        message: String(
          data.message ||
            'La configuration SMTP Gmail et les secrets associés ont été supprimés avec succès.'
        ),
      };
    } catch (err: any) {
      return {
        success: false,
        verifiedDeleted: false,
        status: 'network_error',
        message: 'Impossible de contacter le serveur pour supprimer la configuration SMTP Gmail.',
        errorDetail: err?.message || String(err),
      };
    }
  };

  const sendTestNotificationEmail = async (
    targetEmail?: string
  ): Promise<{
    success: boolean;
    status: string;
    message: string;
    errorDetail?: string;
    testedRecipients?: string[];
  }> => {
    assertAdminAuthorized();

    const targetList = targetEmail
      ? [targetEmail.trim().toLowerCase()]
      : notificationRecipients
          .filter((r) => r.isActive)
          .map((r) => r.email.trim().toLowerCase());

    if (targetList.length === 0) {
      return {
        success: false,
        status: 'no_recipients',
        message:
          'Aucune adresse e-mail active sélectionnée pour le test. Ajoutez ou activez au moins une adresse.',
      };
    }

    try {
      const response = await fetch('/api/notifications/send-test', {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({ recipients: targetList }),
      });

      const data = await response.json();
      const now = new Date().toISOString();
      const testStatus: 'sent' | 'failed' | 'not_configured' =
        data.status === 'sent'
          ? 'sent'
          : data.status === 'not_configured'
          ? 'not_configured'
          : 'failed';

      for (const rcpt of notificationRecipients) {
        if (targetList.includes(rcpt.email.trim().toLowerCase())) {
          const updated: NotificationRecipient = {
            ...rcpt,
            lastTestSentAt: now,
            lastTestStatus: testStatus,
            updatedAt: now,
          };
          void fetch('/api/notifications/recipients', {
            method: 'POST',
            headers: getAdminApiHeaders(),
            body: JSON.stringify({ recipient: updated }),
          }).catch(() => {});
          if (isFirebaseConnected) {
            void saveNotificationRecipientToFirestore(updated);
          }
        }
      }

      await refreshEmailProviderStatus();

      return {
        success: Boolean(data.success),
        status: String(data.status || 'failed'),
        message: String(data.message || 'Test terminé.'),
        errorDetail: data.errorDetail,
        testedRecipients: data.testedRecipients || targetList,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        message: 'Impossible de contacter le serveur de notifications.',
        errorDetail: err?.message || String(err),
      };
    }
  };

  /**
   * Non-blocking automatic order notification dispatcher:
   * - Calls server-side /api/notifications/send-order-alert
   * - Server persists the notification log & updates order.notificationStatus independently
   * - Never throws or blocks order validation
   */
  const dispatchOrderEmailNotificationNonBlocking = async (
    order: Order,
    forceRetry = false
  ): Promise<{
    success: boolean;
    status: string;
    message: string;
    errorDetail?: string;
  }> => {
    try {
      const activeRecipients = notificationRecipients.filter(
        (r) => r.isActive && r.notifyOnNewOrder
      );

      const headers: Record<string, string> = forceRetry
        ? getAdminApiHeaders()
        : { 'Content-Type': 'application/json' };

      const response = await fetch('/api/notifications/send-order-alert', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          order,
          recipients: activeRecipients,
          forceRetry,
        }),
      });

      const data = await response.json();

      if (data.logEntry) {
        const logEntry = data.logEntry as OrderNotificationLog;
        setOrderNotifications((prev) => [
          logEntry,
          ...prev.filter((l) => l.id !== logEntry.id),
        ]);
        if (isFirebaseConnected) {
          void saveOrderNotificationToFirestore(logEntry);
        }
      }

      if (isAdminAuthorized) {
        void refreshOrdersFromServer();
      }

      return {
        success: Boolean(data.success),
        status: String(data.status || (data.success ? 'sent' : 'failed')),
        message: String(
          data.message ||
            (data.success
              ? 'Notification envoyée avec succès.'
              : 'Notification non envoyée.')
        ),
        errorDetail: data.errorDetail,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        message: 'Erreur réseau lors du déclenchement de la notification.',
        errorDetail: err?.message || String(err),
      };
    }
  };

  const retryOrderNotification = async (
    orderId: string
  ): Promise<{
    success: boolean;
    status: string;
    message: string;
    errorDetail?: string;
  }> => {
    assertAdminAuthorized();
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      return {
        success: false,
        status: 'not_found',
        message: 'Commande introuvable dans la base de données.',
      };
    }
    return await dispatchOrderEmailNotificationNonBlocking(targetOrder, true);
  };

  /**
   * Authoritative Server-Side COD Order Validation & Creation:
   * 1. Validates customer info, Algerian phone format, wilaya, commune, delivery mode
   * 2. Recalculates product prices, shipping fees & total COD on the server
   * 3. Persists the order synchronously on the server (.aistudio/fraud-engine-state.json) BEFORE confirming
   * 4. Triggers the email notification asynchronously on the server without ever blocking or cancelling the order
   */
  const submitSecureOrder = async (orderData: {
    customerName: string;
    customerPhone: string;
    wilayaCode: string;
    commune: string;
    deliveryAddress?: string;
    deliveryMode: 'home' | 'desk';
    deskName?: string;
    notes?: string;
    items?: CartItem[];
    landingPageId?: string;
    landingPageSlug?: string;
    landingPageTitle?: string;
    shippingCompanyId?: string;
    shippingCompanyNameSnapshot?: string;
    deliveryServiceType?: DeliveryServiceType;
    shippingFee?: number;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    honeypot?: string;
    formElapsedMs?: number;
    idempotencyKey?: string;
    challengeConfirmed?: boolean;
    source?: 'storefront' | 'product_page' | 'landing_page' | 'api';
  }) => {
    const targetItems = orderData.items && orderData.items.length > 0 ? orderData.items : cart;
    const wilaya = wilayas.find((w) => w.code === orderData.wilayaCode) || wilayas[15];
    const expectedShipping =
      typeof orderData.shippingFee === 'number' && orderData.shippingFee > 0
        ? orderData.shippingFee
        : orderData.deliveryMode === 'home'
        ? wilaya.homeDeliveryFee
        : wilaya.deskDeliveryFee;
    const clientSubtotal = targetItems.reduce(
      (sum, it) => sum + it.unitPrice * it.quantity,
      0
    );
    const clientTotalAmount = clientSubtotal + expectedShipping;

    const payload = {
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      wilayaCode: orderData.wilayaCode,
      commune: orderData.commune,
      deliveryAddress: orderData.deliveryAddress,
      deliveryMode: orderData.deliveryMode,
      deskName: orderData.deskName,
      notes: orderData.notes,
      items: targetItems.map((it) => ({
        productId: it.product.id,
        variantId: it.variantId,
        variantName: it.variantName,
        quantity: it.quantity,
        clientUnitPrice: it.unitPrice,
        productSnapshot: {
          id: it.product.id,
          name: it.product.name,
          price: it.product.price,
          stockQuantity: it.product.stockQuantity,
          isActive: it.product.isActive,
          variants: it.product.variants,
        },
      })),
      clientTotalAmount,
      landingPageId: orderData.landingPageId,
      landingPageSlug: orderData.landingPageSlug,
      landingPageTitle: orderData.landingPageTitle,
      shippingCompanyId: orderData.shippingCompanyId,
      shippingCompanyNameSnapshot: orderData.shippingCompanyNameSnapshot,
      deliveryServiceType: orderData.deliveryServiceType,
      utm_source: orderData.utm_source,
      utm_medium: orderData.utm_medium,
      utm_campaign: orderData.utm_campaign,
      utm_content: orderData.utm_content,
      utm_term: orderData.utm_term,
      honeypot: orderData.honeypot || '',
      formElapsedMs: orderData.formElapsedMs ?? 4500,
      idempotencyKey: orderData.idempotencyKey,
      challengeConfirmed: Boolean(orderData.challengeConfirmed),
      source:
        orderData.source ||
        (orderData.landingPageSlug || orderData.landingPageId ? 'landing_page' : 'storefront'),
    };

    try {
      const response = await fetch('/api/orders/validate-and-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.requiresConfirmationChallenge) {
        return {
          allowed: false,
          code: data.code || 'CHALLENGE_REQUIRED',
          message:
            data.message ||
            'Une confirmation supplémentaire est requise avant de finaliser votre commande.',
          requiresConfirmationChallenge: true,
          requiresAdditionalConfirmation: true,
          riskLevel: data.riskLevel,
          riskReasons: data.riskReasons || [],
        };
      }

      if (!response.ok || !data.allowed || !data.order) {
        return {
          allowed: false,
          code: data.code || 'ORDER_REJECTED',
          message:
            data.message ||
            'Votre commande n’a pas pu être enregistrée. Veuillez vérifier vos informations et réessayer.',
          riskLevel: data.riskLevel,
          riskReasons: data.riskReasons || [],
        };
      }

      const validatedOrder: Order = data.order;

      // Only decrement client-side stock if this wasn't an intercepted duplicate click
      if (!data.duplicatePrevented) {
        setProducts((prev) =>
          prev.map((prod) => {
            const ordered = targetItems.find((it) => it.product.id === prod.id);
            if (ordered) {
              const newQty = Math.max(0, prod.stockQuantity - ordered.quantity);
              const updatedProd = { ...prod, stockQuantity: newQty };
              if (isFirebaseConnected) {
                saveProductToFirestore(updatedProd).catch(() => {});
              }
              return updatedProd;
            }
            return prod;
          })
        );

        if (orderData.landingPageId || orderData.landingPageSlug) {
          setLandingPages((prev) =>
            prev.map((lp) => {
              if (
                lp.id === orderData.landingPageId ||
                lp.slug === orderData.landingPageSlug
              ) {
                const updatedLp = { ...lp, ordersCount: (lp.ordersCount || 0) + 1 };
                if (isFirebaseConnected) {
                  saveLandingPageToFirestore(updatedLp).catch(() => {});
                }
                return updatedLp;
              }
              return lp;
            })
          );
        }

        if (isAdminAuthorized) {
          setOrders((prev) => mergeOrdersList([validatedOrder], prev));
          // Refresh after background email dispatch completes so notificationStatus is updated
          setTimeout(() => {
            void refreshOrdersFromServer();
          }, 1200);
        }
        setRecentPublicOrders((prev) => [
          validatedOrder,
          ...prev.filter((o) => o.id !== validatedOrder.id).slice(0, 9),
        ]);
        if (isFirebaseConnected) {
          saveOrderToFirestore(validatedOrder).catch(() => {});
        }
      }

      if (!orderData.items || orderData.items.length === 0) {
        clearCart();
      }

      return {
        allowed: true,
        code: data.code || 'ORDER_CREATED',
        message: data.message || 'Commande enregistrée avec succès.',
        order: validatedOrder,
        duplicatePrevented: Boolean(data.duplicatePrevented),
        riskLevel: validatedOrder.riskLevel,
        riskReasons: validatedOrder.riskReasons,
      };
    } catch (err: any) {
      return {
        allowed: false,
        code: 'NETWORK_ERROR',
        message:
          'Impossible de joindre le serveur de validation. Veuillez vérifier votre connexion et réessayer.',
      };
    }
  };

  const recordOrderContactAttempt = async (
    orderId: string,
    attempt: {
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
    }
  ): Promise<void> => {
    assertAdminAuthorized();
    const now = new Date().toISOString();
    const newAttempt: OrderContactAttempt = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      channel: attempt.channel,
      outcome: attempt.outcome,
      note: attempt.note,
      operator: adminUser?.username || 'Admin DzMahall',
    };

    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        const existingHistory = order.confirmationHistory || order.contactAttempts || [];
        const updatedHistory = [newAttempt, ...existingHistory];

        let nextStatus: OrderStatus = order.status;
        if (attempt.outcome === 'confirmed') {
          nextStatus = 'confirmed';
        } else if (
          attempt.outcome === 'wrong_number' ||
          attempt.outcome === 'refused_cancelled' ||
          attempt.outcome === 'cancelled_by_customer'
        ) {
          nextStatus = 'cancelled';
        }

        const updatedOrder: Order = {
          ...order,
          status: nextStatus,
          updatedAt: now,
          confirmationHistory: updatedHistory,
          contactAttempts: updatedHistory,
          statusHistory: [
            ...order.statusHistory,
            {
              status: nextStatus,
              timestamp: now,
              note: `[Confirmation ${attempt.channel}] Résultat: ${attempt.outcome}${
                attempt.note ? ` — ${attempt.note}` : ''
              }`,
              updatedBy: adminUser?.username || 'Admin DzMahall',
            },
          ],
        };

        if (isFirebaseConnected) {
          void saveOrderToFirestore(updatedOrder);
        }
        return updatedOrder;
      })
    );

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/contact-attempt`, {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({
          ...attempt,
          operator: adminUser?.username || 'Admin DzMahall',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.order) {
          setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
        }
      }
    } catch {
      // ignore network error
    }
  };

  const refreshFraudOverview = async (): Promise<void> => {
    if (!isAdminAuthorized) return;
    try {
      // Sync current catalog, wilayas & orders to server fraud engine first
      await fetch('/api/fraud/sync', {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({
          products,
          wilayas,
          orders,
        }),
      });

      const res = await fetch('/api/fraud/overview', {
        headers: getAdminApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.watchlist)) setFraudWatchlist(data.watchlist);
        if (data.settings) setFraudSettings(data.settings);
        if (Array.isArray(data.securityEvents)) setSecurityEvents(data.securityEvents);
      }
    } catch (err) {
      console.warn('Failed to refresh fraud overview:', err);
    }
  };

  const upsertWatchlistPhone = async (data: {
    phone: string;
    status: 'watched' | 'blocked' | 'trusted';
    reason: string;
    notes?: string;
    durationHours?: number | null;
  }): Promise<{ ok: boolean; error?: string }> => {
    assertAdminAuthorized();
    try {
      const res = await fetch('/api/fraud/watchlist', {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify({
          phone: data.phone,
          status: data.status,
          reason: data.reason,
          notes: data.notes,
          durationHours: data.durationHours ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { ok: false, error: json.message || 'Erreur lors de la mise à jour.' };
      }
      await refreshFraudOverview();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Erreur réseau.' };
    }
  };

  const removeWatchlistPhone = async (phone: string): Promise<boolean> => {
    assertAdminAuthorized();
    try {
      const res = await fetch(`/api/fraud/watchlist/${encodeURIComponent(phone)}`, {
        method: 'DELETE',
        headers: getAdminApiHeaders(),
      });
      if (res.ok) {
        await refreshFraudOverview();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const saveFraudSettings = async (
    updates: Partial<FraudProtectionSettings>
  ): Promise<boolean> => {
    assertAdminAuthorized();
    try {
      const res = await fetch('/api/fraud/settings', {
        method: 'POST',
        headers: getAdminApiHeaders(),
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.settings) setFraudSettings(json.settings);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const runSecuritySelfTests = async () => {
    assertAdminAuthorized();
    const res = await fetch('/api/fraud/run-tests', {
      method: 'POST',
      headers: getAdminApiHeaders(),
    });
    const data = await res.json();
    return {
      passed: Number(data.passedCount || 0),
      total: Number(data.totalCount || 12),
      allPassed: Boolean(data.allPassed),
      results: Array.isArray(data.results)
        ? data.results.map((r: any) => ({
            id: r.id,
            name: r.title || r.name,
            passed: Boolean(r.passed),
            expected: r.expected,
            actual: r.actual,
          }))
        : [],
    };
  };

  return (
    <StoreContext.Provider
      value={{
        isFirebaseConnected,
        syncLocalToCloud,
        currentRoute,
        navigateTo,
        selectedProductSlug,
        setSelectedProductSlug,
        selectedOrderId,
        setSelectedOrderId,
        cart,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartCount,
        cartSubtotal,
        products,
        isCatalogLoading,
        isCatalogSyncing,
        lastCatalogSyncedAt,
        pendingProductIds,
        catalogError,
        refreshCatalogFromServer,
        refreshCatalog: refreshCatalogFromServer,
        addProduct,
        updateProduct,
        deleteProduct,
        importProductsBatch,
        categories,
        addCategory,
        updateCategory,
        reorderCategories,
        addSubCategory,
        updateSubCategory,
        reorderSubCategories,
        landingPages,
        selectedLandingPageSlug,
        setSelectedLandingPageSlug,
        addLandingPage,
        updateLandingPage,
        deleteLandingPage,
        duplicateLandingPage,
        incrementLandingPageView,
        orders,
        createOrder,
        trackOrderByQuery,
        refreshOrdersFromServer,
        updateOrderStatus,
        updateOrderCarrier,
        orderDeletionAuditLogs,
        deleteOrder,
        carriers,
        refreshCarriersFromServer,
        updateCarrier,
        testCarrierConnection,
        shipOrderViaCarrier,
        getGuepexTariffQuote,
        runCarrierDiagnostics,
        wilayas,
        updateWilayaRates,
        brandName,
        contactPhone,
        contactWhatsApp,
        storeDomain,
        businessCardImageUrl,
        isCardModalOpen,
        setIsCardModalOpen,
        isAdminLoggedIn,
        isAdminAuthorized,
        adminAccessDenied,
        clearAdminAccessDenied,
        setIsAdminLoggedIn,
        adminRole,
        setAdminRole,
        adminUser,
        adminCredentials,
        loginAdmin,
        loginAdminWithGoogle,
        logoutAdmin,
        updateAdminCredentials,
        notificationRecipients,
        orderNotifications,
        emailProviderStatus,
        refreshEmailProviderStatus,
        refreshNotificationRecipientsFromServer,
        addNotificationRecipient,
        updateNotificationRecipient,
        deleteNotificationRecipient,
        sendTestNotificationEmail,
        retryOrderNotification,
        verifySmtpConnection,
        saveSmtpAppPassword,
        deleteSmtpConfiguration,
        submitSecureOrder,
        recordOrderContactAttempt,
        fraudWatchlist,
        fraudSettings,
        securityEvents,
        refreshFraudOverview,
        upsertWatchlistPhone,
        removeWatchlistPhone,
        saveFraudSettings,
        runSecuritySelfTests,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
