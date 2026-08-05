import { useEffect, useRef } from "react";
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadNuScenesLidar } from '../utils/lidarParser';

export const LidarViewport = () => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0c0d10);

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        camera.position.set(0, -35, 25);
        camera.up.set(0, 0, 1); // Z is UP for AV data

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.target.set(0, 0, 0);

        const grid = new THREE.GridHelper(100, 50, 0x334155, 0x1e293b);
        grid.rotation.x = Math.PI / 2; // Orient flat on XY plane
        scene.add(grid);

        let pointCloudMesh: THREE.Points | null = null;

        loadNuScenesLidar('/data/lidar-frames/frame-1.pcd.bin')
            .then((points) => {
                pointCloudMesh = points;
                console.log('var points', points)
                scene.add(points);
                console.log('LiDAR point cloud loaded successfully:', points);
            })
            .catch((err) => {
                console.error('Error loading LiDAR file:', err);
            });

        let animationFrameId: number;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (!container) return;
            const newWidth = container.clientWidth || window.innerWidth;
            const newHeight = container.clientHeight || window.innerHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
            if (pointCloudMesh) {
                pointCloudMesh.geometry.dispose();
                (pointCloudMesh.material as THREE.Material).dispose();
            }
            renderer.dispose();
            if (container) {
                container.innerHTML = '';
            }
        }
    }, [])



    return (
        <div
            ref={containerRef}
            style={{
                width: '100vw',
                height: '100vh',
                overflow: 'hidden',
                margin: 0,
                padding: 0,
            }}
        />);
}