import React, { useState, useEffect } from 'react';
import { Product, ProductVariant, ProductOption, ProductImageItem } from '../../types';
import { useStore } from '../../context/StoreContext';
import {
  UNCATEGORIZED_ID,
  UNCATEGORIZED_LABEL,
  resolveProductCategory,
} from '../../data/initialCategories';
import { processLocalImage, testImageUrl, FALLBACK_PRODUCT_IMAGE } from '../../utils/imageUtils';
import {
  X,
  Plus,
  Trash2,
  Upload,
  Link as LinkIcon,
  Star,
  Check,
  AlertCircle,
  Tag,
  Palette,
  Layers,
  HelpCircle,
  Calculator,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';

interface ProductFormModalProps {
  product: Product | null; // null = ajout, non-null = modification
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Omit<Product, 'id' | 'createdAt'>, existingId?: string) => Promise<void> | void;
}

type TabType = 'general' | 'images' | 'pricing' | 'variants' | 'description';

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  isOpen,
  onClose,
  onSave,
}) => {
  const { categories } = useStore();
  const isEditing = !!product;

  // Tabs
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // Form State - Informations Générales
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [category, setCategory] = useState<string>('cat-auto-moto');
  const [categoryLabel, setCategoryLabel] = useState('Accessoires Auto/Moto');
  const [subcategoryId, setSubcategoryId] = useState<string>('sub-auto-moto-multimedia-ecrans');
  const [subcategoryLabel, setSubcategoryLabel] = useState<string>('Multimédia & Écrans');
  const [sku, setSku] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  // Form State - Tarification & Coûts
  // Note: normalPrice = prix de base, reducedPrice = prix promotionnel optionnel
  const [normalPrice, setNormalPrice] = useState<number>(3500);
  const [reducedPrice, setReducedPrice] = useState<string>(''); // string pour permettre le champ vide
  const [purchaseCost, setPurchaseCost] = useState<number>(1500);
  const [advertisingCost, setAdvertisingCost] = useState<number>(500);
  const [packagingCost, setPackagingCost] = useState<number>(120);

  // Form State - Stock
  const [stockQuantity, setStockQuantity] = useState<number>(30);

  // Form State - Description & Caractéristiques
  const [description, setDescription] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeatureInput, setNewFeatureInput] = useState('');

  // Form State - Images
  const [images, setImages] = useState<ProductImageItem[]>([]);
  const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [urlTestError, setUrlTestError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');

  // Form State - Variantes & Options
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  // Option en cours d'ajout
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionStyle, setNewOptionStyle] = useState<'buttons' | 'color_swatches' | 'dropdown'>('buttons');
  const [newOptionValuesInput, setNewOptionValuesInput] = useState('');
  const [isAddingOption, setIsAddingOption] = useState(false);

  // Validation & Feedback
  const [errorMessage, setErrorMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialisation lors de l'ouverture
  useEffect(() => {
    if (!isOpen) return;

    if (product) {
      // Mode Modification : préservation de la compatibilité avec les produits existants
      setName(product.name);
      setSlug(product.slug);
      setIsSlugManual(true);

      const resolved = resolveProductCategory(product, categories);
      if (resolved.isUncategorized) {
        setCategory(UNCATEGORIZED_ID);
        setCategoryLabel(product.categoryLabel || UNCATEGORIZED_LABEL);
        setSubcategoryId('');
        setSubcategoryLabel(product.subcategoryLabel || '');
      } else {
        setCategory(resolved.categoryId);
        setCategoryLabel(resolved.categoryName);
        setSubcategoryId(resolved.subcategoryId);
        setSubcategoryLabel(resolved.subcategoryName);
      }

      setSku(product.sku);
      setIsActive(product.isActive);
      setIsFeatured(!!product.isFeatured);

      // Si originalPrice existe, c'est que le produit a un prix réduit
      if (product.originalPrice && product.originalPrice > product.price) {
        setNormalPrice(product.originalPrice);
        setReducedPrice(product.price.toString());
      } else {
        setNormalPrice(product.price);
        setReducedPrice('');
      }

      setPurchaseCost(product.purchaseCost || 0);
      setAdvertisingCost(product.advertisingCost || 500);
      setPackagingCost(product.packagingCost || 120);
      setStockQuantity(product.stockQuantity);
      setDescription(product.description || '');
      setFeatures(product.features && product.features.length > 0 ? [...product.features] : []);

      // Conversion des images existantes
      if (product.images && product.images.length > 0) {
        setImages([...product.images]);
      } else {
        setImages(
          product.imageUrls.map((url, idx) => ({
            id: `img-${idx}-${Date.now()}`,
            url,
            isPrimary: idx === 0,
            source: 'url' as const,
          }))
        );
      }

      // Options
      setOptions(product.options ? [...product.options] : []);

      // Variantes
      setVariants(
        product.variants && product.variants.length > 0
          ? [...product.variants]
          : [
              {
                id: `v-std-${Date.now()}`,
                name: 'Standard',
                stock: product.stockQuantity,
                sku: `${product.sku}-STD`,
              },
            ]
      );
    } else {
      // Mode Ajout : Valeurs par défaut
      resetForm();
    }
  }, [isOpen, product]);

  const resetForm = () => {
    setName('');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const initialSku = `DZM-PRD-${randomSuffix}`;
    setSku(initialSku);
    setSlug('');
    setIsSlugManual(false);

    const firstActiveCat = categories.find((c) => c.isActive !== false) || categories[0];
    if (firstActiveCat) {
      setCategory(firstActiveCat.id);
      setCategoryLabel(firstActiveCat.name);
      const firstActiveSub =
        firstActiveCat.subcategories.find((s) => s.isActive !== false) ||
        firstActiveCat.subcategories[0];
      setSubcategoryId(firstActiveSub ? firstActiveSub.id : '');
      setSubcategoryLabel(firstActiveSub ? firstActiveSub.name : '');
    } else {
      setCategory(UNCATEGORIZED_ID);
      setCategoryLabel(UNCATEGORIZED_LABEL);
      setSubcategoryId('');
      setSubcategoryLabel('');
    }

    setIsActive(true);
    setIsFeatured(false);
    setNormalPrice(3500);
    setReducedPrice('');
    setPurchaseCost(1500);
    setAdvertisingCost(500);
    setPackagingCost(120);
    setStockQuantity(30);
    setDescription('');
    setFeatures([
      'Qualité supérieure garantie',
      'Testé et vérifié avant expédition',
      'Compatible avec paiement à la livraison 58 Wilayas',
    ]);
    setImages([
      {
        id: `img-default-${Date.now()}`,
        url: FALLBACK_PRODUCT_IMAGE,
        isPrimary: true,
        source: 'url',
      },
    ]);
    setOptions([]);
    setVariants([
      {
        id: `v-std-${Date.now()}`,
        name: 'Standard',
        stock: 30,
        sku: `${initialSku}-STD`,
      },
    ]);
    setActiveTab('general');
    setErrorMessage('');
    setSuccessToast('');
  };

  // Mise à jour automatique du slug
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugManual) {
      const generated = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generated);
    }
  };

  // Calculs financiers en temps réel
  const effectivePrice = reducedPrice !== '' && Number(reducedPrice) > 0 ? Number(reducedPrice) : normalPrice;
  const hasDiscount = reducedPrice !== '' && Number(reducedPrice) > 0 && Number(reducedPrice) < normalPrice;
  const discountPercent = hasDiscount ? Math.round(((normalPrice - Number(reducedPrice)) / normalPrice) * 100) : 0;
  const discountAmount = hasDiscount ? normalPrice - Number(reducedPrice) : 0;
  const unitNetMargin = effectivePrice - purchaseCost - packagingCost - advertisingCost;
  const unitMarginPercent = effectivePrice > 0 ? Math.round((unitNetMargin / effectivePrice) * 100) : 0;

  // Catégorie & Sous-catégorie dépendante
  const selectedCategoryObj = categories.find((c) => c.id === category);
  const availableSubcategories = selectedCategoryObj
    ? selectedCategoryObj.subcategories.filter(
        (s) => s.isActive !== false || s.id === subcategoryId
      )
    : [];
  const selectedSubcategoryObj = availableSubcategories.find((s) => s.id === subcategoryId);

  const handleCategoryChange = (newCatId: string) => {
    setCategory(newCatId);
    if (newCatId === UNCATEGORIZED_ID) {
      setCategoryLabel(UNCATEGORIZED_LABEL);
      setSubcategoryId('');
      setSubcategoryLabel('');
      return;
    }

    const foundCat = categories.find((c) => c.id === newCatId);
    if (foundCat) {
      setCategoryLabel(foundCat.name);
      const activeSubs = foundCat.subcategories.filter((s) => s.isActive !== false);
      const firstSub = activeSubs[0] || foundCat.subcategories[0];
      if (firstSub) {
        setSubcategoryId(firstSub.id);
        setSubcategoryLabel(firstSub.name);
      } else {
        setSubcategoryId('');
        setSubcategoryLabel('');
      }
    }
  };

  const handleSubcategoryChange = (newSubId: string) => {
    setSubcategoryId(newSubId);
    if (!newSubId || !selectedCategoryObj) {
      setSubcategoryLabel('');
      return;
    }
    const foundSub = selectedCategoryObj.subcategories.find((s) => s.id === newSubId);
    setSubcategoryLabel(foundSub ? foundSub.name : '');
  };

  // Ajout d'image depuis l'ordinateur
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setUploadProgress(15);

    try {
      // Simulation de progression fluide
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => {
          if (!prev) return 25;
          if (prev >= 85) return prev;
          return prev + 20;
        });
      }, 100);

      const processed = await processLocalImage(file);
      clearInterval(progressTimer);
      setUploadProgress(100);

      setTimeout(() => {
        const isFirst = images.length === 0;
        const newImage: ProductImageItem = {
          id: `img-up-${Date.now()}`,
          url: processed.dataUrl,
          isPrimary: isFirst,
          source: 'upload',
          fileName: processed.fileName,
          sizeBytes: processed.sizeBytes,
        };

        setImages((prev) => (isFirst ? [newImage] : [...prev, newImage]));
        setUploadProgress(null);
        e.target.value = ''; // Reset input
      }, 250);
    } catch (err: any) {
      setUploadProgress(null);
      setUploadError(err.message || 'Erreur lors du traitement du fichier.');
      e.target.value = '';
    }
  };

  // Ajout d'image depuis URL
  const handleAddUrlImage = async () => {
    if (!imageUrlInput.trim()) return;

    setUrlTestError('');
    setIsTestingUrl(true);

    try {
      await testImageUrl(imageUrlInput.trim());
      const isFirst = images.length === 0;
      const newImage: ProductImageItem = {
        id: `img-url-${Date.now()}`,
        url: imageUrlInput.trim(),
        isPrimary: isFirst,
        source: 'url',
      };

      setImages((prev) => (isFirst ? [newImage] : [...prev, newImage]));
      setImageUrlInput('');
      setIsTestingUrl(false);
    } catch (err: any) {
      setIsTestingUrl(false);
      setUrlTestError(err.message || "L'image ne peut pas être chargée depuis cette URL.");
    }
  };

  // Définir comme image principale
  const setAsPrimaryImage = (id: string) => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        isPrimary: img.id === id,
      }))
    );
  };

  // Supprimer une image
  const removeImage = (id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      // S'il reste des images et que l'image principale a été supprimée, désigner la première
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  // Gestion des caractéristiques
  const addFeature = () => {
    if (!newFeatureInput.trim()) return;
    setFeatures([...features, newFeatureInput.trim()]);
    setNewFeatureInput('');
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  // Gestion des options de variantes
  const handleCreateOption = () => {
    if (!newOptionName.trim()) return;

    // Découpage des valeurs séparées par des virgules ou retours à la ligne
    const rawValues = newOptionValuesInput
      .split(/[,;\n]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    const valuesList =
      rawValues.length > 0
        ? rawValues
        : newOptionStyle === 'color_swatches'
        ? ['Noir', 'Argent', 'Orange']
        : ['S', 'M', 'L', 'XL'];

    const newOption: ProductOption = {
      id: `opt-${Date.now()}`,
      name: newOptionName.trim(),
      style: newOptionStyle,
      values: valuesList.map((val, idx) => ({
        id: `val-${Date.now()}-${idx}`,
        label: val,
        colorHex:
          newOptionStyle === 'color_swatches'
            ? val.toLowerCase().includes('noir')
              ? '#1E293B'
              : val.toLowerCase().includes('orange')
              ? '#FF6500'
              : val.toLowerCase().includes('bleu')
              ? '#2563EB'
              : val.toLowerCase().includes('vert')
              ? '#10B981'
              : '#94A3B8'
            : undefined,
      })),
    };

    const updatedOptions = [...options, newOption];
    setOptions(updatedOptions);

    // Mettre à jour les variantes pour refléter les nouvelles options
    regenerateVariantsFromOptions(updatedOptions);

    // Reset formulaire d'option
    setNewOptionName('');
    setNewOptionValuesInput('');
    setIsAddingOption(false);
  };

  // Génération automatique des déclinaisons de variantes
  const regenerateVariantsFromOptions = (currentOptions: ProductOption[]) => {
    if (currentOptions.length === 0) {
      setVariants([
        {
          id: `v-std-${Date.now()}`,
          name: 'Standard',
          stock: stockQuantity,
          sku: `${sku || 'DZM-PROD'}-STD`,
        },
      ]);
      return;
    }

    // Si on a 1 option
    if (currentOptions.length === 1) {
      const opt = currentOptions[0];
      const newVars: ProductVariant[] = opt.values.map((val, idx) => ({
        id: `v-${Date.now()}-${idx}`,
        name: val.label,
        color: val.colorHex,
        stock: Math.max(5, Math.floor(stockQuantity / opt.values.length)),
        sku: `${sku || 'DZM-PROD'}-${val.label.substring(0, 3).toUpperCase()}`,
        priceModifier: 0,
      }));
      setVariants(newVars);
    } else {
      // Multi-options (ex: Couleur x Taille)
      const opt1 = currentOptions[0];
      const opt2 = currentOptions[1];
      const combinations: ProductVariant[] = [];

      opt1.values.forEach((v1, i1) => {
        opt2.values.forEach((v2, i2) => {
          combinations.push({
            id: `v-${Date.now()}-${i1}-${i2}`,
            name: `${v1.label} / ${v2.label}`,
            color: v1.colorHex || v2.colorHex,
            stock: Math.max(3, Math.floor(stockQuantity / (opt1.values.length * opt2.values.length))),
            sku: `${sku || 'DZM-PROD'}-${v1.label.substring(0, 3).toUpperCase()}-${v2.label.substring(0, 3).toUpperCase()}`,
            priceModifier: 0,
          });
        });
      });
      setVariants(combinations);
    }
  };

  const removeOption = (optionId: string) => {
    const updated = options.filter((o) => o.id !== optionId);
    setOptions(updated);
    regenerateVariantsFromOptions(updated);
  };

  // Synchronisation du stock total avec la somme des variantes
  const syncStockFromVariants = () => {
    const total = variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
    setStockQuantity(total);
  };

  // Validation et soumission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    // 1. Validation Titre
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage("Le nom de l'article est obligatoire.");
      setActiveTab('general');
      return;
    }

    // 2. Validation Description
    const cleanDesc = description.trim();
    if (!cleanDesc) {
      setErrorMessage('La description du produit est obligatoire.');
      setActiveTab('description');
      return;
    }

    // 3. Validation Tarification
    if (normalPrice <= 0 || isNaN(normalPrice)) {
      setErrorMessage('Le prix normal doit être une valeur strictement positive en DZD.');
      setActiveTab('pricing');
      return;
    }

    if (reducedPrice !== '') {
      const redVal = Number(reducedPrice);
      if (isNaN(redVal) || redVal <= 0) {
        setErrorMessage('Le prix réduit doit être une valeur numérique positive.');
        setActiveTab('pricing');
        return;
      }
      if (redVal >= normalPrice) {
        setErrorMessage(
          `Le prix réduit (${redVal} DZD) doit être strictement inférieur au prix normal (${normalPrice} DZD).`
        );
        setActiveTab('pricing');
        return;
      }
    }

    // 4. Validation Images
    if (images.length === 0) {
      setErrorMessage('Veuillez ajouter au moins une image pour ce produit.');
      setActiveTab('images');
      return;
    }

    // 5. Validation SKU
    const finalSku = sku.trim() || `DZM-ACC-${Math.floor(100 + Math.random() * 900)}`;

    // Calcul du prix effectif et du prix d'origine barré
    const isDiscountActive = reducedPrice !== '' && Number(reducedPrice) > 0 && Number(reducedPrice) < normalPrice;
    const finalPrice = isDiscountActive ? Number(reducedPrice) : normalPrice;
    const finalOriginalPrice = isDiscountActive ? normalPrice : undefined;

    // Assurer qu'une image est principale
    let finalImages = [...images];
    if (!finalImages.some((img) => img.isPrimary)) {
      finalImages[0].isPrimary = true;
    }
    // Placer l'image principale en tête de liste pour les URLs
    finalImages.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    const imageUrls = finalImages.map((img) => img.url);

    // Préparation de l'objet produit
    const finalProductData: Omit<Product, 'id' | 'createdAt'> = {
      name: cleanName,
      slug:
        slug.trim() ||
        cleanName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
      category: category || UNCATEGORIZED_ID,
      categoryId: category || UNCATEGORIZED_ID,
      categoryLabel:
        category === UNCATEGORIZED_ID
          ? categoryLabel.trim() || UNCATEGORIZED_LABEL
          : selectedCategoryObj?.name || categoryLabel || UNCATEGORIZED_LABEL,
      subcategory:
        category === UNCATEGORIZED_ID
          ? ''
          : selectedSubcategoryObj?.name || subcategoryLabel || '',
      subcategoryId: category === UNCATEGORIZED_ID ? '' : subcategoryId,
      subcategoryLabel:
        category === UNCATEGORIZED_ID
          ? ''
          : selectedSubcategoryObj?.name || subcategoryLabel || '',
      price: finalPrice,
      originalPrice: finalOriginalPrice,
      purchaseCost: Number(purchaseCost) || 0,
      advertisingCost: Number(advertisingCost) || 0,
      packagingCost: Number(packagingCost) || 0,
      sku: finalSku,
      stockQuantity: Number(stockQuantity) || 0,
      description: cleanDesc,
      features: features.length > 0 ? features : ['Qualité certifiée DzMahall'],
      imageUrls,
      images: finalImages,
      options: options.length > 0 ? options : undefined,
      variants:
        variants.length > 0
          ? variants
          : [
              {
                id: `v-std-${Date.now()}`,
                name: 'Standard',
                stock: Number(stockQuantity) || 0,
                sku: `${finalSku}-STD`,
              },
            ],
      isActive,
      isFeatured,
      updatedAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    try {
      await onSave(finalProductData, product?.id);
      onClose();
    } catch (err: any) {
      let msg = "Une erreur est survenue lors de l'enregistrement du produit. Vos informations ont été conservées.";
      if (err?.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.error) msg = `Erreur d'enregistrement : ${parsed.error}`;
        } catch {
          msg = err.message;
        }
      }
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#DFE3E8] rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#DFE3E8] bg-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-100 text-[#FF6500]">
                {isEditing ? 'Édition Produit' : 'Création Produit'}
              </span>
              <span className="text-xs text-[#637381] font-mono">
                {sku || 'Nouveau SKU'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-[#212B36] mt-0.5 font-['Plus_Jakarta_Sans'] line-clamp-1">
              {isEditing ? `Modifier : ${product.name}` : 'Ajouter un Nouvel Article'}
            </h2>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 text-[#919EAB] hover:text-[#212B36] hover:bg-[#F4F6F8] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-[#DFE3E8] bg-[#F4F6F8] flex items-center gap-1 sm:gap-2 overflow-x-auto shrink-0 scrollbar-none py-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'general'
                ? 'bg-white text-[#FF6500] shadow-xs border border-[#DFE3E8]'
                : 'text-[#637381] hover:text-[#212B36]'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Général & SEO</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('images')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'images'
                ? 'bg-white text-[#FF6500] shadow-xs border border-[#DFE3E8]'
                : 'text-[#637381] hover:text-[#212B36]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Images ({images.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'pricing'
                ? 'bg-white text-[#FF6500] shadow-xs border border-[#DFE3E8]'
                : 'text-[#637381] hover:text-[#212B36]'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Prix & Marges</span>
            {hasDiscount && (
              <span className="bg-[#D82C0D] text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                -{discountPercent}%
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('variants')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'variants'
                ? 'bg-white text-[#FF6500] shadow-xs border border-[#DFE3E8]'
                : 'text-[#637381] hover:text-[#212B36]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Variantes ({variants.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('description')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'description'
                ? 'bg-white text-[#FF6500] shadow-xs border border-[#DFE3E8]'
                : 'text-[#637381] hover:text-[#212B36]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Description & Points Clés</span>
          </button>
        </div>

        {/* Modal Body with Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-xs text-[#D82C0D] font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: INFORMATIONS GÉNÉRALES & SEO */}
          {activeTab === 'general' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[#212B36] font-bold mb-1">
                  Nom du produit / Titre public *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Montre Connectée Ultra Pro Titanium AMOLED"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] font-semibold focus:outline-hidden focus:border-[#FF6500]"
                  required
                />
                <span className="text-[11px] text-[#637381] mt-1 block">
                  Titre clair et accrocheur affiché sur la boutique et dans les commandes COD.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#212B36] font-bold mb-1">
                    Slug d'URL (identifiant unique)
                  </label>
                  <div className="flex items-center">
                    <span className="bg-[#DFE3E8]/50 border border-r-0 border-[#DFE3E8] px-2.5 py-2.5 rounded-l-xl text-[11px] text-[#637381] font-mono">
                      /produit/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => {
                        setIsSlugManual(true);
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                      }}
                      placeholder="montre-connectee-ultra"
                      className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-r-xl px-3 py-2.5 text-xs text-[#212B36] font-mono focus:outline-hidden focus:border-[#FF6500]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#212B36] font-bold mb-1">
                    Référence SKU principale *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value.toUpperCase())}
                      placeholder="DZM-TECH-01"
                      className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 text-xs text-[#212B36] font-mono font-bold focus:outline-hidden focus:border-[#FF6500]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSku(`DZM-${category.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`)
                      }
                      className="p-2.5 bg-[#F4F6F8] hover:bg-slate-200 border border-[#DFE3E8] rounded-xl text-[#212B36] shrink-0"
                      title="Générer un SKU aléatoire"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#212B36] font-bold mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 text-xs text-[#212B36] font-semibold focus:outline-hidden focus:border-[#FF6500] cursor-pointer"
                  >
                    {categories
                      .filter((c) => c.isActive !== false || c.id === category)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                          {cat.nameTranslations?.ar ? ` — ${cat.nameTranslations.ar}` : ''}
                          {!cat.isActive ? ' (Désactivée)' : ''}
                        </option>
                      ))}
                    <option value={UNCATEGORIZED_ID}>{UNCATEGORIZED_LABEL}</option>
                  </select>
                  {selectedCategoryObj?.nameTranslations?.ar && (
                    <span className="text-[11px] text-[#004C3F] font-semibold mt-1 block" dir="rtl">
                      {selectedCategoryObj.nameTranslations.ar}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[#212B36] font-bold mb-1">
                    Sous-catégorie
                  </label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => handleSubcategoryChange(e.target.value)}
                    disabled={category === UNCATEGORIZED_ID || availableSubcategories.length === 0}
                    className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2.5 text-xs text-[#212B36] font-semibold focus:outline-hidden focus:border-[#FF6500] disabled:opacity-60 cursor-pointer"
                  >
                    {category === UNCATEGORIZED_ID ? (
                      <option value="">Aucune sous-catégorie (Non catégorisé)</option>
                    ) : availableSubcategories.length === 0 ? (
                      <option value="">Aucune sous-catégorie disponible</option>
                    ) : (
                      <>
                        <option value="">-- Non spécifiée --</option>
                        {availableSubcategories.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                            {!sub.isActive ? ' (Inactive)' : ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {selectedSubcategoryObj?.description && (
                    <span className="text-[11px] text-[#004C3F] font-medium mt-1 block">
                      Exemples : {selectedSubcategoryObj.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Visibilité & En vedette */}
              <div className="pt-2 border-t border-[#DFE3E8] grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3.5 bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl">
                  <div>
                    <span className="block font-bold text-[#212B36]">Statut du produit</span>
                    <span className="text-[11px] text-[#637381]">
                      {isActive ? 'Actif et visible sur la boutique' : 'Masqué du catalogue'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      isActive ? 'bg-[#004C3F]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        isActive ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl">
                  <div>
                    <span className="block font-bold text-[#212B36]">Top Vente / En vedette</span>
                    <span className="text-[11px] text-[#637381]">
                      Affiche le badge Top Vente sur la fiche
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFeatured(!isFeatured)}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      isFeatured ? 'bg-[#FF6500]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        isFeatured ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMAGES DU PRODUIT */}
          {activeTab === 'images' && (
            <div className="space-y-6 text-xs">
              {/* Image Input Options */}
              <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-[#DFE3E8] pb-3">
                  <span className="font-bold text-[#212B36]">Ajouter des photos au produit</span>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#DFE3E8]">
                    <button
                      type="button"
                      onClick={() => setImageTab('upload')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                        imageTab === 'upload'
                          ? 'bg-[#FF6500] text-white shadow-xs'
                          : 'text-[#637381] hover:text-[#212B36]'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Depuis l'ordinateur</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageTab('url')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                        imageTab === 'url'
                          ? 'bg-[#FF6500] text-white shadow-xs'
                          : 'text-[#637381] hover:text-[#212B36]'
                      }`}
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Depuis une URL</span>
                    </button>
                  </div>
                </div>

                {/* Option 1 : Upload Local */}
                {imageTab === 'upload' && (
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-[#DFE3E8] hover:border-[#FF6500] bg-white rounded-2xl p-6 text-center transition-colors">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="image-file-input"
                      />
                      <label
                        htmlFor="image-file-input"
                        className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6500] flex items-center justify-center">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="font-bold text-[#212B36] text-sm">
                            Cliquez pour choisir une photo
                          </span>
                          <p className="text-[#637381] text-[11px] mt-0.5">
                            Formats autorisés : JPG, PNG, WebP (max 5 Mo). Compression automatique optimisée.
                          </p>
                        </div>
                      </label>
                    </div>

                    {uploadProgress !== null && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold text-[#212B36]">
                          <span>Traitement et optimisation de l'image...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-[#DFE3E8] h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#FF6500] h-full transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {uploadError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[#D82C0D] flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Option 2 : URL Externe */}
                {imageTab === 'url' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/... ou lien HTTPS direct"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        className="flex-1 bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500]"
                      />
                      <button
                        type="button"
                        onClick={handleAddUrlImage}
                        disabled={isTestingUrl || !imageUrlInput.trim()}
                        className="py-2.5 px-4 bg-[#FF6500] hover:bg-[#E55B00] disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0"
                      >
                        {isTestingUrl ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        <span>{isTestingUrl ? 'Vérification...' : "Ajouter l'image"}</span>
                      </button>
                    </div>

                    {urlTestError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[#D82C0D] flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{urlTestError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Galerie actuelle des images */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#212B36]">
                    Galerie du produit ({images.length} image{images.length > 1 ? 's' : ''})
                  </span>
                  <span className="text-[11px] text-[#637381]">
                    L'image avec le badge « Principale » s'affiche en couverture de carte et par défaut.
                  </span>
                </div>

                {images.length === 0 ? (
                  <div className="p-8 text-center bg-[#F4F6F8] rounded-2xl border border-[#DFE3E8] text-[#637381]">
                    <ImageIcon className="w-8 h-8 mx-auto text-[#919EAB] mb-2" />
                    <p className="font-bold text-[#212B36]">Aucune image sélectionnée</p>
                    <p className="text-[11px] mt-1">Ajoutez une image depuis votre ordinateur ou via une URL.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        className={`group relative bg-white border rounded-2xl overflow-hidden transition-all shadow-xs ${
                          img.isPrimary
                            ? 'border-[#FF6500] ring-2 ring-orange-500/20'
                            : 'border-[#DFE3E8] hover:border-slate-400'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="aspect-square w-full bg-[#F4F6F8] overflow-hidden relative">
                          <img
                            src={img.url}
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback de sécurité si l'URL externe échoue
                              (e.target as HTMLElement).setAttribute('src', FALLBACK_PRODUCT_IMAGE);
                            }}
                          />

                          {/* Primary Badge */}
                          {img.isPrimary && (
                            <span className="absolute top-2 left-2 bg-[#FF6500] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
                              <Star className="w-3 h-3 fill-white" /> Principale
                            </span>
                          )}

                          {/* Source indicator */}
                          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md font-mono">
                            {img.source === 'upload' ? 'Fichier' : 'URL'}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="p-2 bg-white flex items-center justify-between border-t border-[#DFE3E8]">
                          {!img.isPrimary ? (
                            <button
                              type="button"
                              onClick={() => setAsPrimaryImage(img.id)}
                              className="text-[10px] text-[#637381] hover:text-[#FF6500] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Star className="w-3 h-3" />
                              <span>Définir</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#004C3F] font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> En tête
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => removeImage(img.id)}
                            className="p-1 rounded-lg text-[#919EAB] hover:text-[#D82C0D] hover:bg-red-50 transition-colors cursor-pointer"
                            title="Supprimer cette image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TARIFICATION & RENTABILITÉ */}
          {activeTab === 'pricing' && (
            <div className="space-y-6 text-xs">
              {/* Tarification Public */}
              <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-5 space-y-4">
                <span className="font-bold text-[#212B36] block border-b border-[#DFE3E8] pb-2 text-sm">
                  Prix de Vente & Promotions
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Prix normal */}
                  <div>
                    <label className="block text-[#212B36] font-bold mb-1">
                      Prix normal (DZD) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        value={normalPrice}
                        onChange={(e) => setNormalPrice(Number(e.target.value))}
                        className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] font-mono font-black focus:outline-hidden focus:border-[#FF6500]"
                        required
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#FF6500]">
                        DZD
                      </span>
                    </div>
                    <span className="text-[11px] text-[#637381] mt-1 block">
                      Prix standard du produit.
                    </span>
                  </div>

                  {/* Prix réduit facultatif */}
                  <div>
                    <label className="block text-[#212B36] font-bold mb-1 flex items-center justify-between">
                      <span>Prix réduit / Promo (DZD)</span>
                      <span className="text-[10px] text-[#637381] font-normal">Facultatif</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        placeholder="Laisser vide si pas de promotion"
                        value={reducedPrice}
                        onChange={(e) => setReducedPrice(e.target.value)}
                        className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] font-mono font-black focus:outline-hidden focus:border-[#FF6500]"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#FF6500]">
                        DZD
                      </span>
                    </div>
                    <span className="text-[11px] text-[#637381] mt-1 block">
                      Si renseigné, doit être inférieur au prix normal.
                    </span>
                  </div>
                </div>

                {/* Synthèse visuelle de la tarification */}
                <div className="p-4 bg-white rounded-xl border border-[#DFE3E8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] text-[#637381] block">Prix facturé au client :</span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-xl font-black text-[#212B36] font-['Plus_Jakarta_Sans'] font-mono">
                        {effectivePrice.toLocaleString()} DZD
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-[#919EAB] line-through font-mono">
                          {normalPrice.toLocaleString()} DZD
                        </span>
                      )}
                    </div>
                  </div>

                  {hasDiscount ? (
                    <div className="flex items-center gap-2">
                      <span className="bg-[#D82C0D] text-white text-xs font-black px-2.5 py-1 rounded-lg">
                        -{discountPercent}%
                      </span>
                      <div className="text-right text-[11px]">
                        <span className="text-[#004C3F] font-bold block">
                          Économie client : {discountAmount.toLocaleString()} DZD
                        </span>
                        <span className="text-[#637381]">Affichage barré automatique</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#637381]">
                      Aucune remise active — le produit est vendu au prix normal.
                    </span>
                  )}
                </div>
              </div>

              {/* Coûts & Calculateur de marge */}
              <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-5 space-y-4">
                <span className="font-bold text-[#212B36] block border-b border-[#DFE3E8] pb-2 text-sm">
                  Coûts & Marge Unitaire (Calculateur Interne)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[#212B36] font-semibold mb-1">
                      Coût d'achat fournisseur (DZD) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(Number(e.target.value))}
                      className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[#212B36] font-semibold mb-1">
                      Coût emballage & scotch (DZD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packagingCost}
                      onChange={(e) => setPackagingCost(Number(e.target.value))}
                      className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[#212B36] font-semibold mb-1">
                      CPA Publicitaire estimé (DZD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={advertisingCost}
                      onChange={(e) => setAdvertisingCost(Number(e.target.value))}
                      className="w-full bg-white border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-mono"
                    />
                  </div>
                </div>

                {/* Scorecard de Marge */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    unitNetMargin > 0
                      ? 'bg-emerald-50/60 border-emerald-200 text-[#004C3F]'
                      : 'bg-red-50/60 border-red-200 text-[#D82C0D]'
                  }`}
                >
                  <div>
                    <span className="text-[11px] font-bold block uppercase tracking-wider">
                      Marge nette unitaire estimée (hors retour)
                    </span>
                    <span className="text-xl font-black font-['Plus_Jakarta_Sans'] font-mono">
                      {unitNetMargin > 0 ? '+' : ''}
                      {unitNetMargin.toLocaleString()} DZD
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold block">Taux de marge : {unitMarginPercent}%</span>
                    <span className="text-[11px] opacity-80">
                      Coût total unitaire : {(purchaseCost + packagingCost + advertisingCost).toLocaleString()} DZD
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VARIANTES & OPTIONS */}
          {activeTab === 'variants' && (
            <div className="space-y-6 text-xs">
              {/* Entête Options */}
              <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DFE3E8] pb-3">
                  <div>
                    <span className="font-bold text-[#212B36] text-sm block">
                      Options du produit ({options.length})
                    </span>
                    <p className="text-[11px] text-[#637381]">
                      Configurez les caractéristiques sélectionnables (Taille, Couleur, Modèle...).
                    </p>
                  </div>

                  {!isAddingOption && (
                    <button
                      type="button"
                      onClick={() => setIsAddingOption(true)}
                      className="py-2 px-3.5 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter une option</span>
                    </button>
                  )}
                </div>

                {/* Formulaire d'ajout d'une nouvelle option */}
                {isAddingOption && (
                  <div className="p-4 bg-white border border-[#DFE3E8] rounded-2xl space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#212B36]">Nouvelle Option</span>
                      <button
                        type="button"
                        onClick={() => setIsAddingOption(false)}
                        className="text-[#919EAB] hover:text-[#212B36]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#212B36] font-bold mb-1">
                          Nom de l'option *
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Couleur, Taille, Pointure, Modèle"
                          value={newOptionName}
                          onChange={(e) => setNewOptionName(e.target.value)}
                          className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-medium"
                        />
                        {/* Quick suggestions */}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-[10px] text-[#637381]">Suggestions :</span>
                          {['Couleur', 'Taille', 'Pointure', 'Modèle'].map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => {
                                setNewOptionName(sug);
                                if (sug === 'Couleur') setNewOptionStyle('color_swatches');
                                else if (sug === 'Pointure') setNewOptionStyle('dropdown');
                                else setNewOptionStyle('buttons');
                              }}
                              className="px-2 py-0.5 bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] rounded-md text-[10px] font-semibold border border-[#DFE3E8] cursor-pointer"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[#212B36] font-bold mb-1">
                          Style d'affichage *
                        </label>
                        <select
                          value={newOptionStyle}
                          onChange={(e) => setNewOptionStyle(e.target.value as any)}
                          className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-medium"
                        >
                          <option value="buttons">Boutons de sélection</option>
                          <option value="color_swatches">Pastilles de couleur</option>
                          <option value="dropdown">Liste déroulante</option>
                        </select>
                        <span className="text-[11px] text-[#637381] mt-1 block">
                          Définit l'affichage graphique sur la fiche produit publique.
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#212B36] font-bold mb-1">
                        Valeurs (séparées par une virgule) *
                      </label>
                      <input
                        type="text"
                        placeholder={
                          newOptionStyle === 'color_swatches'
                            ? 'Noir, Orange, Argent, Bleu'
                            : newOptionStyle === 'dropdown'
                            ? '40, 41, 42, 43, 44'
                            : 'S, M, L, XL, XXL'
                        }
                        value={newOptionValuesInput}
                        onChange={(e) => setNewOptionValuesInput(e.target.value)}
                        className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36]"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingOption(false)}
                        className="px-3 py-1.5 bg-[#F4F6F8] text-[#212B36] rounded-xl font-bold text-xs"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateOption}
                        disabled={!newOptionName.trim()}
                        className="px-4 py-1.5 bg-[#FF6500] hover:bg-[#E55B00] disabled:bg-slate-300 text-white rounded-xl font-bold text-xs"
                      >
                        Créer l'option
                      </button>
                    </div>
                  </div>
                )}

                {/* Liste des options créées */}
                {options.length > 0 && (
                  <div className="space-y-2">
                    {options.map((opt) => (
                      <div
                        key={opt.id}
                        className="p-3 bg-white border border-[#DFE3E8] rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#212B36]">{opt.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#F4F6F8] text-[#637381] font-medium border border-[#DFE3E8]">
                              {opt.style === 'buttons'
                                ? 'Boutons'
                                : opt.style === 'color_swatches'
                                ? 'Pastilles couleur'
                                : 'Liste déroulante'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {opt.values.map((val) => (
                              <span
                                key={val.id}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#F4F6F8] border border-[#DFE3E8] rounded-lg text-[11px] font-semibold text-[#212B36]"
                              >
                                {val.colorHex && (
                                  <span
                                    className="w-3 h-3 rounded-full border border-slate-300"
                                    style={{ backgroundColor: val.colorHex }}
                                  />
                                )}
                                <span>{val.label}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeOption(opt.id)}
                          className="p-1.5 text-[#919EAB] hover:text-[#D82C0D] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Supprimer cette option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tableau des Déclinaisons / Variantes */}
              <div className="bg-white border border-[#DFE3E8] rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DFE3E8] pb-3">
                  <div>
                    <span className="font-bold text-[#212B36] text-sm block">
                      Déclinaisons & Stocks par variante ({variants.length})
                    </span>
                    <p className="text-[11px] text-[#637381]">
                      Gérez les stocks individuels, les SKU et les ajustements de prix pour chaque combinaison.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={syncStockFromVariants}
                    className="py-1.5 px-3 bg-[#F4F6F8] hover:bg-slate-200 border border-[#DFE3E8] text-[#212B36] font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    title="Sommer les stocks des variantes dans le stock total"
                  >
                    <RefreshCw className="w-3 h-3 text-[#FF6500]" />
                    <span>Synchroniser stock global ({stockQuantity} ex.)</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F4F6F8] text-[#637381] uppercase font-bold border-b border-[#DFE3E8]">
                        <th className="py-2.5 px-3">Variante</th>
                        <th className="py-2.5 px-3">SKU Propre</th>
                        <th className="py-2.5 px-3">Ajustement Prix (+/- DZD)</th>
                        <th className="py-2.5 px-3">Stock Disponible</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFE3E8]">
                      {variants.map((v, idx) => (
                        <tr key={v.id} className="hover:bg-[#F4F6F8]/60">
                          <td className="py-2.5 px-3 font-bold text-[#212B36]">
                            <div className="flex items-center gap-2">
                              {v.color && (
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                                  style={{ backgroundColor: v.color }}
                                />
                              )}
                              <input
                                type="text"
                                value={v.name}
                                onChange={(e) => {
                                  const updated = [...variants];
                                  updated[idx].name = e.target.value;
                                  setVariants(updated);
                                }}
                                className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-lg px-2 py-1 text-xs font-bold text-[#212B36] w-36 sm:w-44"
                              />
                            </div>
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[#637381]">
                            <input
                              type="text"
                              value={v.sku}
                              onChange={(e) => {
                                const updated = [...variants];
                                updated[idx].sku = e.target.value.toUpperCase();
                                setVariants(updated);
                              }}
                              className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-lg px-2 py-1 text-xs font-mono text-[#212B36] w-28 sm:w-36"
                            />
                          </td>

                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={v.priceModifier || 0}
                              onChange={(e) => {
                                const updated = [...variants];
                                updated[idx].priceModifier = Number(e.target.value);
                                setVariants(updated);
                              }}
                              placeholder="0"
                              className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-lg px-2 py-1 text-xs font-mono font-bold text-[#212B36] w-20"
                            />
                          </td>

                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="0"
                              value={v.stock}
                              onChange={(e) => {
                                const updated = [...variants];
                                updated[idx].stock = Number(e.target.value);
                                setVariants(updated);
                              }}
                              className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-lg px-2 py-1 text-xs font-mono font-bold text-[#212B36] w-20"
                            />
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            {variants.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setVariants(variants.filter((item) => item.id !== v.id))}
                                className="p-1 text-[#919EAB] hover:text-[#D82C0D] rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setVariants([
                      ...variants,
                      {
                        id: `v-custom-${Date.now()}`,
                        name: `Option ${variants.length + 1}`,
                        stock: 10,
                        sku: `${sku || 'DZM-PROD'}-V${variants.length + 1}`,
                        priceModifier: 0,
                      },
                    ])
                  }
                  className="py-2 px-3 text-xs font-bold text-[#FF6500] hover:text-[#E55B00] flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une déclinaison manuelle</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: DESCRIPTION & POINTS CLÉS */}
          {activeTab === 'description' && (
            <div className="space-y-6 text-xs">
              <div>
                <label className="block text-[#212B36] font-bold mb-1">
                  Description détaillée du produit *
                </label>
                <textarea
                  rows={6}
                  placeholder="Rédigez une description détaillée : matériaux de fabrication, usages recommandés, autonomie, garantie..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-4 text-xs text-[#212B36] leading-relaxed resize-y focus:outline-hidden focus:border-[#FF6500]"
                  required
                />
                <div className="flex justify-between items-center text-[11px] text-[#637381] mt-1.5">
                  <span>Les retours à la ligne sont conservés sur la fiche publique.</span>
                  <span>{description.length} caractères</span>
                </div>
              </div>

              {/* Points Clés / Features */}
              <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-2xl p-5 space-y-4">
                <span className="font-bold text-[#212B36] block border-b border-[#DFE3E8] pb-2 text-sm">
                  Points forts & Avantages clés (Liste à puces)
                </span>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Écran AMOLED 2.02 pouces haute définition"
                    value={newFeatureInput}
                    onChange={(e) => setNewFeatureInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFeature();
                      }
                    }}
                    className="flex-1 bg-white border border-[#DFE3E8] rounded-xl px-3.5 py-2.5 text-xs text-[#212B36] focus:outline-hidden focus:border-[#FF6500]"
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="py-2.5 px-4 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter</span>
                  </button>
                </div>

                {features.length > 0 && (
                  <ul className="space-y-2">
                    {features.map((feat, idx) => (
                      <li
                        key={idx}
                        className="p-2.5 bg-white border border-[#DFE3E8] rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#004C3F] shrink-0" />
                          <span className="font-medium text-[#212B36]">{feat}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFeature(idx)}
                          className="p-1 text-[#919EAB] hover:text-[#D82C0D] rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#DFE3E8] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-[#637381]">
              * Champs obligatoires. Les modifications prennent effet immédiatement.
            </span>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-[#F4F6F8] hover:bg-slate-200 disabled:opacity-50 text-[#212B36] font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#FF6500] hover:bg-[#E55B00] active:bg-[#CC5100] disabled:opacity-60 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isEditing ? 'Enregistrer les modifications' : 'Publier le produit'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
