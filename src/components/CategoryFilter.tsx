import React, { useState } from 'react';
import { CategoryItem, SubCategoryItem } from '../types';
import {
  UNCATEGORIZED_ID,
  UNCATEGORIZED_LABEL,
  UNCATEGORIZED_LABEL_AR,
  getCategoryDisplayName,
} from '../data/initialCategories';
import {
  Car,
  Cpu,
  Laptop,
  Utensils,
  Home,
  Lamp,
  Wrench,
  Compass,
  Sparkles,
  Baby,
  Gamepad2,
  ShoppingBag,
  Dumbbell,
  Flame,
  Layers,
  LayoutGrid,
  HelpCircle,
  Globe,
} from 'lucide-react';

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Car,
  Cpu,
  Laptop,
  Utensils,
  Home,
  Lamp,
  Wrench,
  Compass,
  Sparkles,
  Baby,
  Gamepad2,
  ShoppingBag,
  Dumbbell,
  Flame,
  Layers,
};

export interface CategoryFilterProps {
  categories: CategoryItem[];
  selectedCategory: string;
  selectedSubcategory: string;
  onSelectCategory: (categoryId: string) => void;
  onSelectSubcategory: (subcategoryId: string) => void;
  hasUncategorizedProducts?: boolean;
  defaultLang?: 'fr' | 'ar';
  showLangSwitch?: boolean;
  categoryCounts?: Record<string, number>;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  selectedSubcategory,
  onSelectCategory,
  onSelectSubcategory,
  hasUncategorizedProducts = false,
  defaultLang = 'fr',
  showLangSwitch = true,
  categoryCounts,
}) => {
  const [currentLang, setCurrentLang] = useState<'fr' | 'ar'>(defaultLang);
  const isRtl = currentLang === 'ar';

  const currentCategoryObj = categories.find(
    (c) => c.id === selectedCategory || c.slug === selectedCategory
  );

  const activeSubcategories: SubCategoryItem[] = currentCategoryObj
    ? currentCategoryObj.subcategories
        .filter((s) => s.isActive !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
    : [];

  const renderCategoryIcon = (iconName?: string, isActive?: boolean) => {
    const IconComp = (iconName && CATEGORY_ICON_MAP[iconName]) || Layers;
    return (
      <IconComp
        className={`w-4 h-4 shrink-0 transition-colors ${
          isActive ? 'text-white' : 'text-[#FF6500]'
        }`}
      />
    );
  };

  return (
    <div className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* En-tête de navigation des catégories + Sélecteur FR / AR */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#212B36]">
          <Layers className="w-4 h-4 text-[#FF6500] shrink-0" />
          <span>
            {isRtl
              ? `تصفح حسب الفئة (${categories.length})`
              : `Explorer par catégorie (${categories.length})`}
          </span>
        </div>

        {showLangSwitch && (
          <div className="inline-flex items-center gap-1 bg-white border border-[#DFE3E8] rounded-full p-0.5 text-[11px] font-bold">
            <Globe className="w-3.5 h-3.5 text-[#637381] mx-1.5" />
            <button
              type="button"
              onClick={() => setCurrentLang('fr')}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                currentLang === 'fr'
                  ? 'bg-[#212B36] text-white'
                  : 'text-[#637381] hover:text-[#212B36]'
              }`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setCurrentLang('ar')}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                currentLang === 'ar'
                  ? 'bg-[#212B36] text-white'
                  : 'text-[#637381] hover:text-[#212B36]'
              }`}
            >
              عربي
            </button>
          </div>
        )}
      </div>

      {/* Barre horizontale défilante mobile-first des 15 catégories (pills >= 44px) */}
      <div
        role="tablist"
        aria-label={isRtl ? 'فئات المنتجات' : 'Catégories de produits'}
        className="flex items-center gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory py-1"
      >
        {/* Premier bouton : « Tous les produits » ou « الكل » */}
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'all'}
          onClick={() => onSelectCategory('all')}
          className={`snap-start min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
            selectedCategory === 'all'
              ? 'bg-[#FF6500] text-white border-[#FF6500] shadow-md shadow-orange-500/25'
              : 'bg-white text-[#212B36] border-[#DFE3E8] hover:border-[#FF6500]/50 hover:bg-orange-50/40'
          }`}
        >
          <LayoutGrid
            className={`w-4 h-4 shrink-0 ${
              selectedCategory === 'all' ? 'text-white' : 'text-[#FF6500]'
            }`}
          />
          <span>{isRtl ? 'الكل' : 'Tous les produits'}</span>
          {categoryCounts && typeof categoryCounts.all === 'number' && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
                selectedCategory === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#F4F6F8] text-[#637381]'
              }`}
            >
              {categoryCounts.all}
            </span>
          )}
        </button>

        {/* Boutons des 15 catégories */}
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id || selectedCategory === cat.slug;
          const label = getCategoryDisplayName(cat, currentLang);
          const count = categoryCounts?.[cat.id];

          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectCategory(cat.id)}
              className={`snap-start min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
                isActive
                  ? 'bg-[#FF6500] text-white border-[#FF6500] shadow-md shadow-orange-500/25'
                  : 'bg-white text-[#212B36] border-[#DFE3E8] hover:border-[#FF6500]/50 hover:bg-orange-50/40'
              }`}
            >
              {renderCategoryIcon(cat.icon, isActive)}
              <span>{label}</span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-extrabold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[#F4F6F8] text-[#637381]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* Bouton « Non catégorisé » si des produits sans catégorie existent */}
        {hasUncategorizedProducts && (
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === UNCATEGORIZED_ID}
            onClick={() => onSelectCategory(UNCATEGORIZED_ID)}
            className={`snap-start min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
              selectedCategory === UNCATEGORIZED_ID
                ? 'bg-[#FF6500] text-white border-[#FF6500] shadow-md shadow-orange-500/25'
                : 'bg-white text-[#637381] border-[#DFE3E8] hover:border-[#FF6500]/50 hover:bg-slate-50'
            }`}
          >
            <HelpCircle
              className={`w-4 h-4 shrink-0 ${
                selectedCategory === UNCATEGORIZED_ID ? 'text-white' : 'text-[#637381]'
              }`}
            />
            <span>{isRtl ? UNCATEGORIZED_LABEL_AR : UNCATEGORIZED_LABEL}</span>
          </button>
        )}
      </div>

      {/* Barre secondaire de sous-catégories dépendante de la catégorie active */}
      {currentCategoryObj && activeSubcategories.length > 0 && (
        <div
          className="pt-2.5 border-t border-[#DFE3E8] space-y-2 animate-in fade-in duration-150"
          dir="ltr"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-[#637381]">
            <div className="flex items-center gap-1.5">
              {renderCategoryIcon(currentCategoryObj.icon, false)}
              <span>
                Sous-catégories de «{' '}
                <strong className="text-[#212B36]">
                  {getCategoryDisplayName(currentCategoryObj, 'fr')}
                </strong>{' '}
                »
                {currentCategoryObj.nameTranslations?.ar
                  ? ` (${currentCategoryObj.nameTranslations.ar})`
                  : ''}
                :
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar snap-x py-0.5">
            <button
              type="button"
              onClick={() => onSelectSubcategory('all')}
              className={`snap-start min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                selectedSubcategory === 'all'
                  ? 'bg-[#212B36] text-white border-[#212B36] shadow-xs'
                  : 'bg-white text-[#212B36] border-[#DFE3E8] hover:border-[#212B36]/40 hover:bg-slate-50'
              }`}
            >
              Toutes ({getCategoryDisplayName(currentCategoryObj, 'fr')})
            </button>

            {activeSubcategories.map((sub) => {
              const subActive =
                selectedSubcategory === sub.id || selectedSubcategory === sub.name;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onSelectSubcategory(sub.id)}
                  className={`snap-start min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                    subActive
                      ? 'bg-[#212B36] text-white border-[#212B36] shadow-xs'
                      : 'bg-white text-[#212B36] border-[#DFE3E8] hover:border-[#212B36]/40 hover:bg-slate-50'
                  }`}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryFilter;
