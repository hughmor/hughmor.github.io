---
layout: default
title: "so how long does matrix-vector-multiplication take? part 2"
description: "investigating latency of small-scale FFN on Ampere GPU"
---

This post was originally written as a report for my internship with Hartley Ultrafast, so I haven't gotten the math or the figure references adapted yet.

# introduction
The goal of this project was to evaluate the fundamental inference latency of an 8-bit integer-quantized, 5-layer feedforward neural network with 256 neurons per layer (256×256 fully-connected layers with ReLU activation) on an NVIDIA GPU.

In @Sec:hardware, I first describe the hardware and software environment used for the benchmarks. In @Sec:results, I start with an overview of the results, and then describe each of the three approaches. In @Sec:anal, using information about the architecture gathered from documentation, I attempt to estimate how close to the theoretical latency these current benchmarks are, and how much we could expect the results to be improved on NVIDIA's newest Blackwell architecture.

# Hardware and Environment {#sec:hardware}

I'll be posting snippets throughout this post, but all the code written for these benchmarking tests is available at [https://github.com/hughmor/gpu-ff-inference-latency](https://github.com/hughmor/gpu-ff-inference-latency).

**GPU:** NVIDIA RTX 3060
- GA106 Chip (Ampere, Samsung 8nm)
- 28 SMs (3584 CUDA cores)
- 12 GB VRAM
- Max clock speed: 1.78 GHz


**Software Environment:**
- CUDA Driver version 12.6
- CUDA Toolkit version 12.6
- Microsoft C/C++ Optimizing Compiler Version 19.44.35217 for x64

All benchmarks were performed at default GPU clocks and power limits. The GPU is simultaneously being used for driving my monitor, but the overhead is minimal (Windows Activity Monitor confirms idle GPU usage ~1% and VRAM usage ~2.5GB/12GB).

<!-- **Note:** After first CuPy and CuBLASLt trials using the A6000 GPU available in my lab, I found no material difference in execution time for the cuBLASLt version, so I didn't repeat the fused kernel experiments on this GPU. The difference between the A6000 and RTX3060 GPUs is in the amount of SMs (84) and VRAM (48GB), neither of which is being maxed out in these experiments. -->

# Results {#sec:results}

Two alternative views of the primary results can be seen in the histograms in @Fig:cuda_bench_histograms and the box plots in @Fig:cuda_bench_boxplots.

