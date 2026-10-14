import React, { useState } from 'react';
import { 
  Sparkles, 
  ShoppingCart, 
  Check, 
  Settings, 
  LayoutGrid, 
  List, 
  User, 
  Wand2
} from 'lucide-react';
import type { Garment, ColorOption } from '../types/kiosk';
import { MOCK_GARMENTS } from '../data/mockGarments';
import { kioskAudio } from '../utils/audio';

interface CatalogViewProps {
  onSelectGarment: (garment: Garment, selectedSize: string) => void;
}

type MainViewMode = 'canvas' | 'customizer' | 'cart';
type CartSubMode = 'pair' | 'product';

export const CatalogView: React.FC<CatalogViewProps> = ({ onSelectGarment }) => {
  // Top category navigation
  const [activeCategory, setActiveCategory] = useState<string>('Top Body');
  
  // Selected garment & active variants
  const [selectedGarment, setSelectedGarment] = useState<Garment>(MOCK_GARMENTS[0]);
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [selectedColor, setSelectedColor] = useState<string>('White');
  
  // Cart items & view mode state
  const [viewMode, setViewMode] = useState<MainViewMode>('canvas');
  const [cartSubMode, setCartSubMode] = useState<CartSubMode>('pair');
  const [cartItems, setCartItems] = useState<Garment[]>([
    MOCK_GARMENTS[0], // Basic t-shirt
    MOCK_GARMENTS[3], // Short Pants
    MOCK_GARMENTS[4], // Short shoes
  ]);
  const [cartCount, setCartCount] = useState<number>(3);
  const [notification, setNotification] = useState<string | null>(null);

  const categories = [
    { id: 'Full body', label: 'Full body' },
    { id: 'Top Body', label: 'Top Body' },
    { id: 'Head', label: 'Head' },
    { id: 'Pants', label: 'Pants' },
    { id: 'Foot', label: 'Foot' },
  ];

  // Garments filtered by category (with fallback to show relevant items)
  const filteredGarments = MOCK_GARMENTS.filter((g) => {
    if (activeCategory === 'Full body') return g.category === 'Full body' || g.category === 'Dress' || g.isSaree;
    if (activeCategory === 'Top Body') return g.category === 'Top Body' || g.category === 'Upper';
    if (activeCategory === 'Pants') return g.category === 'Pants' || g.category === 'Lower';
    if (activeCategory === 'Foot') return g.category === 'Foot';
    if (activeCategory === 'Head') return g.category === 'Head' || g.collection?.includes('Accessories');
    return true;
  });

  // Items for the side carousels / quick-swaps
  const sweaterGarment = MOCK_GARMENTS.find(g => g.id === 'garm_vf_sweater') || MOCK_GARMENTS[1];
  const shirtGarment = MOCK_GARMENTS.find(g => g.id === 'garm_vf_shirt') || MOCK_GARMENTS[2];
  const shortsGarment = MOCK_GARMENTS.find(g => g.id === 'garm_vf_shorts') || MOCK_GARMENTS[3];
  const shoesGarment = MOCK_GARMENTS.find(g => g.id === 'garm_vf_shoes_white') || MOCK_GARMENTS[4];

  const handleCategoryChange = (catId: string) => {
    kioskAudio.playBeep(650, 0.05);
    setActiveCategory(catId);
    const firstMatch = MOCK_GARMENTS.find(g => {
      if (catId === 'Full body') return g.category === 'Full body' || g.isSaree;
      if (catId === 'Top Body') return g.category === 'Top Body' || g.category === 'Upper';
      if (catId === 'Pants') return g.category === 'Pants';
      if (catId === 'Foot') return g.category === 'Foot';
      return false;
    });
    if (firstMatch) {
      setSelectedGarment(firstMatch);
      setSelectedSize(firstMatch.availableSizes[0] || 'M');
    }
  };

  const handleSelectGarmentDirect = (garment: Garment) => {
    kioskAudio.playBeep(750, 0.05);
    setSelectedGarment(garment);
    if (!garment.availableSizes.includes(selectedSize)) {
      setSelectedSize(garment.availableSizes[0] || 'M');
    }
  };

  const handleAddToCart = (garmentToAdd: Garment = selectedGarment) => {
    kioskAudio.playBeep(900, 0.08);
    if (!cartItems.some(item => item.id === garmentToAdd.id)) {
      setCartItems([...cartItems, garmentToAdd]);
      setCartCount(prev => prev + 1);
    }
    showToast(`Added ${garmentToAdd.name} to cart`);
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  const handleLaunchTryon = (garment: Garment = selectedGarment, size: string = selectedSize) => {
    kioskAudio.playBeep(850, 0.1);
    onSelectGarment(garment, size);
  };

  // Color swatch definitions
  const defaultColors: ColorOption[] = [
    { name: 'White', hex: '#FFFFFF', borderHex: '#D1D5DB' },
    { name: 'Blush Pink', hex: '#E8B4B8' },
    { name: 'Terracotta', hex: '#E07A5F' },
    { name: 'Tangerine', hex: '#F28E2B' },
    { name: 'Royal Cobalt', hex: '#2B6CB0' },
  ];

  const activeColors = selectedGarment.colors && selectedGarment.colors.length > 0 
    ? selectedGarment.colors 
    : defaultColors;

  // Size chart options
  const defaultSizeChart = [
    { size: 'XS', dimension: '34x30 inches' },
    { size: 'S', dimension: '36x32 inches' },
    { size: 'M', dimension: '38x34 inches' },
    { size: 'L', dimension: '40x36 inches' },
    { size: 'XL', dimension: '42x38 inches' },
  ];

  const activeSizeChart = selectedGarment.sizeChart && selectedGarment.sizeChart.length > 0
    ? selectedGarment.sizeChart
    : defaultSizeChart;

  // Active central model image
  const centralModelImg = selectedGarment.virtualModelImage || selectedGarment.tryonResultImage || '/assets/virtualfit_model_tshirt.jpg';

  // Calculate cart total
  const cartTotalPrice = cartItems.reduce((acc, curr) => {
    return acc + (curr.priceNumber || parseInt(curr.price.replace(/[^0-9]/g, '')) || 50);
  }, 0);

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col items-center justify-start p-4 md:p-6 select-none overflow-y-auto">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 spatial-glass px-5 py-2.5 rounded-full text-xs font-bold text-slate-900 border border-white shadow-xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>{notification}</span>
        </div>
      )}

      {/* 1. TOP FLOATING PILL NAVIGATION (Full body | Top Body | Head | Pants | Foot) */}
      <div className="relative z-30 mb-5">
        <div className="spatial-pill p-1.5 flex items-center gap-1.5 shadow-lg border border-white/70">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-300 ${
                  isActive
                    ? 'spatial-pill-active text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. MAIN FLOATING SPATIAL GLASS VIEWPORT */}
      <div className="relative w-full max-w-5xl spatial-glass rounded-[2.5rem] p-6 md:p-8 border border-white/80 shadow-2xl flex flex-col min-h-[720px] justify-between">
        {/* HUD Top Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-white/40 mb-4">
          {/* Left HUD Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                kioskAudio.playBeep(600, 0.05);
                setViewMode('canvas');
              }}
              className="spatial-pill px-4 py-2 text-xs font-bold text-slate-800 flex items-center gap-2 hover:bg-white/60 shadow-xs border border-white/70"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>VirtualFit</span>
            </button>

            <button
              onClick={() => {
                kioskAudio.playBeep(600, 0.05);
                setViewMode(viewMode === 'customizer' ? 'canvas' : 'customizer');
              }}
              className={`p-2 rounded-full spatial-pill border border-white/70 shadow-xs transition-all ${
                viewMode === 'customizer' ? 'spatial-pill-active' : 'text-slate-700 hover:bg-white/60'
              }`}
              title="Customize Persona & Variants"
            >
              <User className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                kioskAudio.playBeep(600, 0.05);
                setViewMode('cart');
                setCartSubMode('product');
              }}
              className={`p-2 rounded-full spatial-pill border border-white/70 shadow-xs transition-all ${
                viewMode === 'cart' && cartSubMode === 'product' ? 'spatial-pill-active' : 'text-slate-700 hover:bg-white/60'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                kioskAudio.playBeep(600, 0.05);
                setViewMode('cart');
                setCartSubMode('pair');
              }}
              className={`p-2 rounded-full spatial-pill border border-white/70 shadow-xs transition-all ${
                viewMode === 'cart' && cartSubMode === 'pair' ? 'spatial-pill-active' : 'text-slate-700 hover:bg-white/60'
              }`}
              title="Outfit Pairing View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Right HUD Controls */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleAddToCart(selectedGarment)}
              className="spatial-pill px-4 py-2 text-xs font-bold text-slate-800 flex items-center gap-2 hover:bg-white/60 shadow-xs border border-white/70 active:scale-95"
            >
              <ShoppingCart className="w-4 h-4 text-slate-700" />
              <span>Add to cart</span>
              {cartCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                kioskAudio.playBeep(700, 0.05);
                setViewMode('cart');
              }}
              className="spatial-pill px-4 py-2 text-xs font-bold text-slate-900 flex items-center gap-2 hover:bg-white/70 shadow-xs border border-white/70 active:scale-95"
            >
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Checkout</span>
            </button>

            <button
              onClick={() => {
                kioskAudio.playBeep(600, 0.05);
                setViewMode(viewMode === 'customizer' ? 'canvas' : 'customizer');
              }}
              className="p-2 rounded-full spatial-pill border border-white/70 text-slate-700 hover:bg-white/60 shadow-xs"
              title="Preferences"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VIEW MODE 1: SPATIAL CANVAS (Center model + Left/Right garments) */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'canvas' && (
          <div className="relative w-full flex-1 flex items-center justify-between min-h-[520px]">
            {/* Left Floating Garment Pedestal (Basic Sweater) */}
            <div 
              onClick={() => handleSelectGarmentDirect(sweaterGarment)}
              className="group cursor-pointer flex flex-col items-center spatial-card p-4 rounded-3xl border border-white/70 shadow-lg hover:scale-105 transition-all duration-300 w-44 z-20"
            >
              <div className="w-32 h-32 flex items-center justify-center p-2 mb-2">
                <img
                  src={sweaterGarment.flatlayImage}
                  alt={sweaterGarment.name}
                  className="max-w-full max-h-full object-contain filter drop-shadow-md group-hover:scale-110 transition duration-300"
                />
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-slate-900">{sweaterGarment.name}</div>
                <div className="text-xs font-semibold text-slate-600">{sweaterGarment.price}</div>
              </div>
            </div>

            {/* Central Model Stage */}
            <div className="relative flex-1 flex flex-col items-center justify-center px-4 z-10">
              <div className="relative w-full max-w-sm h-[480px] flex items-center justify-center overflow-hidden rounded-3xl">
                <img
                  src={centralModelImg}
                  alt={selectedGarment.name}
                  className="w-full h-full object-contain filter drop-shadow-xl transition-all duration-500"
                />

                {/* Saree Badge if draped */}
                {selectedGarment.isSaree && (
                  <div className="absolute top-4 bg-white/80 border border-white px-3 py-1 rounded-full text-xs font-bold text-rose-900 shadow-md backdrop-blur-md flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Draped Saree Look</span>
                  </div>
                )}
              </div>

              {/* Bottom Floating Pill Overlay: Selected Garment Info + Edit Button */}
              <div className="relative -mt-8 z-30 spatial-glass px-6 py-3.5 rounded-full border border-white/90 shadow-2xl flex items-center gap-5">
                <div>
                  <div className="text-sm font-extrabold text-slate-900 leading-none">{selectedGarment.name}</div>
                  <div className="text-xs font-semibold text-slate-600 mt-0.5">{selectedGarment.price}</div>
                </div>

                <div className="h-5 w-[1px] bg-slate-300" />

                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span className="spatial-pill px-2.5 py-0.5 text-[11px] font-bold">Size: {selectedSize}</span>
                  <span className="spatial-pill px-2.5 py-0.5 text-[11px] font-bold">Color: {selectedColor}</span>
                </div>

                <button
                  onClick={() => {
                    kioskAudio.playBeep(700, 0.05);
                    setViewMode('customizer');
                  }}
                  className="spatial-pill-active px-3 py-1 rounded-full text-xs font-bold text-slate-900 hover:bg-white shadow-xs border border-white"
                >
                  Edit
                </button>

                <button
                  onClick={() => handleLaunchTryon(selectedGarment, selectedSize)}
                  className="spatial-btn-primary px-4 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Virtual Try-On</span>
                </button>
              </div>
            </div>

            {/* Right Floating Garment Pedestal (Basic Shirt) */}
            <div 
              onClick={() => handleSelectGarmentDirect(shirtGarment)}
              className="group cursor-pointer flex flex-col items-center spatial-card p-4 rounded-3xl border border-white/70 shadow-lg hover:scale-105 transition-all duration-300 w-44 z-20"
            >
              <div className="w-32 h-32 flex items-center justify-center p-2 mb-2">
                <img
                  src={shirtGarment.flatlayImage}
                  alt={shirtGarment.name}
                  className="max-w-full max-h-full object-contain filter drop-shadow-md group-hover:scale-110 transition duration-300"
                />
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-slate-900">{shirtGarment.name}</div>
                <div className="text-xs font-semibold text-slate-600">{shirtGarment.price}</div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW MODE 2: VARIANT CUSTOMIZER (Model left + Size/Color Right) */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'customizer' && (
          <div className="relative w-full flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 items-center min-h-[520px]">
            {/* Left: Model Preview */}
            <div className="relative flex flex-col items-center justify-center h-full">
              <div className="relative w-full max-w-sm h-[480px] flex items-center justify-center overflow-hidden rounded-3xl">
                <img
                  src={centralModelImg}
                  alt={selectedGarment.name}
                  className="w-full h-full object-contain filter drop-shadow-xl"
                />
              </div>

              {/* Floating Name Badge */}
              <div className="-mt-6 spatial-glass px-5 py-2 rounded-full border border-white/80 shadow-lg text-center">
                <span className="text-xs font-extrabold text-slate-900">{selectedGarment.name}</span>
                <span className="text-xs text-slate-600 ml-2 font-semibold">{selectedGarment.price}</span>
              </div>
            </div>

            {/* Right: Customization Drawer Panel */}
            <div className="spatial-card rounded-3xl p-6 border border-white/80 shadow-xl flex flex-col justify-between h-[480px]">
              <div>
                {/* Sub-tabs: Select variant | Select another item */}
                <div className="flex items-center gap-2 mb-4">
                  <button className="spatial-pill-active px-4 py-1.5 rounded-full text-xs font-bold text-slate-900 border border-white">
                    Select variant
                  </button>
                  <button 
                    onClick={() => {
                      kioskAudio.playBeep(650, 0.05);
                      setViewMode('cart');
                      setCartSubMode('product');
                    }}
                    className="spatial-pill px-4 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    Select another item
                  </button>
                </div>

                {/* Size Chart Card */}
                <div className="mb-5">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                    Size chart
                  </div>
                  <div className="space-y-1.5">
                    {activeSizeChart.map((item) => {
                      const isSelected = selectedSize === item.size;
                      return (
                        <div
                          key={item.size}
                          onClick={() => {
                            kioskAudio.playBeep(700, 0.04);
                            setSelectedSize(item.size);
                          }}
                          className={`flex items-center justify-between px-4 py-2 rounded-2xl cursor-pointer transition-all duration-200 border ${
                            isSelected
                              ? 'spatial-pill-active border-white text-slate-950 font-extrabold shadow-sm'
                              : 'spatial-pill border-white/50 text-slate-700 hover:bg-white/50 font-medium'
                          }`}
                        >
                          <span className="text-xs font-mono font-bold">{item.size}</span>
                          <span className="text-xs text-slate-500 font-medium">{item.dimension}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Color Selector */}
                <div>
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                    <span>Color</span>
                    <span className="text-xs text-slate-500 font-semibold">{selectedColor}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {activeColors.map((col) => {
                      const isSelected = selectedColor === col.name;
                      return (
                        <button
                          key={col.name}
                          onClick={() => {
                            kioskAudio.playBeep(750, 0.04);
                            setSelectedColor(col.name);
                          }}
                          className={`w-7 h-7 rounded-full transition-all duration-200 ${
                            isSelected
                              ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white scale-110 shadow-md'
                              : 'hover:scale-105 opacity-85 hover:opacity-100 shadow-xs'
                          }`}
                          style={{
                            backgroundColor: col.hex,
                            border: col.borderHex ? `1px solid ${col.borderHex}` : '1px solid rgba(0,0,0,0.1)'
                          }}
                          title={col.name}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/50">
                <button
                  onClick={() => handleAddToCart(selectedGarment)}
                  className="p-3 rounded-full spatial-pill border border-white/80 text-slate-800 hover:bg-white/60 shadow-xs active:scale-95"
                  title="Add to cart"
                >
                  <ShoppingCart className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    kioskAudio.playBeep(850, 0.08);
                    setViewMode('cart');
                  }}
                  className="flex-1 py-3 px-5 rounded-full spatial-pill-active border border-white text-slate-900 text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-white active:scale-98"
                >
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Checkout items</span>
                </button>

                <button
                  onClick={() => handleLaunchTryon(selectedGarment, selectedSize)}
                  className="py-3 px-5 rounded-full spatial-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-98"
                >
                  <Sparkles className="w-4 h-4 text-indigo-300" />
                  <span>Try On</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW MODE 3: CART VIEW (As a pair vs Product grid) */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'cart' && (
          <div className="relative w-full flex-1 flex flex-col justify-between min-h-[520px]">
            {/* View Mode Header & Segmented Pill */}
            <div className="flex flex-col items-center mb-4 text-center">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Choose your cart view</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                View as a pair or as an individual item, it's all up to your convenience
              </p>

              {/* Segmented Control */}
              <div className="spatial-pill p-1 flex items-center gap-1 mt-3 border border-white/70 shadow-sm">
                <button
                  onClick={() => {
                    kioskAudio.playBeep(650, 0.05);
                    setCartSubMode('pair');
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    cartSubMode === 'pair'
                      ? 'spatial-pill-active text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  As a pair
                </button>
                <button
                  onClick={() => {
                    kioskAudio.playBeep(650, 0.05);
                    setCartSubMode('product');
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    cartSubMode === 'product'
                      ? 'spatial-pill-active text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Product
                </button>
              </div>
            </div>

            {/* SUB-VIEW A: AS A PAIR (Outfit combination layout - Image 3) */}
            {cartSubMode === 'pair' && (
              <div className="relative flex-1 flex flex-col items-center justify-center py-2">
                {/* Outfit Assembly Board */}
                <div className="flex flex-col items-center gap-3">
                  {/* Top Garment */}
                  <div className="w-48 h-40 flex items-center justify-center p-2 spatial-card rounded-3xl border border-white/60 shadow-md">
                    <img
                      src={selectedGarment.flatlayImage}
                      alt={selectedGarment.name}
                      className="max-h-full max-w-full object-contain filter drop-shadow-md"
                    />
                  </div>

                  {/* Bottom Pants / Shorts */}
                  <div className="w-40 h-32 flex items-center justify-center p-2 spatial-card rounded-3xl border border-white/60 shadow-md">
                    <img
                      src={shortsGarment.flatlayImage}
                      alt={shortsGarment.name}
                      className="max-h-full max-w-full object-contain filter drop-shadow-md"
                    />
                  </div>

                  {/* Footwear / Sneakers */}
                  <div className="w-36 h-24 flex items-center justify-center p-2 spatial-card rounded-2xl border border-white/60 shadow-md">
                    <img
                      src={shoesGarment.flatlayImage}
                      alt={shoesGarment.name}
                      className="max-h-full max-w-full object-contain filter drop-shadow-md"
                    />
                  </div>
                </div>

                {/* Floating Summary Bar */}
                <div className="mt-4 spatial-glass px-6 py-3 rounded-full border border-white/90 shadow-xl flex items-center gap-5">
                  <div className="text-xs font-bold text-slate-900">
                    <span>3 products</span>
                    <span className="mx-2 text-slate-400">•</span>
                    <span className="text-slate-700">${cartTotalPrice}</span>
                  </div>

                  <button
                    onClick={() => handleLaunchTryon(selectedGarment, selectedSize)}
                    className="spatial-pill-active px-4 py-1.5 rounded-full text-xs font-bold text-slate-900 hover:bg-white shadow-xs border border-white flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Virtual Try-on</span>
                  </button>

                  <button
                    onClick={() => {
                      kioskAudio.playBeep(900, 0.08);
                      showToast('Outfit order confirmed!');
                    }}
                    className="spatial-btn-primary px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-md active:scale-95"
                  >
                    <span>Checkout items</span>
                  </button>
                </div>
              </div>
            )}

            {/* SUB-VIEW B: PRODUCT GRID (3x3 grid - Image 4) */}
            {cartSubMode === 'product' && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto pr-2 py-2">
                  {(filteredGarments.length > 0 ? filteredGarments : MOCK_GARMENTS).map((garment) => {
                    const isSelected = selectedGarment.id === garment.id;
                    return (
                      <div
                        key={garment.id}
                        onClick={() => {
                          kioskAudio.playBeep(700, 0.04);
                          setSelectedGarment(garment);
                        }}
                        className={`spatial-card rounded-2xl p-3 border cursor-pointer flex flex-col justify-between transition-all ${
                          isSelected
                            ? 'border-slate-900/40 ring-2 ring-slate-900/20 shadow-md bg-white/70'
                            : 'border-white/60 hover:border-white shadow-xs'
                        }`}
                      >
                        <div className="w-full h-28 flex items-center justify-center p-2 mb-2">
                          <img
                            src={garment.flatlayImage}
                            alt={garment.name}
                            className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 truncate">{garment.name}</span>
                          <span className="font-semibold text-slate-600 ml-1">{garment.price}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Floating Summary Bar */}
                <div className="mt-4 mx-auto spatial-glass px-6 py-3 rounded-full border border-white/90 shadow-xl flex items-center gap-5">
                  <div className="text-xs font-bold text-slate-900">
                    <span>{cartCount} products</span>
                    <span className="mx-2 text-slate-400">•</span>
                    <span className="text-slate-700">${cartTotalPrice}</span>
                  </div>

                  <button
                    onClick={() => handleLaunchTryon(selectedGarment, selectedSize)}
                    className="spatial-pill-active px-4 py-1.5 rounded-full text-xs font-bold text-slate-900 hover:bg-white shadow-xs border border-white flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Virtual Try-on</span>
                  </button>

                  <button
                    onClick={() => {
                      kioskAudio.playBeep(900, 0.08);
                      showToast('Order confirmed!');
                    }}
                    className="spatial-btn-primary px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-md active:scale-95"
                  >
                    <span>Checkout items</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
