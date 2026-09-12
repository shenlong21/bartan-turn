// Builds and drives the "utensil dial" — a glowing dashboard-style piece in
// the visual language of animejs.com's own homepage (rotating tick rings,
// a segmented glow arc, a pulsing center bar-graph, a traveling dot trail),
// re-skinned with kitchen utensils instead of an audio waveform. No character
// rig, no new art assets — just anime.js driving simple SVG shapes.

if (typeof anime === "undefined") {
  // CDN blocked/offline — the static SVG (rings, arc, utensils) still renders,
  // just without motion.
} else {
  const CENTER = 200;
  const barsGroup = document.getElementById("bars");
  const dotsGroup = document.getElementById("dots");
  const accents = ["var(--pink)", "var(--teal)", "var(--purple)", "var(--amber)"];

  // ---- center "scrub rhythm" equalizer, bars forming a plate-shaped envelope ----
  const BAR_COUNT = 24;
  const SPAN = 180; // total width the bars occupy
  const MAX_HEIGHT = 70;
  const bars = [];

  for (let i = 0; i < BAR_COUNT; i++) {
    const x = CENTER - SPAN / 2 + (i * SPAN) / (BAR_COUNT - 1);
    const t = (x - CENTER) / (SPAN / 2);
    const h = MAX_HEIGHT * Math.cos(t * (Math.PI / 2));
    const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bar.setAttribute("class", "bar");
    bar.setAttribute("x", (x - 1.6).toFixed(2));
    bar.setAttribute("y", (CENTER - h).toFixed(2));
    bar.setAttribute("width", "3.2");
    bar.setAttribute("height", (h * 2).toFixed(2));
    bar.setAttribute("rx", "1.6");
    bar.setAttribute("fill", accents[i % accents.length]);
    bar.setAttribute("opacity", "0.85");
    barsGroup.appendChild(bar);
    bars.push(bar);
  }

  // ---- diagonal traveling dot trail ----
  const DOT_COUNT = 13;
  for (let i = 0; i < DOT_COUNT; i++) {
    const t = i / (DOT_COUNT - 1);
    const x = 120 + t * 160;
    const y = 280 - t * 160;
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("class", "trail-dot");
    dot.setAttribute("cx", x.toFixed(1));
    dot.setAttribute("cy", y.toFixed(1));
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", "var(--porcelain)");
    dotsGroup.appendChild(dot);
  }

  // ---- ambient rotation, tick rings spinning at different speeds/directions ----
  anime({ targets: ".ring-1", rotate: 360, duration: 38000, loop: true, easing: "linear" });
  anime({ targets: ".ring-2", rotate: -360, duration: 52000, loop: true, easing: "linear" });
  anime({ targets: ".ring-3", rotate: 360, duration: 70000, loop: true, easing: "linear" });
  anime({ targets: ".arc-group", rotate: 360, duration: 90000, loop: true, easing: "linear" });

  // ---- intro: starts as a flat top-down plate, then rotates a full quarter-turn
  // toward a front-on view. The avatar (avatar-3d.js) waits for this to fully
  // finish before it pops up — it is not part of this animation.
  anime({
    targets: ".dial-art svg",
    rotateX: [0, 75],
    easing: "easeInOutQuad",
    duration: 2200,
    delay: 500,
    complete: () => window.dispatchEvent(new Event("plate-tilted")),
  });

  // ---- arc entrance: each quarter sweeps in like a line-draw reveal ----
  anime({
    targets: ".arc",
    strokeDashoffset: [20, 0],
    easing: "easeOutCubic",
    duration: 900,
    delay: anime.stagger(160, { start: 200 }),
  });

  // ---- utensils pop in with a springy overshoot, then idle-bounce forever ----
  anime({
    targets: ".utensil",
    scale: [0, 1],
    easing: "easeOutElastic(1, 0.6)",
    duration: 1200,
    delay: anime.stagger(150, { start: 900 }),
    complete: () => {
      anime({
        targets: ".utensil",
        scale: [{ value: 1.08 }, { value: 1 }],
        rotate: [{ value: -4 }, { value: 4 }, { value: 0 }],
        duration: 1800,
        delay: anime.stagger(120),
        direction: "alternate",
        loop: true,
        easing: "easeInOutSine",
      });
    },
  });

  // ---- equalizer pulse ----
  anime({
    targets: bars,
    scaleY: [{ value: 0.45 }, { value: 1.1 }, { value: 0.6 }],
    duration: 900,
    delay: anime.stagger(35, { from: "center" }),
    direction: "alternate",
    loop: true,
    easing: "easeInOutSine",
  });

  // ---- traveling sparkle along the diagonal trail ----
  anime({
    targets: ".trail-dot",
    opacity: [{ value: 0 }, { value: 1 }, { value: 0 }],
    scale: [{ value: 0.6 }, { value: 1.3 }, { value: 0.6 }],
    duration: 1500,
    delay: anime.stagger(90),
    loop: true,
    easing: "easeInOutSine",
  });
}
