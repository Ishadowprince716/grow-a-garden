'use strict';
// Lightweight anonymous telemetry — counts player actions per session.
// Backend polls POST /api/metrics; on Pages (no backend) aggregates in localStorage.
// Logs nothing identifiable: only event-name counters.

const Metrics = (() => {
  const MKEY = 'gg_metrics';
  let counts = {};
  try { counts = JSON.parse(localStorage.getItem(MKEY)) || {}; } catch (e) {}

  function track(ev) {
    counts[ev] = (counts[ev] || 0) + 1;
    try { localStorage.setItem(MKEY, JSON.stringify(counts)); } catch (e) {}
    if (API.online) {
      try {
        fetch('/api/metrics', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: [ev] }),
        }).catch(() => {});
      } catch (e) {}
    }
    return counts;
  }

  function snapshot() { return Object.assign({}, counts); }

  return { track, snapshot };
})();
