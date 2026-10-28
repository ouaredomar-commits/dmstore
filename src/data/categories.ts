export interface OfficialCategoryDefinition {
  id: string;
  slug: string;
  name: {
    fr: string;
    ar: string;
  };
  icon:
    | 'Car'
    | 'Cpu'
    | 'Laptop'
    | 'Utensils'
    | 'Home'
    | 'Lamp'
    | 'Wrench'
    | 'Compass'
    | 'Sparkles'
    | 'Baby'
    | 'Gamepad2'
    | 'ShoppingBag'
    | 'Dumbbell'
    | 'Flame'
    | 'Layers';
  subcategories: string[];
}

export const CATEGORIES: OfficialCategoryDefinition[] = [
  {
    id: 'cat-auto-moto',
    slug: 'accessoires-auto-moto',
    name: {
      fr: 'Accessoires Auto/Moto',
      ar: 'إكسسوارات السيارات والدراجات',
    },
    icon: 'Car',
    subcategories: [
      'Multimédia & Écrans',
      'Confort & Housses',
      'Protection & Bâches',
      'Éclairage LED',
      'Rangement Coffre',
      'Sécurité & Caméras',
      'Accessoires Moto',
    ],
  },
  {
    id: 'cat-electronique-gadgets',
    slug: 'electronique-et-gadgets',
    name: {
      fr: 'Électronique & Gadgets',
      ar: 'إلكترونيات وأدوات ذكية',
    },
    icon: 'Cpu',
    subcategories: [
      'Montres Connectées',
      'Écouteurs & Casques',
      'Chargeurs & Batterie Externe',
      'Supports Téléphone',
      'Caméras Surveillance',
      'Gadgets LED & Déco Tech',
    ],
  },
  {
    id: 'cat-informatique-bureau',
    slug: 'informatique-et-bureau',
    name: {
      fr: 'Informatique & Bureau',
      ar: 'إعلام آلي ومكتب',
    },
    icon: 'Laptop',
    subcategories: [
      'Accessoires PC Portable',
      'Souris & Claviers',
      'Supports & Refroidisseurs',
      'Stockage USB & Disques',
      'Lampes & Organisation Bureau',
      'Réseau & Wi-Fi',
    ],
  },
  {
    id: 'cat-cuisine-art-table',
    slug: 'cuisine-et-art-de-la-table',
    name: {
      fr: 'Cuisine & Art de la Table',
      ar: 'مطبخ وأواني المائدة',
    },
    icon: 'Utensils',
    subcategories: [
      'Découpe & Préparation',
      'Cuisson & Moules',
      'Conservation & Rangement',
      'Café, Thé & Boissons',
      'Pâtisserie',
      'Service de Table',
      'Petit Électroménager',
    ],
  },
  {
    id: 'cat-maison-organisation',
    slug: 'maison-et-organisation',
    name: {
      fr: 'Maison & Organisation',
      ar: 'المنزل والتنظيم',
    },
    icon: 'Home',
    subcategories: [
      'Rangement Dressing',
      'Rangement Salle de Bain',
      'Buanderie & Séchage',
      'Nettoyage & Entretien',
      'Quincaillerie Pratique',
      'Gain de Place',
    ],
  },
  {
    id: 'cat-decoration-eclairage',
    slug: 'decoration-et-eclairage',
    name: {
      fr: 'Décoration & Éclairage',
      ar: 'ديكور وإضاءة',
    },
    icon: 'Lamp',
    subcategories: [
      'Lampes & Veilleuses LED',
      'Décoration Murale',
      'Plantes Artificielles',
      "Bougies & Parfums d'Intérieur",
      'Textiles & Tapis',
      'Déco Salon & Chambre',
    ],
  },
  {
    id: 'cat-bricolage-outillage',
    slug: 'bricolage-et-outillage',
    name: {
      fr: 'Bricolage & Outillage',
      ar: 'أشغال يدوية ومعدات',
    },
    icon: 'Wrench',
    subcategories: [
      'Outils à Main',
      'Outils Électriques Sans Fil',
      'Mesure & Précision',
      'Réparation Maison',
      'Sécurité & Protection',
      'Jardinage Léger',
    ],
  },
  {
    id: 'cat-voyage-camping-plein-air',
    slug: 'voyage-camping-et-plein-air',
    name: {
      fr: 'Voyage, Camping & Plein Air',
      ar: 'سفر، تخييم وخرجات',
    },
    icon: 'Compass',
    subcategories: [
      'Équipement Plage',
      'Matériel Camping',
      'Sacs & Organisation Voyage',
      'Glacières & Pique-Nique',
      'Lampes Torches & Solaire',
      'Confort Route',
    ],
  },
  {
    id: 'cat-beaute-coiffure-soins',
    slug: 'beaute-coiffure-et-soins',
    name: {
      fr: 'Beauté, Coiffure & Soins',
      ar: 'تجميل، حلاقة وعناية',
    },
    icon: 'Sparkles',
    subcategories: [
      'Tondeuses & Rasoirs Homme',
      'Coiffure Femme',
      'Soins Visage & Peau',
      'Manucure & Pédicure',
      'Rangement Maquillage',
      'Bien-être & Massage',
    ],
  },
  {
    id: 'cat-bebe-enfants-maternite',
    slug: 'bebe-enfants-et-maternite',
    name: {
      fr: 'Bébé, Enfants & Maternité',
      ar: 'أطفال، رضع وأمومة',
    },
    icon: 'Baby',
    subcategories: [
      'Repas Bébé',
      'Sécurité Maison Bébé',
      'Promenade & Voiture',
      'Hygiène & Soin',
      'Rangement Chambre Enfant',
    ],
  },
  {
    id: 'cat-jouets-jeux-educatif',
    slug: 'jouets-jeux-et-educatif',
    name: {
      fr: 'Jouets, Jeux & Éducatif',
      ar: 'ألعاب وترفيه',
    },
    icon: 'Gamepad2',
    subcategories: [
      'Jeux Éducatifs & Montessori',
      'Jouets Créatifs',
      "Jeux d'Extérieur",
      'Jeux de Société',
      'Jouets Électroniques',
    ],
  },
  {
    id: 'cat-mode-sacs-accessoires',
    slug: 'mode-sacs-et-accessoires',
    name: {
      fr: 'Mode, Sacs & Accessoires',
      ar: 'موضة، حقائب وإكسسوارات',
    },
    icon: 'ShoppingBag',
    subcategories: [
      'Sacs à Main & Sacs à Dos',
      'Portefeuilles & Porte-cartes',
      'Montres & Bijoux',
      'Lunettes & Accessoires',
      'Rangement Chaussures',
    ],
  },
  {
    id: 'cat-sport-fitness-bien-etre',
    slug: 'sport-fitness-et-bien-etre',
    name: {
      fr: 'Sport, Fitness & Bien-être',
      ar: 'رياضة، لياقة وعافية',
    },
    icon: 'Dumbbell',
    subcategories: [
      'Fitness Maison',
      'Bandes & Élastiques',
      'Récupération & Posture',
      'Gourdes & Sacs de Sport',
      'Accessoires Running',
    ],
  },
  {
    id: 'cat-saisonnier-evenements',
    slug: 'saisonnier-et-evenements',
    name: {
      fr: 'Saisonnier & Événements',
      ar: 'منتجات موسمية ومناسبات',
    },
    icon: 'Flame',
    subcategories: [
      'Spécial Ramadan & Aïd',
      'Spécial Été & Plage',
      'Spécial Rentrée Scolaire',
      'Spécial Hiver',
      'Mariage, Fêtes & Cadeaux',
    ],
  },
  {
    id: 'cat-packs-promo-offres',
    slug: 'packs-promo-et-offres-speciales',
    name: {
      fr: 'Packs Promo & Offres Spéciales',
      ar: 'عروض خاصة وباقات التوفير',
    },
    icon: 'Layers',
    subcategories: [
      'Packs Duo / Trio',
      'Packs Famille',
      'Produits Tendance TikTok',
      'Liquidation & Déstockage',
      'Idées Cadeaux',
    ],
  },
];

export default CATEGORIES;
