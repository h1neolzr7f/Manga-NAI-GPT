import sys, csv, io, json
from PIL import Image
from pathlib import Path
import os
repo=sys.argv[1] if len(sys.argv)>1 else os.environ.get("MANGA_AUDIT_ROOT",str(Path(__file__).resolve().parents[2]))
sys.path.insert(0,repo)
import manga_bubble_ocr as b
import manga_smart_ocr as o

def tsv(words):
 out=io.StringIO(); cols=['level','page_num','block_num','par_num','line_num','word_num','left','top','width','height','conf','text']
 w=csv.DictWriter(out,fieldnames=cols,delimiter='\t');w.writeheader()
 for i,(text,x,y,ww,hh,conf) in enumerate(words):w.writerow(dict(level=5,page_num=1,block_num=1,par_num=1,line_num=1,word_num=i+1,left=x,top=y,width=ww,height=hh,conf=conf,text=text))
 return out.getvalue()
blank=io.BytesIO();Image.new('L',(160,100),255).save(blank,'PNG')
# Model output is deterministic TSV; page-space crop and production read_bubble run unchanged.
words=[('あ',40,40,20,20,99),('あ',61,40,20,20,98),('お',82,40,20,20,97)]
result=b.read_bubble(lambda crop,lang,psm:tsv(words) if lang=='jpn' else '',o.parse_tsv,(100,100,120,60,blank.getvalue()))
assert result['text']=='あお',result
print('CONFIRMED ADJACENT_REPEAT_LOST: expected ああお, actual '+json.dumps(result,ensure_ascii=False))
words=[('日',40,40,20,24,98),('本',61,42,20,18,97),('語',82,40,20,24,96)]
result=b.read_bubble(lambda crop,lang,psm:tsv(words) if lang=='jpn' else '',o.parse_tsv,(100,100,120,60,blank.getvalue()))
assert result['text']=='本日語',result
print('CONFIRMED HORIZONTAL_READING_ORDER: expected 日本語 on one row, actual '+json.dumps(result,ensure_ascii=False))
# Width/height inference loses a vertical engine's orientation on short multiple columns.
words=[('あ',90,40,20,20,99),('い',60,40,20,20,98),('う',30,40,20,20,97)]
result=b.read_bubble(lambda crop,lang,psm:tsv(words) if lang=='jpn_vert' else '',o.parse_tsv,(100,100,120,60,blank.getvalue()))
assert result['text']=='あいう' and result['vertical'] is False,result
print('CONFIRMED VERTICAL_MODE_LOST: vertical right-to-left text あいう marked vertical=false; '+json.dumps(result,ensure_ascii=False))
