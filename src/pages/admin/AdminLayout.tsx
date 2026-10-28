import React from 'react';
import { useStore } from '../../context/StoreContext';
import { DzMahallLogo } from '../../components/DzMahallLogo';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Truck,
  Calculator,
  Share2,
  Settings,
  ArrowLeft,
  Sparkles,
  LogOut,
  User,
  ShieldCheck,
  Bell,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { navigateTo, adminRole, setAdminRole, adminUser, logoutAdmin } = useStore();

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'orders', label: 'Commandes COD', icon: Package },
    { id: 'fraud-protection', label: 'Protection anti-fraude', icon: ShieldCheck },
    { id: 'order-notifications', label: 'Notifications de commandes', icon: Bell },
    { id: 'products', label: 'Catalogue & Stocks', icon: ShoppingBag },
    { id: 'landing-pages', label: 'Landing Pages (Vente)', icon: Sparkles },
    { id: 'carriers', label: 'Transporteurs Algérie', icon: Truck },
    { id: 'profitability', label: 'Calculateur Rentabilité', icon: Calculator },
    { id: 'google-workspace', label: 'Google Workspace', icon: Share2 },
    { id: 'settings', label: 'Paramètres généraux', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#212B36] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-[#DFE3E8] shrink-0 flex flex-col shadow-xs">
        {/* Brand in Sidebar */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
          <DzMahallLogo size="sm" showText={true} showSubtitle={false} theme="light" />
          <span className="text-[10px] bg-orange-50 text-[#FF6500] border border-orange-200 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
            Admin
          </span>
        </div>

        {/* Role indicator */}
        <div className="px-5 py-3 border-b border-[#E2E8F0] bg-[#F4F6F8]/60 flex items-center justify-between text-xs">
          <span className="text-[#637381] font-medium">Rôle actif :</span>
          <select
            value={adminRole}
            onChange={(e) => setAdminRole(e.target.value as any)}
            className="bg-white border border-[#DFE3E8] rounded-lg px-2 py-1 text-[11px] text-[#212B36] font-bold focus:outline-hidden cursor-pointer"
          >
            <option value="admin">Administrateur</option>
            <option value="manager">Manager Logistique</option>
            <option value="operator">Opérateur Confirmation</option>
          </select>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-left ${
                  active
                    ? 'bg-[#FF6500] text-white shadow-md shadow-orange-500/20'
                    : 'text-[#637381] hover:text-[#212B36] hover:bg-[#F4F6F8]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Account & Session Actions */}
        <div className="p-3.5 border-t border-[#E2E8F0] bg-[#F4F6F8]/60 space-y-2">
          {/* User profile capsule */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#DFE3E8] shadow-2xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[#FF6500] flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] font-black text-[#212B36] truncate leading-tight">
                  {adminUser?.username || 'admin'}
                </p>
                <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  <span>Connecté</span>
                </p>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={logoutAdmin}
              className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
              title="Se déconnecter de l'administration"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Quick return to storefront */}
          <button
            onClick={() => navigateTo('/')}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-[#637381] hover:text-[#212B36] text-[11px] font-bold transition-colors border border-[#DFE3E8] cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-3 h-3 text-[#FF6500]" />
            <span>Voir Boutique Publique</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F4F6F8]">
        {children}
      </main>
    </div>
  );
};
