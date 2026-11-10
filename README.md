# Displaying LiDAR data from nuScenes sample dataset using sweep frame playback

An interactive 3D viewer built with React, Three.js and Vite that renders LiDAR point clouds from the [nuScenes](https://www.nuscenes.org/) dataset and lets you step through or play back consecutive LiDAR sweeps as an animation.

**Live demo: [vigorakbar.github.io/nuscenes-three](https://vigorakbar.github.io/nuscenes-three/)**

## Features

- **3D point cloud rendering** with WebGL via Three.js
- **Intensity-based colouring**: each point's LiDAR intensity is mapped to a blue-to-cyan colour ramp
- **Orbit controls**: rotate, pan and zoom around the scene with mouse or touch (with damping)
- **Sweep frame playback**: play/pause auto-advances through frames (150 ms per frame) and loops at the end
- **Manual scrubbing**: drag the slider to jump to any frame; playback pauses automatically
- **Lazy loading + caching**: the current frame loads on demand, and all frames are sequentially preloaded in the background the first time you press Play, so later playback is smooth
- **Load-progress slider**: the slider track is blue for frames already loaded and grey for those still pending
- **Ground reference grid** (100 m × 100 m) with a Z-up coordinate system
- **Clean resource handling**: geometries, materials and the renderer are disposed on unmount, and the scene is created once so React state changes never re-instantiate the canvas

## Tech Stack

- [React](https://react.dev/) (function components + hooks)
- [Three.js](https://threejs.org/) (`WebGLRenderer`, `Points`, `OrbitControls`)
- [Vite](https://vite.dev/) (dev server, build, and `import.meta.glob` for bundling the sweep files)
- TypeScript

## Project Structure

```
src/
├── assets/
│   └── lidar/                # nuScenes LIDAR_TOP sweep files (*.pcd.bin)
├── components/
│   └── LidarViewport.tsx     # Viewer component (scene, playback, UI controls)
├── utils/
│   └── lidarParser.ts        # Frame discovery and .pcd.bin parsing
├── App.tsx
├── App.css
├── index.css
└── main.tsx
```

## How It Works

### Data loading (`src/utils/lidarParser.ts`)

- **`getNuScenesFrames()`** uses Vite's `import.meta.glob` to find every `.pcd.bin` file in `src/assets/lidar/` matching the scene prefix `n008-2018-08-01-15-16-36-0400__LIDAR_TOP__`. It sorts the files by the microsecond timestamp at the end of each filename, so playback is always in chronological order, and returns their URLs.
- **`loadNuScenesLidar(url)`** fetches one sweep as binary and parses it as `Float32` values. Each point has 5 values: `[x, y, z, intensity, ring_index]`. It builds a `THREE.BufferGeometry` with `position` (x, y, z in vehicle-local space) and `color` attributes, where colour is derived from intensity normalised by 255, and returns a `THREE.Points` object (`size: 0.15`, size attenuation on).

### Viewer (`src/components/LidarViewport.tsx`)

| Part | Responsibility |
| --- | --- |
| Scene init effect (runs once) | Creates the scene, camera, renderer, orbit controls, grid and render loop; handles window resize and cleanup |
| Frame effect (on `currentFrameIndex`) | Swaps the displayed point cloud, using the cache if available, otherwise loading it via `loadNuScenesLidar` |
| Playback effect (on `isPlaying`) | Advances the frame index on an interval and wraps around |
| `startPreloading()` | Sequentially loads and caches every frame on first Play, updating the slider's loaded-state shading |

## Controls

| Action | Control |
| --- | --- |
| Rotate | Left-click + drag |
| Pan | Right-click + drag |
| Zoom | Scroll wheel / pinch |
| Play / Pause | **Play** / **Pause** button |
| Jump to frame | Drag the slider |

## Configuration

Common values you may want to tweak:

| Setting | Location | Default |
| --- | --- | --- |
| Scene (file prefix) | `import.meta.glob` pattern in `lidarParser.ts` | `n008-2018-08-01-15-16-36-0400__LIDAR_TOP__*` |
| Point size | `PointsMaterial` in `lidarParser.ts` | `0.15` |
| Colour ramp | colour loop in `lidarParser.ts` | blue to cyan by intensity |
| Playback speed | `setInterval` delay in `LidarViewport.tsx` | `150` ms per frame |
| Camera start position | `camera.position.set(...)` | `(0, -35, 25)` |
| Field of view | `PerspectiveCamera(60, ...)` | `60°` |
| Grid size / divisions | `GridHelper(100, 50, ...)` | 100 m, 50 divisions |
| Background colour | `scene.background` | `#0c0d10` |

## Notes and Limitations

- Preloading holds every frame's geometry in memory, so very long sequences may use significant RAM/GPU memory.
- Only the current frame's point cloud is attached to the scene at a time; other cached frames stay detached until shown.
- Frames are preloaded sequentially, so scrubbing far ahead before preloading finishes triggers an on-demand load for that frame.
- Points are shown in the vehicle's local frame, so the ego vehicle stays at the origin and the scene moves around it.
- Parsing is done on the main thread with `fetch`; there is a `TODO` in the code about finding a faster loading approach.

## Dataset and Attribution

This project uses data from the nuScenes dataset by Motional. Please review the [nuScenes terms of use](https://www.nuscenes.org/terms-of-use) before using or redistributing the data.

> H. Caesar et al., "nuScenes: A multimodal dataset for autonomous driving," CVPR 2020.
