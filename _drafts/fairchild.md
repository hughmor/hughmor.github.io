---
layout: default
title: "fairchild: photonic-electronic cosimulation"
description: "an open-source time-domain electro-optic circuit simulator i've been building"
---

For most of my PhD, simulating a photonic link meant running two tools and passing files between them. The optical side lives in a frequency-domain S-matrix solver, the electrical side lives in SPICE, and the two meet at a fixed-point loop that you babysit until it stops moving. It works, sort of. But the moment you want something that genuinely couples — a photodiode feeding a TIA whose output drives the modulator that the photodiode is watching — you're no longer simulating a circuit, you're iterating between two descriptions of one and hoping they agree.

So I've been building [fairchild](https://github.com/hughmor/fairchild), which does the obvious thing instead: it treats optical fields as ordinary MNA unknowns and solves them alongside the currents and voltages, in one Newton iteration.

That's the whole idea. A photodiode's current is available to a TIA in the same timestep, and that amplifier's output is available to drive a modulator, inside one convergent solve. No co-simulation, no fixed-point iteration between two tools.

## why bother

There are good open-source photonic simulators, but almost all of them are frequency-domain S-matrix tools. They're great for generating spectra and they are not built for electro-optic feedback. The commercial time-domain tools that *can* do this exist — Cadence and Synopsys both have one — and they are heavyweight, and they don't interface with open-source layout workflows.

I wanted something I could point at a netlist, get a number out of, and read the source of when the number looked wrong.

## a link, end to end, in one deck

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

<!-- FIGURE 1 — the noisy eye + BER panel. copy docs/plots/noisy_eye_and_ber.png into assets/img/fairchild/
![NRZ and PAM-4 eyes through an MZM built from primitives, the link's measured bandwidth, and the noise checked three ways]({{ "assets/img/fairchild/noisy_eye_and_ber.png" | relative_url }})
-->

Everything in that figure is measured from the circuit, at true amplitude, with no scaling. The eyes are a real PRBS-9. The PAM-4 drive levels are pre-distorted through the modulator's $\sin^2$ transfer the way a real transmitter's DAC does it. The 3 dB point comes out of `.ac`, so it's a result rather than a parameter.

The part I'm happiest with is the noise check. The same generators run in both domains — `.noise` reports PSDs, and `.options trannoise=1` injects them into the transient as random currents. One source list feeds both, so the time-domain variance should equal the frequency-domain PSD integrated over the resolved band. Measured agreement is $-0.05\%$. Checking the transient noise against the closed-form budget and against `.noise` at the operating point puts all three within 4 %.

Both rails carrying the same noise is the signature of a receiver limited by its amplifier rather than by the light. Swap the TIA for a load resistor and the noise piles onto the `1` rail instead, which is the RIN-limited case.

<!-- FIGURE 2 — receiver noise budget, thermal/shot/RIN crossovers and the SNR ceiling.
![Receiver noise budget]({{ "assets/img/fairchild/receiver_noise_budget.png" | relative_url }})
-->

A photonic receiver reports the whole direct-detection budget,

$$S_I = \frac{4kT}{R_L} + 2qI + \mathrm{RIN}\cdot I^2$$

rather than just its load resistor, so the SNR saturates at the RIN ceiling instead of improving forever with optical power. That ceiling is the thing you actually design against, and it's invisible if your simulator only models thermal noise.

## optical ports are bundles

One design decision worth calling out. An optical port carries a slowly-varying envelope as $(\mathrm{re}, \mathrm{im}, \lambda)$, and a port is a *bundle* rather than three pins. So a 4-port device is a 4-port symbol, not a 12-pin one, and WDM comes from declaring a port $N$ channels wide instead of from any per-device opt-in.

Rings, MZIs and filter banks compose in the netlist from primitives. There's no `fc_microring` — you build one, and its lineshape falls out of the coupling and the loss you gave it.

<!-- FIGURE 3 — micro-ring through-port transmission, resonance shifting under bias.
![Micro-ring through-port transmission]({{ "assets/img/fairchild/native_mrr_wavelength_sweep.png" | relative_url }})
-->

## how fast, and how close to right

Both of these are reproducible — `python3 benchmarks/plot.py` regenerates the figures, and `benchmarks/METHODOLOGY.md` discloses the comparison rules, because benchmark posts without methodology are worth nothing.

<!-- FIGURE 4 — accuracy overlay vs ngspice, with residual strips.
![Accuracy overlay against ngspice]({{ "assets/img/fairchild/accuracy_analog.png" | relative_url }})
-->

Linear circuits match ngspice to sub-1 mV RMS. Every panel carries a residual strip, because two curves drawn on top of each other look identical at 1 mV and at 100 mV alike. The switching circuits show a larger RMS, and that's edge timing rather than offset — the residual is flat between transitions and spikes at each one, which is what a fixed step resolving a 1 ns edge looks like. A finer step shrinks it.

<!-- FIGURE 5 — wall-clock scaling vs circuit size.
![Wall-clock scaling vs circuit size]({{ "assets/img/fairchild/scaling_wall_time.png" | relative_url }})
-->

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

The honest version, because a silent wrong answer is worse than a crash and I'd rather you knew the shape of the gaps.

There are 521 tests. The electrical models are compared against ngspice 46 circuit by circuit, and those suites fail loudly in CI rather than skipping when ngspice is missing.

**The photonic models are not validated against an external simulator.** They're checked against analytic closed forms and equivalence tests, which catches a lot, but it is not the same thing. That's the largest gap in coverage and `docs/model_status.md` marks it per device. If you have a measured device or a trusted reference to compare against, that's the most useful thing anyone could throw at this right now.

Also unsupported: lossy transmission lines, `.disto`, `.pz`, native `.mc`, and PSF/FSDB output.

There are two documents for this, because "supported" isn't a binary. `docs/spice_support.md` tabulates every ngspice element letter, dot-command and source function, and says whether the unimplemented ones error or warn. `docs/model_status.md` gives every model parameter three columns: parsed, stamped, validated. A parameter that parses but changes nothing is the exact failure mode both documents exist to expose.

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

## trying it

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

Wheels aren't on PyPI yet, so the Python package needs `maturin develop --release` from a clone. There's also a C ABI with host-driven transient stepping, for mixed-signal co-simulation where your program owns the clock.

Most of the photonic examples take `--selftest`, which asserts the physics instead of plotting it, so you can check the install does what it claims without reading a single graph.

It's Apache-2.0. Issues and PRs welcome, and the two rules in `CONTRIBUTING.md` are the ones I care about: a silent wrong answer is worse than a crash, and a test isn't finished until you've broken the code and watched it fail.

<!-- TODO before publishing:
  - copy the plots out of the repo into assets/img/fairchild/ and uncomment figures 1-5
  - take the KiCad screenshot for figure 6
  - fill in the comparison table, only with cells you've verified
  - decide whether to cut the netlist listing; it's the best part but it's long
  - move to _posts/ as YYYY-MM-DD-fairchild.md
-->
