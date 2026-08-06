
import * as THREE from 'three';

export async function loadNuScenesLidar(binUrl: string) {
    // TODO: might be faster to load it not using fetch
    const response = await fetch(binUrl);
    const arrayBuffer = await response.arrayBuffer();

    // format per point: [x, y, z, intensity, ring_index]
    const floatView = new Float32Array(arrayBuffer);
    const totalPoints = floatView.length / 5;

    const positions = new Float32Array(totalPoints * 3);
    const colors = new Float32Array(totalPoints * 3);

    for (let i = 0; i < totalPoints; i++) {
        // save x, y, z in vehicle local space
        positions[i * 3] = floatView[i * 5 + 0];
        positions[i * 3 + 1] = floatView[i * 5 + 1];
        positions[i * 3 + 2] = floatView[i * 5 + 2];

        const intensity = floatView[i * 5 + 3];

        // add color based on intensity
        const normIntensity = Math.min(intensity / 255, 1.0);
        colors[i * 3] = 0.1;
        colors[i * 3 + 1] = 0.3  + normIntensity * 0.7;
        colors[i * 3 + 2] = 0.8;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        sizeAttenuation: true
    });
    
    return new THREE.Points(geometry, material);
}

// src/utils/getLidarFrames.ts

export function getNuScenesFrames(): string[] {
  // 1. Scan the folder for all files matching your prefix
  const modules = import.meta.glob<{ default: string }>(
    '/src/assets/lidar/n008-2018-08-01-15-16-36-0400__LIDAR_TOP__*.pcd.bin',
    { eager: true, query: '?url' }
  );

  // 2. Sort filenames by their timestamp ending to guarantee chronological order
  const sortedUrls = Object.keys(modules)
    .sort((pathA, pathB) => {
      // Extract microsecond timestamp from end of filename "...__1538984239948316.pcd.bin"
      const timeA = Number(pathA.match(/__(\d+)\.pcd\.bin$/)?.[1] || 0);
      const timeB = Number(pathB.match(/__(\d+)\.pcd\.bin$/)?.[1] || 0);
      return timeA - timeB;
    })
    .map((key) => modules[key].default);

  return sortedUrls;
}