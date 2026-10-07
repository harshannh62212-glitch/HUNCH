(function (global) {
  var CSV_HEADER =
    't_sec,x,z,yaw_deg,vel_mps,turn_vel_rad_s,steer_cmd,throttle,dist_goal_m,' +
    'in_terrain_block,auto_on,neural_on,controller,' +
    'slip,slip_ratio,motor_cmd_frac,traction_lim_mps2,lunar_sink_cm,turn_radius_m,pit_clear_m,' +
    'payload_kg,bay_count,depot_kg,logistics_state\n';

  function summarizeRows(rows) {
    if (!rows.length) return null;
    var slipSamples = 0;
    var maxSlipRatio = 0;
    var maxMotorCmd = 0;
    var maxSink = 0;
    var minTurnR = Infinity;
    var minPitClear = Infinity;
    var maxVel = 0;
    var dist = 0;
    var prev = null;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.slip) slipSamples++;
      if (r.slipRatio > maxSlipRatio) maxSlipRatio = r.slipRatio;
      if (r.motorCmdFrac > maxMotorCmd) maxMotorCmd = r.motorCmdFrac;
      if (r.sinkCm > maxSink) maxSink = r.sinkCm;
      if (r.turnRadius > 0 && r.turnRadius < minTurnR) minTurnR = r.turnRadius;
      if (r.pitClear >= 0 && r.pitClear < minPitClear) minPitClear = r.pitClear;
      if (r.vel > maxVel) maxVel = r.vel;
      if (prev) {
        dist += Math.hypot(r.x - prev.x, r.z - prev.z);
      }
      prev = r;
    }
    return {
      sample_count: rows.length,
      duration_sec: parseFloat(rows[rows.length - 1].t) - parseFloat(rows[0].t),
      distance_m: +dist.toFixed(2),
      slip_event_fraction: +(slipSamples / rows.length).toFixed(4),
      max_slip_ratio: +maxSlipRatio.toFixed(4),
      max_motor_cmd_fraction: +maxMotorCmd.toFixed(4),
      max_lunar_sink_cm: +maxSink.toFixed(2),
      min_turn_radius_m: minTurnR === Infinity ? null : +minTurnR.toFixed(3),
      min_pit_clearance_m: minPitClear === Infinity ? null : +minPitClear.toFixed(3),
      peak_speed_mps: +maxVel.toFixed(3),
      bench_torque_stall_target_kg_cm: 35,
      bench_torque_note:
        'Sim motor_cmd_frac maps to commanded accel vs motor limit; on hardware verify stall ≥35 kg·cm at 12V per hardware_specification_sheet.md',
    };
  }

  global.NASA_Telemetry = {
    rows: [],
    maxRows: 18000,
    recording: false,
    simTime: 0,

    start: function () {
      this.rows = [];
      this.recording = true;
      this.simTime = 0;
    },

    stop: function () {
      this.recording = false;
    },

    tick: function (sample) {
      if (!this.recording) return;
      this.rows.push(sample);
      if (this.rows.length > this.maxRows) this.rows.shift();
    },

    summarize: function () {
      return summarizeRows(this.rows);
    },

    exportCsv: function () {
      if (!this.rows.length) {
        alert('No telemetry rows — click LOG TELEMETRY first, drive, then export.');
        return;
      }
      var lines = this.rows.map(function (r) {
        return [
          r.t,
          r.x,
          r.z,
          r.yaw,
          r.vel,
          r.turnVel,
          r.steer,
          r.throttle,
          r.distGoal,
          r.inBlock ? 1 : 0,
          r.autoOn ? 1 : 0,
          r.neuralOn ? 1 : 0,
          r.controller,
          r.slip ? 1 : 0,
          r.slipRatio,
          r.motorCmdFrac,
          r.tractionLim,
          r.sinkCm,
          r.turnRadius,
          r.pitClear,
          r.payloadKg != null ? r.payloadKg : '',
          r.bayCount != null ? r.bayCount : '',
          r.depotKg != null ? r.depotKg : '',
          r.logState || '',
        ].join(',');
      });
      var blob = new Blob([CSV_HEADER + lines.join('\n')], { type: 'text/csv' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download =
        'rover_telemetry_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    },

    exportMetricsJson: function () {
      if (!this.rows.length) {
        alert('No telemetry rows — record a mission first.');
        return;
      }
      var summary = summarizeRows(this.rows);
      var payload = {
        exported_at: new Date().toISOString(),
        project: 'LLASO-P1-AMR-2026',
        source: 'nasa-llaso-cad/viewer.html',
        summary: summary,
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download =
        'sim_metrics_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      return payload;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
