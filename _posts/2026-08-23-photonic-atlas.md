---
layout: default
title: "photonic computing atlas"
description: "an interactive map of photonic / optical-computing research groups, startups, and the architectures they pioneer"
tags: [photonics, optical-computing, neuromorphic, visualization]
---

I have a hard time keeping straight who works on what in photonic computing, so I built a map of the field: research groups and startups as pins (with faces), the academic lineage and co-authorships that connect them, and the milestone papers that define the architectures — MZI meshes, WDM microring *broadcast-and-weight*, phase-change in-memory, diffractive, reservoir, coherent Ising, and frequency-comb.

Click a pin to see a group's people and its web of connections; click a person for their lineage; click a paper to light up its co-authors across the map. Quantum photonics is in the dataset but hidden by default, to keep the optical-computing-for-AI story legible — toggle it on in the sidebar.

<p style="margin:1.5rem 0;">
  <a href="{{ '/photonic-atlas/' | relative_url }}"><strong>→ open the full-screen atlas</strong></a>
</p>

<a href="{{ '/photonic-atlas/' | relative_url }}">
  <img src="{{ 'assets/img/photonic-atlas.png' | relative_url }}" alt="Photonic Computing Atlas — a dark world map with researcher face-pins and glowing connection webs" style="width:100%; border-radius:12px; border:1px solid var(--code-border,#e5e7eb);">
</a>

Best viewed on a wide screen. It started from my own corner of the field — the Prucnal lab at Princeton and Bhavin Shastri's group at Queen's, where I did my PhD — and fanned out from there. Inspired by [Eric Blow's PhotonicCompanies](https://github.com/ericcblow/PhotonicCompanies), but narrowed to computing architectures and the network of people behind them.
