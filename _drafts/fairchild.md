---
layout: default
title: "fairchild: photonic-electronic cosimulation"
description: "an open-source time-domain electro-optic SPICE simulator i've been building"
---

![fairchild]({{ "assets/img/fairchild/logo_dark.svg" | relative_url }})

For most of my PhD, simulating a photonic link always raised the problem of cosimulation of optics and electronics. The optical circuit side was usually designed via a frequency-domain S-matrix solver, while the electrical side lives in SPICE. Cosimulation involved looping back and forth between the tools, which... sort of works. Often, we would just settle for a good optical simulation and a good electrical simulation, and not bother trying to cosimulate the whole thing. But the moment you want something that's genuinely coupled—an optical-electronic-optical link, a travelling wave modulator, time dynamics of a resonator—this approach breaks down, since there's you are going back and forth between the optical frequency domain and the electrical time-domain. The main circuit I worked with in my PhD was a recurrent photonic loop with an optical-electrical-optical transfer function; simultaneous co-simulation is the only was to faithfully model all the co-evolving dynamics.

This problem has been tackled by a few commercial solvers; Cadence has photonics, Synopsys has OptoCompiler, OptiSPICE has been developing another tool, and they all came to the same conclusion: treating optical fields as ordinary MNA (modified nodal analysis; the SPICE algorithm) unknowns, and solving them alongside the currents and voltages of the analog electronics. These tools are useful, but I found no open source alternative, so I've been building [fairchild](https://github.com/hughmor/fairchild).

## why bother

There are good open-source photonic simulators, but almost all of them are frequency-domain S-matrix tools. They're great for generating spectra and they are not built for electro-optic feedback. The commercial time-domain tools that exist are sophisticated and integrate with all the foundry PDKs, but they don't interface with open-source layout workflows. I thought this would be a fun project to take on to learn about how these simulators work under the hood, and I think I've started to build something almost as sophisticated, and my goal is to make it much more user friendly.

## example: a PAM-4 link

Here's the example I keep coming back to. A 10 Gb/s link: CW laser, Mach-Zehnder modulator, photodiode, transimpedance amplifier.

Nothing in it is a behavioural block. The modulator is two directional couplers and two reverse-biased PN phase shifters driven push-pull — the actual devices you'd place in a layout — and the TIA is a Verilog-A model compiled to OSDI, carrying its own input-referred current noise.

```spice
* the modulator, from primitives — its bandwidth falls out of C_j(V), not a parameter
Xc1   lin dark a1 a2   fc_dcoupler kappa_L=0.785           ; 50/50 split
Xarm1 a1 b1 p 0        fc_pn_ps_cap l_um=3000 v_pi_l=0.012 c_j0=750f
Xarm2 a2 b2 n 0        fc_pn_ps_cap l_um=3000 v_pi_l=0.012 c_j0=750f
Xc2   b1 b2 out unused fc_dcoupler kappa_L=0.785           ; recombine

.va   models/va_tia.va                                     ; Verilog-A, compiled for you
Xlas  lin fc_cw_laser power_mW=0.05 rin_db_hz=-145         ; laser RIN
Xpd   out det 0 fc_photodetector responsivity=0.9          ; shot noise
Cpd   det 0 15f
Xtia  det tout 0 va_tia z_t=2k r_in=50 f_3db=12G i_n_in=15p ; amplifier noise
Rl    tout 0 1meg
.options trannoise=1                                       ; noise in the waveform
.tran 1p 51.1n
```

