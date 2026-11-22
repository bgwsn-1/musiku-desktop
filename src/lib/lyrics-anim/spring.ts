// Spring fisik untuk animasi lirik (integrator analitik, ditulis ulang).
// Frekuensi Hz + damping ratio; under-damped menghasilkan overshoot halus.

export interface SpringOptions {
  frequency?: number; // Hz
  damping?: number; // rasio redaman; <1 overshoot, =1 kritis, >1 lambat
}

export class Spring {
  value: number;
  private goalValue = 0;
  private velocity = 0;
  private freq: number;
  private damping: number;

  constructor(initial = 0, opts: SpringOptions = {}) {
    this.value = initial;
    this.goalValue = initial;
    this.freq = Math.max(0.05, opts.frequency ?? 1);
    this.damping = Math.max(0.01, opts.damping ?? 0.6);
  }

  SetGoal(goal: number): void {
    this.goalValue = goal;
  }

  GetGoal(): number {
    return this.goalValue;
  }

  /** Satu langkah integrasi dengan dt detik. Mengembalikan nilai baru. */
  Step(dt: number): number {
    if (!Number.isFinite(dt) || dt <= 0) return this.value;
    const step = Math.min(dt, 0.05); // jaga stabilitas kalau frame lambat
    const steps = Math.max(1, Math.ceil(step / 0.016));
    const h = step / steps;
    for (let i = 0; i < steps; i++) {
      const omega = 2 * Math.PI * this.freq;
      const k = omega * omega;
      const c = 2 * this.damping * omega;
      const force = -k * (this.value - this.goalValue) - c * this.velocity;
      this.velocity += force * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  get settled(): boolean {
    const omega = 2 * Math.PI * this.freq;
    const eps = Math.max(1e-4, this.goalValue * 1e-4);
    return (
      Math.abs(this.value - this.goalValue) <= eps &&
      Math.abs(this.velocity) <= omega * eps
    );
  }

  Snap(value: number): void {
    this.value = value;
    this.goalValue = value;
    this.velocity = 0;
  }
}
