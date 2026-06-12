{{- $base := .File.ContentBaseName -}}
{{- if eq $base "index" -}}
{{- $dir := strings.TrimSuffix "/" (replace .File.Dir "\\" "/") -}}
{{- $base = path.Base $dir -}}
{{- end -}}
---
# 标题：普通文件取文件名，叶子包取父目录名。
title: "{{ replace $base "-" " " | title }}"
# 日期：Hugo 按创建时间填充。
date: {{ .Date }}
# 标签：按需添加。
tags: []
# 草稿：true 表示默认不发布。
draft: true
# 如需 KaTeX 数学公式，可添加 math: true。
---