<!-- FIGURE 1 — the noisy eye + BER panel. copy docs/plots/noisy_eye_and_ber.png into assets/img/fairchild/ -->
![NRZ and PAM-4 eyes through an MZM built from primitives, the link's measured bandwidth, and the noise checked three ways]({{ "assets/img/fairchild/noisy_eye_and_ber.png" | relative_url }})

Everything in that figure is measured from the circuit, at true amplitude, with no scaling. The eyes are a real PRBS-9. The PAM-4 drive levels are pre-distorted through the modulator's $\sin^2$ transfer the way a real transmitter's DAC does it. The 3 dB point comes out of `.ac`, so it's a result rather than a parameter.

The part I'm happiest with is the noise check. The same generators run in both domains — `.noise` reports PSDs, and `.options trannoise=1` injects them into the transient as random currents. One source list feeds both, so the time-domain variance should equal the frequency-domain PSD integrated over the resolved band. Measured agreement is $-0.05\%$. Checking the transient noise against the closed-form budget and against `.noise` at the operating point puts all three within 4 %.

Both rails carrying the same noise is the signature of a receiver limited by its amplifier rather than by the light. Swap the TIA for a load resistor and the noise piles onto the `1` rail instead, which is the RIN-limited case.

<!-- FIGURE 2 — receiver noise budget, thermal/shot/RIN crossovers and the SNR ceiling.
-->
![Receiver noise budget]({{ "assets/img/fairchild/receiver_noise_budget.png" | relative_url }})

A photonic receiver reports the whole direct-detection budget,

$$S_I = \frac{4kT}{R_L} + 2qI + \mathrm{RIN}\cdot I^2$$

rather than just its load resistor, so the SNR saturates at the RIN ceiling instead of improving forever with optical power. That ceiling is the thing you actually design against, and it's invisible if your simulator only models thermal noise.

## try it out

Wheels aren't published on PyPI yet, so you need to clone the repo, and then run `maturin develop --release`. There's also a C ABI with host-driven transient stepping, for mixed-signal co-simulation where your C program owns the timestepping.

```bash
cargo build --release
./target/release/fairchild -f examples/electronic/rc_step.sp
```

Or from Python:

```python
import fairchild

c = fairchild.Circuit()
c.load("examples/photonic/native_mrr_modulator.sp")
r = c.run("tran", step=5e-9, stop=2e-6, method="gear")
```



## comparing to `ngspice`


<!-- FIGURE 4 — accuracy overlay vs ngspice, with residual strips.
-->
![Accuracy overlay against ngspice]({{ "assets/img/fairchild/accuracy_analog.png" | relative_url }})

Linear circuits match ngspice to sub-1 mV RMS; the residuals show the discrepancy. The switching circuits show a larger RMS, which happen because of edge timing rather than offset; the residual is flat between transitions and spikes at each one. A finer step shrinks it.

<!-- FIGURE 5 — wall-clock scaling vs circuit size.
-->
![Wall-clock scaling vs circuit size]({{ "assets/img/fairchild/scaling_wall_time.png" | relative_url }})

Transient wall-clock on CMOS ring oscillators, 3 to 499 stages, each backend forced in turn. At 499 stages:

| backend | wall-clock | vs ngspice |
|---|---|---|
| fairchild — KLU | 2.96 s | **6.5× faster** |
| fairchild — sparse LU (faer) | 6.38 s | 3.0× faster |
| ngspice (default) | 19.2 s | — |

The MNA matrix is stored sparse, so both sparse backends allocate and factorise $\mathcal{O}(\mathrm{nnz})$ rather than $\mathcal{O}(n^2)$. The largest circuit I've run so far is a photonic chip with 18,807 unknowns, whose operating point solves in 0.98 s.

<!-- TABLE — comparison against the other tools in this space.
Axes worth filling: time-domain vs frequency-domain, electro-optic feedback in one solve,
Verilog-A / OSDI support, noise in both domains, open source, layout-flow integration.
Only fill cells you have actually checked — a wrong claim about someone else's tool is
the fastest way to lose the argument.

| | fairchild | ngspice | Lumerical INTERCONNECT | Cadence / Synopsys |
|---|---|---|---|---|
| time domain | ✅ | ✅ | | |
| optical + electrical in one solve | ✅ | ✗ | | |
| Verilog-A (OSDI) | ✅ | | | |
| optical noise (shot + RIN) | ✅ | ✗ | | |
| open source | ✅ | ✅ | ✗ | ✗ |
-->

## what doesn't work yet

**The photonic models are not validated against an external simulator.** Writing some tests to ensure `fairchild` agrees with other open-source simulators is on my roadmap, but hasn't made it to the top of the priority list yet. If you have a measured device or a trusted reference to compare against, that's the most useful thing anyone could throw at this right now.

Also unsupported: lossy transmission lines, native `.mc`, and PSF/FSDB output.

There are two documents for this: `docs/spice_support.md` tabulates `fairchild`'s support for every ngspice element letter, dot-command and source function; `docs/model_status.md` has an overview of the current status of all the built-in models.

## schematic capture

You can draw the circuit in KiCad and simulate it live over KiCad's IPC API, with no export step and no file watching:

```console
$ python -i -m fairchild.kicad
>>> print(sch.report())
>>> ckt = sch.circuit(scope="Weight Bank 1")
```

Results annotate back onto the schematic as text or embedded plots.

<!-- FIGURE 6 — screenshot of a KiCad schematic with results annotated back onto it.
This is the one that will sell the whole thing to anyone who has fought a netlist by hand.
-->

<!-- TODO before publishing:

  - take the KiCad screenshot for figure 6
  - decide whether to cut the netlist listing; it's the best part but it's long
-->
