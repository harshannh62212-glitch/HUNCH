import React, { useState, useEffect } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { 
  Activity, 
  Cpu, 
  FileText, 
  Milestone, 
  Box, 
  Play, 
  Pause, 
  AlertTriangle, 
  Radio, 
  ShieldCheck,
  Clock
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { telemetry, isRunning, setIsRunning, missionTime, formatMET, hazardInjected, toggleHazard } = useTelemetry();
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateUtc = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().split(' ')[4] + ' UTC');
    };
    updateUtc();
    const interval = setInterval(updateUtc, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'mission-control', label: 'Mission Control', icon: Activity },
    { id: 'subsystems', label: 'Subsystems Explorer', icon: Cpu },
    { id: 'engineering-log', label: 'Failure Log (FMEA)', icon: FileText },
    { id: 'roadmap', label: 'Mission Roadmap', icon: Milestone },
    { id: 'team-cad', label: 'Team & CAD 3D', icon: Box },
  ];

  return (
    <header className="sticky top-0 z-50 bg-space-950/90 backdrop-blur-md border-b border-space-700/80">
      {/* Top flight classification banner */}
      <div className="bg-space-900 px-4 py-1 flex items-center justify-between text-xs font-mono text-slate-400 border-b border-space-800">
        <div className="flex items-center space-x-3">
          <span className="flex items-center text-nasa-orange font-semibold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-nasa-orange animate-ping mr-2"></span>
            NASA HUNCH FLIGHT DEMONSTRATOR
          </span>
          <span className="hidden md:inline text-space-500">|</span>
          <span className="hidden md:inline text-slate-400">DESIGNATION: <strong className="text-slate-200">AER-V2 CHRONOS</strong></span>
          <span className="hidden lg:inline text-space-500">|</span>
          <span className="hidden lg:inline text-slate-400">TARGET: <span className="text-nasa-cyan">PDR / CDR / FDR REVIEWS</span></span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-nasa-cyan" />
            <span className="text-nasa-cyan font-bold">{formatMET(missionTime)}</span>
            <span className="text-space-500">/</span>
            <span>{utcTime}</span>
          </div>

          <div className="flex items-center space-x-1.5 pl-2 border-l border-space-700">
            <ShieldCheck className="w-3.5 h-3.5 text-nasa-green" />
            <span className="text-nasa-green font-medium uppercase text-[11px]">WDT OK</span>
          </div>
        </div>
      </div>

      {/* Main navigation toolbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & insignia */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('mission-control')}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-nasa-orange to-space-900 p-0.5 shadow-lg shadow-nasa-orange/20 flex items-center justify-center">
              <div className="w-full h-full bg-space-950 rounded-[7px] flex items-center justify-center border border-nasa-orange/40">
                <Radio className="w-5 h-5 text-nasa-orange" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-lg font-bold tracking-tight text-white font-mono">NASA</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-nasa-orange/20 text-nasa-orange border border-nasa-orange/30">HUNCH</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono tracking-wider">AER-V2 AUTONOMOUS ROVER</p>
            </div>
          </div>

          {/* Nav buttons */}
          <nav className="hidden md:flex space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-xs lg:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-space-800 text-nasa-cyan border border-nasa-cyan/40 shadow-sm shadow-nasa-cyan/10 font-mono'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-space-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-nasa-cyan' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Telemetry control actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-mono border transition-colors ${
                isRunning 
                  ? 'bg-space-800 border-space-600 text-slate-300 hover:bg-space-700'
                  : 'bg-nasa-green/20 border-nasa-green/50 text-nasa-green hover:bg-nasa-green/30'
              }`}
              title={isRunning ? "Pause Telemetry Stream" : "Resume Telemetry Stream"}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5 text-nasa-cyan" /> : <Play className="w-3.5 h-3.5 text-nasa-green" />}
              <span className="hidden sm:inline">{isRunning ? "PAUSE FEED" : "RESUME FEED"}</span>
            </button>

            <button
              onClick={toggleHazard}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-mono border transition-all ${
                hazardInjected
                  ? 'bg-nasa-red/20 border-nasa-red text-nasa-red animate-pulse'
                  : 'bg-space-800/80 border-nasa-orange/40 text-nasa-orange hover:bg-nasa-orange/10'
              }`}
              title="Inject obstacle hazard to test autonomous avoidance response"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{hazardInjected ? "HAZARD ACTIVE" : "INJECT HAZARD"}</span>
            </button>
          </div>
        </div>

        {/* Mobile navigation row */}
        <div className="md:hidden flex overflow-x-auto space-x-2 py-2 border-t border-space-800 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 whitespace-nowrap px-2.5 py-1 rounded text-xs font-medium ${
                  isActive
                    ? 'bg-space-800 text-nasa-cyan border border-nasa-cyan/40 font-mono'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
