/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Package, 
  UtensilsCrossed, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Minus,
  ChefHat,
  ChevronRight,
  Loader2,
  Database,
  MapPin,
  X,
  PlusCircle,
  Save,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function App() {
  const [inventory, setInventory] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'shopping' | 'recipes'>('shopping');
  const [loading, setLoading] = useState(true);
  const [purchaseItems, setPurchaseItems] = useState<Record<string, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    nombre: '',
    marca_referencial: '',
    cantidad_actual: '',
    cantidad_minima_alerta: '',
    unidad: 'kg',
    categoria: 'Víveres'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invRes, recRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/recipes/suggested')
      ]);
      const invData = await invRes.json();
      const recData = await recRes.json();
      setInventory(invData);
      setRecipes(recData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const updateQuantity = async (id: string, newQty: number) => {
    const finalQty = Math.max(0, newQty);
    // Optimistic Update
    setInventory(prev => prev.map(p => p.id === id ? { ...p, cantidad_actual: finalQty } : p));
    
    try {
      await fetch('/api/inventory/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cantidad_actual: finalQty })
      });
      // Update recipes logic after stock change
      const res = await fetch('/api/recipes/suggested');
      const recData = await res.json();
      setRecipes(recData);
    } catch (error) {
      console.error('Error updating stock:', error);
      fetchData(); // Rollback on error
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setNewProduct({
          nombre: '',
          marca_referencial: '',
          cantidad_actual: '',
          cantidad_minima_alerta: '',
          unidad: 'kg',
          categoria: 'Víveres'
        });
        fetchData();
      }
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const registerPurchase = async () => {
    const items = Object.entries(purchaseItems).map(([id, cantidad]) => ({ id, cantidad }));
    if (items.length === 0) return;

    try {
      await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      setPurchaseItems({});
      fetchData();
    } catch (error) {
      console.error('Error registering purchase:', error);
    }
  };

  const handleAddToCart = (id: string) => {
    setPurchaseItems(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeFromCart = (id: string) => {
    setPurchaseItems(prev => {
      const newItems = { ...prev };
      if (newItems[id] > 1) newItems[id] -= 1;
      else delete newItems[id];
      return newItems;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A0A0B]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-10 h-10 border-2 border-orange-500/20 border-t-orange-500 rounded-full"
        />
      </div>
    );
  }

  const groupedInventory = inventory.reduce((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {} as Record<string, Product[]>);

  const criticalItems = inventory.filter(p => p.cantidad_actual <= p.cantidad_minima_alerta);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E4E4E7] font-sans border-t-8 md:border-8 border-[#18181B] selection:bg-orange-500/30 overflow-x-hidden">
      {/* Tactical Header */}
      <header className="h-20 border-b border-[#27272A] bg-[#121214] px-4 md:px-8 flex items-center justify-between shadow-2xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse"></div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight uppercase text-zinc-100 flex items-center gap-2">
              PANTRY CONTROL <span className="text-zinc-500 font-mono text-xs md:text-sm">v5.0</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-[8px] text-zinc-400 font-mono flex items-center gap-1 uppercase">
                <Database className="w-2 h-2" /> MCBO_DB
              </div>
              <div className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-[8px] text-zinc-400 font-mono flex items-center gap-1 uppercase">
                <MapPin className="w-2 h-2" /> ZULIA_VZLA
              </div>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4">
          <div className="text-right">
             <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest leading-none">Status</p>
             <p className="text-xs text-orange-400 font-mono tracking-tighter uppercase">Operational</p>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map(i => <div key={i} className={`w-1 h-6 ${i === 1 ? 'bg-orange-500' : 'bg-zinc-800'}`}></div>)}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8 pb-32">
        {/* Tactical Tabs */}
        <div className="flex bg-[#121214] rounded overflow-hidden border border-[#27272A] p-0.5 h-12 md:h-14 shadow-inner sticky top-24 z-40">
           <button onClick={() => setActiveTab('shopping')} className={`flex-1 flex items-center justify-center gap-2 md:gap-3 transition-all relative ${activeTab === 'shopping' ? 'bg-[#18181B] text-red-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <ShoppingCart className="w-4 h-4" />
              <span className="text-[10px] md:text-xs uppercase tracking-widest">Suministros</span>
              {activeTab === 'shopping' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444]" />}
           </button>
           <button onClick={() => setActiveTab('inventory')} className={`flex-1 flex items-center justify-center gap-2 md:gap-3 transition-all relative ${activeTab === 'inventory' ? 'bg-[#18181B] text-blue-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <Package className="w-4 h-4" />
              <span className="text-[10px] md:text-xs uppercase tracking-widest">Depósito</span>
              {activeTab === 'inventory' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_8px_#3b82f6]" />}
           </button>
           <button onClick={() => setActiveTab('recipes')} className={`flex-1 flex items-center justify-center gap-2 md:gap-3 transition-all relative ${activeTab === 'recipes' ? 'bg-[#18181B] text-green-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <UtensilsCrossed className="w-4 h-4" />
              <span className="text-[10px] md:text-xs uppercase tracking-widest">Cocina</span>
              {activeTab === 'recipes' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 shadow-[0_0_8px_#22c55e]" />}
           </button>
        </div>

        <section className="bg-[#0A0A0B] border border-[#27272A] rounded-lg overflow-hidden shadow-2xl min-h-[400px]">
          <AnimatePresence mode="wait">
            {activeTab === 'shopping' && (
              <motion.div key="shopping" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-10 space-y-6">
                <div className="flex items-center gap-3 border-b border-red-900/30 pb-6 mb-2">
                   <div className="p-2 bg-red-500/10 border border-red-500/30 rounded shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                   </div>
                   <div>
                      <h2 className="text-red-500 font-bold tracking-widest text-base md:text-lg uppercase italic leading-none">REPLENISHMENT_REQUIRED</h2>
                      <p className="text-zinc-500 text-[9px] uppercase font-mono tracking-tighter mt-1">{criticalItems.length} NODE_ALERTS_TRIGGERED</p>
                   </div>
                </div>

                <div className="grid gap-3">
                  {criticalItems.length > 0 ? criticalItems.map(item => (
                    <div key={item.id} className="p-4 bg-[#121214] border border-red-500/10 rounded flex flex-col sm:flex-row justify-between items-center gap-4 group hover:border-red-500/40 hover:bg-red-500/5 transition-all shadow-sm">
                      <div className="flex flex-col w-full sm:w-auto"> 
                        <span className="text-sm font-bold text-zinc-100 uppercase tracking-tight flex items-center gap-2">
                           {item.nombre} <span className="text-[10px] text-zinc-600 font-normal normal-case italic">({item.marca_referencial})</span>
                        </span> 
                        <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-2 mt-1.5 bg-zinc-900/50 w-fit px-2 py-0.5 rounded border border-zinc-800">
                           <span className="text-red-500/80 font-bold">LVL:</span> {item.cantidad_actual} {item.unidad} <span className="text-zinc-700">|</span> <span className="text-zinc-600">MIN: {item.cantidad_minima_alerta}</span>
                        </span> 
                      </div>
                      <div className="flex items-center justify-between w-full sm:w-auto sm:gap-4">
                        {purchaseItems[item.id] ? (
                          <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-sm p-1">
                             <button onClick={() => removeFromCart(item.id)} className="p-2 px-3 hover:bg-zinc-800 rounded transition-all text-red-500"><Minus className="w-4 h-4" /></button>
                             <span className="w-12 text-center font-mono font-bold text-red-500 text-sm">{purchaseItems[item.id]}</span>
                             <button onClick={() => handleAddToCart(item.id)} className="p-2 px-3 hover:bg-zinc-800 rounded transition-all text-green-500"><Plus className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => handleAddToCart(item.id)} className="w-full sm:w-auto px-6 py-2.5 bg-red-600/90 text-white text-[10px] font-bold rounded-sm uppercase tracking-widest hover:bg-red-500 transition-all flex items-center justify-center gap-2 shadow-[0_4px_10px_rgba(239,68,68,0.2)]">
                             <ShoppingCart className="w-3 h-3" /> ADD_BACKLOG
                          </button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-16 text-zinc-600 border border-dashed border-zinc-800 rounded-sm italic font-mono text-xs uppercase tracking-widest">
                       // Inventory_Stable: No_Queue_Logged
                    </div>
                  )}
                </div>

                {Object.keys(purchaseItems).length > 0 && (
                  <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="pt-8 border-t border-zinc-800">
                    <button onClick={registerPurchase} className="w-full bg-orange-600 text-white py-4 rounded-sm font-bold uppercase tracking-[0.2em] shadow-xl hover:bg-orange-500 transition-all active:scale-[0.98] border border-orange-400/20 flex items-center justify-center gap-3 group">
                       <Save className="w-5 h-5 group-hover:animate-pulse" /> SYNC_DATABASE ({Object.values(purchaseItems).reduce((a, b) => a + b, 0)})
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'inventory' && (
              <motion.div key="inventory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-10 space-y-10 bg-[#121214]/50">
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-zinc-800 pb-6 gap-4">
                    <h2 className="text-zinc-400 font-bold tracking-[0.3em] text-xs uppercase flex items-center gap-2"><Database className="w-4 h-4 text-orange-500" /> LOCAL_DEPOSITORY_MAP</h2>
                    <div className="text-[9px] font-mono text-zinc-600 italic bg-zinc-900 px-3 py-1 rounded border border-zinc-800 uppercase tracking-tighter">Stream: Realtime_Monitoring_Active</div>
                 </div>

                 <div className="grid gap-12">
                   {Object.entries(groupedInventory).map(([categoria, items]) => {
                     const colorHex = categoria === 'Víveres' ? '#f97316' : categoria === 'Refrigerados' ? '#3b82f6' : '#22c55e';
                     return (
                       <div key={categoria} className="space-y-4">
                          <div className="flex items-center gap-3">
                             <div className="h-5 w-1" style={{ backgroundColor: colorHex, boxShadow: `0 0 10px ${colorHex}55` }}></div>
                             <h3 className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest italic">{categoria} // AISLE_SECTOR</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {items.map(item => {
                              const isCritical = item.cantidad_actual <= item.cantidad_minima_alerta;
                              return (
                                <div key={item.id} className={`bg-[#0A0A0B] p-4 border rounded-sm flex justify-between items-center group transition-all duration-300 ${isCritical ? 'border-red-500/40 bg-red-500/5' : 'border-zinc-800/60 hover:border-zinc-700'}`}>
                                   <div className="flex flex-col">
                                      <span className={`text-xs font-bold uppercase tracking-tight ${isCritical ? 'text-red-400 font-black' : 'text-zinc-200'}`}>{item.nombre}</span>
                                      <span className="text-[9px] text-zinc-600 font-mono flex items-center gap-1 mt-1"><Tag className="w-2 h-2" /> {item.marca_referencial}</span>
                                   </div>
                                   <div className="flex flex-col items-end gap-2">
                                      <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-sm">
                                         <button onClick={() => updateQuantity(item.id, item.cantidad_actual - 1)} className="p-1.5 hover:text-red-500 transition-colors cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
                                         <span className={`font-mono text-sm min-w-[28px] text-center ${isCritical ? 'text-red-500 font-bold' : 'text-zinc-200'}`}>{item.cantidad_actual}</span>
                                         <button onClick={() => updateQuantity(item.id, item.cantidad_actual + 1)} className="p-1.5 hover:text-green-500 transition-colors cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
                                      </div>
                                      <span className="text-[8px] text-zinc-700 uppercase font-black tracking-tighter">{item.unidad}</span>
                                   </div>
                                </div>
                              );
                            })}
                          </div>
                       </div>
                     );
                   })}
                 </div>
              </motion.div>
            )}

            {activeTab === 'recipes' && (
              <motion.div key="recipes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-10 space-y-8">
                 <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-950 border border-zinc-800 p-8 rounded-sm shadow-2xl relative overflow-hidden group">
                    <ChefHat className="absolute -right-6 -bottom-6 w-48 h-48 text-white/5 opacity-5 animate-pulse" />
                    <h3 className="text-xl font-black tracking-tighter text-orange-400 uppercase italic flex items-center gap-3">
                       <div className="w-4 h-2 bg-orange-500"></div> CUISINE_ANALYTICS
                    </h3>
                    <p className="text-zinc-500 text-[10px] mt-2 uppercase tracking-wide font-mono">Protocols filtered by real-time hardware level validation.</p>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recipes.length > 0 ? recipes.map(recipe => (
                      <div key={recipe.id} className="bg-[#121214] border border-zinc-800 p-6 rounded-sm hover:border-green-500/40 transition-all flex flex-col justify-between shadow-lg">
                         <div>
                            <div className="flex justify-between items-start mb-6">
                               <h4 className="text-sm font-black text-white uppercase tracking-widest">{recipe.nombre}</h4>
                               <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div><span className="text-[9px] text-green-500 font-mono font-bold uppercase tracking-tighter">Ready</span></div>
                            </div>
                            <div className="space-y-2 mb-6">
                               {recipe.ingredientes.map((ing, idx) => (
                                 <div key={idx} className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono py-1 border-b border-zinc-900/50">
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                    <span>{ing.nombre} <span className="text-zinc-700 ml-1">[{ing.cantidad}]</span></span>
                                 </div>
                               ))}
                            </div>
                         </div>
                         <button className="w-full bg-zinc-900 text-zinc-400 py-3 rounded-sm font-bold text-[9px] uppercase tracking-[0.3em] hover:bg-green-600 hover:text-white border border-zinc-800 hover:border-green-400 transition-all cursor-pointer">EXECUTE_PREPARATION</button>
                      </div>
                    )) : (
                      <div className="col-span-full text-center py-24 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-sm">
                         <AlertTriangle className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
                         <p className="text-zinc-500 uppercase font-mono text-xs tracking-widest">Incomplete components detected. Access denied to cuisine models.</p>
                      </div>
                    )}
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Global Stats Footer */}
        <div className="border border-zinc-800 bg-[#121214] p-8 rounded-sm grid grid-cols-1 sm:grid-cols-3 gap-8 text-center shadow-lg relative overflow-hidden">
           <div className="absolute top-0 right-0 w-24 h-[1px] bg-gradient-to-r from-transparent to-orange-500/20"></div>
           {[
             { label: 'System_Nodes', value: inventory.length, icon: Database, sub: 'SKU_Total_Units' },
             { label: 'Sec_Threats', value: criticalItems.length, icon: AlertTriangle, sub: 'Depletion_Gates', color: 'red-500' },
             { label: 'Ready_Models', value: recipes.length, icon: ChefHat, sub: 'Validated_Paths', color: 'green-500' }
           ].map((stat, i) => (
             <React.Fragment key={i}>
                <div className="space-y-2">
                   <p className={`text-[9px] uppercase font-mono tracking-widest font-black flex items-center justify-center gap-2 ${stat.color ? `text-${stat.color}/70` : 'text-zinc-700'}`}>
                      <stat.icon className="w-3 h-3" /> {stat.label}
                   </p>
                   <p className={`text-5xl font-mono tracking-tighter ${stat.color ? `text-${stat.color} shadow-${stat.color}/20` : 'text-zinc-200'}`}>{stat.value}</p>
                   <p className="text-[7px] text-zinc-800 uppercase font-black uppercase tracking-tighter">{stat.sub}</p>
                </div>
                {i < 2 && <div className="hidden sm:block h-full w-[1px] bg-zinc-800 self-center"></div>}
             </React.Fragment>
           ))}
        </div>
      </main>

      {/* FAB - ADD PRODUCT */}
      <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setIsModalOpen(true)} className="fixed bottom-12 right-6 w-16 h-16 bg-orange-600 text-white rounded-full shadow-[0_0_20px_rgba(249,115,22,0.5)] flex items-center justify-center border-4 border-[#0A0A0B] z-[60] cursor-pointer">
         <Plus className="w-8 h-8" />
      </motion.button>

      {/* MODAL - NEW PRODUCT */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/90 backdrop-blur-md">
             <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="w-full max-w-md bg-[#121214] border-2 border-zinc-800 rounded-sm shadow-2xl p-6 relative">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-zinc-600 hover:text-white transition-colors cursor-pointer"><X className="w-6 h-6" /></button>
                <div className="flex items-center gap-3 mb-8">
                   <div className="p-2 bg-orange-600 rounded"><PlusCircle className="w-6 h-6 text-white" /></div>
                   <h2 className="text-xl font-black text-zinc-100 uppercase tracking-tighter italic">NEW_NODE_ENTRY</h2>
                </div>
                <form onSubmit={handleAddProduct} className="space-y-5">
                   <div className="space-y-1">
                      <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] ml-1">Core_Designation</label>
                      <input required type="text" placeholder="Designación de producto..." value={newProduct.nombre} onChange={e => setNewProduct({...newProduct, nombre: e.target.value})} className="w-full bg-[#0A0A0B] border border-zinc-800 px-4 py-3 rounded-sm text-sm text-white focus:border-orange-600 focus:shadow-[0_0_10px_rgba(234,88,12,0.1)] outline-none transition-all font-bold placeholder:text-zinc-800" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] ml-1">Hardware_Brand</label>
                         <input type="text" placeholder="Marca/Fabricante..." value={newProduct.marca_referencial} onChange={e => setNewProduct({...newProduct, marca_referencial: e.target.value})} className="w-full bg-[#0A0A0B] border border-zinc-800 px-4 py-3 rounded-sm text-sm text-white outline-none focus:border-zinc-500 placeholder:text-zinc-800" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] ml-1">Category_Aisle</label>
                         <select value={newProduct.categoria} onChange={e => setNewProduct({...newProduct, categoria: e.target.value})} className="w-full bg-[#0A0A0B] border border-zinc-800 px-4 py-3 rounded-sm text-sm text-zinc-400 outline-none focus:border-orange-600 appearance-none">
                            {['Víveres', 'Refrigerados', 'Limpieza', 'Higiene'].map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] ml-1">Initial_Vol</label>
                         <input required type="number" step="0.01" placeholder="0.00" value={newProduct.cantidad_actual} onChange={e => setNewProduct({...newProduct, cantidad_actual: e.target.value})} className="w-full bg-[#0A0A0B] border border-zinc-800 px-4 py-3 rounded-sm text-sm text-white outline-none focus:border-orange-600 font-mono" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] ml-1">Min_Threshold</label>
                         <input required type="number" step="0.01" placeholder="1.00" value={newProduct.cantidad_minima_alerta} onChange={e => setNewProduct({...newProduct, cantidad_minima_alerta: e.target.value})} className="w-full bg-[#0A0A0B] border border-zinc-800 px-4 py-3 rounded-sm text-sm text-white outline-none focus:border-red-600 font-mono" />
                      </div>
                   </div>
                   <div className="pt-4">
                      <button type="submit" className="w-full bg-orange-600 text-white py-4 rounded-sm font-black uppercase tracking-[0.3em] shadow-xl hover:bg-orange-500 shadow-orange-950/20 active:scale-[0.98] transition-all cursor-pointer">COMMENCE_INITIALIZATION</button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* System Status Footer */}
      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-[#0A0A0B] border-t border-zinc-800 px-4 md:px-6 flex items-center justify-between text-[8px] md:text-[9px] font-mono text-zinc-700 z-50 pointer-events-none backdrop-blur-md">
         <div className="flex gap-4"><span>OS: MCBO_PANTRY_PROT_V5.0</span><span className="hidden sm:inline">||</span><span>KERNEL_READY</span></div>
         <div className="flex gap-4 items-center uppercase">
            <div className="flex gap-1 items-center">
               <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]"></div>
               <span>Sys_Health: Perfect</span>
            </div>
            <span className="hidden lg:inline text-zinc-900 select-none">GPS: 10.6666N / 71.6124W</span>
         </div>
      </footer>
    </div>
  );
}
