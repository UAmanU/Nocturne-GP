export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GraphicsQualityOption {
  id: GraphicsQuality;
  label: string;
  summary: string;
}

export const GRAPHICS_QUALITY_OPTIONS: readonly GraphicsQualityOption[] = [
  {
    id: 'low',
    label: 'Low',
    summary: 'Fastest loading: flat textures, no banners, reduced props & NPCs',
  },
  {
    id: 'medium',
    label: 'Medium',
    summary: 'Balanced visuals: standard buildings, cars, NPCs, and weather',
  },
  {
    id: 'high',
    label: 'High',
    summary: 'Shadows, seamless terrain, tire skid marks, 3D clouds & detailed models',
  },
];

export interface GraphicsProfile {
  quality: GraphicsQuality;
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: number;
  maxAnisotropyCap: number;
  textureSizeScale: number;
  gridlessGround: boolean;
  skidMarks: boolean;
  volumetricClouds: boolean;
  buildingDetail: 'simple' | 'standard' | 'high';
  showBanners: boolean;
  carDetail: 'simple' | 'standard' | 'high';
  npcDetail: 'simple' | 'standard' | 'high';
  npcDensityScale: number;
  densityScale: number;
  precipScale: number;
  lampPools: boolean;
}

export function normalizeGraphicsQuality(value: unknown): GraphicsQuality {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return 'medium';
}

export function getGraphicsProfile(quality: GraphicsQuality): GraphicsProfile {
  switch (quality) {
    case 'low':
      return {
        quality: 'low',
        pixelRatioCap: 1,
        shadows: false,
        shadowMapSize: 512,
        maxAnisotropyCap: 1,
        textureSizeScale: 0.5,
        gridlessGround: false,
        skidMarks: false,
        volumetricClouds: false,
        buildingDetail: 'simple',
        showBanners: false,
        carDetail: 'simple',
        npcDetail: 'simple',
        npcDensityScale: 0.5,
        densityScale: 0.5,
        precipScale: 0.5,
        lampPools: false,
      };
    case 'high':
      return {
        quality: 'high',
        pixelRatioCap: 2,
        shadows: true,
        shadowMapSize: 2048,
        maxAnisotropyCap: 8,
        textureSizeScale: 1,
        gridlessGround: true,
        skidMarks: true,
        volumetricClouds: true,
        buildingDetail: 'high',
        showBanners: true,
        carDetail: 'high',
        npcDetail: 'high',
        npcDensityScale: 1.15,
        densityScale: 1.2,
        precipScale: 1.2,
        lampPools: true,
      };
    case 'medium':
    default:
      return {
        quality: 'medium',
        pixelRatioCap: 1.5,
        shadows: false,
        shadowMapSize: 1024,
        maxAnisotropyCap: 4,
        textureSizeScale: 1,
        gridlessGround: false,
        skidMarks: false,
        volumetricClouds: false,
        buildingDetail: 'standard',
        showBanners: true,
        carDetail: 'standard',
        npcDetail: 'standard',
        npcDensityScale: 1,
        densityScale: 1,
        precipScale: 1,
        lampPools: true,
      };
  }
}
