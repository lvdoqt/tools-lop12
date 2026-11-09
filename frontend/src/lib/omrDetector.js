/**
 * Real-time client-side Corner Marker Detector for OMR Answer Sheets.
 * Runs on downsampled video canvas in ~5-15ms without external libraries.
 */

export function detectCornersOnCanvas(video, canvas) {
  if (!video || !canvas || video.readyState < 2) {
    return { tl: false, tr: false, bl: false, br: false, allFound: false, count: 0 };
  }

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const dw = 320;
  const dh = Math.round(320 * (vh / vw)) || 420;

  if (canvas.width !== dw || canvas.height !== dh) {
    canvas.width = dw;
    canvas.height = dh;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { tl: false, tr: false, bl: false, br: false, allFound: false, count: 0 };
  }

  ctx.drawImage(video, 0, 0, dw, dh);
  const imgData = ctx.getImageData(0, 0, dw, dh);
  const pixels = imgData.data;

  // Convert to grayscale luminance array
  const gray = new Uint8Array(dw * dh);
  for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
    gray[j] = (pixels[i] * 77 + pixels[i + 1] * 150 + pixels[i + 2] * 29) >> 8;
  }

  // Define 4 quadrant search ROIs
  const quadrants = [
    { name: 'tl', x1: 0, x2: Math.floor(dw * 0.36), y1: 0, y2: Math.floor(dh * 0.36), targetX: 0, targetY: 0 },
    { name: 'tr', x1: Math.floor(dw * 0.64), x2: dw, y1: 0, y2: Math.floor(dh * 0.36), targetX: dw, targetY: 0 },
    { name: 'bl', x1: 0, x2: Math.floor(dw * 0.36), y1: Math.floor(dh * 0.64), y2: dh, targetX: 0, targetY: dh },
    { name: 'br', x1: Math.floor(dw * 0.64), x2: dw, y1: Math.floor(dh * 0.64), y2: dh, targetX: dw, targetY: dh },
  ];

  const status = { tl: false, tr: false, bl: false, br: false, allFound: false, count: 0, coords: {} };

  for (const q of quadrants) {
    const qw = q.x2 - q.x1;
    const qh = q.y2 - q.y1;
    if (qw <= 0 || qh <= 0) continue;

    // 1. Calculate min and mean luminance in quadrant
    let minLum = 255;
    let sumLum = 0;
    let sampleCount = 0;

    for (let qy = 0; qy < qh; qy += 2) {
      const rowOffset = (q.y1 + qy) * dw + q.x1;
      for (let qx = 0; qx < qw; qx += 2) {
        const val = gray[rowOffset + qx];
        if (val < minLum) minLum = val;
        sumLum += val;
        sampleCount++;
      }
    }

    const meanLum = sumLum / (sampleCount || 1);
    // Needs sufficient contrast between white paper and dark fiducials
    if (meanLum - minLum < 28) continue;

    const thresh = Math.min(130, Math.max(45, minLum + (meanLum - minLum) * 0.45));

    // 2. BFS Connected Components in quadrant to find solid square
    const visited = new Uint8Array(qw * qh);
    let best = null;
    let minCornerDist = Infinity;

    for (let qy = 1; qy < qh - 1; qy++) {
      const rowOffset = (q.y1 + qy) * dw + q.x1;
      const vRowOffset = qy * qw;

      for (let qx = 1; qx < qw - 1; qx++) {
        const vidx = vRowOffset + qx;
        if (visited[vidx]) continue;

        if (gray[rowOffset + qx] >= thresh) {
          visited[vidx] = 1;
          continue;
        }

        // BFS search for connected component
        let minX = qx, maxX = qx, minY = qy, maxY = qy, area = 0;
        const queue = [qx, qy];
        visited[vidx] = 1;
        let head = 0;

        while (head < queue.length) {
          const cx = queue[head++];
          const cy = queue[head++];
          area++;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          // 4-neighborhood
          if (cx + 1 < qw && !visited[cy * qw + cx + 1]) {
            visited[cy * qw + cx + 1] = 1;
            if (gray[(q.y1 + cy) * dw + (q.x1 + cx + 1)] < thresh) queue.push(cx + 1, cy);
          }
          if (cx - 1 >= 0 && !visited[cy * qw + cx - 1]) {
            visited[cy * qw + cx - 1] = 1;
            if (gray[(q.y1 + cy) * dw + (q.x1 + cx - 1)] < thresh) queue.push(cx - 1, cy);
          }
          if (cy + 1 < qh && !visited[(cy + 1) * qw + cx]) {
            visited[(cy + 1) * qw + cx] = 1;
            if (gray[(q.y1 + cy + 1) * dw + (q.x1 + cx)] < thresh) queue.push(cx, cy + 1);
          }
          if (cy - 1 >= 0 && !visited[(cy - 1) * qw + cx]) {
            visited[(cy - 1) * qw + cx] = 1;
            if (gray[(q.y1 + cy - 1) * dw + (q.x1 + cx)] < thresh) queue.push(cx, cy - 1);
          }
        }

        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        if (bw < 4 || bh < 4 || area < 16 || area > 0.25 * qw * qh) continue;

        const aspect = bw / bh;
        const solidity = area / (bw * bh);

        // Solid square criteria
        if (aspect >= 0.62 && aspect <= 1.55 && solidity >= 0.55) {
          const globalCx = q.x1 + (minX + maxX) / 2;
          const globalCy = q.y1 + (minY + maxY) / 2;
          const dist = Math.hypot(globalCx - q.targetX, globalCy - q.targetY);

          if (dist < minCornerDist) {
            minCornerDist = dist;
            best = { x: globalCx, y: globalCy, bw, bh, area, aspect, solidity };
          }
        }
      }
    }

    if (best) {
      status[q.name] = true;
      status.coords[q.name] = best;
      status.count++;
    }
  }

  status.allFound = (status.count === 4);
  return status;
}

// Web Audio API Synthesizers
let audioCtx = null;
function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playBeepSound(freq = 880, duration = 0.08) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (_e) {}
}

export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start(ctx.currentTime + 0.08);
    osc1.stop(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.35);
  } catch (_e) {}
}

export function playWarningSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (_e) {}
}
