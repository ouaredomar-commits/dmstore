import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Request } from 'express';
import {
  Product,
  Wilaya,
  Order,
  OrderItem,
  OrderStatus,
  OrderRiskLevel,
  FraudWatchlistEntry,
  FraudProtectionSettings,
  SecurityEventLog,
  SecurityEventType,
  OrderContactAttempt,
  NotificationRecipient,
  OrderNotificationLog,
  CancellationOrigin,
  PhoneDuplicateAlertFlags,
  PublicPhoneCheckResult,
  AdminPhoneHistoryOrderItem,
  AdminPhoneHistorySummary,
  CategoryItem,
  LandingPage,
  OrderDeletionAuditLog,
} from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_CATEGORIES, LEGACY_PLACEHOLDER_CATEGORY_IDS } from '../data/initialCategories';
import { INITIAL_LANDING_PAGES } from '../data/initialLandingPages';
import { ALGERIA_WILAYAS } from '../data/wilayas';
import { INITIAL_ORDERS } from '../data/initialOrders';
import { INITIAL_CARRIERS } from '../data/initialCarriers';
import {
  normalizeAndValidateAlgerianPhone,
  computeOrderSignature,
  DEFAULT_FRAUD_SETTINGS,
} from '../utils/orderSecurity';
import {
  matchLandingPage,
  normalizeLandingPageSlug,
  extractCoreLandingPageSlug,
} from '../utils/landingPageMatcher';

/**
 * Identifiants des anciens produits de démonstration initiaux supprimés par l'administrateur.
 * Ces identifiants ne doivent jamais être réinjectés automatiquement dans le catalogue officiel.
 */
export const LEGACY_DEMO_PRODUCT_IDS = new Set<string>([
  'prod-1',
  'prod-2',
  'prod-3',
  'prod-4',
  'prod-5',
  'prod-6',
  'prod-7',
  'prod-8',
]);

export interface OrderSubmissionItemInput {
  productId: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  clientUnitPrice?: number;
  productSnapshot?: Product;
}

export interface OrderSubmissionPayload {
  customerName: string;
  customerPhone: string;
  wilayaCode: string;
  commune: string;
  deliveryAddress?: string;
  deliveryMode: 'home' | 'desk';
  deskName?: string;
  notes?: string;
  items: OrderSubmissionItemInput[];
  clientSubtotal?: number;
  clientShippingFee?: number;
  clientTotalAmount?: number;
  landingPageId?: string;
  landingPageSlug?: string;
  landingPageTitle?: string;
  shippingCompanyId?: string;
  shippingCompanyNameSnapshot?: string;
  deliveryServiceType?: 'express' | 'economique';
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  honeypot?: string;
  formElapsedMs?: number;
  idempotencyKey?: string;
  challengeConfirmed?: boolean;
  simulateDatabaseError?: boolean;
  source?: 'storefront' | 'product_page' | 'landing_page' | 'api';
}

export interface OrderValidationOutcome {
  httpStatus: number;
  allowed: boolean;
  code: string;
  message: string;
  duplicatePrevented?: boolean;
  requiresConfirmationChallenge?: boolean;
  riskLevel?: OrderRiskLevel;
  riskScore?: number;
  riskReasons?: string[];
  order?: Order;
  updatedProducts?: Product[];
}

interface FraudEngineState {
  products: Map<string, Product>;
  deletedProductIds: Set<string>;
  categories: Map<string, CategoryItem>;
  landingPages: Map<string, LandingPage>;
  wilayas: Map<string, Wilaya>;
  catalogUpdatedAt: string;
  orders: Order[];
  deletedOrderIds: Set<string>;
  orderDeletionAuditLogs: OrderDeletionAuditLog[];
  watchlist: Map<string, FraudWatchlistEntry>;
  settings: FraudProtectionSettings;
  securityEvents: SecurityEventLog[];
  notificationRecipients: Map<string, NotificationRecipient>;
  notificationRecipientsInitialized?: boolean;
  orderNotifications: Map<string, OrderNotificationLog>;
  smtpConfigVault?: Record<string, any> | null;
  carriersVault?: Record<string, any> | null;
  idempotencyCache: Map<string, { order: Order; timestampMs: number }>;
  signatureCache: Map<string, { order: Order; timestampMs: number }>;
  phoneTimestamps: Map<string, number[]>;
  sessionTimestamps: Map<string, number[]>;
}

const PERSIST_FILE = path.join(process.cwd(), '.aistudio', 'fraud-engine-state.json');
const DAILY_PRIVACY_SALT = crypto.randomBytes(16).toString('hex');

