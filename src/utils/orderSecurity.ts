import { FraudProtectionSettings } from '../types';

export interface AlgerianPhoneValidationResult {
  isValid: boolean;
  normalized: string; // Format canonique 10 chiffres: 05XXXXXXXX, 06XXXXXXXX, 07XXXXXXXX
  formatted: string;  // Format lisible: 05XX XX XX XX
  operator?: 'Ooredoo' | 'Mobilis' | 'Djezzy';
  isSuspiciousPattern?: boolean;
  suspiciousReason?: string;
  errorMessage?: string;
}

export const DEFAULT_FRAUD_SETTINGS: FraudProtectionSettings = {
  id: 'global',
  enabled: true,
  maxOrdersPerPhonePerHour: 3,
  maxOrdersPerPhonePerDay: 5,
  maxOrdersPerSessionPerHour: 8, // Seuil souple pour préserver les familles / réseaux mobiles 4G partagés
  duplicateWindowMinutes: 30,
  minFormFillTimeMs: 1200,
  highQuantityThreshold: 4,
  highAmountThreshold: 35000,
  autoFlagMediumRiskAsNeedsReview: true,
  requireChallengeOnHighRisk: true,
  defaultBlockDurationHours: 24,
  updatedAt: new Date().toISOString(),
};

/**
 * Normalise et valide un numéro de téléphone mobile algérien (05 / 06 / 07).
 * Accepte les formats:
 * - 0550123456 / 06 60 76 93 86 / 07-70-12-34-56
 * - +213 550 12 34 56 / +213 (0) 660 76 93 86
 * - 00213 660 76 93 86 / 213 770 12 34 56
 */
export function normalizeAndValidateAlgerianPhone(rawInput: string): AlgerianPhoneValidationResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      isValid: false,
      normalized: '',
      formatted: '',
      errorMessage: 'Veuillez saisir votre numéro de téléphone mobile (05, 06 ou 07).',
    };
  }

  // Supprimer les espaces, tirets, points, parenthèses
  let cleaned = rawInput.trim().replace(/[\s\-\.\(\)]/g, '');

  // Gérer les préfixes internationaux algériens (+213, 00213, 213)
  if (cleaned.startsWith('+2130')) {
    cleaned = '0' + cleaned.slice(5);
  } else if (cleaned.startsWith('+213')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('002130')) {
    cleaned = '0' + cleaned.slice(6);
  } else if (cleaned.startsWith('00213')) {
    cleaned = '0' + cleaned.slice(5);
  } else if (cleaned.length === 11 && cleaned.startsWith('213') && ['5', '6', '7'].includes(cleaned[3])) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.length === 9 && ['5', '6', '7'].includes(cleaned[0])) {
    cleaned = '0' + cleaned;
  }

  if (!/^0[567][0-9]{8}$/.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      formatted: rawInput.trim(),
      errorMessage:
        'Numéro de téléphone algérien invalide. Utilisez un format valide à 10 chiffres commençant par 05, 06 ou 07 (ex: 0550 12 34 56).',
    };
  }

  const subscriberDigits = cleaned.slice(2); // 8 derniers chiffres

  // Détection des numéros manifestement fictifs (ex: 0500000000, 0666666666, 0512345678, 0687654321)
  const allSameDigits = /^(\d)\1{7}$/.test(subscriberDigits);
  const obviousSequences = [
    '12345678',
    '23456789',
    '87654321',
    '01234567',
    '00000000',
    '11111111',
    '22222222',
    '33333333',
    '44444444',
    '55555555',
    '66666666',
    '77777777',
    '88888888',
    '99999999',
  ];

  if (allSameDigits || obviousSequences.includes(subscriberDigits)) {
    return {
      isValid: false,
      normalized: cleaned,
      formatted: formatAlgerianPhoneDisplay(cleaned),
      errorMessage:
        'Ce numéro de téléphone semble fictif ou incomplet. Veuillez indiquer un numéro joignable pour la livraison.',
    };
  }

  // Détection d'un motif suspect non bloquant (ex: 6 chiffres identiques consécutifs)
  const hasSixIdenticalConsecutive = /(\d)\1{5}/.test(subscriberDigits);

  const prefix = cleaned.slice(0, 2);
  const operator: 'Ooredoo' | 'Mobilis' | 'Djezzy' =
    prefix === '05' ? 'Ooredoo' : prefix === '06' ? 'Mobilis' : 'Djezzy';

  return {
    isValid: true,
    normalized: cleaned,
    formatted: formatAlgerianPhoneDisplay(cleaned),
    operator,
    isSuspiciousPattern: hasSixIdenticalConsecutive,
    suspiciousReason: hasSixIdenticalConsecutive
      ? 'Suite inhabituelle de chiffres répétés dans le numéro de téléphone'
      : undefined,
  };
}

