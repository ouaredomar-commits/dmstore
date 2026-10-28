import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { CategoryItem, SubCategoryItem } from '../../types';
import { resolveProductCategory } from '../../data/initialCategories';
import {
  X,
  Plus,
  Edit2,
  Check,
  ArrowUp,
  ArrowDown,
  FolderTree,
  Layers,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    categories,
    products,
    addCategory,
    updateCategory,
    reorderCategories,
    addSubCategory,
    updateSubCategory,
    reorderSubCategories,
  } = useStore();

  // Expanded categories in accordion
  const [expandedCatIds, setExpandedCatIds] = useState<string[]>(() =>
    categories.map((c) => c.id)
  );

  // Add Category form
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Edit Category inline state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');

  // Add Subcategory inline state per category
  const [addingSubToCatId, setAddingSubToCatId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');

  // Edit Subcategory inline state
  const [editingSubKey, setEditingSubKey] = useState<{ catId: string; subId: string } | null>(
    null
  );
  const [editSubName, setEditSubName] = useState('');
  const [editSubDesc, setEditSubDesc] = useState('');

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  if (!isOpen) return null;

  const notifySuccess = (msg: string) => {
    setErrorMsg(null);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const notifyError = (err: any) => {
    setSuccessMsg(null);
    setErrorMsg(err?.message || 'Une erreur est survenue.');
  };

  const toggleExpand = (catId: string) => {
    setExpandedCatIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // Count products per category & subcategory
  const getCategoryProductCount = (catId: string) =>
    products.filter((p) => resolveProductCategory(p, categories).categoryId === catId).length;

  const getSubCategoryProductCount = (catId: string, subId: string, subName?: string) =>
    products.filter((p) => {
      const res = resolveProductCategory(p, categories);
      return (
        res.categoryId === catId &&
        (res.subcategoryId === subId || (subName && res.subcategoryName === subName))
      );
    }).length;

  const uncategorizedCount = products.filter(
    (p) => resolveProductCategory(p, categories).isUncategorized
  ).length;

  // Handlers — Categories
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    setErrorMsg(null);
    setIsBusy(true);
    try {
      const created = await addCategory({
        name: newCatName,
        description: newCatDesc,
      });
      setNewCatName('');
      setNewCatDesc('');
      setIsAddingCat(false);
      setExpandedCatIds((prev) => [...prev, created.id]);
      notifySuccess(`Catégorie « ${created.name} » créée avec succès.`);
    } catch (err) {
      notifyError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const startEditCategory = (cat: CategoryItem) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description || '');
    setErrorMsg(null);
  };

  const handleSaveCategoryEdit = async (catId: string) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await updateCategory(catId, {
        name: editCatName,
        description: editCatDesc.trim(),
      });
      setEditingCatId(null);
      notifySuccess('Catégorie renommée et mise à jour.');
    } catch (err) {
      notifyError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleCategoryActive = async (cat: CategoryItem) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await updateCategory(cat.id, { isActive: !cat.isActive });
      notifySuccess(
        !cat.isActive
          ? `Catégorie « ${cat.name} » activée.`
          : `Catégorie « ${cat.name} » désactivée (produits et commandes préservés).`
      );
    } catch (err) {
      notifyError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    if (isBusy) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const ids = categories.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(targetIndex, 0, moved);

    setIsBusy(true);
    try {
      await reorderCategories(ids);
      notifySuccess('Ordre des catégories mis à jour.');
    } catch (err) {
      notifyError(err);
    } finally {
      setIsBusy(false);
    }
  };

  // Handlers — Subcategories
  const handleCreateSubCategory = async (e: React.FormEvent, categoryId: string) => {
    e.preventDefault();
    if (isBusy) return;
    setIsBusy(true);
    try {
      await addSubCategory(categoryId, {
        name: newSubName,
        description: newSubDesc,
      });
      setNewSubName('');
      setNewSubDesc('');
      setAddingSubToCatId(null);
      notifySuccess('Sous-catégorie ajoutée avec succès.');
    } catch (err) {
      notifyError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const startEditSubCategory = (catId: string, sub: SubCategoryItem) => {
    setEditingSubKey({ catId, subId: sub.id });
    setEditSubName(sub.name);
    setEditSubDesc(sub.description || '');
    setErrorMsg(null);
  };

  const handleSaveSubCategoryEdit = async () => {
    if (!editingSubKey || isBusy) return;
    setIsBusy(true);
    try {
      await updateSubCategory(editingSubKey.catId, editingSubKey.subId, {
        name: editSubName,
        description: editSubDesc.trim(),
      });
      setEditingSubKey(null);
      notifySuccess('Sous-catégorie mise à jour.');
    } catch (err) {
      notifyError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleSubCategoryActive = async (catId: string, sub: SubCategoryItem) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await updateSubCategory(catId, sub.id, { isActive: !sub.isActive });
      notifySuccess(
        !sub.isActive
          ? `Sous-catégorie « ${sub.name} » activée.`
          : `Sous-catégorie « ${sub.name} » désactivée.`
      );
    } catch (err) {
      notifyError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleMoveSubCategory = async (
    cat: CategoryItem,
    subIndex: number,
    direction: 'up' | 'down'
  ) => {
    if (isBusy) return;
    const subs = cat.subcategories;
    const targetIndex = direction === 'up' ? subIndex - 1 : subIndex + 1;
    if (targetIndex < 0 || targetIndex >= subs.length) return;

    const subIds = subs.map((s) => s.id);
    const [moved] = subIds.splice(subIndex, 1);
    subIds.splice(targetIndex, 0, moved);

    setIsBusy(true);
    try {
      await reorderSubCategories(cat.id, subIds);
      notifySuccess('Ordre des sous-catégories mis à jour.');
    } catch (err) {
      notifyError(err);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#DFE3E8] rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DFE3E8] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 text-[#FF6500] flex items-center justify-center shrink-0">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#212B36] font-['Plus_Jakarta_Sans']">
                Organisation des Catégories & Sous-catégories
              </h2>
              <p className="text-xs text-[#637381]">
                Ajoutez, renommez, réorganisez ou désactivez vos catégories sans affecter vos produits ni vos commandes historiques.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#919EAB] hover:text-[#212B36] hover:bg-[#F4F6F8] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#F4F6F8]/50 text-xs">
          {/* Feedback banners */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-[#D82C0D] font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-[#004C3F] font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Top summary & Add Category button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#DFE3E8]">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <span className="text-[#637381]">Catégories principales : </span>
                <strong className="text-[#212B36]">{categories.length}</strong>
              </div>
              <div>
                <span className="text-[#637381]">Sous-catégories : </span>
                <strong className="text-[#212B36]">
                  {categories.reduce((acc, c) => acc + c.subcategories.length, 0)}
                </strong>
              </div>
              {uncategorizedCount > 0 && (
                <div className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                  Non catégorisé : {uncategorizedCount} produit(s)
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsAddingCat(!isAddingCat);
                setErrorMsg(null);
              }}
              className="px-4 py-2 bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle catégorie</span>
            </button>
          </div>

          {/* Add Category Form */}
          {isAddingCat && (
            <form
              onSubmit={handleCreateCategory}
              className="bg-white border-2 border-[#FF6500]/30 rounded-2xl p-4 space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-[#212B36] text-sm">
                  Ajouter une catégorie principale
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddingCat(false)}
                  className="text-[#637381] hover:text-[#212B36]"
                >
                  Fermer
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#212B36] mb-1">
                    Nom de la catégorie *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Ex: Auto, Moto et Mobilité"
                    className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-semibold focus:outline-hidden focus:border-[#FF6500]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#212B36] mb-1">
                    Description / Exemples (optionnel)
                  </label>
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="Ex: Accessoires auto, entretien, GPS..."
                    className="w-full bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] focus:outline-hidden focus:border-[#FF6500]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingCat(false)}
                  className="px-3.5 py-2 rounded-xl bg-[#F4F6F8] text-[#637381] font-bold hover:text-[#212B36] cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-4 py-2 rounded-xl bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Créer la catégorie</span>
                </button>
              </div>
            </form>
          )}

          {/* Categories List */}
          <div className="space-y-3">
            {categories.map((cat, idx) => {
              const isExpanded = expandedCatIds.includes(cat.id);
              const isEditingThisCat = editingCatId === cat.id;
              const catProdCount = getCategoryProductCount(cat.id);

              return (
                <div
                  key={cat.id}
                  className={`bg-white border rounded-2xl overflow-hidden transition-all ${
                    cat.isActive ? 'border-[#DFE3E8]' : 'border-slate-300 opacity-75'
                  }`}
                >
                  {/* Category Header Row */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                    <div className="flex items-start sm:items-center gap-2.5 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleExpand(cat.id)}
                        className="p-1.5 rounded-lg bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] cursor-pointer mt-0.5 sm:mt-0"
                        title={isExpanded ? 'Replier' : 'Déplier les sous-catégories'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      {isEditingThisCat ? (
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            className="bg-[#F4F6F8] border border-[#FF6500] rounded-xl px-3 py-1.5 font-bold text-[#212B36]"
                            placeholder="Nom de la catégorie"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editCatDesc}
                              onChange={(e) => setEditCatDesc(e.target.value)}
                              className="flex-1 bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-1.5 text-[#212B36]"
                              placeholder="Description..."
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveCategoryEdit(cat.id)}
                              className="p-2 bg-[#004C3F] text-white rounded-xl hover:bg-emerald-800 cursor-pointer"
                              title="Enregistrer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCatId(null)}
                              className="p-2 bg-[#F4F6F8] text-[#637381] rounded-xl hover:text-[#212B36] cursor-pointer"
                              title="Annuler"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-[#212B36]">
                              {cat.name}
                            </span>
                            {cat.nameTranslations?.ar && (
                              <span
                                className="text-xs font-bold text-[#004C3F] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"
                                dir="rtl"
                              >
                                {cat.nameTranslations.ar}
                              </span>
                            )}
                            {cat.icon && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-[#212B36]">
                                Icône: {cat.icon}
                              </span>
                            )}
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F4F6F8] text-[#637381] border border-[#DFE3E8]">
                              ID: {cat.id}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#FF6500] border border-orange-200">
                              {cat.subcategories.length} sous-catégorie(s)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#212B36]">
                              {catProdCount} produit(s)
                            </span>
                            {!cat.isActive && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-[#D82C0D]">
                                Désactivée
                              </span>
                            )}
                          </div>
                          {cat.description && (
                            <p className="text-[11px] text-[#637381] mt-0.5">
                              {cat.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Category Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0 || isBusy}
                        onClick={() => handleMoveCategory(idx, 'up')}
                        className="p-1.5 rounded-lg bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] disabled:opacity-30 cursor-pointer"
                        title="Monter"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === categories.length - 1 || isBusy}
                        onClick={() => handleMoveCategory(idx, 'down')}
                        className="p-1.5 rounded-lg bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] disabled:opacity-30 cursor-pointer"
                        title="Descendre"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditCategory(cat)}
                        className="p-1.5 rounded-lg bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] cursor-pointer"
                        title="Renommer la catégorie"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleCategoryActive(cat)}
                        className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer ${
                          cat.isActive
                            ? 'bg-emerald-50 text-[#004C3F] hover:bg-emerald-100 border border-emerald-200'
                            : 'bg-slate-100 text-[#637381] hover:bg-slate-200 border border-slate-300'
                        }`}
                        title={
                          cat.isActive
                            ? 'Désactiver cette catégorie de la boutique'
                            : 'Activer cette catégorie'
                        }
                      >
                        {cat.isActive ? (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Inactive</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isExpanded) toggleExpand(cat.id);
                          setAddingSubToCatId(
                            addingSubToCatId === cat.id ? null : cat.id
                          );
                          setNewSubName('');
                          setNewSubDesc('');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#FF6500] border border-orange-200 font-bold flex items-center gap-1 cursor-pointer"
                        title="Ajouter une sous-catégorie"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Sous-catégorie</span>
                      </button>
                    </div>
                  </div>

                  {/* Subcategories Section */}
                  {isExpanded && (
                    <div className="border-t border-[#DFE3E8] bg-[#F4F6F8]/60 p-4 space-y-2.5">
                      {/* Add Subcategory Inline Form */}
                      {addingSubToCatId === cat.id && (
                        <form
                          onSubmit={(e) => handleCreateSubCategory(e, cat.id)}
                          className="bg-white border border-[#FF6500]/40 rounded-xl p-3 space-y-2.5 mb-2"
                        >
                          <div className="font-bold text-[#212B36]">
                            Nouvelle sous-catégorie dans « {cat.name} »
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input
                              type="text"
                              required
                              value={newSubName}
                              onChange={(e) => setNewSubName(e.target.value)}
                              placeholder="Nom de la sous-catégorie *"
                              className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] font-semibold focus:outline-hidden focus:border-[#FF6500]"
                            />
                            <input
                              type="text"
                              value={newSubDesc}
                              onChange={(e) => setNewSubDesc(e.target.value)}
                              placeholder="Exemples de produits (ex: mobiles, chargeurs...)"
                              className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-xl px-3 py-2 text-[#212B36] focus:outline-hidden focus:border-[#FF6500]"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setAddingSubToCatId(null)}
                              className="px-3 py-1.5 rounded-lg bg-[#F4F6F8] text-[#637381] font-bold cursor-pointer"
                            >
                              Annuler
                            </button>
                            <button
                              type="submit"
                              disabled={isBusy}
                              className="px-3.5 py-1.5 rounded-lg bg-[#FF6500] text-white font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Ajouter</span>
                            </button>
                          </div>
                        </form>
                      )}

                      {cat.subcategories.length === 0 ? (
                        <p className="text-[#637381] italic py-2 text-center">
                          Aucune sous-catégorie définie pour cette catégorie.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {cat.subcategories.map((sub, subIdx) => {
                            const isEditingSub =
                              editingSubKey?.catId === cat.id &&
                              editingSubKey?.subId === sub.id;
                            const subProdCount = getSubCategoryProductCount(
                              cat.id,
                              sub.id,
                              sub.name
                            );

                            return (
                              <div
                                key={sub.id}
                                className={`bg-white border rounded-xl px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                  sub.isActive
                                    ? 'border-[#DFE3E8]'
                                    : 'border-slate-200 opacity-65'
                                }`}
                              >
                                {isEditingSub ? (
                                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input
                                      type="text"
                                      value={editSubName}
                                      onChange={(e) => setEditSubName(e.target.value)}
                                      className="bg-[#F4F6F8] border border-[#FF6500] rounded-lg px-2.5 py-1 font-bold text-[#212B36]"
                                    />
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="text"
                                        value={editSubDesc}
                                        onChange={(e) => setEditSubDesc(e.target.value)}
                                        placeholder="Exemples..."
                                        className="flex-1 bg-[#F4F6F8] border border-[#DFE3E8] rounded-lg px-2.5 py-1 text-[#212B36]"
                                      />
                                      <button
                                        type="button"
                                        onClick={handleSaveSubCategoryEdit}
                                        className="p-1.5 bg-[#004C3F] text-white rounded-lg cursor-pointer"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingSubKey(null)}
                                        className="p-1.5 bg-[#F4F6F8] text-[#637381] rounded-lg cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Layers className="w-3.5 h-3.5 text-[#FF6500] shrink-0" />
                                      <span className="font-bold text-[#212B36]">
                                        {sub.name}
                                      </span>
                                      <span className="text-[10px] font-mono text-[#919EAB]">
                                        ({sub.id})
                                      </span>
                                      <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 text-[#637381]">
                                        {subProdCount} prod.
                                      </span>
                                      {!sub.isActive && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-red-50 text-[#D82C0D]">
                                          Inactive
                                        </span>
                                      )}
                                    </div>
                                    {sub.description && (
                                      <p className="text-[11px] text-[#637381] pl-5 mt-0.5">
                                        {sub.description}
                                      </p>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={subIdx === 0 || isBusy}
                                    onClick={() =>
                                      handleMoveSubCategory(cat, subIdx, 'up')
                                    }
                                    className="p-1 rounded-lg bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] disabled:opacity-30 cursor-pointer"
                                    title="Monter"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      subIdx === cat.subcategories.length - 1 || isBusy
                                    }
                                    onClick={() =>
                                      handleMoveSubCategory(cat, subIdx, 'down')
                                    }
                                    className="p-1 rounded-lg bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] disabled:opacity-30 cursor-pointer"
                                    title="Descendre"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startEditSubCategory(cat.id, sub)}
                                    className="p-1 rounded-lg bg-[#F4F6F8] hover:bg-slate-200 text-[#212B36] cursor-pointer"
                                    title="Renommer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleSubCategoryActive(cat.id, sub)
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                      sub.isActive
                                        ? 'bg-emerald-50 text-[#004C3F] border border-emerald-200'
                                        : 'bg-slate-100 text-[#637381] border border-slate-300'
                                    }`}
                                  >
                                    {sub.isActive ? 'Active' : 'Inactive'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#DFE3E8] bg-white flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#637381]">
            Les identifiants techniques sont conservés lors du renommage afin de préserver toutes les relations produits.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#212B36] hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
