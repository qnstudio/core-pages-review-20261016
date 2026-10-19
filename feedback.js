(() => {
  const endpoint = location.hostname==='127.0.0.1'||location.hostname==='localhost'?'http://127.0.0.1:4186/api/feedback':'https://core-review-feedback.qnstudio11.chatgpt.site/api/feedback';
  function read(k){try{return localStorage.getItem(k)||'';}catch{return '';}}
  function write(k,v){try{localStorage.setItem(k,v);return true;}catch{return false;}}
  const visitor=read('core-review-visitor')||crypto.randomUUID();
  const persistent=write('core-review-visitor',visitor);
  const date=new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'});
  const labels={page:'페이지 전체','member-empty':'회원 · 내역 없음','member-filled':'회원 · 내역 있음','guest-empty':'비회원 · 내역 없음','guest-filled':'비회원 · 내역 있음','member-overview':'회원 · 기본 화면','member-shopping':'회원 · 쇼핑 정보 펼침'};
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  async function api(method,data,page){const response=await fetch(endpoint+(page?'?page='+page:''),{method,headers:{'Content-Type':'application/json','X-Feedback-Key':visitor},...(data?{body:JSON.stringify(data)}:{}),cache:'no-store',signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error||'처리하지 못했습니다.');return result;}
  const loaders=new Map(),visible=new Set();
  document.querySelectorAll('.feedback').forEach(panel=>{
    const page=panel.dataset.page,form=panel.querySelector('form'),author=form.elements.author,body=form.elements.body,scope=form.elements.state;
    const status=panel.querySelector('.feedback-status'),list=panel.querySelector('.feedback-list'),count=panel.querySelector('.feedback-count'),save=form.querySelector('[type=submit]');
    const draftKey='core-review-draft-'+page;
    author.value=read('core-review-author');body.value=read(draftKey);
    let loading=false,busy=false,requestId=crypto.randomUUID(),items=[];
    const expanded=new Set();
    const directRequests=new Map();
    function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
    if(!persistent)message('브라우저 저장소가 차단되어 있습니다. 작성 후 편집 권한이 유지되지 않을 수 있습니다.',true);
    async function change(item,method,data){if(busy)return;busy=true;panel.setAttribute('aria-busy','true');message('저장 중입니다…');try{await api(method,{id:item.id,...data});message(method==='DELETE'?'삭제되었습니다.':'저장되었습니다.');busy=false;await load();}catch(error){message(error.message,true);}finally{busy=false;panel.removeAttribute('aria-busy');}}
    function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
    function requestButton(item){
      const revision=JSON.stringify([item.body,item.state,item.updatedAt,item.requestStatus]);
      let request=directRequests.get(item.id);
      if(!request||request.revision!==revision){request={revision,id:crypto.randomUUID(),state:'idle'};directRequests.set(item.id,request);}
      const b=button('',async()=>{
        if(request.state==='sending'||request.state==='sent')return;
        request.state='sending';update();message('이 대화로 보내는 중입니다…');
        let posting=false,accepted=false;
        const serverError=result=>{const code=typeof result?.code==='string'?result.code.replace(/[^A-Za-z0-9_-]/g,'').slice(0,60):'';const text=typeof result?.message==='string'?result.message.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,300):'요청을 전달하지 못했습니다.';return (code?'['+code+'] ':'')+text;};
        try{
          const ready=await fetch('http://127.0.0.1:4197/status',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)}),connection=await ready.json();
          if(!ready.ok||connection?.ok!==true)throw Error(serverError(connection));
          if(typeof connection.capability!=='string'||!connection.capability||connection.capability.length>4096)throw Error('이 PC의 검수 요청 연결 상태를 확인하지 못했습니다.');
          posting=true;
          const response=await fetch('http://127.0.0.1:4197/request',{method:'POST',headers:{'Content-Type':'application/json','X-QN-Review-Token':connection.capability},body:JSON.stringify({requestId:request.id,feedbackId:item.id,page:item.page||page}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)}),result=await response.json();
          if(!response.ok||result?.ok!==true)throw Error(serverError(result));
          if(typeof result.messageId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result.messageId))throw Error('전송 결과를 확인하지 못했습니다. 다시 누르면 같은 요청으로 확인합니다.');
          accepted=true;
          await api('PATCH',{id:item.id,action:'start_request'});
          request.state='sent';message('Codex 접수됨 · 요청작업중');await load();
        }catch(error){
          request.state=accepted?'sent':'idle';
          const unavailable=error instanceof TypeError||error?.name==='TimeoutError'||error instanceof SyntaxError;
          message(accepted?'요청은 접수됐지만 작업 상태를 저장하지 못했습니다. 새로고침 후 확인해 주세요.':unavailable?(posting?'전송 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요. ':'')+'이 PC의 검수 요청 연결기가 실행 중인지 확인해 주세요. Chrome에서 로컬 네트워크 접근 요청이 뜨면 허용해 주세요.':error.message,true);
        }finally{update();}
      });
      b.className='feedback-request-button';b.dataset.feedbackId=item.id;
      function update(){if(directRequests.get(item.id)!==request)return;list.querySelectorAll('.feedback-request-button').forEach(node=>{if(node.dataset.feedbackId!==item.id)return;node.disabled=request.state==='sending'||request.state==='sent'||item.requestStatus==='processing';node.textContent=request.state==='sending'?'보내는 중…':item.requestStatus==='processing'?'요청작업중':request.state==='sent'?'접수됨':item.requestStatus==='processed'?'다시 요청':'요청';});}
      b.disabled=request.state==='sending'||request.state==='sent'||item.requestStatus==='processing';b.textContent=request.state==='sending'?'보내는 중…':item.requestStatus==='processing'?'요청작업중':request.state==='sent'?'접수됨':item.requestStatus==='processed'?'다시 요청':'요청';
      return b;
    }
    function render(){
      list.replaceChildren();const completed=items.filter(i=>i.completedAt).length;count.textContent=`피드백 ${items.length} · 완료 ${completed}`;
      if(!items.length){list.append(el('li','아직 피드백이 없습니다.','feedback-empty'));return;}
      items.forEach(item=>{
        const li=el('li'),row=el('div',undefined,'feedback-row'),details=el('details'),summary=el('summary'),content=el('div',undefined,'feedback-content');
        summary.append(el('span',item.author));if(item.revisedAt)summary.append(el('span','✓','feedback-revised'));
        details.className=item.completedAt?'feedback-item completed':'feedback-item';details.open=expanded.has(item.id);details.addEventListener('toggle',()=>details.open?expanded.add(item.id):expanded.delete(item.id));
        summary.title=item.completedAt?'작성자 확인 완료':item.revisedAt?'보완 처리 · 작성자 확인 대기':'미완료';
        const meta=el('div',`${labels[item.state]||labels.page} · ${date.format(new Date(item.createdAt))}`,'feedback-meta');
        content.append(meta,el('p',item.body),el('span',item.completedAt?'작성자 확인 완료':item.revisedAt?'보완 처리 · 작성자 확인 대기':'미완료','feedback-state'));
        const actions=el('div',undefined,'feedback-actions');
        if(item.requestStatus)actions.append(el('span',item.requestStatus==='processing'?'요청작업중':'요청처리','feedback-request-status'));
        if(item.canEdit){
          actions.append(button(item.completedAt?'다시 열기':'확인 완료',()=>change(item,'PATCH',{action:item.completedAt?'reopen':'complete'})));
          actions.append(button('수정',()=>{
            if(content.querySelector('.feedback-editor'))return;
            const edit=el('form',undefined,'feedback-editor'),nameLabel=el('label','작성자'),name=el('input'),bodyLabel=el('label','내용'),text=el('textarea');
            name.value=item.author;name.maxLength=40;text.value=item.body;text.maxLength=2000;text.required=true;nameLabel.append(name);bodyLabel.append(text);
            const submit=el('button','수정 저장');submit.type='submit';edit.append(nameLabel,bodyLabel,submit,button('취소',()=>edit.remove()));
            edit.addEventListener('submit',e=>{e.preventDefault();change(item,'PATCH',{action:'edit',author:name.value,body:text.value});});content.append(edit);text.focus();
          }));
          actions.append(button('삭제',()=>{
            if(content.querySelector('.feedback-delete-confirm'))return;
            const box=el('div','이 피드백을 삭제할까요?','feedback-delete-confirm');box.append(button('삭제 확인',()=>change(item,'DELETE',{})),button('취소',()=>box.remove()));content.append(box);
          }));
        }else content.append(el('small','수정·삭제·완료는 작성한 브라우저에서 할 수 있습니다.','feedback-owner-note'));
        actions.append(requestButton(item));content.append(actions);
        const revise=button(item.revisedAt?'보완 처리':'보완',()=>change(item,'PATCH',{action:item.revisedAt?'unrevise':'revise'}));
        revise.className='feedback-revise-button';revise.title=item.revisedAt?'보완 처리 취소':'작업 후 보완 처리';revise.setAttribute('aria-pressed',String(!!item.revisedAt));
        details.append(summary,content);row.append(details,revise);li.append(row);list.append(li);
      });
    }
    async function load(){if(loading||busy)return;loading=true;try{items=(await api('GET',null,page)).items;render();}catch{count.textContent='불러오지 못했습니다. 새로고침해 주세요.';}finally{loading=false;}}
    loaders.set(panel,load);
    body.addEventListener('input',()=>{write(draftKey,body.value);requestId=crypto.randomUUID();});
    author.addEventListener('input',()=>{write('core-review-author',author.value);requestId=crypto.randomUUID();});
    scope.addEventListener('change',()=>requestId=crypto.randomUUID());
    panel.querySelector('.feedback-reload').addEventListener('click',load);
    panel.closest('section').querySelectorAll('[data-feedback-state]').forEach(b=>b.addEventListener('click',()=>{scope.value=b.dataset.feedbackState;scope.dispatchEvent(new Event('change'));body.focus();}));
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;if(!body.value.trim()){message('피드백 내용을 입력해 주세요.',true);return;}
      busy=true;save.disabled=true;author.disabled=true;body.disabled=true;scope.disabled=true;message('저장 중입니다…');
      try{await api('POST',{id:requestId,visitor,page,state:scope.value,author:author.value,body:body.value,website:form.elements.website.value});body.value='';write(draftKey,'');requestId=crypto.randomUUID();message('저장되었습니다. 작성자 이름을 눌러 확인하세요.');busy=false;await load();}
      catch(error){message(error.message+' 입력 내용은 유지됩니다.',true);}
      finally{busy=false;save.disabled=false;author.disabled=false;body.disabled=false;scope.disabled=false;}
    });
  });
  const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(isIntersecting){visible.add(target);loaders.get(target)();}else visible.delete(target);}),{rootMargin:'150px'});
  loaders.forEach((load,panel)=>observer.observe(panel));window.addEventListener('focus',()=>visible.forEach(p=>loaders.get(p)()));
  const dialog=document.querySelector('.capture-dialog');
  document.querySelectorAll('.capture-open').forEach(b=>b.addEventListener('click',()=>{const image=b.previousElementSibling.querySelector('img');dialog.querySelector('img').src=image.src;dialog.querySelector('img').alt=image.alt;dialog.querySelector('h3').textContent=image.alt;dialog.showModal();}));
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
})();

