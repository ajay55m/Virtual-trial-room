import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Bot, 
  ShieldCheck, 
  ShieldAlert, 
  Send, 
  X, 
  ChevronRight, 
  Layers, 
  Check, 
  TrendingDown,
  Info,
  ArrowRight,
  Key,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { Garment, StyleAdvice, AssistantChatMessage, SAMSegmentationResponse } from '../types/kiosk';
import { apiService } from '../services/api';
import { kioskAudio } from '../utils/audio';

interface StyleAssistantProps {
  sessionId: string;
  garment: Garment;
  selectedSize: string;
  userHeight?: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectSize?: (newSize: string) => void;
}

export const StyleAssistant: React.FC<StyleAssistantProps> = ({
  sessionId,
  garment,
  selectedSize,
  userHeight = 175.0,
  isOpen,
  onClose,
  onSelectSize
}) => {
  const [advice, setAdvice] = useState<StyleAdvice | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'fit_analysis' | 'chat' | 'sam_vision'>('fit_analysis');
  
  // Hugging Face token & Llama status
  const [hfStatus, setHfStatus] = useState<{
    configured: boolean;
    authenticated: boolean;
    username: string | null;
    model: string;
    mode: string;
    message: string;
  } | null>(null);
  const [showTokenConfig, setShowTokenConfig] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [updatingToken, setUpdatingToken] = useState<boolean>(false);
  const [tokenMsg, setTokenMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Chat state
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // SAM preview state
  const [samData, setSamData] = useState<SAMSegmentationResponse | null>(null);
  const [loadingSam, setLoadingSam] = useState<boolean>(false);

  // Fetch HF status on open
  useEffect(() => {
    if (isOpen) {
      apiService.getAssistantStatus().then(setHfStatus);
    }
  }, [isOpen]);

  // Fetch style advice when garment or selected size changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingAdvice(true);

    apiService.getStyleAdvice(sessionId, garment, selectedSize, userHeight)
      .then((data) => {
        if (isMounted) {
          setAdvice(data);
          setLoadingAdvice(false);
          // Initial greeting in chat if empty
          if (messages.length === 0) {
            setMessages([
              {
                id: 'msg_welcome',
                sender: 'assistant',
                text: `Welcome! I'm your AURA Style Consultant powered by Meta Llama. I've analyzed your fit for the ${garment.name} in Size ${selectedSize}. Feel free to ask me about styling, fabric drape, or size adjustments!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                suggestedQuestions: [
                  "Will this fit tight around my shoulders?",
                  "What shoes and accessories match this?",
                  "Is this suitable for a formal evening event?"
                ]
              }
            ]);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed loading style advice:', err);
        if (isMounted) setLoadingAdvice(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, garment.id, selectedSize]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isSending) return;

    kioskAudio.playBeep(700, 0.05);
    const userMsg: AssistantChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const resp = await apiService.sendAssistantChat(
        sessionId,
        garment,
        selectedSize,
        text.trim(),
        messages.map((m) => ({ role: m.sender, content: m.text }))
      );

      const botMsg: AssistantChatMessage = {
        id: `msg_bot_${Date.now()}`,
        sender: 'assistant',
        text: resp.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: resp.suggestedQuestions
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.warn('Chat error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleLoadSAM = async () => {
    kioskAudio.playBeep(600, 0.05);
    setActiveTab('sam_vision');
    if (samData) return;
    setLoadingSam(true);
    const data = await apiService.runSAMSegmentation(sessionId, garment.id);
    setSamData(data);
    setLoadingSam(false);
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim() || updatingToken) return;
    setUpdatingToken(true);
    setTokenMsg(null);
    try {
      const res = await apiService.updateAssistantToken(tokenInput.trim());
      setHfStatus(res);
      if (res.authenticated) {
        setTokenMsg({ text: `Success! Authenticated as ${res.username}. Live Meta Llama 3.2 is active.`, error: false });
        setTimeout(() => setShowTokenConfig(false), 2500);
      } else {
        setTokenMsg({ text: res.message || 'Token was not accepted by Hugging Face. Check token permissions.', error: true });
      }
    } catch (err: any) {
      setTokenMsg({ text: 'Error connecting to backend: ' + (err.message || String(err)), error: true });
    } finally {
      setUpdatingToken(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl h-full bg-slate-900/95 border-l border-white/10 shadow-2xl flex flex-col text-slate-100 overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-lg text-white">AURA Style & Sizing Advisor</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Llama 3.2
                </span>
              </div>
              <p className="text-xs text-slate-400">Honest Fit Diagnostics & Return Reduction Engine</p>
            </div>
          </div>
          <button 
            onClick={() => {
              kioskAudio.playBeep(400, 0.05);
              onClose();
            }}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Llama 3.2 Live Status Pill */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${hfStatus?.authenticated ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="font-medium text-slate-300">
              {hfStatus?.authenticated
                ? `Meta Llama 3.2 Live Connected (${hfStatus.username || 'Ajay-55'})`
                : 'Meta Llama 3.2 • Intelligent Stylist Engine'}
            </span>
          </div>
          <button
            onClick={() => {
              kioskAudio.playBeep(900, 0.03);
              setShowTokenConfig(!showTokenConfig);
            }}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-indigo-300 border border-indigo-500/20 transition"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{hfStatus?.authenticated ? 'Manage Token' : 'Connect HF Token'}</span>
          </button>
        </div>

        {/* Collapsible Token Configuration Drawer */}
        {showTokenConfig && (
          <div className="px-6 py-4 bg-indigo-950/30 border-b border-indigo-500/20 space-y-3 animate-fade-in text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center space-x-1.5">
                <Key className="w-4 h-4 text-indigo-400" />
                <span>Hugging Face Access Token</span>
              </span>
              <span className="text-[11px] text-slate-400">Account: Ajay-55</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Your request for <strong className="text-white">Meta's Llama 3.2 language models</strong> was accepted! Go to Hugging Face → <strong className="text-indigo-300">Settings → Access Tokens</strong>, create a <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300">Read</code> token, and paste it here:
            </p>
            <div className="flex space-x-2">
              <input
                type="password"
                placeholder="hf_..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-white/20 rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleSaveToken}
                disabled={updatingToken || !tokenInput.trim()}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition shadow-md flex items-center space-x-1"
              >
                {updatingToken ? <span>Verifying...</span> : <span>Activate</span>}
              </button>
            </div>
            {tokenMsg && (
              <div className={`p-2 rounded-lg flex items-center space-x-2 ${tokenMsg.error ? 'bg-rose-950/50 text-rose-300 border border-rose-500/30' : 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30'}`}>
                {tokenMsg.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span className="text-[11px]">{tokenMsg.text}</span>
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-slate-900/40 px-6 pt-2">
          <button
            onClick={() => {
              kioskAudio.playBeep(800, 0.03);
              setActiveTab('fit_analysis');
            }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'fit_analysis'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>Return Risk & Fit</span>
          </button>
          
          <button
            onClick={() => {
              kioskAudio.playBeep(800, 0.03);
              setActiveTab('chat');
            }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'chat'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Llama Stylist Chat</span>
          </button>

          <button
            onClick={handleLoadSAM}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'sam_vision'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>SAM Segmentation</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: FIT & RETURN RISK ANALYSIS */}
          {activeTab === 'fit_analysis' && (
            <>
              {loadingAdvice ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-400">Llama reasoning on garment drape and body regression...</p>
                </div>
              ) : advice ? (
                <div className="space-y-6">
                  {/* Return Risk Gauge Banner */}
                  <div className={`p-5 rounded-2xl border ${
                    advice.returnRiskLevel === 'Low'
                      ? 'bg-emerald-950/30 border-emerald-500/30'
                      : advice.returnRiskLevel === 'Moderate'
                      ? 'bg-amber-950/30 border-amber-500/30'
                      : 'bg-rose-950/30 border-rose-500/30'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2.5 rounded-xl ${
                          advice.returnRiskLevel === 'Low'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : advice.returnRiskLevel === 'Moderate'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {advice.returnRiskLevel === 'Low' ? (
                            <ShieldCheck className="w-6 h-6" />
                          ) : (
                            <ShieldAlert className="w-6 h-6" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                            E-Commerce Return Risk
                          </div>
                          <div className="text-2xl font-bold flex items-center space-x-2">
                            <span>{advice.returnRiskScore}%</span>
                            <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${
                              advice.returnRiskLevel === 'Low'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : advice.returnRiskLevel === 'Moderate'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {advice.returnRiskLevel} Risk
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Size switcher shortcut if mismatch */}
                      {advice.selectedSize !== advice.recommendedSize && onSelectSize && (
                        <button
                          onClick={() => {
                            kioskAudio.playBeep(900, 0.08);
                            onSelectSize(advice.recommendedSize);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center space-x-1.5 transition"
                        >
                          <span>Switch to {advice.recommendedSize}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Gauge Bar */}
                    <div className="mt-4 w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          advice.returnRiskLevel === 'Low'
                            ? 'bg-emerald-500'
                            : advice.returnRiskLevel === 'Moderate'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${advice.returnRiskScore}%` }}
                      />
                    </div>

                    {/* Primary Risk Explanation */}
                    {advice.primaryRiskFactor && (
                      <p className="mt-3 text-xs leading-relaxed text-slate-300 font-medium">
                        <span className="text-slate-400 font-normal">Primary Driver: </span>
                        {advice.primaryRiskFactor}
                      </p>
                    )}
                  </div>

                  {/* Fit Verdict & Honest Drape Callout */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                      <Info className="w-4 h-4" />
                      <span>Body Drape & Fit Verdict</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed font-medium">
                      {advice.fitVerdict}
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {advice.bodyProportionNotes}
                    </p>
                  </div>

                  {/* Fabric Stretch & Tension Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs text-slate-400">Fabric Composition</div>
                      <div className="text-sm font-semibold text-white mt-1">
                        {garment.fabricComposition}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Stretch Class: <span className="text-indigo-300 font-medium">{garment.stretchClass}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs text-slate-400">Stretch Tolerance</div>
                      <div className="text-xs text-slate-300 mt-1 leading-snug">
                        {advice.stretchTolerance}
                      </div>
                    </div>
                  </div>

                  {/* Styling Suggestions */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Styling & Drape Tips
                    </h4>
                    <div className="space-y-2">
                      {advice.stylingSuggestions.map((tip, idx) => (
                        <div key={idx} className="flex items-start space-x-2.5 p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Outfit Matchmaker */}
                  {advice.matchingItems && advice.matchingItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Recommended Outfit Matches
                        </h4>
                        <span className="text-[11px] text-indigo-400 font-medium">Curated Pairings</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        {advice.matchingItems.map((match) => (
                          <div 
                            key={match.id}
                            className="flex items-center space-x-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/40 transition"
                          >
                            <img 
                              src={match.thumbnail} 
                              alt={match.name} 
                              className="w-12 h-12 rounded-lg object-contain bg-black/40 p-1 border border-white/5 shrink-0" 
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-white truncate">{match.name}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{match.reason}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-bold text-indigo-300">{match.price}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}

          {/* TAB 2: INTERACTIVE LLAMA STYLIST CHAT */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full space-y-4">
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20'
                        : 'bg-white/10 text-slate-200 rounded-bl-none border border-white/10'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 px-1">
                      {msg.timestamp}
                    </span>

                    {/* Quick question suggestions */}
                    {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {msg.suggestedQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(q)}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition flex items-center space-x-1"
                          >
                            <span>{q}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {isSending && (
                  <div className="flex items-center space-x-2 text-xs text-indigo-400 italic py-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    <span>Llama Stylist is crafting guidance...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="pt-2 border-t border-white/10 flex items-center space-x-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask Llama about fit, matching shoes, stretch..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isSending}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition shadow-lg shadow-indigo-600/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SAM SEGMENTATION VISION INSPECTOR */}
          {activeTab === 'sam_vision' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed">
                <p className="font-semibold text-white mb-1">Meta Segment Anything Model (SAM) Architecture</p>
                SAM isolates the worn clothing area while strictly preserving the shopper's face, neck, arms, and posture. 
                This produces the garment-agnostic image and inpainting mask fed into the IDM-VTON diffusion pipeline.
              </div>

              {loadingSam ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Executing SAM boundary isolation...</p>
                </div>
              ) : samData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-400">Garment Agnostic Mask</div>
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-black/60 border border-white/10 relative">
                        <img 
                          src={samData.maskUrl} 
                          alt="SAM Mask" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-400">Agnostic Diffusion Input</div>
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-black/60 border border-white/10 relative">
                        <img 
                          src={samData.agnosticImageUrl} 
                          alt="Agnostic Person" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Target Garment Category:</span>
                      <span className="font-semibold text-white">{samData.metadata.category}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Mask Coverage:</span>
                      <span className="font-semibold text-emerald-400">{samData.metadata.mask_coverage_percent}%</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Protected Face Bounding Box:</span>
                      <span className="font-mono text-slate-400">{samData.metadata.protected_face_box.join(', ')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 space-y-3">
                  <Layers className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">Tap below to trigger live SAM segmentation on the captured photo.</p>
                  <button
                    onClick={handleLoadSAM}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
                  >
                    Run SAM Segmentation
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500">
          <span>AI Engine: Meta Llama 3.2 + Meta SAM</span>
          <span>Zero User Data Persisted (15-min TTL)</span>
        </div>

      </div>
    </div>
  );
};
