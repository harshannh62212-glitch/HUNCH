import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { 
  Zap, 
  Sun, 
  Compass, 
  Gauge, 
  Activity, 
  Cpu, 
  ShieldAlert, 
  CheckCircle2, 
  Thermometer,
  Wifi
} from 'lucide-react';

export default function TelemetryHUD() {
  const { telemetry } = useTelemetry();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Card 1: Power Architecture */}
      <div className="bg-space-900/80 border border-space-700/70 rounded-lg p-3.5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <Zap className="w-4 h-4 text-nasa-orange" />
            <span className="uppercase tracking-wider">Primary Bus (LiFePO4)</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-space-800 text-nasa-orange border border-nasa-orange/30">
            30Ah / 360Wh
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div>
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {telemetry.batteryVoltage.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1">VDC</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold font-mono text-nasa-cyan">
              {telemetry.batterySOC.toFixed(1)}%
            </span>
            <span className="text-[10px] block font-mono text-slate-400">SOC REMAIN</span>
          </div>
        </div>

        {/* Battery SOC progress bar */}
        <div className="w-full bg-space-800 h-1.5 rounded-full mt-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-nasa-orange to-nasa-cyan rounded-full transition-all duration-500"
            style={{ width: `${telemetry.batterySOC}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-space-800 text-[11px] font-mono text-slate-400">
          <div>DRAIN: <span className="text-slate-200">{telemetry.batteryCurrent} A</span></div>
          <div>POWER: <span className="text-slate-200">{telemetry.batteryPower} W</span></div>
        </div>
      </div>

      {/* Card 2: Solar Harvesting & Isolation */}
      <div className="bg-space-900/80 border border-space-700/70 rounded-lg p-3.5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <Sun className="w-4 h-4 text-yellow-400" />
            <span className="uppercase tracking-wider">20W Solar Array</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-space-800 text-yellow-400 border border-yellow-400/30">
            MPPT ACTIVE
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div>
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {telemetry.solarPower.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1">W</span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold font-mono text-slate-200">
              {telemetry.solarVoltage.toFixed(1)}V / {telemetry.solarCurrent}A
            </span>
            <span className="text-[10px] block font-mono text-slate-400">SOLAR FLUX</span>
          </div>
        </div>

        {/* MPPT Efficiency indicator */}
        <div className="w-full bg-space-800 h-1.5 rounded-full mt-2 overflow-hidden">
          <div 
            className="h-full bg-yellow-400 rounded-full transition-all duration-500"
            style={{ width: `${(telemetry.solarPower / 20) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-space-800 text-[11px] font-mono text-slate-400">
          <div>LOGIC 5V: <span className="text-nasa-green">{telemetry.railA5V}V</span></div>
          <div>SENSORS 5V: <span className="text-nasa-green">{telemetry.railB5V}V</span></div>
        </div>
      </div>

      {/* Card 3: 6WD Propulsion & Kinematics */}
      <div className="bg-space-900/80 border border-space-700/70 rounded-lg p-3.5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <Gauge className="w-4 h-4 text-nasa-cyan" />
            <span className="uppercase tracking-wider">6WD Drivetrain (1:31.6)</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-space-800 text-nasa-cyan border border-nasa-cyan/30">
            {telemetry.speed > 0 ? "TRAVERSING" : "HOLD"}
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div>
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {telemetry.speed.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1">m/s</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold font-mono text-slate-200">
              L:{telemetry.motorLeftRpm} | R:{telemetry.motorRightRpm}
            </span>
            <span className="text-[10px] block font-mono text-slate-400">RPM WHEEL SPEED</span>
          </div>
        </div>

        {/* Speed visualization bar */}
        <div className="w-full bg-space-800 h-1.5 rounded-full mt-2 overflow-hidden">
          <div 
            className="h-full bg-nasa-cyan rounded-full transition-all duration-300"
            style={{ width: `${(telemetry.speed / 0.5) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-space-800 text-[11px] font-mono text-slate-400">
          <div className="flex items-center space-x-1">
            <Thermometer className="w-3 h-3 text-slate-400" />
            <span>DRV: <strong className="text-slate-200">{telemetry.motorDriverTemp}°C</strong></span>
          </div>
          <div>TORQUE: <span className="text-slate-200">{telemetry.motorCurrentAggregate}A (Nom)</span></div>
        </div>
      </div>

      {/* Card 4: Avionics & Flight Watchdog */}
      <div className="bg-space-900/80 border border-space-700/70 rounded-lg p-3.5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <Cpu className="w-4 h-4 text-nasa-green" />
            <span className="uppercase tracking-wider">UNO R4 RA4M1</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-nasa-green/20 text-nasa-green border border-nasa-green/40 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-nasa-green animate-pulse"></span>
            <span>WDT: OK</span>
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div>
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {telemetry.loopLatencyMs}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1">ms</span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold font-mono text-nasa-cyan">
              #{telemetry.watchdogHeartbeat}
            </span>
            <span className="text-[10px] block font-mono text-slate-400">HEARTBEAT PING</span>
          </div>
        </div>

        <div className="w-full bg-space-800 h-1.5 rounded-full mt-2 overflow-hidden">
          <div 
            className="h-full bg-nasa-green rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (15 / telemetry.loopLatencyMs) * 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-space-800 text-[11px] font-mono text-slate-400">
          <div className="flex items-center space-x-1">
            <Wifi className="w-3 h-3 text-slate-400" />
            <span>ESP32: <span className="text-slate-200">{telemetry.wifiRssi} dBm</span></span>
          </div>
          <div>CORE: <span className="text-slate-200">{telemetry.mcuTemp}°C</span></div>
        </div>
      </div>
    </div>
  );
}
