---
layout: index
title: ħugh
---

<!-- # hugh -->

## photonics engineer ([cv](/cv/))


<div></div>

I'm an engineer working on silicon photonic ASICs for accelerating AI. I've been fascinated by AI since 2015 and it's been incredible to watch the field go from the academic interest it was when I was reading Bostrom's Superintelligence and playing around with simple neural nets in my undergrad, to it smashing onto the public scene, and now I'm working with agentic AI systems every day I sit down to work. While the algorithms and models often get the focus in discussions of AI, I think the hardware and the infrastructure that they rely on are so much more fascinating and important.

I'm currently a research engineer at Hartley Ultrafast, where we're working to crush the latency in silicon photonic neural network accelerators to beat digital electronics.

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