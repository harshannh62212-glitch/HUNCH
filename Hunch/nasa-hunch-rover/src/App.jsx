import React, { useState } from 'react';
import { TelemetryProvider } from './context/TelemetryContext';
import Navbar from './components/layout/Navbar';
import MissionControlView from './views/MissionControlView';
import SubsystemsView from './views/SubsystemsView';
import EngineeringLogView from './views/EngineeringLogView';
import RoadmapView from './views/RoadmapView';
import TeamCadView from './views/TeamCadView';
import { Radio, ShieldAlert } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('mission-control');

  return (
    <TelemetryProvider>
      <div className="min-h-screen bg-space-950 text-slate-100 flex flex-col font-sans selection:bg-nasa-orange/30 selection:text-nasa-orange">
        {/* Navigation Bar */}
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === 'mission-control' && (
            <MissionControlView onNavigate={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === 'subsystems' && <SubsystemsView />}
          {activeTab === 'engineering-log' && <EngineeringLogView />}
          {activeTab === 'roadmap' && <RoadmapView />}
          {activeTab === 'team-cad' && <TeamCadView />}
        </main>

        {/* Mission Control Engineering Footer */}
        <footer className="border-t border-space-800 bg-space-900/80 backdrop-blur font-mono text-xs text-slate-400 py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-1 rounded bg-nasa-orange/10 border border-nasa-orange/30 text-nasa-orange">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-200">NASA HUNCH AER-V2 'CHRONOS' DEMONSTRATOR</div>
                <div className="text-[10px] text-slate-500">Autonomous Planetary Exploration Rover • High School Students Creating Hardware with NASA</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              <span>REVIEWS: <strong className="text-nasa-cyan">PDR (✓) / CDR (✓) / FDR (APR 2026)</strong></span>
              <span className="text-space-700">|</span>
              <span>MCU: <strong className="text-slate-300">RA4M1 + ESP32-S3</strong></span>
              <span className="text-space-700">|</span>
              <span className="text-nasa-green">TELEMETRY LOOP NOMINAL</span>
            </div>
          </div>
        </footer>
      </div>
    </TelemetryProvider>
  );
}
