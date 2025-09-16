---
layout: index
title: hugh
---

<!-- # hugh -->
{% include social.html %}

## hardware engineer

<div></div>

My background is in engineering physics, and I did my PhD working on neuromorphic computing using analog photonic substrates. I'm passionate about developing intelligent processing systems; you can check out my Github, Google Scholar, and LinkedIn profiles using the links above.

I believe that analog systems may one day catch up with and outpace digital ones, but I realized at some point during my PhD that starting my career in analog computing, before having a true understanding of modern computer architecture, was to my detriment. When getting into FPGAs (AMD RFSoCs), I was exposed to my own misunderstandings of how digital systems work, and this lit a fire in me that led me back into learning about digital systems, and I've spent the past while trying to teach myself all the basics that any competent computer engineer should know.

The posts listed below are my attempt to publicly document my learning: updates on projects I'm working on, takeaways from books I'm reading, results of coding experiments, and whatever else I decide fits the theme. It's still very much a work in progress, but I hope anybody who comes across it finds it useful!

<!-- I'm still pretty bullish on analog computing in the long run, because my strong intuition is that the fundamental efficiency of analog hardware will eventually win out as we strive to make ever more intelligent and adaptable systems that consume less and less power, but in the meantime the picture is more murky. -->
 <!-- but I think asynchronous hybrid computers (analog + digital) are a really exciting avenue for the development of autonomous intelligent systems. -->


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
<!-- 
## bullet journal
currently I'm thinking about the best ways to implement intelligent learning systems in hardware. the ideas in this bullet journal are anywhere 

-  -->