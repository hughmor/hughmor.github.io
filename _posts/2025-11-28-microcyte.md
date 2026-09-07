---
layout: default
title: "microcyte"
description: "pcb: a 6-layer daughterboard for high-precision voltage/current sourcing"
tags: [hardware, kicad, pcb, photonics, dac]
---

<script>
  // KiCanvas ignores the `theme` attribute; it reads the theme from localStorage
  // at module-eval time. This classic script runs before the deferred module, so
  // seeding the key here picks the theme. Only seed it if the visitor has not
  // already chosen one in the viewer's preferences panel.
  // undocumented alpha storage key, revisit if the embed loses its colours.
  if (!localStorage.getItem("kc:prefs:theme")) {
    localStorage.setItem("kc:prefs:theme", JSON.stringify({ val: "witchhazel" }));
  }
</script>
<script type="module" src="https://kicanvas.org/kicanvas/kicanvas.js"></script>
<style>
  kicanvas-embed {
    display: block;
    width: 100%;
    margin-block: 1.5rem;
    height: min(72vh, 640px);
    border: 1px solid var(--code-border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
  }
</style>

For my thesis project on an 8-neuron photonic recurrent neural network, I needed a test setup that would allow me to bias all the photodetectors on chip, source high-precision current for some microheaters that controlled the 64 weights on the chip, and high-precision voltage to bias the PN junction modulators in each of the 8 neurons.
Since this surpassed what we had available for SMUs in the lab, I decided to try my hand at making a compact PCB that could source all the signals I needed.

I decided that rather than making a one-off board that couldn't be used again, I would make a DAC PCB that could be used by the next generation in our lab for biasing in other photonic neuron projects.
This consideration, and the modularity of the design, make me think to split my sourcing requirements into 8 individual PCBs, each with the sources needed to bias a single neuron on my chip.
Since the board's goal is to play a supporting role for the photonic neuron, calling them the *microcyte*s felt appropriate.

Each microcyte is a daughterboard using an M.2 form factor so that we can fit a bunch of them compactly into a motherboard that interfaces with the chip they are biasing. If I were to do this again, I probably wouldn't pick an M.2 again, since it's overly compact for what I needed in the lab at the time, but it was a fun challenge to take on a compact design like this. 

## the board

<div>
  <kicanvas-embed controls="full">
    <kicanvas-source src="{{ '/assets/kicad/microcyte/microcyte.kicad_pcb' | relative_url }}"></kicanvas-source>
    <kicanvas-source src="{{ '/assets/kicad/microcyte/microcyte.kicad_sch' | relative_url }}"></kicanvas-source>
  </kicanvas-embed>
</div>

<script>
  // Two things KiCanvas will not do on its own. Both reach into alpha internals.
  // ponytail: drop the fit when the `zoom` attribute works.
  const ZONE_OPACITY = 0.5;

  // Retry fn every 100 ms until it returns true, up to about 15 s.
  const retry = (fn, tries = 150) => {
    if (!fn() && tries > 0) setTimeout(() => retry(fn, tries - 1), 100);
  };
  const board_app = () => document.querySelector("kicanvas-embed")
    ?.shadowRoot?.querySelector("kc-board-app");

  // 1. KiCanvas fits the A4 drawing sheet on load, which leaves a 22 mm board as
  //    a speck. zoom_to_board() exists but nothing calls it. viewer.loaded
  //    resolves just after KiCanvas runs its own zoom_to_page(), so wait on that
  //    promise instead of racing it.
  //    Zones draw above the silkscreen and the draw order lives in a private
  //    field, so the layers cannot be reordered. Fading the zones is the only
  //    lever the viewer exposes.
  retry(() => {
    const viewer = board_app()?.viewer;
    if (!viewer?.loaded) return false;
    viewer.loaded.then(() => {
      viewer.zoom_to_board();
      viewer.zone_opacity = ZONE_OPACITY;
      viewer.draw();
    });
    return true;
  });

  // 2. The Objects panel renders after the viewer loads and its Zones slider is
  //    hardcoded to 1, so sync it or the control lies about what is drawn.
  retry(() => {
    const slider = board_app()?.shadowRoot
      ?.querySelector("kc-board-objects-panel")?.shadowRoot
      ?.querySelector('kc-ui-range[name="zones"]');
    if (!slider) return false;
    slider.value = ZONE_OPACITY;
    return true;
  });
</script>


Each one carries two LTC2662 current DACs (5 channels each) and one LTC2664 voltage DAC (4 channels). A greymatter motherboard takes eight of them, which gets me 112 current outputs and 32 voltage outputs from a single Pi Pico 2. The currents drive microring heaters, PN junctions, and Ge photodiodes, so the noise floor and the channel-to-channel matching matter more than the speed.

Since this was my first mixed-signal PCB of this project, I decided to make some simplifications that I probably wouldn't make in a second version of the PCB, but I didn't want to risk needing a respin of this board in the final months of my Ph.D. so I decided to keep it simple with just the three DAC chips, and put all the risk onto the connector board that interfaces this PCB with my chip.

<figure>
  <img src="{{ 'assets/img/microcyte/microcyte_assembled.jpeg' | relative_url }}"
       alt="The assembled microcyte board">
  <figcaption>An assembled microcyte after reflow of the three DAC chips.</figcaption>
</figure>


<!--
<p>
  <img src="{{ '/assets/img/microcyte/3d-top.png' | relative_url }}" alt="microcyte board, 3D render, top">
</p>
-->

<!-- TODO: notes on the rest. Fab, assembly, bring-up, what you would change. -->
