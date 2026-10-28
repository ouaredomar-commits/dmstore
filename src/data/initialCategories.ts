import { CategoryItem, Product, SubCategoryItem } from '../types';
import { CATEGORIES, OfficialCategoryDefinition } from './categories';

export const UNCATEGORIZED_ID = 'uncategorized';
export const UNCATEGORIZED_LABEL = 'Non catégorisé';
export const UNCATEGORIZED_LABEL_AR = 'غير مصنف';

/**
 * Anciens identifiants génériques (5 catégories précédentes) à remplacer proprement
 * lors de la synchronisation avec les 15 catégories officielles DzMahall.
 */
export const LEGACY_PLACEHOLDER_CATEGORY_IDS = new Set<string>([
  'cat-electronique-high-tech',
  'cat-mode-vetements',
  'cat-maison-decoration-jardin',
  'cat-beaute-sante-bien-etre',
  'cat-sports-loisirs',
]);

/**
 * Génère un slug propre à partir d'un texte
 */
export function slugifyCategoryName(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Retourne le nom d'une catégorie selon la langue active ('fr' ou 'ar'),
 * compatible avec `name: { fr, ar }` ou `name: string` + `nameTranslations`.
 */
export function getCategoryDisplayName(
  cat: Pick<CategoryItem, 'name' | 'nameTranslations'> | OfficialCategoryDefinition,
  lang: 'fr' | 'ar' = 'fr'
): string {
  const rawName = (cat as any)?.name;
  if (rawName && typeof rawName === 'object') {
    return rawName[lang] || rawName.fr || '';
  }
  const translations = (cat as CategoryItem)?.nameTranslations;
  if (translations && translations[lang]) {
    return translations[lang];
  }
  return typeof rawName === 'string' ? rawName : '';
}

/**
 * Construction des 15 catégories officielles DzMahall au format `CategoryItem`
 * utilisé par Firestore, l'administration et la boutique publique.
 */
export const INITIAL_CATEGORIES: CategoryItem[] = CATEGORIES.map((def, index) => {
  const subcategories: SubCategoryItem[] = def.subcategories.map((subLabel, subIdx) => ({
    id: `sub-${def.id.replace(/^cat-/, '')}-${slugifyCategoryName(subLabel)}`,
    name: subLabel,
    description: subLabel,
    order: subIdx + 1,
    isActive: true,
  }));

  return {
    id: def.id,
    name: def.name.fr,
    nameTranslations: {
      fr: def.name.fr,
      ar: def.name.ar,
    },
    icon: def.icon,
    slug: def.slug,
    description: def.subcategories.join(' · '),
    order: index + 1,
    isActive: true,
    createdAt: `2026-03-01T08:${String(index).padStart(2, '0')}:00Z`,
    subcategories,
  };
});

export interface ResolvedProductCategory {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  categoryNameAr: string;
  subcategoryId: string;
  subcategoryName: string;
  isUncategorized: boolean;
  legacyLabel?: string;
  categoryItem?: CategoryItem;
  subcategoryItem?: SubCategoryItem;
}

/**
 * Correspondance fiable des anciens codes / identifiants de produits existants
 * vers les 15 catégories officielles DzMahall.
 * Tout code inconnu ou ambigu reste en « Non catégorisé ».
 */
function resolveReliableLegacyMapping(
  product: Pick<
    Product,
    'category' | 'categoryId' | 'categoryLabel' | 'subcategory' | 'subcategoryId' | 'subcategoryLabel'
  > & { name?: string }
): { targetCategoryId: string; targetSubcategoryName?: string } | null {
  const rawCat = String(product.categoryId || product.category || '').trim().toLowerCase();
  const rawLabel = String(product.categoryLabel || '').trim().toLowerCase();
  const rawSub = String(product.subcategory || product.subcategoryLabel || product.subcategoryId || '')
    .trim()
    .toLowerCase();
  const rawName = String(product.name || '').trim().toLowerCase();

  if (!rawCat && !rawLabel) return null;
  if (rawCat === UNCATEGORIZED_ID) return null;

  // 1. Anciens codes produits initiaux DzMahall
  if (rawCat === 'smart-tech') {
    return {
      targetCategoryId: 'cat-electronique-gadgets',
      targetSubcategoryName: 'Montres Connectées',
    };
  }
  if (rawCat === 'audio-wear') {
    return {
      targetCategoryId: 'cat-electronique-gadgets',
      targetSubcategoryName: 'Écouteurs & Casques',
    };
  }
  if (rawCat === 'auto-voyage') {
    if (rawLabel.includes('maroquinerie') || rawName.includes('sac à dos') || rawName.includes('sac a dos')) {
      return {
        targetCategoryId: 'cat-mode-sacs-accessoires',
        targetSubcategoryName: 'Sacs à Main & Sacs à Dos',
      };
    }
    return {
      targetCategoryId: 'cat-auto-moto',
      targetSubcategoryName: 'Multimédia & Écrans',
    };
  }
  if (rawCat === 'accessoires') {
    if (rawLabel.includes('beauté') || rawLabel.includes('beaute') || rawLabel.includes('soin') || rawName.includes('tondeuse')) {
      return {
        targetCategoryId: 'cat-beaute-coiffure-soins',
        targetSubcategoryName: 'Tondeuses & Rasoirs Homme',
      };
    }
    if (rawName.includes('lunettes')) {
      return {
        targetCategoryId: 'cat-mode-sacs-accessoires',
        targetSubcategoryName: 'Lunettes & Accessoires',
      };
    }
    if (rawName.includes('portefeuille') || rawName.includes('porte-cartes')) {
      return {
        targetCategoryId: 'cat-mode-sacs-accessoires',
        targetSubcategoryName: 'Portefeuilles & Porte-cartes',
      };
    }
    return {
      targetCategoryId: 'cat-mode-sacs-accessoires',
    };
  }
  if (rawCat === 'maison-lifestyle') {
    if (rawLabel.includes('bureau') || rawName.includes('lampe de bureau')) {
      return {
        targetCategoryId: 'cat-informatique-bureau',
        targetSubcategoryName: 'Lampes & Organisation Bureau',
      };
    }
    return {
      targetCategoryId: 'cat-decoration-eclairage',
      targetSubcategoryName: 'Lampes & Veilleuses LED',
    };
  }

  // 2. Anciennes 5 catégories intermédiaires
  if (rawCat === 'cat-electronique-high-tech') {
    if (rawSub.includes('ordinateur') || rawSub.includes('pc')) {
      return {
        targetCategoryId: 'cat-informatique-bureau',
        targetSubcategoryName: 'Accessoires PC Portable',
      };
    }
    if (rawSub.includes('audio')) {
      return {
        targetCategoryId: 'cat-electronique-gadgets',
        targetSubcategoryName: 'Écouteurs & Casques',
      };
    }
    return {
      targetCategoryId: 'cat-electronique-gadgets',
      targetSubcategoryName: 'Montres Connectées',
    };
  }
  if (rawCat === 'cat-mode-vetements') {
    return {
      targetCategoryId: 'cat-mode-sacs-accessoires',
    };
  }
  if (rawCat === 'cat-maison-decoration-jardin') {
    if (rawSub.includes('cuisine')) {
      return {
        targetCategoryId: 'cat-cuisine-art-table',
      };
    }
    if (rawSub.includes('bricolage') || rawSub.includes('jardin')) {
      return {
        targetCategoryId: 'cat-bricolage-outillage',
      };
    }
    if (rawSub.includes('decoration') || rawSub.includes('décoration')) {
      return {
        targetCategoryId: 'cat-decoration-eclairage',
      };
    }
    return {
      targetCategoryId: 'cat-maison-organisation',
    };
  }
  if (rawCat === 'cat-beaute-sante-bien-etre') {
    return {
      targetCategoryId: 'cat-beaute-coiffure-soins',
    };
  }
  if (rawCat === 'cat-sports-loisirs') {
    if (rawSub.includes('jeu') || rawSub.includes('jouet')) {
      return {
        targetCategoryId: 'cat-jouets-jeux-educatif',
      };
    }
    if (rawSub.includes('extérieur') || rawSub.includes('exterieur') || rawSub.includes('camping')) {
      return {
        targetCategoryId: 'cat-voyage-camping-plein-air',
      };
    }
    return {
      targetCategoryId: 'cat-sport-fitness-bien-etre',
    };
  }

  return null;
}

/**
 * Résout la catégorie et la sous-catégorie d'un produit à partir de son identifiant technique ou slug,
 * ou via un rattachement fiable pour les produits existants, sinon repli vers « Non catégorisé ».
 */
export function resolveProductCategory(
  product:
    | (Pick<
        Product,
        'category' | 'categoryId' | 'categoryLabel' | 'subcategory' | 'subcategoryId' | 'subcategoryLabel'
      > & { name?: string })
    | null
    | undefined,
  categories: CategoryItem[]
): ResolvedProductCategory {
  if (!product) {
    return {
      categoryId: UNCATEGORIZED_ID,
      categorySlug: UNCATEGORIZED_ID,
      categoryName: UNCATEGORIZED_LABEL,
      categoryNameAr: UNCATEGORIZED_LABEL_AR,
      subcategoryId: '',
      subcategoryName: '',
      isUncategorized: true,
    };
  }
  const rawCatKey = String(product.categoryId || product.category || '').trim();

  // 1. Recherche directe par id, slug ou nom exact
  let matchedCat = categories.find(
    (c) =>
      c.id === rawCatKey ||
      c.slug === rawCatKey ||
      getCategoryDisplayName(c, 'fr').toLowerCase() === rawCatKey.toLowerCase()
  );

  let fallbackSubName = String(
    product.subcategory || product.subcategoryLabel || ''
  ).trim();

  // 2. Si non trouvé directement, vérifier si le produit existant a une catégorie identifiable de façon fiable
  if (!matchedCat && rawCatKey && rawCatKey !== UNCATEGORIZED_ID) {
    const legacyMatch = resolveReliableLegacyMapping(product);
    if (legacyMatch) {
      matchedCat = categories.find((c) => c.id === legacyMatch.targetCategoryId);
      if (!fallbackSubName && legacyMatch.targetSubcategoryName) {
        fallbackSubName = legacyMatch.targetSubcategoryName;
      }
    }
  }

  if (!matchedCat) {
    return {
      categoryId: UNCATEGORIZED_ID,
      categorySlug: UNCATEGORIZED_ID,
      categoryName: UNCATEGORIZED_LABEL,
      categoryNameAr: UNCATEGORIZED_LABEL_AR,
      subcategoryId: '',
      subcategoryName: fallbackSubName,
      isUncategorized: true,
      legacyLabel:
        product.categoryLabel && product.categoryLabel !== UNCATEGORIZED_LABEL
          ? product.categoryLabel
          : undefined,
    };
  }

  const rawSubId = String(product.subcategoryId || '').trim();
  const rawSubName = fallbackSubName.toLowerCase();

  const matchedSub = matchedCat.subcategories.find(
    (s) =>
      (rawSubId && s.id === rawSubId) ||
      (rawSubName && s.name.trim().toLowerCase() === rawSubName) ||
      (rawSubId && s.name.trim().toLowerCase() === rawSubId.toLowerCase())
  );

  return {
    categoryId: matchedCat.id,
    categorySlug: matchedCat.slug,
    categoryName: getCategoryDisplayName(matchedCat, 'fr'),
    categoryNameAr: getCategoryDisplayName(matchedCat, 'ar') || getCategoryDisplayName(matchedCat, 'fr'),
    subcategoryId: matchedSub ? matchedSub.id : '',
    subcategoryName: matchedSub ? matchedSub.name : fallbackSubName,
    isUncategorized: false,
    categoryItem: matchedCat,
    subcategoryItem: matchedSub,
  };
}
