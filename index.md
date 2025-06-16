---
layout: index
title: hugh
---

<!-- # hugh -->

## hardware engineer

<div></div>

I'm working on my PhD in neuromorphic coputing in analog photonic substrates. Recently, this has led me back into the digital world and I'm trying to understand the frontier of digital compute, which I'm going to document as much as I can in the posts below. I'm still pretty bullish on analog systems in the long run, but at this point I think hybrid analog/digital asynchronous computers are a really exciting avenue for the development of intelligent and autonomous systems.


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