---
date: 2025-10-18
layout: default
title: "three-body simulation"
description: "a simple little physics simulation with p5.js"
---

This is just a fun little physics simulation I wrote to play around with the p5.js drawing package, and test rendering things with colours matching my site's theme. There is a 3x6 grid of individual 3-body physics simulations; each individual simulation only interacts within itself, but they all occupy the same canvas. Each of the cells also has a weak force pulling it back towards its centre grid point so that they don't just fly off the page to infinity. Letting it run for a while produces some cool chaotic designs on the canvas.

<div id="p5-root" style="width:100%; max-width:960px; aspect-ratio:16/9; margin:2rem auto; border:1px solid var(--code-border,#e5e7eb); border-radius:12px; overflow:hidden;"></div>

<!-- <script type="module">
  import { mountThreeBody } from "{{ '/assets/js/three_body.js' | relative_url }}";
  const root = document.getElementById('p5-root');
  // optional opts: { aspect: 16/9 }
  const { unmount } = await mountThreeBody(root);
  // if you ever need teardown: unmount();
</script> -->

<script type="module">
  import { mountThreeBody } from "{{ '/assets/js/three_body.js' | relative_url }}";
  const root = document.getElementById('p5-root');
  await mountThreeBody(root, { cols: 6, rows: 4, maxDPR: 10 });
</script>
