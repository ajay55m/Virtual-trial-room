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

export interface Garment {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: 'Upper' | 'Lower' | 'Dress' | 'Outerwear';
  price: string;
  fabricComposition: string;
  stretchClass: 'None' | 'Low' | 'Medium' | 'High';
  patternType: string;
  tryonSupported: boolean;
  suitabilityScore: number; // 0-100
  flatlayImage: string;
  tryonResultImage: string;
  availableSizes: string[];
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
