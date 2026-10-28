import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  disableNetwork,
} from 'firebase/firestore';
import { db, auth } from './config';
import {
  Product,
  Order,
  LandingPage,
  CategoryItem,
  NotificationRecipient,
  OrderNotificationLog,
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let isFirestoreQuotaExhausted = false;

function isQuotaOrOfflineError(rawMessage: string): boolean {
  return (
    rawMessage.includes('the client is offline') ||
    rawMessage.includes('Could not reach Cloud Firestore') ||
    rawMessage.includes("Backend didn't respond") ||
    rawMessage.includes('unavailable') ||
    rawMessage.includes('resource-exhausted') ||
    rawMessage.includes('Quota exceeded') ||
    rawMessage.includes('Quota limit exceeded')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const isTransientOrQuota = isQuotaOrOfflineError(rawMessage);

  if (
    rawMessage.includes('resource-exhausted') ||
    rawMessage.includes('Quota exceeded') ||
    rawMessage.includes('Quota limit exceeded')
  ) {
    isFirestoreQuotaExhausted = true;
    void disableNetwork(db).catch(() => {});
  }

  const errInfo: FirestoreErrorInfo = {
    error: rawMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  if (isTransientOrQuota) {
    // Secondary Firestore sync is unavailable or daily free quota is reached; authoritative Express backend (/api/catalog, /api/orders) remains active
    return;
  }

  console.warn('Firestore Error: ', JSON.stringify(errInfo));
}

/**
 * Test initial Firestore connectivity with a fast 3-second timeout.
 * If Cloud Firestore does not respond within 3 seconds or if the free daily read quota is exceeded,
 * cleanly disable Firestore network retries so the client never hangs or emits quota errors, while the app
 * operates seamlessly on the authoritative Express server (/api/catalog, /api/orders).
 */
export async function testConnection(): Promise<boolean> {
  if (isFirestoreQuotaExhausted) {
    return false;
  }
  const testPath = 'test';
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const connected = await Promise.race<boolean>([
      getDocFromServer(doc(db, testPath, 'connection')).then(() => true),
      new Promise<boolean>((resolve) => {
        timeoutId = setTimeout(() => resolve(false), 3000);
      }),
    ]);
    if (timeoutId) clearTimeout(timeoutId);

    if (!connected) {
      await disableNetwork(db).catch(() => {});
      return false;
    }
    return true;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes('resource-exhausted') ||
      msg.includes('Quota exceeded') ||
      msg.includes('Quota limit exceeded')
    ) {
      isFirestoreQuotaExhausted = true;
    }
    await disableNetwork(db).catch(() => {});
    return false;
  }
}

/**
 * Real-time products subscription across all devices
 */
export function subscribeToProducts(
  onData: (products: Product[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (isFirestoreQuotaExhausted) return () => {};
  const path = 'products';
  const colRef = collection(db, path);

  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Product;
        items.push({
          ...data,
          id: docSnap.id,
          isActive: data.isActive !== false,
          price: Number(data.price) || 0,
          stockQuantity: Number(data.stockQuantity) || 0,
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
          features: Array.isArray(data.features) ? data.features : [],
          variants: Array.isArray(data.variants) ? data.variants : [],
        });
      });
      items.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Save or update a product in Firestore
 */
export async function saveProductToFirestore(product: Product): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const path = 'products';
  try {
    const normalized: Product = {
      ...product,
      name: String(product.name || '').trim(),
      price: Number(product.price) || 0,
      purchaseCost: Number(product.purchaseCost) || 0,
      advertisingCost: Number(product.advertisingCost) || 0,
      packagingCost: Number(product.packagingCost) || 0,
      stockQuantity: Number(product.stockQuantity) || 0,
      isActive: product.isActive !== false,
      createdAt: product.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const sanitized = JSON.parse(JSON.stringify(normalized));
    await setDoc(doc(db, path, product.id), sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${product.id}`);
  }
}

/**
 * Save multiple products to Firestore in batches (max 50 per batch for stability and speed)
 */
export async function saveProductsBatchToFirestore(
  products: Product[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const path = 'products';
  if (!products || products.length === 0) return;
  const BATCH_SIZE = 50;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const prod of chunk) {
      const normalized: Product = {
        ...prod,
        name: String(prod.name || '').trim(),
        price: Number(prod.price) || 0,
        purchaseCost: Number(prod.purchaseCost) || 0,
        advertisingCost: Number(prod.advertisingCost) || 0,
        packagingCost: Number(prod.packagingCost) || 0,
        stockQuantity: Number(prod.stockQuantity) || 0,
        isActive: prod.isActive !== false,
        createdAt: prod.createdAt || new Date().toISOString(),
        updatedAt: prod.updatedAt || new Date().toISOString(),
      };
      const sanitized = JSON.parse(JSON.stringify(normalized));
      const ref = doc(db, path, prod.id);
      batch.set(ref, sanitized, { merge: true });
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, products.length), products.length);
    }
  }
}

/**
 * Delete a product from Firestore
 */
export async function deleteProductFromFirestore(productId: string): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const path = 'products';
  try {
    await deleteDoc(doc(db, path, productId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${productId}`);
  }
}

/**
 * Seed initial catalog to Firestore if the collection is empty
 */
export async function seedInitialProductsIfEmpty(initialProducts: Product[]): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const path = 'products';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      for (const prod of initialProducts) {
        const sanitized = JSON.parse(JSON.stringify(prod));
        await setDoc(doc(db, path, prod.id), sanitized);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Real-time orders subscription across all devices
 */
export function subscribeToOrders(
  onData: (orders: Order[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (isFirestoreQuotaExhausted) return () => {};
  const path = 'orders';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: Order[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Order;
        items.push({
          ...data,
          id: docSnap.id,
        });
      });
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Save or update an order in Firestore
 */
export async function saveOrderToFirestore(order: Order): Promise<void> {
  const path = 'orders';
  try {
    const sanitized = JSON.parse(JSON.stringify(order));
    await setDoc(doc(db, path, order.id), sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${order.id}`);
  }
}

/**
 * Permanently delete an order from Firestore (Admin only)
 */
export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  const path = 'orders';
  try {
    await deleteDoc(doc(db, path, orderId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${orderId}`);
  }
}

/**
 * Seed initial orders if empty
 */
export async function seedInitialOrdersIfEmpty(initialOrders: Order[]): Promise<void> {
  const path = 'orders';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      for (const ord of initialOrders) {
        const sanitized = JSON.parse(JSON.stringify(ord));
        await setDoc(doc(db, path, ord.id), sanitized);
      }
    }
  } catch (err) {
    console.warn('Could not seed initial orders to Firestore:', err);
  }
}

/**
 * Targeted order lookup by orderNumber or customerPhone for public order tracking
 * Avoids exposing the entire orders collection to unauthenticated public visitors.
 */
export async function findOrderByQueryFromFirestore(rawQuery: string): Promise<Order | null> {
  const clean = rawQuery.trim().toLowerCase();
  if (!clean || clean.length < 4) return null;
  const cleanDigits = clean.replace(/\s+/g, '');

  try {
    const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    let matched: Order | null = null;
    snap.forEach((docSnap) => {
      if (matched) return;
      const data = docSnap.data() as Order;
      const orderNum = String(data.orderNumber || '').trim().toLowerCase();
      const phone = String(data.customerPhone || '').replace(/\s+/g, '').toLowerCase();
      if (orderNum === clean || (cleanDigits.length >= 8 && phone === cleanDigits)) {
        matched = {
          ...data,
          id: docSnap.id,
        };
      }
    });
    return matched;
  } catch (err) {
    console.warn('Targeted order tracking lookup failed:', err);
    return null;
  }
}

/**
 * Real-time landing pages subscription across all devices
 */
export function subscribeToLandingPages(
  onData: (pages: LandingPage[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (isFirestoreQuotaExhausted) return () => {};
  const path = 'landing_pages';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: LandingPage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as LandingPage;
        items.push({
          ...data,
          id: docSnap.id,
        });
      });
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Save or update a landing page in Firestore
 */
export async function saveLandingPageToFirestore(page: LandingPage): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const path = 'landing_pages';
  try {
    const sanitized = JSON.parse(JSON.stringify(page));
    await setDoc(doc(db, path, page.id), sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${page.id}`);
  }
}

/**
 * Delete a landing page from Firestore
 */
export async function deleteLandingPageFromFirestore(pageId: string): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const path = 'landing_pages';
  try {
    await deleteDoc(doc(db, path, pageId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${pageId}`);
  }
}

/**
 * Seed initial landing pages if empty
 */
export async function seedInitialLandingPagesIfEmpty(initialPages: LandingPage[]): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const path = 'landing_pages';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      for (const p of initialPages) {
        const sanitized = JSON.parse(JSON.stringify(p));
        await setDoc(doc(db, path, p.id), sanitized);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Real-time categories subscription across all devices
 */
export function subscribeToCategories(
  onData: (categories: CategoryItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (isFirestoreQuotaExhausted) return () => {};
  const path = 'categories';
  const colRef = collection(db, path);
  const deprecatedIds = new Set([
    'cat-electronique-high-tech',
    'cat-mode-vetements',
    'cat-maison-decoration-jardin',
    'cat-beaute-sante-bien-etre',
    'cat-sports-loisirs',
  ]);

  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const items: CategoryItem[] = [];
      snapshot.forEach((docSnap) => {
        if (deprecatedIds.has(docSnap.id)) return;
        const data = docSnap.data() as CategoryItem;
        items.push({
          ...data,
          id: docSnap.id,
          isActive: data.isActive !== false,
          order: typeof data.order === 'number' ? data.order : 999,
          subcategories: Array.isArray(data.subcategories)
            ? [...data.subcategories].sort((a, b) => (a.order || 0) - (b.order || 0))
            : [],
        });
      });
      items.sort((a, b) => (a.order || 0) - (b.order || 0));
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Save or update a category in Firestore
 */
export async function saveCategoryToFirestore(category: CategoryItem): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const path = 'categories';
  try {
    const sanitized = JSON.parse(JSON.stringify(category));
    await setDoc(doc(db, path, category.id), sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${category.id}`);
  }
}

/**
 * Save multiple categories in a single batch (used when reordering)
 */
export async function saveCategoriesBatchToFirestore(categories: CategoryItem[]): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const path = 'categories';
  if (!categories || categories.length === 0) return;
  const batch = writeBatch(db);
  for (const cat of categories) {
    const sanitized = JSON.parse(JSON.stringify(cat));
    batch.set(doc(db, path, cat.id), sanitized, { merge: true });
  }
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Synchronize the 15 official categories in Firestore without creating duplicates on reload,
 * and clean up any deprecated 5-category placeholders.
 */
export async function seedInitialCategoriesIfEmpty(initialCategories: CategoryItem[]): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const path = 'categories';
  const deprecatedIds = new Set([
    'cat-electronique-high-tech',
    'cat-mode-vetements',
    'cat-maison-decoration-jardin',
    'cat-beaute-sante-bien-etre',
    'cat-sports-loisirs',
  ]);
  try {
    const snap = await getDocs(collection(db, path));
    const existingDocs = new Map<string, CategoryItem>();
    const toDeleteIds: string[] = [];

    snap.forEach((d) => {
      if (deprecatedIds.has(d.id)) {
        toDeleteIds.push(d.id);
      } else {
        existingDocs.set(d.id, d.data() as CategoryItem);
      }
    });

    const toUpsert: CategoryItem[] = [];
    for (const initCat of initialCategories) {
      const existing = existingDocs.get(initCat.id);
      if (!existing) {
        toUpsert.push(initCat);
      } else if (!existing.icon || !existing.nameTranslations) {
        toUpsert.push({
          ...initCat,
          ...existing,
          id: initCat.id,
          icon: existing.icon || initCat.icon,
          nameTranslations: existing.nameTranslations || initCat.nameTranslations,
          subcategories:
            Array.isArray(existing.subcategories) && existing.subcategories.length > 0
              ? existing.subcategories
              : initCat.subcategories,
        });
      }
    }

    if (toDeleteIds.length > 0 || toUpsert.length > 0) {
      const batch = writeBatch(db);
      for (const delId of toDeleteIds) {
        batch.delete(doc(db, path, delId));
      }
      for (const cat of toUpsert) {
        const sanitized = JSON.parse(JSON.stringify(cat));
        batch.set(doc(db, path, cat.id), sanitized, { merge: true });
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn('Could not synchronize official categories to Firestore:', err);
  }
}

/**
 * Real-time notification recipients subscription (Firestore primary persistence)
 */
export function subscribeToNotificationRecipients(
  onData: (recipients: NotificationRecipient[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (isFirestoreQuotaExhausted) return () => {};
  const path = 'notification_recipients';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: NotificationRecipient[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as NotificationRecipient;
        items.push({
          ...data,
          id: docSnap.id,
          email: String(data.email || '').trim().toLowerCase(),
          isActive: data.isActive !== false,
          notifyOnNewOrder: data.notifyOnNewOrder !== false,
        });
      });
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Fetch active notification recipients directly from Firestore when an order is created
 */
export async function getActiveNotificationRecipientsFromFirestore(): Promise<NotificationRecipient[]> {
  const path = 'notification_recipients';
  try {
    const snap = await getDocs(collection(db, path));
    const items: NotificationRecipient[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as NotificationRecipient;
      if (data.isActive !== false && data.notifyOnNewOrder !== false && data.email) {
        items.push({
          ...data,
          id: docSnap.id,
          email: String(data.email).trim().toLowerCase(),
          isActive: true,
          notifyOnNewOrder: true,
        });
      }
    });
    return items;
  } catch (err) {
    console.warn('Could not read notification_recipients from Firestore:', err);
    return [];
  }
}

/**
 * Save or update a notification recipient in Firestore
 */
export async function saveNotificationRecipientToFirestore(
  recipient: NotificationRecipient
): Promise<void> {
  const path = 'notification_recipients';
  try {
    const sanitized = JSON.parse(
      JSON.stringify({
        ...recipient,
        email: recipient.email.trim().toLowerCase(),
      })
    );
    await setDoc(doc(db, path, recipient.id), sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${recipient.id}`);
  }
}

/**
 * Delete a notification recipient from Firestore
 */
export async function deleteNotificationRecipientFromFirestore(recipientId: string): Promise<void> {
  const path = 'notification_recipients';
  try {
    await deleteDoc(doc(db, path, recipientId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${recipientId}`);
  }
}

/**
 * Real-time order notification logs subscription for the Admin panel
 */
export function subscribeToOrderNotifications(
  onData: (logs: OrderNotificationLog[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (isFirestoreQuotaExhausted) return () => {};
  const path = 'order_notifications';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: OrderNotificationLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as OrderNotificationLog;
        items.push({
          ...data,
          id: docSnap.id,
        });
      });
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Check if a notification log already exists for a specific orderId in Firestore
 */
export async function getOrderNotificationFromFirestore(
  orderId: string
): Promise<OrderNotificationLog | null> {
  const path = 'order_notifications';
  try {
    const snap = await getDoc(doc(db, path, orderId));
    if (!snap.exists()) return null;
    return {
      ...(snap.data() as OrderNotificationLog),
      id: snap.id,
    };
  } catch {
    return null;
  }
}

/**
 * Save or update an order notification log in Firestore (non-blocking for order creation)
 */
export async function saveOrderNotificationToFirestore(
  logEntry: OrderNotificationLog
): Promise<void> {
  const path = 'order_notifications';
  try {
    const sanitized = JSON.parse(JSON.stringify(logEntry));
    await setDoc(doc(db, path, logEntry.id), sanitized, { merge: true });
  } catch (err) {
    console.warn('Could not save order_notification log to Firestore:', err);
  }
}




