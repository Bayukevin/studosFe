export interface PhotoArea {
  id: string;
  type: 'square' | 'landscape' | 'portrait';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  order: number;
}

export interface Frame {
  id: string;
  name: string;
  image: string;
  size: '4x6' | '2x4';
  areas: PhotoArea[];
  createdAt: Date;
  areasOnTop: boolean;
}

export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  areaId: string;
  timestamp: Date;
  aspectRatio?: number;
}

export interface PhotoSession {
  id: string;
  frameId: string;
  photos: CapturedPhoto[];
  finalImage?: string;
  createdAt: Date;
}

export interface CropSettings {
  x: number;
  y: number;
  width: number;
  height: number;
}