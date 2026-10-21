"""Reproduce committed OFL font subsets with requirements-fonts.txt; no outline changes."""
from pathlib import Path
import hashlib,json
from fontTools import subset
from fontTools.ttLib import TTFont
ROOT=Path(__file__).resolve().parents[1]
FONTS=ROOT/'apps/web/public/fonts'
UNICODES=set(range(0,0x250))|set(range(0x2000,0x2070))|set(range(0x20A0,0x20D0))|set(range(0x2190,0x2200))|set(range(0x25A0,0x27C0))|{0xFEFF}
def ranges(points):
    result=[];start=last=None
    for point in sorted(points):
        if last is not None and point==last+1:last=point;continue
        if last is not None:result.append(f'U+{start:04X}'+(f'-{last:04X}'if start!=last else''))
        start=last=point
    if last is not None:result.append(f'U+{start:04X}'+(f'-{last:04X}'if start!=last else''))
    return ', '.join(result)
faces=[];files=[]
for source,target,family,weight,style in [('cormorant-garamond.woff2','cormorant-garamond-latin.woff2','Cormorant Garamond','300 700','normal'),('cormorant-garamond-italic.woff2','cormorant-garamond-italic-latin.woff2','Cormorant Garamond','300 700','italic'),('dm-sans.ttf','dm-sans-latin.woff2','DM Sans','100 900','normal')]:
    font=TTFont(FONTS/source);points=set(font.getBestCmap());options=subset.Options();options.flavor='woff2';options.layout_features=['*'];options.name_IDs=['*'];options.name_languages=['*'];subsetter=subset.Subsetter(options=options);subsetter.populate(unicodes=sorted(UNICODES));subsetter.subset(font);font.flavor='woff2';font.save(FONTS/target)
    for filename,characters in [(source,points-UNICODES),(target,points&UNICODES)]:
        if characters:faces.append('@font-face {\n  font-family: "'+family+'";\n  src: url("/fonts/'+filename+'");\n  font-weight: '+weight+';\n  font-style: '+style+';\n  font-display: swap;\n  unicode-range: '+ranges(characters)+';\n}')
    files.append({'file':target,'sha256':hashlib.sha256((FONTS/target).read_bytes()).hexdigest()})
p=ROOT/'apps/web/src/styles/application.css';s=p.read_text();p.write_text('\n'.join(faces)+'\n'+s[s.index(':root'):])
p=FONTS/'SOURCES.json';data=json.loads(p.read_text());data['web_subsets']=files;data['web_subset_note']='FontTools 4.61.1 subsets Latin, punctuation, currency and UI symbols for initial transfer. Original variable axes, glyph outlines/layout features and full-font fallback coverage are retained. SIL OFL notices included.';p.write_text(json.dumps(data,indent=2)+'\n')
