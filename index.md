---
layout: index
title: ħugh
---

<!-- # hugh -->

## photonics engineer ([cv](/cv/))

<div></div>

I'm an engineer working on silicon photonic ASICs for accelerating AI.
I'm currently a research engineer at Hartley Ultrafast, where we're working to crush the latency in silicon photonic neural network accelerators to beat digital electronics.
In my free time recently, I've been working on what I think is the most feature-complete open-source optoelectronic circuit simulator in the world, [fairchild](https://github.com/hughmor/fairchild).
I'm based in Bristol in the UK at the moment, but I'll be relocating back to my hometown in Calgary, Canada in October 2026.

Optimizing hardware platforms to best support intelligent computing has always been fascinating to me, and I fell into the photonics community in 2018 and have been working at that intersection since.
I've been driven by the question of whether we can get analog systems to catch up to the dominance that digital processors have commanded, and AI seems like the natural place where they should excel if we can find the right match between algorithm and hardware.
For a long time I took digital systems for granted and for the past couple of years I've tried to rectify that gap by writing CUDA kernels and Verilog to learn about computer architecture.
I believe there is a lot of interesting work to be done in the future designing intelligent systems right up at the analog-digital interface.
The posts below will span many topics, from programming experiments to photonics simulations, to unstructured write ups of things that I'm thinking about.

## posts
<ul class="posts-list">
{% for post in site.posts %}
<li>
  <span class="post-title">
    <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
  </span>
  <span class="post-date">
  {{ post.date | date: "%B %Y" | downcase }}
  </span>
  {% if post.description %}
  <br><em>{{ post.description }}</em>{% endif %}
</li>
{% endfor %}
</ul>
<!-- 
## bullet journal
currently I'm thinking about the best ways to implement intelligent learning systems in hardware. the ideas in this bullet journal are anywhere 

-  -->