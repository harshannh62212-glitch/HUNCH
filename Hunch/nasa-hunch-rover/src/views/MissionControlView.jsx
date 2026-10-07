import React from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { roverSystemOverview } from '../data/roverSpecs';
import TelemetryHUD from '../components/telemetry/TelemetryHUD';
import LidarDisplay from '../components/telemetry/LidarDisplay';
import PowerMonitor from '../components/telemetry/PowerMonitor';
import { 
  Rocket, 
  Cpu, 
  ShieldCheck, 
  ArrowRight, 
  ExternalLink, 
  AlertTriangle,
  Radio,
  Sliders,
  CheckCircle2
} from 'lucide-react';

export default function MissionControlView({ onNavigate }) {
  const { telemetry, hazardInjected, toggleHazard } = useTelemetry();

  return (
    <div className="space-y-6">
      {/* Hero Mission Banner */}
      <div className="relative rounded-2xl bg-gradient-to-br from-space-900 via-space-950 to-space-900 border border-space-700/80 p-6 lg:p-8 overflow-hidden">
        {/* Background aerospace tech grid & glow */}
        <div className="absolute inset-0 tech-grid opacity-25 pointer-events-none"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-nasa-orange/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-nasa-cyan/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-nasa-orange/10 border border-nasa-orange/30 text-nasa-orange text-xs font-mono font-medium mb-4">
            <Rocket className="w-3.5 h-3.5" />
            <span>NASA HUNCH ADVANCED EXPLORATION SYSTEMS</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3 font-sans">
            AER-V2 <span className="text-transparent bg-clip-text bg-gradient-to-r from-nasa-orange via-orange-400 to-nasa-cyan">CHRONOS</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans max-w-3xl mb-6">
            {roverSystemOverview.primaryMission}
          </p>

          {/* Quick Specs Pill Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs mb-6">
            <div className="bg-space-900/90 border border-space-700/70 p-2.5 rounded-lg">
              <span className="text-slate-400 block text-[10px]">MOBILITY</span>
              <strong className="text-white text-sm">6WD High-Torque</strong>
              <span className="text-[10px] block text-nasa-orange">1:31.6 Planetary</span>
            </div>
            <div className="bg-space-900/90 border border-space-700/70 p-2.5 rounded-lg">
              <span className="text-slate-400 block text-[10px]">ENERGY STORAGE</span>
              <strong className="text-white text-sm">360Wh LiFePO4</strong>
              <span className="text-[10px] block text-yellow-400">+20W MPPT Solar</span>
            </div>
            <div className="bg-space-900/90 border border-space-700/70 p-2.5 rounded-lg">
              <span className="text-slate-400 block text-[10px]">FLIGHT COMPUTE</span>
              <strong className="text-white text-sm">UNO R4 WiFi</strong>
              <span className="text-[10px] block text-nasa-green">RA4M1 + ESP32-S3</span>
            </div>
            <div className="bg-space-900/90 border border-space-700/70 p-2.5 rounded-lg">
              <span className="text-slate-400 block text-[10px]">PERCEPTION ARRAY</span>
              <strong className="text-white text-sm">Triple TF-Luna</strong>
              <span className="text-[10px] block text-nasa-cyan">1080P IR-Cut Vision</span>
            </div>
          </div>

          {/* Call-to-actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('subsystems')}
              className="px-5 py-2.5 rounded-lg bg-nasa-orange hover:bg-orange-600 text-white font-medium text-sm flex items-center space-x-2 shadow-lg shadow-nasa-orange/20 transition-all font-mono"
            >
              <span>INSPECT SUBSYSTEMS</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('team-cad')}
              className="px-5 py-2.5 rounded-lg bg-space-800 hover:bg-space-700 border border-space-600 text-slate-200 font-medium text-sm flex items-center space-x-2 transition-all font-mono"
            >
              <span>VIEW 3D CAD & SIMULATION</span>
              <ExternalLink className="w-4 h-4 text-nasa-cyan" />
            </button>

            <button
              onClick={() => onNavigate('engineering-log')}
              className="px-4 py-2.5 rounded-lg bg-space-900 hover:bg-space-800 border border-space-700 text-slate-300 text-sm flex items-center space-x-2 transition-all font-mono"
            >
              <span>FMEA FAILURE LOG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hazard Warning Alert Banner (Visible when active) */}
      {hazardInjected && (
        <div className="p-4 rounded-xl bg-nasa-red/15 border-2 border-nasa-red/70 flex items-center justify-between text-nasa-red font-mono text-xs sm:text-sm animate-pulse">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-nasa-red" />
            <div>
              <strong className="font-bold uppercase tracking-wider block">
                AUTONOMOUS HAZARD RESPONSE ENGAGED (0.38m PROXIMITY)
              </strong>
              <span className="text-slate-300 text-xs">
                Emergency braking interlock tripped. Differential skid torque vectoring to recalculate safe traverse heading.
              </span>
            </div>
          </div>
          <button
            onClick={toggleHazard}
            className="px-3 py-1.5 rounded bg-nasa-red text-white font-bold text-xs uppercase hover:bg-red-700 transition-colors ml-4 whitespace-nowrap"
          >
            CLEAR HAZARD
          </button>
        </div>
      )}

      {/* Telemetry HUD Grid */}
      <TelemetryHUD />

      {/* Ranging Radar & Power Architecture Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LidarDisplay />
        <PowerMonitor />
      </div>

      {/* Mission Subsystem Quick Health Matrix */}
      <div className="bg-space-900/80 border border-space-700/80 rounded-xl p-5">
        <div className="flex items-center justify-between pb-3 border-b border-space-800 mb-4">
          <div className="flex items-center space-x-2 font-mono">
            <ShieldCheck className="w-4 h-4 text-nasa-green" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              SUBSYSTEM FLIGHT READINESS MATRIX
            </h3>
          </div>
          <span className="text-xs font-mono text-nasa-green font-medium">ALL SUBSYSTEMS GREEN</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-space-950 p-3 rounded-lg border border-space-800 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[10px]">AVIONICS & CODE</div>
              <div className="text-white font-bold">UNO R4 WiFi</div>
            </div>
            <div className="flex items-center text-nasa-green text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              NOMINAL
            </div>
          </div>

          <div className="bg-space-950 p-3 rounded-lg border border-space-800 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[10px]">DRIVETRAIN 6WD</div>
              <div className="text-white font-bold">1:31.6 Planetary</div>
            </div>
            <div className="flex items-center text-nasa-green text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              NOMINAL
            </div>
          </div>

          <div className="bg-space-950 p-3 rounded-lg border border-space-800 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[10px]">POWER & SOLAR</div>
              <div className="text-white font-bold">360Wh LiFePO4</div>
            </div>
            <div className="flex items-center text-nasa-green text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              CHARGING
            </div>
          </div>

          <div className="bg-space-950 p-3 rounded-lg border border-space-800 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[10px]">PERCEPTION & OPTICS</div>
              <div className="text-white font-bold">3× ToF + 1080P</div>
            </div>
            <div className="flex items-center text-nasa-green text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              ONLINE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
