import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { AdminAuthGuard } from './auth/AdminAuthGuard';

// Admin Layout & Tabs
import { AdminLayout } from '../../pages/admin/AdminLayout';
import { AdminDashboard } from '../../pages/admin/AdminDashboard';
import { AdminOrders } from '../../pages/admin/AdminOrders';
import { AdminProducts } from '../../pages/admin/AdminProducts';
import { AdminLandingPages } from '../../pages/admin/AdminLandingPages';
import { AdminCarriers } from '../../pages/admin/AdminCarriers';
import { AdminProfitability } from '../../pages/admin/AdminProfitability';
import { AdminGoogleWorkspace } from '../../pages/admin/AdminGoogleWorkspace';
import { AdminSettings } from '../../pages/admin/AdminSettings';
import { AdminOrderNotifications } from '../../pages/admin/AdminOrderNotifications';
import { AdminFraudProtection } from '../../pages/admin/AdminFraudProtection';

export const AdminApp: React.FC = () => {
  const { currentRoute } = useStore();

  const [adminTab, setAdminTab] = useState<string>(() => {
    if (currentRoute.includes('fraud')) return 'fraud-protection';
    if (currentRoute.includes('notification')) return 'order-notifications';
    if (currentRoute.includes('landing-page')) return 'landing-pages';
    if (currentRoute.includes('order')) return 'orders';
    if (currentRoute.includes('product')) return 'products';
    if (currentRoute.includes('carrier')) return 'carriers';
    if (currentRoute.includes('profitability')) return 'profitability';
    if (currentRoute.includes('workspace')) return 'google-workspace';
    if (currentRoute.includes('setting')) return 'settings';
    return 'dashboard';
  });

  // Sync tab if route changes
  useEffect(() => {
    if (currentRoute.includes('fraud')) setAdminTab('fraud-protection');
    else if (currentRoute.includes('notification')) setAdminTab('order-notifications');
    else if (currentRoute.includes('landing-page')) setAdminTab('landing-pages');
    else if (currentRoute.includes('order')) setAdminTab('orders');
    else if (currentRoute.includes('product')) setAdminTab('products');
    else if (currentRoute.includes('carrier')) setAdminTab('carriers');
  }, [currentRoute]);

  const isNewLP = currentRoute === '/admin/landing-pages/new';
  const isEditLP = currentRoute.includes('/admin/landing-pages/') && currentRoute.includes('/edit');
  const isPreviewLP = currentRoute.includes('/admin/landing-pages/') && currentRoute.includes('/preview');
  const lpSubView = isNewLP ? 'new' : isEditLP ? 'edit' : isPreviewLP ? 'preview' : 'list';

  return (
    <AdminAuthGuard>
      <AdminLayout activeTab={adminTab} setActiveTab={setAdminTab}>
        {adminTab === 'dashboard' && <AdminDashboard onNavigateTab={setAdminTab} />}
        {adminTab === 'orders' && <AdminOrders />}
        {adminTab === 'fraud-protection' && <AdminFraudProtection />}
        {adminTab === 'order-notifications' && <AdminOrderNotifications />}
        {adminTab === 'products' && <AdminProducts />}
        {adminTab === 'landing-pages' && <AdminLandingPages initialSubView={lpSubView} />}
        {adminTab === 'carriers' && <AdminCarriers />}
        {adminTab === 'profitability' && <AdminProfitability />}
        {adminTab === 'google-workspace' && <AdminGoogleWorkspace />}
        {adminTab === 'settings' && <AdminSettings />}
      </AdminLayout>
    </AdminAuthGuard>
  );
};
