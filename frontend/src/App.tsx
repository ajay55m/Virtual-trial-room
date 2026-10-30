import { useState, useEffect } from 'react';
import type { KioskState, Garment, PoseQualityMetrics, BodyMeasurements } from './types/kiosk';
import { MOCK_GARMENTS } from './data/mockGarments';
import { Header } from './components/Header';
import { IdleScreen } from './components/IdleScreen';
import { ConsentModal } from './components/ConsentModal';
import { PositioningCamera } from './components/PositioningCamera';
import { ReviewScreen } from './components/ReviewScreen';
import { CatalogView } from './components/CatalogView';
import { GeneratingPipeline } from './components/GeneratingPipeline';
import { FabricSelectGrid } from './components/FabricSelectGrid';
import { TailorProfileScreen } from './components/TailorProfileScreen';
import { TailorTapeMeasuringScreen } from './components/TailorTapeMeasuringScreen';
import { ResultView } from './components/ResultView';
import { AdminModal } from './components/AdminModal';
import { ErrorBoundary } from './components/ErrorBoundary';

import { apiService } from './services/api';

export function App() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  // Step 1: Default directly to SELECT_FABRIC catalog grid (or screen query param)
  const initialScreen = (urlParams?.get('screen')?.toUpperCase() as KioskState) || 'SELECT_FABRIC';
  const initialResult = urlParams?.get('result') || '/assets/captures/perfect_user_tryon.jpg';

  const [currentState, setCurrentState] = useState<KioskState>(initialScreen);
  const [sessionId, setSessionId] = useState<string>('');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // User Profile & Biometrics (Step 2)
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string>('/assets/demo_person_male.jpg');
  const [userHeightCm, setUserHeightCm] = useState<number>(175);
  const [userMeasurements, setUserMeasurements] = useState<BodyMeasurements>({
    heightCm: 175,
    shoulderCm: 44.0,
    chestCm: 94.0,
    waistCm: 78.0,
    hipCm: 96.0,
    lengthCm: 71.0,
    sleeveCm: 62.0,
  });

  // Selected Garments Feed (Step 1 & Step 3 & Step 4)
  const [selectedGarmentList, setSelectedGarmentList] = useState<Garment[]>([
    MOCK_GARMENTS[0], // Sapphire Kadwa Banarasi Brocade Saree
    MOCK_GARMENTS[3], // Biba Chanderi Silk Kurti Material
    MOCK_GARMENTS[5], // Zara Slim Fit Shirt Fabric
  ]);
  const [selectedGarment, setSelectedGarment] = useState<Garment>(MOCK_GARMENTS[0]);
  const [selectedSize, setSelectedSize] = useState<string>('M');

  // Generated AI Try-on Results Map (Garment ID -> Result Image URI)
  const [tryonResultsMap, setTryonResultsMap] = useState<Record<string, string>>({});
  const [tryonResultUri, setTryonResultUri] = useState<string>(initialScreen === 'RESULT' ? initialResult : '');
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

  // Inactivity timeout counter (default 300s, warns at 15s)
  const [inactivitySec, setInactivitySec] = useState(300);

  useEffect(() => {
    if (currentState === 'IDLE') return;

    const timer = setInterval(() => {
      setInactivitySec((prev) => {
        if (prev <= 1) {
          handleResetSession();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    const resetInactivity = () => setInactivitySec(300);
    window.addEventListener('touchstart', resetInactivity);
    window.addEventListener('click', resetInactivity);

    return () => {
      clearInterval(timer);
      window.removeEventListener('touchstart', resetInactivity);
      window.removeEventListener('click', resetInactivity);
    };
  }, [currentState]);

  // Retail Hardware RFID & Barcode Scanner Listener (USB Keyboard Wedge)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = performance.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;

      const now = performance.now();
      if (now - lastKeyTime > 120) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        const query = buffer.trim().toLowerCase();
        buffer = '';
        if (query.length >= 3) {
          const matched = MOCK_GARMENTS.find(g => 
            g.sku.toLowerCase() === query ||
            g.id.toLowerCase() === query ||
            g.name.toLowerCase().includes(query)
          );
          if (matched) {
            setSelectedGarment(matched);
            setSelectedGarmentList(prev => 
              prev.some(x => x.id === matched.id) ? prev : [matched, ...prev]
            );
            if (currentState === 'IDLE') {
              setCurrentState('SELECT_FABRIC');
            } else if (currentState === 'SELECT_FABRIC') {
              setCurrentState('CREATE_PROFILE');
            }
          }
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentState]);

  // Step 1: Toggle garment in multi-selection list
  const handleToggleGarmentInList = (garment: Garment) => {
    setSelectedGarmentList((prev) => {
      const exists = prev.some((g) => g.id === garment.id);
      if (exists) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((g) => g.id !== garment.id);
      } else {
        return [...prev, garment];
      }
    });
  };

  // Step 1 -> Step 2: Proceed from fabric selection to tailor profile
  const handleProceedToProfile = (selectedList: Garment[]) => {
    setSelectedGarmentList(selectedList);
    setSelectedGarment(selectedList[0]);
    setCurrentState('CREATE_PROFILE');
  };

  // Step 2 -> Step 3: Complete profile and begin tape measuring & feed generation
  const handleProfileComplete = (profileData: {
    photoUri: string;
    heightCm: number;
    measurements: BodyMeasurements;
    size: string;
  }) => {
    setCapturedPhotoUri(profileData.photoUri);
    setUserHeightCm(profileData.heightCm);
    setUserMeasurements(profileData.measurements);
    setSelectedSize(profileData.size);
    setCurrentState('GENERATING_FEED');
  };

  // Step 3 -> Step 4: All AI try-on renders completed, show final result
  const handleFeedGenerated = (resultsByGarmentId: Record<string, string>) => {
    setTryonResultsMap(resultsByGarmentId);
    if (selectedGarment && resultsByGarmentId[selectedGarment.id]) {
      setTryonResultUri(resultsByGarmentId[selectedGarment.id]);
    }
    setCurrentState('RESULT');
  };

  const handleStartSession = () => {
    setCurrentState('SELECT_FABRIC');
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
    setSelectedGarmentList([garment]);
    setCurrentState('GENERATING');
  };

  const handleGenerationComplete = (resultImageUrl: string, recommendation?: any) => {
    if (resultImageUrl) {
      setTryonResultUri(resultImageUrl);
      if (selectedGarment) {
        setTryonResultsMap(prev => ({ ...prev, [selectedGarment.id]: resultImageUrl }));
      }
    }
    if (recommendation) {
      setSizeRecommendation(recommendation);
    }
    setCurrentState('RESULT');
  };

  const handleResetSession = () => {
    setCurrentState('SELECT_FABRIC');
    setShowConsentModal(false);
    setShowAdminModal(false);
    setInactivitySec(300);
    setCapturedPhotoUri('/assets/demo_person_male.jpg');
    setTryonResultUri('');
    setSizeRecommendation(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col text-slate-900 select-none bg-transparent">
      {/* Top Header */}
      <Header
        currentState={currentState}
        onOpenAdmin={() => setShowAdminModal(true)}
        onReset={handleResetSession}
        inactivitySec={inactivitySec}
      />

      {/* Main Kiosk Screen Viewport */}
      <main className="flex-1 relative w-full h-full overflow-y-auto">
        <ErrorBoundary onReset={handleResetSession}>
          {currentState === 'IDLE' && (
            <IdleScreen onStart={handleStartSession} />
          )}

          {/* ============================================================== */}
          {/* STEP 1: SELECT FABRIC / DRESS (Attractive Video-Grid Catalog) */}
          {/* ============================================================== */}
          {currentState === 'SELECT_FABRIC' && (
            <FabricSelectGrid
              selectedGarments={selectedGarmentList}
              onToggleGarment={handleToggleGarmentInList}
              onProceedToProfile={handleProceedToProfile}
            />
          )}

          {/* ============================================================== */}
          {/* STEP 2: CREATE PROFILE (Silhouette Guide & Live Measurements)  */}
          {/* ============================================================== */}
          {currentState === 'CREATE_PROFILE' && (
            <TailorProfileScreen
              initialPhotoUri={capturedPhotoUri}
              initialHeightCm={userHeightCm}
              onProfileComplete={handleProfileComplete}
              onBackToFabrics={() => setCurrentState('SELECT_FABRIC')}
            />
          )}

          {/* ============================================================== */}
          {/* STEP 3: GENERATING YOUR FEED (Dynamic Tailor Tape Animation)   */}
          {/* ============================================================== */}
          {currentState === 'GENERATING_FEED' && (
            <TailorTapeMeasuringScreen
              photoUri={capturedPhotoUri}
              heightCm={userHeightCm}
              measurements={userMeasurements}
              recommendedSize={selectedSize}
              selectedGarments={selectedGarmentList}
              onComplete={handleFeedGenerated}
            />
          )}

          {/* Legacy Positioning & Capture Screens (Supported) */}
          {currentState === 'POSITIONING' && (
            <PositioningCamera
              onCaptured={handlePhotoCaptured}
              onCancel={handleResetSession}
              category={selectedGarment?.category || 'Upper'}
              initialGarment={selectedGarment}
              onSelectGarment={setSelectedGarment}
            />
          )}

          {currentState === 'REVIEW' && (
            <ReviewScreen
              photoUri={capturedPhotoUri}
              metrics={poseMetrics}
              onConfirm={handleReviewConfirm}
              onRetake={() => setCurrentState('POSITIONING')}
              onUploadNew={(newUri) => handlePhotoCaptured(newUri, poseMetrics)}
            />
          )}

          {currentState === 'CATALOG' && (
            <CatalogView
              onSelectGarment={handleSelectGarment}
              userPhotoUri={capturedPhotoUri}
            />
          )}

          {currentState === 'GENERATING' && (
            <GeneratingPipeline
              sessionId={sessionId}
              userPhotoUri={capturedPhotoUri}
              garment={selectedGarment}
              selectedSize={selectedSize}
              onComplete={handleGenerationComplete}
              onCancel={() => setCurrentState('SELECT_FABRIC')}
            />
          )}

          {/* ============================================================== */}
          {/* STEP 4 & 5: FINAL TRY-ON RESULT & CURATED FOR YOU             */}
          {/* ============================================================== */}
          {currentState === 'RESULT' && (
            <ResultView
              sessionId={sessionId}
              originalPhotoUri={capturedPhotoUri}
              tryonResultUri={tryonResultUri}
              sizeRecommendation={sizeRecommendation}
              garment={selectedGarmentList[0] || selectedGarment}
              selectedGarments={selectedGarmentList}
              tryonResultsMap={tryonResultsMap}
              userMeasurements={userMeasurements}
              userHeightCm={userHeightCm}
              selectedSize={selectedSize}
              onTryAnother={() => setCurrentState('SELECT_FABRIC')}
              onFinishSession={handleResetSession}
              onAddGarmentToFeed={(newGarment) => {
                setSelectedGarmentList(prev => [...prev, newGarment]);
              }}
            />
          )}
        </ErrorBoundary>
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
