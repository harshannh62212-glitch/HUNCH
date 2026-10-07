import React, { useState } from 'react';
import { subsystems } from '../data/roverSpecs';
import { 
  Cpu, 
  Truck, 
  BatteryCharging, 
  Eye, 
  Shield, 
  Layers, 
  CheckCircle2, 
  Wrench, 
  Zap, 
  Share2 
} from 'lucide-react';

const iconMap = {
  Cpu: Cpu,
  Truck: Truck,
  BatteryCharging: BatteryCharging,
  Eye: Eye,
  Shield: Shield
};

export default function SubsystemsView() {
  const [selectedSubsystem, setSelectedSubsystem] = useState(subsystems[0]);

  const CurrentIcon = iconMap[selectedSubsystem.icon] || Cpu;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="bg-space-900 border border-space-700/80 rounded-xl p-6 relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded bg-nasa-cyan/10 border border-nasa-cyan/30 text-nasa-cyan text-xs font-mono mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>PDR / CDR / FDR SYSTEM ARCHITECTURE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-sans text-white">
            Interactive Subsystems Explorer
          </h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Detailed engineering breakdown and component selection rationales for the AER-V2 CHRONOS rover. Click each subsystem below to inspect core components, pinout allocations, and performance benchmarks.
          </p>
        </div>

        {/* Subsystems Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-6 pt-4 border-t border-space-800">
          {subsystems.map((sub) => {
            const Icon = iconMap[sub.icon] || Cpu;
            const isSelected = selectedSubsystem.id === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubsystem(sub)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-space-800 border-nasa-cyan text-white shadow-lg shadow-nasa-cyan/10'
                    : 'bg-space-950/60 border-space-800 text-slate-400 hover:bg-space-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-nasa-cyan' : 'text-slate-400'}`} />
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-nasa-cyan/20 text-nasa-cyan' : 'bg-space-900 text-slate-500'
                  }`}>
                    {sub.badge.split(' ')[0]}
                  </span>
                </div>
                <div className="text-xs font-bold font-mono truncate">{sub.name.split(' ')[0]}</div>
                <div className="text-[10px] text-slate-400 truncate">{sub.badge}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Subsystem Detail Card */}
      <div className="bg-space-900/90 border border-space-700/80 rounded-xl p-6 space-y-6">
        {/* Header of Active Subsystem */}
        <div className="flex flex-wrap items-center justify-between pb-4 border-b border-space-800 gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-space-800 border border-nasa-cyan/40 flex items-center justify-center text-nasa-cyan">
              <CurrentIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold font-mono text-white">
                  {selectedSubsystem.name}
                </h3>
                <span className="px-2 py-0.5 rounded bg-nasa-orange/20 border border-nasa-orange/40 text-nasa-orange text-xs font-mono">
                  {selectedSubsystem.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Responsible: <span className="text-slate-300">{selectedSubsystem.leadEngineer}</span>
              </p>
            </div>
          </div>

          {/* Quick Technical Highlights */}
          <div className="flex flex-wrap gap-2">
            {selectedSubsystem.technicalHighlights.map((tech, idx) => (
              <div key={idx} className="bg-space-950 px-2.5 py-1 rounded border border-space-800 text-[11px] font-mono">
                <span className="text-slate-400">{tech.label}: </span>
                <strong className="text-nasa-cyan">{tech.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Executive Summary */}
        <div className="p-4 bg-space-950/80 rounded-lg border border-space-800 font-mono text-xs text-slate-300 leading-relaxed">
          <span className="text-nasa-orange font-bold uppercase mr-2">[ARCHITECTURE SUMMARY]:</span>
          {selectedSubsystem.summary}
        </div>

        {/* Core Components & Engineering Rationale */}
        <div>
          <h4 className="text-sm font-bold font-mono text-white uppercase tracking-wider mb-3 flex items-center">
            <Wrench className="w-4 h-4 text-nasa-orange mr-2" />
            Hardware Components & Engineering Rationale
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {selectedSubsystem.coreComponents.map((comp, idx) => (
              <div key={idx} className="bg-space-950 border border-space-700/70 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold font-mono text-white mb-1">
                    {comp.part}
                  </div>
                  <div className="text-[11px] font-mono text-nasa-cyan mb-2">
                    {comp.spec}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                    ROLE: <span className="text-slate-200">{comp.role}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans pt-2 border-t border-space-800">
                    {comp.rationale}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-space-800/80 flex items-center text-[10px] font-mono text-nasa-green">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  <span>NASA HUNCH PDR/CDR VERIFIED</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pinout & Electrical Allocation Matrix */}
        <div>
          <h4 className="text-sm font-bold font-mono text-white uppercase tracking-wider mb-3 flex items-center">
            <Zap className="w-4 h-4 text-nasa-cyan mr-2" />
            Interface Pinout & Bus Signal Allocation
          </h4>

          <div className="bg-space-950 rounded-xl border border-space-800 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-space-800 text-slate-400 border-b border-space-700">
                <tr>
                  <th className="p-3">SIGNAL / PIN CHANNEL</th>
                  <th className="p-3">FUNCTION & BUS PROTOCOL</th>
                  <th className="p-3">ISOLATION / ELECTRICAL DOMAIN</th>
                  <th className="p-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-space-800 text-slate-300">
                {selectedSubsystem.pinoutDiagram.map((pin, idx) => (
                  <tr key={idx} className="hover:bg-space-900/50">
                    <td className="p-3 font-bold text-white whitespace-nowrap">{pin.pin}</td>
                    <td className="p-3">{pin.usage}</td>
                    <td className="p-3 text-nasa-cyan">
                      {selectedSubsystem.id === 'drivetrain' ? '12V Power Bus' : '5V Isolated Logic'}
                    </td>
                    <td className="p-3 text-nasa-green">
                      <span className="flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-nasa-green mr-1.5"></span>
                        ROUTED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
