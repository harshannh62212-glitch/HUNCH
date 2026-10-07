import React from 'react';
import { missionMilestones } from '../data/roadmap';
import { 
  Milestone, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Award, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';

export default function RoadmapView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-space-900 border border-space-700/80 rounded-xl p-6 relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded bg-nasa-cyan/10 border border-nasa-cyan/30 text-nasa-cyan text-xs font-mono mb-2">
            <Milestone className="w-3.5 h-3.5" />
            <span>DESIGN REVIEW CADENCE & MILESTONES</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-sans text-white">
            Mission Roadmap & Flight Certification
          </h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            NASA HUNCH formal design review progression: From initial kinematic feasibility at Preliminary Design Review (PDR), through hardware build at Critical Design Review (CDR), to environmental reliability torture testing and Final Design Review (FDR).
          </p>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-6 pt-4 border-t border-space-800 font-mono">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>OVERALL CERTIFICATION READINESS</span>
            <strong className="text-nasa-cyan">88% (ON SCHEDULE FOR FDR)</strong>
          </div>
          <div className="w-full bg-space-950 h-2.5 rounded-full overflow-hidden border border-space-700">
            <div 
              className="h-full bg-gradient-to-r from-nasa-orange via-yellow-400 to-nasa-cyan rounded-full"
              style={{ width: '88%' }}
            />
          </div>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="space-y-6">
        {missionMilestones.map((milestone, idx) => {
          const isComplete = milestone.status === 'COMPLETE';
          const isInProgress = milestone.status === 'IN PROGRESS';

          return (
            <div 
              key={idx}
              className={`bg-space-900 border rounded-xl p-6 transition-all ${
                isInProgress 
                  ? 'border-nasa-cyan/60 shadow-lg shadow-nasa-cyan/10' 
                  : isComplete 
                  ? 'border-space-700/80' 
                  : 'border-space-800 opacity-80'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-space-800">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm ${
                    isComplete 
                      ? 'bg-nasa-green/20 text-nasa-green border border-nasa-green/40'
                      : isInProgress
                      ? 'bg-nasa-cyan/20 text-nasa-cyan border border-nasa-cyan/40 animate-pulse'
                      : 'bg-space-800 text-slate-400 border border-space-700'
                  }`}>
                    0{idx + 1}
                  </div>

                  <div>
                    <span className="text-xs font-mono text-nasa-orange font-bold">
                      {milestone.phase}
                    </span>
                    <h3 className="text-lg font-bold font-mono text-white">
                      {milestone.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center space-x-3 font-mono text-xs">
                  <span className="flex items-center text-slate-400">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    {milestone.date}
                  </span>

                  <span className={`px-2.5 py-1 rounded font-bold uppercase ${
                    isComplete 
                      ? 'bg-nasa-green/20 text-nasa-green border border-nasa-green/40'
                      : isInProgress
                      ? 'bg-nasa-cyan/20 text-nasa-cyan border border-nasa-cyan/40'
                      : 'bg-space-800 text-slate-400 border border-space-700'
                  }`}>
                    {milestone.status}
                  </span>
                </div>
              </div>

              {/* Body Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* Objectives */}
                <div>
                  <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Key Objectives & Requirements:
                  </h4>
                  <ul className="space-y-1.5 font-mono text-xs text-slate-300">
                    {milestone.objectives.map((obj, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <ArrowRight className="w-3.5 h-3.5 text-nasa-cyan flex-shrink-0 mt-0.5" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Key Deliverables & Review Score */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Delivered Engineering Artifacts:
                    </h4>
                    <ul className="space-y-1.5 font-mono text-xs text-slate-300">
                      {milestone.keyDeliverables.map((deliv, i) => (
                        <li key={i} className="flex items-start space-x-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-nasa-green flex-shrink-0 mt-0.5" />
                          <span>{deliv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-space-950 rounded-lg border border-space-800 font-mono text-xs">
                    <div className="text-slate-400 text-[10px] uppercase">Review Outcome / Assessment:</div>
                    <div className="text-nasa-cyan font-bold mt-0.5">{milestone.score}</div>
                    <p className="text-slate-400 text-[11px] mt-1">{milestone.outcomes}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
