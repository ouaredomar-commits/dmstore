import { LandingPage, Product } from '../types';

/**
 * Normalise un slug ou identifiant de landing page pour une comparaison robuste.
 * Supprime les accents, met en minuscule, remplace la ponctuation par des tirets
 * et élimine les tirets en double.
 */
export function normalizeLandingPageSlug(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/(^-|-$)+/g, '');
}

/**
 * Extrait le préfixe racine d'un slug en retirant les suffixes publicitaires fréquents
 * comme « -offre-387 », « -offre », « -promo-1 », « -v2 », etc.
 * Cela permet de relier une URL de publicité à sa landing page même si le numéro
 * d'offre ou le tracking est modifié.
 */
export function extractCoreLandingPageSlug(normalized: string): string {
  if (!normalized) return '';
  return normalized
    .replace(/-(offre|promo|deal|pack|remise|v\d+)(-\d+)?$/i, '')
    .replace(/(^-|-$)+/g, '');
}

export interface MatchLandingPageResult {
  page: LandingPage;
  matchType: 'exact' | 'normalized' | 'core_prefix' | 'product_link' | 'fuzzy';
  isDraft: boolean;
}

/**
 * Réconciliateur intelligent et sécurisé de slug et d'identifiant de landing page.
 * Trouve la landing page officielle DzMahall correspondante à travers plusieurs niveaux :
 * 1. Correspondance exacte sur l'identifiant (id) ou le slug.
 * 2. Correspondance normalisée (sans casse, sans accents, sans tirets superflus).
 * 3. Correspondance de préfixe racine (tolérance sur suffixes d'offres : -offre-387, -offre-xxx).
 * 4. Correspondance par lien produit (si le slug correspond au slug ou à l'ID d'un produit avec landing page publiée).
 * 5. Tolérance de mots-clés significatifs (ex. repeteur + d-link + dap-1610).
 */
export function matchLandingPage(
  landingPages: LandingPage[],
  targetSlugOrId: string,
  options?: {
    products?: Product[];
    allowDraft?: boolean;
  }
): MatchLandingPageResult | null {
  if (!Array.isArray(landingPages) || landingPages.length === 0) return null;
  if (!targetSlugOrId || typeof targetSlugOrId !== 'string') return null;

  const rawClean = targetSlugOrId.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!rawClean) return null;

  const targetNorm = normalizeLandingPageSlug(rawClean);
  const targetCore = extractCoreLandingPageSlug(targetNorm);
  const allowDraft = Boolean(options?.allowDraft);
  const products = options?.products || [];

  // Helper pour vérifier si la page est acceptable (publiée ou mode brouillon autorisé)
  const isEligible = (p: LandingPage) => allowDraft || p.status === 'published';

  // 1. Priorité absolue : Correspondance exacte
  for (const page of landingPages) {
    if (!page) continue;
    const pageId = (page.id || '').trim().toLowerCase();
    const pageSlug = (page.slug || '').trim().toLowerCase();
    if (pageId === rawClean || pageSlug === rawClean) {
      if (isEligible(page)) {
        return { page, matchType: 'exact', isDraft: page.status !== 'published' };
      }
    }
  }

  // 2. Priorité 2 : Correspondance normalisée (sans accents, tirets nettoyés)
  for (const page of landingPages) {
    if (!page) continue;
    const normSlug = normalizeLandingPageSlug(page.slug || '');
    const normId = normalizeLandingPageSlug(page.id || '');
    if (normSlug === targetNorm || normId === targetNorm) {
      if (isEligible(page)) {
        return { page, matchType: 'normalized', isDraft: page.status !== 'published' };
      }
    }
  }

  // 3. Priorité 3 : Correspondance par préfixe racine (core prefix sans suffixe -offre-xxx)
  // Gère le cas où l'URL est /lp/repeteur-wi-fid-link-dap-1610-offre-387
  // et la page est repeteur-wi-fid-link-dap-1610 (ou inversement)
  if (targetCore) {
    for (const page of landingPages) {
      if (!page) continue;
      const pageNorm = normalizeLandingPageSlug(page.slug || '');
      const pageCore = extractCoreLandingPageSlug(pageNorm);

      if (pageCore && (pageCore === targetCore || pageNorm === targetCore || pageCore === targetNorm)) {
        if (isEligible(page)) {
          return { page, matchType: 'core_prefix', isDraft: page.status !== 'published' };
        }
      }
    }
  }

  // 4. Priorité 4 : Correspondance par produit associé
  // Si le slug cible correspond à un produit (ex. repeteur-wi-fid-link-dap-1610),
  // on recherche la landing page publiée associée à ce produit.
  if (products.length > 0) {
    const matchedProduct = products.find((prod) => {
      if (!prod) return false;
      const prodSlug = normalizeLandingPageSlug(prod.slug || '');
      const prodId = normalizeLandingPageSlug(prod.id || '');
      const prodCore = extractCoreLandingPageSlug(prodSlug);
      return (
        prodSlug === targetNorm ||
        prodId === targetNorm ||
        (prodCore && prodCore === targetCore) ||
        (targetCore && prodSlug.includes(targetCore))
      );
    });

    if (matchedProduct) {
      const pageForProduct = landingPages.find(
        (p) => p && p.productId === matchedProduct.id && isEligible(p)
      );
      if (pageForProduct) {
        return {
          page: pageForProduct,
          matchType: 'product_link',
          isDraft: pageForProduct.status !== 'published',
        };
      }
    }
  }

  // 5. Priorité 5 : Tolérance sur mots-clés significatifs (ex. ['repeteur', 'dap', '1610'])
  const targetTokens = targetCore
    .split('-')
    .filter((tok) => tok.length >= 3 && !['les', 'des', 'une', 'pour', 'avec', 'sans'].includes(tok));

  if (targetTokens.length >= 2) {
    for (const page of landingPages) {
      if (!page) continue;
      const pageNorm = normalizeLandingPageSlug(page.slug || '');
      const allTokensMatch = targetTokens.every((tok) => pageNorm.includes(tok));
      if (allTokensMatch && isEligible(page)) {
        return { page, matchType: 'fuzzy', isDraft: page.status !== 'published' };
      }
    }
  }

  // Si rien n'est trouvé parmi les pages publiées, vérifier s'il existe une page en brouillon (pour informer poliment)
  if (!allowDraft) {
    const draftCandidate = matchLandingPage(landingPages, targetSlugOrId, {
      products,
      allowDraft: true,
    });
    if (draftCandidate && draftCandidate.page.status === 'draft') {
      return draftCandidate;
    }
  }

  return null;
}
