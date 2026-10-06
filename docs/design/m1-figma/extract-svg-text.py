"""Extract text and styles from archived SVG files without contacting Figma."""

from pathlib import Path
import xml.etree.ElementTree as E
import json
root=Path(__file__).resolve().parent
ns='{http://www.w3.org/2000/svg}'
def fix(s):
    try: return s.encode('latin1').decode('utf8')
    except (UnicodeEncodeError,UnicodeDecodeError): return s
mapping={'컴포넌트':'components','ICON':'icons','계정 역할 Content':'account-roles','역할별 접근 표':'role-access','P0 공통 개발 전달 사항':'common-guidance','계정 관리/account-management-screen.md':'account-management','내 계정/login-my-account-screen.md':'my-account','로그인·최초 설정·OTP/login-my-account-screen':'authentication','작업 목록/work-list-screen':'work-list','작업상세/work-detail-screen':'work-detail','새 작업 요청/new-work-request-screen':'new-work-request'}
manifest=[]
for f in (root/'exports/p0').rglob('*.svg'):
    tree=E.parse(f); svg=tree.getroot(); records=[]; groups=[]
    def walk(el,path):
        ident=fix(el.get('id',''))
        if el.tag==ns+'g' and ident:
            path=path+[ident]
            groups.append({'path':path,'transform':el.get('transform'),'child_count':len(el)})
        if el.tag==ns+'text':
            records.append({'index':len(records)+1,'path':path,'id':ident,'text':''.join(el.itertext()),'attributes':dict(el.attrib),'spans':[dict(c.attrib,text=''.join(c.itertext())) for c in el]})
        for child in el: walk(child,path)
    walk(svg,[])
    key=f.relative_to(root/'exports/p0').as_posix()[:-4]; slug=mapping[key]
    data={'source':f.relative_to(root).as_posix(),'width':svg.get('width'),'height':svg.get('height'),'groups':groups,'text':records}
    (root/'text'/f'{slug}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
    lines=[f'# {key} 원문', '', f'출처: `{data["source"]}`. SVG에 포함된 텍스트 전량. 순서는 SVG 계층 순서이며 화면 읽기 순서와 다를 수 있다.', '', '텍스트 ID와 계층 이름은 Figma node ID가 아니다. 위치와 글꼴·색상·각 tspan 좌표는 같은 이름의 JSON과 원본 SVG를 함께 참조한다.', '']
    prev=None
    for r in records:
        p=' / '.join(r['path'])
        if p!=prev: lines.extend(['## '+p,'']); prev=p
        lines.extend([f'### T{r["index"]:04d} {r["id"]}', '', r['text'].strip(), ''])
    (root/'text'/f'{slug}.md').write_text('\n'.join(lines),encoding='utf8')
    manifest.append({'slug':slug,'source':data['source'],'width':svg.get('width'),'height':svg.get('height'),'text_count':len(records),'top_groups':[g['path'] for g in groups if len(g['path'])<=2]})
(root/'text/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({"exports": len(manifest), "textNodes": sum(m["text_count"] for m in manifest)}))
