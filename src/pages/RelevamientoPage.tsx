import { useState, useMemo } from 'react';
import { ChevronLeft, Check, Package, Layers, FolderOpen, Save } from 'lucide-react';
import { useCollection, registerStockMovement } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import type { Product, Sector, Category, StockMovement } from '../types';

type Step = 'sectors' | 'categories' | 'products';

interface StockUpdate {
  productId: string;
  newStock: number;
  changed: boolean;
}

export default function RelevamientoPage() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { data: products } = useCollection<Product>('products');
  const { data: sectors } = useCollection<Sector>('sectors');
  const { data: categories } = useCollection<Category>('categories');
  const { data: movements } = useCollection<StockMovement>('stockMovements');

  const [step, setStep] = useState<Step>('sectors');
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [stockUpdates, setStockUpdates] = useState<Record<string, StockUpdate>>({});
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const activeSectors = sectors.filter((s) => s.active);

  const sectorCategories = useMemo(() => {
    if (!selectedSector) return [];
    return categories.filter((c) => c.active && c.sectorId === selectedSector.id);
  }, [categories, selectedSector]);

  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return products.filter((p) => p.active && p.categoryId === selectedCategory.id);
  }, [products, selectedCategory]);

  const pendingChanges = Object.values(stockUpdates).filter((u) => u.changed).length;

  function selectSector(sector: Sector) {
    setSelectedSector(sector);
    setSelectedCategory(null);
    setStockUpdates({});
    setStep('categories');
  }

  function selectCategory(category: Category) {
    setSelectedCategory(category);
    // Initialize stock updates from current product values
    const updates: Record<string, StockUpdate> = {};
    const catProducts = products.filter((p) => p.active && p.categoryId === category.id);
    for (const p of catProducts) {
      updates[p.id] = { productId: p.id, newStock: p.stock, changed: false };
    }
    setStockUpdates(updates);
    setStep('products');
  }

  function updateStock(productId: string, value: number) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setStockUpdates((prev) => ({
      ...prev,
      [productId]: {
        productId,
        newStock: Math.max(0, value),
        changed: Math.max(0, value) !== product.stock,
      },
    }));
  }

  function adjustStock(productId: string, delta: number) {
    const current =
      stockUpdates[productId]?.newStock ??
      products.find((p) => p.id === productId)?.stock ??
      0;
    updateStock(productId, current + delta);
  }

  async function confirmDiscardChanges(): Promise<boolean> {
    if (pendingChanges === 0) return true;
    return confirm({
      title: 'Cambios sin guardar',
      message: `Tienes ${pendingChanges} cambio${pendingChanges > 1 ? 's' : ''} sin guardar que se perderan si sales.`,
      confirmLabel: 'Descartar cambios',
      cancelLabel: 'Seguir contando',
      danger: true,
    });
  }

  async function goBack() {
    if (step === 'products') {
      if (!(await confirmDiscardChanges())) return;
      setStep('categories');
      setSelectedCategory(null);
      setStockUpdates({});
    } else if (step === 'categories') {
      setStep('sectors');
      setSelectedSector(null);
    }
  }

  async function goToStep(target: 'sectors' | 'categories') {
    if (step === 'products' && !(await confirmDiscardChanges())) return;
    if (target === 'sectors') {
      setStep('sectors');
      setSelectedSector(null);
      setSelectedCategory(null);
    } else {
      setStep('categories');
      setSelectedCategory(null);
    }
    setStockUpdates({});
  }

  async function saveChanges() {
    const changed = Object.values(stockUpdates).filter((u) => u.changed);
    if (changed.length === 0) return;

    setSaving(true);
    const savedIds: string[] = [];
    try {
      for (const update of changed) {
        await registerStockMovement({
          productId: update.productId,
          type: 'adjustment',
          quantity: update.newStock,
          reason: 'Relevamiento de stock',
          userId: appUser?.uid || '',
          userEmail: appUser?.email || '',
        });
        savedIds.push(update.productId);
      }

      setSavedMessage(`${changed.length} producto${changed.length > 1 ? 's' : ''} actualizado${changed.length > 1 ? 's' : ''}`);
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      console.error(err);
      showToast(
        `Se guardaron ${savedIds.length} de ${changed.length} cambios. Reintenta los restantes.`,
        'error'
      );
    } finally {
      // Reset changed flags only for products that were actually saved
      setStockUpdates((prev) => {
        const updated = { ...prev };
        for (const id of savedIds) {
          if (updated[id]) updated[id] = { ...updated[id], changed: false };
        }
        return updated;
      });
      setSaving(false);
    }
  }

  // Fecha del ultimo movimiento por producto (las fechas ISO comparan bien como strings)
  const lastMovementByProduct = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of movements) {
      const prev = map.get(m.productId);
      if (!prev || m.createdAt > prev) map.set(m.productId, m.createdAt);
    }
    return map;
  }, [movements]);

  return (
    <div className="relevamiento-container">
      {/* Header */}
      <div className="relevamiento-header">
        {step !== 'sectors' && (
          <button className="relevamiento-back-btn" onClick={goBack}>
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="relevamiento-title">
          {step === 'sectors' && (
            <>
              <Layers size={24} />
              <h1>Relevamiento de Stock</h1>
            </>
          )}
          {step === 'categories' && selectedSector && (
            <>
              <FolderOpen size={24} />
              <h1>{selectedSector.name}</h1>
            </>
          )}
          {step === 'products' && selectedCategory && (
            <>
              <Package size={24} />
              <h1>{selectedCategory.name}</h1>
            </>
          )}
        </div>
        {step === 'products' && pendingChanges > 0 && (
          <button
            className="relevamiento-save-btn"
            onClick={saveChanges}
            disabled={saving}
          >
            <Save size={20} />
            <span>{saving ? 'Guardando...' : `Guardar (${pendingChanges})`}</span>
          </button>
        )}
      </div>

      {savedMessage && (
        <div className="relevamiento-toast">
          <Check size={18} />
          {savedMessage}
        </div>
      )}

      {/* Breadcrumb */}
      {step !== 'sectors' && (
        <div className="relevamiento-breadcrumb">
          <span onClick={() => goToStep('sectors')}>
            Sectores
          </span>
          {selectedSector && (
            <>
              <span className="relevamiento-breadcrumb-sep">/</span>
              <span onClick={() => goToStep('categories')}>
                {selectedSector.name}
              </span>
            </>
          )}
          {selectedCategory && (
            <>
              <span className="relevamiento-breadcrumb-sep">/</span>
              <span className="relevamiento-breadcrumb-current">{selectedCategory.name}</span>
            </>
          )}
        </div>
      )}

      {/* Sectors */}
      {step === 'sectors' && (
        <div className="relevamiento-grid">
          {activeSectors.map((sector) => {
            const sectorProductCount = products.filter((p) => p.active && p.sectorId === sector.id).length;
            return (
              <button
                key={sector.id}
                className="relevamiento-card"
                onClick={() => selectSector(sector)}
              >
                <div className="relevamiento-card-icon" style={{ background: 'rgba(36, 43, 89, 0.1)', color: 'var(--color-blue)' }}>
                  <Layers size={28} />
                </div>
                <div className="relevamiento-card-info">
                  <span className="relevamiento-card-name">{sector.name}</span>
                  <span className="relevamiento-card-count">{sectorProductCount} productos</span>
                </div>
                <ChevronLeft size={20} className="relevamiento-card-arrow" />
              </button>
            );
          })}
          {activeSectors.length === 0 && (
            <div className="relevamiento-empty">
              <Layers size={48} />
              <p>No hay sectores disponibles</p>
            </div>
          )}
        </div>
      )}

      {/* Categories */}
      {step === 'categories' && (
        <div className="relevamiento-grid">
          {sectorCategories.map((category) => {
            const catProductCount = products.filter((p) => p.active && p.categoryId === category.id).length;
            return (
              <button
                key={category.id}
                className="relevamiento-card"
                onClick={() => selectCategory(category)}
              >
                <div className="relevamiento-card-icon" style={{ background: 'rgba(12, 95, 85, 0.1)', color: 'var(--color-green-dark)' }}>
                  <FolderOpen size={28} />
                </div>
                <div className="relevamiento-card-info">
                  <span className="relevamiento-card-name">{category.name}</span>
                  <span className="relevamiento-card-count">{catProductCount} productos</span>
                </div>
                <ChevronLeft size={20} className="relevamiento-card-arrow" />
              </button>
            );
          })}
          {sectorCategories.length === 0 && (
            <div className="relevamiento-empty">
              <FolderOpen size={48} />
              <p>No hay categorias en este sector</p>
            </div>
          )}
        </div>
      )}

      {/* Products - Stock Counting */}
      {step === 'products' && (
        <div className="relevamiento-products">
          {categoryProducts.map((product) => {
            const update = stockUpdates[product.id];
            const currentValue = update?.newStock ?? product.stock;
            const hasChanged = update?.changed || false;
            const lastUpdate = lastMovementByProduct.get(product.id) || null;

            return (
              <div
                key={product.id}
                className={`relevamiento-product-card ${hasChanged ? 'changed' : ''}`}
              >
                <div className="relevamiento-product-header">
                  <div className="relevamiento-product-name">{product.name}</div>
                  <div className="relevamiento-product-meta">
                    <span className="relevamiento-product-unit">{product.unit}</span>
                    {hasChanged && (
                      <span className="relevamiento-product-original">
                        Anterior: {product.stock}
                      </span>
                    )}
                  </div>
                  {lastUpdate && (
                    <div className="relevamiento-product-last-update">
                      Ult. mov: {new Date(lastUpdate).toLocaleDateString('es-UY', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                      })}
                    </div>
                  )}
                </div>
                <div className="relevamiento-product-controls">
                  <button
                    className="relevamiento-btn-minus"
                    onClick={() => adjustStock(product.id, -1)}
                    disabled={currentValue <= 0}
                  >
                    -
                  </button>
                  <input
                    className="relevamiento-stock-input"
                    type="number"
                    min="0"
                    value={currentValue}
                    onChange={(e) => updateStock(product.id, Number(e.target.value))}
                  />
                  <button
                    className="relevamiento-btn-plus"
                    onClick={() => adjustStock(product.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
          {categoryProducts.length === 0 && (
            <div className="relevamiento-empty">
              <Package size={48} />
              <p>No hay productos en esta categoria</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
