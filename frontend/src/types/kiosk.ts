export type KioskState =
  | 'IDLE'
  | 'CONSENT'
  | 'POSITIONING'
  | 'CAPTURE'
  | 'REVIEW'
  | 'CATALOG'
  | 'SUBMIT'
  | 'GENERATING'
  | 'RESULT'
  | 'END';

export interface ColorOption {
  name: string;
  hex: string;
  borderHex?: string;
}

export interface SizeDimension {
  size: string;
  dimension: string; // e.g. "38x34 inches"
  chest?: string;
  waist?: string;
}

export interface Garment {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: 'Upper' | 'Lower' | 'Dress' | 'Outerwear' | 'Saree' | 'Menswear' | 'Head' | 'Foot' | 'Pants' | 'Top Body' | 'Full body';
  collection?: string;
  gender?: 'Women' | 'Men' | 'Unisex';
  price: string;
  priceNumber?: number;
  fabricComposition: string;
  stretchClass: 'None' | 'Low' | 'Medium' | 'High';
  patternType: string;
  tryonSupported: boolean;
  suitabilityScore: number; // 0-100
  flatlayImage: string;
  tryonResultImage: string;
  virtualModelImage?: string;
  isSaree?: boolean;
  availableSizes: string[];
  sizeChart?: SizeDimension[];
  colors?: ColorOption[];
  description: string;
}

export interface BodyMeasurements {
  chestCm: number;
  waistCm: number;
  hipCm: number;
  shoulderCm: number;
  heightCm: number;
}

export interface SizeRecommendation {
  recommendedSize: string;
  confidence: number; // e.g. 0.94
  fitClass: 'Slim' | 'Regular' | 'Relaxed';
  honestyWarning?: string; // Honesty rule alert if size fit differs from visual image
  measurementBreakdown: BodyMeasurements;
}

export interface PoseQualityMetrics {
  sharpnessVariance: number;
  bodyHeightPercent: number; // 70-90% ideal
  horizontalCenterOffset: number; // < 10% ideal
  shoulderYawDegrees: number; // < 10deg ideal
  personCount: number; // 1
  aPoseCompliant: boolean;
  stabilityTimeSec: number; // >= 1.0s to trigger
}

export interface TelemetryLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'AUDIT';
  component: 'EdgeVision' | 'GatewayAPI' | 'CeleryQueue' | 'VTONWorker' | 'SecurityAudit';
  message: string;
}

export interface MatchingItem {
  id: string;
  name: string;
  category: string;
  price: string;
  reason: string;
  thumbnail: string;
}

export interface StyleAdvice {
  garmentId: string;
  selectedSize: string;
  recommendedSize: string;
  returnRiskScore: number; // 0-100%
  returnRiskLevel: 'Low' | 'Moderate' | 'High';
  primaryRiskFactor?: string;
  fitVerdict: string;
  stretchTolerance: string;
  bodyProportionNotes: string;
  stylingSuggestions: string[];
  matchingItems: MatchingItem[];
  modelSource: string;
}

export interface AssistantChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedQuestions?: string[];
}

export interface SAMSegmentationResponse {
  status: string;
  sessionId: string;
  maskUrl: string;
  agnosticImageUrl: string;
  metadata: {
    category: string;
    mask_coverage_percent: number;
    torso_box: number[];
    protected_face_box: number[];
    resolution: string;
  };
}


