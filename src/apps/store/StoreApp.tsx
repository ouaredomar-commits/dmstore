import React from 'react';
import { useStore } from '../../context/StoreContext';
import { StoreHeader } from './components/StoreHeader';
import { Footer } from '../../components/Footer';
import { CartDrawer } from '../../components/CartDrawer';
import { BusinessCardModal } from '../../components/BusinessCardModal';
import { PWAInstallPrompt } from '../../components/PWAInstallPrompt';
import { HomePage } from '../../pages/HomePage';
import { ShopPage } from '../../pages/ShopPage';
import { ProductDetailPage } from '../../pages/ProductDetailPage';
import { CheckoutPage } from '../../pages/CheckoutPage';
import { OrderTrackingPage } from '../../pages/OrderTrackingPage';
import { DeliveryInfoPage } from '../../pages/DeliveryInfoPage';
import { ContactPage } from '../../pages/ContactPage';
import { TermsPage, PrivacyPage } from '../../pages/LegalPages';
import { LandingPageView } from '../../pages/LandingPageView';

/**
 * StoreApp — 100% Dedicated Public Storefront & Landing Pages Application
 * Strictly isolates customer shopping experience from administrative logic.
 */
export const StoreApp: React.FC = () => {
  const { currentRoute } = useStore();

  // Extract pure path without query parameters for route matching
  const purePath = currentRoute.split('?')[0];

  // Standalone Landing Page route (/lp/:slug)
  if (purePath.startsWith('/lp/')) {
    const lpSlug = purePath.replace('/lp/', '');
    return (
      <>
        <LandingPageView slug={lpSlug} />
        <PWAInstallPrompt />
      </>
    );
  }

  const renderStoreContent = () => {
    if (purePath === '/') return <HomePage />;
    if (purePath === '/boutique') return <ShopPage />;
    if (purePath.startsWith('/produit/')) {
      const productSlug = purePath.replace('/produit/', '');
      return <ProductDetailPage slug={productSlug} />;
    }
    if (purePath === '/commande') return <CheckoutPage />;
    if (purePath === '/suivi-commande') return <OrderTrackingPage />;
    if (purePath === '/livraison') return <DeliveryInfoPage />;
    if (purePath === '/contact') return <ContactPage />;
    if (purePath === '/conditions-generales') return <TermsPage />;
    if (purePath === '/politique-confidentialite') return <PrivacyPage />;
    return <HomePage />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#212B36] font-sans">
      <StoreHeader />
      <main className="flex-1">{renderStoreContent()}</main>
      <Footer />
      <CartDrawer />
      <BusinessCardModal />
      <PWAInstallPrompt />
    </div>
  );
};
