from PIL import Image, ImageChops
from pathlib import Path
import json, os
p=Path(os.environ['TEMP']); result=[]
for i in range(9):
 a=Image.open(p/f'aki-proof-before-{i}.png').convert('RGB'); b=Image.open(p/f'aki-proof-after-{i}.png').convert('RGB'); c=Image.open(p/f'aki-proof-repeat-{i}.png').convert('RGB')
 if a.size!=b.size or a.size!=c.size: result.append({'index':i,'sizeMismatch':[a.size,b.size,c.size]});continue
 def count(other):
  d=ImageChops.difference(a,other);return {'pixels':sum(1 for x in d.getdata() if x!=(0,0,0)),'bbox':d.getbbox()}
 result.append({'index':i,'dimensions':a.size,'beforeAfter':count(b),'baselineRepeat':count(c)})
print(json.dumps(result,ensure_ascii=False,indent=2))
