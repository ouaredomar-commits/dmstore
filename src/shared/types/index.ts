/**
 * Modèles de données et interfaces métier unifiés de DzMahall (Shared)
 */

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
  altText?: string;
  isPrimary: boolean;
  source: 'upload' | 'url';
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

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  categoryLabel: string;
  price: number;               // Prix normal en DZD
  originalPrice?: number;      // Prix barré (avant réduction) en DZD
  purchaseCost: number;        // Coût d'achat fournisseur (DZD)
  advertisingCost: number;     // Coût d'acquisition publicitaire estimé (DZD)
  packagingCost: number;       // Coût de l'emballage (DZD)
  sku: string;
  stockQuantity: number;
  description: string;
  features: string[];
  imageUrls: string[];         // Rétrocompatibilité
  images?: ProductImageItem[]; // Liste riche des images
  options?: ProductOption[];   // Options (Taille, Couleur, etc.)
  variants: ProductVariant[];
  isActive: boolean;
  isFeatured?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CartItem {
  product: Product;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
}

export type OrderStatus =
  | 'pending_confirmation' // En attente d'appel de confirmation
  | 'confirmed'            // Confirmée par téléphone
  | 'preparing'            // En cours d'emballage
  | 'shipped'              // Remise au transporteur
  | 'in_transit'           // En transit vers la wilaya
  | 'out_for_delivery'     // En cours de livraison par le livreur
  | 'delivered'            // Livrée et encaissée (COD)
  | 'delivery_failed'      // Échec de livraison (tentative 1 ou 2)
  | 'returned'             // Retournée au stock
  | 'cancelled';           // Annulée

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
  deliveryMode: 'home' | 'desk'; // 🏠 Domicile (Bab Edar) ou 🏢 Point Relais / Stop Desk
  deskName?: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  totalAmount: number;        // Total à payer à la livraison en DZD
  paymentMethod: 'COD';       // Cash on Delivery
  paymentStatus: 'pending' | 'collected';
  status: OrderStatus;
  carrierId?: string;         // 'yalidine', 'guepex', 'ecotrack', etc.
  carrierName?: string;
  trackingNumber?: string;
  carrierTrackingUrl?: string;
  notes?: string;
  statusHistory: {
    status: OrderStatus;
    timestamp: string;
    note?: string;
    updatedBy?: string;
  }[];
}

export interface Wilaya {
  code: string;
  name: string;
  nameAr: string;
  homeDeliveryFee: number;
  deskDeliveryFee: number;
  estimatedDeliveryHours: string;
  communes: string[];
  deskAvailable: boolean;
}

export interface CarrierConfig {
  id: string;
  name: string;
  logoUrl?: string;
  description: string;
  status: 'connected' | 'not_configured' | 'incomplete' | 'error' | 'disabled';
  environment: 'production' | 'test';
  lastTestedAt?: string;
  lastError?: string;
  supportsWebhooks: boolean;
  supportsLabelPrinting: boolean;
  supportsTracking: boolean;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'password' | 'url';
    value: string;
    placeholder?: string;
    required: boolean;
  }[];
  officialPortalUrl: string;
  trackingUrlTemplate?: string;
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
  status: 'draft' | 'published' | 'archived';
  themeColor: string;
  accentColor: string;
  headline: string;
  seoTitle: string;
  seoDescription: string;
  viewsCount: number;
  ordersCount: number;
  sections: LandingPageSection[];
  createdAt: string;
  updatedAt: string;
}
