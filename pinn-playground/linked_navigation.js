/* Cross-panel navigation hints for v5; independent from the existing model and chart engine. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const labels={data:'MLP · no PDE loss',pinn:'PINN · λ = 0.3',strong:'PINN · λ = 2.0',wrong:'PINN · incorrect wave speed'};
  const modelLabel=byId('linkedResultModel');
  const historyModelLabel=byId('linkedHistoryModel');
  const limitsTitle=byId('linkedAssumptionTitle');
  const limitsDetail=byId('linkedAssumptionDetail');
  const toast=byId('linkedUpdateToast');
  let toastTimeout;
  const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function pulse(el){
    if(!el)return;
    el.classList.remove('recently-synced');
    void el.offsetWidth;
    el.classList.add('recently-synced');
  }
  function hideToast(){
    clearTimeout(toastTimeout);
    toast.hidden=true;
  }
  function showToast(name){
    byId('linkedToastTitle').textContent=name+' selected';
    toast.hidden=false;
    clearTimeout(toastTimeout);
    toastTimeout=setTimeout(hideToast,6500);
  }
  function scrollAndHighlight(el){
    hideToast();
    if(!el)return;
    const top=window.scrollY+el.getBoundingClientRect().top-14;
    window.scrollTo({top:Math.max(0,top),behavior:reducedMotion()?'auto':'smooth'});
    el.classList.remove('linked-focus-target');
    void el.offsetWidth;
    el.classList.add('linked-focus-target');
    setTimeout(()=>el.classList.remove('linked-focus-target'),2000);
  }
  function changed(id,source){
    if(!labels[id])return;
    modelLabel.textContent=labels[id];
    historyModelLabel.textContent=labels[id];
    pulse(byId('linkedHistoryContext'));
    const comparisonHeading=document.querySelector('#experiment .experiment-head h3');
    const comparisonTag=document.querySelector('#experiment .experiment-head .subtle-tag');
    if(id==='wrong'){
      comparisonHeading.textContent='Inspect a model trained with an incorrect physical assumption';
      comparisonTag.textContent='WAVE SPEED CHANGES';
    }else{
      comparisonHeading.textContent='Select a checkpoint trained with a different physics weight';
      comparisonTag.textContent='ONLY λPHYSICS CHANGES';
    }
    pulse(byId('linkedResultLine'));
    if(source==='limits'){
      const incorrect=id==='wrong';
      limitsTitle.textContent=incorrect?'Incorrect physics selected · c = 0.55':'Correct physics selected · c = 1.0';
      limitsDetail.textContent='The network, prediction maps, and training curves above now use the selected checkpoint.';
      pulse(byId('linkedAssumptionFeedback'));
      showToast(incorrect?'Incorrect-physics PINN':'Correct-physics PINN');
    } else {
      limitsTitle.textContent='Active comparison: '+labels[id];
      limitsDetail.textContent='Select a physical assumption above to synchronize the detailed model views.';
    }
  }
  for(const button of document.querySelectorAll('#experiment [data-model]')){
    button.addEventListener('click',()=>changed(button.dataset.model,'comparison'));
  }
  for(const button of document.querySelectorAll('#experiment [data-limit]')){
    button.addEventListener('click',()=>changed(button.dataset.limit==='wrong'?'wrong':'pinn','limits'));
  }
  byId('linkedJumpResults').addEventListener('click',()=>{
    byId('linkedReturnLimits').hidden=false;
    scrollAndHighlight(document.querySelector('#experiment .experiment-card'));
  });
  byId('linkedToastJump').addEventListener('click',()=>{
    byId('linkedReturnLimits').hidden=false;
    scrollAndHighlight(document.querySelector('#experiment .experiment-card'));
  });
  byId('linkedInspectNetwork').addEventListener('click',()=>scrollAndHighlight(byId('actualTrainedModel')));
  byId('linkedReturnLimits').addEventListener('click',()=>{
    byId('linkedReturnLimits').hidden=true;
    scrollAndHighlight(byId('limitsLab'));
  });
  // All shortcuts scroll to the original live chart; neither log values nor render code is modified.
  function jumpToHistory(fromLimits){
    byId('linkedHistoryReturnLimits').hidden=!fromLimits;
    if(fromLimits)byId('linkedReturnLimits').hidden=false;
    scrollAndHighlight(document.querySelector('#experiment .history-card'));
  }
  byId('linkedJumpHistory').addEventListener('click',()=>jumpToHistory(true));
  byId('linkedToastJumpHistory').addEventListener('click',()=>jumpToHistory(true));
  byId('linkedJumpHistoryFromResults').addEventListener('click',()=>jumpToHistory(false));
  byId('linkedHistoryViewResults').addEventListener('click',()=>{
    if(!byId('linkedHistoryReturnLimits').hidden) byId('linkedReturnLimits').hidden=false;
    scrollAndHighlight(document.querySelector('#experiment .experiment-card'));
  });
  byId('linkedHistoryReturnLimits').addEventListener('click',()=>{
    byId('linkedHistoryReturnLimits').hidden=true;
    scrollAndHighlight(byId('limitsLab'));
  });
  byId('linkedToastClose').addEventListener('click',hideToast);
  for(const nav of document.querySelectorAll('[data-view],[data-go]')){
    nav.addEventListener('click',()=>{hideToast();byId('linkedReturnLimits').hidden=true;byId('linkedHistoryReturnLimits').hidden=true;});
  }
})();
