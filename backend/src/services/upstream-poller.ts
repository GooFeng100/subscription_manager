import { getRuntimeSettings } from "../lib/runtime-settings.js";
import { getUpstreamBatchState } from "../lib/upstream-batch-state.js";
import { runUpstreamBatchRefresh } from "./upstream-batch-runner.js";

let started = false;
let polling = false;
let timer: NodeJS.Timeout | null = null;
const bootAt = Date.now();
let lastKnownRefreshAt = bootAt;
const checkIntervalMs = 60_000;

async function maybeRunScheduledRefresh() {
  if (polling) return;
  polling = true;
  try {
    const settings = await getRuntimeSettings();
    const intervalMinutes = Math.max(0, Number(settings.upstream_poll_interval_minutes || 0));
    if (intervalMinutes <= 0) {
      return;
    }
    const intervalMs = intervalMinutes * 60_000;
    const state = await getUpstreamBatchState();
    const latestStateAt = new Date(state.finishedAt || state.updatedAt || 0).getTime();
    if (Number.isFinite(latestStateAt) && latestStateAt > lastKnownRefreshAt) {
      lastKnownRefreshAt = latestStateAt;
    }
    if (Date.now() - lastKnownRefreshAt < intervalMs) {
      return;
    }
    const result = await runUpstreamBatchRefresh({
      trigger: "auto",
      reason: `scheduled upstream refresh (${intervalMinutes}m)`
    });
    if (!result.locked) {
      lastKnownRefreshAt = Date.now();
    }
  } catch (error) {
    console.error("scheduled upstream refresh failed:", error);
  } finally {
    polling = false;
  }
}

export function startUpstreamAutoPolling() {
  if (started) return;
  started = true;
  timer = setInterval(() => {
    void maybeRunScheduledRefresh();
  }, checkIntervalMs);
}

export function stopUpstreamAutoPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
  polling = false;
}
