import * as XLSX from 'xlsx';
import { Product } from '../types';

export interface RawRowData {
  [key: string]: any;
}

export interface DzFieldDefinition {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  aliases: string[];
}

export const DZ_PRODUCT_FIELDS: DzFieldDefinition[] = [
  {
    key: 'name',
    label: 'Nom du Produit',
    required: true,
    type: 'string',
    description: 'Titre complet ou désignation commerciale du produit',
    aliases: ['nom', 'name', 'titre', 'title', 'produit', 'product', 'designation', 'libelle', 'label'],
  },
  {
    key: 'price',
    label: 'Prix de Vente (DZD)',
    required: true,
    type: 'number',
    description: 'Prix public facturé au client en Dinars Algériens',
    aliases: ['prix', 'price', 'prix de vente', 'pv', 'tarif', 'amount', 'prix_vente', 'regular_price', 'prix dzd'],
  },
  {
    key: 'originalPrice',
    label: 'Prix Barré / Réduit (DZD)',
    required: false,
    type: 'number',
    description: 'Prix avant réduction pour afficher un badge de promotion',
    aliases: ['prix_original', 'prix original', 'original_price', 'prix_barre', 'barre', 'ancien_prix', 'promo', 'compare_at_price'],
  },
  {
    key: 'purchaseCost',
    label: "Coût d'Achat (DZD)",
    required: false,
    type: 'number',
    description: "Prix d'achat fournisseur pour le calcul automatique de marge",
    aliases: ['cout_achat', 'cout', 'cost', 'prix_achat', 'purchase_cost', 'achat', 'fournisseur'],
  },
  {
    key: 'sku',
    label: 'SKU / Référence Unique',
    required: false,
    type: 'string',
    description: 'Code référence unique (ex: DZM-PROD-01) pour traçabilité et détection de doublons',
    aliases: ['sku', 'ref', 'reference', 'code', 'barcode', 'ean', 'reference_produit', 'article_code'],
  },
  {
    key: 'category',
    label: 'Catégorie',
    required: false,
    type: 'string',
    description: 'Catégorie (smart-tech, audio-wear, accessoires, auto-voyage, maison-lifestyle)',
    aliases: ['categorie', 'category', 'rayon', 'famille', 'type', 'collection'],
  },
  {
    key: 'stockQuantity',
    label: 'Stock Disponible',
    required: false,
    type: 'number',
    description: 'Quantité d\'unités physiques disponibles en stock (défaut: 30)',
    aliases: ['stock', 'quantite', 'quantity', 'qte', 'stock_quantity', 'qty', 'disponible', 'inventory'],
  },
  {
    key: 'description',
    label: 'Description Détaillée',
    required: false,
    type: 'string',
    description: 'Présentation complète du produit et argumentaire',
    aliases: ['description', 'details', 'detail', 'desc', 'resume', 'caracteristiques', 'body'],
  },
  {
    key: 'imageUrls',
    label: 'Images (URLs)',
    required: false,
    type: 'array',
    description: 'URLs web directes des photos séparées par virgules ou points-virgules',
    aliases: ['image', 'images', 'photos', 'photo', 'image_url', 'image_urls', 'picture', 'pictures', 'visuels'],
  },
  {
    key: 'variants',
    label: 'Variantes / Couleurs / Tailles',
    required: false,
    type: 'string',
    description: 'Liste des déclinaisons (ex: "Noir: 15, Blanc: 15" ou "S, M, L")',
    aliases: ['variantes', 'variants', 'couleurs', 'colors', 'tailles', 'sizes', 'options', 'declinaisons'],
  },
  {
    key: 'isActive',
    label: 'Statut Actif (Oui/Non)',
    required: false,
    type: 'boolean',
    description: 'Activer immédiatement le produit dans le catalogue (Oui/Non, 1/0, true/false)',
    aliases: ['actif', 'active', 'status', 'statut', 'is_active', 'enabled', 'publie'],
  },
];

