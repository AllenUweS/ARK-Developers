"use client";

import { useEffect, useRef } from "react";

export function LiquidEffectAnimation({ imageSrc = "/terra-bg.png" }: { imageSrc?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Load the script dynamically
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `
      import LiquidBackground from 'https://cdn.jsdelivr.net/npm/threejs-components@0.0.22/build/backgrounds/liquid1.min.js';
      
      const canvas = document.getElementById('liquid-canvas');
      if (canvas) {
        const app = LiquidBackground(canvas);
        app.loadImage('${imageSrc}');
        app.liquidPlane.material.metalness = 0.75;
        app.liquidPlane.material.roughness = 0.25;
        app.liquidPlane.uniforms.displacementScale.value = 5;
        app.setRain(false);
        window.__liquidApp = app;
      }
    `;
    document.body.appendChild(script);

    return () => {
      if (window.__liquidApp && window.__liquidApp.dispose) {
        try {
          window.__liquidApp.dispose();
        } catch (e) {
          // ignore cleanup errors
        }
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [imageSrc]);

  return (
    <div
      className="fixed inset-0 m-0 w-full h-full touch-none overflow-hidden"
      style={{ fontFamily: '"Montserrat", serif' }}
    >
      <canvas ref={canvasRef} id="liquid-canvas" className="fixed inset-0 w-full h-full" />
    </div>
  );
}

declare global {
  interface Window {
    __liquidApp?: any;
  }
}