(() => {
  const queue=document.getElementById('work-items'),status=document.getElementById('work-status');
  if(!queue)return;
  const endpoint=location.hostname==='127.0.0.1'||location.hostname==='localhost'?'http://127.0.0.1:4186/api/work':'https://core-review-feedback.qnstudio11.chatgpt.site/api/work';
  const rows=[...document.querySelectorAll('[data-audit-row]')],completed=new Set();
  rows.forEach(row=>{
    const id=row.dataset.page,create=()=>{const b=document.createElement('button');b.type='button';b.className='work-complete';b.dataset.workPages=id;b.textContent='완료';b.disabled=true;return b;};
    row.querySelector('td:last-child').append(create());
    const section=document.getElementById(id),body=section?.querySelector('.catalog-detail-body');
    if(body){const actions=document.createElement('div');actions.className='page-work-actions';actions.append(create());body.prepend(actions);}
  });
  const completeButtons=[...document.querySelectorAll('.work-complete')];
  const pagesFor=button=>button.dataset.workPages.split(',').filter(Boolean);
  let ready=false,busy=false;
  function render(){
    queue.replaceChildren();let count=0;
    rows.forEach(row=>{
      const id=row.dataset.page,done=completed.has(id),action=row.querySelector('.work-reopen');
      action.disabled=!ready||busy;action.title=done?'작업 중 목록에 다시 추가':'작업 중 목록에 유지';
      if(done)return;
      count++;const item=document.createElement('div'),link=document.createElement('a'),button=document.createElement('button');
      item.className='work-item';link.href='#'+id;link.textContent=row.querySelector('td a').textContent;button.type='button';button.textContent='완료';button.disabled=!ready||busy;
      button.addEventListener('click',()=>save(id,true));item.append(link,button);queue.append(item);
    });
    completeButtons.forEach(button=>{const done=pagesFor(button).every(id=>completed.has(id));button.disabled=!ready||busy||done;button.textContent=done?'완료됨':'완료';button.setAttribute('aria-pressed',String(done));});
    document.getElementById('work-count').textContent=`${count}개`;
  }
  async function save(page,done){
    if(!ready||busy)return;busy=true;render();status.textContent='저장 중…';
    try{
      for(const id of (Array.isArray(page)?page:[page])){
        const response=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:id,completed:done}),cache:'no-store'});
        const result=await response.json();if(!response.ok)throw Error(result.error||'저장하지 못했습니다.');
        if(done)completed.add(id);else completed.delete(id);
      }
      status.textContent=done?'작업 중에서 내렸습니다. 전체현황에는 남아 있습니다.':'작업 중에 추가했습니다.';
    }catch(error){status.textContent=error.message;}finally{busy=false;render();}
  }
  rows.forEach(row=>row.querySelector('.work-reopen').addEventListener('click',()=>save(row.dataset.page,false)));
  completeButtons.forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();save(pagesFor(button),true);}));
  fetch(endpoint,{cache:'no-store'}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error||'불러오지 못했습니다.');result.items.forEach(item=>{if(item.completedAt)completed.add(item.page);else completed.delete(item.page);});ready=true;status.textContent='';render();}).catch(error=>{status.textContent=`작업 상태를 불러오지 못했습니다: ${error.message}`;render();});
  render();
})();

