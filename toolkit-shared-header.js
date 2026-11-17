(function(){
  if(document.getElementById('stk-shared-header')) return;
  const KEY='startingToolkitLanguage';
  const saved=localStorage.getItem(KEY)||localStorage.getItem('startingToolkitLang')||'pt';
  let current=['pt','en','es'].includes(saved.slice(0,2))?saved.slice(0,2):'pt';
  const copy={
    pt:{dashboard:'Painel',language:'Idioma',titles:{'my-idea.html':'Minha Ideia','my-model.html':'Meu Modelo de Negócio','my-market.html':'Meu Mercado','my-swot.html':'Análise SWOT','my-numbers.html':'Meu Planejamento Financeiro','my-marketing.html':'Meu Marketing','my-launch.html':'Meu Lançamento','my-first-90-days.html':'Meus Primeiros 90 Dias','my-team-payroll.html':'Minha Equipe e Folha de Pagamento','your-final-plan.html':'Plano Final','business-glossary.html':'Glossário'}},
    en:{dashboard:'Dashboard',language:'Language',titles:{'my-idea.html':'My Idea','my-model.html':'My Business Model','my-market.html':'My Market','my-swot.html':'My SWOT','my-numbers.html':'My Numbers','my-marketing.html':'My Marketing','my-launch.html':'My Launch','my-first-90-days.html':'My First 90 Days','my-team-payroll.html':'My Team & Payroll','your-final-plan.html':'Your Final Plan','business-glossary.html':'Business Glossary'}},
    es:{dashboard:'Panel',language:'Idioma',titles:{'my-idea.html':'Mi Idea','my-model.html':'Mi Modelo de Negocio','my-market.html':'Mi Mercado','my-swot.html':'Análisis SWOT','my-numbers.html':'Mis Finanzas','my-marketing.html':'Mi Marketing','my-launch.html':'Mi Lanzamiento','my-first-90-days.html':'Mis Primeros 90 Días','my-team-payroll.html':'Mi Equipo y Nómina','your-final-plan.html':'Plan Final','business-glossary.html':'Glosario'}}
  };
  const file=location.pathname.split('/').pop()||'';
  const header=document.createElement('header');header.id='stk-shared-header';
  const brand=document.createElement('a');brand.className='stk-brand';brand.href='dashboard.html';brand.textContent='STARTING TOOLKIT';
  const tools=document.createElement('div');tools.className='stk-tools';
  const dash=document.createElement('a');dash.className='stk-dashboard';dash.href='dashboard.html';dash.textContent=copy[current].dashboard;
  const select=document.createElement('select');select.id='stk-shared-language';select.setAttribute('aria-label',copy[current].language);
  [['pt','Português'],['en','English'],['es','Español']].forEach(([v,label])=>{const o=document.createElement('option');o.value=v;o.textContent=label;select.appendChild(o)});
  select.value=current;tools.append(dash,select);header.append(brand,tools);
  document.body.insertBefore(header,document.body.firstChild);
  const titleMap=copy;
  function applyTitle(lang){
    const title=titleMap[lang].titles[file];if(!title)return;
    const el=document.querySelector('h1#title, h1');if(el && el.textContent!==title){el.textContent=title;}
    const pageTitle='Starting Toolkit - '+title;if(document.title!==pageTitle)document.title=pageTitle;
  }
  function setLanguage(lang){
    current=lang;localStorage.setItem(KEY,lang);localStorage.setItem('startingToolkitLang',lang);
    dash.textContent=copy[lang].dashboard;select.setAttribute('aria-label',copy[lang].language);
    document.documentElement.lang=lang==='pt'?'pt-BR':lang==='es'?'es-ES':'en';
    const legacy=document.querySelector('select#language,select#lang');
    if(legacy){legacy.value=lang;legacy.dispatchEvent(new Event('change',{bubbles:true}));}
    const langButton=document.querySelector('[data-lang=\"'+lang+'\"]');if(langButton)langButton.click();
    applyTitle(lang);
  }
  select.addEventListener('change',()=>setLanguage(select.value));
  applyTitle(current);
  const titleObserver=new MutationObserver(()=>applyTitle(current));
  const titleNode=document.querySelector('h1#title, h1');if(titleNode)titleObserver.observe(titleNode,{childList:true,subtree:true,characterData:true});
  // Keep the shared selector synchronized if a module changes its own language control.
  document.addEventListener('change',e=>{if(e.target&&e.target.matches('select#language,select#lang')){const v=e.target.value;if(['pt','en','es'].includes(v)&&v!==current){current=v;select.value=v;localStorage.setItem(KEY,v);localStorage.setItem('startingToolkitLang',v);dash.textContent=copy[v].dashboard;applyTitle(v)}}});
})();
