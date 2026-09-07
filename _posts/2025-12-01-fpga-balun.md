---
layout: default
title: "4-channel RF balun"
description: "pcb: an RF balun PCB for the ZCU216 RFSoC"
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

The board I designed in this project was for a project I was more tangentially involved in. Our lab had recently purchased a dev kit for AMD's ZCU216 RFSoC, for test & measurement of a few RF photonics projects we had going on. The FPGA has 16 hardened RF DAC blocks and 16 ADC blocks, but all the built-in channels of the dev board have differential output. Since the test setup my colleague had worked on needed a single-ended SMA input, we had started looking for some interface boards, but we were quoted a few thousand dollars for a full front-end to break out all of our channels from differential to single ended. I thought it seemed ludicrous to pay that much when we could get high quality PCBs made for a few hundred bucks, so I took on the challenge to come up with my own design.

The dev kit already came with a balun breakout card (XM655), but it's got a bunch of baluns eached specced for a different band. Since our work needed to accommodate wideband signals, I designed for the Macom [MABA-011118](https://www.macom.com/products/product-detail/MABA-011118) which ranges from 10 MHz up to 10GHz, the widest bandwidth balun I could find. For the 16 TX and 16 RX channels, I decided to design cards with 4 channels each on them. Check out the design I came up with below.

## the board

I used a 0.6mm Rogers RO4350B substrate and dimensioned 50Ω CPWs with ground plane underneath. I also designed a 3D printed mount for underneath the board so that I could use the SMA connectors I already had, which are designed for a standard 1.6mm thickness board.

I think it turned out pretty well, but I'm still waiting on the test results from my colleague. I will update this post when I have all of the S-parameters.

<div>
  <kicanvas-embed controls="full">
    <kicanvas-source src="{{ '/assets/kicad/zcu216_balun/fpga-baluns.kicad_pcb' | relative_url }}"></kicanvas-source>
    <kicanvas-source src="{{ '/assets/kicad/zcu216_balun/fpga-baluns.kicad_sch' | relative_url }}"></kicanvas-source>
    <!-- Hierarchical design. KiCanvas follows the Sheetfile references in the root
         schematic, but only loads a sheet whose file was declared here, so every
         sub-sheet needs its own source. -->
    <kicanvas-source src="{{ '/assets/kicad/zcu216_balun/maba-011118.kicad_sch' | relative_url }}"></kicanvas-source>
    <kicanvas-source src="{{ '/assets/kicad/zcu216_balun/HARWIN_Shield.kicad_sch' | relative_url }}"></kicanvas-source>
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


<figure>
  <img src="{{ 'assets/img/fpga-balun/balun_assembled.jpeg' | relative_url }}"
       alt="The assembled balun board">
  <figcaption>An assembled 4-channel balun board.</figcaption>
</figure>


<!--
<p>
  <img src="{{ '/assets/img/microcyte/3d-top.png' | relative_url }}" alt="microcyte board, 3D render, top">
</p>
-->

<!-- TODO: notes on the rest. Fab, assembly, bring-up, what you would change. -->
