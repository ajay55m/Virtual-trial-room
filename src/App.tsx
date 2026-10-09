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

export function App() {
  const [currentState, setCurrentState] = useState<KioskState>('IDLE');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string>('/assets/demo_person.jpg');
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

  const handleConsentAgree = () => {
    setShowConsentModal(false);
    setCurrentState('POSITIONING');
  };

  const handleConsentDecline = () => {
    setShowConsentModal(false);
    handleResetSession();
  };

  const handlePhotoCaptured = (uri: string, metrics: PoseQualityMetrics) => {
    setCapturedPhotoUri(uri);
    setPoseMetrics(metrics);
    setCurrentState('REVIEW');
  };

  const handleReviewConfirm = () => {
    setCurrentState('CATALOG');
  };

  const handleSelectGarment = (garment: Garment, size: string) => {
    setSelectedGarment(garment);
    setSelectedSize(size);
    setCurrentState('GENERATING');
  };

  const handleGenerationComplete = () => {
    setCurrentState('RESULT');
  };

  const handleResetSession = () => {
    setCurrentState('IDLE');
    setShowConsentModal(false);
    setShowAdminModal(false);
    setInactivitySec(60);
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
            garment={selectedGarment}
            selectedSize={selectedSize}
            onComplete={handleGenerationComplete}
          />
        )}

        {currentState === 'RESULT' && (
          <ResultView
            originalPhotoUri={capturedPhotoUri}
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