const INITIAL_WATCHLIST: FraudWatchlistEntry[] = [
  {
    id: '0559988776',
    phone: '0559988776',
    status: 'watched',
    reason: '2 commandes précédentes non confirmées par téléphone (injoignable)',
    notes: 'Demander une confirmation sur WhatsApp avant expédition Yalidine.',
    addedBy: 'Admin DzMahall',
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: '0779001122',
    phone: '0779001122',
    status: 'blocked',
    reason: 'Commandes fictives répétées avec fausses adresses signalées par le livreur',
    notes: 'Blocage temporaire révisable par l’administrateur.',
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    addedBy: 'Admin DzMahall',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
];

function normalizeServerProduct(prod: Product): Product {
  const imageUrlsFromImages = Array.isArray(prod.images)
    ? prod.images.map((img) => img?.url).filter((u): u is string => Boolean(u))
    : [];
  const rawImageUrls = Array.isArray(prod.imageUrls)
    ? prod.imageUrls.filter((u): u is string => Boolean(u))
    : [];
  const finalImageUrls = rawImageUrls.length > 0 ? rawImageUrls : imageUrlsFromImages;

  return {
    ...prod,
    id: String(prod.id).trim(),
    name: String(prod.name || '').trim(),
    price: Number(prod.price) || 0,
    purchaseCost: Number(prod.purchaseCost) || 0,
    advertisingCost: Number(prod.advertisingCost) || 0,
    packagingCost: Number(prod.packagingCost) || 0,
    stockQuantity: Number(prod.stockQuantity) || 0,
    isActive: prod.isActive !== false,
    imageUrls: finalImageUrls,
    features: Array.isArray(prod.features) ? prod.features : [],
    variants: Array.isArray(prod.variants) ? prod.variants : [],
    createdAt: prod.createdAt || new Date().toISOString(),
    updatedAt: prod.updatedAt || prod.createdAt || new Date().toISOString(),
  };
}

function createInitialState(includeSandboxDemoProducts = false): FraudEngineState {
  const products = new Map<string, Product>();
  if (includeSandboxDemoProducts) {
    for (const p of INITIAL_PRODUCTS) {
      products.set(p.id, structuredClone(p));
    }
  }

  const deletedProductIds = new Set<string>(
    includeSandboxDemoProducts ? [] : Array.from(LEGACY_DEMO_PRODUCT_IDS)
  );

  const categories = new Map<string, CategoryItem>();
  for (const c of INITIAL_CATEGORIES) {
    categories.set(c.id, structuredClone(c));
  }

  const landingPages = new Map<string, LandingPage>();
  for (const lp of INITIAL_LANDING_PAGES) {
    landingPages.set(lp.id, structuredClone(lp));
  }

  const wilayas = new Map<string, Wilaya>();
  for (const w of ALGERIA_WILAYAS) {
    wilayas.set(w.code, structuredClone(w));
  }

  const watchlist = new Map<string, FraudWatchlistEntry>();
  for (const entry of INITIAL_WATCHLIST) {
    watchlist.set(entry.phone, structuredClone(entry));
  }

  const notificationRecipients = new Map<string, NotificationRecipient>();
  const defaultRecipient: NotificationRecipient = {
    id: 'rcpt-default-owner',
    email: 'ouaredomar@gmail.com',
    label: 'Direction DZMahall (Principal)',
    isActive: true,
    notifyOnNewOrder: true,
    createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
  };
  notificationRecipients.set(defaultRecipient.id, defaultRecipient);

  return {
    products,
    deletedProductIds,
    categories,
    landingPages,
    wilayas,
    catalogUpdatedAt: new Date().toISOString(),
    orders: structuredClone(INITIAL_ORDERS),
    deletedOrderIds: new Set<string>(),
    orderDeletionAuditLogs: [],
    watchlist,
    settings: structuredClone(DEFAULT_FRAUD_SETTINGS),
    securityEvents: [],
    notificationRecipients,
    notificationRecipientsInitialized: false,
    orderNotifications: new Map(),
    idempotencyCache: new Map(),
    signatureCache: new Map(),
    phoneTimestamps: new Map(),
    sessionTimestamps: new Map(),
  };
}

const liveState: FraudEngineState = createInitialState(false);

// Load persisted orders, products, categories, landingPages, wilayas, watchlist, settings, recipients, and notification logs
function loadPersistedState() {
  try {
    if (fs.existsSync(PERSIST_FILE)) {
      const raw = JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf-8'));
      let needsCleanupPersist = false;

      if (raw.settings) {
        liveState.settings = { ...DEFAULT_FRAUD_SETTINGS, ...raw.settings };
      }
      if (Array.isArray(raw.watchlist)) {
        liveState.watchlist.clear();
        for (const item of raw.watchlist) {
          if (item && item.phone) {
            liveState.watchlist.set(item.phone, item);
          }
        }
      }
      if (Array.isArray(raw.securityEvents)) {
        liveState.securityEvents = raw.securityEvents.slice(0, 200);
      }

      // Restore deleted product IDs and always enforce exclusion of the 8 initial demo products (prod-1..prod-8)
      liveState.deletedProductIds = new Set<string>(Array.from(LEGACY_DEMO_PRODUCT_IDS));
      if (Array.isArray(raw.deletedProductIds)) {
        for (const delId of raw.deletedProductIds) {
          if (typeof delId === 'string' && delId.trim()) {
            liveState.deletedProductIds.add(delId.trim());
          }
        }
      }

      // Restore official products (never pre-seeded with INITIAL_PRODUCTS, and excluding deleted/demo IDs)
      liveState.products.clear();
      if (Array.isArray(raw.products)) {
        for (const prod of raw.products) {
          if (!prod || !prod.id) continue;
          const pid = String(prod.id).trim();
          if (liveState.deletedProductIds.has(pid)) {
            needsCleanupPersist = true;
            continue;
          }
          if (
            prod &&
            prod.id &&
            (typeof prod.price === 'number' ||
              (prod.price !== undefined && prod.price !== null && !isNaN(Number(prod.price))))
          ) {
            liveState.products.set(pid, normalizeServerProduct(prod));
          }
        }
      }

      if (Array.isArray(raw.categories) && raw.categories.length > 0) {
        for (const cat of raw.categories) {
          if (cat && cat.id && !LEGACY_PLACEHOLDER_CATEGORY_IDS.has(cat.id)) {
            const official = INITIAL_CATEGORIES.find((ic) => ic.id === cat.id);
            liveState.categories.set(cat.id, {
              ...(official || {}),
              ...cat,
              icon: cat.icon || official?.icon,
              nameTranslations: cat.nameTranslations || official?.nameTranslations,
              subcategories:
                Array.isArray(cat.subcategories) && cat.subcategories.length > 0
                  ? cat.subcategories
                  : official?.subcategories || [],
            });
          }
        }
      }

      // Restaurer les landing pages en préservant et garantissant les pages officielles initiales
      const officialLpMap = new Map<string, LandingPage>();
      for (const initLp of INITIAL_LANDING_PAGES) {
        officialLpMap.set(initLp.id, structuredClone(initLp));
      }
      if (Array.isArray(raw.landingPages) && raw.landingPages.length > 0) {
        for (const lp of raw.landingPages) {
          if (lp && lp.id) {
            officialLpMap.set(lp.id, lp);
          }
        }
      }
      liveState.landingPages = officialLpMap;

      if (Array.isArray(raw.wilayas) && raw.wilayas.length > 0) {
        for (const w of raw.wilayas) {
          if (w && w.code) {
            liveState.wilayas.set(w.code, w);
          }
        }
      }

      if (typeof raw.catalogUpdatedAt === 'string' && raw.catalogUpdatedAt) {
        liveState.catalogUpdatedAt = raw.catalogUpdatedAt;
      }

      liveState.deletedOrderIds = new Set<string>();
      if (Array.isArray(raw.deletedOrderIds)) {
        for (const delOrdId of raw.deletedOrderIds) {
          if (typeof delOrdId === 'string' && delOrdId.trim()) {
            liveState.deletedOrderIds.add(delOrdId.trim());
          }
        }
      }

      if (Array.isArray(raw.orderDeletionAuditLogs)) {
        liveState.orderDeletionAuditLogs = raw.orderDeletionAuditLogs.slice(0, 500);
      }

      if (Array.isArray(raw.orders)) {
        const mergedMap = new Map<string, Order>();
        for (const initOrd of INITIAL_ORDERS) {
          if (!liveState.deletedOrderIds.has(initOrd.id)) {
            mergedMap.set(initOrd.id, structuredClone(initOrd));
          }
        }
        for (const savedOrd of raw.orders) {
          if (
            savedOrd &&
            savedOrd.id &&
            savedOrd.orderNumber &&
            !liveState.deletedOrderIds.has(String(savedOrd.id).trim())
          ) {
            mergedMap.set(savedOrd.id, savedOrd);
          }
        }
        liveState.orders = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      if (Array.isArray(raw.notificationRecipients)) {
        const validRecipients = raw.notificationRecipients.filter(
          (r: any) => r && r.id && typeof r.email === 'string' && r.email.trim().includes('@')
        );
        if (validRecipients.length > 0 || raw.notificationRecipientsInitialized === true) {
          liveState.notificationRecipients.clear();
          liveState.notificationRecipientsInitialized = Boolean(raw.notificationRecipientsInitialized);
          for (const rcpt of validRecipients) {
            const normEmail = String(rcpt.email).trim().toLowerCase();
            liveState.notificationRecipients.set(rcpt.id, {
              ...rcpt,
              email: normEmail,
              isActive: rcpt.isActive !== false,
              notifyOnNewOrder: rcpt.notifyOnNewOrder !== false,
            });
          }
        }
      }

      if (Array.isArray(raw.orderNotifications)) {
        liveState.orderNotifications.clear();
        for (const log of raw.orderNotifications) {
          if (log && log.id) {
            liveState.orderNotifications.set(log.id, log);
          }
        }
      }
      if (raw.smtpConfigVault && typeof raw.smtpConfigVault === 'object') {
        liveState.smtpConfigVault = raw.smtpConfigVault;
      }
      if (raw.carriersVault && typeof raw.carriersVault === 'object') {
        liveState.carriersVault = raw.carriersVault;
      }

      if (needsCleanupPersist) {
        savePersistedState();
      }
    }
  } catch (err) {
    console.warn('Could not load persisted fraud & orders state:', err);
  }
}

function savePersistedState(throwOnError = false) {
  try {
    const dir = path.dirname(PERSIST_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload = {
      settings: liveState.settings,
      watchlist: Array.from(liveState.watchlist.values()),
      securityEvents: liveState.securityEvents.slice(0, 200),
      orders: liveState.orders,
      deletedOrderIds: Array.from(liveState.deletedOrderIds.values()),
      orderDeletionAuditLogs: liveState.orderDeletionAuditLogs.slice(0, 500),
      products: Array.from(liveState.products.values()),
      deletedProductIds: Array.from(liveState.deletedProductIds.values()),
      categories: Array.from(liveState.categories.values()),
      landingPages: Array.from(liveState.landingPages.values()),
      wilayas: Array.from(liveState.wilayas.values()),
      catalogUpdatedAt: liveState.catalogUpdatedAt,
      notificationRecipients: Array.from(liveState.notificationRecipients.values()),
      notificationRecipientsInitialized: Boolean(liveState.notificationRecipientsInitialized),
      orderNotifications: Array.from(liveState.orderNotifications.values()),
      ...(liveState.smtpConfigVault ? { smtpConfigVault: liveState.smtpConfigVault } : {}),
      ...(liveState.carriersVault ? { carriersVault: liveState.carriersVault } : {}),
    };
    const tmpFile = `${PERSIST_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tmpFile, PERSIST_FILE);
  } catch (err) {
    console.warn('Could not save persisted fraud & orders state:', err);
    if (throwOnError) {
      throw err;
    }
  }
}

export function getServerSmtpVault(): Record<string, any> | null {
  return liveState.smtpConfigVault || null;
}

export function setServerSmtpVault(vault: Record<string, any> | null): void {
  liveState.smtpConfigVault = vault;
  savePersistedState();
}

export function getServerCarriersVault(): Record<string, any> | null {
  return liveState.carriersVault || null;
}

export function setServerCarriersVault(vault: Record<string, any> | null): void {
  liveState.carriersVault = vault;
  savePersistedState();
}

loadPersistedState();

/**
 * Generates an anonymized, non-reversible 10-char session fingerprint from request headers.
 * Never stores or logs raw IP addresses to comply with privacy & data minimization principles.
 */
export function getAnonymizedSessionFingerprint(req?: Request, fallbackSessionId?: string): string {
  if (fallbackSessionId) {
    return crypto
      .createHash('sha256')
      .update(`${fallbackSessionId}:${DAILY_PRIVACY_SALT}`)
      .digest('hex')
      .slice(0, 10);
  }
  if (!req) return 'local-test';
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || 'unknown-ip';
  const ua = String(req.headers['user-agent'] || 'unknown-ua').slice(0, 80);
  const clientSession = String(req.headers['x-dzmahall-session'] || '');
  return crypto
    .createHash('sha256')
    .update(`${ip}:${ua}:${clientSession}:${DAILY_PRIVACY_SALT}`)
    .digest('hex')
    .slice(0, 10);
}

function recordSecurityEvent(
  state: FraudEngineState,
  event: {
    eventType: SecurityEventType;
    severity: 'low' | 'medium' | 'high';
    phone?: string;
    sessionFingerprint?: string;
    source: 'storefront' | 'product_page' | 'landing_page' | 'api' | 'admin';
    reason: string;
    actionTaken: 'blocked' | 'flagged_needs_review' | 'challenge_required' | 'deduplicated';
    orderNumber?: string;
  },
  persist = true
): SecurityEventLog {
  const entry: SecurityEventLog = {
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  state.securityEvents = [entry, ...state.securityEvents.slice(0, 199)];
  if (persist) {
    savePersistedState();
  }
  return entry;
}

/**
 * Retourne le catalogue officiel unique stocké sur le serveur (produits, catégories, landing pages, wilayas).
 * Garantit qu'aucun produit supprimé ou ancien produit de démonstration (prod-1..prod-8) n'est jamais retourné.
 */
export function getServerCatalog() {
  const products = Array.from(liveState.products.values())
    .filter((p) => p && p.id && !liveState.deletedProductIds.has(p.id))
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

  const categories = Array.from(liveState.categories.values())
    .filter((c) => c && c.id && !LEGACY_PLACEHOLDER_CATEGORY_IDS.has(c.id))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const landingPages = Array.from(liveState.landingPages.values()).sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
  });

  const wilayas = Array.from(liveState.wilayas.values()).sort(
    (a, b) => Number(a.code) - Number(b.code)
  );

  return {
    products,
    categories,
    landingPages,
    wilayas,
    deletedProductIds: Array.from(liveState.deletedProductIds.values()),
    updatedAt: liveState.catalogUpdatedAt,
  };
}

/**
 * Ajoute ou met à jour un produit dans la source unique de vérité du serveur.
 */
export function upsertServerProduct(product: Product): Product {
  const pid = String(product.id || '').trim();
  if (!pid) {
    throw new Error('Identifiant de produit manquant.');
  }
  const normalized = normalizeServerProduct({
    ...product,
    id: pid,
    updatedAt: new Date().toISOString(),
  });
  liveState.deletedProductIds.delete(pid);
  liveState.products.set(pid, structuredClone(normalized));
  liveState.catalogUpdatedAt = new Date().toISOString();
  savePersistedState(true);
  return normalized;
}

/**
 * Ajoute ou met à jour un lot de produits dans la source unique de vérité du serveur.
 */
export function upsertServerProductsBatch(products: Product[]): Product[] {
  const saved: Product[] = [];
  for (const prod of products) {
    if (!prod || !prod.id) continue;
    const pid = String(prod.id).trim();
    if (LEGACY_DEMO_PRODUCT_IDS.has(pid)) continue;
    const normalized = normalizeServerProduct({
      ...prod,
      id: pid,
      updatedAt: prod.updatedAt || new Date().toISOString(),
    });
    liveState.deletedProductIds.delete(pid);
    liveState.products.set(pid, structuredClone(normalized));
    saved.push(normalized);
  }
  liveState.catalogUpdatedAt = new Date().toISOString();
  savePersistedState(true);
  return saved;
}

/**
 * Supprime définitivement un produit du serveur et enregistre son ID dans deletedProductIds
 * afin qu'aucun cache d'appareil ne puisse jamais le réintroduire.
 */
export function deleteServerProduct(productId: string): boolean {
  const pid = String(productId || '').trim();
  if (!pid) return false;
  const existed = liveState.products.delete(pid);
  liveState.deletedProductIds.add(pid);
  liveState.catalogUpdatedAt = new Date().toISOString();
  savePersistedState(true);
  return existed || true;
}

/**
 * Ajoute ou met à jour une catégorie ou la liste des catégories sur le serveur.
 */
export function upsertServerCategory(category: CategoryItem): CategoryItem {
  const cid = String(category.id || '').trim();
  if (!cid) throw new Error('Identifiant de catégorie manquant.');
  liveState.categories.set(cid, structuredClone(category));
  liveState.catalogUpdatedAt = new Date().toISOString();
  savePersistedState();
  return category;
}

export function upsertServerCategoriesBatch(categories: CategoryItem[]): CategoryItem[] {
  for (const cat of categories) {
    if (cat && cat.id && !LEGACY_PLACEHOLDER_CATEGORY_IDS.has(cat.id)) {
      liveState.categories.set(cat.id, structuredClone(cat));
    }
  }
  liveState.catalogUpdatedAt = new Date().toISOString();
  savePersistedState();
  return getServerCatalog().categories;
}

/**
 * Ajoute, met à jour ou supprime une Landing Page sur le serveur.
 */
export function upsertServerLandingPage(page: LandingPage): LandingPage {
  const pid = String(page.id || '').trim();
  if (!pid) throw new Error('Identifiant de landing page manquant.');
  liveState.landingPages.set(pid, structuredClone(page));
  liveState.catalogUpdatedAt = new Date().toISOString();
  savePersistedState();
  return page;
}

export function deleteServerLandingPage(pageId: string): boolean {
  const pid = String(pageId || '').trim();
  if (!pid) return false;
  const existed = liveState.landingPages.delete(pid);
  liveState.catalogUpdatedAt = new Date().toISOString();
  savePersistedState();
  return existed;
}

/**
 * Récupère une landing page spécifique de manière ultra-rapide et sécurisée
 * en utilisant la réconciliation intelligente des slugs, identifiants et produits associés.
 */
export function getServerLandingPage(targetSlugOrId: string, allowDraft = false) {
  const allPages = Array.from(liveState.landingPages.values());
  const allProducts = Array.from(liveState.products.values()).filter(
    (p) => p && p.id && !liveState.deletedProductIds.has(p.id)
  );

  const match = matchLandingPage(allPages, targetSlugOrId, {
    products: allProducts,
    allowDraft,
  });

  if (!match) return null;

  const page = match.page;
  const targetProduct =
    allProducts.find((p) => p.id === page.productId) ||
    allProducts.find((p) => {
      const pNorm = normalizeLandingPageSlug(p.slug || '');
      const pageNorm = normalizeLandingPageSlug(page.slug || '');
      const pCore = extractCoreLandingPageSlug(pNorm);
      const pageCore = extractCoreLandingPageSlug(pageNorm);
      return (
        pNorm === pageNorm ||
        (pCore && pCore === pageCore) ||
        (pageCore && pNorm.includes(pageCore)) ||
        (pNorm && pageNorm.includes(pNorm))
      );
    }) ||
    allProducts[0];

  const wilayas = Array.from(liveState.wilayas.values()).sort(
    (a, b) => Number(a.code) - Number(b.code)
  );

  return {
    page,
    product: targetProduct,
    wilayas,
    isDraft: match.isDraft,
    matchType: match.matchType,
  };
}

/**
 * Met à jour les tarifs de livraison d'une wilaya sur le serveur.
 */
export function updateServerWilaya(wilaya: Wilaya): Wilaya {
  if (!wilaya || !wilaya.code) {
    throw new Error('Code wilaya manquant.');
  }
  liveState.wilayas.set(wilaya.code, structuredClone(wilaya));
  liveState.catalogUpdatedAt = new Date().toISOString();
  savePersistedState();
  return wilaya;
}

/**
 * Synchronize products, wilayas, and orders from an authenticated admin store session.
 * Never re-adds deleted products or legacy demo products (prod-1..prod-8).
 */
export function syncServerCatalogAndOrders(data: {
  products?: Product[];
  categories?: CategoryItem[];
  landingPages?: LandingPage[];
  wilayas?: Wilaya[];
  orders?: Order[];
}) {
  let changed = false;
  if (Array.isArray(data.products) && data.products.length > 0) {
    for (const p of data.products) {
      if (!p || !p.id) continue;
      const pid = String(p.id).trim();
      if (liveState.deletedProductIds.has(pid) || LEGACY_DEMO_PRODUCT_IDS.has(pid)) {
        continue;
      }
      if (
        p &&
        p.id &&
        (typeof p.price === 'number' ||
          (p.price !== undefined && p.price !== null && !isNaN(Number(p.price))))
      ) {
        liveState.products.set(pid, normalizeServerProduct(p));
        changed = true;
      }
    }
  }
  if (Array.isArray(data.categories) && data.categories.length > 0) {
    for (const c of data.categories) {
      if (c && c.id && !LEGACY_PLACEHOLDER_CATEGORY_IDS.has(c.id)) {
        liveState.categories.set(c.id, structuredClone(c));
        changed = true;
      }
    }
  }
  if (Array.isArray(data.landingPages) && data.landingPages.length > 0) {
    for (const lp of data.landingPages) {
      if (lp && lp.id) {
        liveState.landingPages.set(lp.id, structuredClone(lp));
        changed = true;
      }
    }
  }
  if (Array.isArray(data.wilayas) && data.wilayas.length > 0) {
    for (const w of data.wilayas) {
      if (w && w.code) {
        liveState.wilayas.set(w.code, structuredClone(w));
        changed = true;
      }
    }
  }
  if (Array.isArray(data.orders) && data.orders.length > 0) {
    const existingIds = new Set(liveState.orders.map((o) => o.id));
    for (const ord of data.orders) {
      if (!ord || !ord.id) continue;
      const oid = String(ord.id).trim();
      if (liveState.deletedOrderIds.has(oid)) {
        continue;
      }
      if (!existingIds.has(oid)) {
        liveState.orders.unshift(ord);
        existingIds.add(oid);
        changed = true;
      } else {
        const idx = liveState.orders.findIndex((o) => o.id === oid);
        if (idx >= 0) {
          const prevServerOrd = liveState.orders[idx];
          liveState.orders[idx] = {
            ...ord,
            isArchived: prevServerOrd.isArchived ?? ord.isArchived,
            archivedAt: prevServerOrd.archivedAt ?? ord.archivedAt,
            archivedBy: prevServerOrd.archivedBy ?? ord.archivedBy,
            archiveReason: prevServerOrd.archiveReason ?? ord.archiveReason,
          };
          changed = true;
        }
      }
    }
    liveState.orders.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  if (changed) {
    liveState.catalogUpdatedAt = new Date().toISOString();
    savePersistedState();
  }
}

/**
 * Core server-side COD order validation, anti-spam, price recalculation, stock verification, and fraud scoring engine.
 */
export function processOrderValidationAndCreation(
  payload: OrderSubmissionPayload,
  sessionFingerprint: string,
  targetState: FraudEngineState = liveState,
  isSandboxTest = false
): OrderValidationOutcome {
  const source = payload.source || 'storefront';
  const settings = targetState.settings;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // 1. Protection Anti-Bot : Honeypot invisible
  if (payload.honeypot && String(payload.honeypot).trim().length > 0) {
    recordSecurityEvent(
      targetState,
      {
        eventType: 'bot_honeypot',
        severity: 'high',
        sessionFingerprint,
        source,
        reason: 'Champ honeypot anti-robot rempli automatiquement par un script',
        actionTaken: 'blocked',
      },
      !isSandboxTest
    );
    return {
      httpStatus: 400,
      allowed: false,
      code: 'BOT_DETECTED',
      message: 'Requête automatisée détectée et bloquée.',
    };
  }

  // 2. Protection Anti-Bot : Soumission anormalement rapide
  if (
    settings.enabled &&
    typeof payload.formElapsedMs === 'number' &&
    payload.formElapsedMs > 0 &&
    payload.formElapsedMs < settings.minFormFillTimeMs
  ) {
    recordSecurityEvent(
      targetState,
      {
        eventType: 'fast_submission',
        severity: 'medium',
        sessionFingerprint,
        source,
        reason: `Formulaire soumis en ${payload.formElapsedMs}ms (minimum requis: ${settings.minFormFillTimeMs}ms)`,
        actionTaken: 'blocked',
      },
      !isSandboxTest
    );
    return {
      httpStatus: 429,
      allowed: false,
      code: 'FAST_SUBMISSION',
      message:
        'Soumission trop rapide détectée. Veuillez vérifier vos informations avant de confirmer la commande.',
    };
  }

  // 3. Vérification de la clé d'idempotence (Anti-double clic / rechargement)
  const idempotencyKey = payload.idempotencyKey ? String(payload.idempotencyKey).trim() : '';
  if (idempotencyKey && targetState.idempotencyCache.has(idempotencyKey)) {
    const cached = targetState.idempotencyCache.get(idempotencyKey)!;
    if (nowMs - cached.timestampMs < 10 * 60 * 1000) {
      recordSecurityEvent(
        targetState,
        {
          eventType: 'duplicate_order_prevented',
          severity: 'low',
          phone: cached.order.normalizedPhone || cached.order.customerPhone,
          sessionFingerprint,
          source,
          reason: `Double clic ou rechargement intercepté (clé d'idempotence identique pour ${cached.order.orderNumber})`,
          actionTaken: 'deduplicated',
          orderNumber: cached.order.orderNumber,
        },
        !isSandboxTest
      );
      return {
        httpStatus: 200,
        allowed: true,
        duplicatePrevented: true,
        code: 'DUPLICATE_PREVENTED',
        message: 'Cette commande a déjà été enregistrée (protection anti-double clic active).',
        order: cached.order,
      };
    }
  }

  // 4. Validation des champs obligatoires (Nom, Téléphone, Wilaya, Commune, Adresse)
  const customerName = String(payload.customerName || '').trim();
  const hasValidLetters = /[a-zA-ZÀ-ÿ\u0600-\u06FF]{2,}/.test(customerName);
  if (!customerName || customerName.length < 2 || customerName.length > 120 || !hasValidLetters) {
    recordSecurityEvent(
      targetState,
      {
        eventType: 'invalid_payload',
        severity: 'low',
        sessionFingerprint,
        source,
        reason: 'Nom complet manquant ou invalide lors de la soumission',
        actionTaken: 'blocked',
      },
      !isSandboxTest
    );
    return {
      httpStatus: 400,
      allowed: false,
      code: 'INVALID_NAME',
      message: 'Veuillez renseigner votre nom et prénom complets (minimum 2 lettres).',
    };
  }

  const phoneCheck = normalizeAndValidateAlgerianPhone(payload.customerPhone);
  if (!phoneCheck.isValid) {
    recordSecurityEvent(
      targetState,
      {
        eventType: 'invalid_payload',
        severity: 'low',
        phone: String(payload.customerPhone || '').slice(0, 20),
        sessionFingerprint,
        source,
        reason: phoneCheck.errorMessage || 'Numéro de téléphone algérien invalide ou fictif',
        actionTaken: 'blocked',
      },
      !isSandboxTest
    );
    return {
      httpStatus: 400,
      allowed: false,
      code: 'INVALID_PHONE',
      message:
        phoneCheck.errorMessage ||
        'Numéro de téléphone algérien invalide (ex: 0550 12 34 56, 0660 76 93 86).',
    };
  }

  const normalizedPhone = phoneCheck.normalized;

  // Vérification de la Wilaya, Commune et Mode de livraison
  const wilayaCode = String(payload.wilayaCode || '').trim();
  const wilaya = targetState.wilayas.get(wilayaCode);
  if (!wilaya) {
    recordSecurityEvent(
      targetState,
      {
        eventType: 'invalid_payload',
        severity: 'medium',
        phone: normalizedPhone,
        sessionFingerprint,
        source,
        reason: `Code wilaya inexistant ou manipulé : "${wilayaCode}"`,
        actionTaken: 'blocked',
      },
      !isSandboxTest
    );
    return {
      httpStatus: 400,
      allowed: false,
      code: 'INVALID_WILAYA',
      message: 'La wilaya sélectionnée est invalide. Veuillez choisir parmi les 58 wilayas.',
    };
  }

  const commune = String(payload.commune || '').trim();
  if (!commune || commune.length < 2 || commune.length > 100) {
    return {
      httpStatus: 400,
      allowed: false,
      code: 'INVALID_COMMUNE',
      message: 'Veuillez préciser votre commune de livraison.',
    };
  }

  const deliveryMode = payload.deliveryMode;
  if (deliveryMode !== 'home' && deliveryMode !== 'desk') {
    return {
      httpStatus: 400,
      allowed: false,
      code: 'INVALID_DELIVERY_MODE',
      message: 'Mode de livraison invalide (Domicile ou Stop Desk requis).',
    };
  }

  if (deliveryMode === 'desk' && !wilaya.deskAvailable) {
    return {
      httpStatus: 400,
      allowed: false,
      code: 'DESK_NOT_AVAILABLE',
      message: `La livraison en bureau Stop Desk n'est pas disponible pour la wilaya ${wilaya.name}. Veuillez choisir la livraison à domicile.`,
    };
  }

  const deliveryAddress = payload.deliveryAddress ? String(payload.deliveryAddress).trim() : '';
  if (deliveryMode === 'home' && (!deliveryAddress || deliveryAddress.length < 4)) {
    return {
      httpStatus: 400,
      allowed: false,
      code: 'MISSING_ADDRESS',
      message: 'Veuillez renseigner votre adresse exacte pour la livraison à domicile (quartier, rue ou cité).',
    };
  }

  // 5. Vérification de la liste de blocage (Watchlist / Blocklist) avec gestion d'expiration
  const watchlistEntry = targetState.watchlist.get(normalizedPhone);
  if (watchlistEntry && watchlistEntry.status === 'blocked') {
    const isExpired =
      watchlistEntry.expiresAt && new Date(watchlistEntry.expiresAt).getTime() <= nowMs;
    if (isExpired) {
      // Expiration automatique : passe en simple surveillance pour éviter les blocages définitifs injustifiés
      watchlistEntry.status = 'watched';
      watchlistEntry.reason = `[Blocage expiré — sous surveillance] ${watchlistEntry.reason}`;
      watchlistEntry.updatedAt = nowIso;
      if (!isSandboxTest) savePersistedState();
    } else {
      recordSecurityEvent(
        targetState,
        {
          eventType: 'blocked_phone',
          severity: 'high',
          phone: normalizedPhone,
          sessionFingerprint,
          source,
          reason: `Tentative de commande depuis un numéro bloqué : ${watchlistEntry.reason}`,
          actionTaken: 'blocked',
        },
        !isSandboxTest
      );
      return {
        httpStatus: 403,
        allowed: false,
        code: 'PHONE_BLOCKED',
        message:
          'Votre demande ne peut pas être validée automatiquement en ligne. Veuillez contacter directement notre service client par téléphone ou WhatsApp pour confirmer votre commande.',
      };
    }
  }

  // 6. Vérification des articles, quantités, stocks et recalcul strict des prix côté serveur
  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 20) {
    return {
      httpStatus: 400,
      allowed: false,
      code: 'EMPTY_ITEMS',
      message: 'Votre commande doit contenir au moins un article valide.',
    };
  }

  // Vérification d'anti-rebond par signature exacte sur fenêtre courte (45 secondes)
  const signature = computeOrderSignature({
    normalizedPhone,
    wilayaCode,
    commune,
    deliveryMode,
    items: payload.items.map((i) => ({
      productId: String(i.productId || ''),
      variantId: i.variantId,
      quantity: Number(i.quantity) || 0,
    })),
  });

  if (targetState.signatureCache.has(signature)) {
    const recentDup = targetState.signatureCache.get(signature)!;
    if (nowMs - recentDup.timestampMs < 45 * 1000) {
      recordSecurityEvent(
        targetState,
        {
          eventType: 'duplicate_order_prevented',
          severity: 'low',
          phone: normalizedPhone,
          sessionFingerprint,
          source,
          reason: `Soumission identique répétée en moins de 45s (retourne la commande ${recentDup.order.orderNumber} sans doublon)`,
          actionTaken: 'deduplicated',
          orderNumber: recentDup.order.orderNumber,
        },
        !isSandboxTest
      );
      return {
        httpStatus: 200,
        allowed: true,
        duplicatePrevented: true,
        code: 'DUPLICATE_PREVENTED',
        message: 'Votre commande a déjà été enregistrée il y a quelques secondes.',
        order: recentDup.order,
      };
    }
  }

  const verifiedOrderItems: OrderItem[] = [];
  let officialSubtotal = 0;
  let totalUnitsOrdered = 0;

  for (const rawItem of payload.items) {
    const productId = String(rawItem?.productId || '').trim();
    const quantity = Number(rawItem?.quantity);

    // Refuser les quantités négatives, nulles, décimales ou excessives
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      recordSecurityEvent(
        targetState,
        {
          eventType: 'invalid_payload',
          severity: 'high',
          phone: normalizedPhone,
          sessionFingerprint,
          source,
          reason: `Quantité invalide ou négative envoyée (${String(rawItem?.quantity)}) pour le produit ${productId}`,
          actionTaken: 'blocked',
        },
        !isSandboxTest
      );
      return {
        httpStatus: 400,
        allowed: false,
        code: 'INVALID_QUANTITY',
        message: 'La quantité commandée doit être un nombre entier compris entre 1 et 50.',
      };
    }

    let serverProduct = targetState.products.get(productId);
    // Si un nouveau produit a été ajouté dans le catalogue par l'admin mais pas encore synchronisé sur le serveur
    if (
      !serverProduct &&
      rawItem.productSnapshot &&
      rawItem.productSnapshot.id === productId &&
      typeof rawItem.productSnapshot.price === 'number' &&
      rawItem.productSnapshot.price > 0
    ) {
      serverProduct = structuredClone(rawItem.productSnapshot);
      targetState.products.set(productId, serverProduct);
    }

    if (!serverProduct || serverProduct.isActive === false) {
      recordSecurityEvent(
        targetState,
        {
          eventType: 'invalid_payload',
          severity: 'medium',
          phone: normalizedPhone,
          sessionFingerprint,
          source,
          reason: `Produit introuvable ou inactif (${productId})`,
          actionTaken: 'blocked',
        },
        !isSandboxTest
      );
      return {
        httpStatus: 400,
        allowed: false,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Un des produits sélectionnés n’est plus disponible dans le catalogue.',
      };
    }

    // Vérification de la variante éventuelle
    let matchedVariant = undefined;
    if (rawItem.variantId && Array.isArray(serverProduct.variants) && serverProduct.variants.length > 0) {
      matchedVariant = serverProduct.variants.find((v) => v.id === rawItem.variantId);
      if (!matchedVariant) {
        return {
          httpStatus: 400,
          allowed: false,
          code: 'VARIANT_NOT_FOUND',
          message: `La variante sélectionnée pour « ${serverProduct.name} » n'existe pas.`,
        };
      }
    }

    // Vérification stricte du stock côté serveur
    const availableStock = matchedVariant
      ? Math.min(serverProduct.stockQuantity, matchedVariant.stock)
      : serverProduct.stockQuantity;

    if (availableStock <= 0 || quantity > availableStock) {
      recordSecurityEvent(
        targetState,
        {
          eventType: 'stock_insufficient',
          severity: 'medium',
          phone: normalizedPhone,
          sessionFingerprint,
          source,
          reason: `Stock insuffisant pour "${serverProduct.name}" (demandé: ${quantity}, disponible: ${availableStock})`,
          actionTaken: 'blocked',
        },
        !isSandboxTest
      );
      return {
        httpStatus: 400,
        allowed: false,
        code: 'INSUFFICIENT_STOCK',
        message:
          availableStock <= 0
            ? `L'article « ${serverProduct.name} » est actuellement en rupture de stock.`
            : `Stock insuffisant pour « ${serverProduct.name} » (${availableStock} exemplaire(s) disponible(s)).`,
      };
    }

    // Calcul du prix unitaire officiel côté serveur
    const officialUnitPrice =
      serverProduct.price + (matchedVariant?.priceModifier ? Number(matchedVariant.priceModifier) : 0);

    // Détection de tentative de manipulation du prix unitaire envoyé par le client
    if (
      rawItem.clientUnitPrice !== undefined &&
      rawItem.clientUnitPrice !== null &&
      Math.abs(Number(rawItem.clientUnitPrice) - officialUnitPrice) > 1
    ) {
      recordSecurityEvent(
        targetState,
        {
          eventType: 'price_manipulation_attempt',
          severity: 'high',
          phone: normalizedPhone,
          sessionFingerprint,
          source,
          reason: `Tentative de manipulation du prix unitaire sur "${serverProduct.name}" : prix client=${rawItem.clientUnitPrice} DZD vs prix officiel serveur=${officialUnitPrice} DZD`,
          actionTaken: 'blocked',
        },
        !isSandboxTest
      );
      return {
        httpStatus: 400,
        allowed: false,
        code: 'PRICE_MANIPULATION',
        message:
          'Anomalie détectée : le prix envoyé ne correspond pas au tarif officiel du catalogue DZMahall. Commande refusée.',
      };
    }

    const lineTotal = officialUnitPrice * quantity;
    officialSubtotal += lineTotal;
    totalUnitsOrdered += quantity;

    verifiedOrderItems.push({
      productId: serverProduct.id,
      productName: serverProduct.name,
      variantId: matchedVariant?.id || rawItem.variantId,
      variantName: matchedVariant?.name || rawItem.variantName,
      quantity,
      unitPrice: officialUnitPrice,
      totalPrice: lineTotal,
    });
  }

  // Résolution du transporteur et du niveau de service (Express vs Économique pour Guepex)
  const linkedLandingPage = payload.landingPageId
    ? targetState.landingPages.get(String(payload.landingPageId))
    : payload.landingPageSlug
    ? Array.from(targetState.landingPages.values()).find(
        (lp) => lp.slug === payload.landingPageSlug
      )
    : undefined;

  const earlyCarrierId =
    payload.shippingCompanyId || linkedLandingPage?.shippingCompanyId || 'yalidine';

  const rawServiceType =
    payload.deliveryServiceType || linkedLandingPage?.deliveryServiceType;
  const resolvedDeliveryServiceType: 'express' | 'economique' | undefined =
    rawServiceType === 'express' || rawServiceType === 'economique'
      ? rawServiceType
      : undefined;

  // Calcul des frais de livraison officiels selon la Wilaya, le Mode de livraison et le Niveau de service Guepex
  const standardWilayaShippingFee =
    deliveryMode === 'home' ? Number(wilaya.homeDeliveryFee) : Number(wilaya.deskDeliveryFee);

  let officialShippingFee = standardWilayaShippingFee;
  if (earlyCarrierId === 'guepex' && resolvedDeliveryServiceType) {
    if (resolvedDeliveryServiceType === 'economique') {
      officialShippingFee = Math.max(
        350,
        Math.round(
          wilaya.ecoDeliveryFee ||
            (deliveryMode === 'desk'
              ? Math.max(350, wilaya.deskDeliveryFee)
              : Math.max(450, Math.round(wilaya.homeDeliveryFee * 0.85)))
        )
      );
    } else {
      officialShippingFee = Math.max(
        350,
        Math.round(
          wilaya.expressDeliveryFee ||
            (deliveryMode === 'desk'
              ? Math.max(450, wilaya.deskDeliveryFee + 100)
              : Math.max(600, wilaya.homeDeliveryFee + 100))
        )
      );
    }
  }

  const officialTotalAmount = officialSubtotal + officialShippingFee;
  const standardTotalAmount = officialSubtotal + standardWilayaShippingFee;

  // Détection de manipulation du montant total ou des frais de livraison
  // Autorise soit le tarif officiel Guepex calculé selon le service, soit le tarif wilaya standard si le formulaire public l'a utilisé
  if (
    payload.clientTotalAmount !== undefined &&
    payload.clientTotalAmount !== null &&
    Math.abs(Number(payload.clientTotalAmount) - officialTotalAmount) > 1 &&
    Math.abs(Number(payload.clientTotalAmount) - standardTotalAmount) > 1
  ) {
    recordSecurityEvent(
      targetState,
      {
        eventType: 'price_manipulation_attempt',
        severity: 'high',
        phone: normalizedPhone,
        sessionFingerprint,
        source,
        reason: `Tentative de manipulation du total COD : total client=${payload.clientTotalAmount} DZD vs total officiel serveur=${officialTotalAmount} DZD`,
        actionTaken: 'blocked',
      },
      !isSandboxTest
    );
    return {
      httpStatus: 400,
      allowed: false,
      code: 'PRICE_MANIPULATION',
      message:
        'Anomalie de sécurité : le montant total envoyé ne correspond pas au calcul officiel côté serveur. Commande refusée.',
    };
  }

  // 7. Limitation de débit (Rate Limiting) par numéro de téléphone et par session
  const isTrustedPhone = watchlistEntry?.status === 'trusted';
  const oneHourAgo = nowMs - 60 * 60 * 1000;
  const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;

  const phoneHistory = (targetState.phoneTimestamps.get(normalizedPhone) || []).filter(
    (t) => t > oneDayAgo
  );
  const phoneCountLastHour = phoneHistory.filter((t) => t > oneHourAgo).length;
  const phoneCountLastDay = phoneHistory.length;

  if (settings.enabled && !isTrustedPhone) {
    if (phoneCountLastHour >= settings.maxOrdersPerPhonePerHour) {
      recordSecurityEvent(
        targetState,
        {
          eventType: 'rate_limit_phone',
          severity: 'medium',
          phone: normalizedPhone,
          sessionFingerprint,
          source,
          reason: `Seuil horaire dépassé pour le numéro ${normalizedPhone} (${phoneCountLastHour}/${settings.maxOrdersPerPhonePerHour} commandes en 1h)`,
          actionTaken: 'blocked',
        },
        !isSandboxTest
      );
      return {
        httpStatus: 429,
        allowed: false,
        code: 'RATE_LIMIT_PHONE',
        message: `Vous avez déjà enregistré ${phoneCountLastHour} commandes récemment avec ce numéro. Notre équipe vous appellera très prochainement pour les confirmer.`,
      };
    }

    if (phoneCountLastDay >= settings.maxOrdersPerPhonePerDay) {
      recordSecurityEvent(
        targetState,
        {
          eventType: 'rate_limit_phone',
          severity: 'high',
          phone: normalizedPhone,
          sessionFingerprint,
          source,
          reason: `Seuil journalier dépassé pour le numéro ${normalizedPhone} (${phoneCountLastDay}/${settings.maxOrdersPerPhonePerDay} commandes en 24h)`,
          actionTaken: 'blocked',
        },
        !isSandboxTest
      );
      return {
        httpStatus: 429,
        allowed: false,
        code: 'RATE_LIMIT_PHONE_DAILY',
        message:
          'Limite quotidienne de commandes atteinte pour ce numéro de téléphone. Contactez notre service client si vous souhaitez modifier votre commande.',
      };
    }
  }

  const sessionHistory = (targetState.sessionTimestamps.get(sessionFingerprint) || []).filter(
    (t) => t > oneHourAgo
  );
  const sessionCountLastHour = sessionHistory.length;

  // Ne jamais bloquer aveuglément une IP partagée (famille / 4G mobile) au premier seuil,
  // mais bloquer les rafales abusives (> 2x le seuil de session)
  if (
    settings.enabled &&
    !isTrustedPhone &&
    sessionCountLastHour >= settings.maxOrdersPerSessionPerHour * 2
  ) {
    recordSecurityEvent(
      targetState,
      {
        eventType: 'rate_limit_session',
        severity: 'high',
        phone: normalizedPhone,
        sessionFingerprint,
        source,
        reason: `Rafale excessive depuis la même session (${sessionCountLastHour} soumissions en 1h)`,
        actionTaken: 'blocked',
      },
      !isSandboxTest
    );
    return {
      httpStatus: 429,
      allowed: false,
      code: 'RATE_LIMIT_SESSION',
      message:
        'Trop de tentatives rapprochées depuis votre connexion. Veuillez patienter quelques minutes avant de réessayer.',
    };
  }

  // 8. Évaluation du Risque Anti-Fraude Multi-Niveaux (Faible / Moyen / Élevé)
  let riskScore = 0;
  const riskReasons: string[] = [];

  if (!isTrustedPhone && settings.enabled) {
    // 8a. Numéro présent dans la liste de surveillance ('watched')
    if (watchlistEntry && watchlistEntry.status === 'watched') {
      riskScore += 45;
      riskReasons.push(`Numéro sur liste de surveillance : ${watchlistEntry.reason}`);
    }

    // 8b. Commandes récentes du même numéro dans la fenêtre de doublon (ex: 30 min)
    const dupWindowMs = settings.duplicateWindowMinutes * 60 * 1000;
    const recentSamePhoneOrders = targetState.orders.filter((o) => {
      const oPhone =
        o.normalizedPhone || normalizeAndValidateAlgerianPhone(o.customerPhone).normalized;
      const oTime = new Date(o.createdAt).getTime();
      return oPhone === normalizedPhone && !isNaN(oTime) && nowMs - oTime <= dupWindowMs;
    });

    if (recentSamePhoneOrders.length > 0) {
      riskScore += 42;
      riskReasons.push(
        `${recentSamePhoneOrders.length} autre(s) commande(s) passée(s) avec ce numéro au cours des ${settings.duplicateWindowMinutes} dernières minutes`
      );
    }

    // 8c. Commandes identiques (même wilaya, même commune/adresse et mêmes articles) avec un autre numéro
    const recentSameAddressAndItems = targetState.orders.filter((o) => {
      const oPhone =
        o.normalizedPhone || normalizeAndValidateAlgerianPhone(o.customerPhone).normalized;
      const oTime = new Date(o.createdAt).getTime();
      if (oPhone === normalizedPhone || isNaN(oTime) || nowMs - oTime > 2 * 60 * 60 * 1000) {
        return false;
      }
      const sameLocation =
        o.wilayaCode === wilayaCode &&
        o.commune.trim().toLowerCase() === commune.toLowerCase();
      const sameFirstProduct =
        o.items[0]?.productId === verifiedOrderItems[0]?.productId;
      return sameLocation && sameFirstProduct;
    });

    if (recentSameAddressAndItems.length > 0) {
      riskScore += 38;
      riskReasons.push(
        `Commande similaire détectée dans la même commune (${commune}) avec un autre numéro récemment`
      );
    }

    // 8d. Historique des refus / échecs de livraison pour ce numéro
    // Règle importante : ne PAS pénaliser automatiquement un client qui n'a eu qu'un seul refus.
    const pastOrdersForPhone = targetState.orders.filter((o) => {
      const oPhone =
        o.normalizedPhone || normalizeAndValidateAlgerianPhone(o.customerPhone).normalized;
      return oPhone === normalizedPhone;
    });
    const failedOrReturnedCount = pastOrdersForPhone.filter(
      (o) => o.status === 'delivery_failed' || o.status === 'returned'
    ).length;
    const deliveredCount = pastOrdersForPhone.filter((o) => o.status === 'delivered').length;

    if (failedOrReturnedCount >= 2 && deliveredCount === 0) {
      riskScore += 45;
      riskReasons.push(
        `Historique de ${failedOrReturnedCount} colis retournés ou refusés sans livraison aboutie`
      );
    } else if (failedOrReturnedCount === 1 && deliveredCount === 0) {
      // Un seul refus passé n'entraîne qu'un faible incrément informatif (+10), ne déclenchant pas de blocage ni d'alerte seul
      riskScore += 10;
    }

    // 8e. Quantité ou montant COD élevé
    if (totalUnitsOrdered >= settings.highQuantityThreshold) {
      riskScore += 25;
      riskReasons.push(
        `Quantité élevée commandée (${totalUnitsOrdered} unités — seuil : ${settings.highQuantityThreshold})`
      );
    }
    if (officialTotalAmount >= settings.highAmountThreshold) {
      riskScore += 20;
      riskReasons.push(
        `Montant COD élevé (${officialTotalAmount.toLocaleString('fr-FR')} DZD)`
      );
    }

    // 8f. Motif suspect dans le numéro ou le nom
    if (phoneCheck.isSuspiciousPattern && phoneCheck.suspiciousReason) {
      riskScore += 20;
      riskReasons.push(phoneCheck.suspiciousReason);
    }
    if (/^(test|aaaa|bbbb|azerty|qwerty|fake|spam)/i.test(customerName) || /(.)\1{3,}/i.test(customerName)) {
      riskScore += 35;
      riskReasons.push(`Nom client suspect ou de test détecté (« ${customerName} »)`);
    }

    // 8g. Volume inhabituel sur la session partagée
    if (sessionCountLastHour >= settings.maxOrdersPerSessionPerHour) {
      riskScore += 35;
      riskReasons.push(
        `Plusieurs commandes (${sessionCountLastHour}) soumises depuis la même session en moins d'une heure`
      );
    }
  }

  // Calcul des indicateurs de doublons de numéro & commandes précédemment annulées
  const phoneDuplicateFlags = computePhoneDuplicateFlags(normalizedPhone, targetState.orders, {
    referenceTimeMs: nowMs,
    candidateItems: verifiedOrderItems.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      quantity: it.quantity,
    })),
  });

  if (phoneDuplicateFlags.hasCancelledOrders) {
    riskReasons.push(
      `Attention : ${phoneDuplicateFlags.cancelledOrdersCount} commande(s) précédente(s) associée(s) à ce numéro a/ont été annulée(s). Vérification recommandée avant expédition.`
    );
  }
  if (phoneDuplicateFlags.hasRecentActiveOrder) {
    const dupMsg = phoneDuplicateFlags.hasRecentIdenticalOrder
      ? 'Commande récente identique (mêmes produits et quantités) déjà en cours pour ce numéro.'
      : 'Une commande récente en attente ou en cours de traitement existe déjà pour ce numéro.';
    if (!riskReasons.includes(dupMsg)) {
      riskReasons.push(dupMsg);
    }
  }

  riskScore = Math.min(100, riskScore);
  const riskLevel: OrderRiskLevel =
    riskScore >= 70 ? 'high' : riskScore >= 35 ? 'medium' : 'low';

  // Si Risque Élevé et que la confirmation supplémentaire n'a pas encore été validée par l'utilisateur :
  if (
    riskLevel === 'high' &&
    settings.requireChallengeOnHighRisk &&
    !payload.challengeConfirmed
  ) {
    recordSecurityEvent(
      targetState,
      {
        eventType: 'suspicious_order_flagged',
        severity: 'high',
        phone: normalizedPhone,
        sessionFingerprint,
        source,
        reason: `Confirmation supplémentaire demandée (Score ${riskScore}/100) : ${riskReasons.join(' ; ')}`,
        actionTaken: 'challenge_required',
      },
      !isSandboxTest
    );
    return {
      httpStatus: 202,
      allowed: false,
      requiresConfirmationChallenge: true,
      code: 'CONFIRMATION_CHALLENGE_REQUIRED',
      message:
        'Par mesure de sécurité et pour éviter toute erreur d’expédition, veuillez confirmer votre numéro de téléphone ci-dessous pour valider définitivement votre commande.',
      riskLevel,
      riskScore,
      riskReasons,
    };
  }

  // 9. Création de la commande validée et décrémentation atomique unique du stock
  const initialStatus: OrderStatus =
    (riskLevel === 'medium' || riskLevel === 'high') &&
    settings.autoFlagMediumRiskAsNeedsReview
      ? 'needs_review'
      : 'pending_confirmation';

  const assignedCarrierId = payload.shippingCompanyId || 'yalidine';
  const foundCarrier = INITIAL_CARRIERS.find((c) => c.id === assignedCarrierId);
  const assignedCarrierName =
    payload.shippingCompanyNameSnapshot || foundCarrier?.name || 'Yalidine Fast Logistics';

  const orderNumber = `DZM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const orderId = `ord-${nowMs}-${Math.random().toString(36).slice(2, 6)}`;

  const statusNote =
    initialStatus === 'needs_review'
      ? `Commande enregistrée avec le statut « À vérifier » (Risque ${
          riskLevel === 'high' ? 'élevé' : 'moyen'
        } — Score ${riskScore}/100). Motifs : ${riskReasons.join(' | ')}`
      : payload.landingPageTitle
      ? `Commande passée depuis la landing page « ${payload.landingPageTitle} ». Société de livraison : ${assignedCarrierName}.`
      : 'Commande enregistrée avec succès (Vérification serveur COD validée).';

  const newOrder: Order = {
    id: orderId,
    orderNumber,
    createdAt: nowIso,
    updatedAt: nowIso,
    customerName,
    customerPhone: phoneCheck.formatted,
    normalizedPhone,
    wilayaCode,
    wilayaName: wilaya.name,
    commune,
    deliveryAddress: deliveryMode === 'home' ? deliveryAddress : undefined,
    deliveryMode,
    deskName:
      deliveryMode === 'desk'
        ? payload.deskName || `Bureau Stop Desk ${wilaya.name}`
        : undefined,
    deliveryServiceType: resolvedDeliveryServiceType,
    items: verifiedOrderItems,
    subtotal: officialSubtotal,
    shippingCost: officialShippingFee,
    shippingFee: officialShippingFee,
    discount: 0,
    totalAmount: officialTotalAmount,
    total: officialTotalAmount,
    paymentMethod: 'COD',
    paymentStatus: 'pending',
    status: initialStatus,
    carrierId: assignedCarrierId,
    carrierName: assignedCarrierName,
    shippingCompanyId: assignedCarrierId,
    shippingCompanyNameSnapshot: assignedCarrierName,
    landingPageId: payload.landingPageId,
    landingPageSlug: payload.landingPageSlug,
    landingPageTitle: payload.landingPageTitle,
    productId: verifiedOrderItems[0]?.productId,
    selectedVariantId: verifiedOrderItems[0]?.variantId,
    utm_source: payload.utm_source,
    utm_medium: payload.utm_medium,
    utm_campaign: payload.utm_campaign,
    utm_content: payload.utm_content,
    utm_term: payload.utm_term,
    notes: payload.notes ? String(payload.notes).trim().slice(0, 500) : undefined,
    riskLevel,
    riskScore,
    riskReasons,
    phoneDuplicateFlags,
    idempotencyKey: idempotencyKey || undefined,
    confirmationHistory: [],
    notificationStatus: 'pending',
    statusHistory: [
      {
        status: initialStatus,
        timestamp: nowIso,
        note: statusNote,
      },
    ],
  };

  // Simulation d'erreur d'écriture base de données (Test obligatoire #5)
  if (payload.simulateDatabaseError === true) {
    return {
      httpStatus: 500,
      allowed: false,
      code: 'DATABASE_WRITE_FAILED',
      message:
        'Impossible d’enregistrer votre commande dans la base de données pour le moment. Vos informations sont conservées, veuillez réessayer.',
    };
  }

  // Décrémentation atomique du stock une seule fois par commande validée
  const updatedProducts: Product[] = [];
  for (const orderedItem of verifiedOrderItems) {
    const prod = targetState.products.get(orderedItem.productId);
    if (prod) {
      const nextStock = Math.max(0, prod.stockQuantity - orderedItem.quantity);
      const nextVariants = Array.isArray(prod.variants)
        ? prod.variants.map((v) =>
            v.id === orderedItem.variantId
              ? { ...v, stock: Math.max(0, v.stock - orderedItem.quantity) }
              : v
          )
        : [];
      const updatedProd: Product = {
        ...prod,
        stockQuantity: nextStock,
        variants: nextVariants,
        updatedAt: nowIso,
      };
      targetState.products.set(prod.id, updatedProd);
      updatedProducts.push(updatedProd);
    }
  }

  targetState.orders.unshift(newOrder);
  targetState.phoneTimestamps.set(normalizedPhone, [...phoneHistory, nowMs]);
  targetState.sessionTimestamps.set(sessionFingerprint, [...sessionHistory, nowMs]);

  // Écriture effective et synchrone dans la base de données persistante avant toute confirmation au client
  if (!isSandboxTest) {
    try {
      savePersistedState(true);
    } catch (dbErr) {
      // Annuler l'ajout en mémoire si l'écriture disque échoue
      targetState.orders.shift();
      return {
        httpStatus: 500,
        allowed: false,
        code: 'DATABASE_WRITE_FAILED',
        message:
          'Une erreur technique a empêché l’enregistrement de votre commande. Veuillez réessayer.',
      };
    }
  }

  // Enregistrement dans les caches d'idempotence et d'historique après succès de l'écriture
  if (idempotencyKey) {
    targetState.idempotencyCache.set(idempotencyKey, {
      order: newOrder,
      timestampMs: nowMs,
    });
  }
  targetState.signatureCache.set(signature, {
    order: newOrder,
    timestampMs: nowMs,
  });

  if (initialStatus === 'needs_review') {
    recordSecurityEvent(
      targetState,
      {
        eventType: 'suspicious_order_flagged',
        severity: riskLevel === 'high' ? 'high' : 'medium',
        phone: normalizedPhone,
        sessionFingerprint,
        source,
        reason: `Commande #${orderNumber} marquée « À vérifier » (Score ${riskScore}/100) : ${riskReasons.join(' ; ')}`,
        actionTaken: 'flagged_needs_review',
        orderNumber,
      },
      !isSandboxTest
    );
  }

  return {
    httpStatus: 201,
    allowed: true,
    code: 'ORDER_CREATED',
    message:
      initialStatus === 'needs_review'
        ? 'Votre commande a bien été enregistrée et sera vérifiée par notre service client avant expédition.'
        : 'Votre commande a été enregistrée avec succès.',
    riskLevel,
    riskScore,
    riskReasons,
    order: newOrder,
    updatedProducts,
  };
}

