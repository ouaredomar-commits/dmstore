import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  getAnonymizedSessionFingerprint,
  processOrderValidationAndCreation,
  syncServerCatalogAndOrders,
  getFraudAdminOverview,
  upsertWatchlistEntry,
  removeWatchlistEntry,
  updateFraudSettingsOnServer,
  recordUnauthorizedAdminAttempt,
  runMandatorySecurityTestsSandbox,
  getServerOrders,
  findServerOrderByQuery,
  updateServerOrderStatus,
  updateServerOrderCarrier,
  recordServerOrderContactAttempt,
  updateServerOrderNotificationStatus,
  getServerNotificationRecipients,
  upsertServerNotificationRecipient,
  deleteServerNotificationRecipient,
  getServerOrderNotificationLogs,
  getServerOrderNotificationLogById,
  checkPhoneDuplicateStatusPublic,
  getPhoneOrderHistoryForAdmin,
  getServerCatalog,
  upsertServerProduct,
  upsertServerProductsBatch,
  deleteServerProduct,
  upsertServerCategory,
  upsertServerCategoriesBatch,
  upsertServerLandingPage,
  deleteServerLandingPage,
  getServerLandingPage,
  updateServerWilaya,
  getServerSmtpVault,
  setServerSmtpVault,
  deleteOrArchiveServerOrder,
  getDeletedOrderIds,
  getOrderDeletionAuditLogs,
} from './src/server/fraudEngine';
import {
  getCarriersForAdminUI,
  updateCarrierConfigOnServer,
  testCarrierConnectionOnServer,
  createCarrierShipmentOnServer,
  runCarrierAdaptersDiagnosticSuite,
  getGuepexDeliveryTariff,
  normalizeGuepexDeliveryChoice,
  isMaskedPlaceholder,
} from './src/server/carrierService';
import { DeliveryServiceType, OrderNotificationLog } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTHORIZED_ADMIN_HASHES = new Set([
  '0eff30316afbff492b7c5a16adf1e742841f70cc6e2179ac2aa0d813c36834df',
  '6051fc84a7a0d74c225fb18a496b09952da5642e60723ecae543298edd7d82d6',
]);
const AUTHORIZED_ADMIN_IDENTIFIERS = new Set(['admin', 'ouaredomar@gmail.com', 'dzmahall']);

// Server-side idempotency registry to prevent duplicate emails for the same order
const processedOrderAlertKeys = new Map<string, { sentAt: string; recipients: string[] }>();

const SMTP_OVERRIDE_FILE = path.join(process.cwd(), '.aistudio', 'smtp-config.json');

// Clé de chiffrement serveur AES-256-GCM dérivée par KDF (le mot de passe SMTP n'est jamais stocké en clair sur disque)
const SMTP_VAULT_KDF_KEY = crypto.scryptSync(
  'dzmahall-smtp-vault-aes256gcm-v1::0eff30316afbff492b7c5a16adf1e742841f70cc6e2179ac2aa0d813c36834df',
  'dzmahall-server-salt-2026',
  32
);

