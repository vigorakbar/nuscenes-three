import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getNuScenesFrames, loadNuScenesLidar } from '../utils/lidarParser';

const LIDAR_FRAMES = getNuScenesFrames();

export const LidarViewport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Three.js instances held in refs so React state changes don't re-instantiate the canvas
  const sceneRef = useRef<THREE.Scene | null>(null);
  const pointMeshRef = useRef<THREE.Points | null>(null);
  // Cache for preloaded frames to allow smooth playback
  const pointsCacheRef = useRef<Array<THREE.Points | null>>(Array(LIDAR_FRAMES.length).fill(null));

  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadedFrames, setLoadedFrames] = useState<boolean[]>(() => Array(LIDAR_FRAMES.length).fill(false));
  const hasStartedPreloadRef = useRef<boolean>(false);

  // 1. Initialize Scene Once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0d10);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, -35, 25);
    camera.up.set(0, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const grid = new THREE.GridHelper(100, 50, 0x334155, 0x1e293b);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);

    // Render loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (pointMeshRef.current) {
        pointMeshRef.current.geometry.dispose();
        (pointMeshRef.current.material as THREE.Material).dispose();
      }
      // dispose any cached frames
      pointsCacheRef.current.forEach((p) => {
        if (p) {
          p.geometry.dispose();
          (p.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      if (container) container.innerHTML = '';
    };
  }, []);

  // 2. Load Frame Data when `currentFrameIndex` changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    setIsLoading(true);

    // If frame was preloaded, use cached Points, otherwise load and cache it
    const cached = pointsCacheRef.current[currentFrameIndex];
    if (cached) {
      if (pointMeshRef.current) {
        scene.remove(pointMeshRef.current);
      }
      pointMeshRef.current = cached;
      scene.add(cached);
      setLoadedFrames((prev) => {
        if (prev[currentFrameIndex]) return prev;
        const copy = prev.slice();
        copy[currentFrameIndex] = true;
        return copy;
      });
      setIsLoading(false);
      return;
    }

    const frameUrl = LIDAR_FRAMES[currentFrameIndex];

    loadNuScenesLidar(frameUrl)
      .then((newPoints) => {
        // Remove old point cloud from scene but keep cache
        if (pointMeshRef.current) {
          scene.remove(pointMeshRef.current);
        }

        // Cache the loaded points for future reuse
        pointsCacheRef.current[currentFrameIndex] = newPoints;
        pointMeshRef.current = newPoints;
        scene.add(newPoints);

        setLoadedFrames((prev) => {
          if (prev[currentFrameIndex]) return prev;
          const copy = prev.slice();
          copy[currentFrameIndex] = true;
          return copy;
        });
      })
      .catch((err) => console.error('Failed to load frame:', err))
      .finally(() => setIsLoading(false));
  }, [currentFrameIndex]);

  // 3. Playback Loop (Auto-advance frame every 200ms)
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentFrameIndex((prevIndex) => (prevIndex + 1) % LIDAR_FRAMES.length);
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Start sequential preloading of all frames when user first starts playing
  const startPreloading = async () => {
    if (hasStartedPreloadRef.current) return;
    hasStartedPreloadRef.current = true;

    for (let i = 0; i < LIDAR_FRAMES.length; i++) {
      if (pointsCacheRef.current[i]) {
        setLoadedFrames((prev) => {
          if (prev[i]) return prev;
          const copy = prev.slice();
          copy[i] = true;
          return copy;
        });
        continue;
      }

      try {
        const pts = await loadNuScenesLidar(LIDAR_FRAMES[i]);
        pointsCacheRef.current[i] = pts;
        setLoadedFrames((prev) => {
          const copy = prev.slice();
          copy[i] = true;
          return copy;
        });
      } catch (e) {
        console.error('Preload failed for frame', i, e);
      }
    }
  };

  const getSliderBackground = () => {
    const n = LIDAR_FRAMES.length;
    if (n <= 1) return '';
    const stops = loadedFrames.map((loaded, i) => {
      const percent = (i / (n - 1)) * 100;
      const color = loaded ? '#3b82f6' : '#334155';
      return `${color} ${percent}%`;
    });
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Control Bar Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          zIndex: 10,
        }}
      >
        {/* Play/Pause Button */}
        <button
          onClick={() => {
            const newPlaying = !isPlaying;
            setIsPlaying(newPlaying);
            if (newPlaying) startPreloading();
          }}
          style={{
            background: isPlaying ? '#ef4444' : '#3b82f6',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        {/* Frame Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>LiDAR Sweep Frame</span>
            <span>
              {currentFrameIndex + 1} / {LIDAR_FRAMES.length} {isLoading && '(Loading...)'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={LIDAR_FRAMES.length - 1}
            value={currentFrameIndex}
            onChange={(e) => {
              setIsPlaying(false); // Pause auto-play when user drags manual slider
              setCurrentFrameIndex(Number(e.target.value));
            }}
            style={{
              width: '280px',
              cursor: 'pointer',
              background: getSliderBackground(),
              height: '10px',
              borderRadius: '999px',
              appearance: 'none',
              WebkitAppearance: 'none',
              outline: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
};