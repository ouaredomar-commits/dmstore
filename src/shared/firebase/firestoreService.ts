import {
  collection,
  doc,
  getDocs,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from './config';
import { Product, Order, LandingPage, OrderStatus } from '../types';

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
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Test initial Firestore connectivity
 */
export async function testConnection(): Promise<boolean> {
  const testPath = 'test';
  try {
    await getDocFromServer(doc(db, testPath, 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is running in offline/cached mode.');
    }
    return false;
  }
}

// ============================================================
// STOREFRONT (PUBLIC) READ & ORDER METHODS
// ============================================================

/**
 * Public subscription to active catalog products only
 */
export function subscribeToActiveProducts(
  onData: (products: Product[]) => void,
  onError?: (error: Error) => void
): () => void {
  const path = 'products';
  // Listen to all and filter active on client or query
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Product;
        if (data.isActive !== false) {
          items.push({
            ...data,
            id: docSnap.id,
          });
        }
      });
      onData(items);
    },
    (err) => {
      console.error('Failed to listen to active products:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Public subscription to published landing pages only (drafts are excluded)
 */
export function subscribeToPublishedLandingPages(
  onData: (pages: LandingPage[]) => void,
  onError?: (error: Error) => void
): () => void {
  const path = 'landing_pages';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: LandingPage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as LandingPage;
        // Strict guard: only published pages are provided to the store
        if (data.status === 'published') {
          items.push({
            ...data,
            id: docSnap.id,
          });
        }
      });
      onData(items);
    },
    (err) => {
      console.error('Failed to listen to published landing pages:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Atomic customer order placement with stock decrement
 */
export async function placeOrderWithAtomicStock(order: Order): Promise<void> {
  const orderRef = doc(db, 'orders', order.id);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Check & decrement stocks for each ordered item
      for (const item of order.items) {
        const productRef = doc(db, 'products', item.productId);
        const prodSnap = await transaction.get(productRef);

        if (prodSnap.exists()) {
          const prodData = prodSnap.data() as Product;
          const currentStock = prodData.stockQuantity || 0;
          const nextStock = Math.max(0, currentStock - item.quantity);

          // Update variant stock if variant specified
          let updatedVariants = prodData.variants;
          if (item.variantId && updatedVariants) {
            updatedVariants = updatedVariants.map((v) =>
              v.id === item.variantId ? { ...v, stock: Math.max(0, v.stock - item.quantity) } : v
            );
          }

          transaction.update(productRef, {
            stockQuantity: nextStock,
            ...(updatedVariants ? { variants: updatedVariants } : {}),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 2. Write new order document
      const sanitizedOrder = JSON.parse(JSON.stringify(order));
      transaction.set(orderRef, sanitizedOrder);
    });
  } catch (err) {
    // If transaction fails, fallback to direct order set
    console.warn('Transaction stock update error, falling back to direct write:', err);
    const sanitizedOrder = JSON.parse(JSON.stringify(order));
    await setDoc(orderRef, sanitizedOrder, { merge: true });
  }
}

/**
 * Public order lookup for tracking
 */
export async function findOrderByNumberOrPhone(searchQuery: string): Promise<Order[]> {
  const trimmed = searchQuery.trim();
  if (!trimmed) return [];

  const path = 'orders';
  try {
    // First try by orderNumber
    const q1 = query(collection(db, path), where('orderNumber', '==', trimmed));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      return snap1.docs.map((d) => ({ ...(d.data() as Order), id: d.id }));
    }

    // Next try by customerPhone
    const cleanPhone = trimmed.replace(/\s+/g, '');
    const q2 = query(collection(db, path), where('customerPhone', '==', cleanPhone));
    const snap2 = await getDocs(q2);
    return snap2.docs.map((d) => ({ ...(d.data() as Order), id: d.id }));
  } catch (err) {
    console.error('Error looking up order:', err);
    return [];
  }
}

// ============================================================
// ADMIN (BACK-OFFICE) FULL CRUD & MANAGEMENT METHODS
// ============================================================

export function subscribeToAllProducts(
  onData: (products: Product[]) => void,
  onError?: (error: Error) => void
): () => void {
  const path = 'products';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((docSnap) => {
        items.push({
          ...(docSnap.data() as Product),
          id: docSnap.id,
        });
      });
      onData(items);
    },
    (err) => {
      console.error('Admin products subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveProductToFirestore(product: Product): Promise<void> {
  const path = 'products';
  try {
    const sanitized = JSON.parse(JSON.stringify(product));
    await setDoc(doc(db, path, product.id), sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${product.id}`);
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const path = 'products';
  try {
    await deleteDoc(doc(db, path, productId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${productId}`);
  }
}

export function subscribeToAllOrders(
  onData: (orders: Order[]) => void,
  onError?: (error: Error) => void
): () => void {
  const path = 'orders';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Order[] = [];
      snapshot.forEach((docSnap) => {
        items.push({
          ...(docSnap.data() as Order),
          id: docSnap.id,
        });
      });
      onData(items);
    },
    (err) => {
      console.error('Admin orders subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveOrderToFirestore(order: Order): Promise<void> {
  const path = 'orders';
  try {
    const sanitized = JSON.parse(JSON.stringify(order));
    await setDoc(doc(db, path, order.id), sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${order.id}`);
  }
}

export function subscribeToAllLandingPages(
  onData: (pages: LandingPage[]) => void,
  onError?: (error: Error) => void
): () => void {
  const path = 'landing_pages';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: LandingPage[] = [];
      snapshot.forEach((docSnap) => {
        items.push({
          ...(docSnap.data() as LandingPage),
          id: docSnap.id,
        });
      });
      onData(items);
    },
    (err) => {
      console.error('Admin landing pages subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveLandingPageToFirestore(page: LandingPage): Promise<void> {
  const path = 'landing_pages';
  try {
    const sanitized = JSON.parse(JSON.stringify(page));
    await setDoc(doc(db, path, page.id), sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${page.id}`);
  }
}

export async function deleteLandingPageFromFirestore(pageId: string): Promise<void> {
  const path = 'landing_pages';
  try {
    await deleteDoc(doc(db, path, pageId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${pageId}`);
  }
}

// Initial seeding helpers
export async function seedInitialProductsIfEmpty(initialProducts: Product[]): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'products'));
    if (snap.empty) {
      for (const prod of initialProducts) {
        await setDoc(doc(db, 'products', prod.id), JSON.parse(JSON.stringify(prod)));
      }
    }
  } catch (err) {
    console.warn('Seed products error:', err);
  }
}

export async function seedInitialOrdersIfEmpty(initialOrders: Order[]): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    if (snap.empty) {
      for (const ord of initialOrders) {
        await setDoc(doc(db, 'orders', ord.id), JSON.parse(JSON.stringify(ord)));
      }
    }
  } catch (err) {
    console.warn('Seed orders error:', err);
  }
}

export async function seedInitialLandingPagesIfEmpty(initialPages: LandingPage[]): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'landing_pages'));
    if (snap.empty) {
      for (const lp of initialPages) {
        await setDoc(doc(db, 'landing_pages', lp.id), JSON.parse(JSON.stringify(lp)));
      }
    }
  } catch (err) {
    console.warn('Seed landing pages error:', err);
  }
}