export interface ColumnMapping {
  [sourceColumn: string]: string; // sourceColumn -> dzKey (or empty if ignored)
}

export interface RowValidationResult {
  rowNumber: number;
  rawRow: RawRowData;
  parsedProduct?: Partial<Product>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  duplicateReason?: string;
  matchedExistingProduct?: Product;
}

/**
 * SSRF Safe URL Check: strictly reject private IP ranges, localhost and metadata endpoints
 */
export function isSafeRemoteUrl(urlString: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Protocole non supporté. Seuls HTTP et HTTPS sont autorisés.' };
    }

    const host = parsed.hostname.toLowerCase();

    // Check localhost & loopback
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local')
    ) {
      return { safe: false, reason: 'Les adresses locales (localhost/loopback) sont interdites pour des raisons de sécurité.' };
    }

    // Check internal cloud metadata
    if (host === '169.254.169.254' || host === 'metadata.google.internal' || host.includes('metadata')) {
      return { safe: false, reason: 'Accès aux métadonnées cloud strictement interdit.' };
    }

    // Check private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = host.match(ipv4Regex);
    if (match) {
      const b0 = parseInt(match[1], 10);
      const b1 = parseInt(match[2], 10);

      if (b0 === 10) {
        return { safe: false, reason: 'Adresse IP privée (10.0.0.0/8) interdite.' };
      }
      if (b0 === 172 && b1 >= 16 && b1 <= 31) {
        return { safe: false, reason: 'Adresse IP privée (172.16.0.0/12) interdite.' };
      }
      if (b0 === 192 && b1 === 168) {
        return { safe: false, reason: 'Adresse IP privée (192.168.0.0/16) interdite.' };
      }
      if (b0 === 169 && b1 === 254) {
        return { safe: false, reason: 'Adresse Link-Local (169.254.0.0/16) interdite.' };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'URL malformée ou invalide.' };
  }
}

/**
 * Intelligent column auto-matching with accent normalization
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  const normalizeStr = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  for (const header of headers) {
    const cleanHeader = normalizeStr(header);
    let matchedKey = '';

    // Phase 1: Exact key, label, or exact alias match
    for (const field of DZ_PRODUCT_FIELDS) {
      if (cleanHeader === normalizeStr(field.key) || cleanHeader === normalizeStr(field.label)) {
        matchedKey = field.key;
        break;
      }
      if (field.aliases.some((alias) => cleanHeader === normalizeStr(alias))) {
        matchedKey = field.key;
        break;
      }
    }

    // Phase 2: If no exact match, try longest substring match
    if (!matchedKey) {
      let bestAliasLen = 0;
      for (const field of DZ_PRODUCT_FIELDS) {
        for (const alias of field.aliases) {
          const cleanAlias = normalizeStr(alias);
          if (cleanAlias.length >= 3 && cleanHeader.includes(cleanAlias)) {
            if (cleanAlias.length > bestAliasLen) {
              bestAliasLen = cleanAlias.length;
              matchedKey = field.key;
            }
          }
        }
      }
    }

    mapping[header] = matchedKey;
  }

  return mapping;
}

/**
 * Parse CSV text into array of rows
 */
