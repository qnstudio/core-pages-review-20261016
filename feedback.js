(() => {
  const endpoint = 'https://core-review-feedback.qnstudio11.chatgpt.site/api/feedback';
  function read(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
  function write(key,value) { try { localStorage.setItem(key,value); } catch {} }
  const visitor = read('core-review-visitor') || crypto.randomUUID();
  write('core-review-visitor',visitor);
  const date = new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'});
  const visible = new Set();
  const loaders = new Map();
  document.querySelectorAll('.feedback').forEach(panel => {
    const page=panel.dataset.page,form=panel.querySelector('form'),author=form.elements.author,body=form.elements.body;
    const status=panel.querySelector('.feedback-status'),list=panel.querySelector('.feedback-list'),count=panel.querySelector('.feedback-count'),save=form.querySelector('[type=submit]');
    const draftKey='core-review-draft-'+page;
    author.value=read('core-review-author'); body.value=read(draftKey);
    let loading=false,saving=false,requestId=crypto.randomUUID();
    function message(text,error=false) { status.textContent=text; status.classList.toggle('error',error); }
    function render(items) {
      list.replaceChildren(); count.textContent='저장된 피드백 '+items.length+(items.length===100?' (최근 100개)':'');
      if(!items.length) {const li=document.createElement('li');li.className='feedback-empty';li.textContent='아직 피드백이 없습니다.';list.append(li);return;}
      items.forEach(item => {
        const li=document.createElement('li'),byline=document.createElement('div'),name=document.createElement('strong'),time=document.createElement('time'),text=document.createElement('p');
        byline.className='feedback-byline'; name.textContent=item.author;time.dateTime=new Date(item.createdAt).toISOString();time.textContent=date.format(new Date(item.createdAt));text.textContent=item.body;
        byline.append(name,time);li.append(byline,text);list.append(li);
      });
    }
    async function load() {
      if(loading||saving)return; loading=true;
      try { const response=await fetch(endpoint+'?page='+page,{cache:'no-store',signal:AbortSignal.timeout(15000)}); const data=await response.json(); if(!response.ok)throw Error(data.error);render(data.items); }
      catch {count.textContent='피드백을 불러오지 못했습니다.';}
      finally {loading=false;}
    }
    loaders.set(panel,load);
    body.addEventListener('input',()=>{write(draftKey,body.value);requestId=crypto.randomUUID();});
    author.addEventListener('input',()=>{write('core-review-author',author.value);requestId=crypto.randomUUID();});
    panel.querySelector('.feedback-reload').addEventListener('click',load);
    form.addEventListener('submit',async event => {
      event.preventDefault();if(saving)return;
      if(!body.value.trim()){message('피드백 내용을 입력해 주세요.',true);body.focus();return;}
      saving=true;save.disabled=true;author.disabled=true;body.disabled=true;message('저장 중입니다…');
      try {
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId,visitor,page,author:author.value,body:body.value,website:form.elements.website.value}),signal:AbortSignal.timeout(15000)});
        const data=await response.json();if(!response.ok)throw Error(data.error||'저장하지 못했습니다.');
        body.value='';write(draftKey,'');requestId=crypto.randomUUID();message('저장되었습니다. 다른 사람도 이 내용을 볼 수 있습니다.');
        saving=false;await load();
      } catch(error){message((error.message==='Failed to fetch'?'연결하지 못했습니다.':error.message)+' 입력 내용은 유지됩니다.',true);}
      finally {saving=false;save.disabled=false;author.disabled=false;body.disabled=false;}
    });
  });
  const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(isIntersecting){visible.add(target);loaders.get(target)();}else visible.delete(target);}),{rootMargin:'150px'});
  loaders.forEach((load,panel)=>observer.observe(panel));
  window.addEventListener('focus',()=>visible.forEach(panel=>loaders.get(panel)()));
})();