(() => {
 const search=document.getElementById('audit-search'),type=document.getElementById('audit-type'),evidence=document.getElementById('audit-evidence');
 if(!search)return;
 const rows=[...document.querySelectorAll('[data-audit-row]')];
 const filter=()=>{let count=0;const term=search.value.trim().toLowerCase();rows.forEach(row=>{const show=(!term||row.textContent.toLowerCase().includes(term))&&(type.value==='all'||row.dataset.type===type.value)&&(evidence.value==='all'||row.dataset.evidence===evidence.value);row.hidden=!show;if(show)count++;});document.getElementById('audit-count').textContent=count+'개 표시';};
 search.addEventListener('input',filter);type.addEventListener('change',filter);evidence.addEventListener('change',filter);filter();
 const reveal=()=>{const section=document.getElementById(location.hash.slice(1));const details=section?.classList.contains('catalog-detail')?section.querySelector('details'):null;if(details){details.open=true;section.scrollIntoView();}};
 addEventListener('hashchange',reveal);reveal();
})();

(() => {
 const sections=[...document.querySelectorAll('main>section')],overview=document.querySelector('.audit-catalog'),intro=document.querySelector('main>header'),links=[...document.querySelectorAll('[data-catalog-link]')];
 function select(){const id=location.hash.slice(1),sectionId=id==='changes-blocked'?'changes':id,selected=sections.find(s=>s.id===sectionId);sections.forEach(s=>{s.hidden=s!==selected;s.dataset.selected=String(s===selected);});if(overview)overview.hidden=!!selected;if(intro)intro.hidden=!!selected;links.forEach(a=>{if(a.hash==='#'+sectionId)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});if(selected){const d=selected.classList.contains('catalog-detail')?selected.querySelector(':scope>details'):null;if(d)d.open=true;const blocked=id==='changes-blocked'?document.getElementById(id):null;if(blocked){blocked.open=true;blocked.scrollIntoView();}else window.scrollTo(0,0);}}
 addEventListener('hashchange',select);select();
 document.getElementById('nav-search')?.addEventListener('input',e=>{const term=e.target.value.toLowerCase().trim();links.forEach(a=>a.hidden=!(a.textContent+' '+a.title).toLowerCase().includes(term));document.querySelectorAll('.nav-group').forEach(g=>{g.hidden=![...g.querySelectorAll('a')].some(a=>!a.hidden);if(term)g.open=true;});});
})();
