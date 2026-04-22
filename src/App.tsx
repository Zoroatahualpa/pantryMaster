/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShoppingCart,
  Package,
  UtensilsCrossed,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Minus,
  ChefHat,
  Loader2,
  Database,
  MapPin,
  X,
  PlusCircle,
  Save,
  Tag,
  Search,
  Trash2,
  Edit3,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  nombre: string;
  marca_referencial: string;
  cantidad_actual: number;
  cantidad_minima_alerta: number;
  unidad: string;
  categoria: string;
}

interface Recipe {
  id: string;
  nombre: string;
  ingredientes: { nombre: string; cantidad: number }[];
}

const CATEGORIAS = ['Víveres', 'Refrigerados', 'Limpieza', 'Higiene', 'Proteínas', 'Bebidas', 'Otros'];

const CATEGORIA_COLORS: Record<string, string> = {
  Víveres:      '#f97316',
  Refrigerados: '#3b82f6',
  Limpieza:     '#22c55e',
  Higiene:      '#a855f7',
  Proteínas:    '#ef4444',
  Bebidas:      '#06b6d4',
  Otros:        '#71717a',
};

const UNIDADES = ['kg', 'g', 'litros', 'ml', 'unidades', 'paquetes', 'latas', 'cajas'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  color,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-5 mb-2" style={{ borderBottom: `1px solid ${color}22` }}>
      <div className="p-2 rounded" style={{ background: `${color}15`, border: `1px solid ${color}40` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <h2 className="font-black tracking-widest text-sm uppercase italic leading-none" style={{ color }}>
          {title}
        </h2>
        <p className="text-zinc-600 text-[9px] uppercase font-mono tracking-tighter mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'BUSCAR_NODO...'}
        className="w-full bg-[#0A0A0B] border border-zinc-800 rounded-sm pl-9 pr-9 py-3 text-xs text-zinc-200 placeholder:text-zinc-700 font-mono uppercase tracking-wider outline-none focus:border-orange-600/60 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// Stock quantity control — large touch targets
function StockControl({
  value,
  onDecrement,
  onIncrement,
  critical,
}: {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  critical?: boolean;
}) {
  return (
    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden">
      <button
        onClick={onDecrement}
        className="w-11 h-11 flex items-center justify-center hover:bg-red-600/20 active:bg-red-600/40 transition-colors touch-manipulation"
        aria-label="Decrease"
      >
        <Minus className="w-4 h-4 text-red-500" />
      </button>
      <span
        className={`min-w-[40px] h-11 flex items-center justify-center font-mono text-sm font-bold ${
          critical ? 'text-red-400' : 'text-zinc-100'
        }`}
      >
        {value}
      </span>
      <button
        onClick={onIncrement}
        className="w-11 h-11 flex items-center justify-center hover:bg-green-600/20 active:bg-green-600/40 transition-colors touch-manipulation"
        aria-label="Increase"
      >
        <Plus className="w-4 h-4 text-green-500" />
      </button>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [inventory, setInventory] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeTab, setActiveTab] = useState<'shopping' | 'inventory' | 'recipes'>('shopping');
  const [loading, setLoading] = useState(true);
  const [purchaseItems, setPurchaseItems] = useState<Record<string, number>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Search
  const [searchInventory, setSearchInventory] = useState('');
  const [searchShopping, setSearchShopping] = useState('');

  // Add Product Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    nombre: '',
    marca_referencial: '',
    cantidad_actual: '',
    cantidad_minima_alerta: '',
    unidad: 'kg',
    categoria: 'Víveres',
  });

  // Edit Product Modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  // Collapsed categories in shopping
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // ── Data fetching ──
  const fetchData = useCallback(async () => {
    try {
      const [invRes, recRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/recipes/suggested'),
      ]);
      const [invData, recData] = await Promise.all([invRes.json(), recRes.json()]);
      setInventory(invData);
      setRecipes(recData);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived data ──
  const criticalItems = inventory.filter(p => p.cantidad_actual <= p.cantidad_minima_alerta);

  const filteredInventory = inventory.filter(p =>
    p.nombre.toLowerCase().includes(searchInventory.toLowerCase()) ||
    p.marca_referencial.toLowerCase().includes(searchInventory.toLowerCase())
  );

  const filteredCritical = criticalItems.filter(p =>
    p.nombre.toLowerCase().includes(searchShopping.toLowerCase()) ||
    p.marca_referencial.toLowerCase().includes(searchShopping.toLowerCase())
  );

  const groupedInventory = groupBy(filteredInventory, 'categoria');
  const groupedCritical  = groupBy(filteredCritical, 'categoria');

  // ── Stock update (optimistic) ──
  const updateQuantity = async (id: string, newQty: number) => {
    const finalQty = Math.max(0, newQty);
    setInventory(prev => prev.map(p => p.id === id ? { ...p, cantidad_actual: finalQty } : p));
    try {
      await fetch('/api/inventory/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cantidad_actual: finalQty }),
      });
      const res = await fetch('/api/recipes/suggested');
      setRecipes(await res.json());
    } catch {
      fetchData();
    }
  };

  // ── Add Product ──
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });
      if (res.ok) {
        const created: Product = await res.json();
        setInventory(prev => [...prev, created]);
        setIsModalOpen(false);
        setNewProduct({ nombre: '', marca_referencial: '', cantidad_actual: '', cantidad_minima_alerta: '', unidad: 'kg', categoria: 'Víveres' });
      }
    } catch (err) {
      console.error('Add product error:', err);
    }
  };

  // ── Edit Product ──
  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setEditForm({ ...p });
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    const updated = { ...editingProduct, ...editForm } as Product;
    setInventory(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditingProduct(null);
    try {
      await fetch(`/api/inventory/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {
      fetchData();
    }
  };

  // ── Delete Product ──
  const handleDelete = async (id: string) => {
    setInventory(prev => prev.filter(p => p.id !== id));
    try {
      await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    } catch {
      fetchData();
    }
  };

  // ── Purchase cart ──
  const handleAddToCart = (id: string) =>
    setPurchaseItems(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));

  const handleRemoveFromCart = (id: string) =>
    setPurchaseItems(prev => {
      const next = { ...prev };
      if (next[id] > 1) next[id] -= 1;
      else delete next[id];
      return next;
    });

  const registerPurchase = async () => {
    const items = Object.entries(purchaseItems).map(([id, cantidad]) => ({ id, cantidad }));
    if (!items.length) return;
    setSyncing(true);

    // Optimistic
    setInventory(prev =>
      prev.map(p => {
        const found = items.find(i => i.id === p.id);
        return found ? { ...p, cantidad_actual: p.cantidad_actual + found.cantidad } : p;
      })
    );

    try {
      await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      setPurchaseItems({});
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2000);
      const res = await fetch('/api/recipes/suggested');
      setRecipes(await res.json());
    } catch {
      fetchData();
    } finally {
      setSyncing(false);
    }
  };

  const toggleCategory = (cat: string) =>
    setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  const cartTotal = Object.values(purchaseItems).reduce((a, b) => a + b, 0);

  // ── Loading screen ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0A0A0B] gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-10 h-10 border-2 border-orange-500/20 border-t-orange-500 rounded-full"
        />
        <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest animate-pulse">
          Initializing_Pantry_Node...
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E4E4E7] font-sans selection:bg-orange-500/30 overflow-x-hidden">

      {/* ── Header ── */}
      <header className="h-16 border-b border-[#27272A] bg-[#121214] px-4 flex items-center justify-between shadow-2xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
          <div>
            <h1 className="text-base font-black tracking-tight uppercase text-zinc-100 leading-none">
              PANTRY CONTROL <span className="text-zinc-600 font-mono text-[10px]">v6.0</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="px-1.5 py-0.5 bg-zinc-800/80 rounded border border-zinc-700/60 text-[7px] text-zinc-500 font-mono flex items-center gap-1 uppercase">
                <Database className="w-2 h-2" /> MCBO_DB
              </span>
              <span className="px-1.5 py-0.5 bg-zinc-800/80 rounded border border-zinc-700/60 text-[7px] text-zinc-500 font-mono flex items-center gap-1 uppercase">
                <MapPin className="w-2 h-2" /> ZULIA_VE
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {criticalItems.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-2.5 py-1.5 rounded-sm">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span className="text-[10px] font-black text-red-500 font-mono">{criticalItems.length}</span>
            </div>
          )}
          <button
            onClick={fetchData}
            className="p-2 rounded-sm text-zinc-600 hover:text-orange-400 hover:bg-zinc-800 transition-colors touch-manipulation"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Navigation Tabs ── */}
      <div className="flex bg-[#0E0E0F] border-b border-[#27272A] sticky top-16 z-40">
        {([
          { id: 'shopping',   label: 'Compras',   icon: ShoppingCart,   color: '#ef4444', badge: criticalItems.length },
          { id: 'inventory',  label: 'Depósito',  icon: Package,        color: '#3b82f6', badge: null },
          { id: 'recipes',    label: 'Cocina',    icon: UtensilsCrossed,color: '#22c55e', badge: recipes.length },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 relative transition-all touch-manipulation ${
              activeTab === tab.id ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            <div className="relative">
              <tab.icon className="w-5 h-5" style={{ color: activeTab === tab.id ? tab.color : undefined }} />
              {tab.badge !== null && tab.badge > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center text-white"
                  style={{ background: tab.color }}
                >
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[8px] uppercase tracking-widest font-bold"
              style={{ color: activeTab === tab.id ? tab.color : undefined }}
            >
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ background: tab.color, boxShadow: `0 0 8px ${tab.color}` }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <main className="max-w-2xl mx-auto pb-28">
        <AnimatePresence mode="wait">

          {/* ════════════════════════════════ SHOPPING ════════════════════════════════ */}
          {activeTab === 'shopping' && (
            <motion.div
              key="shopping"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="p-4 space-y-5"
            >
              <SectionHeader
                icon={AlertTriangle}
                title="Lo que falta comprar"
                subtitle={
                  criticalItems.length > 0
                    ? `${criticalItems.length} producto${criticalItems.length > 1 ? 's' : ''} por reponer • ${Object.keys(groupedCritical).length} categoría${Object.keys(groupedCritical).length > 1 ? 's' : ''}`
                    : 'Todo en orden'
                }
                color="#ef4444"
              />

              <SearchBar
                value={searchShopping}
                onChange={setSearchShopping}
                placeholder="Buscar producto..."
              />

              {filteredCritical.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-zinc-800 rounded-sm space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-green-600/40 mx-auto" />
                  {searchShopping ? (
                    <>
                      <p className="text-zinc-400 font-bold text-sm">Sin resultados</p>
                      <p className="text-zinc-600 text-xs">No hay productos que coincidan con "{searchShopping}"</p>
                    </>
                  ) : (
                    <>
                      <p className="text-green-500 font-black text-base uppercase tracking-widest">✓ Despensa Completa</p>
                      <p className="text-zinc-600 text-xs leading-relaxed max-w-xs mx-auto">
                        Todos los productos están sobre su nivel mínimo.<br/>
                        ¡No necesitas comprar nada hoy!
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedCritical).map(([cat, items]) => {
                    const color = CATEGORIA_COLORS[cat] ?? '#71717a';
                    const collapsed = collapsedCategories[cat];
                    return (
                      <div key={cat} className="border border-zinc-800/60 rounded-sm overflow-hidden">
                        {/* Category header */}
                        <button
                          onClick={() => toggleCategory(cat)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/60 hover:bg-zinc-900 transition-colors touch-manipulation"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-1 h-5 rounded-full" style={{ background: color }} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">{cat}</span>
                            <span className="text-[9px] font-mono text-zinc-600">// {items.length}_nodes</span>
                          </div>
                          {collapsed ? (
                            <ChevronDown className="w-4 h-4 text-zinc-600" />
                          ) : (
                            <ChevronUp className="w-4 h-4 text-zinc-600" />
                          )}
                        </button>

                        <AnimatePresence initial={false}>
                          {!collapsed && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="divide-y divide-zinc-800/40">
                                {items.map(item => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between gap-3 px-4 py-3.5 bg-[#0C0C0D] hover:bg-red-500/5 transition-colors"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold uppercase tracking-tight text-zinc-100 truncate">
                                        {item.nombre}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] font-mono text-zinc-600 flex items-center gap-1">
                                          <Tag className="w-2.5 h-2.5" /> {item.marca_referencial}
                                        </span>
                                        <span className="text-[9px] font-mono px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-red-400">
                                          {item.cantidad_actual}/{item.cantidad_minima_alerta} {item.unidad}
                                        </span>
                                      </div>
                                    </div>

                                    {purchaseItems[item.id] ? (
                                      <div className="flex items-center bg-zinc-900 border border-orange-500/40 rounded-sm overflow-hidden shrink-0">
                                        <button
                                          onClick={() => handleRemoveFromCart(item.id)}
                                          className="w-10 h-10 flex items-center justify-center hover:bg-red-600/20 active:bg-red-600/40 transition-colors touch-manipulation"
                                        >
                                          <Minus className="w-3.5 h-3.5 text-red-400" />
                                        </button>
                                        <span className="w-8 text-center font-mono font-black text-orange-400 text-sm">
                                          {purchaseItems[item.id]}
                                        </span>
                                        <button
                                          onClick={() => handleAddToCart(item.id)}
                                          className="w-10 h-10 flex items-center justify-center hover:bg-green-600/20 active:bg-green-600/40 transition-colors touch-manipulation"
                                        >
                                          <Plus className="w-3.5 h-3.5 text-green-400" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleAddToCart(item.id)}
                                        className="flex items-center gap-1.5 px-4 h-10 bg-red-600/80 hover:bg-red-500 active:bg-red-700 text-white text-[9px] font-black rounded-sm uppercase tracking-widest transition-colors touch-manipulation shrink-0"
                                      >
                                        <ShoppingCart className="w-3 h-3" />
                                        Añadir
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Purchase summary + sync button */}
              <AnimatePresence>
                {cartTotal > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-16 left-0 right-0 px-4 z-30 max-w-2xl mx-auto"
                  >
                    <button
                      onClick={registerPurchase}
                      disabled={syncing}
                      className="w-full bg-orange-600 disabled:bg-zinc-700 text-white h-14 rounded-sm font-black uppercase tracking-[0.15em] shadow-[0_-4px_20px_rgba(249,115,22,0.3)] hover:bg-orange-500 active:scale-[0.98] transition-all border border-orange-400/30 flex items-center justify-center gap-3"
                    >
                      {syncing ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                      ) : syncSuccess ? (
                        <><Check className="w-5 h-5 text-green-300" /> ¡Despensa actualizada!</>
                      ) : (
                        <><Save className="w-5 h-5" /> Registrar compra ({cartTotal} {cartTotal === 1 ? 'item' : 'items'})</>
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ════════════════════════════════ INVENTORY ════════════════════════════════ */}
          {activeTab === 'inventory' && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="p-4 space-y-5"
            >
              <SectionHeader
                icon={Database}
                title="Tu Despensa"
                subtitle={`${inventory.length} productos • ${criticalItems.length} bajo mínimo`}
                color="#3b82f6"
              />

              <SearchBar
                value={searchInventory}
                onChange={setSearchInventory}
                placeholder="Buscar en despensa..."
              />

              {filteredInventory.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-zinc-800 rounded-sm space-y-2">
                  <Package className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
                  <p className="text-zinc-400 font-bold text-sm">
                    {searchInventory ? 'Sin resultados' : 'Despensa vacía'}
                  </p>
                  <p className="text-zinc-600 text-xs">
                    {searchInventory
                      ? `No se encontró "${searchInventory}"`
                      : 'Toca el botón + para agregar tu primer producto'}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(groupedInventory).map(([cat, items]) => {
                    const color = CATEGORIA_COLORS[cat] ?? '#71717a';
                    return (
                      <div key={cat}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-4 w-1 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}66` }} />
                          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 italic">
                            {cat} // AISLE
                          </span>
                          <div className="flex-1 h-px bg-zinc-800/50" />
                          <span className="text-[8px] font-mono text-zinc-700">{items.length}</span>
                        </div>

                        <div className="space-y-2">
                          {items.map(item => {
                            const critical = item.cantidad_actual <= item.cantidad_minima_alerta;
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 p-3 rounded-sm border transition-all ${
                                  critical
                                    ? 'border-red-500/30 bg-red-500/5'
                                    : 'border-zinc-800/60 bg-zinc-900/30 hover:border-zinc-700'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-bold uppercase tracking-tight truncate ${critical ? 'text-red-400' : 'text-zinc-100'}`}>
                                    {item.nombre}
                                  </p>
                                  <p className="text-[8px] text-zinc-600 font-mono flex items-center gap-1 mt-0.5">
                                    <Tag className="w-2.5 h-2.5" />
                                    {item.marca_referencial}
                                    {critical && <span className="text-red-500/70 ml-1">⚠ CRITICAL</span>}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <StockControl
                                    value={item.cantidad_actual}
                                    onDecrement={() => updateQuantity(item.id, item.cantidad_actual - 1)}
                                    onIncrement={() => updateQuantity(item.id, item.cantidad_actual + 1)}
                                    critical={critical}
                                  />
                                  <span className="text-[8px] text-zinc-700 font-mono uppercase w-8 text-center">
                                    {item.unidad}
                                  </span>
                                  <button
                                    onClick={() => openEdit(item)}
                                    className="w-9 h-9 flex items-center justify-center text-zinc-600 hover:text-blue-400 hover:bg-zinc-800 rounded-sm transition-colors touch-manipulation"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.id)}
                                    className="w-9 h-9 flex items-center justify-center text-zinc-700 hover:text-red-500 hover:bg-zinc-800 rounded-sm transition-colors touch-manipulation"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════ RECIPES ════════════════════════════════ */}
          {activeTab === 'recipes' && (
            <motion.div
              key="recipes"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="p-4 space-y-5"
            >
              <SectionHeader
                icon={ChefHat}
                title="CUISINE_ANALYTICS"
                subtitle="Protocols filtered by real-time hardware level validation"
                color="#22c55e"
              />

              {recipes.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-zinc-800 rounded-sm">
                  <UtensilsCrossed className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                  <p className="text-zinc-600 font-mono text-[9px] uppercase tracking-widest leading-loose">
                    // Incomplete_Components_Detected<br />
                    // Access_Denied_To_Cuisine_Models
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recipes.map(recipe => (
                    <div
                      key={recipe.id}
                      className="bg-[#121214] border border-zinc-800 rounded-sm hover:border-green-500/30 transition-all overflow-hidden"
                    >
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="text-sm font-black text-white uppercase tracking-widest flex-1 pr-4">
                            {recipe.nombre}
                          </h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[9px] text-green-500 font-mono font-bold uppercase tracking-tighter">READY</span>
                          </div>
                        </div>
                        <div className="space-y-1.5 mb-4">
                          {recipe.ingredientes.map((ing, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 text-[10px] text-zinc-400 font-mono">
                              <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />
                              <span>{ing.nombre}</span>
                              <span className="text-zinc-700">[{ing.cantidad}]</span>
                            </div>
                          ))}
                        </div>
                        <button className="w-full bg-zinc-900 text-zinc-400 py-3 rounded-sm font-black text-[9px] uppercase tracking-[0.3em] hover:bg-green-600 hover:text-white border border-zinc-800 hover:border-green-400 transition-all touch-manipulation flex items-center justify-center gap-2">
                          <Zap className="w-3.5 h-3.5" /> EXECUTE_PREPARATION
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── FAB ── */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92, rotate: 90 }}
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-orange-600 text-white rounded-full shadow-[0_0_20px_rgba(249,115,22,0.5)] flex items-center justify-center border-4 border-[#0A0A0B] z-40 touch-manipulation"
      >
        <Plus className="w-7 h-7" />
      </motion.button>

      {/* ── Stats bar (bottom) ── */}
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-[#0A0A0B] border-t border-zinc-800/80 z-30 backdrop-blur-md">
        <div className="h-full grid grid-cols-4 divide-x divide-zinc-800/60">
          {[
            { label: 'Productos', value: inventory.length,    color: '#71717a' },
            { label: 'Críticos',  value: criticalItems.length, color: '#ef4444' },
            { label: 'Recetas',   value: recipes.length,       color: '#22c55e' },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center justify-center gap-0.5">
              <span className="font-mono text-base font-black leading-none" style={{ color: s.color }}>
                {s.value}
              </span>
              <span className="text-[7px] font-black uppercase tracking-widest text-zinc-600 leading-none">
                {s.label}
              </span>
            </div>
          ))}
          {/* Online indicator — 4th cell */}
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]" />
            <span className="text-[7px] font-mono text-zinc-600 uppercase tracking-wider leading-none">Online</span>
          </div>
        </div>
      </div>

      {/* ── Add Product Modal ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              className="w-full max-w-lg bg-[#121214] border-t-2 sm:border-2 border-zinc-800 rounded-t-2xl sm:rounded-sm shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-orange-600 rounded">
                    <PlusCircle className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-black text-zinc-100 uppercase tracking-tight italic">Nuevo Producto</h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-600 hover:text-white transition-colors touch-manipulation">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddProduct} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                <div>
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-1.5 block">
                    Nombre del producto <span className="text-orange-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Ej: Harina"
                    value={newProduct.nombre}
                    onChange={e => setNewProduct({ ...newProduct, nombre: e.target.value })}
                    className="w-full bg-[#0A0A0B] border border-zinc-800 px-4 h-12 rounded-sm text-sm text-white focus:border-orange-600/70 outline-none transition-colors font-medium placeholder:text-zinc-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-1.5 block">
                      Marca
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: PAN"
                      value={newProduct.marca_referencial}
                      onChange={e => setNewProduct({ ...newProduct, marca_referencial: e.target.value })}
                      className="w-full bg-[#0A0A0B] border border-zinc-800 px-4 h-12 rounded-sm text-sm text-white outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-1.5 block">
                      Pasillo / Categoría <span className="text-orange-500">*</span>
                    </label>
                    <select
                      value={newProduct.categoria}
                      onChange={e => setNewProduct({ ...newProduct, categoria: e.target.value })}
                      className="w-full bg-[#0A0A0B] border border-zinc-800 px-4 h-12 rounded-sm text-sm text-zinc-300 outline-none focus:border-orange-600/70 transition-colors appearance-none"
                    >
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-1.5 block">
                      Cantidad actual <span className="text-orange-500">*</span>
                    </label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={newProduct.cantidad_actual}
                      onChange={e => setNewProduct({ ...newProduct, cantidad_actual: e.target.value })}
                      className="w-full bg-[#0A0A0B] border border-zinc-800 px-3 h-12 rounded-sm text-sm text-white outline-none focus:border-orange-600/70 transition-colors font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-1.5 block">
                      Alerta mínima <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="1"
                      value={newProduct.cantidad_minima_alerta}
                      onChange={e => setNewProduct({ ...newProduct, cantidad_minima_alerta: e.target.value })}
                      className="w-full bg-[#0A0A0B] border border-zinc-800 px-3 h-12 rounded-sm text-sm text-white outline-none focus:border-red-600/70 transition-colors font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-1.5 block">
                      Unidad
                    </label>
                    <select
                      value={newProduct.unidad}
                      onChange={e => setNewProduct({ ...newProduct, unidad: e.target.value })}
                      className="w-full bg-[#0A0A0B] border border-zinc-800 px-3 h-12 rounded-sm text-sm text-zinc-300 outline-none focus:border-zinc-600 transition-colors appearance-none"
                    >
                      {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                {/* Helper text for alert field */}
                <p className="text-[9px] text-zinc-600 font-mono italic px-1">
                  💡 Alerta mínima: cuando quede esta cantidad, el producto aparece en tu lista de compras.
                </p>

                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white h-14 rounded-sm font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-2 mt-2 touch-manipulation"
                >
                  <Save className="w-5 h-5" /> Guardar en Despensa
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Edit Product Modal ── */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              className="w-full max-w-lg bg-[#121214] border-t-2 sm:border-2 border-blue-500/40 rounded-t-2xl sm:rounded-sm shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-blue-600 rounded">
                    <Edit3 className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-black text-zinc-100 uppercase tracking-tight italic">EDIT_NODE</h2>
                </div>
                <button onClick={() => setEditingProduct(null)} className="p-2 text-zinc-600 hover:text-white transition-colors touch-manipulation">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                <div>
                  <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Nombre</label>
                  <input
                    type="text"
                    value={editForm.nombre ?? ''}
                    onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                    className="w-full bg-[#0A0A0B] border border-zinc-800 px-4 h-12 rounded-sm text-sm text-white focus:border-blue-600/70 outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Marca</label>
                    <input
                      type="text"
                      value={editForm.marca_referencial ?? ''}
                      onChange={e => setEditForm({ ...editForm, marca_referencial: e.target.value })}
                      className="w-full bg-[#0A0A0B] border border-zinc-800 px-4 h-12 rounded-sm text-sm text-white outline-none focus:border-zinc-600 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Categoría</label>
                    <select
                      value={editForm.categoria ?? ''}
                      onChange={e => setEditForm({ ...editForm, categoria: e.target.value })}
                      className="w-full bg-[#0A0A0B] border border-zinc-800 px-4 h-12 rounded-sm text-sm text-zinc-300 outline-none transition-colors appearance-none"
                    >
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Stock actual</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.cantidad_actual ?? 0}
                      onChange={e => setEditForm({ ...editForm, cantidad_actual: Number(e.target.value) })}
                      className="w-full bg-[#0A0A0B] border border-zinc-800 px-3 h-12 rounded-sm text-sm text-white outline-none font-mono focus:border-blue-600/70 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Mínimo</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.cantidad_minima_alerta ?? 0}
                      onChange={e => setEditForm({ ...editForm, cantidad_minima_alerta: Number(e.target.value) })}
                      className="w-full bg-[#0A0A0B] border border-zinc-800 px-3 h-12 rounded-sm text-sm text-white outline-none font-mono focus:border-red-600/70 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Unidad</label>
                    <select
                      value={editForm.unidad ?? 'kg'}
                      onChange={e => setEditForm({ ...editForm, unidad: e.target.value })}
                      className="w-full bg-[#0A0A0B] border border-zinc-800 px-3 h-12 rounded-sm text-sm text-zinc-300 outline-none transition-colors appearance-none"
                    >
                      {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSaveEdit}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white h-14 rounded-sm font-black uppercase tracking-[0.25em] shadow-xl transition-all flex items-center justify-center gap-2 mt-2 touch-manipulation"
                >
                  <Save className="w-5 h-5" /> SAVE_CHANGES
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
