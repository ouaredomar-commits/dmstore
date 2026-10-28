import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem, Order, Wilaya, LandingPage } from '../../../shared/types';
import { ALGERIA_WILAYAS } from '../../../shared/data';
import {
  subscribeToActiveProducts,
  subscribeToPublishedLandingPages,
  placeOrderWithAtomicStock,
  findOrderByNumberOrPhone,
} from '../../../shared/firebase/firestoreService';

interface StoreClientContextType {
  // Navigation
  currentRoute: string;
  navigateTo: (route: string) => void;
  selectedProductSlug: string | null;
  setSelectedProductSlug: (slug: string | null) => void;

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

  // Public Catalog & Published Landing Pages
  products: Product[];
  publishedLandingPages: LandingPage[];

  // Ordering & Tracking
  wilayas: Wilaya[];
  placeCustomerOrder: (orderData: {
    customerName: string;
    customerPhone: string;
    wilayaCode: string;
    commune: string;
    deliveryAddress?: string;
    deliveryMode: 'home' | 'desk';
    deskName?: string;
    notes?: string;
    items?: CartItem[];
  }) => Promise<Order>;
  trackOrder: (query: string) => Promise<Order[]>;

  // Brand / Contact Info
  brandName: string;
  contactPhone: string;
  contactWhatsApp: string;
  storeDomain: string;
  businessCardImageUrl: string;
  isCardModalOpen: boolean;
  setIsCardModalOpen: (open: boolean) => void;
}

const StoreClientContext = createContext<StoreClientContextType | undefined>(undefined);

export const StoreClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const brandName = 'DzMahall';
  const contactPhone = '+213 660 769 386';
  const contactWhatsApp = '213660769386';
  const storeDomain = 'DzMahall.store';
  const businessCardImageUrl = '/assets/aistudio/carte_visite_dzmahall_1080x1920_d725b011.png';

  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return window.location.pathname.startsWith('/admin') ? '/' : window.location.pathname || '/';
  });
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);

  // Cart state persisted locally
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('dzmahall_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Real-time catalog & published landing pages (Read-only)
  const [products, setProducts] = useState<Product[]>([]);
  const [publishedLandingPages, setPublishedLandingPages] = useState<LandingPage[]>([]);
  const wilayas = ALGERIA_WILAYAS;

  useEffect(() => {
    try {
      localStorage.setItem('dzmahall_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [cart]);

  // Subscribe in real-time to active products
  useEffect(() => {
    const unsubProducts = subscribeToActiveProducts((items) => {
      setProducts(items);
    });

    const unsubLPs = subscribeToPublishedLandingPages((pages) => {
      setPublishedLandingPages(pages);
    });

    return () => {
      unsubProducts();
      unsubLPs();
    };
  }, []);

  const navigateTo = (route: string) => {
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  // Customer order placement with atomic stock decrement
  const placeCustomerOrder = async ({
    customerName,
    customerPhone,
    wilayaCode,
    commune,
    deliveryAddress,
    deliveryMode,
    deskName,
    notes,
    items,
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
  }): Promise<Order> => {
    const targetItems = items && items.length > 0 ? items : cart;
    const wilaya = wilayas.find((w) => w.code === wilayaCode) || wilayas[15]; // Alger default
    const shippingCost = deliveryMode === 'home' ? wilaya.homeDeliveryFee : wilaya.deskDeliveryFee;

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
    const totalAmount = subtotal + shippingCost;
    const orderNumber = `DZM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

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
      shippingCost,
      discount: 0,
      totalAmount,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      status: 'pending_confirmation',
      notes,
      statusHistory: [
        {
          status: 'pending_confirmation',
          timestamp: now,
          note: 'Commande enregistrée sur DzMahall Store (Paiement à la livraison).',
        },
      ],
    };

    // Atomic transaction: decrement product stock & save order to Firestore
    await placeOrderWithAtomicStock(newOrder);

    // Clear cart if ordered from cart
    if (!items || items.length === 0) {
      clearCart();
    }

    return newOrder;
  };

  const trackOrder = async (query: string): Promise<Order[]> => {
    return findOrderByNumberOrPhone(query);
  };

  return (
    <StoreClientContext.Provider
      value={{
        currentRoute,
        navigateTo,
        selectedProductSlug,
        setSelectedProductSlug,
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
        publishedLandingPages,
        wilayas,
        placeCustomerOrder,
        trackOrder,
        brandName,
        contactPhone,
        contactWhatsApp,
        storeDomain,
        businessCardImageUrl,
        isCardModalOpen,
        setIsCardModalOpen,
      }}
    >
      {children}
    </StoreClientContext.Provider>
  );
};

export const useStoreClient = () => {
  const context = useContext(StoreClientContext);
  if (!context) {
    throw new Error('useStoreClient must be used within a StoreClientProvider');
  }
  return context;
};
