---
layout: default
title: "curriculum vitae"
permalink: /cv/
---

{% assign cv = site.data.Hugh_Morison_CV.cv %}
{% assign sections = cv.sections %}

<!-- <h1>{{ cv.name }}</h1> -->
<p>
  {% if cv.location %}{{ cv.location }} &middot; {% endif %}
  <a href="mailto:{{ cv.email }}">{{ cv.email }}</a>
</p>

{% comment %} util: date rendering (supports literal 'present') {% endcomment %}
{% assign date_fmt = "%b %Y" %}
{% capture nbsp %}&nbsp;{% endcapture %}

{% comment %} ========== education ========== {% endcomment %}
{% if sections.education %}
<h2>education</h2>
<ul class="cv-list">
  {% for ed in sections.education %}
  {% assign sd = ed.start_date %}
  {% assign edate = ed.end_date %}
  {% capture start_str %}{% if sd %}{{ sd | date: date_fmt }}{% endif %}{% endcapture %}
  {% capture end_str %}{% if edate %}{% if edate == "present" %}present{% else %}{{ edate | date: date_fmt }}{% endif %}{% endif %}{% endcapture %}
  <li class="cv-item">
    <div class="cv-row">
      <span><strong>{{ ed.institution }}</strong>&nbsp;&nbsp;{{ ed.degree }} in {{ ed.area }}</span>
      <!-- — {{ ed.location }} -->
      <span class="cv-dates">{{ start_str }}{% if end_str != "" %} – {{ end_str }}{% endif %}</span>
    </div>
    {% if ed.summary %}<div class="cv-summary">{{ ed.summary }}</div>{% endif %}
    {% if ed.highlights %}
    <ul class="cv-bullets">
      {% for h in ed.highlights %}<li>{{ h | markdownify | strip_newlines | remove: "<p>" | remove: "</p>" }}</li>{% endfor %}
    </ul>
    {% endif %}
  </li>
  {% endfor %}
</ul>
{% endif %}

{% comment %} ========== experience ========== {% endcomment %}
{% if sections.experience %}
<h2>experience</h2>
<ul class="cv-list">
  {% for ex in sections.experience %}
  {% assign sd = ex.start_date %}
  {% assign edate = ex.end_date %}
  {% capture start_str %}{% if sd %}{{ sd | date: date_fmt }}{% endif %}{% endcapture %}
  {% capture end_str %}{% if edate %}{% if edate == "present" %}present{% else %}{{ edate | date: date_fmt }}{% endif %}{% endif %}{% endcapture %}
  <li class="cv-item">
    <div class="cv-row">
      <span><strong>{{ ex.position }}</strong>&nbsp;&nbsp;{{ ex.company }}</span>
      <span class="cv-dates">{{ start_str }}{% if end_str != "" %} – {{ end_str }}{% endif %}</span>
    </div>
    {% if ex.summary %}<div class="cv-summary">{{ ex.summary }}</div>{% endif %}
    {% if ex.highlights %}
    <ul class="cv-bullets">
      {% for h in ex.highlights %}<li>{{ h | markdownify | strip_newlines | remove: "<p>" | remove: "</p>" }}</li>{% endfor %}
    </ul>
    {% endif %}
  </li>
  {% endfor %}
</ul>
{% endif %}

{% comment %} ========== skills ========== {% endcomment %}
{% if sections.skills %}
<h2>skills</h2>
<ul class="cv-list">
  {% for sk in sections.skills %}
  <li class="cv-item"><strong>{{ sk.label }}:</strong> {{ sk.details }}</li>
  {% endfor %}
</ul>
{% endif %}

{% comment %} ========== awards ========== {% endcomment %}
{% if sections.awards %}
<h2>awards</h2>
<ul class="cv-list">
  {% for aw in sections.awards %}
  <li class="cv-item"><strong>{{ aw.label }}:</strong> {{ aw.details }}</li>
  {% endfor %}
</ul>
{% endif %}

{% comment %} ========== outreach ========== {% endcomment %}
{% if sections.outreach %}
<h2>outreach</h2>
<ul class="cv-list">
  {% for ev in sections.outreach %}
  <li class="cv-item">
    <div class="cv-row">
      <span><strong>{{ ev.name }}</strong></span>
      <span class="cv-dates">{{ ev.date | date: date_fmt }}</span>
    </div>
    <div class="cv-summary">{{ ev.institution }}{% if ev.event %} &middot; {{ ev.event }}{% endif %}</div>
  </li>
  {% endfor %}
</ul>
{% endif %}

{% comment %} ========== selected publications ========== {% endcomment %}
{% if sections["Selected Publications"] %}
<h2>selected publications</h2>
<ol class="cv-pubs">
  {% for pub in sections["Selected Publications"] %}
  <li class="cv-pub">
    <div class="cv-pub-title"><strong>{{ pub.title }}</strong></div>
    {% if pub.authors %}
      {% assign authors_str = pub.authors | join: ", " | markdownify | strip_newlines | remove: "<p>" | remove: "</p>" %}
      <div class="cv-pub-authors">{{ authors_str }}</div>
    {% endif %}
    {% if pub.summary %}<div class="cv-pub-summary">{{ pub.summary }}</div>{% endif %}
    <div class="cv-pub-venue">
      {% if pub.url %}<a href="{{ pub.url }}">{{ pub.url }}</a>{% endif %}
      {% if pub.journal %}{% if pub.url %} ({{ pub.journal }}){% else %}{{ pub.journal }}{% endif %}{% endif %}
    </div>
    {% if pub.date %}
      <div class="cv-pub-date">{{ pub.date | date: "%b %Y" }}</div>
    {% endif %}
  </li>
  {% endfor %}
</ol>
{% endif %}