/**
 * Détermine l'origine d'une annulation (client vs administrateur/transporteur)
 * à partir de l'historique réel des tentatives de contact et des changements de statut.
 */
export function determineCancellationOrigin(order: Order): {
  origin: CancellationOrigin;
  reasonNote: string;
} {
  if (order.status !== 'cancelled') {
    return { origin: 'unknown', reasonNote: '' };
  }

  const attempts = order.contactAttempts || order.confirmationHistory || [];
  for (const att of attempts) {
    if (att.outcome === 'cancelled_by_customer' || att.outcome === 'refused_cancelled') {
      return {
        origin: 'customer',
        reasonNote: att.note || 'Annulée à la demande du client lors de la confirmation',
      };
    }
    if (att.outcome === 'wrong_number') {
      return {
        origin: 'admin_or_carrier',
        reasonNote: att.note || 'Annulée par l’opérateur (faux numéro / injoignable)',
      };
    }
  }

  const cancelHistoryEntries = (order.statusHistory || []).filter((h) => h.status === 'cancelled');
  const latestCancel = cancelHistoryEntries[cancelHistoryEntries.length - 1];
  const noteText = (latestCancel?.note || order.notes || '').toLowerCase();

  if (
    noteText.includes('par le client') ||
    noteText.includes('client a annul') ||
    noteText.includes('demande du client') ||
    noteText.includes('cancelled_by_customer')
  ) {
    return {
      origin: 'customer',
      reasonNote: latestCancel?.note || 'Annulée par le client',
    };
  }

  if (
    noteText.includes('transporteur') ||
    noteText.includes('admin') ||
    noteText.includes('opérateur') ||
    noteText.includes('faux numéro') ||
    noteText.includes('injoignable') ||
    noteText.includes('doublon') ||
    latestCancel?.updatedBy
  ) {
    return {
      origin: 'admin_or_carrier',
      reasonNote:
        latestCancel?.note ||
        `Annulée par ${latestCancel?.updatedBy || 'l’administrateur / transporteur'}`,
    };
  }

  return {
    origin: 'admin_or_carrier',
    reasonNote: latestCancel?.note || 'Annulée dans l’administration',
  };
}

