// Preloaded into the app (node --import) by capture.mjs for the portfolio
// screenshot only. The conversions are real; this file only makes the screen
// identical from run to run and from machine to machine:
//
// - os.cpus() reports a fixed core count, so "Detected N CPU Cores" and the
//   thread count do not depend on the runner.
// - Worker events are released in the order the workers were created, so the
//   log order does not depend on which ffmpeg process happens to finish first.
// - Date.now() and performance.now() read a simulated clock that only moves
//   when a worker is released, by a fixed per-task duration. Timings on screen
//   are therefore stable (they are illustrative, not measured).
import os from 'node:os';
import { syncBuiltinESMExports } from 'node:module';
import { performance } from 'node:perf_hooks';
import workerThreads from 'node:worker_threads';
import { EventEmitter } from 'node:events';

const CORES = Number(process.env.EZGA_CAPTURE_CORES || 8);
const EPOCH = Date.UTC(2026, 0, 15, 10, 0, 0);

let simulatedMs = 0;
const fakeCpu = os.cpus()[0] ?? {
  model: 'cpu',
  speed: 0,
  times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
};
os.cpus = () =>
  Array.from({ length: CORES }, () => ({ ...fakeCpu, model: 'cpu' }));

Date.now = () => EPOCH + Math.round(simulatedMs);
performance.now = () => simulatedMs;

const RealWorker = workerThreads.Worker;
const GATED = new Set(['message', 'error', 'exit', 'online', 'messageerror']);
const pending = []; // workers in creation order, not yet released
let created = 0;
let releaseScheduled = false;

const releaseReady = () => {
  releaseScheduled = false;
  const head = pending[0];
  if (!head || !head.__exited) return;
  pending.shift();
  // Each task "takes" a fixed, file-dependent time, overlapping with the
  // other CORES-1 tasks that were started before it.
  simulatedMs = Math.max(simulatedMs, head.__finishMs);
  for (const [event, args] of head.__buffer) {
    head.__app.emit(event, ...args);
  }
  head.__buffer = [];
  // Let the app react (start the next task) before the next release.
  scheduleRelease();
};

const scheduleRelease = () => {
  if (releaseScheduled) return;
  releaseScheduled = true;
  setImmediate(releaseReady);
};

class OrderedWorker extends RealWorker {
  constructor(...args) {
    super(...args);
    const index = created++;
    this.__buffer = [];
    this.__exited = false;
    // The app's listeners live here: Node drops a worker's own listeners
    // when it exits, before we release its events.
    this.__app = new EventEmitter();
    this.__finishMs = simulatedMs + 140 + ((index * 73) % 190);
    pending.push(this);
  }

  on(event, listener) {
    if (!GATED.has(event)) return super.on(event, listener);
    this.__app.on(event, listener);
    return this;
  }

  addListener(event, listener) {
    return this.on(event, listener);
  }

  once(event, listener) {
    if (!GATED.has(event)) return super.once(event, listener);
    this.__app.once(event, listener);
    return this;
  }

  emit(event, ...args) {
    if (!GATED.has(event)) return super.emit(event, ...args);
    this.__buffer.push([event, args]);
    if (event === 'exit') {
      this.__exited = true;
      scheduleRelease();
    }
    return true;
  }
}

workerThreads.Worker = OrderedWorker;
syncBuiltinESMExports();
