import { Product } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Montre Connectée Ultra Pro Titanium AMOLED',
    slug: 'montre-connectee-ultra-pro-titanium',
    category: 'cat-electronique-gadgets',
    categoryId: 'cat-electronique-gadgets',
    categoryLabel: 'Électronique & Gadgets',
    subcategory: 'Montres Connectées',
    subcategoryId: 'sub-electronique-gadgets-montres-connectees',
    subcategoryLabel: 'Montres Connectées',
    price: 4900,
    originalPrice: 6500,
    purchaseCost: 2200,
    advertisingCost: 650,
    packagingCost: 150,
    sku: 'DZM-WTCH-01',
    stockQuantity: 42,
    description: 'La montre connectée nouvelle génération avec boîtier titane résistant aux chocs, écran AMOLED ultra lumineux de 2,02 pouces, autonomie jusqu\'à 7 jours, appels Bluetooth HD et capteurs complets (rythme cardiaque, sommeil, oxygène SpO2). Livrée avec 2 bracelets interchangeables (silicone sport + nylon tressé orange).',
    features: [
      'Écran AMOLED 2.02" Haute Résolution 410x502',
      'Appels Bluetooth HD & Notifications SMS / WhatsApp',
      'Boîtier en alliage de Titane aérospatial & Étanche IP68',
      'Suivi complet de la santé et plus de 100 modes sportifs',
      'Autonomie longue durée : jusqu\'à 7 jours en usage actif',
      'Pack complet avec 2 bracelets inclus (Noir & Orange)'
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=800&q=80'
    ],
    variants: [
      { id: 'v1-black', name: 'Édition Titane Noir (2 Bracelets)', color: '#1E293B', stock: 24, sku: 'DZM-WTCH-01-BLK' },
      { id: 'v1-orange', name: 'Édition Titane Orange DzMahall (2 Bracelets)', color: '#EA580C', stock: 18, sku: 'DZM-WTCH-01-ORG' }
    ],
    isActive: true,
    isFeatured: true,
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'prod-2',
    name: 'Écouteurs Sans Fil Pro ANC Réduction de Bruit',
    slug: 'ecouteurs-sans-fil-pro-anc',
    category: 'cat-electronique-gadgets',
    categoryId: 'cat-electronique-gadgets',
    categoryLabel: 'Électronique & Gadgets',
    subcategory: 'Écouteurs & Casques',
    subcategoryId: 'sub-electronique-gadgets-ecouteurs-casques',
    subcategoryLabel: 'Écouteurs & Casques',
    price: 3800,
    originalPrice: 5200,
    purchaseCost: 1600,
    advertisingCost: 550,
    packagingCost: 120,
    sku: 'DZM-EAR-02',
    stockQuantity: 35,
    description: 'Immersion acoustique totale avec la réduction active de bruit hybride (ANC jusqu\'à -35dB). Son stéréo haute définition avec basses profondes percutantes, 4 microphones avec technologie ENC pour des appels d\'une clarté absolue même dans la rue ou en transport. Boîtier compact à recharge rapide USB-C.',
    features: [
      'Réduction active de bruit Hybride ANC & Mode Transparence',
      'Bluetooth 5.3 avec connexion instantanée sans latence',
      'Autonomie 32h avec le boîtier de recharge (7h par écoute)',
      '4 Microphones HD avec réduction du bruit ambiant en appel',
      'Contrôle tactile intelligent du volume et des pistes',
      'Embouts ergonomiques en silicone médical (3 tailles S/M/L)'
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80'
    ],
    variants: [
      { id: 'v2-white', name: 'Blanc Céramique Nacré', color: '#F8FAFC', stock: 20, sku: 'DZM-EAR-02-WHT' },
      { id: 'v2-black', name: 'Noir Mat Furtif', color: '#0F172A', stock: 15, sku: 'DZM-EAR-02-BLK' }
    ],
    isActive: true,
    isFeatured: true,
    createdAt: '2026-03-02T11:00:00Z',
  },
  {
    id: 'prod-3',
    name: 'Sac à Dos Antivol Étanche Urbain Business & Voyage',
    slug: 'sac-a-dos-antivol-etanche-urbain',
    category: 'cat-mode-sacs-accessoires',
    categoryId: 'cat-mode-sacs-accessoires',
    categoryLabel: 'Mode, Sacs & Accessoires',
    subcategory: 'Sacs à Main & Sacs à Dos',
    subcategoryId: 'sub-mode-sacs-accessoires-sacs-a-main-sacs-a-dos',
    subcategoryLabel: 'Sacs à Main & Sacs à Dos',
    price: 4500,
    originalPrice: 5900,
    purchaseCost: 2000,
    advertisingCost: 600,
    packagingCost: 180,
    sku: 'DZM-BAG-03',
    stockQuantity: 28,
    description: 'Conçu pour les déplacements professionnels, les études et les voyages en Algérie. Tissu Oxford déperlant indéchirable et imperméable, fermeture éclair dissimulée antivol avec cadenas TSA, port USB externe pour recharger votre smartphone en marchant, compartiment antichoc renforcé pour PC portable jusqu\'à 15.6 pouces.',
    features: [
      'Fermeture dorsale 100% antivol & cadenas à combinaison TSA',
      'Matière Oxford hydrofuge imperméable haute densité',
      'Port de charge USB externe avec câble intérieur inclus',
      'Compartiment matelassé pour ordinateur portable 15.6" et tablette',
      'Bande réfléchissante de sécurité pour déplacements nocturnes',
      'Dos thermoformé respirant anti-transpiration grand confort'
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=800&q=80'
    ],
    variants: [
      { id: 'v3-grey', name: 'Gris Carbone Texturé', color: '#475569', stock: 16, sku: 'DZM-BAG-03-GRY' },
      { id: 'v3-black', name: 'Noir Ébène Business', color: '#090D16', stock: 12, sku: 'DZM-BAG-03-BLK' }
    ],
    isActive: true,
    isFeatured: true,
    createdAt: '2026-03-03T12:00:00Z',
  },
  {
    id: 'prod-4',
    name: 'Pack Lunettes Polarisées Aviateur UV400 + Étui Cuir',
    slug: 'pack-lunettes-polarisees-aviateur',
    category: 'cat-mode-sacs-accessoires',
    categoryId: 'cat-mode-sacs-accessoires',
    categoryLabel: 'Mode, Sacs & Accessoires',
    subcategory: 'Lunettes & Accessoires',
    subcategoryId: 'sub-mode-sacs-accessoires-lunettes-accessoires',
    subcategoryLabel: 'Lunettes & Accessoires',
    price: 2900,
    originalPrice: 4200,
    purchaseCost: 1100,
    advertisingCost: 480,
    packagingCost: 120,
    sku: 'DZM-SUN-04',
    stockQuantity: 50,
    description: 'Protection solaire maximale UV400 catégorie 3 et verres polarisés haute définition éliminant tous les reflets parasites au volant ou en plein soleil. Monture métallique ultra légère en alliage d\'aluminium-magnésium avec charnières flexibles à ressort. Livré dans un coffret premium avec étui rigide, chiffonnette microfibre et carte de test polarisante.',
    features: [
      'Verres TAC polarisés multicouches avec protection totale UV400',
      'Monture en aluminium-magnésium ultra légère (seulement 26g)',
      'Charnières souples s\'adaptant à toutes les formes de visage',
      'Plaquettes de nez en silicone souple anti-glisse',
      'Idéal pour la conduite en Algérie, voyage et sorties plage',
      'Inclus : Étui rigide simili-cuir, lingette microfibre et carte test'
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=800&q=80'
    ],
    variants: [
      { id: 'v4-black', name: 'Verres Noirs Polarisés / Monture Noire', color: '#18181B', stock: 28, sku: 'DZM-SUN-04-BLK' },
      { id: 'v4-silver', name: 'Verres Miroir Argent / Monture Gunmetal', color: '#94A3B8', stock: 22, sku: 'DZM-SUN-04-SLV' }
    ],
    isActive: true,
    isFeatured: true,
    createdAt: '2026-03-04T09:00:00Z',
  },
  {
    id: 'prod-5',
    name: 'Support Voiture MagSafe Induction Charge Rapide 15W',
    slug: 'support-voiture-magsafe-induction',
    category: 'cat-auto-moto',
    categoryId: 'cat-auto-moto',
    categoryLabel: 'Accessoires Auto/Moto',
    subcategory: 'Multimédia & Écrans',
    subcategoryId: 'sub-auto-moto-multimedia-ecrans',
    subcategoryLabel: 'Multimédia & Écrans',
    price: 2600,
    originalPrice: 3800,
    purchaseCost: 950,
    advertisingCost: 450,
    packagingCost: 90,
    sku: 'DZM-CAR-05',
    stockQuantity: 38,
    description: 'Fixation magnétique ultra puissante spécialement pensée pour les routes algériennes. Aimants néodyme N52 maintenant fermement votre téléphone même sur dos d\'ânes ou nids-de-poule. Charge rapide sans fil Qi 15W intelligente avec dissipation thermique en aluminium. Rotation à 360° pour navigation GPS portrait ou paysage.',
    features: [
      'Aimants N52 puissants : maintien inébranlable sur toutes routes',
      'Charge sans fil rapide certifiée Qi jusqu\'à 15W',
      'Pince universelle renforcée pour grilles d\'aération de véhicule',
      'Rotation complète 360° sur rotule en acier inoxydable',
      'Compatible iPhone MagSafe et tous smartphones avec anneau fourni',
      'Protection contre les surtensions, surchauffes et courts-circuits'
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80'
    ],
    variants: [
      { id: 'v5-black', name: 'Noir Mat Alliage Zinc & Silicone', color: '#0F172A', stock: 38, sku: 'DZM-CAR-05-BLK' }
    ],
    isActive: true,
    isFeatured: false,
    createdAt: '2026-03-05T14:00:00Z',
  },
  {
    id: 'prod-6',
    name: 'Tondeuse Barbe & Cheveux Professionnelle Métal 5-en-1',
    slug: 'tondeuse-barbe-cheveux-pro-metal',
    category: 'cat-beaute-coiffure-soins',
    categoryId: 'cat-beaute-coiffure-soins',
    categoryLabel: 'Beauté, Coiffure & Soins',
    subcategory: 'Tondeuses & Rasoirs Homme',
    subcategoryId: 'sub-beaute-coiffure-soins-tondeuses-rasoirs-homme',
    subcategoryLabel: 'Tondeuses & Rasoirs Homme',
    price: 3500,
    originalPrice: 4800,
    purchaseCost: 1450,
    advertisingCost: 520,
    packagingCost: 110,
    sku: 'DZM-TRM-06',
    stockQuantity: 30,
    description: 'Tondeuse de finition barbier professionnelle au design rétro gravé tout métal. Lame en T suspendue en titane auto-affûtée pour des contours ultra nets, rasage à blanc sans irritation de la peau. Moteur rotatif puissant 7000 tr/min silencieux, batterie lithium haute capacité rechargeable en USB Type-C avec écran LCD affichant le pourcentage.',
    features: [
      'Lame de précision en T en acier inoxydable titane zéro gap',
      'Corps ergonomique sculpté 100% métal doré vintage',
      'Écran LCD digital indiquant l\'autonomie restante en temps réel',
      'Moteur haute vitesse 7000 RPM à faible émission sonore',
      'Batterie Lithium-Ion 1500mAh offrant 180 minutes d\'utilisation continue',
      'Fournie avec 4 sabots de coupe (1.5mm, 2mm, 3mm, 4mm), brosse et câble'
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80'
    ],
    variants: [
      { id: 'v6-gold', name: 'Doré Vintage Gravé Dragon & Phénix', color: '#CA8A04', stock: 18, sku: 'DZM-TRM-06-GLD' },
      { id: 'v6-silver', name: 'Argent Chromé Métal Poli', color: '#94A3B8', stock: 12, sku: 'DZM-TRM-06-SLV' }
    ],
    isActive: true,
    isFeatured: true,
    createdAt: '2026-03-06T15:00:00Z',
  },
  {
    id: 'prod-7',
    name: 'Portefeuille Slim Carbone Pop-Up Anti-RFID',
    slug: 'portefeuille-slim-carbone-anti-rfid',
    category: 'cat-mode-sacs-accessoires',
    categoryId: 'cat-mode-sacs-accessoires',
    categoryLabel: 'Mode, Sacs & Accessoires',
    subcategory: 'Portefeuilles & Porte-cartes',
    subcategoryId: 'sub-mode-sacs-accessoires-portefeuilles-porte-cartes',
    subcategoryLabel: 'Portefeuilles & Porte-cartes',
    price: 1900,
    originalPrice: 2800,
    purchaseCost: 750,
    advertisingCost: 380,
    packagingCost: 80,
    sku: 'DZM-WLT-07',
    stockQuantity: 45,
    description: 'Dites adieu aux portefeuilles volumineux. Ce porte-cartes compact en véritable fibre de carbone dispose d\'un mécanisme d\'éjection automatique breveté : une simple pression sur la gâchette fait jaillir vos cartes en éventail ordonné. Blindage d\'aluminium intérieur bloquant 100% des tentatives de scan RFID/NFC illégal de vos cartes bancaires Edahabia / CIB.',
    features: [
      'Mécanisme Pop-up instantané d\'éjection en éventail',
      'Protection intégrale contre le piratage sans contact RFID/NFC',
      'Capacité : jusqu\'à 6 cartes dans le compartiment alu + billets',
      'Finition premium fibre de carbone mate anti-rayures',
      'Format ultra compact et mince (glisse dans n\'importe quelle poche)',
      'Pince à billets métallique robuste en acier brossé'
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80'
    ],
    variants: [
      { id: 'v7-carbon', name: 'Fibre de Carbone Noir Furtif', color: '#1F2937', stock: 28, sku: 'DZM-WLT-07-CRB' },
      { id: 'v7-leather', name: 'Cuir Vintage Brun Mat', color: '#78350F', stock: 17, sku: 'DZM-WLT-07-BRN' }
    ],
    isActive: true,
    isFeatured: false,
    createdAt: '2026-03-07T10:00:00Z',
  },
  {
    id: 'prod-8',
    name: 'Lampe de Bureau Tactile LED Réglable & Chargeur Induction',
    slug: 'lampe-bureau-tactile-led-chargeur-induction',
    category: 'cat-informatique-bureau',
    categoryId: 'cat-informatique-bureau',
    categoryLabel: 'Informatique & Bureau',
    subcategory: 'Lampes & Organisation Bureau',
    subcategoryId: 'sub-informatique-bureau-lampes-organisation-bureau',
    subcategoryLabel: 'Lampes & Organisation Bureau',
    price: 3200,
    originalPrice: 4500,
    purchaseCost: 1300,
    advertisingCost: 490,
    packagingCost: 140,
    sku: 'DZM-LMP-08',
    stockQuantity: 22,
    description: 'L\'accessoire idéal pour votre espace de travail ou table de chevet. Lampe LED architecte en aluminium épuré avec 5 températures de couleur (du blanc chaud reposant au blanc lumière du jour) et 10 niveaux d\'intensité. Base intégrant un pad de charge rapide sans fil par induction 10W pour recharger votre téléphone sans câble encombrant.',
    features: [
      '5 Températures de lumière (2700K - 6500K) & variateur tactile continu',
      'Base chargeur sans fil Qi intégré 10W pour smartphone et écouteurs',
      'Bras articulé pliable en alliage d\'aluminium avec double pivot',
      'Lumière douce anti-éblouissement sans scintillement (protection des yeux)',
      'Minuterie d\'extinction automatique 30/60 minutes',
      'Port de sortie USB supplémentaire au dos'
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80'
    ],
    variants: [
      { id: 'v8-silver', name: 'Argent Brossé Minimaliste', color: '#E2E8F0', stock: 12, sku: 'DZM-LMP-08-SLV' },
      { id: 'v8-black', name: 'Noir Anodisé Mat', color: '#0F172A', stock: 10, sku: 'DZM-LMP-08-BLK' }
    ],
    isActive: true,
    isFeatured: false,
    createdAt: '2026-03-08T16:00:00Z',
  }
];
