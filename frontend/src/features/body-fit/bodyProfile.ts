export interface FlexibleBodyProfile {
  shoulderHipRatio: number;
  waistHipRatio: number;
  torsoLegRatio: number;
  shoulderNorm: number;
  waistNorm: number;
  hipNorm: number;
  bodyType: 'Hourglass' | 'Pear' | 'Apple' | 'Rectangle' | 'Inverted Triangle';
  size: string;
  drapeStyle: string;
  confidence: number;
}

export function analyzeAnyBody(
  landmarks: any[],
  _imgW = 1000,
  _imgH = 1000
): FlexibleBodyProfile {
  const d = (a: any, b: any) =>
    Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));

  // Landmarks: 11/12 shoulder, 23/24 hip, 0 nose, 27 ankle
  const shoulder =
    landmarks && landmarks[11] && landmarks[12]
      ? d(landmarks[11], landmarks[12])
      : 0.25;
  const hip =
    landmarks && landmarks[23] && landmarks[24]
      ? d(landmarks[23], landmarks[24])
      : 0.25;
  const torso =
    landmarks && landmarks[11] && landmarks[23]
      ? d(landmarks[11], landmarks[23])
      : 0.40;
  const totalHeight =
    landmarks && landmarks[0] && landmarks[27]
      ? d(landmarks[0], landmarks[27])
      : 0.85;

  // Waist estimation from torso midpoint - no height input needed
  const waist = hip * 0.82;

  const shoulderHipRatio = hip > 0 ? shoulder / hip : 1.0;
  const waistHipRatio = hip > 0 ? waist / hip : 0.82;
  const torsoLegRatio = totalHeight > 0 ? torso / totalHeight : 0.45;

  let bodyType: FlexibleBodyProfile['bodyType'] = 'Rectangle';
  if (shoulderHipRatio > 1.12) bodyType = 'Inverted Triangle';
  else if (shoulderHipRatio < 0.88) bodyType = 'Pear';
  else if (waistHipRatio < 0.75) bodyType = 'Hourglass';
  else if (waistHipRatio > 0.90) bodyType = 'Apple';

  // Professional drape logic for Saree based on her shape
  const drapeMap: Record<FlexibleBodyProfile['bodyType'], string> = {
    Hourglass:
      'pleats tucked tight at natural waist, pallu over left shoulder, highlight waist curve',
    Pear:
      'pallu draped wider over shoulder to balance hips, pleats flared slightly at front',
    Apple:
      'saree draped below navel, longer pallu front drape, no tight waist tuck',
    Rectangle:
      'extra pleats at waist to create curve, pallu pinned at shoulder with fall',
    'Inverted Triangle':
      'soft pleats, pallu flowing loose to add lower body volume',
  };

  const confidence =
    landmarks && landmarks[11] && landmarks[23] && landmarks[27]
      ? Math.min(
          landmarks[11].visibility ?? 0.9,
          landmarks[23].visibility ?? 0.9,
          landmarks[27].visibility ?? 0.9
        )
      : 0.85;

  const safeHeight = totalHeight > 0 ? totalHeight : 1.0;

  return {
    shoulderHipRatio,
    waistHipRatio,
    torsoLegRatio,
    shoulderNorm: shoulder / safeHeight,
    waistNorm: waist / safeHeight,
    hipNorm: hip / safeHeight,
    bodyType,
    size: hip / safeHeight > 0.18 ? 'L' : hip / safeHeight > 0.15 ? 'M' : 'S',
    drapeStyle: drapeMap[bodyType],
    confidence,
  };
}
