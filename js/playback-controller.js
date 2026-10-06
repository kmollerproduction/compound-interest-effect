export function scaledPlaybackDurationMs(periodYears, secondsFor20Years) {
  return secondsFor20Years * 1000 * (periodYears / 20);
}

export class PlaybackController {
  constructor({ totalMonths, durationMs, onFrame, onComplete, now = () => performance.now(), requestFrame = (callback) => requestAnimationFrame(callback), cancelFrame = (id) => cancelAnimationFrame(id) }) {
    this.totalMonths = totalMonths;
    this.durationMs = durationMs;
    this.onFrame = onFrame;
    this.onComplete = onComplete;
    this.now = now;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.position = 0;
    this.status = "idle";
    this.frameId = null;
    this.anchorTime = 0;
    this.anchorPosition = 0;
    this.tick = this.tick.bind(this);
  }

  start() {
    this.stopFrame();
    this.position = 0;
    this.anchorPosition = 0;
    this.status = "running";
    this.anchorTime = this.now();
    this.onFrame(this.position, this.status);
    this.frameId = this.requestFrame(this.tick);
  }

  pause() {
    if (this.status !== "running") return;
    this.updatePosition(this.now());
    this.position = Math.floor(this.position);
    this.status = "paused";
    this.stopFrame();
    this.onFrame(this.position, this.status);
  }

  resume() {
    if (this.status !== "paused") return;
    this.anchorPosition = this.position;
    this.anchorTime = this.now();
    this.status = "running";
    this.frameId = this.requestFrame(this.tick);
  }

  cancel() {
    if (this.status === "cancelled") return;
    this.stopFrame();
    this.status = "cancelled";
  }

  updatePosition(timestamp) {
    const elapsed = timestamp - this.anchorTime;
    this.position = Math.min(this.totalMonths, this.anchorPosition + (elapsed / this.durationMs) * this.totalMonths);
  }

  tick(timestamp) {
    if (this.status !== "running") return;
    this.updatePosition(timestamp);
    if (this.position >= this.totalMonths) {
      this.position = this.totalMonths;
      this.status = "complete";
      this.frameId = null;
      this.onFrame(this.position, this.status);
      this.onComplete?.();
      return;
    }
    this.onFrame(this.position, this.status);
    this.frameId = this.requestFrame(this.tick);
  }

  stopFrame() {
    if (this.frameId !== null) this.cancelFrame(this.frameId);
    this.frameId = null;
  }
}
