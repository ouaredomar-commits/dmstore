import React from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { StoreApp } from './apps/store/StoreApp';
import { AdminApp } from './apps/admin/AdminApp';

/**
 * Root Router: Decoupled Multi-App Gateway
 * Routes '/admin/*' to DzMahall Admin and all other routes to DzMahall Store
 */
const RootAppGateway: React.FC = () => {
  const { currentRoute } = useStore();

  if (currentRoute.startsWith('/admin')) {
    return <AdminApp />;
  }

  return <StoreApp />;
};

export default function App() {
  return (
    <StoreProvider>
      <RootAppGateway />
    </StoreProvider>
  );
}
