// Presentation state only. Business data, handlers and browser ownership remain in their original modules.
let stage = 'review';
let contactDisclosureOpen = false;
const stages = [['review','达人复核'],['prepare','话术与邀约'],['cloud','飞书交接'],['resources','资源导出'],['all','完整流程']];
export function enhanceWorkspace(page, state) {
  page.dataset.workspaceView = state.view;
  if (state.view !== 'exports') return;
  page.classList.add('native-delivery');
  const section=page.querySelector('.export-workbench');
  if (!section) return;
  const nav=document.createElement('nav');nav.className='delivery-stages';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','建联工作流程');
  const buttons=[];
  const apply=(next,animate=false)=>{
    stage=next;page.dataset.deliveryStage=next;
    buttons.forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.stage===next));b.tabIndex=b.dataset.stage===next?0:-1;});
    if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)section.animate([{opacity:.3,transform:'translateY(3px)'},{opacity:1,transform:'none'}],{duration:170,easing:'ease-out'});
  };
  stages.forEach(([key,label],index)=>{const b=document.createElement('button');b.type='button';b.dataset.stage=key;b.textContent=label;b.setAttribute('role','tab');b.addEventListener('click',()=>apply(key,true));b.addEventListener('keydown',e=>{let i=index;if(e.key==='ArrowRight')i=(i+1)%stages.length;else if(e.key==='ArrowLeft')i=(i+stages.length-1)%stages.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=stages.length-1;else return;e.preventDefault();apply(stages[i][0],true);buttons[i].focus();});buttons.push(b);nav.appendChild(b);});
  section.before(nav);
  const settings=section.querySelector('.contact-settings-section');
  const list=section.querySelector('.contact-review-list');
  if(list&&settings){section.appendChild(settings);}
  const contact=section.querySelector('.xhs-contact-status-panel');
  if(contact){const disclosure=document.createElement('details');disclosure.className='advanced-section contact-disclosure';const summary=document.createElement('summary');summary.textContent='联系方式补采';disclosure.appendChild(summary);contact.before(disclosure);disclosure.appendChild(contact);disclosure.open=contactDisclosureOpen||/正在|已暂停/.test(contact.querySelector('b')?.textContent||'');disclosure.addEventListener('toggle',()=>{contactDisclosureOpen=disclosure.open;});}
  const toolbars=Array.from(section.querySelectorAll(':scope > .export-review-toolbar'));
  const approval=toolbars.find(el=>el.textContent.includes('小蜜蜂'));
  if(approval)approval.dataset.workspaceRegion='prepare';
  const reviewTools=toolbars.find(el=>el!==approval),filters=section.querySelector('.export-filter-bar'),metrics=section.querySelector('.export-metrics');
  if(metrics&&list){let anchor=metrics;for(const node of [reviewTools,filters,list].filter(Boolean)){anchor.after(node);anchor=node;}}
  // The disclosure remains the original node, preserving focus/reading and every handler.
  if(settings){settings.open=true;settings.dataset.workspaceRegion='prepare';}
  section.querySelectorAll('.pgy-invite-batch-panel').forEach(el=>el.dataset.workspaceRegion='prepare');
  const handoff=page.querySelector('.feishu-workbench');if(handoff)handoff.dataset.workspaceRegion='cloud';
  const columns=page.querySelector('.resource-column-settings');if(columns)columns.dataset.workspaceRegion='resources';
  const heading=page.querySelector('h2');if(heading){heading.textContent='达人与建联';heading.dataset.eyebrow='WORKSPACE';}
  apply(stage);
}
