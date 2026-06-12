{{- $dir := strings.TrimSuffix "/" (replace .File.Dir "\\" "/") -}}
{{- $bundle := path.Base $dir -}}
{{- $parent := path.Dir $dir -}}
{{- $yearDir := path.Dir $parent -}}
{{- $section := path.Base (path.Dir $yearDir) -}}
{{- $year := path.Base $yearDir -}}
{{- $month := path.Base $parent -}}
{{- $day := replaceRE "^([0-9]{2})-[0-9]{6}$" "$1" $bundle -}}
{{- $time := replaceRE "^[0-9]{2}-([0-9]{6})$" "$1" $bundle -}}
{{- if or (ne $section "microblog") (ne (len (findRE "^[0-9]{4}$" $year)) 1) (ne (len (findRE "^[0-9]{2}$" $month)) 1) (ne (len (findRE "^[0-9]{2}$" $day)) 1) (ne (len (findRE "^[0-9]{6}$" $time)) 1) -}}
{{- errorf "microblog archetype requires content/microblog/YYYY/MM/DD-HHMMSS; got %q" .File.Dir -}}
{{- end -}}
---
# 目录必须为 YYYY/MM/DD-HHMMSS。
date: {{ printf "%s-%s-%sT%s:%s:%s+08:00" $year $month $day (substr $time 0 2) (substr $time 2 2) (substr $time 4 2) }}
# 时间约定为 Asia/Shanghai +08:00。
# slug 会生成 /microblog/HHMMSS/。
slug: {{ $time }}
# 标签：按需添加。
tags: []
# 设为 true 可暂缓发布。
draft: false
---
