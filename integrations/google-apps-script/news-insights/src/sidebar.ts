/** 외부 스크립트·폰트 없이 실행하는 시트 사이드바. 원문은 textContent로만 표시한다. */
export const SIDEBAR_HTML = `<!doctype html>
<html lang="ko"><head><base target="_top"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*{box-sizing:border-box}body{font:14px/1.6 system-ui,sans-serif;margin:0;padding:16px;color:#152547;background:#f6f8fc}
h1{font-size:20px;margin:0 0 8px}h2{font-size:16px;margin:18px 0 8px}label{display:block;font-weight:600;margin:12px 0 4px}
input,textarea,select,button{font:inherit;max-width:100%;border:1px solid #9ba9c1;border-radius:6px;padding:8px}
input,textarea,select{width:100%;background:white;color:#152547}textarea{min-height:96px;resize:vertical}
button{background:white;color:#152547;cursor:pointer;margin:6px 4px 0 0}button.primary{background:#244dbb;color:white;border-color:#244dbb}
button:disabled{opacity:.55;cursor:wait}:focus-visible{outline:3px solid #2966ef;outline-offset:2px}
.note{font-size:12px;color:#52617b}#status{white-space:pre-wrap;overflow-wrap:anywhere;padding:8px 0}
.preview{background:white;border:1px solid #d4deed;border-radius:12px;overflow:hidden;margin:8px 0}.preview img{display:block;width:100%;aspect-ratio:820/550;object-fit:cover}.preview p{padding:12px;margin:0;overflow-wrap:anywhere}
#candidateTitle{white-space:pre-wrap;overflow-wrap:anywhere}#candidateImage{width:100%;max-height:150px;object-fit:contain}a{color:#244dbb;overflow-wrap:anywhere}
[hidden]{display:none!important}
</style></head><body>
<h1>뉴스·인사이트 관리</h1><p class="note">검토한 기사만 게시합니다. 홈페이지는 최초 게시일 순으로 최대 3건을 표시합니다.</p>
<div id="status" role="status" aria-live="polite"></div>
<label for="newUrl">새 기사 URL</label><input id="newUrl" type="url" maxlength="2048" placeholder="https://" autocomplete="off">
<button id="create">초안 만들기·가져오기</button>
<label for="articles">등록한 기사</label><select id="articles"><option value="">기사를 선택하세요</option></select>
<button id="reload">목록 새로고침</button>
<section id="editor" hidden><h2>편집</h2><p id="recordStatus" class="note"></p><a id="source" target="_blank" rel="noopener noreferrer">기사 원문 열기</a>
<button id="fetch">원문 다시 가져오기</button>
<label for="title">편집 제목 (최대 300자)</label><textarea id="title" maxlength="600"></textarea>
<h2>가져온 후보</h2><p id="warning" class="note"></p><p id="candidateTitle"></p><button id="useTitle">후보 제목 적용</button><img id="candidateImage" alt="가져온 이미지 후보" hidden>
<label for="imageChoice">카드 이미지</label><select id="imageChoice"><option value="keep">저장된 이미지 유지</option><option value="candidate">가져온 이미지 후보 적용</option><option value="remove">이미지 없이 게시</option></select>
<label for="imageUrl">다른 대표 이미지 URL</label><input id="imageUrl" type="url" maxlength="2048" placeholder="https://" autocomplete="off"><button id="fetchImage">이미지 후보 가져오기</button>
<h2>카드 미리보기</h2><div class="preview"><img id="previewImage" alt="카드 미리보기 이미지" hidden><p id="noImage" class="note">이미지 없음 · 홈페이지에서 기본 이미지로 표시됩니다.</p><p id="previewTitle"></p></div>
<button id="save">편집본 저장</button><button id="publish" class="primary">저장하고 게시</button><button id="hide">홈페이지에서 숨김</button>
<p class="note">편집본 저장과 다시 가져오기는 공개된 카드를 바꾸지 않습니다. 게시 버튼에서만 반영됩니다.</p></section>
<script>
const byId = id => document.getElementById(id);
let records = [], selected = null, busy = false, dirty = false;
const warningText = {TITLE_MISSING:'제목을 찾지 못했습니다. 직접 입력해 주세요.',IMAGE_MISSING:'대표 이미지가 없습니다. 다른 이미지 URL을 입력하거나 이미지 없이 게시하세요.',IMAGE_UNAVAILABLE:'이미지를 가져오지 못했습니다. 다른 이미지 URL을 입력할 수 있습니다.',SOURCE_CHANGED:'이전 수집 이후 원문 후보가 달라졌습니다. 기존 편집값은 유지했습니다.'};
function message(text){byId('status').textContent=text;}
function rpc(method, value){return new Promise((resolve,reject)=>{const runner=google.script.run.withSuccessHandler(result=>result.ok?resolve(result.data):reject(new Error(result.message))).withFailureHandler(()=>reject(new Error('연결하지 못했습니다. 목록을 새로고침하고 저장 여부를 확인해 주세요.')));if(method==='list')runner.newsList();else runner.newsMutate(value);});}
function preview(){byId('previewTitle').textContent=byId('title').value||'제목을 입력해 주세요';const choice=byId('imageChoice').value;const image=choice==='candidate'?selected.candidateImage:choice==='remove'?'':selected.image;byId('previewImage').hidden=!image;byId('noImage').hidden=!!image;if(image)byId('previewImage').src='data:image/jpeg;base64,'+image;else byId('previewImage').removeAttribute('src');}
function render(){byId('articles').replaceChildren(new Option('기사를 선택하세요',''));records.forEach(record=>byId('articles').add(new Option('['+record.status+'] '+(record.title||record.url),record.id)));byId('articles').value=selected?.id||'';byId('editor').hidden=!selected;if(!selected)return;byId('title').value=selected.title;byId('source').href=selected.url;byId('recordStatus').textContent=selected.status+(selected.firstPublishedAt?' · 최초 게시 '+selected.firstPublishedAt.slice(0,10):'');byId('candidateTitle').textContent=selected.candidateTitle||'제목 후보가 없습니다.';byId('warning').textContent=warningText[selected.warning]||'가져온 후보를 검토한 뒤 적용해 주세요.';byId('candidateImage').hidden=!selected.candidateImage;if(selected.candidateImage)byId('candidateImage').src='data:image/jpeg;base64,'+selected.candidateImage;else byId('candidateImage').removeAttribute('src');byId('imageChoice').value='keep';dirty=false;preview();}
async function act(work){if(busy)return;busy=true;document.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);byId('editor').setAttribute('aria-busy','true');message('작업 중입니다…');try{await work();}catch(error){message(error.message);}finally{busy=false;document.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=false);byId('editor').setAttribute('aria-busy','false');}}
async function mutate(action, extra={}){const result=await rpc('mutate',{action,...(selected?{id:selected.id,etag:selected.etag}:{}),...extra});records=records.filter(record=>record.id!==result.id).concat(result);selected=result;render();return result;}
async function save(){await mutate('save',{title:byId('title').value,imageChoice:byId('imageChoice').value});}
function mayDiscard(){return !dirty||confirm('저장하지 않은 편집 내용이 있습니다. 버리고 계속할까요?');}
byId('create').onclick=()=>{if(!mayDiscard())return;act(async()=>{await mutate('create',{url:byId('newUrl').value.trim()});message('초안을 만들었습니다. 제목·이미지를 가져오는 중입니다…');await mutate('fetch');message('후보를 가져왔습니다. 제목·이미지를 검토하고 적용해 주세요.');});};
byId('reload').onclick=()=>{if(!mayDiscard())return;act(async()=>{const id=selected?.id;records=await rpc('list');selected=records.find(record=>record.id===id)||null;render();message('목록을 새로 불러왔습니다.');});};
byId('articles').onchange=()=>{if(!mayDiscard()){byId('articles').value=selected?.id||'';return;}selected=records.find(record=>record.id===byId('articles').value)||null;render();message('');};
byId('fetch').onclick=()=>act(async()=>{if(dirty)await save();await mutate('fetch');message('후보를 갱신했습니다. 편집값과 게시본은 유지됩니다.');});
byId('fetchImage').onclick=()=>act(async()=>{const url=byId('imageUrl').value.trim();if(!url)throw new Error('이미지 URL을 입력해 주세요.');if(dirty)await save();await mutate('fetch',{url});message('이미지 후보를 가져왔습니다. 적용할 이미지를 선택해 주세요.');});
byId('useTitle').onclick=()=>{if(!selected.candidateTitle){message('제목 후보가 없습니다. 직접 입력해 주세요.');return;}byId('title').value=selected.candidateTitle;dirty=true;preview();};
byId('title').oninput=byId('imageChoice').onchange=()=>{dirty=true;preview();};
byId('save').onclick=()=>act(async()=>{await save();message('편집본을 저장했습니다. 홈페이지 게시본은 유지됩니다.');});
byId('publish').onclick=()=>act(async()=>{await save();await mutate('publish');message('게시했습니다. 홈페이지 연결 후 최신 3건에 표시됩니다.');});
byId('hide').onclick=()=>act(async()=>{if(dirty)await save();await mutate('hide');message('홈페이지 공개 목록에서 숨겼습니다.');});
byId('previewImage').onerror=()=>{byId('previewImage').hidden=true;byId('noImage').hidden=false;};
act(async()=>{records=await rpc('list');render();message(records.length?'기사를 선택해 주세요.':'등록된 기사가 없습니다. URL로 초안을 만들어 주세요.');});
</script></body></html>`;
