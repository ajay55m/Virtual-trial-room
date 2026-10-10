import { useState, useEffect } from 'react';
import type { KioskState, Garment, PoseQualityMetrics } from './types/kiosk';
import { MOCK_GARMENTS } from './data/mockGarments';
import { Header } from './components/Header';
import { IdleScreen } from './components/IdleScreen';
import { ConsentModal } from './components/ConsentModal';
import { PositioningCamera } from './components/PositioningCamera';
import { ReviewScreen } from './components/ReviewScreen';
import { CatalogView } from './components/CatalogView';
import { GeneratingPipeline } from './components/GeneratingPipeline';
import { ResultView } from './components/ResultView';
import { AdminModal } from './components/AdminModal';

import { apiService } from './services/api';

export function App() {
  const [currentState, setCurrentState] = useState<KioskState>('IDLE');
  const [sessionId, setSessionId] = useState<string>('');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string>('/assets/demo_person.jpg');
  const [tryonResultUri, setTryonResultUri] = useState<string>('');
  const [sizeRecommendation, setSizeRecommendation] = useState<any>(null);
  const [poseMetrics, setPoseMetrics] = useState<PoseQualityMetrics>({
    sharpnessVariance: 420,
    bodyHeightPercent: 82,
    horizontalCenterOffset: 2,
    shoulderYawDegrees: 3,
    personCount: 1,
    aPoseCompliant: true,
    stabilityTimeSec: 1.0
  });
  const [selectedGarment, setSelectedGarment] = useState<Garment>(MOCK_GARMENTS[0]);
  const [selectedSize, setSelectedSize] = useState<string>('M');

  // Inactivity timeout counter (default 60s, warns at 15s)
  const [inactivitySec, setInactivitySec] = useState(60);

  useEffect(() => {
    if (currentState === 'IDLE') return;

    const timer = setInterval(() => {
      setInactivitySec((prev) => {
        if (prev <= 1) {
          handleResetSession();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    const resetInactivity = () => setInactivitySec(60);
    window.addEventListener('touchstart', resetInactivity);
    window.addEventListener('click', resetInactivity);

    return () => {
      clearInterval(timer);
      window.removeEventListener('touchstart', resetInactivity);
      window.removeEventListener('click', resetInactivity);
    };
  }, [currentState]);

  const handleStartSession = () => {
    setShowConsentModal(true);
    setCurrentState('CONSENT');
  };

  const handleConsentAgree = async () => {
    setShowConsentModal(false);
    setCurrentState('POSITIONING');
    try {
      const sess = await apiService.createSession(175.0, 'Unisex');
      setSessionId(sess.sessionId);
    } catch (e) {
      console.warn('Session initialization fallback:', e);
    }
  };

  const handleConsentDecline = () => {
    setShowConsentModal(false);
    handleResetSession();
  };

  const handlePhotoCaptured = async (uri: string, metrics: PoseQualityMetrics) => {
    setCapturedPhotoUri(uri);
    setPoseMetrics(metrics);
    setCurrentState('REVIEW');
    if (sessionId) {
      try {
        await apiService.uploadCapture(sessionId, uri);
      } catch (e) {
        console.warn('Capture upload fallback:', e);
      }
    }
  };

  const handleReviewConfirm = () => {
    setCurrentState('CATALOG');
  };

  const handleSelectGarment = (garment: Garment, size: string) => {
    setSelectedGarment(garment);
    setSelectedSize(size);
    setCurrentState('GENERATING');
  };

  const handleGenerationComplete = (resultImageUrl: string, recommendation?: any) => {
    if (resultImageUrl) {
      setTryonResultUri(resultImageUrl);
    }
    if (recommendation) {
      setSizeRecommendation(recommendation);
    }
    setCurrentState('RESULT');
  };

  const handleResetSession = () => {
    setCurrentState('IDLE');
    setShowConsentModal(false);
    setShowAdminModal(false);
    setInactivitySec(60);
    setCapturedPhotoUri('/assets/demo_person.jpg');
    setTryonResultUri('');
    setSizeRecommendation(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100 select-none">
      {/* Top Header */}
      <Header
        currentState={currentState}
        onOpenAdmin={() => setShowAdminModal(true)}
        onReset={handleResetSession}
        inactivitySec={inactivitySec}
      />

      {/* Main Kiosk Screen Viewport */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        {currentState === 'IDLE' && (
          <IdleScreen onStart={handleStartSession} />
        )}

        {currentState === 'POSITIONING' && (
          <PositioningCamera
            onCaptured={handlePhotoCaptured}
            onCancel={handleResetSession}
          />
        )}

        {currentState === 'REVIEW' && (
          <ReviewScreen
            photoUri={capturedPhotoUri}
            metrics={poseMetrics}
            onConfirm={handleReviewConfirm}
            onRetake={() => setCurrentState('POSITIONING')}
          />
        )}

        {currentState === 'CATALOG' && (
          <CatalogView onSelectGarment={handleSelectGarment} />
        )}

        {currentState === 'GENERATING' && (
          <GeneratingPipeline
            sessionId={sessionId}
            userPhotoUri={capturedPhotoUri}
            garment={selectedGarment}
            selectedSize={selectedSize}
            onComplete={handleGenerationComplete}
          />
        )}

        {currentState === 'RESULT' && (
          <ResultView
            originalPhotoUri={capturedPhotoUri}
            tryonResultUri={tryonResultUri}
            sizeRecommendation={sizeRecommendation}
            garment={selectedGarment}
            selectedSize={selectedSize}
            onTryAnother={() => setCurrentState('CATALOG')}
            onFinishSession={handleResetSession}
          />
        )}
      </main>

      {/* Modals */}
      {showConsentModal && (
        <ConsentModal
          onAgree={handleConsentAgree}
          onDecline={handleConsentDecline}
        />
      )}

      {showAdminModal && (
        <AdminModal onClose={() => setShowAdminModal(false)} />
      )}
    </div>
  );
}

export default App;
