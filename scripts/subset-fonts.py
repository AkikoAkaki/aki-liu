from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.subset import Options, Subsetter
import io, subprocess, json, re, sys, hashlib
root=Path(__file__).resolve().parents[1]
revision='a87998cdfd6cce3d2b5abedd5971bb3f72f57e08'
# Read originals from this immutable revision, never from generated subsets.
# Rerun after content, UI text, font styles, or font sources change. Font-source
# upgrades require updating revision and rechecking pixels before publishing.
source_paths=subprocess.check_output(['git','ls-tree','-r','--name-only',revision,'--','static/fonts/switzer','static/fonts/pp_editorial_old'],cwd=root,text=True).splitlines()
paths=[root/p for p in source_paths if p.endswith('.woff2')]+[root/'static/fonts/jetbrainsmono/v24/latin-normal.woff2',root/'static/fonts/newsreader/v26/latin-normal.woff2',root/'static/fonts/newsreader/v26/latin-italic.woff2']
core=set(range(0x20,0x7f))|set(range(0x00a0,0x0180))|{0xa0,0xad,0xe9,0x2010,0x2011,0x2012,0x2013,0x2014,0x2018,0x2019,0x201a,0x201c,0x201d,0x201e,0x2022,0x2026,0x20ac,0x2122,0xfffd}
# Keep all characters present in authored content and generated UI text in the
# same face as ASCII. This avoids breaking kerning and combining sequences.
for folder in ('content', 'data', 'assets', 'layouts'):
 for source in (root/folder).rglob('*'):
  if source.is_file() and source.suffix.lower() in ('.md','.html','.yaml','.yml','.toml','.json','.css','.js','.xml'):
   core.update(map(ord, source.read_text(encoding='utf-8',errors='replace')))
def ranges(values):
 vals=sorted(values); groups=[]
 for v in vals:
  if groups and v==groups[-1][-1]+1: groups[-1].append(v)
  else: groups.append([v])
 return ', '.join('U+%04X'%g[0]+('-%04X'%g[-1] if len(g)>1 else '') for g in groups)
def sync_css(metadata):
 mapping={}
 versions={}
 for rel, item in metadata.items():
  source=Path(rel)
  for label, value in item['ranges'].items():
   target=source if label=='core' else source.with_name(source.stem+'-ext.woff2')
   url='/'+target.relative_to('static').as_posix()
   mapping[url]=value
   versions[url]=hashlib.sha256((root/target).read_bytes()).hexdigest()[:16]
 for name in ('fonts-ui.css','fonts-latin.css','archive.css'):
  path=root/'assets/css'/name
  original=path.read_text(encoding='utf-8')
  def update(match):
   block=match.group(0)
   url=re.search(r'url\([\"\x27]?([^\"\x27)]+)',block)
   source_url=url[1].split('?')[0] if url else None
   if source_url not in mapping:
    return block
   block=block[:url.start(1)]+source_url+'?v='+versions[source_url]+block[url.end(1):]
   value=mapping[source_url]
   if not value:
    raise ValueError('Empty subset still referenced in CSS: '+url[1])
   declaration='unicode-range: '+value+';'
   if re.search(r'unicode-range\s*:',block):
    return re.sub(r'unicode-range\s*:[^;]+;',lambda _:declaration,block)
   return block[:-1].rstrip()+'\n    '+declaration+'\n}'
  updated=re.sub(r'@font-face\s*\{[^}]*\}',update,original)
  if updated!=original:
   path.write_text(updated,encoding='utf-8',newline='\n')
 # Preload and CSS must use identical URLs to reuse the same font response.
 path=root/'layouts/partials/head/page-assets.html'
 original=path.read_text(encoding='utf-8')
 def version_preload(match):
  source_url=match[0].split('?')[0]
  return source_url+'?v='+versions[source_url] if source_url in versions else match[0]
 updated=re.sub(r'/fonts/[^\s\"\x27<>]+\.woff2(?:\?[^\s\"\x27<>]*)?',version_preload,original)
 if updated!=original:
  path.write_text(updated,encoding='utf-8',newline='\n')

if '--css-only' in sys.argv:
 sync_css(json.loads((root/'scripts/font-subset-metadata.json').read_text(encoding='utf-8')))
 sys.exit(0)

info={}
for p in paths:
 rel=p.relative_to(root).as_posix(); data=subprocess.check_output(['git','show',revision+':'+rel],cwd=root)
 f=TTFont(io.BytesIO(data)); cmap=set(f.getBestCmap()); groups=[('core',cmap&core),('ext',cmap-core)]
 info[rel]={'original':len(data),'glyphs':len(f.getGlyphOrder()),'axes':[(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in f['fvar'].axes] if 'fvar' in f else [],'ranges':{k:ranges(v) for k,v in groups},'outputs':{}}
 for label,chars in groups:
  if not chars: continue
  font=TTFont(io.BytesIO(data),recalcBBoxes=('newsreader/v26/latin-italic' not in rel),recalcTimestamp=False);
  opts=Options(); opts.flavor='woff2'; opts.layout_features += ['tnum']; opts.hinting=True; opts.name_IDs=['*']; opts.name_legacy=True; opts.name_languages=['*']; subset=Subsetter(options=opts); subset.populate(unicodes=chars); subset.subset(font)
  out=p if label=='core' else p.with_name(p.stem+'-ext.woff2'); font.save(out); info[rel]['outputs'][label]=out.stat().st_size
  info[rel].setdefault('output_axes',{})[label]=[(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in font['fvar'].axes] if 'fvar' in font else []
(root/'scripts/font-subset-metadata.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
sync_css(info)
print('Generated',len(info),'fonts from',revision)
