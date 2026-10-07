import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { Battery, Sun, Zap, ShieldCheck, ArrowRight, Activity } from 'lucide-react';

export default function PowerMonitor() {
  const { telemetry } = useTelemetry();

  // Estimate remaining autonomy
  const usableCapacityWh = 360;
  const currentDrawWatts = telemetry.batteryPower;
  const solarGenWatts = telemetry.solarPower;
  const netPowerDraw = Math.max(1.0, currentDrawWatts - solarGenWatts);
  const remainingHours = (usableCapacityWh * (telemetry.batterySOC / 100)) / (currentDrawWatts > 0 ? currentDrawWatts : 15);

  return (
    <div className="bg-space-900/90 border border-space-700/80 rounded-xl p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-space-800">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-nasa-orange/20 text-nasa-orange">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-mono text-white tracking-wide">
              POWER BUS & ISOLATED DISTRIBUTION
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              360Wh LiFePO4 + 20W MPPT Solar + Dual 5A Isolated Bucks
            </p>
          </div>
        </div>

        <div className="text-right font-mono">
          <span className="text-xs text-nasa-cyan font-bold">
            ~{remainingHours.toFixed(1)} HRS
          </span>
          <span className="text-[10px] block text-slate-400">AUTONOMY REMAIN</span>
        </div>
      </div>

      {/* Power Flow Diagram */}
      <div className="py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Source 1: LiFePO4 Battery */}
          <div className="bg-space-950 border border-space-700 p-3 rounded-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
              <span className="flex items-center text-nasa-orange font-bold">
                <Battery className="w-4 h-4 mr-1.5" />
                ECO-WORTHY LiFePO4
              </span>
              <span className="text-[10px] text-nasa-green font-semibold">NOMINAL</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              12.8V / 30Ah
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              360Wh Deep Cycle | Low Internal R | Flat Plateau
            </p>
            <div className="mt-2 text-xs font-mono flex justify-between text-slate-300 pt-1.5 border-t border-space-800">
              <span>VOLTAGE: <strong className="text-white">{telemetry.batteryVoltage}V</strong></span>
              <span>SOC: <strong className="text-nasa-cyan">{telemetry.batterySOC}%</strong></span>
            </div>
          </div>

          {/* Source 2: Solar Array with MPPT */}
          <div className="bg-space-950 border border-space-700 p-3 rounded-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
              <span className="flex items-center text-yellow-400 font-bold">
                <Sun className="w-4 h-4 mr-1.5" />
                20W SOLAR HARVESTER
              </span>
              <span className="text-[10px] text-yellow-400 font-semibold">96.8% MPPT</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {telemetry.solarPower} W
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Monocrystalline | 21.6V Voc | Smart Solar Tracking
            </p>
            <div className="mt-2 text-xs font-mono flex justify-between text-slate-300 pt-1.5 border-t border-space-800">
              <span>OUTPUT: <strong className="text-white">{telemetry.solarVoltage.toFixed(1)}V</strong></span>
              <span>CURRENT: <strong className="text-yellow-400">{telemetry.solarCurrent}A</strong></span>
            </div>
          </div>

          {/* Dual Isolated Buck Regulators */}
          <div className="bg-space-950 border border-nasa-cyan/40 p-3 rounded-lg relative">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
              <span className="flex items-center text-nasa-cyan font-bold">
                <ShieldCheck className="w-4 h-4 mr-1.5" />
                DUAL ISOLATED BUCKS
              </span>
              <span className="text-[10px] text-nasa-cyan font-semibold">1500V ISO</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              5.0V / 2×5A
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Eliminates motor reverse-EMF transients into MCU
            </p>
            <div className="mt-2 text-xs font-mono flex justify-between text-slate-300 pt-1.5 border-t border-space-800">
              <span>RAIL A (MCU): <strong className="text-nasa-green">{telemetry.railA5V}V</strong></span>
              <span>RAIL B (SENS): <strong className="text-nasa-green">{telemetry.railB5V}V</strong></span>
            </div>
          </div>
        </div>

        {/* Isolation Architecture Schematic Callout */}
        <div className="mt-3 p-3 bg-space-950/60 rounded-lg border border-space-800 font-mono text-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-slate-300 font-semibold flex items-center">
              <Activity className="w-3.5 h-3.5 text-nasa-cyan mr-1.5" />
              GALVANIC NOISE MITIGATION STRATEGY
            </span>
            <span className="text-[10px] text-nasa-green">EMI / EMC COMPLIANT</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            By dedicating <strong>Rail A (5V 5A Isolated)</strong> exclusively to the Arduino UNO R4 WiFi and IMU, and <strong>Rail B (5V 5A Isolated)</strong> to the TF-Luna LiDAR and UVC camera, inductive voltage surges from the 6WD 12V motor H-bridges are physically isolated. This prevents voltage sag brownouts and preserves non-blocking telemetry streaming.
          </p>
        </div>
      </div>
    </div>
  );
}
