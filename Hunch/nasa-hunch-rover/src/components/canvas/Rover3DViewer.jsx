import React, { useRef, useEffect, useState } from 'react';
import { RotateCw, ZoomIn, ZoomOut, Layers, Eye, Compass } from 'lucide-react';

export default function Rover3DViewer() {
  const canvasRef = useRef(null);
  const [rotation, setRotation] = useState({ x: 22, y: 45 });
  const [zoom, setZoom] = useState(1.0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [explodedView, setExplodedView] = useState(false);
  const [activePin, setActivePin] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const pins = [
    { id: 'lidar', label: 'Triple TF-Luna LiDAR', x: 0, y: 40, z: 90, desc: 'Trifocal ToF Rangefinders (+35°/0°/-35°)' },
    { id: 'solar', label: '20W Solar Array', x: 0, y: 70, z: -10, desc: 'Monocrystalline array with MPPT regulation' },
    { id: 'avionics', label: 'UNO R4 Avionics', x: 0, y: 25, z: 10, desc: 'Dual-core RA4M1 + ESP32-S3 + Watchdog' },
    { id: 'battery', label: '30Ah LiFePO4 Battery', x: 0, y: -10, z: -20, desc: '360Wh deep-cycle cell in PETG enclosure' },
    { id: 'motors', label: '6WD 1:31.6 Motors', x: 65, y: -35, z: 0, desc: 'Matched 12V 100RPM high-reduction planetary' },
    { id: 'vents', label: '304 SS Mesh Vents', x: -45, y: 15, z: -30, desc: '37-micron particulate exclusion vents' }
  ];

  useEffect(() => {
    let animId;
    if (autoRotate && !isDragging) {
      const loop = () => {
        setRotation(prev => ({ ...prev, y: (prev.y + 0.4) % 360 }));
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animId);
  }, [autoRotate, isDragging]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Coordinate projection helpers
    const radX = (rotation.x * Math.PI) / 180;
    const radY = (rotation.y * Math.PI) / 180;

    const project = (x, y, z) => {
      // Y-axis rotation
      let x1 = x * Math.cos(radY) - z * Math.sin(radY);
      let z1 = x * Math.sin(radY) + z * Math.cos(radY);

      // X-axis rotation
      let y2 = y * Math.cos(radX) - z1 * Math.sin(radX);
      let z2 = y * Math.sin(radX) + z1 * Math.cos(radX);

      // Perspective projection
      const cameraDistance = 450;
      const perspective = cameraDistance / (cameraDistance + z2);

      const screenX = width / 2 + x1 * perspective * zoom * 1.5;
      const screenY = height / 2 - y2 * perspective * zoom * 1.5;

      return { x: screenX, y: screenY, z: z2, p: perspective };
    };

    // Draw Ground Grid / Mars Regolith Horizon
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.12)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    const gridSize = 160;
    for (let i = -gridSize; i <= gridSize; i += gridStep) {
      const p1 = project(i, -60, -gridSize);
      const p2 = project(i, -60, gridSize);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      const p3 = project(-gridSize, -60, i);
      const p4 = project(gridSize, -60, i);
      ctx.beginPath();
      ctx.moveTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.stroke();
    }

    const explodeMult = explodedView ? 1.6 : 1.0;

    // Helper to draw 3D box
    const drawBox = (cx, cy, cz, w, h, d, strokeColor, fillColor = null) => {
      const hw = w / 2;
      const hh = h / 2;
      const hd = d / 2;

      const vertices = [
        project(cx - hw, cy - hh, cz - hd),
        project(cx + hw, cy - hh, cz - hd),
        project(cx + hw, cy + hh, cz - hd),
        project(cx - hw, cy + hh, cz - hd),
        project(cx - hw, cy - hh, cz + hd),
        project(cx + hw, cy - hh, cz + hd),
        project(cx + hw, cy + hh, cz + hd),
        project(cx - hw, cy + hh, cz + hd),
      ];

      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0], // back
        [4, 5], [5, 6], [6, 7], [7, 4], // front
        [0, 4], [1, 5], [2, 6], [3, 7]  // connecting
      ];

      if (fillColor) {
        // Simple front face fill
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.moveTo(vertices[4].x, vertices[4].y);
        ctx.lineTo(vertices[5].x, vertices[5].y);
        ctx.lineTo(vertices[6].x, vertices[6].y);
        ctx.lineTo(vertices[7].x, vertices[7].y);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      edges.forEach(([i1, i2]) => {
        ctx.beginPath();
        ctx.moveTo(vertices[i1].x, vertices[i1].y);
        ctx.lineTo(vertices[i2].x, vertices[i2].y);
        ctx.stroke();
      });
    };

    // 1. Chassis Body (PETG Main Enclosure)
    drawBox(0, 0, 0, 90, 45, 130, '#06b6d4', 'rgba(6, 182, 212, 0.08)');

    // 2. Battery Bay Compartment
    const batY = -5 * explodeMult;
    drawBox(0, batY, -15, 75, 30, 85, '#f97316', 'rgba(249, 115, 22, 0.15)');

    // 3. Solar Panel Roof Mount
    const solarY = (35 * explodeMult);
    drawBox(0, solarY, 0, 95, 4, 135, '#eab308', 'rgba(234, 179, 8, 0.2)');

    // 4. LiDAR & Sensor Mast
    const mastY = (30 * explodeMult);
    drawBox(0, mastY + 15, 60 * explodeMult, 20, 25, 20, '#22d3ee', 'rgba(34, 211, 238, 0.3)');

    // LiDAR Trifocal Beams Projection Lines
    const mastTop = project(0, mastY + 25, 70 * explodeMult);
    const beamL = project(-50, mastY + 15, 150);
    const beamC = project(0, mastY + 15, 170);
    const beamR = project(50, mastY + 15, 150);

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.setLineDash([4, 4]);
    [beamL, beamC, beamR].forEach(pt => {
      ctx.beginPath();
      ctx.moveTo(mastTop.x, mastTop.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // 5. 6 Wheels (3 on Left, 3 on Right)
    const wheelOffsetsZ = [-50, 0, 50];
    const wheelSideX = 65 * explodeMult;
    const wheelRadius = 18;

    [-1, 1].forEach(side => {
      const x = side * wheelSideX;
      wheelOffsetsZ.forEach(z => {
        const axleStart = project(side * 45, -20, z);
        const axleEnd = project(x, -20, z);

        // Axle shaft
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(axleStart.x, axleStart.y);
        ctx.lineTo(axleEnd.x, axleEnd.y);
        ctx.stroke();

        // Wheel Cylindrical Box
        drawBox(x, -20, z, 14, wheelRadius * 2, wheelRadius * 2, '#f97316', 'rgba(15, 23, 42, 0.8)');
      });
    });

    // 6. Subsystem Marker Pins
    pins.forEach(pin => {
      const pos = project(
        pin.x * (explodedView ? 1.4 : 1.0),
        pin.y * (explodedView ? 1.4 : 1.0),
        pin.z * (explodedView ? 1.4 : 1.0)
      );

      const isSelected = activePin?.id === pin.id;

      // Pin ring
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isSelected ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#ffffff' : '#f97316';
      ctx.fill();
      ctx.strokeStyle = '#070a13';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pulse ring for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Pin Label
      ctx.fillStyle = isSelected ? '#22d3ee' : 'rgba(255, 255, 255, 0.85)';
      ctx.font = '10px monospace';
      ctx.fillText(pin.label, pos.x + 10, pos.y + 3);
    });

  }, [rotation, zoom, explodedView, activePin]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    setRotation(prev => ({
      x: Math.max(-60, Math.min(80, prev.x - dy * 0.5)),
      y: (prev.y + dx * 0.5) % 360
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="bg-space-900 border border-space-700/80 rounded-xl p-4 flex flex-col relative overflow-hidden">
      {/* HUD Controls Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-space-800 gap-2 z-10">
        <div>
          <h3 className="text-sm font-bold font-mono text-white flex items-center">
            <Compass className="w-4 h-4 text-nasa-orange mr-2" />
            3D ORTHOGRAPHIC WIREFRAME SCHEMATIC
          </h3>
          <p className="text-[11px] text-slate-400 font-mono">
            Interactive CAD Assembly • Click & Drag to Orbit • AER-V2 CHRONOS
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2.5 py-1 rounded text-xs font-mono border flex items-center space-x-1.5 transition-colors ${
              autoRotate 
                ? 'bg-nasa-cyan/20 border-nasa-cyan/50 text-nasa-cyan' 
                : 'bg-space-800 border-space-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle Auto Rotation"
          >
            <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">AUTO-ORBIT</span>
          </button>

          <button
            onClick={() => setExplodedView(!explodedView)}
            className={`px-2.5 py-1 rounded text-xs font-mono border flex items-center space-x-1.5 transition-colors ${
              explodedView 
                ? 'bg-nasa-orange/20 border-nasa-orange/50 text-nasa-orange' 
                : 'bg-space-800 border-space-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle Exploded Subsystem View"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EXPLODED</span>
          </button>

          <button
            onClick={() => setZoom(prev => Math.min(1.8, prev + 0.15))}
            className="p-1 rounded bg-space-800 border border-space-700 text-slate-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.6, prev - 0.15))}
            className="p-1 rounded bg-space-800 border border-space-700 text-slate-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        className="relative h-[340px] w-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={650}
          height={340}
          className="w-full h-full object-contain"
        />

        {/* Orientation Tag */}
        <div className="absolute bottom-2 left-2 text-[10px] font-mono text-slate-400 bg-space-950/80 px-2 py-1 rounded border border-space-800">
          ROT: Pitch {rotation.x.toFixed(0)}° / Yaw {rotation.y.toFixed(0)}° | ZOOM: {(zoom * 100).toFixed(0)}%
        </div>
      </div>

      {/* Interactive Subsystem Pins List */}
      <div className="pt-3 border-t border-space-800">
        <div className="text-[11px] font-mono text-slate-400 mb-2 uppercase tracking-wider">
          Click Subsystem Pin to Inspect:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pins.map(pin => (
            <button
              key={pin.id}
              onClick={() => setActivePin(activePin?.id === pin.id ? null : pin)}
              className={`px-2.5 py-1 rounded text-xs font-mono border transition-all ${
                activePin?.id === pin.id
                  ? 'bg-nasa-orange/20 border-nasa-orange text-white shadow-sm shadow-nasa-orange/20'
                  : 'bg-space-800/80 border-space-700 text-slate-300 hover:bg-space-700'
              }`}
            >
              {pin.label}
            </button>
          ))}
        </div>

        {activePin && (
          <div className="mt-2.5 p-2.5 bg-space-950 rounded border border-nasa-orange/40 font-mono text-xs animate-fadeIn">
            <span className="text-nasa-orange font-bold mr-2">[{activePin.label}]:</span>
            <span className="text-slate-300">{activePin.desc}</span>
          </div>
        )}
      </div>
    </div>
  );
}
