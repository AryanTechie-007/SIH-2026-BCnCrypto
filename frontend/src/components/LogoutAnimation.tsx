import React, { useEffect, useRef, useState } from 'react';
import { LogOut, ArrowRight, Volume2, VolumeX } from 'lucide-react';

interface LogoutAnimationProps {
  onComplete: () => void;
  durationMs?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  gravity?: number;
}

interface CannonBall {
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  radius: number;
  trail: { x: number; y: number; alpha: number }[];
  hit: boolean;
  fireDelay: number; // in seconds
  fired: boolean;
  impactType: 'hull' | 'mast' | 'stern';
}

export const LogoutAnimation: React.FC<LogoutAnimationProps> = ({
  onComplete,
  durationMs = 5200
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showText, setShowText] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play synthetic naval sound effects using Web Audio API
  const playCannonBoom = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state === 'suspended') {
        ctx?.resume();
      }
      if (!ctx) return;

      // Deep cannon boom with decaying low-pass noise & sub-bass punch
      const duration = 1.2;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.25));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      // Low sine punch
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.4);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.6, ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      noise.start();
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio not supported or blocked by browser policy
    }
  };

  const playSplashSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const duration = 0.8;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.35));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch {
      // Audio blocked or error
    }
  };

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / durationMs) * 100));
      setProgressPercent(pct);
      if (elapsed > 1800) {
        setShowText(true);
      }
      if (elapsed >= durationMs) {
        clearInterval(interval);
        onComplete();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [durationMs, onComplete]);

  // Main Canvas Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initial positions
    const waterLevel = height * 0.72;
    const shipWidth = Math.min(320, width * 0.38);
    const shipHeight = shipWidth * 0.52;
    let shipX = width * 0.58;
    let shipY = waterLevel - shipHeight * 0.42;
    let shipAngle = 0;
    let shipSinkY = 0;
    let shipHits = 0;
    let mastBroken = false;

    // Cannon Batteries on left
    const cannonX = Math.max(40, width * 0.1);
    const cannonY = waterLevel - 20;

    // Cannonball trajectories
    const cannonBalls: CannonBall[] = [
      {
        x: cannonX,
        y: cannonY - 30,
        startX: cannonX,
        startY: cannonY - 30,
        targetX: shipX - shipWidth * 0.2,
        targetY: shipY - 10,
        progress: 0,
        speed: 1.6,
        radius: 7,
        trail: [],
        hit: false,
        fireDelay: 0.35,
        fired: false,
        impactType: 'hull'
      },
      {
        x: cannonX + 25,
        y: cannonY - 15,
        startX: cannonX + 25,
        startY: cannonY - 15,
        targetX: shipX + 5,
        targetY: shipY - shipHeight * 0.65,
        progress: 0,
        speed: 1.8,
        radius: 6,
        trail: [],
        hit: false,
        fireDelay: 0.85,
        fired: false,
        impactType: 'mast'
      },
      {
        x: cannonX - 15,
        y: cannonY - 45,
        startX: cannonX - 15,
        startY: cannonY - 45,
        targetX: shipX + shipWidth * 0.22,
        targetY: shipY - 15,
        progress: 0,
        speed: 1.7,
        radius: 7,
        trail: [],
        hit: false,
        fireDelay: 1.35,
        fired: false,
        impactType: 'stern'
      }
    ];

    const particles: Particle[] = [];
    const waterSplashes: Particle[] = [];
    const bubbles: Particle[] = [];

    // Background stars
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * width,
      y: Math.random() * (waterLevel * 0.85),
      size: Math.random() * 1.5 + 0.5,
      twinkle: Math.random() * Math.PI * 2
    }));

    let startTime = performance.now();
    let shakeAmount = 0;

    const createExplosion = (x: number, y: number, count = 35) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 1.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          radius: Math.random() * 3.5 + 1.5,
          color: ['#ff4400', '#ff8800', '#ffcc00', '#ffffff', '#888888', '#38bdf8'][Math.floor(Math.random() * 6)],
          alpha: 1,
          decay: Math.random() * 0.03 + 0.015,
          gravity: 0.12
        });
      }
    };

    const createWaterSplash = (x: number, y: number, count = 25) => {
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
        const speed = Math.random() * 7 + 2;
        waterSplashes.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 3 + 1.5,
          color: '#38bdf8',
          alpha: 0.9,
          decay: Math.random() * 0.025 + 0.02,
          gravity: 0.22
        });
      }
    };

    const createBubbles = (x: number, y: number) => {
      for (let i = 0; i < 4; i++) {
        bubbles.push({
          x: x + (Math.random() - 0.5) * shipWidth * 0.7,
          y: y + Math.random() * 20,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -(Math.random() * 1.5 + 0.8),
          radius: Math.random() * 2.5 + 1,
          color: '#7dd3fc',
          alpha: 0.7,
          decay: 0.008
        });
      }
    };

    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000;

      // Handle screen shake
      ctx.save();
      if (shakeAmount > 0) {
        const sx = (Math.random() - 0.5) * shakeAmount;
        const sy = (Math.random() - 0.5) * shakeAmount;
        ctx.translate(sx, sy);
        shakeAmount *= 0.88;
        if (shakeAmount < 0.2) shakeAmount = 0;
      }

      // Clear Screen with deep tactical ocean night gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, waterLevel);
      skyGrad.addColorStop(0, '#030712');
      skyGrad.addColorStop(0.65, '#08142b');
      skyGrad.addColorStop(1, '#0c1e3d');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw stars
      ctx.fillStyle = '#ffffff';
      stars.forEach(s => {
        const alpha = 0.4 + 0.5 * Math.sin(elapsed * 2 + s.twinkle);
        ctx.globalAlpha = alpha;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });
      ctx.globalAlpha = 1;

      // Moonlight glow on horizon
      const moonGrad = ctx.createRadialGradient(width * 0.75, waterLevel * 0.4, 10, width * 0.75, waterLevel * 0.4, 280);
      moonGrad.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
      moonGrad.addColorStop(0.6, 'rgba(30, 58, 138, 0.05)');
      moonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = moonGrad;
      ctx.fillRect(0, 0, width, waterLevel);

      // Draw Cannon Batteries on the Left Coast
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, waterLevel + 10);
      ctx.lineTo(cannonX + 60, waterLevel - 15);
      ctx.lineTo(cannonX + 40, waterLevel + 150);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Cannon Barrels
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';

      [cannonY - 30, cannonY - 15, cannonY - 45].forEach((cy, idx) => {
        ctx.beginPath();
        ctx.moveTo(cannonX - 25, cy + 12);
        ctx.lineTo(cannonX + 20, cy - 6);
        ctx.stroke();

        // Cannon Carriage Wheel
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(cannonX - 10, cy + 12, 10, 0, Math.PI * 2);
        ctx.fill();
      });

      // Update & Draw Cannon Balls
      cannonBalls.forEach((cb) => {
        if (elapsed >= cb.fireDelay && !cb.fired) {
          cb.fired = true;
          playCannonBoom();
          shakeAmount = 14;

          // Muzzle flash particles
          createExplosion(cb.startX + 25, cb.startY - 8, 20);
        }

        if (cb.fired && !cb.hit) {
          cb.progress += 0.018 * cb.speed;
          if (cb.progress >= 1) {
            cb.progress = 1;
            cb.hit = true;
            shipHits++;
            shakeAmount = 18;

            if (cb.impactType === 'mast') {
              mastBroken = true;
            }

            playCannonBoom();
            playSplashSound();
            createExplosion(cb.targetX, cb.targetY, 45);
            createWaterSplash(cb.targetX, waterLevel, 35);
          }

          // Ballistic Arc (Parabola)
          const p = cb.progress;
          const currentX = cb.startX + (cb.targetX - cb.startX) * p;
          const heightArc = Math.sin(p * Math.PI) * 110;
          const currentY = cb.startY + (cb.targetY - cb.startY) * p - heightArc;
          cb.x = currentX;
          cb.y = currentY;

          // Trail
          cb.trail.push({ x: currentX, y: currentY, alpha: 0.9 });
          if (cb.trail.length > 14) cb.trail.shift();

          // Draw Trail
          cb.trail.forEach((t, i) => {
            ctx.fillStyle = `rgba(255, ${Math.floor(100 + i * 10)}, 0, ${t.alpha * (i / cb.trail.length)})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, cb.radius * (i / cb.trail.length), 0, Math.PI * 2);
            ctx.fill();
            t.alpha *= 0.94;
          });

          // Draw Glowing Iron Ball
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(currentX, currentY, cb.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ff9900';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      });

      // Ship Sinking Physics
      if (shipHits >= 1) {
        // Start listing and taking on water
        shipAngle = Math.min(0.55, shipAngle + 0.0035 * shipHits);
        shipSinkY += 0.45 * shipHits;

        // Emit smoke & fire from damaged ship
        if (Math.random() < 0.6) {
          particles.push({
            x: shipX + (Math.random() - 0.5) * shipWidth * 0.4,
            y: shipY + shipSinkY - 20,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -(Math.random() * 2.5 + 1.2),
            radius: Math.random() * 8 + 4,
            color: Math.random() > 0.4 ? 'rgba(30, 41, 59, 0.7)' : 'rgba(239, 68, 68, 0.8)',
            alpha: 0.85,
            decay: 0.015
          });
        }

        // Bubbles around sinking hull
        if (shipSinkY > 20 && Math.random() < 0.5) {
          createBubbles(shipX, waterLevel + 10);
        }
      } else {
        // Gentle ship floating bob
        shipAngle = Math.sin(elapsed * 2.2) * 0.04;
        shipSinkY = Math.sin(elapsed * 2.5) * 4;
      }

      // Render Ship
      ctx.save();
      ctx.translate(shipX, shipY + shipSinkY);
      ctx.rotate(shipAngle);

      // Ship Hull
      const hw = shipWidth / 2;
      const hh = shipHeight / 2;

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(-hw, -hh * 0.1);
      ctx.lineTo(hw * 0.85, -hh * 0.1);
      ctx.lineTo(hw, -hh * 0.35); // Bow sprits
      ctx.lineTo(hw * 0.75, hh * 0.75); // Keel bow
      ctx.lineTo(-hw * 0.75, hh * 0.75); // Keel stern
      ctx.lineTo(-hw * 0.95, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Portholes / Armor plates
      ctx.fillStyle = '#38bdf8';
      [-hw * 0.6, -hw * 0.3, 0, hw * 0.3, hw * 0.6].forEach(px => {
        ctx.beginPath();
        ctx.arc(px, hh * 0.25, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Deck cabins / bridge superstructure
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-hw * 0.45, -hh * 0.6, hw * 0.85, hh * 0.5);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(-hw * 0.45, -hh * 0.6, hw * 0.85, hh * 0.5);

      // Radar tower / Antennas
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -hh * 0.6);
      ctx.lineTo(0, -hh * 1.05);
      ctx.moveTo(-15, -hh * 0.85);
      ctx.lineTo(15, -hh * 0.85);
      ctx.stroke();

      // Masts & Sails (Classic Naval / Cyber-Vessel crossover)
      const mastHeight = hh * 1.5;
      if (!mastBroken) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3.5;
        // Main Mast
        ctx.beginPath();
        ctx.moveTo(hw * 0.1, -hh * 0.5);
        ctx.lineTo(hw * 0.1, -mastHeight);
        ctx.stroke();

        // Yardarms
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hw * 0.1 - 35, -mastHeight * 0.7);
        ctx.lineTo(hw * 0.1 + 35, -mastHeight * 0.7);
        ctx.moveTo(hw * 0.1 - 25, -mastHeight * 0.9);
        ctx.lineTo(hw * 0.1 + 25, -mastHeight * 0.9);
        ctx.stroke();

        // Flag
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(hw * 0.1, -mastHeight);
        ctx.lineTo(hw * 0.1 - 22, -mastHeight + 6);
        ctx.lineTo(hw * 0.1, -mastHeight + 12);
        ctx.closePath();
        ctx.fill();
      } else {
        // Broken / Snapped Mast falling back
        ctx.save();
        ctx.translate(hw * 0.1, -hh * 0.5);
        ctx.rotate(0.9);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -mastHeight * 0.8);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore(); // Restore from ship transformation

      // Water Waves Layer (Rendered over the lower part of the ship for realistic sinking submergence)
      const renderWater = (offsetY: number, color: string, speedMult: number, waveHeight: number) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, waterLevel + offsetY);

        for (let x = 0; x <= width; x += 15) {
          const waveY = Math.sin(x * 0.015 + elapsed * 2.8 * speedMult) * waveHeight
                      + Math.cos(x * 0.03 + elapsed * 1.5) * (waveHeight * 0.5);
          ctx.lineTo(x, waterLevel + offsetY + waveY);
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      };

      // Back Water Wave
      renderWater(-8, 'rgba(12, 74, 110, 0.75)', 0.8, 7);
      // Mid Water Wave
      renderWater(4, 'rgba(8, 47, 73, 0.88)', 1.1, 10);

      // Render Particles (Explosions & Smoke)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.gravity) p.vy += p.gravity;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Water Splashes
      for (let i = waterSplashes.length - 1; i >= 0; i--) {
        const ws = waterSplashes[i];
        ws.x += ws.vx;
        ws.y += ws.vy;
        if (ws.gravity) ws.vy += ws.gravity;
        ws.alpha -= ws.decay;

        if (ws.alpha <= 0 || ws.y > height) {
          waterSplashes.splice(i, 1);
          continue;
        }

        ctx.fillStyle = ws.color;
        ctx.globalAlpha = ws.alpha;
        ctx.beginPath();
        ctx.arc(ws.x, ws.y, ws.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Rising Bubbles
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.x += b.vx + Math.sin(b.y * 0.1) * 0.4;
        b.y += b.vy;
        b.alpha -= b.decay;

        if (b.alpha <= 0 || b.y < waterLevel - 10) {
          bubbles.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = b.alpha;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // Forefront Cresting Water Wave
      renderWater(16, '#030712', 1.3, 11);

      // Foam Line
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 12) {
        const waveY = Math.sin(x * 0.015 + elapsed * 3.64) * 11
                    + Math.cos(x * 0.03 + elapsed * 1.5) * 5.5;
        if (x === 0) ctx.moveTo(x, waterLevel + 16 + waveY);
        else ctx.lineTo(x, waterLevel + 16 + waveY);
      }
      ctx.stroke();

      ctx.restore(); // Restore from screen shake
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [soundEnabled]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        userSelect: 'none',
        overflow: 'hidden'
      }}
    >
      {/* Background Interactive Animation Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1
        }}
      />

      {/* Top Header Controls */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 32px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              boxShadow: '0 0 10px #ef4444'
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#94a3b8'
            }}
          >
            CIPHERTRACE TERMINATION SEQUENCE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Sound Toggle Button */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: soundEnabled ? '#38bdf8' : '#64748b',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono, monospace)',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.15s ease'
            }}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>{soundEnabled ? 'FX ON' : 'MUTED'}</span>
          </button>

          {/* Skip Button */}
          <button
            onClick={onComplete}
            style={{
              backgroundColor: 'rgba(37, 99, 235, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.45)',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-sans, sans-serif)',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.35)';
              e.currentTarget.style.borderColor = '#3b82f6';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.45)';
            }}
          >
            <span>Skip to Login</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Center "Logged Out" Dramatic Typography */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          maxWidth: '680px',
          padding: '0 20px',
          opacity: showText ? 1 : 0,
          transform: showText ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.95)',
          transition: 'all 0.75s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            padding: '6px 14px',
            borderRadius: '20px',
            marginBottom: '16px',
            backdropFilter: 'blur(8px)'
          }}
        >
          <LogOut size={13} color="#ef4444" />
          <span
            style={{
              color: '#f87171',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase'
            }}
          >
            Tactical Disconnect Confirmed
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(42px, 7vw, 68px)',
            fontWeight: 900,
            letterSpacing: '0.04em',
            lineHeight: 1.1,
            margin: '0 0 16px 0',
            color: '#ffffff',
            textShadow: '0 0 35px rgba(56, 189, 248, 0.5), 0 0 70px rgba(37, 99, 235, 0.3)',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-sans, sans-serif)'
          }}
        >
          Logged Out.
        </h1>

        <p
          style={{
            fontSize: '15px',
            color: '#94a3b8',
            lineHeight: 1.6,
            maxWidth: '520px',
            margin: '0 auto 28px auto',
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.02em'
          }}
        >
          Vessel neutralized and sunk. Cryptographic keystores purged from active memory.
        </p>

        {/* Progress Bar */}
        <div
          style={{
            width: '280px',
            height: '4px',
            backgroundColor: 'rgba(30, 41, 59, 0.8)',
            borderRadius: '2px',
            margin: '0 auto',
            overflow: 'hidden',
            border: '1px solid rgba(56, 189, 248, 0.2)'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: '#38bdf8',
              boxShadow: '0 0 8px #38bdf8',
              transition: 'width 0.05s linear'
            }}
          />
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          textAlign: 'center',
          padding: '24px',
          color: '#64748b',
          fontSize: '11px',
          fontFamily: 'var(--font-mono, monospace)',
          letterSpacing: '0.08em'
        }}
      >
        <span>STATUS: ALL SESSIONS PURGED // RETURNING TO SECURE HARBOR</span>
      </div>
    </div>
  );
};
