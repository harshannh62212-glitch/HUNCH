/**
 * NASA HUNCH LLASO — autonomy layer policy (safety > planner > controller > optional ML assist).
 * Loaded before viewer inline script; integrates with global sim state.
 */
(function (global) {
  var POLICY = {
    version: '1.0.0',
    onnx_file: 'rover_pilot.onnx',
    dataset_frames: 0,
    trained_at: null,
  };

  var OLLAMA_CANDIDATES = [
    'http://127.0.0.1:11434',
    'http://localhost:11434',
    'http://100.92.134.100:11434',
  ];

  var llmMinIntervalMs = 9000;
  var lastLlmAt = 0;
  var pendingReplanAdvisory = false;
  var ollamaBaseUrl = null;
  var ollamaOnline = false;
  var llmOfflineUntil = 0;
  var llmOfflineLogged = false;
  var resolvingOllama = null;

  global.NASA_Autonomy = {
    POLICY: POLICY,
    OLLAMA_CANDIDATES: OLLAMA_CANDIDATES,
    layers: {
      SAFETY: 'supervisor',
      PLANNER: 'astar',
      CONTROLLER: 'pure_pursuit',
      LLM_ASSIST: 'vlm_dodge_bias',
      NEURAL: 'onnx_pilot',
    },

    getOllamaBase: function () {
      return ollamaBaseUrl;
    },

    resolveOllamaBase: function () {
      if (resolvingOllama) return resolvingOllama;
      resolvingOllama = (async function () {
        for (var i = 0; i < OLLAMA_CANDIDATES.length; i++) {
          var base = OLLAMA_CANDIDATES[i];
          try {
            var ctrl = new AbortController();
            var tid = setTimeout(function () {
              ctrl.abort();
            }, 2500);
            var res = await fetch(base + '/api/tags', { signal: ctrl.signal });
            clearTimeout(tid);
            if (res.ok) {
              ollamaBaseUrl = base;
              ollamaOnline = true;
              llmOfflineUntil = 0;
              llmOfflineLogged = false;
              global.NASA_Autonomy.markOllamaOnline(base);
              return base;
            }
          } catch (e) {
            /* try next host */
          }
        }
        ollamaBaseUrl = null;
        ollamaOnline = false;
        global.NASA_Autonomy.setOllamaOffline('Start Ollama: ollama serve');
        return null;
      })();
      resolvingOllama.finally(function () {
        resolvingOllama = null;
      });
      return resolvingOllama;
    },

    isOllamaReady: function () {
      if (!ollamaOnline || !ollamaBaseUrl) return false;
      var now = global.performance ? global.performance.now() : Date.now();
      return now >= llmOfflineUntil;
    },

    markOllamaOnline: function (base) {
      ollamaOnline = true;
      ollamaBaseUrl = base;
      llmOfflineLogged = false;
      llmOfflineUntil = 0;
      var badge = global.document && global.document.getElementById('ai-latency-badge');
      if (badge) {
        badge.innerText = 'READY';
        badge.className = 'text-emerald-400 font-bold';
        badge.title = 'Ollama @ ' + base;
      }
      var ts = global.document && global.document.getElementById('tailscale-badge');
      if (ts && base.indexOf('100.92') >= 0) {
        ts.className = 'text-emerald-400 font-bold flex items-center';
      }
    },

    setOllamaOffline: function (reason) {
      ollamaOnline = false;
      llmOfflineUntil =
        (global.performance ? global.performance.now() : Date.now()) + 120000;
      var badge = global.document && global.document.getElementById('ai-latency-badge');
      if (badge) {
        badge.innerText = 'CLASSICAL';
        badge.className = 'text-cyan-400 font-bold';
        badge.title = reason || 'VLM assist off — A* + lidar dodge only';
      }
      if (!llmOfflineLogged && typeof global.llog === 'function') {
        llmOfflineLogged = true;
        global.llog(
          '<span class="text-cyan-300">[SYS] VLM offline (' +
            (reason || 'no Ollama') +
            '). Classical nav continues — no AI errors.</span>'
        );
      }
    },

    retryOllama: function () {
      llmOfflineUntil = 0;
      llmOfflineLogged = false;
      ollamaOnline = false;
      ollamaBaseUrl = null;
      return global.NASA_Autonomy.resolveOllamaBase();
    },

    activeController: function () {
      if (global.neuralPilotOn) return 'NEURAL';
      if (global.autoOn) return 'CLASSICAL';
      return 'MANUAL';
    },

    onReplan: function () {
      pendingReplanAdvisory = true;
    },

    shouldCallLlm: function (state) {
      if (!state.autoOn || !state.globalGoal || state.isLLMThinking) return false;
      if (global.neuralPilotOn) return false;
      if (!global.NASA_Autonomy.isOllamaReady()) return false;
      var now = global.performance ? global.performance.now() : Date.now();
      if (now - lastLlmAt < llmMinIntervalMs && !pendingReplanAdvisory) return false;

      var tight = state.minFront < 2.6;
      var sideImbalance =
        Math.abs(state.minLeft - state.minRight) > 1.2 && state.minFront < 4.5;
      var visionWarn =
        state.visionSummary &&
        /obstacle|pit|crater|block|depress|steep|drop/i.test(state.visionSummary);

      if (pendingReplanAdvisory || tight || sideImbalance || visionWarn) return true;
      return false;
    },

    noteLlmStarted: function () {
      lastLlmAt = global.performance ? global.performance.now() : Date.now();
      pendingReplanAdvisory = false;
    },

    loadPolicyManifest: async function () {
      try {
        var res = await fetch('policy_manifest.json?_=' + Date.now());
        if (res.ok) {
          var data = await res.json();
          Object.assign(POLICY, data);
        }
      } catch (e) {
        /* offline / file:// */
      }
      var el = global.document && global.document.getElementById('policy-version-tag');
      if (el) {
        el.textContent =
          'Policy ' +
          (POLICY.version || '?') +
          ' · ' +
          (POLICY.dataset_frames || 0) +
          ' demo frames';
      }
      var neuralTag = global.document && global.document.getElementById('neural-status-tag');
      if (neuralTag && neuralTag.innerText === 'STANDBY' && POLICY.version) {
        neuralTag.title = POLICY.onnx_file + ' v' + POLICY.version;
      }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