export function parseCsvText(csvText: string): { headers: string[]; rows: RawRowData[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter: comma, semicolon, tab
  const firstLine = lines[0];
  let delimiter = ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  // Helper to parse line with quotes
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rawHeaders = parseLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows: RawRowData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const rowObj: RawRowData = {};
    let hasAnyData = false;

    rawHeaders.forEach((header, idx) => {
      const val = values[idx] !== undefined ? values[idx].replace(/^["']|["']$/g, '').trim() : '';
      rowObj[header] = val;
      if (val) hasAnyData = true;
    });

    if (hasAnyData) {
      rows.push(rowObj);
    }
  }

  return { headers: rawHeaders, rows };
}

/**
 * Parse XLSX / XLS binary buffer or ArrayBuffer
 */
export function parseXlsxBuffer(buffer: ArrayBuffer | Uint8Array): { headers: string[]; rows: RawRowData[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) return { headers: [], rows: [] };

  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (jsonData.length === 0) return { headers: [], rows: [] };

  const rawHeaders = (jsonData[0] || []).map((h) => String(h || '').trim()).filter((h) => h.length > 0);
  const rows: RawRowData[] = [];

  for (let i = 1; i < jsonData.length; i++) {
    const rowArray = jsonData[i];
    if (!rowArray || rowArray.length === 0) continue;

    const rowObj: RawRowData = {};
    let hasAnyData = false;

    rawHeaders.forEach((header, idx) => {
      const val = rowArray[idx] !== undefined ? String(rowArray[idx]).trim() : '';
      rowObj[header] = val;
      if (val) hasAnyData = true;
    });

    if (hasAnyData) {
      rows.push(rowObj);
    }
  }

  return { headers: rawHeaders, rows };
}

/**
 * Parse JSON string into rows
 */
export function parseJsonText(jsonText: string): { headers: string[]; rows: RawRowData[] } {
  const parsed = JSON.parse(jsonText);
  let arrayData: any[] = [];

  if (Array.isArray(parsed)) {
    arrayData = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.products)) arrayData = parsed.products;
    else if (Array.isArray(parsed.items)) arrayData = parsed.items;
    else if (Array.isArray(parsed.data)) arrayData = parsed.data;
    else arrayData = [parsed];
  }

  if (arrayData.length === 0) return { headers: [], rows: [] };

  // Collect all unique keys
  const headerSet = new Set<string>();
  arrayData.forEach((item) => {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach((k) => headerSet.add(k));
    }
  });

  const headers = Array.from(headerSet);
  const rows: RawRowData[] = arrayData.map((item) => {
    const row: RawRowData = {};
    headers.forEach((h) => {
      const v = item[h];
      row[h] = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '').trim();
    });
    return row;
  });

  return { headers, rows };
}

/**
 * Parse basic XML feed into rows
 */
export function parseXmlText(xmlText: string): { headers: string[]; rows: RawRowData[] } {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Check for parser errors
  const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Fichier XML invalide ou malformé : ' + parserError.textContent);
  }

  // Look for product or item elements
  const candidates = ['product', 'item', 'article', 'record', 'row'];
  let itemNodes: Element[] = [];

  for (const tag of candidates) {
    const nodes = Array.from(xmlDoc.getElementsByTagName(tag));
    if (nodes.length > 0) {
      itemNodes = nodes;
      break;
    }
  }

  if (itemNodes.length === 0) {
    // If no candidate, try all direct children of root
    const root = xmlDoc.documentElement;
    itemNodes = Array.from(root.children);
  }

  if (itemNodes.length === 0) return { headers: [], rows: [] };

  const headerSet = new Set<string>();
  const rawRows: RawRowData[] = [];

  itemNodes.forEach((node) => {
    const rowObj: RawRowData = {};
    Array.from(node.children).forEach((child) => {
      const key = child.tagName;
      const text = child.textContent?.trim() || '';
      headerSet.add(key);
      rowObj[key] = text;
    });
    if (Object.keys(rowObj).length > 0) {
      rawRows.push(rowObj);
    }
  });

  return { headers: Array.from(headerSet), rows: rawRows };
}

/**
 * Normalize and validate rows according to DzMahall constraints
 */
