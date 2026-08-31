{# Header override for the built-in `engineeringresumes` theme.                  #}
{# RenderCV checks <input file dir>/<theme>/<template> before its own templates  #}
{# and falls back per file, so this one file replaces the stock header only.     #}
{# Layout: name and headline on the left, connections in a grid flush right on   #}
{# the same band. The grid fills column by column so the icons line up.          #}
{# The stock photo branch is dropped. Restore it if you ever set `cv.photo`.     #}
{% set columns = 2 %}
{% set count = cv._connections|length %}
{% set rows = (count + columns - 1) // columns %}
#box(width: 100%, grid(
  columns: (1fr, auto),
  column-gutter: 0.6cm,
  align: (left + horizon, right + horizon),
  [
{% if cv.name %}
= {{ cv.name }}
{% endif %}
{% if cv.headline %}
    #headline([{{ cv.headline }}])
{% endif %}
  ],
  [
    #{
      set par(spacing: 0pt, leading: {{ design.typography.line_spacing }} * 1.7, justify: false)
      set text(
        fill: {{ design.colors.connections.as_rgb() }},
        font: "{{ design.typography.font_family.connections }}",
        size: {{ design.typography.font_size.connections }},
        weight: {{ 700 if design.typography.bold.connections else 400 }},
      )
      grid(
        columns: {{ columns }},
        column-gutter: {{ design.header.connections.space_between_connections }} * 2,
        row-gutter: {{ design.typography.line_spacing }} * 1.7,
        align: left,
{% for row in range(rows) %}
{% for column in range(columns) %}
{% set index = column * rows + row %}
{% if index < count %}
        [{{ cv._connections[index] }}],
{% else %}
        [],
{% endif %}
{% endfor %}
{% endfor %}
      )
    }
  ],
))
#v({{ design.header.space_below_connections }} - {{ design.section_titles.space_above }})
