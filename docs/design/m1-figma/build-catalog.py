"""Rebuild the offline design index from saved evidence; never contacts Figma."""

from pathlib import Path
from collections import Counter
from html import unescape
import hashlib
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
FILE_KEY = "ijPZL5WxrjvxbHjBp0DoQa"


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def write_json(path, value):
    (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_md(path, value):
    (ROOT / path).write_text(value.strip() + "\n", encoding="utf-8")


def figma_link(node_id):
    return f"https://www.figma.com/design/{FILE_KEY}/?node-id={node_id.replace(':', '-')}"


def cell(value):
    return str(value).replace("|", "\\|").replace("\n", " ")


manifest = read_json("text/manifest.json")
nodes = read_json("text/node-index.json")
by_id = {n["id"]: n for n in nodes}
targets = read_json("evidence/mcp-targets.json") + read_json("evidence/mcp-extra-targets.json")
target_ids = {t["id"] for t in targets} | {"499:85"}
sections = {n["id"]: n for n in nodes if len(n["path"]) == 2}
exports = {Path(m["source"]).as_posix().removeprefix("exports/p0/").removesuffix(".svg"): m for m in manifest}
section_exports = {k: exports[v["name"]] for k, v in sections.items()}
root_xml = ET.fromstring((ROOT / "evidence/p0-node-tree.xml").read_text(encoding="utf-8"))
catalog = []


def walk(element, section=None, x=0, y=0):
    node_id = element.get("id")
    if node_id in sections:
        section, x, y = node_id, 0, 0
    elif section:
        x += float(element.get("x", "0"))
        y += float(element.get("y", "0"))
    if section and (node_id in target_ids or node_id == section):
        data = dict(by_id[node_id])
        data.update(section=section, slug=section_exports[section]["slug"],
                    source=section_exports[section]["source"],
                    rect=[x, y, float(data["width"]), float(data["height"])],
                    sectionSize=[float(sections[section]["width"]), float(sections[section]["height"])],
                    figma=figma_link(node_id))
        raw_path = f"evidence/mcp/{node_id.replace(':', '-')}.txt"
        if node_id == "499:85":
            raw_path = "evidence/mcp-status-tag.txt"
        data["mcp"] = raw_path if (ROOT / raw_path).exists() else None
        data["sparse"] = bool(data["mcp"] and "sparse metadata" in (ROOT / raw_path).read_text(encoding="utf-8"))
        source_text = read_json(f"text/{data['slug']}.json")["text"]
        data["text"] = [t["text"] for t in source_text if node_id == section or any(
            s.get("x") is not None and s.get("y") is not None and x <= float(s["x"]) <= x + data["rect"][2]
            and y <= float(s["y"]) <= y + data["rect"][3] for s in t["spans"])]
        catalog.append(data)
    for child in element:
        walk(child, section, x, y)


walk(root_xml)
write_json("text/catalog.json", catalog)

# Preserve annotation text exactly and attach its explicit node ID when available.
annotations = {}
descriptions = {}
raw_files = sorted((ROOT / "evidence/mcp").glob("*.txt")) + [ROOT / "evidence/mcp-status-tag.txt"]
for raw in raw_files:
    content = raw.read_text(encoding="utf-8")
    source = raw.relative_to(ROOT).as_posix()
    for tag in re.findall(r'<[^>]*data-[\w-]*annotations="[^"]*"[^>]*>', content):
        attr = re.search(r'data-([\w-]*annotations)="([^"]*)"', tag)
        node = re.search(r'data-node-id="([^"]*)"', tag)
        node_id = node.group(1) if node else raw.stem.replace("-", ":")
        text = unescape(attr.group(2))
        key = (node_id, text)
        annotations.setdefault(key, {"nodeId": node_id, "kind": attr.group(1), "text": text, "sources": []})["sources"].append(source)
    if "Component descriptions:" in content:
        tail = content.split("Component descriptions:", 1)[1].split("Image assets are stored", 1)[0]
        for name, node_id, text in re.findall(r'## ([^\n]+)\n\*\*Node ID:\*\* ([^\n]+)\n+(.*?)(?=\n## |\Z)', tail, re.S):
            key = (node_id.strip(), text.strip())
            descriptions.setdefault(key, {"nodeId": node_id.strip(), "name": name, "text": text.strip(), "sources": []})["sources"].append(source)
annotation_records = list(annotations.values())
description_records = list(descriptions.values())
write_json("text/annotations.json", annotation_records)
write_json("text/component-descriptions.json", description_records)
lines = ["# 노드에 연결된 개발 주석 원문", "", "MCP 원본에서 명시적 주석 속성과 컴포넌트 설명을 추출했다. 주변 TEXT 및 브라우저에서만 보인 주석은 [화면 명세](screen-spec.md)와 [수집 범위](coverage.md)를 함께 읽는다.", ""]
for title, rows in [("개발 주석", annotation_records), ("컴포넌트 설명", description_records)]:
    lines += [f"## {title}", ""]
    for i, row in enumerate(rows, 1):
        lines += [f"### {i}. {row.get('name', by_id.get(row['nodeId'], {}).get('name', row['nodeId']))}", "", f"노드: [{row['nodeId']}]({figma_link(row['nodeId'])}) · 원본: " + ", ".join(f"[{Path(p).name}]({p})" for p in dict.fromkeys(row["sources"])), "", row["text"], ""]
write_md("annotations.md", "\n".join(lines))

lines = ["# 화면·컴포넌트 노드 목록", "", "크기는 Figma 좌표계의 px다. 컴포넌트 세트 크기는 여러 변형을 배치한 영역 크기이며 단일 컴포넌트 크기가 아니다. 'SVG/텍스트'만 있어도 외형·문구는 열람할 수 있지만 MCP 상세 코드가 확보됐다는 뜻은 아니다.", "", "[오프라인 탐색기](index.html) · [명세](screen-spec.md) · [전체 노드 JSON](text/node-index.json)", ""]
for section_id, section in sections.items():
    export = section_exports[section_id]
    lines += [f"## {section['name']}", "", f"[{section_id}]({figma_link(section_id)}) · [원본 SVG](<{export['source']}>) · [텍스트](text/{export['slug']}.md)", "", "| 노드 | 화면/상태/컴포넌트 | 크기 | 상세 근거 |", "| --- | --- | --- | --- |"]
    for row in catalog:
        if row["section"] != section_id or row["id"] == section_id:
            continue
        evidence = f"[{'구조 메타데이터' if row['sparse'] else 'MCP'}]({row['mcp']})" if row["mcp"] else "SVG/텍스트"
        lines.append(f"| [{row['id']}]({row['figma']}) | {cell(row['name'])} | {row['width']} × {row['height']} | {evidence} |")
    lines.append("")
write_md("node-catalog.md", "\n".join(lines))

tokens = json.loads((ROOT / "evidence/mcp-variables.txt").read_text(encoding="utf-8"))
write_json("text/tokens.json", tokens)
fonts = Counter()
for m in manifest:
    for t in read_json(f"text/{m['slug']}.json")["text"]:
        a = t["attributes"]
        fonts[(a.get("font-family", "inherit"), a.get("font-size", "inherit"), a.get("font-weight", "400"))] += 1
lines = ["# 디자인 토큰과 타이포그래피", "", "변수는 저장된 MCP 응답 기준이다. 같은 색이라도 의미가 다른 토큰을 임의로 합치지 않는다. 타이포그래피 빈도는 SVG 전체의 반복 인스턴스를 포함하므로 스타일 정의 개수가 아니다.", "", "## 변수", "", "| 이름 | 값 |", "| --- | --- |"]
lines += [f"| {k} | `{v}` |" for k, v in tokens.items()]
lines += ["", "## SVG에서 관찰된 글꼴", "", "| 글꼴 | 크기 px | 굵기 | 텍스트 노드 수 |", "| --- | --- | --- | --- |"]
lines += [f"| {f} | {s} | {w} | {count} |" for (f, s, w), count in fonts.most_common()]
lines += ["", "## 재사용 시 확인", "", "- 주 글꼴은 Pretendard다. 글꼴 파일은 이 패키지에 포함하지 않았으므로 미설치 기기에서는 대체 글꼴로 보일 수 있다.", "- StatusTag `499:85`: 12px SemiBold, 좌우 10px/상하 4px, 모서리 4px. 개별 상태는 [주석](annotations.md)과 원본을 함께 참조한다.", "- Sidebar, InputField, FileUploadRow, 날짜·월·연도 선택, 버튼, 상태 배지, 테이블 및 계정 역할 메뉴 변형은 [노드 목록](node-catalog.md)에 연결했다.", "- 정확한 간격·행 높이·border·레이아웃은 각 MCP 원본과 SVG를 기준으로 구현한다. 생성 코드의 absolute 배치를 그대로 애플리케이션 구조로 채택하지 않는다."]
write_md("tokens.md", "\n".join(lines))

inventory = []
for f in sorted((ROOT / "exports").rglob("*.svg")):
    xml = ET.parse(f).getroot()
    image_refs = [e.get("href", e.get("{http://www.w3.org/1999/xlink}href", "")) for e in xml.iter() if e.tag.endswith("}image")]
    inventory.append({"path": f.relative_to(ROOT).as_posix(), "bytes": f.stat().st_size,
                      "sha256": hashlib.sha256(f.read_bytes()).hexdigest(), "imageReferences": image_refs,
                      "width": xml.get("width"), "height": xml.get("height")})
write_json("text/svg-inventory.json", inventory)
missing = [t for t in targets if t["id"] != "499:85" and not (ROOT / f"evidence/mcp/{t['id'].replace(':', '-')}.txt").exists()]
write_json("evidence/pending-mcp.json", missing)
viewer_data = {"catalog": catalog, "annotations": annotation_records, "descriptions": description_records}
template = (ROOT / "viewer-template.html").read_text(encoding="utf-8")
(ROOT / "index.html").write_text(template.replace('"__CATALOG_DATA__"', json.dumps(viewer_data, ensure_ascii=False).replace("</", "<\\/")), encoding="utf-8")
print(json.dumps({"catalog": len(catalog), "annotations": len(annotation_records), "descriptions": len(description_records), "tokens": len(tokens), "missingMcp": len(missing), "externalImageRefs": sum(len([u for u in x['imageReferences'] if not u.startswith('data:')]) for x in inventory)}))
