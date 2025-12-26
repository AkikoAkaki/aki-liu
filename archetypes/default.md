+++
# 文章创建日期，Hugo 会自动填充
date = '{{ .Date }}'
# 是否为草稿，设置为 true 则默认不会发布
draft = true
# 文章标题，默认取文件名并将连字符替换为空格，首字母大写
title = '{{ replace .File.ContentBaseName "-" " " | title }}'
+++
