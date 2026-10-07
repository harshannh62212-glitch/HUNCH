import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { Radio, AlertOctagon, Eye, Compass, Video } from 'lucide-react';

export default function LidarDisplay() {
  const { telemetry, hazardInjected } = useTelemetry();

  // Calculation for radar arc visual representation
  const maxRange = 6.0; // 6 meters max for HUD
  const getRadarX = (angleDeg, dist) => {
    // 0 deg is straight up (90 deg in cartesian)
    const rad = ((90 - angleDeg) * Math.PI) / 180;
    const normalized = Math.min(dist / maxRange, 1.0);
    return 150 + Math.cos(rad) * (normalized * 120);
  };

  const getRadarY = (angleDeg, dist) => {
    const rad = ((90 - angleDeg) * Math.PI) / 180;
    const normalized = Math.min(dist / maxRange, 1.0);
    return 160 - Math.sin(rad) * (normalized * 120);
  };

  const leftPt = {
    x: getRadarX(telemetry.lidarLeft.angle, telemetry.lidarLeft.distance),
    y: getRadarY(telemetry.lidarLeft.angle, telemetry.lidarLeft.distance),
  };

  const centerPt = {
    x: getRadarX(telemetry.lidarCenter.angle, telemetry.lidarCenter.distance),
    y: getRadarY(telemetry.lidarCenter.angle, telemetry.lidarCenter.distance),
  };

  const rightPt = {
    x: getRadarX(telemetry.lidarRight.angle, telemetry.lidarRight.distance),
    y: getRadarY(telemetry.lidarRight.angle, telemetry.lidarRight.distance),
  };

  return (
    <div className="bg-space-900/90 border border-space-700/80 rounded-xl p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-space-800">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-nasa-cyan/20 text-nasa-cyan">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-mono text-white tracking-wide">
              TRIPLE TF-LUNA LiDAR RADAR
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              850nm ToF Trifocal Ranging (+35° / 0° / -35°)
            </p>
          </div>
        </div>

        {telemetry.collisionAlert ? (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-nasa-red/20 border border-nasa-red text-nasa-red font-mono text-xs animate-pulse">
            <AlertOctagon className="w-4 h-4" />
            <span>BRAKE INTERLOCK</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-space-800 border border-space-600 text-nasa-cyan font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-nasa-cyan animate-ping"></span>
            <span>PATH CLEAR</span>
          </div>
        )}
      </div>

      {/* Main Radar SVG + Camera HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 py-4 flex-1 items-center">
        {/* Polar Radar Visualizer */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative">
          <svg viewBox="0 0 300 200" className="w-full max-w-[340px] drop-shadow-md">
            <defs>
              <radialGradient id="radarGlow" cx="50%" cy="80%" r="70%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0b0f19" stopOpacity="0.0" />
              </radialGradient>
              <linearGradient id="beamLeft" x1="0%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
              </linearGradient>
            </defs>

            {/* Radar Field Arc */}
            <path
              d="M 30 160 A 120 120 0 0 1 270 160 L 150 160 Z"
              fill="url(#radarGlow)"
              stroke="#1f293d"
              strokeWidth="1.5"
            />

            {/* Distance Grid Rings (1m, 2m, 4m, 6m) */}
            <path d="M 120 160 A 30 30 0 0 1 180 160" fill="none" stroke="#2e3a54" strokeWidth="1" strokeDasharray="3,3" />
            <path d="M 90 160 A 60 60 0 0 1 210 160" fill="none" stroke="#2e3a54" strokeWidth="1" strokeDasharray="3,3" />
            <path d="M 60 160 A 90 90 0 0 1 240 160" fill="none" stroke="#2e3a54" strokeWidth="1" strokeDasharray="3,3" />
            <path d="M 30 160 A 120 120 0 0 1 270 160" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.4" />

            {/* Critical Emergency Stop Radius (0.45m ~ 10px) */}
            <path d="M 135 160 A 15 15 0 0 1 165 160" fill="none" stroke="#ef4444" strokeWidth="2" />
            <text x="170" y="152" fill="#ef4444" fontSize="8" fontFamily="monospace">0.45m BRAKE</text>

            {/* Angular Division Lines */}
            {/* Center (0 deg) */}
            <line x1="150" y1="160" x2="150" y2="40" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="4,4" />
            {/* Left (+35 deg) */}
            <line x1="150" y1="160" x2={getRadarX(35, 6.0)} y2={getRadarY(35, 6.0)} stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="4,4" />
            {/* Right (-35 deg) */}
            <line x1="150" y1="160" x2={getRadarX(-35, 6.0)} y2={getRadarY(-35, 6.0)} stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="4,4" />

            {/* Active Beams to Detected Targets */}
            {/* Left Beam */}
            <line x1="150" y1="160" x2={leftPt.x} y2={leftPt.y} stroke="#06b6d4" strokeWidth="2" strokeOpacity="0.8" />
            <circle cx={leftPt.x} cy={leftPt.y} r={telemetry.lidarLeft.distance < 0.6 ? 5 : 4} fill={telemetry.lidarLeft.distance < 0.6 ? "#ef4444" : "#06b6d4"} />
            
            {/* Center Beam */}
            <line x1="150" y1="160" x2={centerPt.x} y2={centerPt.y} stroke={telemetry.lidarCenter.distance < 0.6 ? "#ef4444" : "#f97316"} strokeWidth="2.5" />
            <circle cx={centerPt.x} cy={centerPt.y} r={telemetry.lidarCenter.distance < 0.6 ? 6 : 4} fill={telemetry.lidarCenter.distance < 0.6 ? "#ef4444" : "#f97316"} />
            
            {/* Right Beam */}
            <line x1="150" y1="160" x2={rightPt.x} y2={rightPt.y} stroke="#06b6d4" strokeWidth="2" strokeOpacity="0.8" />
            <circle cx={rightPt.x} cy={rightPt.y} r={telemetry.lidarRight.distance < 0.6 ? 5 : 4} fill={telemetry.lidarRight.distance < 0.6 ? "#ef4444" : "#06b6d4"} />

            {/* Rover Base Indicator */}
            <polygon points="144,166 156,166 150,154" fill="#f97316" />
            <circle cx="150" cy="160" r="4" fill="#ffffff" />
          </svg>

          {/* Distance Labels below visualizer */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[340px] text-center font-mono mt-1">
            <div className={`p-1.5 rounded border ${telemetry.lidarLeft.distance < 0.6 ? 'bg-nasa-red/20 border-nasa-red text-nasa-red' : 'bg-space-800 border-space-700 text-slate-300'}`}>
              <div className="text-[10px] text-slate-400">LEFT (+35°)</div>
              <div className="text-sm font-bold">{telemetry.lidarLeft.distance.toFixed(2)} m</div>
              <div className="text-[9px] text-slate-400">Amp: {telemetry.lidarLeft.amp}</div>
            </div>

            <div className={`p-1.5 rounded border ${telemetry.lidarCenter.distance < 0.6 ? 'bg-nasa-red/20 border-nasa-red text-nasa-red animate-pulse' : 'bg-space-800 border-nasa-orange/40 text-nasa-orange'}`}>
              <div className="text-[10px] text-slate-400">CENTER (0°)</div>
              <div className="text-sm font-bold">{telemetry.lidarCenter.distance.toFixed(2)} m</div>
              <div className="text-[9px] text-slate-400">Amp: {telemetry.lidarCenter.amp}</div>
            </div>

            <div className={`p-1.5 rounded border ${telemetry.lidarRight.distance < 0.6 ? 'bg-nasa-red/20 border-nasa-red text-nasa-red' : 'bg-space-800 border-space-700 text-slate-300'}`}>
              <div className="text-[10px] text-slate-400">RIGHT (-35°)</div>
              <div className="text-sm font-bold">{telemetry.lidarRight.distance.toFixed(2)} m</div>
              <div className="text-[9px] text-slate-400">Amp: {telemetry.lidarRight.amp}</div>
            </div>
          </div>
        </div>

        {/* Vision & IMU Side Panel */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          {/* Simulated InnoMaker 1080P Vision Feed HUD */}
          <div className="bg-space-950 border border-space-700/80 rounded-lg p-2.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-mono mb-1.5 text-slate-400">
              <span className="flex items-center text-nasa-orange">
                <Video className="w-3.5 h-3.5 mr-1" />
                INNOMAKER 1080P UVC
              </span>
              <span className="text-nasa-green text-[10px] px-1 py-0.5 rounded bg-nasa-green/10 border border-nasa-green/30">
                AUTO IR-CUT ACTIVE
              </span>
            </div>

            {/* Camera Viewport Canvas/Graphic */}
            <div className="relative h-28 bg-space-900 rounded border border-space-800 overflow-hidden flex items-center justify-center">
              {/* Simulated Horizon line and crosshairs */}
              <div className="absolute inset-0 tech-grid opacity-30"></div>
              <div className="w-12 h-12 border border-nasa-cyan/40 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-nasa-cyan rounded-full"></div>
              </div>
              <div className="absolute top-2 left-2 text-[10px] font-mono text-nasa-cyan/80">
                1920×1080 @ 30 FPS
              </div>
              <div className="absolute bottom-2 right-2 text-[10px] font-mono text-slate-400">
                EXP: AUTO | FOV: 120°
              </div>
              {/* Obstacle box if hazard is active */}
              {telemetry.collisionAlert && (
                <div className="absolute w-20 h-16 border-2 border-nasa-red bg-nasa-red/10 rounded flex items-center justify-center animate-pulse">
                  <span className="text-[10px] font-mono font-bold text-nasa-red bg-space-950 px-1">
                    OBSTACLE 0.38m
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bosch BNO055 9-DOF IMU Kinematics */}
          <div className="bg-space-800/60 border border-space-700/60 rounded-lg p-2.5 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="flex items-center text-nasa-cyan">
                <Compass className="w-3.5 h-3.5 mr-1" />
                BNO055 SENSOR FUSION
              </span>
              <span className="text-[10px] text-slate-400">QUATERNION ATTITUDE</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-space-900 p-1.5 rounded border border-space-800">
                <div className="text-[10px] text-slate-400">HEADING</div>
                <div className="text-white font-bold text-sm">{telemetry.heading}°</div>
              </div>
              <div className="bg-space-900 p-1.5 rounded border border-space-800">
                <div className="text-[10px] text-slate-400">PITCH</div>
                <div className="text-white font-bold text-sm">{telemetry.pitch > 0 ? `+${telemetry.pitch}` : telemetry.pitch}°</div>
              </div>
              <div className="bg-space-900 p-1.5 rounded border border-space-800">
                <div className="text-[10px] text-slate-400">ROLL</div>
                <div className="text-white font-bold text-sm">{telemetry.roll > 0 ? `+${telemetry.roll}` : telemetry.roll}°</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
