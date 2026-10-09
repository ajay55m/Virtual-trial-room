import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Garment } from '../types/kiosk';
import { MOCK_GARMENTS } from '../data/mockGarments';
import { kioskAudio } from '../utils/audio';

interface CatalogViewProps {
  onSelectGarment: (garment: Garment, selectedSize: string) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ onSelectGarment }) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedGarment, setSelectedGarment] = useState<Garment>(MOCK_GARMENTS[0]);
  const [selectedSize, setSelectedSize] = useState<string>('M');

  const categories = ['All', 'Upper', 'Outerwear', 'Dress'];

  const filteredGarments = activeCategory === 'All'
    ? MOCK_GARMENTS
    : MOCK_GARMENTS.filter((g) => g.category === activeCategory);

  const handleGarmentClick = (garment: Garment) => {
    kioskAudio.playBeep(700, 0.05);
    setSelectedGarment(garment);
    if (!garment.availableSizes.includes(selectedSize)) {
      setSelectedSize(garment.availableSizes[0] || 'M');
    }
  };

  const handleSizeClick = (size: string) => {
    kioskAudio.playBeep(850, 0.05);
    setSelectedSize(size);
  };

  const handleSubmit = () => {
    kioskAudio.playBeep(900, 0.1);
    onSelectGarment(selectedGarment, selectedSize);
  };

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 select-none bg-slate-950">
      {/* Category Tabs & Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Luxury Collection</h2>
          <p className="text-xs text-slate-400">Select a SKU to generate your instant AI Virtual Try-On</p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                kioskAudio.playBeep(600, 0.05);
                setActiveCategory(cat);
              }}
              className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Layout: Catalog Cards (Left 2 cols) + Detail Drawer (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
        {/* Catalog Items Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[70vh] pr-2">
          {filteredGarments.map((garment) => {
            const isSelected = selectedGarment.id === garment.id;
            return (
              <div
                key={garment.id}
                onClick={() => handleGarmentClick(garment)}
                className={`glass-card rounded-3xl p-5 border cursor-pointer transition-all duration-300 relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/40 shadow-2xl shadow-indigo-500/20'
                    : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                {/* Image Showcase */}
                <div className="relative w-full h-64 rounded-2xl bg-white/5 overflow-hidden mb-4 border border-slate-800 flex items-center justify-center p-4">
                  <img
                    src={garment.flatlayImage}
                    alt={garment.name}
                    className="w-full h-full object-contain transform group-hover:scale-105 transition duration-500"
                  />

                  {/* Suitability Score Badge */}
                  <div className="absolute top-3 right-3 bg-slate-900/90 border border-emerald-500/30 px-3 py-1 rounded-full text-[11px] font-bold text-emerald-400 flex items-center gap-1 backdrop-blur-md">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>{garment.suitabilityScore}% Suitability</span>
                  </div>

                  <div className="absolute bottom-3 left-3 bg-slate-900/80 px-2.5 py-0.5 rounded-lg text-[10px] font-mono text-slate-300">
                    SKU: {garment.sku}
                  </div>
                </div>

                {/* Info */}
                <div>
                  <div className="text-[10px] font-mono text-indigo-400 tracking-wider uppercase mb-1">
                    {garment.brand}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 leading-snug">{garment.name}</h3>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-300">{garment.price}</span>
                    <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                      {garment.category}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Garment Detail Drawer */}
        <div className="glass-panel rounded-3xl p-8 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-indigo-400 tracking-wider uppercase mb-1">
              {selectedGarment.brand}
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">{selectedGarment.name}</h3>
            <div className="text-3xl font-extrabold text-indigo-300 mb-6">{selectedGarment.price}</div>

            {/* Garment Fabric Breakdown */}
            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="text-xs font-semibold text-slate-400 mb-1">Fabric Composition</div>
                <div className="text-sm font-medium text-white">{selectedGarment.fabricComposition}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] font-semibold text-slate-400 mb-0.5">Stretch Class</div>
                  <div className="text-xs font-mono text-indigo-300">{selectedGarment.stretchClass}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] font-semibold text-slate-400 mb-0.5">Pattern Type</div>
                  <div className="text-xs font-mono text-indigo-300 truncate">{selectedGarment.patternType}</div>
                </div>
              </div>
            </div>

            {/* Size Selector */}
            <div className="mb-8">
              <label className="block text-xs font-bold text-slate-300 mb-3 uppercase tracking-wider">
                Select Garment Size
              </label>
              <div className="flex gap-2">
                {selectedGarment.availableSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleSizeClick(size)}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border ${
                      selectedSize === size
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <button
            onClick={handleSubmit}
            className="w-full py-5 px-6 rounded-2xl glass-button text-white font-extrabold tracking-wider flex items-center justify-center gap-3 border border-white/20 active:scale-98 text-lg"
          >
            <Sparkles className="w-6 h-6 text-indigo-200" />
            <span>TRY ON THIS LOOK</span>
          </button>
        </div>
      </div>
    </div>
  );
};
