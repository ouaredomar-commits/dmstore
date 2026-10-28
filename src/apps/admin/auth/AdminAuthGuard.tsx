import React, { useState } from 'react';
import { useStore } from '../../../context/StoreContext';
import { DzMahallLogo } from '../../../components/DzMahallLogo';
import {
  ShieldCheck,
  Lock,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  User,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

/**
 * AdminAuthGuard — Protects /admin routes against unauthorized access.
 * - Unauthenticated users see the Admin Login page.
 * - Authenticated users without an authorized administrator role receive an explicit Access Denied (403) screen.
 * - Authorized administrators access the back-office.
 */
export const AdminAuthGuard: React.FC<AdminAuthGuardProps> = ({ children }) => {
  const {
    isAdminLoggedIn,
    isAdminAuthorized,
    adminAccessDenied,
    clearAdminAccessDenied,
    loginAdmin,
    loginAdminWithGoogle,
    logoutAdmin,
    navigateTo,
    storeDomain,
  } = useStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'manager' | 'operator'>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Explicit 403 Access Denied screen if a user attempted login with an unauthorized account
  // or is logged in without valid administrator authorization
  if (adminAccessDenied || (isAdminLoggedIn && !isAdminAuthorized)) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-center items-center p-4 relative overflow-hidden">
        <div className="w-full max-w-md bg-[#1E293B] border border-red-500/30 rounded-3xl p-7 sm:p-9 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-[11px] font-bold uppercase tracking-wider">
              Accès Refusé · Code 403
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white font-['Plus_Jakarta_Sans']">
              Autorisation Administrateur Requise
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ce compte ne dispose pas des privilèges d'administration requis pour accéder au back-office de{' '}
              <span className="text-white font-semibold">{storeDomain}</span>. La connaissance de l'URL{' '}
              <span className="font-mono text-slate-300">/admin</span> n'accorde aucun droit d'accès.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                clearAdminAccessDenied();
                logoutAdmin();
                setError('');
              }}
              className="w-full py-3 rounded-xl bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Se connecter avec un compte administrateur autorisé
            </button>

            <button
              type="button"
              onClick={() => {
                clearAdminAccessDenied();
                logoutAdmin();
                navigateTo('/');
              }}
              className="w-full py-3 rounded-xl bg-[#0F172A] hover:bg-slate-900 text-slate-300 font-bold text-xs border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retourner à la boutique publique</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authorized Administrator: render back-office
  if (isAdminLoggedIn && isAdminAuthorized) {
    return <>{children}</>;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError("Veuillez saisir votre nom d'utilisateur ou adresse email.");
      return;
    }

    if (!password) {
      setError('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const result = loginAdmin(username, password, selectedRole);
      if (!result.success) {
        setError(result.error || 'Identifiants invalides.');
      }
      setIsLoading(false);
    }, 350);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    const result = await loginAdminWithGoogle();
    if (!result.success && !result.accessDenied) {
      setError(result.error || 'Échec de la vérification administrateur.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle Ambient Background Accents */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#FF6500]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#004C3F]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Return to Public Storefront */}
        <button
          onClick={() => navigateTo('/')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#FF6500]" />
          <span>Retourner à la boutique publique ({storeDomain})</span>
        </button>

        {/* Login Card */}
        <div className="bg-[#1E293B] border border-slate-800 rounded-3xl p-7 sm:p-9 shadow-2xl space-y-6">
          {/* Brand & Security Badge */}
          <div className="flex flex-col items-center text-center space-y-3">
            <DzMahallLogo size="md" showText={true} showSubtitle={false} theme="dark" />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#FF6500] text-[11px] font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Portail d'Administration Privé</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-['Plus_Jakarta_Sans']">
              Connexion Administrateur
            </h1>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Authentification requise pour accéder à la gestion du catalogue, des stocks et des commandes COD.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Role Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Profil d'accès :
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as any)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
              >
                <option value="admin">Administrateur Général (Accès Complet)</option>
                <option value="manager">Manager Logistique & Expéditions</option>
                <option value="operator">Opérateur Confirmation Téléphonique</option>
              </select>
            </div>

            {/* Username / Email Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nom d'utilisateur ou Email Administrateur :
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Identifiant administrateur"
                  required
                  autoFocus
                  autoComplete="username"
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#FF6500]"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Mot de passe :
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-xl pl-10 pr-10 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#FF6500]"
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Afficher ou masquer le mot de passe"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-[#FF6500] hover:bg-[#E55B00] active:bg-[#CC5100] text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoading ? 'Vérification des droits...' : 'Se Connecter au Back-Office'}</span>
            </button>
          </form>

          {/* Optional Firebase Auth Google Verification for Authorized Admin Account */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0F172A] hover:bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-[#FF6500]" />
              <span>Authentification Google Administrateur</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Accès strictement réservé aux comptes administrateurs autorisés de DzMahall.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