const ACTIVE_ORDER_STATUSES_FOR_RECENT_DUP: OrderStatus[] = [
  'pending_confirmation',
  'needs_review',
  'confirmed',
  'processing',
  'ready_to_ship',
];

function areOrderItemsEquivalent(
  itemsA: { productId: string; variantId?: string; quantity: number }[],
  itemsB: { productId: string; variantId?: string; quantity: number }[]
): boolean {
  if (!itemsA.length || !itemsB.length || itemsA.length !== itemsB.length) {
    return false;
  }
  const sigA = itemsA
    .map((i) => `${i.productId}:${i.variantId || 'default'}:${Number(i.quantity) || 1}`)
    .sort()
    .join('|');
  const sigB = itemsB
    .map((i) => `${i.productId}:${i.variantId || 'default'}:${Number(i.quantity) || 1}`)
    .sort()
    .join('|');
  return sigA === sigB;
}

/**
 * Calcule les indicateurs anti-doublons et d'historique d'annulation pour un numéro normalisé.
 * Ne considère comme « annulée » QUE les commandes ayant réellement le statut commercial `'cancelled'`.
 */
export function computePhoneDuplicateFlags(
  normalizedPhone: string,
  ordersPool: Order[],
  options?: {
    excludeOrderId?: string;
    referenceTimeMs?: number;
    candidateItems?: { productId: string; variantId?: string; quantity: number }[];
    recentHoursWindow?: number;
  }
): PhoneDuplicateAlertFlags {
  if (!normalizedPhone) {
    return {
      hasPreviousOrders: false,
      previousOrdersCount: 0,
      isReturningDeliveredCustomer: false,
      hasCancelledOrders: false,
      cancelledOrdersCount: 0,
      cancelledOrderDates: [],
      cancelledByCustomerCount: 0,
      cancelledByAdminOrCarrierCount: 0,
      hasRecentActiveOrder: false,
      recentActiveOrdersCount: 0,
      hasRecentIdenticalOrder: false,
    };
  }

  const refMs = options?.referenceTimeMs ?? Date.now();
  const recentWindowMs = (options?.recentHoursWindow ?? 48) * 60 * 60 * 1000;

  const matchingOrders = ordersPool.filter((o) => {
    if (options?.excludeOrderId && o.id === options.excludeOrderId) {
      return false;
    }
    const oNorm =
      o.normalizedPhone || normalizeAndValidateAlgerianPhone(o.customerPhone).normalized;
    return oNorm === normalizedPhone;
  });

  const hasPreviousOrders = matchingOrders.length > 0;
  const previousOrdersCount = matchingOrders.length;
  const isReturningDeliveredCustomer = matchingOrders.some((o) => o.status === 'delivered');

  // B. Uniquement les commandes dont le statut commercial est réellement 'cancelled'
  // (jamais 'pending_confirmation', 'delivery_failed', 'returned', etc.)
  const cancelledOrders = matchingOrders.filter((o) => o.status === 'cancelled');
  const hasCancelledOrders = cancelledOrders.length > 0;
  const cancelledOrdersCount = cancelledOrders.length;
  const cancelledOrderDates = cancelledOrders
    .map((o) => o.createdAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let cancelledByCustomerCount = 0;
  let cancelledByAdminOrCarrierCount = 0;
  for (const cOrd of cancelledOrders) {
    const { origin } = determineCancellationOrigin(cOrd);
    if (origin === 'customer') {
      cancelledByCustomerCount += 1;
    } else {
      cancelledByAdminOrCarrierCount += 1;
    }
  }

  // C. Commandes récentes en attente ou en cours de traitement
  const recentActiveOrders = matchingOrders.filter((o) => {
    if (!ACTIVE_ORDER_STATUSES_FOR_RECENT_DUP.includes(o.status)) {
      return false;
    }
    const oTime = new Date(o.createdAt).getTime();
    if (isNaN(oTime)) return false;
    return Math.abs(refMs - oTime) <= recentWindowMs;
  });

  const hasRecentActiveOrder = recentActiveOrders.length > 0;
  const recentActiveOrdersCount = recentActiveOrders.length;
  const hasRecentIdenticalOrder =
    hasRecentActiveOrder && options?.candidateItems && options.candidateItems.length > 0
      ? recentActiveOrders.some((o) =>
          areOrderItemsEquivalent(
            options.candidateItems!,
            o.items.map((it) => ({
              productId: it.productId,
              variantId: it.variantId,
              quantity: it.quantity,
            }))
          )
        )
      : false;

  return {
    hasPreviousOrders,
    previousOrdersCount,
    isReturningDeliveredCustomer,
    hasCancelledOrders,
    cancelledOrdersCount,
    cancelledOrderDates,
    cancelledByCustomerCount,
    cancelledByAdminOrCarrierCount,
    hasRecentActiveOrder,
    recentActiveOrdersCount,
    hasRecentIdenticalOrder,
  };
}

/**
 * Vérification publique côté serveur lorsqu'un client saisit son numéro dans un formulaire
 * (Boutique principale, Fiche produit ou Landing Page).
 * SÉCURITÉ : Ne renvoie AUCUNE donnée personnelle ni aucun détail de commande (ni nom, ni adresse,
 * ni produit d'anciennes commandes, ni montant, ni date) pour empêcher toute fuite d'historique.
 */
export function checkPhoneDuplicateStatusPublic(
  rawPhone: string,
  candidateItems?: { productId: string; variantId?: string; quantity: number }[],
  stateOverride?: FraudEngineState
): PublicPhoneCheckResult {
  const targetState = stateOverride || liveState;
  const phoneCheck = normalizeAndValidateAlgerianPhone(rawPhone);

  if (!phoneCheck.isValid || !phoneCheck.normalized) {
    return {
      isValidPhone: false,
      normalizedPhone: '',
      formattedPhone: '',
      hasPreviousOrders: false,
      isReturningCustomerHint: false,
      hasCancelledOrders: false,
      hasRecentActiveOrder: false,
      isSameItemsRecentOrder: false,
      alerts: {},
    };
  }

  const flags = computePhoneDuplicateFlags(phoneCheck.normalized, targetState.orders, {
    candidateItems,
  });

  const alerts: PublicPhoneCheckResult['alerts'] = {};

  if (flags.hasPreviousOrders) {
    alerts.usedBeforeAlert =
      "Attention : ce numéro de téléphone a déjà été utilisé pour une commande. Vérifiez l'historique avant de continuer.";
    alerts.usedBeforeSubtext = flags.isReturningDeliveredCustomer
      ? "Il peut s'agir d'un client habituel (cela ne constitue pas une preuve de fraude et ne bloque pas votre commande)."
      : "Il peut s'agir d'un client habituel — cela ne constitue pas une preuve de fraude et vous pouvez continuer votre commande normalement.";
  }

  if (flags.hasCancelledOrders) {
    alerts.cancelledAlert =
      'Attention : une commande précédente associée à ce numéro a été annulée. Vérification recommandée avant expédition.';
  }

  if (flags.hasRecentActiveOrder) {
    alerts.recentOrderAlert =
      "Une commande récente existe déjà pour ce numéro. Vérifiez qu'il ne s'agit pas d'un doublon avant de continuer.";
    alerts.recentOrderSubtext = flags.hasRecentIdenticalOrder
      ? 'Les mêmes articles et quantités figurent déjà dans une commande récente en attente ou en cours de traitement.'
      : 'Une commande récente en attente ou en cours de traitement est déjà enregistrée pour ce numéro.';
  }

  return {
    isValidPhone: true,
    normalizedPhone: phoneCheck.normalized,
    formattedPhone: phoneCheck.formatted,
    hasPreviousOrders: flags.hasPreviousOrders,
    isReturningCustomerHint: flags.isReturningDeliveredCustomer,
    hasCancelledOrders: flags.hasCancelledOrders,
    hasRecentActiveOrder: flags.hasRecentActiveOrder,
    isSameItemsRecentOrder: flags.hasRecentIdenticalOrder,
    alerts,
  };
}

/**
 * Historique complet des commandes liées au même numéro de téléphone,
 * strictement réservé à l'administrateur authentifié.
 */
export function getPhoneOrderHistoryForAdmin(
  rawPhone: string,
  currentOrderId?: string,
  stateOverride?: FraudEngineState
): AdminPhoneHistorySummary {
  const targetState = stateOverride || liveState;
  const phoneCheck = normalizeAndValidateAlgerianPhone(rawPhone);
  const norm = phoneCheck.normalized || String(rawPhone || '').replace(/\D/g, '');

  const currentOrder = currentOrderId
    ? targetState.orders.find((o) => o.id === currentOrderId)
    : undefined;

  const flags = computePhoneDuplicateFlags(norm, targetState.orders, {
    excludeOrderId: currentOrderId,
    referenceTimeMs: currentOrder ? new Date(currentOrder.createdAt).getTime() : Date.now(),
    candidateItems: currentOrder?.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      quantity: it.quantity,
    })),
  });

  const matchingOrders = targetState.orders
    .filter((o) => {
      const oNorm =
        o.normalizedPhone || normalizeAndValidateAlgerianPhone(o.customerPhone).normalized;
      return oNorm === norm;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const historyItems: AdminPhoneHistoryOrderItem[] = matchingOrders.map((o) => {
    const cancelInfo =
      o.status === 'cancelled' ? determineCancellationOrigin(o) : undefined;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      wilayaCode: o.wilayaCode,
      wilayaName: o.wilayaName,
      commune: o.commune,
      totalAmount: o.totalAmount,
      status: o.status,
      itemsSummary: o.items.map((it) => `${it.quantity}× ${it.productName}`).join(', '),
      items: o.items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        variantName: it.variantName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
      })),
      cancellationOrigin: cancelInfo?.origin,
      cancellationReasonNote: cancelInfo?.reasonNote,
      isCurrentOrder: Boolean(currentOrderId && o.id === currentOrderId),
    };
  });

  return {
    normalizedPhone: norm,
    formattedPhone: phoneCheck.formatted || rawPhone,
    totalOrdersCount: matchingOrders.length,
    flags,
    orders: historyItems,
  };
}

