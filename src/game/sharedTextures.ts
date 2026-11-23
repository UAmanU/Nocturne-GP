import * as THREE from 'three';
import type { MapId } from './types';

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 16807) % 2147483647;
    if (s <= 0) s += 2147483646;
    return (s - 1) / 2147483646;
  };
}

export function createSignPlaqueTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  accentHex: string,
  textHex: string,
  maxAnisotropy: number,
  sizeScale = 1
): THREE.CanvasTexture {
  const w = Math.max(128, Math.round(512 * sizeScale));
  const h = Math.max(48, Math.round(160 * sizeScale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(w / 512, h / 160);

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 144);
  ctx.fillStyle = accentHex;
  ctx.fillRect(16, 16, 480, 14);
  ctx.fillRect(16, 130, 480, 14);

  ctx.fillStyle = textHex;
  ctx.textAlign = 'center';
  ctx.font = 'bold 48px "Inter", system-ui, sans-serif';
  ctx.fillText(title, 256, 86);
  ctx.font = 'bold 22px "Inter", system-ui, sans-serif';
  ctx.fillStyle = accentHex;
  ctx.fillText(subtitle, 256, 118);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createAwningStripeTexture(
  colorA: string,
  colorB: string,
  maxAnisotropy: number,
  sizeScale = 1
): THREE.CanvasTexture {
  const size = Math.max(64, Math.round(128 * sizeScale));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const stripeW = size / 4;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
    ctx.fillRect(i * stripeW, 0, stripeW, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSoftGlowDiscTexture(
  rgbaInner: string,
  rgbaMid: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, rgbaInner);
  grad.addColorStop(0.45, rgbaMid);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCheckeredTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const size = 32;
  for (let y = 0; y < 128; y += size) {
    for (let x = 0; x < 512; x += size) {
      const even = (x / size + y / size) % 2 === 0;
      ctx.fillStyle = even ? '#f8fafc' : '#0f172a';
      ctx.fillRect(x, y, size, size);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createAsphaltTexture(
  maxAnisotropy: number,
  isDaylight: boolean,
  mapId: MapId,
  sizeScale = 1
): THREE.CanvasTexture {
  const dim = sizeScale < 1 ? 256 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dim / 512, dim / 512);

  if (mapId === 'ice-arena') {
    const iceGrad = ctx.createLinearGradient(0, 0, 512, 0);
    iceGrad.addColorStop(0, '#93c5fd');
    iceGrad.addColorStop(0.18, '#bae6fd');
    iceGrad.addColorStop(0.5, '#e0f2fe');
    iceGrad.addColorStop(0.82, '#bae6fd');
    iceGrad.addColorStop(1, '#93c5fd');
    ctx.fillStyle = iceGrad;
    ctx.fillRect(0, 0, 512, 512);

    const streakCount = sizeScale < 1 ? 140 : 420;
    for (let i = 0; i < streakCount; i++) {
      const x = (i * 83) % 512;
      const y = (i * 151) % 512;
      ctx.fillStyle =
        i % 2 === 0 ? 'rgba(255, 255, 255, 0.42)' : 'rgba(56, 189, 248, 0.22)';
      ctx.fillRect(x, y, 22, 2);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(14, 0, 12, 512);
    ctx.fillRect(486, 0, 12, 512);

    ctx.fillStyle = 'rgba(2, 132, 199, 0.85)';
    for (let y = 16; y < 512; y += 128) {
      ctx.fillRect(252, y, 8, 68);
    }
  } else {
    ctx.fillStyle = isDaylight ? '#2d3340' : '#181c26';
    ctx.fillRect(0, 0, 512, 512);

    const rand = seededRand(isDaylight ? 3031 : 7071);
    const grainCount = sizeScale < 1 ? 1400 : 6500;
    for (let i = 0; i < grainCount; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const base = isDaylight ? 38 : 22;
      const v = base + Math.floor(rand() * 24);
      ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 12})`;
      ctx.fillRect(x, y, 2, 2);
    }

    const trackGradL = ctx.createLinearGradient(110, 0, 210, 0);
    trackGradL.addColorStop(0, 'rgba(8, 12, 20, 0)');
    trackGradL.addColorStop(
      0.5,
      isDaylight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(8, 12, 20, 0.35)'
    );
    trackGradL.addColorStop(1, 'rgba(8, 12, 20, 0)');
    ctx.fillStyle = trackGradL;
    ctx.fillRect(110, 0, 100, 512);

    const trackGradR = ctx.createLinearGradient(302, 0, 402, 0);
    trackGradR.addColorStop(0, 'rgba(8, 12, 20, 0)');
    trackGradR.addColorStop(
      0.5,
      isDaylight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(8, 12, 20, 0.35)'
    );
    trackGradR.addColorStop(1, 'rgba(8, 12, 20, 0)');
    ctx.fillStyle = trackGradR;
    ctx.fillRect(302, 0, 100, 512);

    ctx.fillStyle = 'rgba(241, 245, 249, 0.88)';
    ctx.fillRect(16, 0, 10, 512);
    ctx.fillRect(486, 0, 10, 512);

    ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
    for (let y = 16; y < 512; y += 128) {
      ctx.fillRect(252, y, 8, 68);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPlainAsphaltTexture(
  maxAnisotropy: number,
  isDaylight: boolean,
  sizeScale = 1
): THREE.CanvasTexture {
  const dim = sizeScale < 1 ? 128 : 256;
  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = isDaylight ? '#2d3340' : '#181c26';
  ctx.fillRect(0, 0, dim, dim);

  const rand = seededRand(9091);
  const grains = sizeScale < 1 ? 550 : 2200;
  for (let i = 0; i < grains; i++) {
    const x = rand() * dim;
    const y = rand() * dim;
    const base = isDaylight ? 38 : 22;
    const v = base + Math.floor(rand() * 24);
    ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 12})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCurbTexture(
  maxAnisotropy: number,
  mapId: MapId
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle =
    mapId === 'beach'
      ? '#0284c7'
      : mapId === 'ice-arena'
        ? '#0ea5e9'
        : mapId === 'construction'
          ? '#facc15'
          : '#e11d48';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle =
    mapId === 'beach'
      ? '#fef3c7'
      : mapId === 'construction'
        ? '#0f172a'
        : '#f8fafc';
  ctx.fillRect(0, 128, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSidewalkTexture(
  maxAnisotropy: number,
  mapId: MapId,
  sizeScale = 1
): THREE.CanvasTexture {
  const dim = sizeScale < 1 ? 128 : 256;
  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dim / 256, dim / 256);

  if (mapId === 'beach') {
    ctx.fillStyle = '#c89d6c';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = (y / 32) % 2 === 0 ? '#cfa575' : '#bf9260';
      ctx.fillRect(0, y + 2, 256, 28);
      ctx.fillStyle = '#7c5832';
      ctx.fillRect(0, y, 256, 2);
    }
    ctx.fillStyle = '#e7d3b0';
    ctx.fillRect(0, 0, 14, 256);
    ctx.fillRect(242, 0, 14, 256);
  } else if (mapId === 'ice-arena') {
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(0, 0, 256, 256);
    const tw = 64;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#eff6ff' : '#bae6fd';
        ctx.fillRect(c * tw + 2, r * tw + 2, tw - 4, tw - 4);
      }
    }
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 14, 256);
    ctx.fillRect(242, 0, 14, 256);
  } else if (mapId === 'construction') {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 256, 256);
    const tw = 64;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const shade = (r + c) % 2 === 0 ? 148 : 162;
        ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 4})`;
        ctx.fillRect(c * tw + 2, r * tw + 2, tw - 4, tw - 4);
      }
    }
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 14, 256);
    ctx.fillRect(242, 0, 14, 256);
    ctx.fillStyle = '#0f172a';
    for (let y = 0; y < 256; y += 32) {
      ctx.fillRect(0, y, 14, 16);
      ctx.fillRect(242, y, 14, 16);
    }
  } else if (mapId === 'day-city') {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 256, 256);
    const tw = 64;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const shade = (r + c) % 2 === 0 ? 156 : 168;
        ctx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 10})`;
        ctx.fillRect(c * tw + 2, r * tw + 2, tw - 4, tw - 4);
      }
    }
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += tw) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 14, 256);
    ctx.fillRect(242, 0, 14, 256);
  } else {
    ctx.fillStyle = '#252e42';
    ctx.fillRect(0, 0, 256, 256);
    const tw = 64;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const shade = (r + c) % 2 === 0 ? 37 : 43;
        ctx.fillStyle = `rgb(${shade}, ${shade + 8}, ${shade + 22})`;
        ctx.fillRect(c * tw + 2, r * tw + 2, tw - 4, tw - 4);
      }
    }
    ctx.strokeStyle = '#131926';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 256; i += tw) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 16, 256);
    ctx.fillRect(240, 0, 16, 256);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.fillRect(16, 0, 5, 256);
    ctx.fillRect(235, 0, 5, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSkyscraperWindowTexture(
  maxAnisotropy: number,
  isDaylight: boolean,
  sizeScale = 1
): {
  colorMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const w = sizeScale < 1 ? 128 : 256;
  const h = sizeScale < 1 ? 256 : 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const cCtx = colorCanvas.getContext('2d')!;

  const emCanvas = document.createElement('canvas');
  emCanvas.width = w;
  emCanvas.height = h;
  const eCtx = emCanvas.getContext('2d')!;

  if (sizeScale < 1) {
    cCtx.scale(w / 256, h / 512);
    eCtx.scale(w / 256, h / 512);
  }

  cCtx.fillStyle = isDaylight ? '#cbd5e1' : '#0e1320';
  cCtx.fillRect(0, 0, 256, 512);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 256, 512);

  const cols = sizeScale < 1 ? 4 : 8;
  const rows = sizeScale < 1 ? 10 : 20;
  const padX = 6;
  const padY = 6;
  const cellW = 256 / cols;
  const cellH = 512 / rows;

  const rand = seededRand(1337);

  for (let r = 0; r < rows; r++) {
    const floorLitBias = rand() > 0.3 ? 0.58 : 0.15;
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + padX;
      const y = r * cellH + padY;
      const ww = cellW - padX * 2;
      const wh = cellH - padY * 2;

      if (isDaylight) {
        const skyShade = rand();
        cCtx.fillStyle =
          skyShade < 0.5 ? '#60a5fa' : skyShade < 0.8 ? '#93c5fd' : '#38bdf8';
        cCtx.fillRect(x, y, ww, wh);
      } else {
        cCtx.fillStyle = '#182135';
        cCtx.fillRect(x, y, ww, wh);
        if (rand() < floorLitBias) {
          const tone = rand();
          const litColor =
            tone < 0.55
              ? '#fde68a'
              : tone < 0.85
                ? '#bae6fd'
                : '#fdba74';
          cCtx.fillStyle = litColor;
          cCtx.fillRect(x, y, ww, wh);
          eCtx.fillStyle = litColor;
          eCtx.fillRect(x, y, ww, wh);
        }
      }
    }
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.anisotropy = maxAnisotropy;

  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.anisotropy = maxAnisotropy;

  return { colorMap, emissiveMap };
}

export function createGroundTexture(
  maxAnisotropy: number,
  mapId: MapId,
  gridless = false,
  sizeScale = 1
): THREE.CanvasTexture {
  if (gridless) {
    return createHighQualityGridlessGroundTexture(maxAnisotropy, mapId);
  }

  const dim = sizeScale < 1 ? 128 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d')!;
  if (dim !== 512) {
    ctx.scale(dim / 512, dim / 512);
  }
  const lowMode = sizeScale < 1;

  if (mapId === 'beach') {
    ctx.fillStyle = '#e0ad38';
    ctx.fillRect(0, 0, 512, 512);
    const specks = lowMode ? 420 : 4500;
    const rand = seededRand(4101);
    for (let i = 0; i < specks; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      ctx.fillStyle =
        i % 2 === 0 ? 'rgba(198, 140, 28, 0.58)' : 'rgba(244, 206, 98, 0.54)';
      ctx.fillRect(x, y, 3, 2);
    }
  } else if (mapId === 'ice-arena') {
    ctx.fillStyle = '#eff6ff';
    ctx.fillRect(0, 0, 512, 512);
    const specks = lowMode ? 320 : 2800;
    const rand = seededRand(4201);
    for (let i = 0; i < specks; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      ctx.fillStyle =
        i % 2 === 0 ? 'rgba(186, 230, 253, 0.52)' : 'rgba(255, 255, 255, 0.72)';
      ctx.fillRect(x, y, 4, 3);
    }
    if (!lowMode) {
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.42)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
    }
  } else if (mapId === 'construction') {
    ctx.fillStyle = '#d4ac47';
    ctx.fillRect(0, 0, 512, 512);
    const specks = lowMode ? 380 : 4200;
    const rand = seededRand(4301);
    for (let i = 0; i < specks; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(192, 146, 44, 0.48)'
          : i % 3 === 1
            ? 'rgba(250, 204, 21, 0.45)'
            : 'rgba(254, 240, 138, 0.36)';
      ctx.fillRect(x, y, 4, 3);
    }
    if (!lowMode) {
      ctx.strokeStyle = 'rgba(133, 98, 42, 0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
    }
  } else if (mapId === 'day-city') {
    ctx.fillStyle = '#6b7d64';
    ctx.fillRect(0, 0, 512, 512);
    if (!lowMode) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.fillRect(0, 0, 512, 36);
      ctx.fillRect(0, 0, 36, 512);
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
    }
  } else {
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, 512, 512);
    if (!lowMode) {
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 90);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createHighQualityGridlessGroundTexture(
  maxAnisotropy: number,
  mapId: MapId
): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(mapId.length * 7919 + 881);

  const stampWrappedPatch = (
    x: number,
    y: number,
    r: number,
    rgbaInner: string,
    rgbaOuter: string
  ) => {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const px = x + ox;
        const py = y + oy;
        if (px < -r || px > size + r || py < -r || py > size + r) continue;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, rgbaInner);
        g.addColorStop(1, rgbaOuter);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  if (mapId === 'beach') {
    ctx.fillStyle = '#dfa935';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 48; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 70 + rand() * 110;
      const warm = i % 2 === 0;
      stampWrappedPatch(
        x,
        y,
        r,
        warm ? 'rgba(244, 198, 84, 0.28)' : 'rgba(196, 138, 32, 0.24)',
        'rgba(223, 169, 53, 0)'
      );
    }

    // Wind-rippled sand dunes (tileable horizontally)
    for (let row = 0; row < 44; row++) {
      const baseY = (row / 44) * size;
      ctx.strokeStyle =
        row % 2 === 0 ? 'rgba(182, 128, 28, 0.22)' : 'rgba(252, 220, 128, 0.26)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 32) {
        const wy = baseY + Math.sin((x / size) * Math.PI * 4 + row * 0.7) * 7;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    for (let i = 0; i < 12000; i++) {
      const x = rand() * size;
      const y = rand() * size;
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(184, 128, 24, 0.35)'
          : i % 3 === 1
            ? 'rgba(253, 224, 130, 0.38)'
            : 'rgba(234, 179, 56, 0.32)';
      ctx.fillRect(x, y, 2, 2);
    }
  } else if (mapId === 'ice-arena') {
    ctx.fillStyle = '#ebf4ff';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 54; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 80 + rand() * 125;
      stampWrappedPatch(
        x,
        y,
        r,
        i % 2 === 0 ? 'rgba(186, 230, 253, 0.34)' : 'rgba(255, 255, 255, 0.45)',
        'rgba(235, 244, 255, 0)'
      );
    }

    // Smooth drifted snow crests
    for (let row = 0; row < 28; row++) {
      const baseY = (row / 28) * size;
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.26)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 32) {
        const wy = baseY + Math.sin((x / size) * Math.PI * 2 + row * 0.5) * 10;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    for (let i = 0; i < 9000; i++) {
      const x = rand() * size;
      const y = rand() * size;
      ctx.fillStyle =
        i % 2 === 0 ? 'rgba(255, 255, 255, 0.55)' : 'rgba(125, 211, 252, 0.22)';
      ctx.fillRect(x, y, 2, 2);
    }
  } else if (mapId === 'construction') {
    ctx.fillStyle = '#cf9e3e';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 60; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 65 + rand() * 110;
      stampWrappedPatch(
        x,
        y,
        r,
        i % 2 === 0 ? 'rgba(161, 114, 34, 0.28)' : 'rgba(234, 189, 84, 0.28)',
        'rgba(207, 158, 62, 0)'
      );
    }

    for (let i = 0; i < 14000; i++) {
      const x = rand() * size;
      const y = rand() * size;
      ctx.fillStyle =
        i % 4 === 0
          ? 'rgba(120, 82, 26, 0.34)'
          : i % 4 === 1
            ? 'rgba(245, 208, 92, 0.32)'
            : i % 4 === 2
              ? 'rgba(148, 130, 102, 0.26)'
              : 'rgba(217, 168, 56, 0.32)';
      const s = i % 5 === 0 ? 3 : 2;
      ctx.fillRect(x, y, s, s);
    }
  } else if (mapId === 'day-city') {
    // Rich seamless park turf & natural granite speckles — NO grid lines
    ctx.fillStyle = '#5a7352';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 72; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 70 + rand() * 120;
      const mode = i % 3;
      stampWrappedPatch(
        x,
        y,
        r,
        mode === 0
          ? 'rgba(116, 145, 96, 0.3)'
          : mode === 1
            ? 'rgba(69, 94, 62, 0.28)'
            : 'rgba(148, 163, 152, 0.16)',
        'rgba(90, 115, 82, 0)'
      );
    }

    for (let i = 0; i < 15000; i++) {
      const x = rand() * size;
      const y = rand() * size;
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(134, 168, 110, 0.36)'
          : i % 3 === 1
            ? 'rgba(54, 78, 50, 0.34)'
            : 'rgba(182, 196, 168, 0.22)';
      ctx.fillRect(x, y, 2, i % 4 === 0 ? 4 : 2);
    }
  } else {
    // Night-city / Pursuit: seamless moonlit urban slate & asphalt earth (zero grid lines)
    ctx.fillStyle = '#090e18';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 58; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 75 + rand() * 120;
      stampWrappedPatch(
        x,
        y,
        r,
        i % 2 === 0 ? 'rgba(20, 30, 50, 0.34)' : 'rgba(7, 11, 20, 0.42)',
        'rgba(9, 14, 24, 0)'
      );
    }

    for (let i = 0; i < 12000; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const v = 14 + Math.floor(rand() * 22);
      ctx.fillStyle = `rgba(${v}, ${v + 6}, ${v + 18}, 0.45)`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(58, 58);
  tex.anisotropy = maxAnisotropy;
  return tex;
}
