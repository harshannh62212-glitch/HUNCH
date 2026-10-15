#!/usr/bin/env node
/**
 * BOM power benchmark (no browser). Loads js/rover_bom.js and prints scenario table.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const bomPath = path.join(__dirname, '..', 'js', 'rover_bom.js');
const code = fs.readFileSync(bomPath, 'utf8');
const sandbox = { globalThis: {}, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const BOM = sandbox.globalThis.NASA_RoverBOM;
if (!BOM || !BOM.benchmarkPowerScenarios) {
  console.error('NASA_RoverBOM not loaded');
  process.exit(1);
}

const report = BOM.benchmarkPowerScenarios();
console.log('=== LLASO rover power benchmark (10 Ah / 128 Wh) ===\n');
console.log('Scenario          | Full W | Eco W | Saved');
console.log('------------------|--------|-------|------');
report.scenarios.forEach(function (r) {
  console.log(
    r.name.padEnd(18) + '|' +
    String(r.wattsFull != null ? r.wattsFull : '—').padStart(7) + ' |' +
    String(r.wattsEco).padStart(6) + ' |' +
    String(r.savedW).padStart(5)
  );
});
console.log('\n=== Four energy modes (90% SOC, 18% reserve) ===');
(report.modes || []).forEach(function (m) {
  console.log(
    m.label.padEnd(8) + '| cruise ~' + String(m.cruiseW).padStart(5) + ' W | ' +
    m.whPerRoundTrip + ' Wh/RT | ~' + m.tripsAt90 + ' trips'
  );
});
console.log('\nUsable Wh from 90%:', BOM.whUsableFromSoc(90), 'Wh');
