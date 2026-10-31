/* A numerical teaching probe into the existing, saved tanh networks. */
(() => {
  'use strict';
  const host=document.getElementById('wave-explainer'),api=window.PINN_TEACHING;
  if(!host||!api)return;
  const labels={data:'MLP · λ = 0',pinn:'PINN · λ = 0.3',strong:'PINN · λ = 2.0',wrong:'Wrong-physics PINN · c = 0.55'};
  const steps=['Coordinates','Prediction','Input derivatives','PDE residual','Square it','Mean over probes'];
  const probes=[.25,.5,.75];
  let stage=0,x=.5,y=.5,t=api.getTime(),modelId=api.getModelId(),zero=false;
  const fmt=v=>Math.abs(v)>0&&Math.abs(v)<.0001?v.toExponential(4):v.toFixed(6);
  host.className='wave-probe';
  host.innerHTML=`
    <div class="wp-heading"><span class="small-kicker">TRY IT WITH ACTUAL SAVED WEIGHTS</span><h3>Follow one wave prediction into the physics loss.</h3><p>Choose a point, then move through the computation. The input derivatives below come from the saved network, using the chain rule through every tanh layer.</p></div>
    <div class="wp-source"><label for="wp-model">Saved model<select id="wp-model">${Object.entries(labels).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><button id="wp-zero" type="button" aria-pressed="false">Try a zero field</button><span id="wp-source-note">Real saved model · weights stay fixed</span></div>
    <div class="wp-steps" role="tablist" aria-label="Numerical physics-loss computation">${steps.map((s,i)=>`<button type="button" role="tab" id="wp-tab-${i}" aria-controls="wp-stage" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-probe-step="${i}"><span>0${i+1}</span>${s}</button>`).join('')}</div>
    <div class="wp-workspace"><div class="wp-picker"><canvas id="wp-map" width="240" height="240" tabindex="0" role="img" aria-label="Select a point on the saved prediction; arrow keys move by 0.01, Shift by 0.1. x increases right and y increases upward."></canvas><div class="wp-map-axis">x: 0 → 1 · y: 0 at bottom, 1 at top</div><div class="wp-map-legend"><i></i><span>height −1</span><span>0</span><span>+1</span></div><p class="wp-hint">Click the field or use arrow keys. White cross: your point. Dots: the nine teaching probes.</p>${['t','x','y'].map(k=>`<label class="wp-slider" for="wp-${k}"><span>${k==='t'?'Time t':'Position '+k}<output id="wp-${k}-value"></output></span><input type="range" id="wp-${k}" min="0" max="1" step="0.01" value="${k==='t'?t:.5}"></label>`).join('')}</div>
    <div class="wp-computation" id="wp-stage" role="tabpanel" aria-labelledby="wp-tab-0"><span class="small-kicker" id="wp-stage-label"></span><h4 id="wp-stage-title"></h4><div id="wp-equation" class="wp-equation"></div><p id="wp-explanation"></p><div id="wp-nine" hidden></div><div class="wp-navigation"><button type="button" id="wp-prev">← Previous</button><button type="button" id="wp-next">Next step →</button></div><div class="wp-reading" aria-live="polite" id="wp-reading"></div></div></div>
    <div class="wp-limit"><strong id="wp-limit-title"></strong><p id="wp-limit-copy"></p><div id="wp-zero-proof" hidden></div></div>
    <div class="wp-foot"><p>The mean uses only x,y ∈ {0.25, 0.50, 0.75} at the chosen time. A selected point outside that set does not enter it. These nine teaching probes are separate from training samples, recorded losses, and Experiment’s residual grid.</p><button type="button" id="wp-inspect">Inspect this point in Experiment ↗</button></div>`;
  const q=s=>host.querySelector(s),tabs=Array.from(host.querySelectorAll('[data-probe-step]'));
  const sample=(a,b)=>zero?{prediction:0,dtt:0,dxx:0,dyy:0,residual:0}:api.differentiate(api.getModel(modelId),t,a,b);
  function drawMap(){
    const cv=q('#wp-map'),c=cv.getContext('2d'),n=33,img=c.createImageData(n,n),model=api.getModel(modelId);
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const value=zero?0:api.evaluate(model,t,i/(n-1),1-j/(n-1));
      const col=colorWave(value),idx=4*(j*n+i);img.data.set([...col,255],idx);
    }
    const tmp=document.createElement('canvas');tmp.width=n;tmp.height=n;tmp.getContext('2d').putImageData(img,0,0);c.drawImage(tmp,0,0,240,240);
    for(const a of probes)for(const b of probes){c.beginPath();c.arc(a*240,(1-b)*240,3,0,2*Math.PI);c.fillStyle='#e8ddae';c.fill();c.strokeStyle='#102233';c.lineWidth=1;c.stroke();}
    const px=x*239,py=(1-y)*239;c.strokeStyle='#071925';c.lineWidth=5;c.beginPath();c.moveTo(px-9,py);c.lineTo(px+9,py);c.moveTo(px,py-9);c.lineTo(px,py+9);c.stroke();c.strokeStyle='#fff';c.lineWidth=2;c.stroke();
  }
  function render(){
    const d=sample(x,y),nine=probes.flatMap(b=>probes.map(a=>({x:a,y:b,r2:sample(a,b).residual**2}))),mean=nine.reduce((s,p)=>s+p.r2,0)/9;
    const titles=['Give the network a coordinate.','Predict the height at that coordinate.','Differentiate with respect to inputs.','Insert the derivatives into the wave equation.','Turn a signed mismatch into a penalty.','Average the penalties at nine points.'];
    const equations=[`z = (t, x, y) = (${t.toFixed(2)}, ${x.toFixed(2)}, ${y.toFixed(2)})`,`uθ(t, x, y) = ${fmt(d.prediction)}`,`uₜₜ = ${fmt(d.dtt)}<br>uₓₓ = ${fmt(d.dxx)}<br>uᵧᵧ = ${fmt(d.dyy)}`,`r = uₜₜ − (uₓₓ + uᵧᵧ)<br>= ${fmt(d.residual)}`,`r² = (${fmt(d.residual)})²<br>= ${fmt(d.residual**2)}`,`ℒ₉ = (1 / 9) Σⱼ rⱼ²<br>= ${fmt(mean)}`];
    const explanations=[
      'The input is time and position. It is not a previous wave image: this coordinate network directly returns a field value.',
      zero?'Here we deliberately use the exact mathematical field u = 0. This is a counterexample, not a trained checkpoint.':'This is the actual forward pass through the exported 3 → 48 → 48 → 48 → 1 tanh MLP.',
      'Automatic differentiation applies the chain rule to the network, giving second input derivatives. This differs from the gradients with respect to weights used to train it.',
      'For the true wave speed c = 1, the equation asks for r = 0. A positive or negative residual is a local mismatch. The wrong-physics model is also checked against this true equation.',
      'Squaring makes both signs contribute a nonnegative penalty. This selected point contributes to the displayed mean only if it is one of the nine probes.',
      'We evaluate the same derivatives at all nine fixed positions and average their squared residuals. A single point’s squared residual is not the full physics loss.'
    ];
    tabs.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===stage));b.tabIndex=i===stage?0:-1;});
    q('#wp-stage').setAttribute('aria-labelledby',`wp-tab-${stage}`);q('#wp-stage-label').textContent=`STEP 0${stage+1} / 06`;q('#wp-stage-title').textContent=titles[stage];q('#wp-equation').innerHTML=equations[stage];q('#wp-explanation').textContent=explanations[stage];
    q('#wp-nine').hidden=stage!==5;q('#wp-nine').innerHTML=`<div class="wp-probe-grid">${nine.map(p=>`<div><small>(${p.x.toFixed(2)}, ${p.y.toFixed(2)})</small><b>${fmt(p.r2)}</b></div>`).join('')}</div><small>Coordinates (x, y) · each value is r², before averaging</small>`;
    q('#wp-reading').textContent=`Selected (t, x, y) = (${t.toFixed(2)}, ${x.toFixed(2)}, ${y.toFixed(2)}) · ${zero?'exact zero field':labels[modelId]}`;
    q('#wp-prev').disabled=stage===0;q('#wp-next').disabled=stage===5;
    q('#wp-model').value=modelId;q('#wp-model').disabled=zero;q('#wp-zero').setAttribute('aria-pressed',String(zero));q('#wp-zero').textContent=zero?'Return to saved model':'Try a zero field';q('#wp-source-note').textContent=zero?'Exact mathematical counterexample · no weights changed':'Real saved model · weights stay fixed';
    for(const [key,value] of [['t',t],['x',x],['y',y]]){q(`#wp-${key}`).value=String(value);q(`#wp-${key}-value`).textContent=value.toFixed(2);}
    q('#wp-limit-title').textContent=zero?'Zero physics loss. Still the wrong wave.':'A small residual is only part of the story.';
    q('#wp-limit-copy').textContent=zero?'The zero field has uₜₜ = uₓₓ = uᵧᵧ = 0 everywhere, so its PDE residual and boundary mismatch vanish. It also has zero initial velocity. But it misses the required nonzero initial displacement.':'A network must also match the relevant observations and initial/boundary conditions. Try the exact zero field to see why the PDE residual alone is insufficient.';
    q('#wp-zero-proof').hidden=!zero;q('#wp-zero-proof').innerHTML='At t = 0, mean over the same nine positions:<br><code>mean |0 − u₀(x, y)|² = 0.282311111111</code><br><small>This initial-displacement mismatch is evaluated at t = 0 regardless of the time slider.</small>';
    q('#wp-inspect').disabled=zero;drawMap();
  }
  function selectStage(i,focus=false){stage=i;render();if(focus)tabs[i].focus();}
  tabs.forEach((b,i)=>{b.addEventListener('click',()=>selectStage(i));b.addEventListener('keydown',e=>{let next={ArrowRight:(i+1)%6,ArrowLeft:(i+5)%6,ArrowDown:(i+1)%6,ArrowUp:(i+5)%6,Home:0,End:5}[e.key];if(next!==undefined){e.preventDefault();selectStage(next,true);}});});
  q('#wp-prev').addEventListener('click',()=>selectStage(Math.max(0,stage-1)));q('#wp-next').addEventListener('click',()=>selectStage(Math.min(5,stage+1)));
  q('#wp-zero').addEventListener('click',()=>{zero=!zero;render();});q('#wp-model').addEventListener('change',e=>{modelId=e.target.value;render();});
  for(const key of ['t','x','y'])q(`#wp-${key}`).addEventListener('input',e=>{const v=Number(e.target.value);if(key==='t')t=v;else if(key==='x')x=v;else y=v;render();});
  q('#wp-map').addEventListener('pointerdown',e=>{const r=e.currentTarget.getBoundingClientRect();x=Math.round(clamp((e.clientX-r.left)/r.width,0,1)*100)/100;y=Math.round(clamp(1-(e.clientY-r.top)/r.height,0,1)*100)/100;e.currentTarget.focus();render();});
  q('#wp-map').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const d=e.shiftKey ? .1 : .01;if(e.key==='ArrowLeft')x-=d;if(e.key==='ArrowRight')x+=d;if(e.key==='ArrowDown')y-=d;if(e.key==='ArrowUp')y+=d;x=Math.round(clamp(x,0,1)*100)/100;y=Math.round(clamp(y,0,1)*100)/100;render();});
  q('#wp-inspect').addEventListener('click',()=>{
    document.querySelector('.nav-link[data-view="experiment"]').click();
    document.querySelector(modelId==='wrong'?'[data-limit="wrong"]':`[data-model="${modelId}"]`).click();
    for(const [id,value] of [['expTime',t],['g1X',x],['g1Y',y]]){const el=document.getElementById(id);el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));}
    requestAnimationFrame(()=>requestAnimationFrame(()=>document.getElementById('actualTrainedModel').scrollIntoView({block:'start',behavior:'auto'})));
  });
  // Keep original Learn tabs operable as an actual keyboard tablist.
  const lessonTabs=Array.from(document.querySelectorAll('.lesson-tab'));
  lessonTabs.forEach((b,i)=>{
    const panel=document.querySelector(`[data-lesson-panel="${b.dataset.lesson}"]`);b.id=`lesson-tab-${i}`;panel.id=`lesson-panel-${i}`;b.setAttribute('aria-controls',panel.id);panel.setAttribute('aria-labelledby',b.id);
    b.addEventListener('keydown',e=>{const next={ArrowRight:(i+1)%4,ArrowLeft:(i+3)%4,Home:0,End:3}[e.key];if(next!==undefined){e.preventDefault();lessonTabs[next].click();lessonTabs[next].focus();}});
  });
  const syncTabs=()=>lessonTabs.forEach(b=>b.tabIndex=b.getAttribute('aria-selected')==='true'?0:-1);
  new MutationObserver(syncTabs).observe(document.querySelector('.lesson-rail'),{subtree:true,attributes:true,attributeFilter:['aria-selected']});syncTabs();
  render();
})();
