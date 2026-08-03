/** Lightweight confetti + success chime, no dependencies, browser only. */

export function confetti(count = 90) {
  if (typeof document === "undefined") return;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  const colors = ["#FFD166", "#EF476F", "#06D6A0", "#4CC9F0", "#B388FF", "#FF9F1C"];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    const size = 6 + Math.random() * 10;
    piece.style.cssText = [
      "position:absolute",
      `left:${Math.random() * 100}%`,
      "top:-20px",
      `width:${size}px`,
      `height:${size * (0.4 + Math.random())}px`,
      `background:${colors[i % colors.length]}`,
      `border-radius:${Math.random() > 0.5 ? "50%" : "2px"}`,
      `transform:rotate(${Math.random() * 360}deg)`,
      `animation:ccp-fall ${1.6 + Math.random() * 1.4}s cubic-bezier(.25,.6,.4,1) ${Math.random() * 0.4}s forwards`,
    ].join(";");
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 3600);
}

export function successSound() {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
    window.setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio not available */
  }
}

export function buzzSound() {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 180;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    window.setTimeout(() => ctx.close(), 800);
  } catch {
    /* audio not available */
  }
}

export function celebrate() {
  confetti();
  successSound();
}
