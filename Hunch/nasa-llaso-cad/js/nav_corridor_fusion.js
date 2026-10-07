/**
 * Fuses mastcam + LiDAR rock context into A* / Pure Pursuit commands.
 * Loaded after autonomy_stack.js; does not replace ONNX / VLM layers.
 */
(function (global) {
  var BREATH_M = 0.34;
  var GAP_SYMMETRY = 0.55;
  var GAP_MIN_WIDTH = 0.92;
  var EARLY_M = 14;

  function roverRadius() {
    return typeof global.ROVER_RADIUS === 'number' ? global.ROVER_RADIUS : 0.44;
  }

  function analyzeCorridor(p, yaw, rockData) {
    var R = roverRadius();
    var want = R + BREATH_M;
    var fx = Math.cos(yaw);
    var fz = -Math.sin(yaw);
    var lx = -fz;
    var lz = fx;
    var aheadList = [];
    var i;
    for (i = 0; i < rockData.length; i++) {
      var rk = rockData[i];
      var dx = rk.x - p.x;
      var dz = rk.z - p.z;
      var ahead = dx * fx + dz * fz;
      var side = dx * lx + dz * lz;
      if (ahead < 1.0 || ahead > 32) continue;
      if (Math.abs(side) > 6.5) continue;
      var clr = typeof global.rockSurfaceClearance === 'function'
        ? global.rockSurfaceClearance(rk.x, rk.z)
        : Math.hypot(dx, dz) - rk.r;
      aheadList.push({
        ahead: ahead,
        side: side,
        r: rk.r,
        clr: clr,
        x: rk.x,
        z: rk.z,
      });
    }
    aheadList.sort(function (a, b) {
      return a.ahead - b.ahead;
    });

    var centerClr = typeof global.forwardCorridorMinClear === 'function'
      ? global.forwardCorridorMinClear(p, yaw, 5.5)
      : 99;
    var nearest = centerClr;
    var mode = 'clear';
    var steerBias = 0;
    var replan = false;

    if (centerClr < want + 1.4) {
      mode = centerClr < R + 0.08 ? 'block' : 'tight';
    }
    replan = centerClr < R + 0.02;

    var bestGap = null;
    for (i = 0; i < aheadList.length; i++) {
      for (var j = i + 1; j < aheadList.length; j++) {
        var a = aheadList[i];
        var b = aheadList[j];
        if (a.side * b.side >= -0.05) continue;
        if (Math.abs(a.ahead - b.ahead) > 3.2) continue;
        var gapW = Math.abs(b.side - a.side) - a.r - b.r;
        if (gapW < GAP_MIN_WIDTH) continue;
        var sym = Math.abs(Math.abs(a.side) - Math.abs(b.side));
        if (sym > GAP_SYMMETRY * (Math.abs(a.side) + Math.abs(b.side) + 0.4)) continue;
        var gapCenter = (a.side + b.side) * 0.5;
        var score = gapW * 2 - sym - Math.abs(gapCenter) * 0.35 + (26 - Math.min(a.ahead, b.ahead)) * 0.02;
        if (!bestGap || score > bestGap.score) {
          bestGap = { score: score, centerSide: gapCenter, ahead: Math.min(a.ahead, b.ahead), width: gapW };
        }
      }
    }

    if (bestGap && bestGap.ahead > 2.5 && (mode === 'clear' || mode === 'tight')) {
      mode = 'gap';
      steerBias = Math.max(-0.42, Math.min(0.42, bestGap.centerSide * 0.22));
      if (Math.abs(bestGap.centerSide) < 0.25) steerBias *= 0.35;
    } else if (mode === 'block' || mode === 'tight') {
      var leftClr = 0;
      var rightClr = 0;
      for (i = 0; i < aheadList.length; i++) {
        var ar = aheadList[i];
        if (ar.ahead > 7) continue;
        if (ar.side > 0.2) leftClr += ar.clr;
        if (ar.side < -0.2) rightClr += ar.clr;
      }
      steerBias = rightClr > leftClr ? -0.38 : leftClr > rightClr ? 0.38 : 0;
    }

    return {
      mode: mode,
      steerBias: steerBias,
      replan: replan,
      centerClear: centerClr,
      nearestClear: nearest,
      gap: bestGap,
      breathM: BREATH_M,
    };
  }

  function pathHasRockConflict(p, path, startIdx, rockClrFn) {
    if (!path || path.length < 2) return false;
    var R = roverRadius();
    var need = R - 0.02;
    var walked = 0;
    for (var i = startIdx; i < path.length && walked < 6; i++) {
      var q = path[i];
      if (i > startIdx) walked += q.distanceTo(path[i - 1]);
      var c = rockClrFn(q.x, q.z);
      if (c < need) return true;
    }
    return false;
  }

  function refineAutopilotOutput(ap, ctx) {
    var steer = ap.steer;
    var speed = ap.speed;
    var dt = ctx.dt || 0.016;
    var corridor = ctx.corridor || {};
    var camBias = ctx.camSteerBias || 0;
    var visionBias = ctx.visionSteerBias || 0;
    var llmBias = ctx.llmDodgeBias || 0;

    var gapW = corridor.mode === 'gap' ? 0.12 : 0.05;
    steer += corridor.steerBias * gapW;
    steer += camBias * 0.06;
    steer += visionBias * 0.06;
    steer += llmBias * 0.05;

    var R = roverRadius();
    var clr = corridor.centerClear != null ? corridor.centerClear : 99;
    var emergency = clr < R + 0.12 || (ctx.frontClear != null && ctx.frontClear < 0.85);
    var speedCap = ctx.speedCap != null ? ctx.speedCap : 1;

    if (!emergency) {
      speed = Math.max(speed, speedCap * 0.94);
    } else if (clr < R + 0.05) {
      speed = Math.min(speed, speedCap * 0.72);
    }

    var slew = 2.4 * dt;
    var prev = ctx.prevSteer != null ? ctx.prevSteer : steer;
    var d = steer - prev;
    if (d > slew) steer = prev + slew;
    else if (d < -slew) steer = prev - slew;

    steer = Math.max(-1.45, Math.min(1.45, steer));
    speed = Math.max(0, Math.min(1, speed));

    return { steer: steer, speed: speed, emergency: emergency };
  }

  global.NASA_NavFusion = {
    analyzeCorridor: analyzeCorridor,
    pathHasRockConflict: pathHasRockConflict,
    refineAutopilotOutput: refineAutopilotOutput,
    BREATH_M: BREATH_M,
  };
})(typeof window !== 'undefined' ? window : globalThis);