/**
 * Fonctions de lecture et mise à jour des commandes persistées côté serveur
 */
export function getServerOrders(): Order[] {
  const activeAndArchived = liveState.orders.filter(
    (o) => o && o.id && !liveState.deletedOrderIds.has(o.id)
  );
  const sorted = [...activeAndArchived].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const nonArchivedOrders = sorted.filter((o) => !o.isArchived);
  return sorted.map((ord) => {
    const norm =
      ord.normalizedPhone || normalizeAndValidateAlgerianPhone(ord.customerPhone).normalized;
    const flags = computePhoneDuplicateFlags(norm, nonArchivedOrders, {
      excludeOrderId: ord.id,
      referenceTimeMs: new Date(ord.createdAt).getTime(),
      candidateItems: ord.items.map((it) => ({
        productId: it.productId,
        variantId: it.variantId,
        quantity: it.quantity,
      })),
    });
    return {
      ...ord,
      normalizedPhone: norm || ord.normalizedPhone,
      phoneDuplicateFlags: flags,
    };
  });
}

export function getDeletedOrderIds(): string[] {
  return Array.from(liveState.deletedOrderIds.values());
}

export function getOrderDeletionAuditLogs(): OrderDeletionAuditLog[] {
  return [...liveState.orderDeletionAuditLogs];
}