![Histograms comparing the minimum latency measured with (a) cuBlasLt library, (b) custom fused kernel, (c) multi-CTA kernel. All histograms show the lowest 90th percentile of measured latency values in order to discard outliers which pollute the data.]({{ "assets/img/gpu-latency/cuda_benchmark_histograms_separate.png" | relative_url }}){#fig:cuda_bench_histograms}

![Box plots comparing the minimum latency measured with (a) cuBlasLt library, (b) custom fused kernel, (c) multi-CTA kernel.]({{ "assets/img/gpu-latency/cuda_benchmark_violin_plots_separate.png" | relative_url }}){#fig:cuda_bench_boxplots}

Each implementation was executed over 10,000 benchmark samples. For each sample, the program performed 100 consecutive inferences whose runtimes were measured using CUDA events (`cudaEventRecord`/`cudaEventElapsedTime`) and averaged to reduce measurement noise. The first 500 iterations were treated as warm-up runs to pre-populate GPU caches and stabilize clock frequencies.

Nsight Systems was used to validate timing consistency, examine the per-kernel event traces, and verify GPU utilization. For the cuBLASLt version, the profiler showed multiple short-duration kernel invocations per inference. In the fused kernel versions, a single long-duration kernel was observed, corresponding to the entire 5-layer computation. The kernel launch durations observed in Nsight Systems were consistent with the values measured using the CUDA events. The measured latency data recorded using CUDA events was exported to generate the plots.

**cuBLASLt Version** (filename: *ff_5l_256N_int8.cu*)

In the first benchmark, each layer used the `cublasLtMatmul` integer matrix multiply-accumulate (IMMA) library function, with 8-bit integer inputs and 32-bit accumulators. The function required the `cublasLtMatrixTransform` library function to transform data layout so that operands were present in tensor-core–friendly formats before invoking the optimized IMMA kernels.

To compute the whole network, five sequential IMMA operations with intermediate quantization and ReLU operations were launched from host code. Each layer required five separate GPU kernels (transform $x$, transform $W$, apply GEMM, transform $y$, and apply ReLU/quantization). CUDA Graph Capture (`cudaStreamBeginCapture`, `cudaStreamEndCapture`, and `cudaGraphLaunch`) was used to reduce the per-launch overhead, but the overall pipeline still involved significant data movement between layers. While this approach is near-optimal for large batches, the single-sample configuration used here leaves much of the GPU under-utilized.

The results of this benchmark are seen in the leftmost panels in [@Fig:cuda_bench_histograms;@fig:cuda_bench_boxplots]. This version of the code achieved a latency of 81.57 ± 2.91 µs. A representative sample can be seen in the screenshot from the Nsight profiler in @Fig:nsight_cublaslt.

![Screenshot of Nsight Systems profiler running the cuBLASLt code via Graph Launch. The Events View shows representative samples with latency around 83 µs.]({{ "assets/img/gpu-latency/NSight_cuBLAS.png" | relative_url }}){#fig:nsight_cublaslt}

**Fused Single-CTA CUDA Kernel** (filename: *ff_5l_256N_int8_fused.cu*)

After running the CuBLASLt code, the next step was to see how much this could be optimized by writing a kernel which fuses all 5 layers of the network into a single function. Writing the kernel directly provides fine-grained control over the number of streaming multiprocessors used, the memory layout, and the memory access patterns.

In this implementation, a single cooperative thread array (CTA) with 128 threads executes the entire network on a single SM. Intermediate activations remain resident in shared memory throughout the computation. Each thread computes two output neurons, giving full coverage of the 256 outputs. Matrix multiplication for each layer is performed in 64-wide tiles using the `__dp4a` instruction (a 4-way INT8 dot product with INT32 accumulation). Weights are stored in column-major order and fetched with the `__ldg` intrinsic to utilize the read-only cache. After each layer, ReLU and quantization are applied in-place on shared memory before proceeding to the next layer. This design eliminates inter-kernel overhead and all intermediate global reads/writes of activation data but new weights are moved in and out of the SM for each tile of each layer.

The results of this benchmark are seen in the middle panels of [@Fig:cuda_bench_histograms;@fig:cuda_bench_boxplots]. This fused kernel improved on the CuBLASLt version and achieved a latency of 56.47 ± 0.84 µs. The statistics for all kernel executions can be seen in the screenshot from the Nsight profiler in @Fig:nsight_fused. Notably, during the time period where the bulk of the computation was ongoing, the profiler showed the mean "SMs Active" (the percentage of cycles where an SM had at least 1 warp in flight) was around 3%. Since there are 28 SMs on the device, that means we are at 84% occupancy on 1/28=3.57% of the SMs.

![Screenshot of Nsight Systems profiler running the fused single-CTA kernel. The GPU Kernel Summary shows a slightly different latency result than the one measured through CUDA events of 56.14±12.76 µs.]({{ "assets/img/gpu-latency/NSight_1CTA.png" | relative_url }}){#fig:nsight_fused}

**Multi-CTA Cooperative Kernel** (filename: *ff_5l_256N_int8_fused_multiCTA.cu*)

To better utilize the GPU's parallel resources, the fused design was extended using CUDA cooperative groups. Instead of one CTA executing all neurons, multiple CTAs each compute a different slice of the neuron outputs for each layer. Activations are stored in small “ping-pong” buffers in global memory and exchanged between layers. After completing a layer, all CTAs perform a grid-wide synchronization, ensuring that the next layer reads a fully updated global activation vector. This introduces a minor global-memory latency but allows concurrent execution across many SMs. Empirically, I found that 8 CTAs worked best, but anything above 1 had a significant effect compared to the previous fused kernel.

Within each CTA, the same `__dp4a`-based accumulation logic is reused, maintaining identical arithmetic precision and tiling strategy. The cooperative launch (`cudaLaunchCooperativeKernel`) ensures hardware-level synchronization support across CTAs, enabling multiple SMs to work concurrently within a single kernel launch.

The results of this benchmark are seen in the rightmost panels in [@Fig:cuda_bench_histograms;@fig:cuda_bench_boxplots]. This version of the code achieved the lowest latency of 34.84 ± 0.64 µs. The statistics for all kernel executions can be seen in the screenshot from the Nsight profiler in @Fig:nsight_fused2. During the time period where the bulk of the computation was ongoing, the profiler showed the mean "SMs Active" (the percentage of cycles where an SM had at least 1 warp in flight) was around 26%. Since there are 28 SMs on the device, that means we are at 91% occupancy on 8/28=28.57% of the SMs.

![Screenshot of Nsight Systems profiler running the fused multi-CTA kernel. The GPU Kernel Summary shows a slightly different latency result than the one measured through CUDA events of 33.72±7.02 µs.]({{ "assets/img/gpu-latency/NSight_MultiCTA.png" | relative_url }}){#fig:nsight_fused2}

# Analysis {#sec:anal}
![A1000 GPU Streaming Multiprocessor Architecture.]({{ "assets/img/gpu-latency/A1000GPU.png" | relative_url }}){#fig:architecture}

The fused single-CTA kernel achieves a latency reduction of roughly 30% relative to the cuBLASLt baseline, primarily due to the elimination of intermediate global memory traffic and kernel-launch overhead between layers. The cooperative multi-CTA version adds another 38% improvement, by distributing work across multiple streaming multiprocessors (SMs), thus reducing weight-load serialization at the cost of some memory traffic for the activations. While this seems impressive, we can also estimate the ultimate inference latency for this task using the specs of the GPU, whose architecture is shown in @Fig:architecture.

**Minimum compute time (single-SM)**
Each layer performs 256 $\times$ 256 = 65,536 multiply-accumulate (MAC) operations, for a total of  $$ N_\text{MAC} = 5 \times 65536 = 327,680$$ 
MAC operations. At 8-bit precision with 32-bit accumulation, each `__dp4a` executes four MACs, requiring about 81,920 `__dp4a` instructions.

Ampere-generation SMs issue one warp instruction per cycle per scheduler, and each warp instruction advances 32 thread-instructions simultaneously. The RTX 3060’s SM contains 4 warp schedulers, allowing up to 4 warp-level integer ALU instructions to be dispatched per cycle when there is sufficient instruction-level parallelism. Thus, with a 1.78 GHz clock, the compute-bound lower limit is $$
t_\text{compute,1} \ge \frac{81,920}{4\cdot32\cdot 1.78\times10^9}\approx0.36~\mu\text{s}.$$
This represents the absolute floor if all operands remain resident in the single SM and every scheduler issues continuously with no pipeline stalls or bubbles.

**Minimum compute time (multi-SM)**
In the multi-CTA cooperative kernel, eight CTAs execute concurrently across eight SMs. Assuming perfect efficiency across all active SMs, the compute-only time ideally reduces to $$t_\text{compute,8}=t_\text{compute,1}/8=0.045~\mu\text{s}$$
However, the total latency also includes global memory traffic for inter-layer activations and synchronization barriers between layers. Full-grid synchronization imposes a barrier that enforces all threads in the grid finish computing the layer's activations before moving onto the subsequent layer.

**Memory & synchronization latency**
In the fused single-CTA kernel, while the lower bound of compute time is 0.36 µs, the measured latency of 56.47 µs implies that other factors such as memory accesses and synchronization costs dominate. While the multi-CTA kernel has an even lower measured latency of 34.84 µs, the overhead is an even larger multiple of the lower bound compute time of 0.045 µs.

Various memory accesses and thread synchronizations contribute toward the latency:

- Shared memory/L1 cache accesses take around 20–30 cycles (11–17 ns) per access.
- Synchronization costs similarly cost tens of cycles each. The single-SM code does around 20 calls to `__syncthreads`, so the worst-case cumulative cost is around 1–2 µs.
- L2 and global memory accesses take an order of magnitude longer, around 200–300 cycles (110–170 ns) per access.

Given each 256 $\times$ 256 weight matrix is 64 KiB, all five layers require ~320 KiB of global memory reads. Executing these as individual 128 B transactions, the worst-case memory access cost is $$t_{\rm mem}\le\frac{320 \times 10^3}{128} \frac{300}{1.78\times 10^9}=421.3~\mu\text{s.}$$
This indicates that in practice we are only seeing around 10% of the worst-case memory access latency. The kernels are written to hide as much of this latency as possible, so it seems reasonable that we are seeing only tens of microseconds in practice. Achieving further latency reduction will require reducing dependence on global memory.

One way to estimate the lower bound on the memory latency is to assume that some tiling strategy could keep all weights resident in shared memory, and then only activations would need to be written to global memory between layers. In this case, we would expect 256B to be written to global memory, and 256B to be read from global memory at each layer. Using the same math as above, computed for all 5 layers, the absolute lower bound on memory access latency would be $$t_{\rm mem}\ge 5\frac{2\cdot256}{128} \frac{200}{1.78\times 10^9}=2.25~\mu\text{s}$$
Adding the computation time $t_\text{compute,8}$ we should never expect any implementation to get below the lower bound of $$T\ge2.29~\mu\text{s.}$$
**Improvements with SoTA hardware**
The newest NVIDIA Blackwell architecture introduces a number of hardware advancements compared to the Ampere architecture used in these experiments. Although our small network size means we can't fully exploit the increased number of SMs available in Blackwell, there are some improvements which may still translate into latency reductions.

Blackwell introduces 5th generation tensor cores, which support higher clock speeds, and I've also seen claims of improved operations/cycle, although I haven't found too many details on this part. Considering 1.5$\times$ improvement of the clock speed, based on the boost clock of 2.617 GHz, this would reduce the lower bound on compute time even further to around 0.24 µs.

Blackwell also introduces improvements in L2 caching. I haven't found exact numbers yet, but supposing an estimate of L2 latency being 20–30% improved then we can expect that improvement to translate directly to all of the memory access latencies computed above. Interestingly, by looking at the L1 and L2 cache capacities, we can see that the L1/shared memory has stayed at 128 KB (per SM) since the Ampere generation, but the L2 capacity has increased from 6 MB in the GA102 chip to 64 MB in the GB203 chip; this suggests to me that the L1/shared memory is at some kind of optimum, while they are actively innovating to increase bandwidth and reduce latency to L2.

Taking these improvements together, it is reasonable to expect that the overall latency may reduce from the measured 34.8 µs to around 25–30 µs, but order of magnitude improvements seem to me to be out of the question.


# References
- [CUDA C++ Programming Guide](https://docs.nvidia.com/cuda/cuda-c-programming-guide/)
- [NVIDIA AMPERE GA102 GPU ARCHITECTURE](https://www.nvidia.com/content/PDF/nvidia-ampere-ga-102-gpu-architecture-whitepaper-v2.pdf)
- [Modal GPU Glossary](https://modal.com/gpu-glossary)
- [How to Optimize a CUDA Matmul Kernel for cuBLAS-like Performance: a Worklog](https://siboehm.com/articles/22/CUDA-MMM)
- [Inside NVIDIA GPUs: Anatomy of high performance matmul kernels](https://www.aleksagordic.com/blog/matmul)
- [Mini Project: GPU Accelerated Matrix Multiplication (almost) like cuBLAS](https://0mean1sigma.com/xgemm/)
- [GPU MODE Lecture 8: CUDA Performance Checklist](https://christianjmills.com/posts/cuda-mode-notes/lecture-008/)
- [Demystifying the Nvidia Ampere Architecture through Microbenchmarking and Instruction-level Analysis](https://arxiv.org/abs/2208.11174)
- [Inside NVIDIA Blackwell Ultra: The Chip Powering the AI Factory Era](https://developer.nvidia.com/blog/inside-nvidia-blackwell-ultra-the-chip-powering-the-ai-factory-era)
- [NVIDIA RTX PRO BLACKWELL GPU ARCHITECTURE](https://www.nvidia.com/content/dam/en-zz/Solutions/design-visualization/quadro-product-literature/NVIDIA-RTX-Blackwell-PRO-GPU-Architecture-v1.0.pdf)
