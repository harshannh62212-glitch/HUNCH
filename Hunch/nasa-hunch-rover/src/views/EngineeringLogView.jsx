import React, { useState } from 'react';
import { failureLogs } from '../data/failureLog';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  ArrowRight, 
  ShieldAlert,
  Search,
  Filter
} from 'lucide-react';

export default function EngineeringLogView() {
  const [selectedLog, setSelectedLog] = useState(failureLogs[0]);
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const filteredLogs = filterSeverity === 'ALL' 
    ? failureLogs 
    : failureLogs.filter(log => log.severity.includes(filterSeverity));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-space-900 border border-space-700/80 rounded-xl p-6 relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded bg-nasa-orange/10 border border-nasa-orange/30 text-nasa-orange text-xs font-mono mb-2">
            <FileText className="w-3.5 h-3.5" />
            <span>NASA-STD FMEA ITERATION LOG</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-sans text-white">
            Engineering Notebook & Failure Log
          </h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Rigorous flight certification demands transparent documentation of hardware failures, root-cause investigations, and verified design resolutions. Below is our team's NASA-standard Non-Conformance Report (NCR) logbook.
          </p>
        </div>

        {/* Severity Filter Badges */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-space-800 font-mono text-xs">
          <span className="text-slate-400 py-1 flex items-center">
            <Filter className="w-3.5 h-3.5 mr-1" />
            SEVERITY:
          </span>
          {['ALL', 'CRITICAL', 'HIGH', 'MODERATE'].map(sev => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1 rounded border transition-all ${
                filterSeverity === sev
                  ? 'bg-nasa-orange/20 border-nasa-orange text-white font-bold'
                  : 'bg-space-950 border-space-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Failure List + Detailed FMEA Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List of Failure Reports */}
        <div className="lg:col-span-5 space-y-3">
          {filteredLogs.map(log => {
            const isSelected = selectedLog.id === log.id;
            const isCritical = log.severity.includes('CRITICAL');
            const isHigh = log.severity.includes('HIGH');

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-space-800 border-nasa-orange shadow-lg shadow-nasa-orange/10'
                    : 'bg-space-900/80 border-space-800 hover:bg-space-850 hover:border-space-700'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-xs mb-1.5">
                  <span className="font-bold text-nasa-orange">{log.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isCritical 
                      ? 'bg-nasa-red/20 text-nasa-red border border-nasa-red/40' 
                      : isHigh 
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' 
                      : 'bg-nasa-cyan/20 text-nasa-cyan border border-nasa-cyan/40'
                  }`}>
                    {log.severity.split(' ')[0]}
                  </span>
                </div>

                <div className="text-sm font-bold text-white font-mono line-clamp-2">
                  {log.title}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2.5 pt-2 border-t border-space-800">
                  <span>{log.subsystem}</span>
                  <span className="text-nasa-green flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {log.status.split(' ')[0]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Dossier View */}
        <div className="lg:col-span-7 bg-space-900 border border-space-700/80 rounded-xl p-6 space-y-5">
          {/* Header */}
          <div className="border-b border-space-800 pb-4">
            <div className="flex items-center justify-between font-mono text-xs text-slate-400 mb-1">
              <span>REPORT DESIGNATION: <strong className="text-nasa-orange">{selectedLog.id}</strong></span>
              <span>DATE: <strong className="text-slate-200">{selectedLog.dateDiscovered}</strong></span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold font-mono text-white mt-1">
              {selectedLog.title}
            </h3>
            <div className="flex flex-wrap gap-2 mt-2 font-mono text-xs">
              <span className="bg-space-950 px-2 py-0.5 rounded border border-space-800 text-slate-300">
                Subsystem: {selectedLog.subsystem}
              </span>
              <span className="bg-nasa-green/20 text-nasa-green px-2 py-0.5 rounded border border-nasa-green/30 font-semibold">
                {selectedLog.status}
              </span>
            </div>
          </div>

          {/* 1. Observable Symptom */}
          <div>
            <h4 className="text-xs font-mono uppercase text-slate-400 font-bold mb-1.5 flex items-center">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mr-1.5" />
              1. Observed Failure Symptom
            </h4>
            <div className="p-3 bg-space-950 rounded-lg border border-space-800 text-xs font-mono text-slate-300 leading-relaxed">
              {selectedLog.symptom}
            </div>
          </div>

          {/* 2. Root Cause Analysis */}
          <div>
            <h4 className="text-xs font-mono uppercase text-slate-400 font-bold mb-1.5 flex items-center">
              <HelpCircle className="w-3.5 h-3.5 text-nasa-cyan mr-1.5" />
              2. Engineering Root Cause Analysis
            </h4>
            <div className="p-3 bg-space-950 rounded-lg border border-nasa-cyan/30 text-xs font-mono text-slate-300 leading-relaxed">
              {selectedLog.rootCauseAnalysis}
            </div>
          </div>

          {/* 3. Corrective Redesign Actions */}
          <div>
            <h4 className="text-xs font-mono uppercase text-slate-400 font-bold mb-1.5 flex items-center">
              <ShieldAlert className="w-3.5 h-3.5 text-nasa-orange mr-1.5" />
              3. Implemented Corrective Redesign (Action Items)
            </h4>
            <div className="bg-space-950 rounded-lg border border-space-800 p-3 space-y-2 font-mono text-xs">
              {selectedLog.correctiveAction.map((action, i) => (
                <div key={i} className="flex items-start space-x-2 text-slate-200">
                  <ArrowRight className="w-3.5 h-3.5 text-nasa-orange flex-shrink-0 mt-0.5" />
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Verification & Validation */}
          <div className="p-3.5 bg-nasa-green/10 rounded-lg border border-nasa-green/40 font-mono text-xs">
            <div className="text-nasa-green font-bold uppercase mb-1 flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              4. Verification & Validation Results
            </div>
            <p className="text-slate-300 leading-relaxed">
              {selectedLog.verificationMethod}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