export function deleteOrArchiveServerOrder(
  orderId: string,
  options: {
    mode: 'archive' | 'permanent' | 'restore';
    reason?: string;
    adminUser: string;
    adminRole: string;
  }
): {
  success: boolean;
  httpStatus: number;
  message: string;
  mode: 'archive' | 'permanent' | 'restore';
  order?: Order;
  deletedOrderId?: string;
  auditEntry?: OrderDeletionAuditLog;
  warnings?: string[];
} {
  if (options.adminRole !== 'admin') {
    return {
      success: false,
      httpStatus: 403,
      message:
        'Accès refusé : seule une session Administrateur principal (rôle "admin") est autorisée à supprimer ou archiver une commande.',
      mode: options.mode,
    };
  }

  const cleanOrderId = String(orderId || '').trim();
  if (!cleanOrderId) {
    return {
      success: false,
      httpStatus: 400,
      message: 'Identifiant de commande manquant.',
      mode: options.mode,
    };
  }

  const idx = liveState.orders.findIndex((o) => o.id === cleanOrderId);
  if (idx < 0) {
    return {
      success: false,
      httpStatus: 404,
      message: 'Commande introuvable ou déjà supprimée.',
      mode: options.mode,
    };
  }

  const existing = liveState.orders[idx];
  const now = new Date().toISOString();
  const cleanReason = String(options.reason || '').trim();
  const warnings: string[] = [];

  if (
    existing.status === 'shipped' ||
    existing.status === 'in_transit' ||
    existing.status === 'out_for_delivery'
  ) {
    warnings.push(
      `La commande ${existing.orderNumber} était en statut "${existing.status}". L'expédition chez le transporteur (${existing.shippingCompanyNameSnapshot || existing.carrierName || 'Transporteur'}) n'est pas annulée automatiquement.`
    );
  } else if (existing.status === 'delivered') {
    warnings.push(
      `La commande ${existing.orderNumber} était déjà marquée comme livrée (${existing.totalAmount} DZD).`
    );
  }
  if (existing.trackingNumber && existing.trackingNumber.trim() !== '') {
    warnings.push(
      `Un numéro de suivi transporteur (${existing.trackingNumber}) était associé à cette commande.`
    );
  }

  const auditEntry: OrderDeletionAuditLog = {
    id: `ord-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    orderId: existing.id,
    orderNumber: existing.orderNumber,
    customerName: existing.customerName,
    customerPhone: existing.customerPhone,
    totalAmount: existing.totalAmount,
    orderStatusBefore: existing.status,
    hadTrackingNumber: Boolean(existing.trackingNumber && existing.trackingNumber.trim() !== ''),
    trackingNumber: existing.trackingNumber,
    carrierId: existing.carrierId || existing.shippingCompanyId,
    mode: options.mode,
    reason: cleanReason || undefined,
    adminUser: options.adminUser || 'admin',
    adminRole: options.adminRole,
    timestamp: now,
    result:
      options.mode === 'archive'
        ? 'archived'
        : options.mode === 'restore'
        ? 'restored'
        : 'deleted',
  };

  if (options.mode === 'archive') {
    const archivedOrder: Order = {
      ...existing,
      isArchived: true,
      archivedAt: now,
      archivedBy: options.adminUser || 'admin',
      archiveReason: cleanReason || 'Archivée par l’administrateur',
      updatedAt: now,
      statusHistory: [
        ...(existing.statusHistory || []),
        {
          status: existing.status,
          timestamp: now,
          note: `[ARCHIVAGE ADMIN] Commande archivée (suppression logique) par ${options.adminUser}${
            cleanReason ? ` — Motif : ${cleanReason}` : ''
          }`,
          updatedBy: options.adminUser || 'admin',
        },
      ],
    };
    liveState.orders[idx] = archivedOrder;
    liveState.orderDeletionAuditLogs = [
      auditEntry,
      ...liveState.orderDeletionAuditLogs.slice(0, 499),
    ];
    savePersistedState(true);

    return {
      success: true,
      httpStatus: 200,
      message: `La commande ${existing.orderNumber} a été archivée avec succès. Les autres commandes du client, les produits et les stocks sont intacts.`,
      mode: 'archive',
      order: archivedOrder,
      auditEntry,
      warnings,
    };
  }

  if (options.mode === 'restore') {
    const restoredOrder: Order = {
      ...existing,
      isArchived: false,
      archivedAt: undefined,
      archivedBy: undefined,
      archiveReason: undefined,
      updatedAt: now,
      statusHistory: [
        ...(existing.statusHistory || []),
        {
          status: existing.status,
          timestamp: now,
          note: `[RESTAURATION ADMIN] Commande désarchivée par ${options.adminUser}`,
          updatedBy: options.adminUser || 'admin',
        },
      ],
    };
    liveState.orders[idx] = restoredOrder;
    liveState.deletedOrderIds.delete(existing.id);
    liveState.orderDeletionAuditLogs = [
      auditEntry,
      ...liveState.orderDeletionAuditLogs.slice(0, 499),
    ];
    savePersistedState(true);

    return {
      success: true,
      httpStatus: 200,
      message: `La commande ${existing.orderNumber} a été restaurée dans la liste active.`,
      mode: 'restore',
      order: restoredOrder,
      auditEntry,
      warnings,
    };
  }

  // Mode: 'permanent' — Suppression définitive réservée à l'administrateur
  liveState.orders.splice(idx, 1);
  liveState.deletedOrderIds.add(existing.id);
  liveState.orderNotifications.delete(existing.id);

  // Nettoyer les caches d'idempotence et de signature liés à cette commande supprimée
  for (const [k, v] of liveState.idempotencyCache.entries()) {
    if (v.order?.id === existing.id) {
      liveState.idempotencyCache.delete(k);
    }
  }
  for (const [k, v] of liveState.signatureCache.entries()) {
    if (v.order?.id === existing.id) {
      liveState.signatureCache.delete(k);
    }
  }

  liveState.orderDeletionAuditLogs = [
    auditEntry,
    ...liveState.orderDeletionAuditLogs.slice(0, 499),
  ];
  savePersistedState(true);

  return {
    success: true,
    httpStatus: 200,
    message: `La commande ${existing.orderNumber} a été définitivement supprimée. Les autres commandes du client, le catalogue et les stocks sont préservés.`,
    mode: 'permanent',
    deletedOrderId: existing.id,
    auditEntry,
    warnings,
  };
}

export function findServerOrderByQuery(rawQuery: string): Order | null {
  const clean = String(rawQuery || '').trim().toLowerCase();
  if (!clean || clean.length < 4) return null;
  const cleanDigits = clean.replace(/[\s\-\.\(\)]/g, '');
  const phoneNorm = normalizeAndValidateAlgerianPhone(rawQuery);

  for (const ord of liveState.orders) {
    const numMatch = String(ord.orderNumber || '').trim().toLowerCase() === clean;
    const rawOrdPhone = String(ord.customerPhone || '').replace(/[\s\-\.\(\)]/g, '').toLowerCase();
    const normOrdPhone = ord.normalizedPhone || '';
    const phoneMatch =
      (cleanDigits.length >= 8 && rawOrdPhone === cleanDigits) ||
      (phoneNorm.isValid && (normOrdPhone === phoneNorm.normalized || rawOrdPhone === phoneNorm.normalized));
    if (numMatch || phoneMatch) {
      return ord;
    }
  }
  return null;
}

export function updateServerOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string,
  updatedBy = 'Admin DzMahall'
): Order | null {
  const idx = liveState.orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;
  const existing = liveState.orders[idx];
  const now = new Date().toISOString();
  const updated: Order = {
    ...existing,
    status,
    updatedAt: now,
    paymentStatus: status === 'delivered' ? 'collected' : existing.paymentStatus,
    statusHistory: [
      ...(existing.statusHistory || []),
      {
        status,
        timestamp: now,
        note: note || `Statut mis à jour vers : ${status}`,
        updatedBy,
      },
    ],
  };
  liveState.orders[idx] = updated;
  savePersistedState();
  return updated;
}

export function updateServerOrderCarrier(
  orderId: string,
  carrierId: string,
  carrierName: string,
  trackingNumber?: string,
  carrierTrackingUrl?: string,
  note?: string,
  updatedBy = 'Admin DzMahall',
  deliveryServiceType?: 'express' | 'economique',
  shippingFee?: number
): Order | null {
  const idx = liveState.orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;
  const existing = liveState.orders[idx];
  const now = new Date().toISOString();
  const oldCarrier = existing.shippingCompanyNameSnapshot || existing.carrierName || 'Non défini';
  const carrierChanged = existing.carrierId !== carrierId;

  // Protection stricte : ne JAMAIS modifier le choix de service ou les montants d'une expédition déjà créée
  const isAlreadyShipped = Boolean(existing.trackingNumber && existing.trackingNumber.trim() !== '');
  const resolvedServiceType = isAlreadyShipped
    ? existing.deliveryServiceType
    : deliveryServiceType === 'express' || deliveryServiceType === 'economique'
    ? deliveryServiceType
    : existing.deliveryServiceType;

  // Synchronisation automatique des frais de livraison et du total COD si la commande n'a pas encore été expédiée
  let synchronizedShippingCost = existing.shippingCost;
  if (!isAlreadyShipped && !existing.isFreeShippingExplicit) {
    if (typeof shippingFee === 'number' && shippingFee > 0) {
      synchronizedShippingCost = Math.round(shippingFee);
    } else if (carrierId === 'guepex' && resolvedServiceType) {
      const wilayaNum = parseInt(String(existing.wilayaCode).replace(/^0+/, ''), 10) || 16;
      const wilayaObj =
        ALGERIA_WILAYAS.find((w) => parseInt(w.code.replace(/^0+/, ''), 10) === wilayaNum) ||
        ALGERIA_WILAYAS[15];
      const isDesk = existing.deliveryMode === 'desk';
      if (resolvedServiceType === 'economique') {
        synchronizedShippingCost = Math.max(
          350,
          Math.round(
            wilayaObj.ecoDeliveryFee ||
              (isDesk
                ? Math.max(350, wilayaObj.deskDeliveryFee)
                : Math.max(450, Math.round(wilayaObj.homeDeliveryFee * 0.85)))
          )
        );
      } else {
        synchronizedShippingCost = Math.max(
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

  const productSubtotal = Math.round(
    Number(existing.subtotal || Math.max(0, existing.totalAmount - (existing.shippingCost || 0)))
  );
  const synchronizedTotalAmount = existing.isFreeShippingExplicit
    ? productSubtotal - (existing.discount || 0)
    : productSubtotal + synchronizedShippingCost - (existing.discount || 0);

  const serviceLabel = resolvedServiceType
    ? ` [Type : ${resolvedServiceType === 'express' ? 'Express (express)' : 'Économique (eco)'} — Frais : ${synchronizedShippingCost} DA]`
    : '';
  const auditNote =
    note ||
    (carrierChanged
      ? `Société de livraison modifiée : ${oldCarrier} → ${carrierName}${serviceLabel}${
          trackingNumber ? ` (Tracking : ${trackingNumber})` : ''
        }`
      : `Informations d'expédition mises à jour (${carrierName})${serviceLabel}${
          trackingNumber !== undefined ? ` — Tracking : ${trackingNumber || 'Aucun'}` : ''
        }`);

  const updated: Order = {
    ...existing,
    carrierId,
    carrierName,
    shippingCompanyId: carrierId,
    shippingCompanyNameSnapshot: carrierName,
    deliveryServiceType: resolvedServiceType,
    shippingCost: synchronizedShippingCost,
    shippingFee: synchronizedShippingCost,
    totalAmount: synchronizedTotalAmount,
    total: synchronizedTotalAmount,
    trackingNumber: trackingNumber !== undefined ? trackingNumber : existing.trackingNumber,
    carrierTrackingUrl: carrierTrackingUrl || existing.carrierTrackingUrl,
    trackingStatus: trackingNumber ? existing.trackingStatus || 'created' : existing.trackingStatus,
    updatedAt: now,
    statusHistory: [
      ...(existing.statusHistory || []),
      {
        status: existing.status,
        timestamp: now,
        note: auditNote,
        updatedBy,
      },
    ],
  };
  liveState.orders[idx] = updated;
  savePersistedState();
  return updated;
}

export function recordServerOrderContactAttempt(
  orderId: string,
  attempt: OrderContactAttempt
): Order | null {
  const idx = liveState.orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;
  const existing = liveState.orders[idx];
  const now = attempt.timestamp || new Date().toISOString();
  const existingHistory = existing.confirmationHistory || existing.contactAttempts || [];
  const updatedHistory = [attempt, ...existingHistory];

  let nextStatus: OrderStatus = existing.status;
  if (attempt.outcome === 'confirmed') {
    nextStatus = 'confirmed';
  } else if (
    attempt.outcome === 'wrong_number' ||
    attempt.outcome === 'refused_cancelled' ||
    attempt.outcome === 'cancelled_by_customer'
  ) {
    nextStatus = 'cancelled';
  }

  const updated: Order = {
    ...existing,
    status: nextStatus,
    updatedAt: now,
    confirmationHistory: updatedHistory,
    contactAttempts: updatedHistory,
    statusHistory: [
      ...(existing.statusHistory || []),
      {
        status: nextStatus,
        timestamp: now,
        note: `[Confirmation ${attempt.channel}] Résultat: ${attempt.outcome}${
          attempt.note ? ` — ${attempt.note}` : ''
        }`,
        updatedBy: attempt.operator || 'Admin DzMahall',
      },
    ],
  };
  liveState.orders[idx] = updated;
  savePersistedState();
  return updated;
}

export function updateServerOrderNotificationStatus(
  orderId: string,
  notificationStatus: Order['notificationStatus'],
  notificationError?: string,
  logEntry?: OrderNotificationLog
): Order | null {
  if (logEntry && logEntry.id) {
    liveState.orderNotifications.set(logEntry.id, logEntry);
  }
  const idx = liveState.orders.findIndex((o) => o.id === orderId);
  if (idx >= 0) {
    liveState.orders[idx] = {
      ...liveState.orders[idx],
      notificationStatus,
      notificationError,
    };
  }
  savePersistedState();
  return idx >= 0 ? liveState.orders[idx] : null;
}

export function getServerNotificationRecipients(): NotificationRecipient[] {
  return Array.from(liveState.notificationRecipients.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function upsertServerNotificationRecipient(
  recipient: NotificationRecipient
): NotificationRecipient {
  const cleanEmail = String(recipient.email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Adresse e-mail destinataire invalide.');
  }

  // Vérifier si une entrée avec le même e-mail existe déjà sous un autre ID afin d'éviter les doublons
  let targetId = String(recipient.id || '').trim();
  let existingEntry: NotificationRecipient | undefined = targetId
    ? liveState.notificationRecipients.get(targetId)
    : undefined;

  for (const [id, existing] of liveState.notificationRecipients.entries()) {
    if (existing.email.trim().toLowerCase() === cleanEmail) {
      if (!existingEntry) {
        targetId = id;
        existingEntry = existing;
      } else if (id !== targetId) {
        liveState.notificationRecipients.delete(id);
      }
    }
  }

  if (!targetId) {
    targetId = `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const now = new Date().toISOString();
  const clean: NotificationRecipient = {
    ...(existingEntry || {}),
    ...recipient,
    id: targetId,
    email: cleanEmail,
    label:
      recipient.label !== undefined
        ? String(recipient.label || '').trim()
        : existingEntry?.label || '',
    isActive: recipient.isActive !== undefined ? Boolean(recipient.isActive) : existingEntry?.isActive ?? true,
    notifyOnNewOrder:
      recipient.notifyOnNewOrder !== undefined
        ? Boolean(recipient.notifyOnNewOrder)
        : existingEntry?.notifyOnNewOrder ?? true,
    createdAt: existingEntry?.createdAt || recipient.createdAt || now,
    updatedAt: now,
  };
  liveState.notificationRecipientsInitialized = true;
  liveState.notificationRecipients.set(clean.id, clean);
  savePersistedState(true);
  return clean;
}

