---
layout: index
title: hugh
---

<!-- # hugh -->

## hardware engineer

<div></div>

My background is in engineering physics, and I did my PhD working on neuromorphic computing using analog photonic substrates. I'm passionate about developing intelligent processing systems.

I believe that analog systems may one day catch up with and outpace digital ones, but I realized at some point during my PhD that starting my career in analog computing, before having a true understanding of modern computer architecture, was to my detriment. When getting into FPGAs (AMD RFSoCs), I was exposed to my own misunderstandings of how digital systems work, and this lit a fire in me that led me back into learning about digital systems, and I've spent the past while trying to teach myself all the basics that any competent computer engineer should know.

Below, you can find all the posts I make along the way. These will be updates on projects I'm working on, posts about the theory and history of computing and physics, takeaways from books I'm reading, and whatever else I decide fits the theme.


## posts
<ul class="posts-list">
{% for post in site.posts %}
<li>
  <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
  {% if post.description %}
  <br><em>{{ post.description }}</em>{% endif %}
</li>
{% endfor %}
</ul>