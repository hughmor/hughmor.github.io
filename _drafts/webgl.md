---
date: 2025-10-18
layout: default
title: "webgl mandelbrot set"
description: "playing around with three.js"
---

Here’s some normal text above the scene...

<div id="webgl-root" style="width:100%; max-width:400px; height:400px; margin:2rem auto;"></div>

<script type="module">
  import { initMandelbrot } from "{{ '/assets/js/mandelbrot.js' | relative_url }}";
  const el = document.getElementById('webgl-root');
  initMandelbrot(el);
</script>

... and then more text below.
