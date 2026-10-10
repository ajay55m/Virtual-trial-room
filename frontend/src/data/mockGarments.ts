import type { Garment } from '../types/kiosk';

export const MOCK_GARMENTS: Garment[] = [
  {
    id: 'g-001',
    sku: 'BLK-SLK-BLZ-09',
    name: 'Tailored Midnight Silk Blazer',
    brand: 'NOVASYNTH Atelier',
    category: 'Upper',
    price: '$890',
    fabricComposition: '85% Mulberry Silk, 15% Metallic Thread',
    stretchClass: 'Low',
    patternType: 'Solid Satin Finish',
    tryonSupported: true,
    suitabilityScore: 98,
    flatlayImage: '/assets/garment_blazer.jpg',
    tryonResultImage: '/assets/tryon_blazer.jpg',
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    description: 'Precision-tailored evening blazer in luminous midnight blue silk with metallic trim detailing.'
  },
  {
    id: 'g-002',
    sku: 'EMR-SAT-DRS-14',
    name: 'Emerald Satin Draped Evening Gown',
    brand: 'AURA Haute Couture',
    category: 'Dress',
    price: '$1,450',
    fabricComposition: '100% Heavy Silk Satin',
    stretchClass: 'None',
    patternType: 'Draped Liquid Satin',
    tryonSupported: true,
    suitabilityScore: 94,
    flatlayImage: '/assets/garment_dress.jpg',
    tryonResultImage: '/assets/tryon_dress.jpg',
    availableSizes: ['S', 'M', 'L'],
    description: 'Floor-length emerald gown featuring asymmetry draping and sculptured bodice fit.'
  },
  {
    id: 'g-003',
    sku: 'NEX-UTL-JKT-88',
    name: 'Nexus Cybernetic Utility Jacket',
    brand: 'NEXUS Lab',
    category: 'Outerwear',
    price: '$650',
    fabricComposition: '3-Layer Waterproof Cordura Membrane',
    stretchClass: 'Medium',
    patternType: 'Matte Techwear',
    tryonSupported: true,
    suitabilityScore: 99,
    flatlayImage: '/assets/garment_jacket.jpg',
    tryonResultImage: '/assets/tryon_jacket.jpg',
    availableSizes: ['S', 'M', 'L', 'XL', 'XXL'],
    description: 'Weatherproof high-neck utility jacket with ergonomic articulated sleeves and magnetic hardware.'
  }
];