function encryptSmtpSecret(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SMTP_VAULT_KDF_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSmtpSecret(payload?: string): string {
  if (!payload || typeof payload !== 'string') return '';
  try {
    if (!payload.startsWith('v1:')) {
      return '';
    }
    const parts = payload.split(':');
    if (parts.length !== 4) return '';
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', SMTP_VAULT_KDF_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

interface PersistedSmtpOverride {
  smtpPass?: string; // Uniquement en mémoire après déchiffrement, jamais écrit en clair sur disque
  smtpPassEncrypted?: string; // Chiffré AES-256-GCM sur disque
  smtpUser?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpFrom?: string;
  explicitlyDeleted?: boolean;
  deletedAt?: string;
  updatedAt?: string;
}

function writeRawSmtpVaultToDisk(diskPayload: PersistedSmtpOverride) {
  const sanitizedForDisk: PersistedSmtpOverride = {
    ...diskPayload,
  };
  delete sanitizedForDisk.smtpPass; // Garantit qu'aucun secret en clair n'est jamais écrit sur disque

  try {
    const dir = path.dirname(SMTP_OVERRIDE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SMTP_OVERRIDE_FILE, JSON.stringify(sanitizedForDisk, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write SMTP config file:', err);
  }

  try {
    setServerSmtpVault(sanitizedForDisk as Record<string, any>);
  } catch (err) {
    console.warn('Could not mirror SMTP vault to server state:', err);
  }
}

function loadSmtpOverride(): PersistedSmtpOverride {
  let fileData: PersistedSmtpOverride | null = null;
  let needsMigration = false;

  try {
    if (fs.existsSync(SMTP_OVERRIDE_FILE)) {
      fileData = JSON.parse(fs.readFileSync(SMTP_OVERRIDE_FILE, 'utf-8')) || null;
    }
  } catch {
    fileData = null;
  }

  const backupVault = getServerSmtpVault() as PersistedSmtpOverride | null;

  let chosen: PersistedSmtpOverride | null = null;
  if (fileData && backupVault) {
    const tFile = fileData.updatedAt ? new Date(fileData.updatedAt).getTime() : 0;
    const tBackup = backupVault.updatedAt ? new Date(backupVault.updatedAt).getTime() : 0;
    chosen = tFile >= tBackup ? fileData : backupVault;
  } else {
    chosen = fileData || backupVault;
  }

  if (!chosen || typeof chosen !== 'object') {
    return {};
  }

  if (chosen.explicitlyDeleted) {
    return {
      explicitlyDeleted: true,
      deletedAt: chosen.deletedAt,
      updatedAt: chosen.updatedAt,
    };
  }

  let decryptedPass = '';
  if (chosen.smtpPassEncrypted) {
    decryptedPass = decryptSmtpSecret(chosen.smtpPassEncrypted);
  } else if (typeof chosen.smtpPass === 'string' && chosen.smtpPass.trim() !== '') {
    // Migration automatique d'un ancien mot de passe en clair vers AES-256-GCM
    decryptedPass = chosen.smtpPass.trim();
    chosen.smtpPassEncrypted = encryptSmtpSecret(decryptedPass);
    delete chosen.smtpPass;
    needsMigration = true;
  }

  if (needsMigration || (!fileData && backupVault)) {
    writeRawSmtpVaultToDisk(chosen);
  }

  return {
    smtpHost: chosen.smtpHost,
    smtpPort: chosen.smtpPort,
    smtpSecure: chosen.smtpSecure,
    smtpUser: chosen.smtpUser,
    smtpFrom: chosen.smtpFrom,
    smtpPass: decryptedPass || undefined,
    smtpPassEncrypted: chosen.smtpPassEncrypted,
    explicitlyDeleted: false,
    updatedAt: chosen.updatedAt,
  };
}

function saveSmtpOverride(updates: {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpFrom?: string;
  smtpPass?: string;
}) {
  const existing = loadSmtpOverride();
  const nowIso = new Date().toISOString();

  // Si un nouveau mot de passe non vide est fourni, on le chiffre ; sinon on conserve le secret existant (sauf si l'état précédent était supprimé)
  const effectivePass =
    updates.smtpPass !== undefined && updates.smtpPass.trim() !== ''
      ? updates.smtpPass.trim()
      : !existing.explicitlyDeleted
      ? existing.smtpPass
      : undefined;

  const encryptedPass = effectivePass ? encryptSmtpSecret(effectivePass) : undefined;

  const nextVault: PersistedSmtpOverride = {
    smtpHost: updates.smtpHost ?? existing.smtpHost ?? 'smtp.gmail.com',
    smtpPort: updates.smtpPort ?? existing.smtpPort ?? 465,
    smtpSecure: updates.smtpSecure ?? existing.smtpSecure ?? true,
    smtpUser: updates.smtpUser ?? existing.smtpUser,
    smtpFrom: updates.smtpFrom ?? existing.smtpFrom,
    ...(encryptedPass ? { smtpPassEncrypted: encryptedPass } : {}),
    explicitlyDeleted: false,
    updatedAt: nowIso,
  };

  writeRawSmtpVaultToDisk(nextVault);
}

function deleteSmtpConfigurationOnServer(): void {
  const nowIso = new Date().toISOString();
  const deletedVault: PersistedSmtpOverride = {
    explicitlyDeleted: true,
    deletedAt: nowIso,
    updatedAt: nowIso,
  };

  writeRawSmtpVaultToDisk(deletedVault);

  lastSmtpVerifyState = {
    status: 'not_tested',
    message: 'Configuration SMTP Gmail supprimée par l’administrateur.',
  };
}

let lastSmtpVerifyState: {
  status: 'verified' | 'auth_failed' | 'network_error' | 'not_tested';
  message?: string;
} = { status: 'not_tested' };

function stripSurroundingQuotes(val: string): string {
  return val.trim().replace(/^['"]+|['"]+$/g, '').trim();
}

export function parseSanitizedSmtpConfig() {
  const override = loadSmtpOverride();

  // Cas 1 : Suppression explicite par l'administrateur -> Configuration SMTP non configurée
  // Ne réutilise jamais les variables d'environnement par défaut tant que l'administrateur n'a pas reconfiguré SMTP
  if (override.explicitlyDeleted) {
    return {
      explicitlyDeleted: true,
      configState: 'not_configured' as const,
      statusLabel: 'Configuration SMTP non configurée',
      passwordStatusLabel: 'Aucun mot de passe SMTP enregistré',
      smtpHost: '',
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: '',
      smtpPass: '',
      smtpFrom: '',
      passDefined: false,
      passLength: 0,
      isValidAppPasswordFormat: false,
      authWarning: undefined,
      updatedAt: override.updatedAt,
    };
  }

  const rawHost = override.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpHost = stripSurroundingQuotes(rawHost) || 'smtp.gmail.com';

  // Nettoyage robuste de SMTP_PORT même si la variable contient du texte explicatif (ex: "465 (ou 587)")
  const rawPortStr = String(override.smtpPort ?? process.env.SMTP_PORT ?? '465').trim();
  const portMatch = rawPortStr.match(/\b(465|587|2525|25)\b/);
  const smtpPort = portMatch ? Number(portMatch[1]) : 465;

  // Nettoyage robuste de SMTP_SECURE : port 465 implique TLS implicite (secure = true)
  const rawSecureStr = String(override.smtpSecure ?? process.env.SMTP_SECURE ?? 'true')
    .trim()
    .toLowerCase();
  const smtpSecure =
    smtpPort === 465 ? true : rawSecureStr.startsWith('true') || rawSecureStr === '1';

  const rawUser = override.smtpUser || process.env.SMTP_USER || 'ouaredomar@gmail.com';
  const smtpUser = stripSurroundingQuotes(rawUser) || 'ouaredomar@gmail.com';

  // Résolution sécurisée de SMTP_PASS :
  // 1. Priorité absolue au secret chiffré enregistré par l'administrateur dans le coffre serveur
  // 2. Sinon, utilisation de process.env.SMTP_PASS uniquement s'il est défini
  const vaultPass =
    override.smtpPass !== undefined && override.smtpPass !== ''
      ? stripSurroundingQuotes(override.smtpPass).replace(/\s+/g, '')
      : '';
  const envPass = process.env.SMTP_PASS
    ? stripSurroundingQuotes(process.env.SMTP_PASS).replace(/\s+/g, '')
    : '';

  // Si process.env.SMTP_PASS contient un vrai mot de passe d'application de 16 caractères et que le coffre est vide, on le persiste dans le coffre chiffré
  let smtpPass = vaultPass;
  if (!smtpPass && envPass) {
    if (/^[a-z0-9]{16}$/i.test(envPass)) {
      smtpPass = envPass;
      saveSmtpOverride({
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass: envPass,
      });
    } else if (!override.updatedAt) {
      // process.env.SMTP_PASS est présent mais invalide (ex: 12 caractères au lieu de 16)
      smtpPass = envPass;
    }
  }

  const rawFrom =
    override.smtpFrom || process.env.SMTP_FROM || `DZMahall <${smtpUser}>`;
  const cleanedFrom = stripSurroundingQuotes(rawFrom).replace(/"DZMahall"/g, 'DZMahall');
  const smtpFrom = cleanedFrom.includes('<')
    ? cleanedFrom
    : `${cleanedFrom ? `${cleanedFrom} ` : 'DZMahall '}<${smtpUser}>`;

  const isGmail = smtpHost.toLowerCase().includes('gmail.com');
  const passDefined = smtpPass.length > 0;
  const passLength = smtpPass.length;
  const isValidAppPasswordFormat =
    !isGmail || (passLength === 16 && /^[a-z0-9]{16}$/i.test(smtpPass));

  let authWarning: string | undefined = undefined;
  if (isGmail && passDefined && !isValidAppPasswordFormat) {
    authWarning = `Attention : Le secret SMTP_PASS actuel contient ${passLength} caractères (au lieu des 16 lettres obligatoires d'un Mot de passe d'application Google). Gmail refuse les mots de passe classiques avec l'erreur « 535-5.7.8 Username and Password not accepted ». Enregistrez un mot de passe d'application Google de 16 caractères ci-dessous pour le remplacer durablement.`;
  }

  const isFullyConfigured =
    Boolean(smtpHost) &&
    Boolean(smtpUser) &&
    Boolean(smtpFrom) &&
    passDefined &&
    isValidAppPasswordFormat;

  const configState: 'configured' | 'incomplete' | 'not_configured' = isFullyConfigured
    ? 'configured'
    : smtpHost || smtpUser || passDefined
    ? 'incomplete'
    : 'not_configured';

  const statusLabel =
    configState === 'configured'
      ? 'Configuration SMTP configurée'
      : configState === 'incomplete'
      ? 'Configuration SMTP incomplète'
      : 'Configuration SMTP non configurée';

  const passwordStatusLabel =
    passDefined && isValidAppPasswordFormat
      ? 'Mot de passe SMTP enregistré'
      : passDefined && !isValidAppPasswordFormat
      ? `Mot de passe SMTP invalide (${passLength}/16 caractères)`
      : 'Mot de passe SMTP non enregistré';

  return {
    explicitlyDeleted: false,
    configState,
    statusLabel,
    passwordStatusLabel,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom,
    passDefined,
    passLength,
    isValidAppPasswordFormat,
    authWarning,
    updatedAt: override.updatedAt,
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function isValidEmailAddress(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length <= 254 && EMAIL_REGEX.test(trimmed);
}

interface EmailProviderConfig {
  configured: boolean;
  configState: 'configured' | 'incomplete' | 'not_configured';
  statusLabel: string;
  passwordStatusLabel: string;
  explicitlyDeleted: boolean;
  provider: 'smtp' | 'resend' | 'brevo' | 'none';
  providerLabel: string;
  senderEmail: string;
  smtpFrom?: string;
  missingVars: string[];
  setupInstructions: string[];
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  passDefined?: boolean;
  passLength?: number;
  isValidAppPasswordFormat?: boolean;
  authWarning?: string;
  lastVerifyStatus?: 'verified' | 'auth_failed' | 'network_error' | 'not_tested';
  lastVerifyMessage?: string;
  updatedAt?: string;
}

function getEmailProviderConfig(): EmailProviderConfig {
  const smtp = parseSanitizedSmtpConfig();

  if (smtp.explicitlyDeleted || smtp.configState === 'not_configured') {
    return {
      configured: false,
      configState: 'not_configured',
      statusLabel: 'Configuration SMTP non configurée',
      passwordStatusLabel: 'Aucun mot de passe SMTP enregistré',
      explicitlyDeleted: Boolean(smtp.explicitlyDeleted),
      provider: 'none',
      providerLabel: 'Configuration SMTP non configurée (Envoi d’e-mails désactivé)',
      senderEmail: '',
      smtpFrom: '',
      missingVars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
      setupInstructions: [
        'La configuration SMTP Gmail a été supprimée ou n’est pas configurée.',
        'L’envoi automatique des e-mails est interrompu tant qu’une nouvelle configuration SMTP Gmail complète n’est pas enregistrée ci-dessous.',
      ],
      smtpHost: '',
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: '',
      passDefined: false,
      passLength: 0,
      isValidAppPasswordFormat: false,
      lastVerifyStatus: lastSmtpVerifyState.status,
      lastVerifyMessage: lastSmtpVerifyState.message,
      updatedAt: smtp.updatedAt,
    };
  }

  if (smtp.configState === 'configured') {
    return {
      configured: true,
      configState: 'configured',
      statusLabel: smtp.statusLabel,
      passwordStatusLabel: smtp.passwordStatusLabel,
      explicitlyDeleted: false,
      provider: 'smtp',
      providerLabel: `Gmail SMTP (${smtp.smtpHost}:${smtp.smtpPort} • ${
        smtp.smtpSecure ? 'SSL/TLS' : 'STARTTLS'
      })`,
      senderEmail: smtp.smtpFrom,
      smtpFrom: smtp.smtpFrom,
      missingVars: [],
      setupInstructions: [],
      smtpHost: smtp.smtpHost,
      smtpPort: smtp.smtpPort,
      smtpSecure: smtp.smtpSecure,
      smtpUser: smtp.smtpUser,
      passDefined: true,
      passLength: smtp.passLength,
      isValidAppPasswordFormat: true,
      authWarning: undefined,
      lastVerifyStatus: lastSmtpVerifyState.status,
      lastVerifyMessage: lastSmtpVerifyState.message,
      updatedAt: smtp.updatedAt,
    };
  }

  const missingVars: string[] = [];
  if (!smtp.smtpHost) missingVars.push('SMTP_HOST');
  if (!smtp.smtpUser) missingVars.push('SMTP_USER');
  if (!smtp.passDefined || !smtp.isValidAppPasswordFormat) missingVars.push('SMTP_PASS');

  return {
    configured: false,
    configState: 'incomplete',
    statusLabel: smtp.statusLabel,
    passwordStatusLabel: smtp.passwordStatusLabel,
    explicitlyDeleted: false,
    provider: 'none',
    providerLabel: 'Configuration SMTP incomplète — Mot de passe d’application Google (16 caractères) requis',
    senderEmail: smtp.smtpFrom,
    smtpFrom: smtp.smtpFrom,
    missingVars,
    setupInstructions: [
      ...(smtp.authWarning ? [smtp.authWarning] : []),
      `Serveur pré-configuré sur Gmail SMTP : SMTP_HOST="${smtp.smtpHost}", SMTP_PORT="${smtp.smtpPort}", SMTP_SECURE="${smtp.smtpSecure}", SMTP_USER="${smtp.smtpUser}", SMTP_FROM="${smtp.smtpFrom}".`,
      'Pour activer l’envoi Gmail : générez un Mot de passe d’application Google de 16 lettres sur https://myaccount.google.com/apppasswords et enregistrez-le ci-dessous.',
    ],
    smtpHost: smtp.smtpHost,
    smtpPort: smtp.smtpPort,
    smtpSecure: smtp.smtpSecure,
    smtpUser: smtp.smtpUser,
    passDefined: smtp.passDefined,
    passLength: smtp.passLength,
    isValidAppPasswordFormat: smtp.isValidAppPasswordFormat,
    authWarning: smtp.authWarning,
    lastVerifyStatus: lastSmtpVerifyState.status,
    lastVerifyMessage: lastSmtpVerifyState.message,
    updatedAt: smtp.updatedAt,
  };
}

function verifyAdminRequest(req: Request): boolean {
  const adminUserHeader = String(req.headers['x-dzmahall-admin-user'] || '').trim().toLowerCase();
  const adminHashHeader = String(req.headers['x-dzmahall-admin-hash'] || '').trim().toLowerCase();
  const adminRoleHeader = String(req.headers['x-dzmahall-admin-role'] || '').trim().toLowerCase();

  if (!adminUserHeader || !['admin', 'manager', 'operator'].includes(adminRoleHeader)) {
    return false;
  }

  if (adminHashHeader && !AUTHORIZED_ADMIN_HASHES.has(adminHashHeader)) {
    return false;
  }

  if (AUTHORIZED_ADMIN_IDENTIFIERS.has(adminUserHeader)) {
    return true;
  }

  if (adminHashHeader && AUTHORIZED_ADMIN_HASHES.has(adminHashHeader)) {
    return true;
  }

  return false;
}

/**
 * Vérification stricte réservée exclusivement au rôle 'admin' (interdit 'manager', 'operator' et visiteurs).
 * Utilisée notamment pour la suppression ou l'archivage de commandes COD.
 */
function verifyStrictAdminRole(req: Request): boolean {
  const adminUserHeader = String(req.headers['x-dzmahall-admin-user'] || '').trim().toLowerCase();
  const adminHashHeader = String(req.headers['x-dzmahall-admin-hash'] || '').trim().toLowerCase();
  const adminRoleHeader = String(req.headers['x-dzmahall-admin-role'] || '').trim().toLowerCase();

  if (!adminUserHeader || adminRoleHeader !== 'admin') {
    return false;
  }

  if (adminHashHeader && !AUTHORIZED_ADMIN_HASHES.has(adminHashHeader)) {
    return false;
  }

  return (
    AUTHORIZED_ADMIN_IDENTIFIERS.has(adminUserHeader) ||
    (Boolean(adminHashHeader) && AUTHORIZED_ADMIN_HASHES.has(adminHashHeader))
  );
}

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDzd(amount: unknown): string {
  const num = Number(amount || 0);
  return `${num.toLocaleString('fr-DZ')} DZD`;
}

function formatAlgerianDateTime(isoString?: string): string {
  try {
    const date = isoString ? new Date(isoString) : new Date();
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: 'Africa/Algiers',
    }).format(date);
  } catch {
    return isoString || new Date().toISOString();
  }
}

interface OrderEmailPayload {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  wilayaCode: string;
  wilayaName: string;
  commune: string;
  deliveryAddress?: string;
  deliveryMode: 'home' | 'desk';
  deskName?: string;
  items: {
    productId: string;
    productName: string;
    variantId?: string;
    variantName?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  subtotal: number;
  shippingCost: number;
  shippingFee?: number;
  totalAmount: number;
  carrierName?: string;
  shippingCompanyNameSnapshot?: string;
  landingPageId?: string;
  landingPageSlug?: string;
  landingPageTitle?: string;
  notes?: string;
}

function buildOrderAlertEmail(order: OrderEmailPayload): {
  subject: string;
  html: string;
  text: string;
  sourceLabel: string;
} {
  const subject = `[DZMahall] Nouvelle commande #${order.orderNumber}`;
  const formattedDate = formatAlgerianDateTime(order.createdAt);
  const isLandingPage = Boolean(order.landingPageId || order.landingPageSlug || order.landingPageTitle);
  const sourceLabel = isLandingPage
    ? `Landing Page${order.landingPageTitle ? ` — « ${order.landingPageTitle} »` : ''}${order.landingPageSlug ? ` (/lp/${order.landingPageSlug})` : ''}`
    : 'Boutique publique DZMahall';

  const deliveryModeLabel =
    order.deliveryMode === 'desk' ? 'Point Relais / Stop Desk' : 'Livraison à Domicile';
  const addressDisplay =
    order.deliveryMode === 'desk'
      ? order.deskName || order.deliveryAddress || `Agence Stop Desk (${order.commune})`
      : order.deliveryAddress || `${order.commune}, ${order.wilayaName}`;
  const shippingCostVal =
    typeof order.shippingFee === 'number' ? order.shippingFee : Number(order.shippingCost || 0);
  const carrierDisplay =
    order.shippingCompanyNameSnapshot || order.carrierName || 'Yalidine Fast Logistics';

  const itemsHtmlRows = (order.items || [])
    .map((item) => {
      const variantBadge = item.variantName
        ? `<div style="margin-top:4px;display:inline-block;background:#FFF4EC;color:#FF6500;border:1px solid #FFD8BE;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;">Variante : ${escapeHtml(item.variantName)}</div>`
        : '';
      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#212B36;font-weight:600;">
            <div>${escapeHtml(item.productName)}</div>
            ${variantBadge}
          </td>
          <td style="padding:12px 10px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#212B36;text-align:center;font-weight:700;">
            ×${Number(item.quantity || 1)}
          </td>
          <td style="padding:12px 10px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#637381;text-align:right;white-space:nowrap;">
            ${formatDzd(item.unitPrice)}
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#212B36;text-align:right;font-weight:800;white-space:nowrap;">
            ${formatDzd(item.totalPrice || item.unitPrice * item.quantity)}
          </td>
        </tr>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F6F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#212B36;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F6F8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #DFE3E8;box-shadow:0 4px 12px rgba(33,43,54,0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#212B36 0%,#004C3F 100%);padding:24px 28px;color:#FFFFFF;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display:inline-block;background-color:#FF6500;color:#FFFFFF;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;padding:4px 10px;border-radius:6px;">
                      Nouvelle Commande COD
                    </span>
                    <h1 style="margin:10px 0 4px 0;font-size:22px;font-weight:900;color:#FFFFFF;">
                      Commande #${escapeHtml(order.orderNumber)}
                    </h1>
                    <p style="margin:0;font-size:12px;color:#CBD5E1;">
                      Reçue le ${escapeHtml(formattedDate)}
                    </p>
                  </td>
                  <td align="right" valign="top">
                    <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:8px 12px;text-align:right;">
                      <div style="font-size:10px;text-transform:uppercase;color:#CBD5E1;font-weight:700;">Total à encaisser</div>
                      <div style="font-size:16px;font-weight:900;color:#FF6500;">${formatDzd(order.totalAmount)}</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Source Banner -->
          <tr>
            <td style="background-color:#FFF4EC;border-bottom:1px solid #FFD8BE;padding:10px 28px;font-size:12px;color:#9A3412;">
              <strong>Origine de la commande :</strong> ${escapeHtml(sourceLabel)} &nbsp;|&nbsp;
              <strong>Transporteur :</strong> ${escapeHtml(carrierDisplay)}
            </td>
          </tr>

          <!-- Customer & Delivery Details -->
          <tr>
            <td style="padding:24px 28px 12px 28px;">
              <h2 style="margin:0 0 12px 0;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#004C3F;">
                1. Coordonnées du Client & Livraison
              </h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;">
                <tr>
                  <td style="padding:6px 8px;font-size:13px;color:#637381;width:38%;">Nom complet :</td>
                  <td style="padding:6px 8px;font-size:13px;color:#212B36;font-weight:800;">${escapeHtml(order.customerName)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 8px;font-size:13px;color:#637381;">Téléphone :</td>
                  <td style="padding:6px 8px;font-size:14px;color:#FF6500;font-weight:900;">
                    <a href="tel:${escapeHtml(order.customerPhone)}" style="color:#FF6500;text-decoration:none;">
                      ${escapeHtml(order.customerPhone)}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 8px;font-size:13px;color:#637381;">Wilaya & Commune :</td>
                  <td style="padding:6px 8px;font-size:13px;color:#212B36;font-weight:700;">
                    Wilaya ${escapeHtml(order.wilayaCode)} — ${escapeHtml(order.wilayaName)} / ${escapeHtml(order.commune)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 8px;font-size:13px;color:#637381;">Mode de livraison :</td>
                  <td style="padding:6px 8px;font-size:13px;color:#212B36;font-weight:700;">${escapeHtml(deliveryModeLabel)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 8px;font-size:13px;color:#637381;">Adresse / Stop Desk :</td>
                  <td style="padding:6px 8px;font-size:13px;color:#212B36;font-weight:600;">${escapeHtml(addressDisplay)}</td>
                </tr>
                ${
                  order.notes
                    ? `<tr>
                        <td style="padding:6px 8px;font-size:13px;color:#637381;">Note du client :</td>
                        <td style="padding:6px 8px;font-size:13px;color:#212B36;font-style:italic;">${escapeHtml(order.notes)}</td>
                      </tr>`
                    : ''
                }
              </table>
            </td>
          </tr>

          <!-- Ordered Items Table -->
          <tr>
            <td style="padding:16px 28px;">
              <h2 style="margin:0 0 12px 0;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#004C3F;">
                2. Détail des Articles Commandés
              </h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
                <thead>
                  <tr style="background-color:#F1F5F9;">
                    <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;">Produit & Variante</th>
                    <th style="padding:10px 10px;text-align:center;font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;">Qté</th>
                    <th style="padding:10px 10px;text-align:right;font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;">Prix Unit.</th>
                    <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtmlRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Financial Summary -->
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;">
                <tr>
                  <td style="padding:4px 8px;font-size:13px;color:#637381;">Sous-total articles :</td>
                  <td style="padding:4px 8px;font-size:13px;color:#212B36;font-weight:700;text-align:right;">${formatDzd(order.subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 8px;font-size:13px;color:#637381;">Frais de livraison (${escapeHtml(order.wilayaName)}) :</td>
                  <td style="padding:4px 8px;font-size:13px;color:#212B36;font-weight:700;text-align:right;">
                    ${shippingCostVal === 0 ? 'Livraison Gratuite (0 DZD)' : formatDzd(shippingCostVal)}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:8px 0;">
                    <div style="border-top:1px dashed #CBD5E1;"></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 8px;font-size:15px;color:#212B36;font-weight:900;">TOTAL À PAYER À LA LIVRAISON (COD) :</td>
                  <td style="padding:4px 8px;font-size:18px;color:#FF6500;font-weight:900;text-align:right;">${formatDzd(order.totalAmount)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F1F5F9;padding:16px 28px;text-align:center;font-size:11px;color:#64748B;border-top:1px solid #E2E8F0;">
              Notification automatique envoyée par <strong>DZMahall.store</strong> — Système de gestion des commandes COD Algérie (58 Wilayas).
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const itemsText = (order.items || [])
    .map(
      (it) =>
        `- ${it.productName}${it.variantName ? ` (${it.variantName})` : ''} | Qté: ${it.quantity} | PU: ${formatDzd(it.unitPrice)} | Total: ${formatDzd(it.totalPrice || it.unitPrice * it.quantity)}`
    )
    .join('\n');

  const text = `${subject}
Date/Heure : ${formattedDate}
Origine : ${sourceLabel}
Transporteur : ${carrierDisplay}

--- COORDONNÉES CLIENT & LIVRAISON ---
Client : ${order.customerName}
Téléphone : ${order.customerPhone}
Wilaya : ${order.wilayaCode} - ${order.wilayaName}
Commune : ${order.commune}
Mode de livraison : ${deliveryModeLabel}
Adresse / Stop Desk : ${addressDisplay}
${order.notes ? `Note : ${order.notes}\n` : ''}
--- PRODUITS COMMANDÉS ---
${itemsText}

--- RÉCAPITULATIF COD ---
Sous-total : ${formatDzd(order.subtotal)}
Frais de livraison : ${formatDzd(shippingCostVal)}
TOTAL À PAYER À LA LIVRAISON : ${formatDzd(order.totalAmount)}
`;

  return { subject, html, text, sourceLabel };
}

async function dispatchEmailViaConfiguredProvider({
  to,
  subject,
  html,
  text,
}: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{
  success: boolean;
  status: 'sent' | 'failed' | 'not_configured';
  provider: string;
  message: string;
  errorDetail?: string;
}> {
  const config = getEmailProviderConfig();

  if (!config.configured) {
    if (config.configState === 'not_configured') {
      return {
        success: false,
        status: 'not_configured',
        provider: 'none',
        message:
          "Envoi d'e-mail interrompu : Configuration SMTP non configurée. Veuillez enregistrer une configuration SMTP Gmail dans l'administration.",
        errorDetail:
          "La configuration SMTP Gmail a été supprimée ou n'est pas configurée. Aucun e-mail ne peut être expédié tant que les paramètres SMTP ne sont pas rétablis.",
      };
    }
    return {
      success: false,
      status: 'not_configured',
      provider: 'smtp',
      message:
        'Configuration SMTP incomplète : le mot de passe d’application Google de 16 caractères (SMTP_PASS) est requis.',
      errorDetail: `Variables manquantes ou incomplètes : ${config.missingVars.join(', ')}. Configurez votre Mot de passe d'application Google de 16 caractères pour ${config.smtpUser || 'ouaredomar@gmail.com'}.`,
    };
  }

  try {
    // Envoi exclusif via Gmail SMTP (smtp.gmail.com) avec Nodemailer
    const smtp = parseSanitizedSmtpConfig();

    const transporter = nodemailer.createTransport({
      host: smtp.smtpHost,
      port: smtp.smtpPort,
      secure: smtp.smtpSecure,
      auth: {
        user: smtp.smtpUser,
        pass: smtp.smtpPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    await transporter.sendMail({
      from: smtp.smtpFrom,
      to: to.join(', '),
      subject,
      text,
      html,
    });

    lastSmtpVerifyState = {
      status: 'verified',
      message: `Authentification Gmail SMTP réussie sur ${smtp.smtpHost}:${smtp.smtpPort} (${
        smtp.smtpSecure ? 'SSL/TLS' : 'STARTTLS'
      }) pour ${smtp.smtpUser}.`,
    };

    return {
      success: true,
      status: 'sent',
      provider: 'smtp',
      message: `E-mail envoyé avec succès via Gmail SMTP (${smtp.smtpHost}:${smtp.smtpPort}) à ${to.length} destinataire(s).`,
    };
  } catch (err: any) {
    const rawMsg = err?.message || String(err);
    const isGmailAuthErr =
      rawMsg.includes('535') ||
      rawMsg.includes('5.7.8') ||
      rawMsg.includes('Username and Password not accepted') ||
      err?.code === 'EAUTH';

    const smtp = parseSanitizedSmtpConfig();
    let actionableDetail = rawMsg;

    if (isGmailAuthErr) {
      actionableDetail =
        `Refus d'authentification Gmail SMTP (535-5.7.8) sur ${smtp.smtpHost}:${smtp.smtpPort} pour le compte ${smtp.smtpUser}. ` +
        (smtp.passLength !== 16
          ? `Cause identifiée : la variable SMTP_PASS actuelle contient ${smtp.passLength} caractères au lieu des 16 lettres obligatoires d'un « Mot de passe d'application Google ». `
          : `Cause : le mot de passe d'application fourni n'est pas reconnu ou a été révoqué par Google. `) +
        `Gmail n'accepte jamais le mot de passe habituel du compte. Générez un Mot de passe d'application de 16 lettres sur https://myaccount.google.com/apppasswords (compte ${smtp.smtpUser}) et mettez à jour SMTP_PASS.`;
      lastSmtpVerifyState = {
        status: 'auth_failed',
        message: actionableDetail,
      };
    } else {
      lastSmtpVerifyState = {
        status: 'network_error',
        message: rawMsg,
      };
    }

    return {
      success: false,
      status: 'failed',
      provider: config.provider,
      message: isGmailAuthErr
        ? `Échec d'authentification Gmail SMTP (535-5.7.8) : Mot de passe d'application Google de 16 caractères requis.`
        : `Erreur lors de l'envoi de l'e-mail (${config.providerLabel}).`,
      errorDetail: actionableDetail,
    };
  }
}

/**
 * Exécute l'envoi de la notification e-mail d'une commande de manière 100% indépendante (PARTIE 3).
 * Ne lance jamais d'exception et met à jour uniquement l'état de notification (notificationStatus)
 * sans jamais annuler ni modifier le statut commercial de la commande.
 */
async function executeIndependentOrderNotification(
  order: OrderEmailPayload,
  rawRecipients?: any[],
  forceRetry = false,
  simulateSmtpError = false
) {
  const now = new Date().toISOString();
  const idempotencyKey = `${order.id}::${order.orderNumber}`;
  const existingLog = getServerOrderNotificationLogById(order.id);

  if (!forceRetry && (processedOrderAlertKeys.has(idempotencyKey) || existingLog?.status === 'sent')) {
    const prevRecipients =
      processedOrderAlertKeys.get(idempotencyKey)?.recipients || existingLog?.recipients || [];
    return {
      success: true,
      status: 'duplicate_prevented' as const,
      provider: getEmailProviderConfig().provider,
      message: `Notification déjà envoyée pour la commande #${order.orderNumber} (anti-doublon actif).`,
      recipients: prevRecipients,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  }

  // Utiliser les destinataires fournis ou ceux persistés sur le serveur
  const candidateRecipients =
    Array.isArray(rawRecipients) && rawRecipients.length > 0
      ? rawRecipients
      : getServerNotificationRecipients();

  const activeEmails: string[] = Array.from(
    new Set<string>(
      candidateRecipients
        .filter((r: any) => {
          if (typeof r === 'string') return isValidEmailAddress(r);
          return (
            r &&
            r.isActive !== false &&
            r.notifyOnNewOrder !== false &&
            isValidEmailAddress(r.email)
          );
        })
        .map((r: any): string =>
          typeof r === 'string'
            ? r.trim().toLowerCase()
            : String(r.email).trim().toLowerCase()
        )
    )
  );

  const { subject, html, text, sourceLabel } = buildOrderAlertEmail(order);

  if (activeEmails.length === 0) {
    const logEntry: OrderNotificationLog = {
      id: order.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      wilayaName: `${order.wilayaCode} - ${order.wilayaName}`,
      commune: order.commune,
      totalAmount: order.totalAmount,
      sourceLabel,
      subject,
      recipients: [],
      status: 'skipped_no_recipients',
      provider: getEmailProviderConfig().provider,
      message: 'Aucune adresse e-mail destinataire active configurée.',
      attemptsCount: (existingLog?.attemptsCount || 0) + 1,
      createdAt: existingLog?.createdAt || now,
      updatedAt: now,
    };
    updateServerOrderNotificationStatus(order.id, 'skipped_no_recipients', undefined, logEntry);
    return {
      success: false,
      status: 'skipped_no_recipients' as const,
      provider: logEntry.provider,
      subject,
      sourceLabel,
      recipients: [],
      message: logEntry.message,
      logEntry,
    };
  }

  // Support de simulation d'erreur SMTP (Test obligatoire #6)
  const dispatchResult = simulateSmtpError
    ? {
        success: false,
        status: 'failed' as const,
        provider: 'smtp',
        message: 'Erreur SMTP simulée (Test de non-régression #6 : la commande reste enregistrée).',
        errorDetail: 'Simulated SMTP 535 / Connection failure during order notification dispatch',
      }
    : await dispatchEmailViaConfiguredProvider({
        to: activeEmails,
        subject,
        html,
        text,
      });

  if (dispatchResult.success) {
    processedOrderAlertKeys.set(idempotencyKey, {
      sentAt: now,
      recipients: activeEmails,
    });
  }

  const logEntry: OrderNotificationLog = {
    id: order.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    wilayaName: `${order.wilayaCode} - ${order.wilayaName}`,
    commune: order.commune,
    totalAmount: order.totalAmount,
    sourceLabel,
    subject,
    recipients: activeEmails,
    status: dispatchResult.status,
    provider: dispatchResult.provider,
    message: dispatchResult.message,
    errorDetail: dispatchResult.errorDetail,
    attemptsCount: (existingLog?.attemptsCount || 0) + 1,
    createdAt: existingLog?.createdAt || now,
    updatedAt: now,
  };

  updateServerOrderNotificationStatus(
    order.id,
    dispatchResult.status,
    dispatchResult.errorDetail,
    logEntry
  );

  return {
    ...dispatchResult,
    subject,
    sourceLabel,
    recipients: activeEmails,
    orderId: order.id,
    orderNumber: order.orderNumber,
    processedAt: now,
    logEntry,
  };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // 1. Check server-side email configuration status (Admin only)
  app.get('/api/notifications/config-status', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      res.status(403).json({
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }

    const config = getEmailProviderConfig();
    res.json(config);
  });

  // 1b. Update server-side SMTP App Password or SMTP parameters securely (Admin only)
  // Un champ de mot de passe vide lors d'une modification ne supprime jamais le secret existant.
  app.post('/api/notifications/smtp-config', async (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      res.status(403).json({
        success: false,
        message: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }

    const rawPass = typeof req.body?.smtpPass === 'string' ? req.body.smtpPass : undefined;
    const isMaskedPass =
      rawPass !== undefined &&
      (isMaskedPlaceholder(rawPass) || /^[•*]+/.test(rawPass.trim()) || rawPass.includes('••••'));
    const cleanedPass =
      rawPass !== undefined && rawPass.trim() !== '' && !isMaskedPass
        ? stripSurroundingQuotes(rawPass).replace(/\s+/g, '')
        : undefined;

    const rawHost =
      typeof req.body?.smtpHost === 'string' && req.body.smtpHost.trim() !== ''
        ? stripSurroundingQuotes(req.body.smtpHost)
        : undefined;
    const rawUser =
      typeof req.body?.smtpUser === 'string' && req.body.smtpUser.trim() !== ''
        ? stripSurroundingQuotes(req.body.smtpUser)
        : undefined;
    const rawFrom =
      typeof req.body?.smtpFrom === 'string' && req.body.smtpFrom.trim() !== ''
        ? stripSurroundingQuotes(req.body.smtpFrom)
        : undefined;
    const rawPort =
      req.body?.smtpPort !== undefined ? Number(req.body.smtpPort) : undefined;
    const validPort = rawPort === 587 ? 587 : 465;
    const validSecure =
      req.body?.smtpSecure !== undefined
        ? Boolean(req.body.smtpSecure)
        : validPort === 465;
    const skipLiveVerify = Boolean(req.body?.skipLiveVerify);

    const currentOverride = loadSmtpOverride();
    const resolvedUser =
      rawUser ||
      (!currentOverride.explicitlyDeleted ? currentOverride.smtpUser : undefined) ||
      'ouaredomar@gmail.com';
    const resolvedFrom =
      rawFrom ||
      (!currentOverride.explicitlyDeleted ? currentOverride.smtpFrom : undefined) ||
      `DZMahall <${resolvedUser}>`;

    saveSmtpOverride({
      smtpHost: rawHost || currentOverride.smtpHost || 'smtp.gmail.com',
      smtpPort: rawPort ? validPort : currentOverride.smtpPort || 465,
      smtpSecure: rawPort ? validSecure : currentOverride.smtpSecure ?? true,
      smtpUser: resolvedUser,
      smtpFrom: resolvedFrom,
      ...(cleanedPass !== undefined ? { smtpPass: cleanedPass } : {}),
    });

    const smtp = parseSanitizedSmtpConfig();
    if (!smtp.passDefined) {
      res.json({
        success: true,
        saved: true,
        verified: false,
        status: smtp.configState,
        config: getEmailProviderConfig(),
        message:
          'Paramètres expéditeur enregistrés. Configuration SMTP incomplète : veuillez saisir le mot de passe d’application Google de 16 caractères pour activer l’envoi.',
      });
      return;
    }

    if (!smtp.isValidAppPasswordFormat) {
      lastSmtpVerifyState = {
        status: 'auth_failed',
        message: `Configuration SMTP incomplète : le mot de passe fourni contient ${smtp.passLength} caractères au lieu des 16 lettres d'un Mot de passe d'application Google.`,
      };
      res.json({
        success: false,
        saved: true,
        verified: false,
        status: smtp.configState,
        config: getEmailProviderConfig(),
        message: lastSmtpVerifyState.message,
      });
      return;
    }

    if (skipLiveVerify) {
      res.json({
        success: true,
        saved: true,
        verified: true,
        status: smtp.configState,
        config: getEmailProviderConfig(),
        message: `Configuration SMTP Gmail enregistrée de manière persistante et sécurisée pour ${smtp.smtpUser} (Mot de passe SMTP enregistré).`,
      });
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.smtpHost,
        port: smtp.smtpPort,
        secure: smtp.smtpSecure,
        auth: { user: smtp.smtpUser, pass: smtp.smtpPass },
        connectionTimeout: 7000,
      });
      await transporter.verify();
      lastSmtpVerifyState = {
        status: 'verified',
        message: `Configuration enregistrée et authentification Gmail SMTP (${smtp.smtpHost}:${smtp.smtpPort}) vérifiée avec succès pour ${smtp.smtpUser}.`,
      };
      res.json({
        success: true,
        saved: true,
        verified: true,
        status: smtp.configState,
        config: getEmailProviderConfig(),
        message: lastSmtpVerifyState.message,
      });
    } catch (err: any) {
      const rawMsg = err?.message || String(err);
      lastSmtpVerifyState = {
        status: 'auth_failed',
        message: `Configuration SMTP enregistrée de manière persistante (Mot de passe SMTP enregistré). Note : le test d'authentification en direct avec ${smtp.smtpHost}:${smtp.smtpPort} a retourné un refus (535-5.7.8). Vérifiez que le Mot de passe d'application de 16 lettres correspond bien au compte ${smtp.smtpUser}.`,
      };
      res.json({
        success: true,
        saved: true,
        verified: false,
        status: smtp.configState,
        config: getEmailProviderConfig(),
        message: lastSmtpVerifyState.message,
        errorDetail: rawMsg,
      });
    }
  });

  // 1b-delete. Explicitly delete all saved Gmail SMTP configuration and secrets (Admin only)
  app.delete('/api/notifications/smtp-config', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      res.status(403).json({
        success: false,
        message: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }

    deleteSmtpConfigurationOnServer();

    // Vérifier immédiatement que la suppression a réellement réussi et que la configuration n'est plus utilisable
    const afterConfig = getEmailProviderConfig();
    const verifiedDeleted =
      afterConfig.configState === 'not_configured' &&
      !afterConfig.configured &&
      !afterConfig.passDefined &&
      afterConfig.explicitlyDeleted === true;

    if (!verifiedDeleted) {
      res.status(500).json({
        success: false,
        verifiedDeleted: false,
        config: afterConfig,
        message: 'La vérification de la suppression de la configuration SMTP a échoué.',
      });
      return;
    }

    res.json({
      success: true,
      verifiedDeleted: true,
      status: 'not_configured',
      config: afterConfig,
      message:
        'La configuration SMTP Gmail et le mot de passe enregistré ont été supprimés avec succès. L’envoi d’e-mails est interrompu jusqu’à une nouvelle configuration.',
    });
  });

  // 1c. Test SMTP handshake & authentication without sending an email (Admin only)
  // Ne divulgue jamais le mot de passe SMTP dans la réponse ou les journaux.
  app.post('/api/notifications/verify-smtp', async (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      res.status(403).json({
        success: false,
        message: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }

    const smtp = parseSanitizedSmtpConfig();
    if (smtp.explicitlyDeleted || smtp.configState === 'not_configured') {
      res.json({
        success: false,
        status: 'not_configured',
        config: getEmailProviderConfig(),
        message:
          'Test impossible : Configuration SMTP non configurée. Veuillez enregistrer vos paramètres SMTP Gmail avant de tester la connexion.',
      });
      return;
    }

    if (!smtp.passDefined) {
      res.json({
        success: false,
        status: 'incomplete',
        config: getEmailProviderConfig(),
        message:
          'Test impossible : Configuration SMTP incomplète (aucun mot de passe SMTP_PASS enregistré).',
      });
      return;
    }

    if (!smtp.isValidAppPasswordFormat) {
      const detail = `Format de mot de passe invalide : SMTP_PASS contient ${smtp.passLength} caractères au lieu des 16 caractères requis pour un Mot de passe d'application Google (${smtp.smtpUser}).`;
      lastSmtpVerifyState = {
        status: 'auth_failed',
        message: detail,
      };
      res.json({
        success: false,
        status: 'auth_failed',
        config: getEmailProviderConfig(),
        message: detail,
      });
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.smtpHost,
        port: smtp.smtpPort,
        secure: smtp.smtpSecure,
        auth: { user: smtp.smtpUser, pass: smtp.smtpPass },
        connectionTimeout: 8000,
      });
      await transporter.verify();
      lastSmtpVerifyState = {
        status: 'verified',
        message: `Connexion TLS (${smtp.smtpHost}:${smtp.smtpPort}) et authentification Gmail validées pour ${smtp.smtpUser}.`,
      };
      res.json({
        success: true,
        status: 'verified',
        config: getEmailProviderConfig(),
        message: lastSmtpVerifyState.message,
      });
    } catch (err: any) {
      const rawMsg = err?.message || String(err);
      const detail = `Refus d'authentification Gmail SMTP (535-5.7.8) sur ${smtp.smtpHost}:${smtp.smtpPort} : Le mot de passe d'application de 16 caractères n'a pas été accepté par Google pour le compte ${smtp.smtpUser}. Vérifiez qu'il a bien été généré sur https://myaccount.google.com/apppasswords et qu'il n'a pas été révoqué.`;
      lastSmtpVerifyState = {
        status: 'auth_failed',
        message: detail,
      };
      res.json({
        success: false,
        status: 'auth_failed',
        config: getEmailProviderConfig(),
        message: detail,
        errorDetail: 'Code SMTP 535-5.7.8 Username and Password not accepted (secret masqué)',
      });
    }
  });

  // 1d. Server-backed notification recipients & logs endpoints (Admin only)
  app.get('/api/notifications/recipients', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    const logs = getServerOrderNotificationLogs();
    res.json({
      success: true,
      recipients: getServerNotificationRecipients(),
      logs,
      notificationLogs: logs,
    });
  });

  app.post('/api/notifications/recipients', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      res.status(403).json({ success: false, error: 'Accès refusé' });
      return;
    }

    try {
      // Support batch sync { recipients: [...] }, wrapped { recipient: {...} }, or direct {...}
      if (Array.isArray(req.body?.recipients)) {
        const savedBatch = [];
        for (const item of req.body.recipients) {
          if (item && isValidEmailAddress(String(item.email || ''))) {
            savedBatch.push(
              upsertServerNotificationRecipient({
                ...item,
                id: item.id || `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              })
            );
          }
        }
        const logs = getServerOrderNotificationLogs();
        res.json({
          success: true,
          savedCount: savedBatch.length,
          recipients: getServerNotificationRecipients(),
          logs,
          notificationLogs: logs,
        });
        return;
      }

      const rawRcpt =
        req.body?.recipient && typeof req.body.recipient === 'object'
          ? req.body.recipient
          : req.body;

      const cleanEmail = String(rawRcpt?.email || '').trim().toLowerCase();
      if (!rawRcpt || !isValidEmailAddress(cleanEmail)) {
        res.status(400).json({
          success: false,
          message: 'Adresse e-mail destinataire invalide.',
        });
        return;
      }

      const candidate = {
        ...rawRcpt,
        id:
          typeof rawRcpt.id === 'string' && rawRcpt.id.trim()
            ? rawRcpt.id.trim()
            : `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        email: cleanEmail,
      };

      const saved = upsertServerNotificationRecipient(candidate);
      const logs = getServerOrderNotificationLogs();
      res.json({
        success: true,
        recipient: saved,
        recipients: getServerNotificationRecipients(),
        logs,
        notificationLogs: logs,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Erreur serveur lors de la sauvegarde du destinataire.',
      });
    }
  });

  app.delete('/api/notifications/recipients/:id', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      res.status(403).json({ success: false, error: 'Accès refusé' });
      return;
    }
    const targetId = String(req.params.id || '').trim();
    const deleted = deleteServerNotificationRecipient(targetId);
    const logs = getServerOrderNotificationLogs();
    res.json({
      success: deleted,
      deletedId: targetId,
      recipients: getServerNotificationRecipients(),
      logs,
      notificationLogs: logs,
      message: deleted
        ? 'Adresse e-mail destinataire supprimée avec succès.'
        : 'Adresse destinataire introuvable.',
    });
  });

  // 2. Send a test email to one or more recipient addresses (Admin only)
  app.post('/api/notifications/send-test', async (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      res.status(403).json({
        success: false,
        status: 'unauthorized',
        message: 'Accès refusé : seuls les administrateurs autorisés peuvent envoyer un e-mail de test.',
      });
      return;
    }

    const rawRecipients: unknown[] = Array.isArray(req.body?.recipients)
      ? req.body.recipients
      : req.body?.email
      ? [req.body.email]
      : [];

    const validRecipients = Array.from(
      new Set(
        rawRecipients
          .map((r) => String(r || '').trim().toLowerCase())
          .filter((r) => isValidEmailAddress(r))
      )
    );

    if (validRecipients.length === 0) {
      res.status(400).json({
        success: false,
        status: 'invalid_recipients',
        message: 'Aucune adresse e-mail valide fournie pour le test.',
      });
      return;
    }

    const sampleOrder: OrderEmailPayload = {
      id: `test-${Date.now()}`,
      orderNumber: 'TEST-DZM-001',
      createdAt: new Date().toISOString(),
      customerName: 'Client Test DZMahall',
      customerPhone: '0550 12 34 56',
      wilayaCode: '16',
      wilayaName: 'Alger',
      commune: 'Bab Ezzouar',
      deliveryMode: 'home',
      deliveryAddress: 'Cité Universitaire / Quartier des Affaires, Bab Ezzouar',
      items: [
        {
          productId: 'prod-test-1',
          productName: 'Produit de démonstration DZMahall (E-mail de test)',
          variantName: 'Noir • Taille Standard',
          quantity: 1,
          unitPrice: 4500,
          totalPrice: 4500,
        },
      ],
      subtotal: 4500,
      shippingCost: 400,
      shippingFee: 400,
      totalAmount: 4900,
      carrierName: 'Yalidine Fast Logistics',
      notes: 'Ceci est un e-mail de test déclenché depuis l’administration DZMahall.',
    };

    const { html, text } = buildOrderAlertEmail(sampleOrder);
    const subject = '[DZMahall] E-mail de test — Configuration Notifications de commandes';

    const result = await dispatchEmailViaConfiguredProvider({
      to: validRecipients,
      subject,
      html,
      text,
    });

    res.status(200).json({
      ...result,
      testedRecipients: validRecipients,
      testedAt: new Date().toISOString(),
    });
  });

  // 3. Send automatic alert when a new order is validated (Storefront or Landing Page, or Admin Retry)
  app.post('/api/notifications/send-order-alert', async (req: Request, res: Response) => {
    try {
      const order = req.body?.order as OrderEmailPayload | undefined;
      const rawRecipients = Array.isArray(req.body?.recipients) ? req.body.recipients : undefined;
      const forceRetry = Boolean(req.body?.forceRetry);
      const simulateSmtpError = Boolean(req.body?.simulateSmtpError);

      if (!order || !order.id || !order.orderNumber) {
        res.status(400).json({
          success: false,
          status: 'invalid_order',
          message: 'Données de commande incomplètes (id et orderNumber requis).',
        });
        return;
      }

      if (forceRetry && !verifyAdminRequest(req)) {
        res.status(403).json({
          success: false,
          status: 'unauthorized',
          message: 'Accès refusé : seul un administrateur peut relancer une notification.',
        });
        return;
      }

      const result = await executeIndependentOrderNotification(
        order,
        rawRecipients,
        forceRetry,
        simulateSmtpError
      );
      res.json(result);
    } catch (err: any) {
      // Never crash or fail with unhandled rejection
      res.status(200).json({
        success: false,
        status: 'failed',
        provider: getEmailProviderConfig().provider,
        message: 'Une erreur interne est survenue lors du traitement de la notification.',
        errorDetail: err?.message || String(err),
      });
    }
  });

  // 4. Authoritative Server-Side COD Order Validation, Persistence & Independent Notification (PARTIES 1 & 3)
  app.post('/api/orders/validate-and-create', (req: Request, res: Response) => {
    try {
      const sessionFingerprint = getAnonymizedSessionFingerprint(req);
      const outcome = processOrderValidationAndCreation(req.body || {}, sessionFingerprint);

      // Confirmation envoyée au client uniquement si la commande a été effectivement enregistrée (outcome.allowed === true)
      res.status(outcome.httpStatus).json(outcome);

      // Étape 4 (PARTIE 3) : Déclencher l'envoi de la notification e-mail côté serveur en arrière-plan
      // Un échec SMTP n'annule jamais une commande enregistrée et ne bloque jamais son affichage dans « Commandes COD »
      if (outcome.allowed && outcome.order && !outcome.duplicatePrevented) {
        const createdOrder = outcome.order;
        const simulateSmtpError = Boolean(req.body?.simulateSmtpError);
        setImmediate(() => {
          executeIndependentOrderNotification(
            createdOrder,
            undefined,
            false,
            simulateSmtpError
          ).catch((e) => {
            console.warn('Non-blocking order notification error:', e);
          });
        });
      }
    } catch (err: any) {
      res.status(500).json({
        allowed: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur serveur est survenue lors de la validation de la commande.',
      });
    }
  });

  // 4b. Read all persisted COD orders for Admin « Commandes COD »
  app.get('/api/orders', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'GET /api/orders');
      res.status(403).json({
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }
    res.json({
      orders: getServerOrders(),
      deletedOrderIds: getDeletedOrderIds(),
      deletionAuditLogs: getOrderDeletionAuditLogs(),
      notificationLogs: getServerOrderNotificationLogs(),
    });
  });

  // 4b-bis. Delete or archive a COD order (Strictly restricted to 'admin' role)
  const handleAdminOrderDeleteOrArchive = (req: Request, res: Response) => {
    if (!verifyStrictAdminRole(req)) {
      recordUnauthorizedAdminAttempt(req, `${req.method} /api/orders/${req.params.id}`);
      res.status(403).json({
        success: false,
        code: 'FORBIDDEN_ADMIN_ONLY',
        message:
          'Accès refusé : seule une session Administrateur principal (rôle "admin") est autorisée à supprimer ou archiver une commande.',
      });
      return;
    }

    const orderId = String(req.params.id || '').trim();
    const rawMode = String(req.body?.mode || req.query?.mode || 'permanent').trim().toLowerCase();
    const mode: 'archive' | 'permanent' | 'restore' =
      rawMode === 'archive' ? 'archive' : rawMode === 'restore' ? 'restore' : 'permanent';
    const reason = String(req.body?.reason || req.query?.reason || '').trim();
    const adminUser = String(req.headers['x-dzmahall-admin-user'] || 'admin').trim();
    const adminRole = String(req.headers['x-dzmahall-admin-role'] || '').trim().toLowerCase();

    const outcome = deleteOrArchiveServerOrder(orderId, {
      mode,
      reason,
      adminUser,
      adminRole,
    });

    res.status(outcome.httpStatus).json({
      ...outcome,
      orders: getServerOrders(),
      deletedOrderIds: getDeletedOrderIds(),
      deletionAuditLogs: getOrderDeletionAuditLogs(),
    });
  };

  app.delete('/api/orders/:id', handleAdminOrderDeleteOrArchive);
  app.post('/api/orders/:id/delete', handleAdminOrderDeleteOrArchive);

  // 4c. Public targeted order tracking lookup by orderNumber or customerPhone
  app.get('/api/orders/track', (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim();
    const order = findServerOrderByQuery(q);
    res.json({ order: order || null });
  });

  // 4c-bis. Public server-side phone duplicate & cancelled order check (Zero PII exposed to visitors)
  app.post('/api/orders/check-phone', (req: Request, res: Response) => {
    const rawPhone = String(req.body?.phone || '').trim();
    const candidateItems = Array.isArray(req.body?.items) ? req.body.items : undefined;
    const result = checkPhoneDuplicateStatusPublic(rawPhone, candidateItems);
    res.json(result);
  });

  // 4c-ter. Admin-only full order history linked to the same phone number (Protected)
  app.get('/api/orders/phone-history/:phone', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'GET /api/orders/phone-history/:phone');
      res.status(403).json({
        error: 'Accès refusé : seul un administrateur authentifié peut consulter l’historique complet d’un numéro.',
      });
      return;
    }
    const rawPhone = String(req.params.phone || '').trim();
    const currentOrderId = req.query.currentOrderId ? String(req.query.currentOrderId).trim() : undefined;
    const summary = getPhoneOrderHistoryForAdmin(rawPhone, currentOrderId);
    res.json(summary);
  });

  // 4d. Update order commercial status on the server (Admin only)
  app.patch('/api/orders/:id/status', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'PATCH /api/orders/:id/status');
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    const orderId = String(req.params.id || '').trim();
    const { status, note } = req.body || {};
    const adminUser = String(req.headers['x-dzmahall-admin-user'] || 'Admin DzMahall');
    const updated = updateServerOrderStatus(orderId, status, note, adminUser);
    if (!updated) {
      res.status(404).json({ success: false, message: 'Commande introuvable.' });
      return;
    }
    res.json({ success: true, order: updated, orders: getServerOrders() });
  });

  // 4e. Update order carrier, delivery service type & tracking number on the server (Admin only)
  app.patch('/api/orders/:id/carrier', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'PATCH /api/orders/:id/carrier');
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    const orderId = String(req.params.id || '').trim();
    const {
      carrierId,
      carrierName,
      trackingNumber,
      carrierTrackingUrl,
      trackingUrl,
      note,
      deliveryServiceType,
      shippingFee,
    } = req.body || {};

    let normalizedServiceType: DeliveryServiceType | undefined = undefined;
    if (deliveryServiceType !== undefined && String(deliveryServiceType).trim() !== '') {
      const parsedChoice = normalizeGuepexDeliveryChoice(deliveryServiceType);
      if (!parsedChoice) {
        res.status(400).json({
          success: false,
          message:
            'Type de livraison Guepex invalide. Veuillez choisir explicitement « Express » ou « Économique ».',
        });
        return;
      }
      normalizedServiceType = parsedChoice;
    }

    const numericShippingFee =
      typeof shippingFee === 'number' && shippingFee > 0 ? Math.round(shippingFee) : undefined;

    const adminUser = String(req.headers['x-dzmahall-admin-user'] || 'Admin DzMahall');
    const updated = updateServerOrderCarrier(
      orderId,
      carrierId,
      carrierName || carrierId,
      trackingNumber,
      carrierTrackingUrl || trackingUrl,
      note,
      adminUser,
      normalizedServiceType,
      numericShippingFee
    );
    if (!updated) {
      res.status(404).json({ success: false, message: 'Commande introuvable.' });
      return;
    }
    res.json({ success: true, order: updated, orders: getServerOrders() });
  });

  // 4f. Record customer phone/WhatsApp confirmation attempt on the server (Admin only)
  app.post('/api/orders/:id/contact-attempt', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/orders/:id/contact-attempt');
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    const orderId = String(req.params.id || '').trim();
    const attempt = req.body?.attempt;
    if (!attempt) {
      res.status(400).json({ success: false, message: 'Données de tentative manquantes.' });
      return;
    }
    const updated = recordServerOrderContactAttempt(orderId, attempt);
    if (!updated) {
      res.status(404).json({ success: false, message: 'Commande introuvable.' });
      return;
    }
    res.json({ success: true, order: updated, orders: getServerOrders() });
  });

  // 4g. Authoritative Public Catalog Endpoint (Single Source of Truth across all devices, browsers & networks)
  app.get('/api/catalog', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const delayMs = Math.min(Math.max(0, Number(req.query.delayMs) || 0), 3000);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Support test simulation of a catalog fetch error
    if (
      req.query.simulateError === '1' ||
      req.query.simulateError === 'true' ||
      req.headers['x-simulate-network-error'] === '1'
    ) {
      res.status(503).json({
        success: false,
        error: 'CATALOG_UNAVAILABLE',
        message: 'Service de catalogue temporairement indisponible.',
      });
      return;
    }

    const catalog = getServerCatalog();
    res.json({
      success: true,
      ...catalog,
    });
  });

  // 4h. Admin Product Create / Upsert (Durable Server Persistence)
  app.post('/api/catalog/products', async (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/catalog/products');
      res.status(403).json({
        success: false,
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }

    const delayMs = Math.min(Math.max(0, Number(req.query.delayMs || req.body?.delayMs) || 0), 3000);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (
      req.query.simulateError === '1' ||
      req.query.simulateError === 'true' ||
      req.headers['x-simulate-network-error'] === '1' ||
      req.body?.simulateNetworkError === true
    ) {
      res.status(503).json({
        success: false,
        error: 'SIMULATED_NETWORK_ERROR',
        message: "Échec réseau simulé : impossible d'enregistrer le produit sur le serveur.",
      });
      return;
    }

    try {
      const rawProduct = req.body?.product || req.body;
      if (!rawProduct || !rawProduct.id || !rawProduct.name) {
        res.status(400).json({
          success: false,
          message: 'Données du produit incomplètes (id et nom requis).',
        });
        return;
      }
      const cleanRawProduct = { ...rawProduct };
      delete cleanRawProduct._optimisticStatus;
      delete cleanRawProduct._tempId;

      const saved = upsertServerProduct(cleanRawProduct);
      const catalog = getServerCatalog();
      res.json({
        success: true,
        product: saved,
        products: catalog.products,
        deletedProductIds: catalog.deletedProductIds,
        updatedAt: catalog.updatedAt,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err?.message || 'Erreur lors de la sauvegarde du produit.',
      });
    }
  });

  // 4i. Admin Product Update (Price, Stock, Variants, Status, Category...)
  app.put('/api/catalog/products/:id', async (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'PUT /api/catalog/products/:id');
      res.status(403).json({
        success: false,
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }

    const delayMs = Math.min(Math.max(0, Number(req.query.delayMs || req.body?.delayMs) || 0), 3000);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (
      req.query.simulateError === '1' ||
      req.query.simulateError === 'true' ||
      req.headers['x-simulate-network-error'] === '1' ||
      req.body?.simulateNetworkError === true
    ) {
      res.status(503).json({
        success: false,
        error: 'SIMULATED_NETWORK_ERROR',
        message: 'Échec réseau simulé : impossible de mettre à jour le produit.',
      });
      return;
    }

    try {
      const targetId = String(req.params.id || '').trim();
      const currentCatalog = getServerCatalog();
      const existing = currentCatalog.products.find((p) => p.id === targetId);
      const incoming = req.body?.product || req.body || {};
      const merged = {
        ...(existing || {}),
        ...incoming,
        id: targetId,
      };
      delete merged._optimisticStatus;
      delete merged._tempId;

      if (!merged.name) {
        res.status(404).json({
          success: false,
          message: 'Produit introuvable ou nom manquant.',
        });
        return;
      }
      const saved = upsertServerProduct(merged);
      const updatedCatalog = getServerCatalog();
      res.json({
        success: true,
        product: saved,
        products: updatedCatalog.products,
        deletedProductIds: updatedCatalog.deletedProductIds,
        updatedAt: updatedCatalog.updatedAt,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err?.message || 'Erreur lors de la mise à jour du produit.',
      });
    }
  });

  // 4j. Admin Product Permanent Deletion (Records ID in deletedProductIds so it never reappears)
  app.delete('/api/catalog/products/:id', async (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'DELETE /api/catalog/products/:id');
      res.status(403).json({
        success: false,
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }

    const delayMs = Math.min(Math.max(0, Number(req.query.delayMs) || 0), 3000);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (
      req.query.simulateError === '1' ||
      req.query.simulateError === 'true' ||
      req.headers['x-simulate-network-error'] === '1'
    ) {
      res.status(503).json({
        success: false,
        error: 'SIMULATED_NETWORK_ERROR',
        message: 'Échec réseau simulé : suppression refusée par le serveur.',
      });
      return;
    }

    const targetId = String(req.params.id || '').trim();
    if (!targetId) {
      res.status(400).json({ success: false, message: 'Identifiant produit manquant.' });
      return;
    }
    deleteServerProduct(targetId);
    const catalog = getServerCatalog();
    res.json({
      success: true,
      deletedId: targetId,
      products: catalog.products,
      deletedProductIds: catalog.deletedProductIds,
      updatedAt: catalog.updatedAt,
    });
  });

  // 4k. Admin Batch Products Import / Sync
  app.post('/api/catalog/products/batch', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/catalog/products/batch');
      res.status(403).json({
        success: false,
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }
    const incoming = Array.isArray(req.body?.products) ? req.body.products : [];
    upsertServerProductsBatch(incoming);
    const catalog = getServerCatalog();
    res.json({
      success: true,
      products: catalog.products,
      deletedProductIds: catalog.deletedProductIds,
      updatedAt: catalog.updatedAt,
    });
  });

  // 4l. Admin Categories Upsert / Reorder
  app.post('/api/catalog/categories', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/catalog/categories');
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    if (Array.isArray(req.body?.categories)) {
      const categories = upsertServerCategoriesBatch(req.body.categories);
      res.json({ success: true, categories });
      return;
    }
    if (req.body?.category && req.body.category.id) {
      const category = upsertServerCategory(req.body.category);
      res.json({ success: true, category, categories: getServerCatalog().categories });
      return;
    }
    res.status(400).json({ success: false, message: 'Données de catégorie invalides.' });
  });

  // 4m. Admin Landing Pages Upsert & Delete
  app.post('/api/catalog/landing-pages', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/catalog/landing-pages');
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    const page = req.body?.page || req.body;
    if (!page || !page.id) {
      res.status(400).json({ success: false, message: 'Landing page invalide.' });
      return;
    }
    const saved = upsertServerLandingPage(page);
    res.json({
      success: true,
      page: saved,
      landingPages: getServerCatalog().landingPages,
    });
  });

  app.delete('/api/catalog/landing-pages/:id', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'DELETE /api/catalog/landing-pages/:id');
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    const deleted = deleteServerLandingPage(String(req.params.id || ''));
    res.json({
      success: deleted,
      landingPages: getServerCatalog().landingPages,
    });
  });

  // 4n. Admin Wilaya Delivery Rates Update
  app.put('/api/catalog/wilayas/:code', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'PUT /api/catalog/wilayas/:code');
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    const wilaya = req.body?.wilaya || req.body;
    if (!wilaya || !wilaya.code) {
      res.status(400).json({ success: false, message: 'Données wilaya invalides.' });
      return;
    }
    const saved = updateServerWilaya(wilaya);
    res.json({
      success: true,
      wilaya: saved,
      wilayas: getServerCatalog().wilayas,
    });
  });

  // 4o. Hardened catalog sync endpoint: never allows unauthenticated visitors to overwrite the server catalog
  app.post('/api/catalog/sync-public', (req: Request, res: Response) => {
    if (verifyAdminRequest(req)) {
      const { products, categories, landingPages, wilayas } = req.body || {};
      syncServerCatalogAndOrders({
        products: Array.isArray(products) ? products : undefined,
        categories: Array.isArray(categories) ? categories : undefined,
        landingPages: Array.isArray(landingPages) ? landingPages : undefined,
        wilayas: Array.isArray(wilayas) ? wilayas : undefined,
      });
    }
    const catalog = getServerCatalog();
    res.json({
      success: true,
      ...catalog,
    });
  });

  // 4p. Authoritative Public Landing Page Fast-Fetch Endpoint (<15KB, <5ms, no admin overhead)
  app.get('/api/lp/:slugOrId', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const slugOrId = String(req.params.slugOrId || '').trim();
    if (!slugOrId) {
      res.status(400).json({ success: false, notFound: true, message: 'Slug manquant.' });
      return;
    }

    const isAdmin = verifyAdminRequest(req);
    const result = getServerLandingPage(slugOrId, isAdmin);

    if (!result) {
      res.status(404).json({
        success: false,
        notFound: true,
        error: 'NOT_FOUND',
        message: "Landing page introuvable sur le catalogue officiel DzMahall.",
      });
      return;
    }

    if (result.isDraft && !isAdmin) {
      res.status(403).json({
        success: false,
        isDraft: true,
        title: result.page.title,
        message: "Cette offre commerciale est actuellement en cours de préparation.",
      });
      return;
    }

    res.json({
      success: true,
      page: result.page,
      product: result.product,
      wilayas: result.wilayas,
      isDraft: result.isDraft,
      matchType: result.matchType,
    });
  });

  // 5. Admin Anti-Fraud Overview (Protected)
  app.get('/api/fraud/overview', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'GET /api/fraud/overview');
      res.status(403).json({
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }
    res.json(getFraudAdminOverview());
  });

  // 6. Sync Store Catalog, Wilayas & Orders to Server Anti-Fraud Engine (Protected)
  app.post('/api/fraud/sync', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/fraud/sync');
      res.status(403).json({
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }
    syncServerCatalogAndOrders(req.body || {});
    res.json({ success: true });
  });

  // 7. Add or Update a Phone Number in Watchlist / Blocklist (Protected)
  app.post('/api/fraud/watchlist', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/fraud/watchlist');
      res.status(403).json({
        success: false,
        message: 'Accès refusé : opération réservée aux administrateurs autorisés.',
      });
      return;
    }
    const adminUser = String(req.headers['x-dzmahall-admin-user'] || 'Admin DzMahall');
    const result = upsertWatchlistEntry({
      ...(req.body || {}),
      addedBy: adminUser,
    });
    res.status(result.success ? 200 : 400).json(result);
  });

  // 8. Remove a Phone Number from Watchlist / Blocklist (Protected)
  app.delete('/api/fraud/watchlist/:phone', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'DELETE /api/fraud/watchlist');
      res.status(403).json({
        success: false,
        message: 'Accès refusé : opération réservée aux administrateurs autorisés.',
      });
      return;
    }
    const result = removeWatchlistEntry(String(req.params.phone || ''));
    res.status(result.success ? 200 : 404).json(result);
  });

  // 9. Update Anti-Fraud Thresholds & Settings (Protected)
  app.post('/api/fraud/settings', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/fraud/settings');
      res.status(403).json({
        success: false,
        message: 'Accès refusé : opération réservée aux administrateurs autorisés.',
      });
      return;
    }
    const adminUser = String(req.headers['x-dzmahall-admin-user'] || 'Admin DzMahall');
    const updated = updateFraudSettingsOnServer(req.body || {}, adminUser);
    res.json({
      success: true,
      message: 'Les seuils de protection anti-fraude ont été mis à jour avec succès.',
      settings: updated,
    });
  });

  // 10. Run 12 Mandatory Security Self-Tests in Sandbox (Protected)
  app.post('/api/fraud/run-tests', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/fraud/run-tests');
      res.status(403).json({
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }
    const report = runMandatorySecurityTestsSandbox();
    res.json(report);
  });

  // ============================================================================
  // 11. ALGERIAN CARRIER INTEGRATIONS (Server-Side Secrets, Real Connection Test & Parcel Creation)
  // ============================================================================

  // Get all carriers with secrets masked (Admin only)
  app.get('/api/carriers', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'GET /api/carriers');
      res.status(403).json({
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }
    res.json({ carriers: getCarriersForAdminUI() });
  });

  // Save carrier configuration & credentials on server (Admin only)
  app.post('/api/carriers/:id/config', (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/carriers/:id/config');
      res.status(403).json({
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }
    const carrierId = String(req.params.id || '').trim();
    const updated = updateCarrierConfigOnServer(carrierId, req.body || {});
    if (!updated) {
      res.status(404).json({
        success: false,
        message: 'Transporteur introuvable.',
      });
      return;
    }
    res.json({
      success: true,
      carrier: updated,
      carriers: getCarriersForAdminUI(),
    });
  });

  // Real server-side connection test against the carrier's official read-only API endpoint (Admin only)
  app.post('/api/carriers/:id/test', async (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/carriers/:id/test');
      res.status(403).json({
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }
    const carrierId = String(req.params.id || '').trim();
    const overrideFields = Array.isArray(req.body?.fields) ? req.body.fields : undefined;
    const result = await testCarrierConnectionOnServer(carrierId, overrideFields);
    res.json({
      ...result,
      carriers: getCarriersForAdminUI(),
    });
  });

  // Get Guepex tariffs for wilaya, stopdesk & service type (Express 24h / Économique 48h)
  app.get('/api/carriers/guepex/tariffs', async (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'GET /api/carriers/guepex/tariffs');
      res.status(403).json({
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }
    const wilayaCode = String(req.query.wilayaCode || '16');
    const parsedType = normalizeGuepexDeliveryChoice(req.query.serviceType);
    if (!parsedType) {
      res.status(400).json({
        error: 'Veuillez choisir explicitement Express ou Économique pour calculer le tarif Guepex.',
      });
      return;
    }
    const isStopDesk = req.query.isStopDesk === 'true' || req.query.isStopDesk === '1';
    const carrier = getCarriersForAdminUI().find(
      (c) => c.id === 'guepex' || c.adapterFamily === 'guepex'
    );

    const quote = await getGuepexDeliveryTariff({
      carrier,
      wilayaCode,
      isStopDesk,
      serviceType: parsedType,
    });
    res.json(quote);
  });

  // Create a COD parcel or preview the exact request payload (Dry-Run) with idempotency (Admin only)
  app.post('/api/carriers/:id/ship', async (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/carriers/:id/ship');
      res.status(403).json({
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }
    const carrierId = String(req.params.id || '').trim();
    const {
      order,
      dryRun,
      confirmLiveCreation,
      serviceType,
      shippingFee,
      allowExplicitFreeShipping,
      isExplicitFreeShippingConfirmed,
      freeShippingJustification,
    } = req.body || {};

    if (!order || !order.id || !order.orderNumber) {
      res.status(400).json({
        success: false,
        message: 'Données de commande manquantes pour la création du colis.',
      });
      return;
    }

    const adminUser = String(req.headers['x-dzmahall-admin-user'] || 'Admin DzMahall');
    const carrierMeta = getCarriersForAdminUI().find((c) => c.id === carrierId);
    const isGuepexCarrier =
      carrierId === 'guepex' || carrierMeta?.adapterFamily === 'guepex';

    // Lire la commande enregistrée côté serveur : l'état serveur fait autorité sur un éventuel objet client obsolète
    const serverStoredOrder = getServerOrders().find((o) => o.id === order.id);
    const effectiveOrder = serverStoredOrder
      ? { ...order, ...serverStoredOrder }
      : { ...order };

    const carrierDefaultServiceField = carrierMeta?.fields?.find(
      (f) => f.key === 'defaultServiceType'
    )?.value;

    // Résoudre le choix de type de livraison Guepex sans jamais imposer 'express' par défaut :
    // 1) Choix explicite de la requête d'expédition (serviceType)
    // 2) Choix persisté sur la commande côté serveur (serverStoredOrder.deliveryServiceType)
    // 3) Choix présent sur l'objet commande fourni (order.deliveryServiceType)
    // 4) Choix par défaut configuré dans les paramètres du transporteur Guepex (defaultServiceType)
    const rawCandidateChoice =
      serviceType !== undefined && String(serviceType).trim() !== ''
        ? serviceType
        : serverStoredOrder?.deliveryServiceType !== undefined &&
          String(serverStoredOrder.deliveryServiceType).trim() !== ''
        ? serverStoredOrder.deliveryServiceType
        : order.deliveryServiceType !== undefined &&
          String(order.deliveryServiceType).trim() !== ''
        ? order.deliveryServiceType
        : carrierDefaultServiceField;
    const normalizedChoice = normalizeGuepexDeliveryChoice(rawCandidateChoice);

    const numericShippingFee =
      typeof shippingFee === 'number' && shippingFee >= 0 ? Math.round(shippingFee) : undefined;

    if (isGuepexCarrier) {
      if (!normalizedChoice) {
        res.status(400).json({
          success: false,
          message:
            'Choix obligatoire pour Guepex : veuillez sélectionner explicitement « Express » ou « Économique » avant l’envoi.',
        });
        return;
      }

      // Enregistrer durablement le choix et synchroniser les frais/totaux dans la commande AVANT la transmission à l'API Guepex
      const persistedBeforeShip = updateServerOrderCarrier(
        order.id,
        carrierId,
        carrierMeta?.name || 'Guepex Express',
        undefined,
        undefined,
        `Type de livraison Guepex enregistré avant expédition : ${
          normalizedChoice === 'express' ? 'Express (delivery_type: "express")' : 'Économique (delivery_type: "eco")'
        }`,
        adminUser,
        normalizedChoice,
        numericShippingFee
      );
      if (persistedBeforeShip) {
        Object.assign(effectiveOrder, persistedBeforeShip);
      } else {
        effectiveOrder.deliveryServiceType = normalizedChoice;
        if (typeof numericShippingFee === 'number' && numericShippingFee > 0) {
          effectiveOrder.shippingCost = numericShippingFee;
          effectiveOrder.shippingFee = numericShippingFee;
          const sub = Math.round(
            Number(effectiveOrder.subtotal || Math.max(0, effectiveOrder.totalAmount - (order.shippingCost || 0)))
          );
          effectiveOrder.totalAmount = sub + numericShippingFee - (effectiveOrder.discount || 0);
          effectiveOrder.total = effectiveOrder.totalAmount;
        }
      }
    }

    const result = await createCarrierShipmentOnServer({
      carrierId,
      order: effectiveOrder,
      dryRun: Boolean(dryRun),
      confirmLiveCreation: Boolean(confirmLiveCreation),
      options: {
        // La fonction d'envoi lit le choix réellement enregistré pour cette commande
        serviceType: isGuepexCarrier ? effectiveOrder.deliveryServiceType : undefined,
        shippingFee:
          typeof numericShippingFee === 'number'
            ? numericShippingFee
            : effectiveOrder.shippingFee ?? effectiveOrder.shippingCost,
        allowExplicitFreeShipping: Boolean(allowExplicitFreeShipping),
        isExplicitFreeShippingConfirmed: Boolean(isExplicitFreeShippingConfirmed),
        freeShippingJustification,
      },
    });

    let updatedOrder = getServerOrders().find((o) => o.id === order.id);
    if (result.success && !result.dryRun && result.trackingNumber) {
      const trackingUrl =
        carrierMeta?.trackingUrlTemplate && result.trackingNumber
          ? carrierMeta.trackingUrlTemplate.replace('{TRACKING}', result.trackingNumber)
          : undefined;
      updatedOrder =
        updateServerOrderCarrier(
          order.id,
          carrierId,
          carrierMeta?.name || carrierId,
          result.trackingNumber,
          trackingUrl,
          `Colis créé via API (${result.trackingNumber})${
            isGuepexCarrier && effectiveOrder.deliveryServiceType
              ? ` [${
                  effectiveOrder.deliveryServiceType === 'express'
                    ? 'Express / delivery_type: "express"'
                    : 'Économique / delivery_type: "eco"'
                }]`
              : ''
          }`,
          adminUser,
          isGuepexCarrier ? effectiveOrder.deliveryServiceType : undefined
        ) || updatedOrder;
    }

    res.json({
      ...result,
      order: updatedOrder || effectiveOrder,
    });
  });

  // Run diagnostic verification across all 12 Algerian carrier adapters (Admin only)
  app.post('/api/carriers/run-diagnostics', async (req: Request, res: Response) => {
    if (!verifyAdminRequest(req)) {
      recordUnauthorizedAdminAttempt(req, 'POST /api/carriers/run-diagnostics');
      res.status(403).json({
        error: 'Accès refusé : authentification administrateur requise.',
      });
      return;
    }
    const report = await runCarrierAdaptersDiagnosticSuite();
    res.json(report);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`DZMahall Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
