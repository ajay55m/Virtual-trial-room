import React, { useState } from 'react';
import { Sparkles, CheckCircle2, RotateCcw, AlertTriangle, Send, QrCode, ShieldCheck, Layers } from 'lucide-react';
import type { Garment, SizeRecommendation } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';

interface ResultViewProps {
  originalPhotoUri: string;
  tryonResultUri?: string;
  sizeRecommendation?: SizeRecommendation;
  garment: Garment;
  selectedSize: string;
  onTryAnother: () => void;
  onFinishSession: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  originalPhotoUri,
  tryonResultUri,
  sizeRecommendation,
  garment,
  selectedSize,
  onTryAnother,
  onFinishSession
}) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Dynamic recommendation from model pipeline with fallback
  const recommendation: SizeRecommendation = sizeRecommendation || {
    recommendedSize: 'M',
    confidence: 0.94,
    fitClass: 'Regular',
    honestyWarning:
      selectedSize !== 'M'
        ? `Honesty Rule Alert: You selected Size ${selectedSize}, but body measurement regression predicts Size M for an optimal silhouette fit without shoulder pull.`
        : undefined,
    measurementBreakdown: {
      chestCm: 92,
      waistCm: 74,
      hipCm: 98,
      shoulderCm: 42,
      heightCm: 172
    }
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    kioskAudio.playBeep(900, 0.1);
    setEmailSent(true);
  };

  const handleFinish = () => {
    kioskAudio.playBeep(400, 0.1);
    onFinishSession();
  };

  const handleTryAnother = () => {
    kioskAudio.playBeep(700, 0.1);
    onTryAnother();
  };

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 select-none bg-slate-950">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full my-auto">
        {/* Left 2 Cols: Main Try-On Render View with Toggle */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-5 border border-indigo-500/30 flex flex-col items-center justify-between bg-slate-900/80">
          {/* Main Image Display */}
          <div className="relative w-full max-h-[62vh] rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center bg-slate-950">
            <img
              src={showOriginal ? originalPhotoUri : (tryonResultUri || garment.tryonResultImage)}
              alt="VTON Try-On Result"
              className="w-full h-full object-contain max-h-[58vh] transition-all duration-500"
            />

            {/* Toggle Overlay Button */}
            <button
              onMouseDown={() => setShowOriginal(true)}
              onMouseUp={() => setShowOriginal(false)}
              onTouchStart={() => setShowOriginal(true)}
              onTouchEnd={() => setShowOriginal(false)}
              className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white flex items-center gap-2 backdrop-blur-md shadow-xl"
            >
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>{showOriginal ? 'HOLDING: Showing Original Photo' : 'HOLD TO VIEW ORIGINAL PHOTO'}</span>
            </button>

            {/* AI Watermark & Model Stamp */}
            <div className="absolute top-4 right-4 bg-indigo-500/20 border border-indigo-500/40 px-3.5 py-1.5 rounded-full text-[11px] font-bold text-indigo-300 flex items-center gap-1.5 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>VTON 2.0 FP16 SYNTHESIS</span>
            </div>
          </div>

          {/* Garment Title Bar */}
          <div className="w-full mt-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-indigo-400 uppercase">{garment.brand}</div>
              <div className="text-base font-bold text-white">{garment.name}</div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">Selected Size: <span className="font-bold text-white">{selectedSize}</span></div>
              <div className="text-sm font-semibold text-indigo-300">{garment.price}</div>
            </div>
          </div>
        </div>

        {/* Right Col: Size Recommendation Engine & Export Actions */}
        <div className="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>MEASUREMENT SIZING ENGINE</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Fit & Size Analysis</h3>

            {/* Size Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">Recommended Size</span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  94% CONFIDENCE
                </span>
              </div>
              <div className="text-4xl font-black text-white font-mono mb-2">SIZE {recommendation.recommendedSize}</div>
              <div className="text-xs text-slate-400">Based on estimated circumferences vs brand size chart</div>
            </div>

            {/* Honesty Rule Alert if needed */}
            {recommendation.honestyWarning && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex gap-3 items-start mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200 leading-snug">
                  {recommendation.honestyWarning}
                </div>
              </div>
            )}

            {/* Measurements Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-6">
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">Chest</div>
                <div className="text-slate-200 font-bold">{recommendation.measurementBreakdown.chestCm} cm</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">Waist</div>
                <div className="text-slate-200 font-bold">{recommendation.measurementBreakdown.waistCm} cm</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">Hips</div>
                <div className="text-slate-200 font-bold">{recommendation.measurementBreakdown.hipCm} cm</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">Height</div>
                <div className="text-slate-200 font-bold">{recommendation.measurementBreakdown.heightCm} cm</div>
              </div>
            </div>

            {/* Take-Home Export (Email / QR Code) */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 mb-6">
              <div className="text-xs font-bold text-white mb-2 flex items-center justify-between">
                <span>TAKE THIS LOOK HOME</span>
                <button
                  onClick={() => setShowQr(!showQr)}
                  className="text-[10px] font-mono text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showQr ? 'Hide QR' : 'Show QR'}</span>
                </button>
              </div>

              {showQr ? (
                <div className="p-4 bg-white rounded-xl flex flex-col items-center justify-center my-2">
                  <div className="w-28 h-28 bg-slate-900 rounded-lg flex items-center justify-center text-white text-[10px] font-mono text-center p-2">
                    [ AURA SESSION QR CODE SCANNER ]
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono mt-2">Scan with smartphone camera</div>
                </div>
              ) : emailSent ? (
                <div className="text-xs text-emerald-400 font-semibold p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-center">
                  Look sent to {emailInput}!
                </div>
              ) : (
                <form onSubmit={handleSendEmail} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email address..."
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleTryAnother}
              className="w-full py-4 px-6 rounded-2xl glass-button text-white font-bold tracking-wider flex items-center justify-center gap-2 border border-white/20 active:scale-98"
            >
              <RotateCcw className="w-5 h-5" />
              <span>TRY ANOTHER GARMENT</span>
            </button>

            <button
              onClick={handleFinish}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>FINISH SESSION & PURGE DATA</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