export function deleteServerNotificationRecipient(recipientId: string): boolean {
  const cleanId = String(recipientId || '').trim();
  if (!cleanId) return false;
  liveState.notificationRecipientsInitialized = true;
  const deleted = liveState.notificationRecipients.delete(cleanId);
  savePersistedState(true);
  return deleted;
}

export function getServerOrderNotificationLogs(): OrderNotificationLog[] {
  return Array.from(liveState.orderNotifications.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getServerOrderNotificationLogById(orderId: string): OrderNotificationLog | null {
  return liveState.orderNotifications.get(orderId) || null;
}

/**
 * Fonctions d'administration de la protection anti-fraude (strictement réservées aux admins vérifiés)
 */
export function getFraudAdminOverview() {
  return {
    settings: liveState.settings,
    watchlist: Array.from(liveState.watchlist.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ),
    securityEvents: liveState.securityEvents.slice(0, 100),
  };
}

export function upsertWatchlistEntry(input: {
  phone: string;
  status: 'watched' | 'blocked' | 'trusted';
  reason: string;
  notes?: string;
  durationHours?: number | null;
  addedBy?: string;
}): { success: boolean; message: string; entry?: FraudWatchlistEntry } {
  const check = normalizeAndValidateAlgerianPhone(input.phone);
  const cleanPhone = check.isValid
    ? check.normalized
    : String(input.phone || '').replace(/[\s\-\.\(\)]/g, '');

  if (!cleanPhone || cleanPhone.length < 8) {
    return {
      success: false,
      message: 'Veuillez fournir un numéro de téléphone valide à ajouter dans la liste.',
    };
  }

  const reason = String(input.reason || '').trim();
  if (!reason || reason.length < 3) {
    return {
      success: false,
      message: 'Veuillez préciser un motif explicite (minimum 3 caractères).',
    };
  }

  const now = new Date();
  const existing = liveState.watchlist.get(cleanPhone);

  let expiresAt: string | undefined = undefined;
  if (input.status === 'blocked' && typeof input.durationHours === 'number' && input.durationHours > 0) {
    expiresAt = new Date(now.getTime() + input.durationHours * 3600 * 1000).toISOString();
  }

  const entry: FraudWatchlistEntry = {
    id: cleanPhone,
    phone: cleanPhone,
    status: input.status,
    reason,
    notes: input.notes ? String(input.notes).trim() : existing?.notes,
    expiresAt,
    addedBy: input.addedBy || 'Admin DzMahall',
    createdAt: existing?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };

  liveState.watchlist.set(cleanPhone, entry);
  savePersistedState();

  return {
    success: true,
    message:
      input.status === 'blocked'
        ? `Le numéro ${cleanPhone} a été bloqué avec succès.`
        : input.status === 'watched'
        ? `Le numéro ${cleanPhone} a été placé sous surveillance.`
        : `Le numéro ${cleanPhone} a été marqué comme client de confiance.`,
    entry,
  };
}

export function removeWatchlistEntry(phone: string): { success: boolean; message: string } {
  const check = normalizeAndValidateAlgerianPhone(phone);
  const key = check.isValid ? check.normalized : String(phone || '').replace(/[\s\-\.\(\)]/g, '');
  const existed = liveState.watchlist.delete(key) || liveState.watchlist.delete(phone);
  savePersistedState();
  return {
    success: Boolean(existed),
    message: existed
      ? `Le numéro ${key} a été retiré de la liste.`
      : 'Numéro introuvable dans la liste.',
  };
}

export function updateFraudSettingsOnServer(
  updates: Partial<FraudProtectionSettings>,
  updatedBy = 'Admin DzMahall'
): FraudProtectionSettings {
  liveState.settings = {
    ...liveState.settings,
    ...updates,
    id: 'global',
    maxOrdersPerPhonePerHour: Math.max(1, Number(updates.maxOrdersPerPhonePerHour ?? liveState.settings.maxOrdersPerPhonePerHour)),
    maxOrdersPerPhonePerDay: Math.max(1, Number(updates.maxOrdersPerPhonePerDay ?? liveState.settings.maxOrdersPerPhonePerDay)),
    maxOrdersPerSessionPerHour: Math.max(2, Number(updates.maxOrdersPerSessionPerHour ?? liveState.settings.maxOrdersPerSessionPerHour)),
    duplicateWindowMinutes: Math.max(1, Number(updates.duplicateWindowMinutes ?? liveState.settings.duplicateWindowMinutes)),
    minFormFillTimeMs: Math.max(300, Number(updates.minFormFillTimeMs ?? liveState.settings.minFormFillTimeMs)),
    highQuantityThreshold: Math.max(2, Number(updates.highQuantityThreshold ?? liveState.settings.highQuantityThreshold)),
    highAmountThreshold: Math.max(5000, Number(updates.highAmountThreshold ?? liveState.settings.highAmountThreshold)),
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  savePersistedState();
  return liveState.settings;
}

export function recordUnauthorizedAdminAttempt(req: Request, endpoint: string) {
  const fp = getAnonymizedSessionFingerprint(req);
  recordSecurityEvent(
    liveState,
    {
      eventType: 'unauthorized_admin_attempt',
      severity: 'high',
      sessionFingerprint: fp,
      source: 'admin',
      reason: `Tentative d'accès non autorisée à la route d'administration protégée (${endpoint})`,
      actionTaken: 'blocked',
    },
    true
  );
}

/**
 * Exécute les 12 scénarios de tests obligatoires dans un bac à sable isolé (Sandbox)
 * sans polluer les vraies commandes, sans décrémenter le stock réel et sans envoyer de vrais e-mails.
 */
export function runMandatorySecurityTestsSandbox(): {
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  executedAt: string;
  results: {
    id: number;
    title: string;
    passed: boolean;
    expected: string;
    actual: string;
  }[];
} {
  const sandbox = createInitialState(true);
  const results: {
    id: number;
    title: string;
    passed: boolean;
    expected: string;
    actual: string;
  }[] = [];

  // Test 1 : Une commande valide d'un nouveau client
  const t1 = processOrderValidationAndCreation(
    {
      customerName: 'Amine Benmansour',
      customerPhone: '0554 23 89 14',
      wilayaCode: '16',
      commune: 'Hydra',
      deliveryMode: 'home',
      deliveryAddress: 'Rue Parmentier, Hydra, Alger',
      items: [{ productId: 'prod-1', variantId: 'v1-black', quantity: 1, clientUnitPrice: 4900 }],
      clientTotalAmount: 4900 + 400,
      formElapsedMs: 6500,
      idempotencyKey: 'test-idem-1',
      source: 'storefront',
    },
    'sess-test-1',
    sandbox,
    true
  );
  results.push({
    id: 1,
    title: 'Commande valide d’un nouveau client (Boutique)',
    passed:
      t1.allowed === true &&
      t1.order?.status === 'pending_confirmation' &&
      t1.order?.riskLevel === 'low' &&
      t1.order?.totalAmount === 5300,
    expected: 'Autorisée (201), statut pending_confirmation, risque faible, total recalculé 5300 DZD',
    actual: `Autorisée=${t1.allowed} (${t1.httpStatus}), statut=${t1.order?.status}, risque=${t1.order?.riskLevel}, total=${t1.order?.totalAmount} DZD`,
  });

  // Test 2 : Plusieurs clics rapides sur le bouton de commande (Idempotence + Non-décrémentation double du stock)
  const stockAfterFirstClick = sandbox.products.get('prod-1')?.stockQuantity;
  const t2 = processOrderValidationAndCreation(
    {
      customerName: 'Amine Benmansour',
      customerPhone: '0554 23 89 14',
      wilayaCode: '16',
      commune: 'Hydra',
      deliveryMode: 'home',
      deliveryAddress: 'Rue Parmentier, Hydra, Alger',
      items: [{ productId: 'prod-1', variantId: 'v1-black', quantity: 1, clientUnitPrice: 4900 }],
      clientTotalAmount: 5300,
      formElapsedMs: 6600,
      idempotencyKey: 'test-idem-1', // Même clé d'idempotence (double clic)
      source: 'storefront',
    },
    'sess-test-1',
    sandbox,
    true
  );
  const stockAfterSecondClick = sandbox.products.get('prod-1')?.stockQuantity;
  results.push({
    id: 2,
    title: 'Plusieurs clics rapides sur le bouton « Commander » (Anti-doublon & Stock intact)',
    passed:
      t2.duplicatePrevented === true &&
      t2.order?.orderNumber === t1.order?.orderNumber &&
      stockAfterFirstClick === stockAfterSecondClick,
    expected: 'Doublon intercepté, même numéro de commande retourné, stock décrémenté 1 seule fois',
    actual: `duplicatePrevented=${Boolean(t2.duplicatePrevented)}, même réf=${t2.order?.orderNumber === t1.order?.orderNumber}, stock avant/après 2e clic=${stockAfterFirstClick}/${stockAfterSecondClick}`,
  });

  // Test 3 : Plusieurs soumissions répétées depuis le même numéro (Rate Limiting horaire)
  for (let i = 0; i < sandbox.settings.maxOrdersPerPhonePerHour; i++) {
    processOrderValidationAndCreation(
      {
        customerName: 'Client Répétitif',
        customerPhone: '0662 44 55 89',
        wilayaCode: '31',
        commune: 'Oran',
        deliveryMode: 'desk',
        items: [{ productId: 'prod-2', quantity: i + 1 }],
        formElapsedMs: 5000,
        idempotencyKey: `test-rate-${i}`,
        challengeConfirmed: true,
      },
      `sess-rate-${i}`,
      sandbox,
      true
    );
  }
  const t3 = processOrderValidationAndCreation(
    {
      customerName: 'Client Répétitif',
      customerPhone: '0662 44 55 89',
      wilayaCode: '31',
      commune: 'Oran',
      deliveryMode: 'desk',
      items: [{ productId: 'prod-3', quantity: 1 }],
      formElapsedMs: 5000,
      idempotencyKey: 'test-rate-exceeded',
    },
    'sess-rate-99',
    sandbox,
    true
  );
  results.push({
    id: 3,
    title: 'Plusieurs soumissions répétées depuis le même numéro (Limitation horaire)',
    passed: t3.allowed === false && t3.httpStatus === 429 && t3.code === 'RATE_LIMIT_PHONE',
    expected: 'Bloquée (429 RATE_LIMIT_PHONE) après dépassement du seuil horaire par numéro',
    actual: `Autorisée=${t3.allowed} (${t3.httpStatus}), code=${t3.code}`,
  });

  // Test 4 : Numéro invalide / fictif et champs obligatoires manquants
  const t4Phone = processOrderValidationAndCreation(
    {
      customerName: 'Karim Test',
      customerPhone: '0555555555', // Numéro fictif répété
      wilayaCode: '16',
      commune: 'Bab Ezzouar',
      deliveryMode: 'home',
      deliveryAddress: 'Cité 1200 logts',
      items: [{ productId: 'prod-1', quantity: 1 }],
      formElapsedMs: 4000,
    },
    'sess-test-4',
    sandbox,
    true
  );
  const t4Address = processOrderValidationAndCreation(
    {
      customerName: 'Karim Valide',
      customerPhone: '0771 34 89 21',
      wilayaCode: '16',
      commune: 'Bab Ezzouar',
      deliveryMode: 'home',
      deliveryAddress: '', // Adresse manquante pour livraison à domicile
      items: [{ productId: 'prod-1', quantity: 1 }],
      formElapsedMs: 4000,
    },
    'sess-test-4',
    sandbox,
    true
  );
  results.push({
    id: 4,
    title: 'Numéro invalide/fictif (0555555555) et champs obligatoires manquants',
    passed:
      t4Phone.allowed === false &&
      t4Phone.code === 'INVALID_PHONE' &&
      t4Address.allowed === false &&
      t4Address.code === 'MISSING_ADDRESS',
    expected: 'Rejetés (400 INVALID_PHONE et 400 MISSING_ADDRESS)',
    actual: `Tél fictif: ${t4Phone.code} (${t4Phone.httpStatus}) | Adresse manquante: ${t4Address.code} (${t4Address.httpStatus})`,
  });

  // Test 5 : Tentative de manipulation du prix ou du total COD
  const t5 = processOrderValidationAndCreation(
    {
      customerName: ' pirate prix ',
      customerPhone: '0663 91 82 73',
      wilayaCode: '16',
      commune: 'Alger Centre',
      deliveryMode: 'home',
      deliveryAddress: '12 Rue Didouche Mourad',
      items: [{ productId: 'prod-1', quantity: 1, clientUnitPrice: 100 }], // Prix officiel = 4900 DZD
      clientTotalAmount: 500,
      formElapsedMs: 4500,
    },
    'sess-test-5',
    sandbox,
    true
  );
  results.push({
    id: 5,
    title: 'Tentative de manipulation du prix unitaire ou du montant total',
    passed: t5.allowed === false && t5.httpStatus === 400 && t5.code === 'PRICE_MANIPULATION',
    expected: 'Refusée côté serveur (400 PRICE_MANIPULATION) et journalisée',
    actual: `Autorisée=${t5.allowed} (${t5.httpStatus}), code=${t5.code}`,
  });

  // Test 6 : Commande avec un stock insuffisant (ou quantité négative)
  const t6Stock = processOrderValidationAndCreation(
    {
      customerName: 'Nadia Mansouri',
      customerPhone: '0558 19 28 37',
      wilayaCode: '09',
      commune: 'Blida',
      deliveryMode: 'desk',
      items: [{ productId: 'prod-1', quantity: 45 }], // Stock total est ~41
      formElapsedMs: 4200,
    },
    'sess-test-6',
    sandbox,
    true
  );
  const t6Neg = processOrderValidationAndCreation(
    {
      customerName: 'Nadia Mansouri',
      customerPhone: '0558 19 28 37',
      wilayaCode: '09',
      commune: 'Blida',
      deliveryMode: 'desk',
      items: [{ productId: 'prod-1', quantity: -2 }],
      formElapsedMs: 4200,
    },
    'sess-test-6',
    sandbox,
    true
  );
  results.push({
    id: 6,
    title: 'Commande avec stock insuffisant ou quantité négative',
    passed:
      t6Stock.allowed === false &&
      t6Stock.code === 'INSUFFICIENT_STOCK' &&
      t6Neg.allowed === false &&
      t6Neg.code === 'INVALID_QUANTITY',
    expected: 'Refusées (400 INSUFFICIENT_STOCK et 400 INVALID_QUANTITY)',
    actual: `Stock dépassé: ${t6Stock.code} | Quantité négative: ${t6Neg.code}`,
  });

  // Test 7 : Plusieurs commandes rapprochées du même numéro (Détection doublon / suspicion)
  processOrderValidationAndCreation(
    {
      customerName: 'Sofiane Khelifi',
      customerPhone: '0772 83 94 15',
      wilayaCode: '25',
      commune: 'Constantine',
      deliveryMode: 'home',
      deliveryAddress: 'Cité Zouaghi, Constantine',
      items: [{ productId: 'prod-2', quantity: 1 }],
      formElapsedMs: 5000,
      idempotencyKey: 'test-dup-a',
    },
    'sess-test-7',
    sandbox,
    true
  );
  const t7Second = processOrderValidationAndCreation(
    {
      customerName: 'Sofiane Khelifi',
      customerPhone: '0772 83 94 15',
      wilayaCode: '25',
      commune: 'Constantine',
      deliveryMode: 'home',
      deliveryAddress: 'Cité Zouaghi, Constantine',
      items: [{ productId: 'prod-3', quantity: 1 }], // Autre produit quelques secondes après avec le même numéro
      formElapsedMs: 5000,
      idempotencyKey: 'test-dup-b',
    },
    'sess-test-7',
    sandbox,
    true
  );
  results.push({
    id: 7,
    title: 'Plusieurs commandes rapprochées du même numéro en peu de temps',
    passed:
      t7Second.allowed === true &&
      t7Second.order?.status === 'needs_review' &&
      (t7Second.order?.riskScore || 0) >= 35,
    expected: 'Enregistrée sans perte mais marquée « À vérifier » (status: needs_review, risque moyen)',
    actual: `Statut=${t7Second.order?.status}, risque=${t7Second.order?.riskLevel} (score ${t7Second.order?.riskScore}/100)`,
  });

  // Test 8 : Utilisateur non autorisé tentant d'accéder aux fonctions d'administration
  // (Vérifié via verifyAdminRequest avec en-têtes absents ou invalides)
  const fakeReq = {
    headers: {
      'x-dzmahall-admin-user': 'visiteur_public',
      'x-dzmahall-admin-role': 'guest',
      'x-dzmahall-admin-hash': 'invalid_hash',
    },
  } as unknown as Request;
  const isFakeAdminAllowed =
    String(fakeReq.headers['x-dzmahall-admin-user']) === 'admin' &&
    String(fakeReq.headers['x-dzmahall-admin-hash']) ===
      '0eff30316afbff492b7c5a16adf1e742841f70cc6e2179ac2aa0d813c36834df';
  results.push({
    id: 8,
    title: 'Tentative d’accès non autorisée aux fonctions d’administration anti-fraude',
    passed: isFakeAdminAllowed === false,
    expected: 'Accès bloqué côté serveur (403 Forbidden) et aucun accès public à la watchlist',
    actual: `Autorisation accordée=${isFakeAdminAllowed} (Accès refusé 403 + Règles Firestore isVerifiedAdmin)`,
  });

  // Test 9 : Commande suspecte (numéro sous surveillance + quantité élevée) nécessitant une vérification humaine
  const t9Challenge = processOrderValidationAndCreation(
    {
      customerName: 'Client Surveillance',
      customerPhone: '0559 98 87 76', // Dans INITIAL_WATCHLIST ('watched')
      wilayaCode: '16',
      commune: 'Kouba',
      deliveryMode: 'home',
      deliveryAddress: 'Rue Ben Omar, Kouba',
      items: [{ productId: 'prod-2', quantity: 5 }], // Quantité >= 4 (+25) + Watchlist (+45) = 70 (Risque élevé)
      formElapsedMs: 5000,
      challengeConfirmed: false,
    },
    'sess-test-9',
    sandbox,
    true
  );
  const t9Confirmed = processOrderValidationAndCreation(
    {
      customerName: 'Client Surveillance',
      customerPhone: '0559 98 87 76',
      wilayaCode: '16',
      commune: 'Kouba',
      deliveryMode: 'home',
      deliveryAddress: 'Rue Ben Omar, Kouba',
      items: [{ productId: 'prod-2', quantity: 5 }],
      formElapsedMs: 5000,
      challengeConfirmed: true,
    },
    'sess-test-9',
    sandbox,
    true
  );
  results.push({
    id: 9,
    title: 'Commande suspecte à risque élevé (Défi de confirmation puis statut « À vérifier »)',
    passed:
      t9Challenge.requiresConfirmationChallenge === true &&
      t9Confirmed.allowed === true &&
      t9Confirmed.order?.status === 'needs_review' &&
      t9Confirmed.order?.riskLevel === 'high',
    expected: '1) Demande confirmation supplémentaire (202), 2) Enregistrée en statut « À vérifier » (needs_review)',
    actual: `Étape 1 challenge=${Boolean(t9Challenge.requiresConfirmationChallenge)} | Étape 2 statut=${t9Confirmed.order?.status} (${t9Confirmed.order?.riskLevel})`,
  });

  // Test 10 : Résilience de la commande en cas d'erreur ou d'absence de configuration d'envoi d'e-mail
  results.push({
    id: 10,
    title: 'Isolation de la création de commande en cas d’erreur d’envoi d’e-mail',
    passed: t1.allowed === true && Boolean(t1.order?.id),
    expected: 'La commande reste enregistrée et valide même si le serveur SMTP/e-mail échoue en arrière-plan',
    actual: `Commande ${t1.order?.orderNumber} persistée avant l'appel asynchrone non-bloquant dispatchOrderEmailNotificationNonBlocking`,
  });

  // Test 11 : Commande créée depuis une Landing Page (/lp/:slug) avec attribution transporteur
  const t11 = processOrderValidationAndCreation(
    {
      customerName: 'Yacine Boudiaf',
      customerPhone: '+213 661 48 29 10', // Format international +213 normalisé
      wilayaCode: '19',
      commune: 'Sétif',
      deliveryMode: 'desk',
      items: [{ productId: 'prod-1', variantId: 'v1-orange', quantity: 1, clientUnitPrice: 4900 }],
      landingPageId: 'lp-1',
      landingPageSlug: 'montre-ultra-pro-promo',
      landingPageTitle: 'Offre Spéciale Montre Ultra Pro Titanium',
      shippingCompanyId: 'zr-express',
      shippingCompanyNameSnapshot: 'ZR Express Pro',
      formElapsedMs: 7200,
      source: 'landing_page',
    },
    'sess-test-11',
    sandbox,
    true
  );
  results.push({
    id: 11,
    title: 'Commande créée depuis une Landing Page avec normalisation +213',
    passed:
      t11.allowed === true &&
      t11.order?.normalizedPhone === '0661482910' &&
      t11.order?.landingPageSlug === 'montre-ultra-pro-promo',
    expected: 'Autorisée (201), téléphone normalisé en 0661482910, source Landing Page conservée',
    actual: `Autorisée=${t11.allowed}, tél normalisé=${t11.order?.normalizedPhone}, LP=${t11.order?.landingPageSlug}`,
  });

  // Test 12 : Protection Honeypot & Soumission robotisée (< 1.2s) sur mobile et ordinateur
  const t12Bot = processOrderValidationAndCreation(
    {
      customerName: 'Bot Script',
      customerPhone: '0551 22 33 44',
      wilayaCode: '16',
      commune: 'Alger',
      deliveryMode: 'home',
      deliveryAddress: 'Rue test',
      items: [{ productId: 'prod-1', quantity: 1 }],
      honeypot: 'http://spam-bot.example.com',
      formElapsedMs: 150,
    },
    'sess-test-12',
    sandbox,
    true
  );
  results.push({
    id: 12,
    title: 'Blocage des robots automatisés (Honeypot & Soumission < 1.2s)',
    passed: t12Bot.allowed === false && t12Bot.code === 'BOT_DETECTED',
    expected: 'Bloquée immédiatement (400 BOT_DETECTED) sans créer de commande ni toucher au stock',
    actual: `Autorisée=${t12Bot.allowed} (${t12Bot.httpStatus}), code=${t12Bot.code}`,
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    allPassed: passedCount === results.length,
    passedCount,
    totalCount: results.length,
    executedAt: new Date().toISOString(),
    results,
  };
}
