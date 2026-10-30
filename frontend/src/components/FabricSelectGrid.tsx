import React, { useState } from 'react';
import { 
  Check, 
  ArrowRight, 
  Eye, 
  Scissors, 
  CheckCircle2
} from 'lucide-react';
import type { Garment } from '../types/kiosk';
import { MOCK_GARMENTS } from '../data/mockGarments';
import { kioskAudio } from '../utils/audio';

interface FabricSelectGridProps {
  selectedGarments: Garment[];
  onToggleGarment: (garment: Garment) => void;
  onProceedToProfile: (selectedList: Garment[]) => void;
}

type FabricCategory = 'All' | 'Shirt Fabric' | 'Kurti Material' | 'Saree' | 'Tops';

export const FabricSelectGrid: React.FC<FabricSelectGridProps> = ({
  selectedGarments,
  onToggleGarment,
  onProceedToProfile,
}) => {
  const [activeTab, setActiveTab] = useState<FabricCategory>('All');
  const [previewModes, setPreviewModes] = useState<Record<string, 'fabric' | 'outfit'>>({});

  const categories: FabricCategory[] = ['All', 'Shirt Fabric', 'Kurti Material', 'Saree', 'Tops'];

  const filteredGarments = MOCK_GARMENTS.filter((g) => {
    if (activeTab === 'All') return true;
    return g.fabricType === activeTab;
  });

  const isSelected = (id: string) => selectedGarments.some((g) => g.id === id);

  const togglePreview = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    kioskAudio.playBeep(650, 0.04);
    setPreviewModes((prev) => ({
      ...prev,
      [id]: prev[id] === 'outfit' ? 'fabric' : 'outfit',
    }));
  };

  const handleCardClick = (garment: Garment) => {
    kioskAudio.playBeep(750, 0.06);
    onToggleGarment(garment);
  };

  const handleProceed = () => {
    kioskAudio.playBeep(900, 0.09);
    const listToProceed = selectedGarments.length > 0 ? selectedGarments : [MOCK_GARMENTS[0]];
    onProceedToProfile(listToProceed);
  };

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 max-w-7xl mx-auto select-none overflow-y-auto">
      {/* Top Header & Category Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-6 pt-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full spatial-pill border border-white/80 text-xs font-bold text-indigo-900 mb-2 shadow-xs">
            <Scissors className="w-3.5 h-3.5 text-indigo-600" />
            <span>STEP 1: SELECT FABRIC / DRESS</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Curated Bespoke Fabric & Dress Catalog
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Explore premium woven materials, inspect macro thread closeups, and select outfits to try on your 3D digital twin.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-full spatial-glass border border-white/90 shadow-md">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                kioskAudio.playBeep(600, 0.04);
                setActiveTab(cat);
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === cat
                  ? 'spatial-pill-active border border-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-white/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Big Attractive Video-Style Grid (Step 1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
        {filteredGarments.map((garment) => {
          const selected = isSelected(garment.id);
          const currentMode = previewModes[garment.id] || 'fabric';
          const displayImage = currentMode === 'fabric' 
            ? (garment.fabricCloseupImage || garment.flatlayImage) 
            : (garment.virtualModelImage || garment.tryonResultImage);

          return (
            <div
              key={garment.id}
              onClick={() => handleCardClick(garment)}
              className={`group relative rounded-[2rem] overflow-hidden spatial-glass border transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl flex flex-col justify-between ${
                selected
                  ? 'border-indigo-600 ring-4 ring-indigo-500/20 bg-indigo-50/40 scale-[1.01]'
                  : 'border-white/90 hover:border-indigo-300 hover:-translate-y-1'
              }`}
            >
              {/* Image Presentation Box with Video-Grid Styling */}
              <div className="relative w-full h-72 overflow-hidden bg-slate-950/5 flex items-center justify-center">
                <img
                  src={displayImage}
                  alt={garment.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />

                {/* Top Badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                  <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-slate-900/80 backdrop-blur-md text-white shadow-md border border-white/20">
                    {garment.fabricType || 'Bespoke Fabric'}
                  </span>
                  {selected && (
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500 text-white flex items-center gap-1 shadow-md animate-fade-in">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>SELECTED</span>
                    </span>
                  )}
                </div>

                {/* Fabric View vs. Outfit Preview Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => togglePreview(garment.id, e)}
                  className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold bg-white/90 hover:bg-white text-slate-800 backdrop-blur-md shadow-lg border border-white flex items-center gap-1.5 transition-transform active:scale-95 z-10"
                  title="Toggle raw fabric closeup vs. finished outfit"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{currentMode === 'fabric' ? 'View Final Outfit' : 'View Fabric Swatch'}</span>
                </button>

                {/* Tactile Weave Overlay Pill */}
                {garment.weaveDetail && currentMode === 'fabric' && (
                  <div className="absolute bottom-3 left-3 max-w-[70%] px-3 py-1 rounded-full bg-slate-900/75 backdrop-blur-md text-white text-[10px] font-mono truncate border border-white/20">
                    {garment.weaveDetail}
                  </div>
                )}
              </div>

              {/* Card Meta & Tailor Spec */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-indigo-700 tracking-wider uppercase">
                      {garment.brand}
                    </span>
                    <span className="text-lg font-black text-slate-900 font-mono">
                      {garment.price}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug mb-1">
                    {garment.name}
                  </h3>

                  <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">
                    {garment.fabricComposition} &bull; {garment.description}
                  </p>
                </div>

                {/* Bottom Selection Checkbox Bar */}
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-500">
                    Suitability: <span className="text-emerald-700 font-extrabold">{garment.suitabilityScore}% Match</span>
                  </span>

                  <div className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                    selected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white border border-slate-200 text-slate-700 group-hover:border-indigo-400 group-hover:text-indigo-600'
                  }`}>
                    {selected ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ready For Try-On</span>
                      </>
                    ) : (
                      <>
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Select Fabric</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Action Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-4xl px-4 pointer-events-none">
        <div className="spatial-glass pointer-events-auto p-4 rounded-3xl border border-white/95 shadow-2xl backdrop-blur-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-3 overflow-hidden">
              {(selectedGarments.length > 0 ? selectedGarments : [MOCK_GARMENTS[0]]).slice(0, 4).map((g) => (
                <img
                  key={g.id}
                  src={g.fabricCloseupImage || g.flatlayImage}
                  alt={g.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md"
                />
              ))}
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">
                {selectedGarments.length > 0
                  ? `${selectedGarments.length} Fabric${selectedGarments.length > 1 ? 's' : ''} Selected`
                  : 'Select One or More Fabrics'}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Step 2 will measure your body proportions and create your 3D profile
              </div>
            </div>
          </div>

          <button
            onClick={handleProceed}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl spatial-btn-primary text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
            <span>CREATE PROFILE & MEASURE (ONE-TIME)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