export function formatAlgerianPhoneDisplay(normalized: string): string {
  const digits = normalized.replace(/\D/g, '');
  if (digits.length !== 10) return normalized;
  return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
}

/**
 * Génère une signature canonique d'une commande pour détecter les doublons exacts
 * (clics multiples, rechargement de page ou resoumission rapide).
 */
export function computeOrderSignature(params: {
  normalizedPhone: string;
  wilayaCode: string;
  commune: string;
  deliveryMode: 'home' | 'desk';
  items: { productId: string; variantId?: string; quantity: number }[];
}): string {
  const itemsSig = [...params.items]
    .sort((a, b) => `${a.productId}:${a.variantId || ''}`.localeCompare(`${b.productId}:${b.variantId || ''}`))
    .map((i) => `${i.productId}:${i.variantId || 'default'}x${i.quantity}`)
    .join('|');
  const cleanCommune = (params.commune || '').trim().toLowerCase();
  return `${params.normalizedPhone}::${params.wilayaCode}::${cleanCommune}::${params.deliveryMode}::${itemsSig}`;
}

export function getStatusDisplayInfo(status: string): {
  label: string;
  shortLabel: string;
  badgeClass: string;
} {
  switch (status) {
    case 'pending_confirmation':
      return {
        label: 'En attente de confirmation',
        shortLabel: 'À confirmer',
        badgeClass: 'bg-orange-50 text-[#FF6500] border-orange-200',
      };
    case 'needs_review':
      return {
        label: 'À vérifier (Anti-fraude)',
        shortLabel: 'À vérifier',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      };
    case 'confirmed':
      return {
        label: 'Confirmée',
        shortLabel: 'Confirmée',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    case 'processing':
      return {
        label: 'En préparation',
        shortLabel: 'Préparation',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    case 'ready_to_ship':
      return {
        label: 'Prête à expédier',
        shortLabel: 'Prête',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    case 'shipped':
      return {
        label: 'Expédiée',
        shortLabel: 'Expédiée',
        badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      };
    case 'in_transit':
      return {
        label: 'En transit',
        shortLabel: 'En transit',
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
      };
    case 'out_for_delivery':
      return {
        label: 'En cours de livraison',
        shortLabel: 'En livraison',
        badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
      };
    case 'delivered':
      return {
        label: 'Livrée & Encaissée',
        shortLabel: 'Livrée',
        badgeClass: 'bg-emerald-50 text-[#004C3F] border-emerald-300',
      };
    case 'delivery_failed':
      return {
        label: 'Échec de livraison',
        shortLabel: 'Échec livr.',
        badgeClass: 'bg-red-50 text-[#D82C0D] border-red-200',
      };
    case 'returning':
      return {
        label: 'Retour en cours',
        shortLabel: 'Retour',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    case 'returned':
      return {
        label: 'Retournée au dépôt',
        shortLabel: 'Retournée',
        badgeClass: 'bg-red-50 text-[#D82C0D] border-red-200',
      };
    case 'cancelled':
      return {
        label: 'Annulée',
        shortLabel: 'Annulée',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
      };
    default:
      return {
        label: status,
        shortLabel: status,
        badgeClass: 'bg-slate-100 text-[#212B36] border-slate-300',
      };
  }
}
