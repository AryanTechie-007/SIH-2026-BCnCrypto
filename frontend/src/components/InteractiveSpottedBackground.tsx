import React, { useEffect, useRef } from 'react';

interface InteractiveSpottedBackgroundProps {
  gap?: number;
  baseRadius?: number;
  proximity?: number;
  glowRadius?: number;
}

interface Dot {
  x0: number;
  y0: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

export const InteractiveSpottedBackground: React.FC<InteractiveSpottedBackgroundProps> = ({
  gap = 26,
  baseRadius = 1.3,
  proximity = 170,
  glowRadius = 260
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;
    let dots: Dot[] = [];

    // Mouse coordinates
    let mouseX = -9999;
    let mouseY = -9999;
    let targetMouseX = -9999;
    let targetMouseY = -9999;
    let isMouseActive = false;

    const initGrid = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);

      // Create dot grid
      const newDots: Dot[] = [];
      const cols = Math.ceil(width / gap) + 1;
      const rows = Math.ceil(height / gap) + 1;

      // Center the grid slightly
      const offsetX = (width - (cols - 1) * gap) / 2;
      const offsetY = (height - (rows - 1) * gap) / 2;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x0 = offsetX + c * gap;
          const y0 = offsetY + r * gap;
          newDots.push({
            x0,
            y0,
            x: x0,
            y: y0,
            vx: 0,
            vy: 0,
            radius: baseRadius,
            alpha: 0.28
          });
        }
      }
      dots = newDots;
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      isMouseActive = true;
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      targetMouseX = clientX;
      targetMouseY = clientY;

      // Initialize mouse instantly if starting from off-screen
      if (mouseX < -1000) {
        mouseX = targetMouseX;
        mouseY = targetMouseY;
      }
    };

    const handlePointerLeave = () => {
      isMouseActive = false;
      targetMouseX = -9999;
      targetMouseY = -9999;
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('resize', initGrid);

    initGrid();

    // Physics parameters
    const spring = 0.08;
    const damping = 0.82;
    const pushStrength = 14;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse movement
      if (isMouseActive) {
        mouseX += (targetMouseX - mouseX) * 0.18;
        mouseY += (targetMouseY - mouseY) * 0.18;
      } else {
        mouseX += (-9999 - mouseX) * 0.1;
        mouseY += (-9999 - mouseY) * 0.1;
      }

      // Draw interactive ambient radial glow spotlight behind spots
      if (mouseX > -500 && mouseX < width + 500 && mouseY > -500 && mouseY < height + 500) {
        const spotlight = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, glowRadius);
        spotlight.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
        spotlight.addColorStop(0.4, 'rgba(56, 189, 248, 0.08)');
        spotlight.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = spotlight;
        ctx.fillRect(0, 0, width, height);
      }

      // Draw baseline background subtle gradient at center
      const centerGlow = ctx.createRadialGradient(width / 2, height * 0.25, 0, width / 2, height * 0.25, width * 0.6);
      centerGlow.addColorStop(0, 'rgba(37, 99, 235, 0.08)');
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, width, height);

      // Update and draw spots
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        // Compute distance from mouse
        const dx = dot.x0 - mouseX;
        const dy = dot.y0 - mouseY;
        const distSq = dx * dx + dy * dy;
        const proxSq = proximity * proximity;

        let targetX = dot.x0;
        let targetY = dot.y0;
        let targetRadius = baseRadius;
        let targetAlpha = 0.25;
        let rColor = 37;
        let gColor = 99;
        let bColor = 235;

        if (distSq < proxSq) {
          const dist = Math.sqrt(distSq);
          const factor = Math.max(0, 1 - dist / proximity); // 1 at mouse, 0 at outer boundary
          const easeFactor = factor * factor; // Non-linear falloff for natural feel

          // Push dot away from mouse
          const angle = Math.atan2(dy, dx);
          const push = easeFactor * pushStrength;
          targetX = dot.x0 + Math.cos(angle) * push;
          targetY = dot.y0 + Math.sin(angle) * push;

          // Scale radius and alpha
          targetRadius = baseRadius + easeFactor * 1.6;
          targetAlpha = 0.3 + easeFactor * 0.65;

          // Transition color towards vibrant cyan/sky-blue
          rColor = Math.round(37 + easeFactor * (56 - 37));
          gColor = Math.round(99 + easeFactor * (189 - 99));
          bColor = Math.round(235 + easeFactor * (248 - 235));
        }

        // Spring physics towards target
        const ax = (targetX - dot.x) * spring;
        const ay = (targetY - dot.y) * spring;
        dot.vx = (dot.vx + ax) * damping;
        dot.vy = (dot.vy + ay) * damping;
        dot.x += dot.vx;
        dot.y += dot.vy;

        dot.radius += (targetRadius - dot.radius) * 0.2;
        dot.alpha += (targetAlpha - dot.alpha) * 0.2;

        // Render dot
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rColor}, ${gColor}, ${bColor}, ${dot.alpha.toFixed(3)})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('resize', initGrid);
    };
  }, [gap, baseRadius, proximity, glowRadius]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
};