export function validateImportRows(
  rows: RawRowData[],
  mapping: ColumnMapping,
  existingProducts: Product[]
): RowValidationResult[] {
  const existingSkus = new Set(existingProducts.map((p) => p.sku.trim().toUpperCase()));
  const existingSlugs = new Set(existingProducts.map((p) => p.slug.trim().toLowerCase()));
  const seenSkusInFile = new Map<string, number>();

  return rows.map((rawRow, index) => {
    const rowNumber = index + 1;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract mapped values
    const getMappedVal = (dzKey: string): any => {
      for (const [sourceCol, targetKey] of Object.entries(mapping)) {
        if (targetKey === dzKey && rawRow[sourceCol] !== undefined) {
          return rawRow[sourceCol];
        }
      }
      return undefined;
    };

    // 1. Name validation
    const rawName = String(getMappedVal('name') || '').trim();
    if (!rawName) {
      errors.push('Le nom du produit est obligatoire.');
    }

    // 2. Price validation
    const rawPrice = getMappedVal('price');
    const cleanedPriceStr = String(rawPrice || '')
      .replace(/[^0-9.,-]/g, '')
      .replace(',', '.');
    const priceNum = parseFloat(cleanedPriceStr);

    if (isNaN(priceNum) || priceNum <= 0) {
      errors.push(`Prix de vente invalide ("${rawPrice}"). Doit être un montant numérique strictement supérieur à 0 DZD.`);
    }

    // 3. Original / Reduced price validation
    const rawOriginalPrice = getMappedVal('originalPrice');
    let originalPriceNum: number | undefined = undefined;
    if (rawOriginalPrice !== undefined && String(rawOriginalPrice).trim() !== '') {
      const cleanedOrigStr = String(rawOriginalPrice).replace(/[^0-9.,-]/g, '').replace(',', '.');
      const parsedOrig = parseFloat(cleanedOrigStr);
      if (!isNaN(parsedOrig) && parsedOrig > priceNum) {
        originalPriceNum = parsedOrig;
      } else if (!isNaN(parsedOrig) && parsedOrig > 0 && parsedOrig <= priceNum) {
        warnings.push(`Prix barré (${parsedOrig} DZD) inférieur ou égal au prix de vente (${priceNum} DZD) : ignoré.`);
      }
    }

    // 4. Purchase Cost
    const rawCost = getMappedVal('purchaseCost');
    let purchaseCostNum = 0;
    if (rawCost !== undefined && String(rawCost).trim() !== '') {
      const cleanedCostStr = String(rawCost).replace(/[^0-9.,-]/g, '').replace(',', '.');
      const parsedCost = parseFloat(cleanedCostStr);
      if (!isNaN(parsedCost) && parsedCost >= 0) {
        purchaseCostNum = parsedCost;
      }
    }

    // 5. Stock Quantity
    const rawStock = getMappedVal('stockQuantity');
    let stockNum = 30; // default
    if (rawStock !== undefined && String(rawStock).trim() !== '') {
      const cleanedStockStr = String(rawStock).replace(/[^0-9-]/g, '');
      const parsedStock = parseInt(cleanedStockStr, 10);
      if (!isNaN(parsedStock) && parsedStock >= 0) {
        stockNum = parsedStock;
      } else {
        warnings.push('Quantité en stock négative ou non numérique : valeur par défaut 30 appliquée.');
      }
    }

    // 6. Category mapping (do not arbitrarily assign a category if unknown -> use 'uncategorized')
    const rawCat = String(getMappedVal('category') || '').trim().toLowerCase();
    let category: Product['category'] = 'uncategorized';
    let categoryLabel = 'Non catégorisé';

    if (rawCat.includes('auto') || rawCat.includes('moto') || rawCat.includes('voiture')) {
      category = 'cat-auto-moto';
      categoryLabel = 'Accessoires Auto/Moto';
    } else if (
      rawCat.includes('electronique') ||
      rawCat.includes('électronique') ||
      rawCat.includes('gadget') ||
      rawCat.includes('smart-tech') ||
      rawCat.includes('audio') ||
      rawCat.includes('ecouteur') ||
      rawCat.includes('montre connectee')
    ) {
      category = 'cat-electronique-gadgets';
      categoryLabel = 'Électronique & Gadgets';
    } else if (
      rawCat.includes('informatique') ||
      rawCat.includes('bureau') ||
      rawCat.includes('pc') ||
      rawCat.includes('ordinateur')
    ) {
      category = 'cat-informatique-bureau';
      categoryLabel = 'Informatique & Bureau';
    } else if (rawCat.includes('cuisine') || rawCat.includes('table') || rawCat.includes('cuisson')) {
      category = 'cat-cuisine-art-table';
      categoryLabel = 'Cuisine & Art de la Table';
    } else if (rawCat.includes('organisation') || rawCat === 'maison') {
      category = 'cat-maison-organisation';
      categoryLabel = 'Maison & Organisation';
    } else if (
      rawCat.includes('decoration') ||
      rawCat.includes('décoration') ||
      rawCat.includes('eclairage') ||
      rawCat.includes('éclairage') ||
      rawCat.includes('lampe')
    ) {
      category = 'cat-decoration-eclairage';
      categoryLabel = 'Décoration & Éclairage';
    } else if (rawCat.includes('bricolage') || rawCat.includes('outillage') || rawCat.includes('outil')) {
      category = 'cat-bricolage-outillage';
      categoryLabel = 'Bricolage & Outillage';
    } else if (rawCat.includes('voyage') || rawCat.includes('camping') || rawCat.includes('plage')) {
      category = 'cat-voyage-camping-plein-air';
      categoryLabel = 'Voyage, Camping & Plein Air';
    } else if (
      rawCat.includes('beaute') ||
      rawCat.includes('beauté') ||
      rawCat.includes('coiffure') ||
      rawCat.includes('soin') ||
      rawCat.includes('tondeuse')
    ) {
      category = 'cat-beaute-coiffure-soins';
      categoryLabel = 'Beauté, Coiffure & Soins';
    } else if (
      rawCat.includes('bebe') ||
      rawCat.includes('bébé') ||
      rawCat.includes('enfant') ||
      rawCat.includes('maternite')
    ) {
      category = 'cat-bebe-enfants-maternite';
      categoryLabel = 'Bébé, Enfants & Maternité';
    } else if (rawCat.includes('jouet') || rawCat.includes('jeu') || rawCat.includes('educatif')) {
      category = 'cat-jouets-jeux-educatif';
      categoryLabel = 'Jouets, Jeux & Éducatif';
    } else if (
      rawCat.includes('mode') ||
      rawCat.includes('sac') ||
      rawCat.includes('accessoire') ||
      rawCat.includes('portefeuille') ||
      rawCat.includes('lunette')
    ) {
      category = 'cat-mode-sacs-accessoires';
      categoryLabel = 'Mode, Sacs & Accessoires';
    } else if (rawCat.includes('sport') || rawCat.includes('fitness') || rawCat.includes('musculation')) {
      category = 'cat-sport-fitness-bien-etre';
      categoryLabel = 'Sport, Fitness & Bien-être';
    } else if (
      rawCat.includes('saisonnier') ||
      rawCat.includes('ramadan') ||
      rawCat.includes('evenement')
    ) {
      category = 'cat-saisonnier-evenements';
      categoryLabel = 'Saisonnier & Événements';
    } else if (rawCat.includes('pack') || rawCat.includes('promo') || rawCat.includes('offre')) {
      category = 'cat-packs-promo-offres';
      categoryLabel = 'Packs Promo & Offres Spéciales';
    }

    // 7. SKU & Duplicate check
    let rawSku = String(getMappedVal('sku') || '').trim().toUpperCase();
    if (!rawSku) {
      // Auto generate safe SKU from name
      const prefix = rawName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PRD') || 'PRD';
      rawSku = `DZM-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    let isDuplicate = false;
    let duplicateReason: string | undefined = undefined;
    let matchedExistingProduct: Product | undefined = undefined;

    if (existingSkus.has(rawSku)) {
      isDuplicate = true;
      duplicateReason = `Le SKU « ${rawSku} » existe déjà dans votre catalogue.`;
      matchedExistingProduct = existingProducts.find((p) => p.sku.trim().toUpperCase() === rawSku);
    } else if (seenSkusInFile.has(rawSku)) {
      isDuplicate = true;
      duplicateReason = `Doublon interne dans le fichier : SKU « ${rawSku} » déjà présent à la ligne ${seenSkusInFile.get(rawSku)}.`;
    } else {
      seenSkusInFile.set(rawSku, rowNumber);
    }

    // 8. Images parsing
    const rawImages = getMappedVal('imageUrls');
    let imageUrls: string[] = [];
    if (rawImages) {
      if (Array.isArray(rawImages)) {
        imageUrls = rawImages.map(String).filter((u) => u.startsWith('http'));
      } else {
        const split = String(rawImages)
          .split(/[,;\n|]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        imageUrls = split.filter((url) => {
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            warnings.push(`Image non-URL ignorée : "${url.slice(0, 30)}..."`);
            return false;
          }
          return true;
        });
      }
    }

    if (imageUrls.length === 0) {
      imageUrls = ['https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80'];
      warnings.push('Aucune image valide trouvée : visuel générique DzMahall assigné.');
    }

    // 9. Description & Features
    const rawDesc = String(getMappedVal('description') || '').trim();
    const finalDesc =
      rawDesc ||
      `${rawName} — Article haute qualité vérifié par DzMahall, compatible avec la livraison rapide et le paiement à la réception 58 Wilayas.`;

    // 10. Status
    const rawStatus = getMappedVal('isActive');
    let isActive = true;
    if (rawStatus !== undefined) {
      const s = String(rawStatus).trim().toLowerCase();
      if (s === 'non' || s === 'false' || s === '0' || s === 'inactif' || s === 'brouillon' || s === 'draft') {
        isActive = false;
      }
    }

    // 11. Slug generation
    let cleanSlug = rawName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (!cleanSlug) cleanSlug = `produit-${Date.now()}`;
    if (existingSlugs.has(cleanSlug) && !matchedExistingProduct) {
      cleanSlug = `${cleanSlug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    // Parsed product preview
    const parsedProduct: Partial<Product> = {
      name: rawName,
      slug: cleanSlug,
      category,
      categoryLabel,
      price: priceNum,
      originalPrice: originalPriceNum,
      purchaseCost: purchaseCostNum,
      advertisingCost: 450,
      packagingCost: 120,
      sku: rawSku,
      stockQuantity: stockNum,
      description: finalDesc,
      features: [
        'Qualité vérifiée DzMahall',
        'Paiement à la livraison après inspection',
        'Livraison express 58 Wilayas',
      ],
      imageUrls,
      images: imageUrls.map((url, idx) => ({
        id: `img-imp-${idx}-${Date.now()}`,
        url,
        isPrimary: idx === 0,
        source: 'url',
      })),
      variants: [
        {
          id: `var-std-${Date.now()}`,
          name: 'Standard',
          stock: stockNum,
          sku: `${rawSku}-STD`,
        },
      ],
      isActive,
      isFeatured: false,
    };

    return {
      rowNumber,
      rawRow,
      parsedProduct,
      isValid: errors.length === 0,
      errors,
      warnings,
      isDuplicate,
      duplicateReason,
      matchedExistingProduct,
    };
  });
}

/**
 * Generate CSV template with expected DzMahall product columns and 2 realistic rows
 */
export function generateProductCsvTemplate(): string {
  const headers = [
    'Nom du Produit',
    'Prix de Vente',
    'Prix Original',
    'Cout Achat',
    'SKU',
    'Categorie',
    'Stock',
    'Description',
    'Images URLs',
    'Statut',
  ];

  const sampleRows = [
    [
      'Écouteurs Pro Sans Fil ANC V3',
      '3900',
      '5500',
      '1800',
      'DZM-EAR-V3',
      'audio-wear',
      '40',
      'Écouteurs haute définition avec réduction active du bruit ambiant et autonomie 30h.',
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
      'Actif',
    ],
    [
      'Support Téléphone Voiture Magnétique MagSafe',
      '2200',
      '3000',
      '850',
      'DZM-HLD-04',
      'auto-voyage',
      '50',
      'Fixation grille d aération ultra stable avec aimants néodyme renforcés pour routes algériennes.',
      'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=800&q=80',
      'Actif',
    ],
  ];

  const formatLine = (arr: string[]) => arr.map((item) => `"${item.replace(/"/g, '""')}"`).join(',');

  return [formatLine(headers), ...sampleRows.map(formatLine)].join('\n');
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: string | Blob, fileName: string, mimeType: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export products to CSV
 */
export function exportProductsToCsv(products: Product[]): void {
  const headers = [
    'ID',
    'Nom du Produit',
    'Slug',
    'SKU',
    'Categorie',
    'Prix de Vente (DZD)',
    'Prix Original (DZD)',
    'Cout Achat (DZD)',
    'Stock',
    'Statut',
    'Top Vente',
    'Nombre Variantes',
    'Nombre Images',
    'Date Creation',
  ];

  const rows = products.map((p) => [
    p.id,
    p.name,
    p.slug,
    p.sku,
    p.categoryLabel || p.category,
    p.price,
    p.originalPrice || '',
    p.purchaseCost || 0,
    p.stockQuantity,
    p.isActive ? 'Actif' : 'Désactivé',
    p.isFeatured ? 'Oui' : 'Non',
    p.variants?.length || 1,
    p.imageUrls?.length || 1,
    p.createdAt ? p.createdAt.slice(0, 10) : '',
  ]);

  const formatLine = (arr: (string | number)[]) =>
    arr.map((item) => `"${String(item).replace(/"/g, '""')}"`).join(',');

  const csvContent = '\uFEFF' + [formatLine(headers), ...rows.map(formatLine)].join('\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(csvContent, `produits_dzmahall_${dateStr}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Export products to Excel XLSX
 */
export function exportProductsToXlsx(products: Product[]): void {
  const rows = products.map((p) => ({
    'Identifiant ID': p.id,
    'Nom du Produit': p.name,
    'Référence SKU': p.sku,
    'Catégorie': p.categoryLabel || p.category,
    'Prix de Vente (DZD)': p.price,
    'Prix Original (DZD)': p.originalPrice || null,
    'Coût d\'Achat (DZD)': p.purchaseCost || 0,
    'Marge Brute (DZD)': p.price - (p.purchaseCost || 0),
    'Stock Disponible': p.stockQuantity,
    'Statut': p.isActive ? 'Actif' : 'Désactivé',
    'Top Vente': p.isFeatured ? 'Oui' : 'Non',
    'Variantes': p.variants?.map((v) => `${v.name} (${v.stock})`).join(', ') || 'Standard',
    'Images Principales': p.imageUrls?.join(' | ') || '',
    'Date de Création': p.createdAt ? p.createdAt.slice(0, 10) : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Catalogue DzMahall');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(blob, `catalogue_dzmahall_${dateStr}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/**
 * Export validation errors report to CSV
 */
export function exportErrorsToCsv(validationResults: RowValidationResult[]): void {
  const errorRows = validationResults.filter((r) => !r.isValid || r.isDuplicate);
  if (errorRows.length === 0) return;

  const headers = ['Ligne', 'Produit / Nom Détecté', 'SKU Détecté', 'Statut', 'Erreurs', 'Avertissements'];

  const rows = errorRows.map((r) => [
    r.rowNumber,
    r.parsedProduct?.name || 'Inconnu',
    r.parsedProduct?.sku || 'Inconnu',
    !r.isValid ? 'Invalide' : r.isDuplicate ? 'Doublon' : 'Avertissement',
    r.errors.join(' | ') || (r.isDuplicate ? r.duplicateReason || 'Doublon' : 'Aucune'),
    r.warnings.join(' | ') || 'Aucun',
  ]);

  const formatLine = (arr: (string | number)[]) =>
    arr.map((item) => `"${String(item).replace(/"/g, '""')}"`).join(',');

  const csvContent = '\uFEFF' + [formatLine(headers), ...rows.map(formatLine)].join('\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(csvContent, `rapport_erreurs_import_dzmahall_${dateStr}.csv`, 'text/csv;charset=utf-8;');
}
