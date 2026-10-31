/* PINN Playground — independent browser application.
 * Explore: finite-difference 2-D wave simulation (not a PINN prediction).
 * Learn: general interactive PINN explanation (no fixed equation).
 * Experiment: PyTorch-trained model weights exported to JavaScript, no synthetic model predictions.
 */
'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const MODELS = window.PINN_MODELS?.models;
if(MODELS && window.PINN_WRONG_MODEL) MODELS.wrong = window.PINN_WRONG_MODEL;
if (!MODELS) console.error('Missing model_data.js: run train_models.py to create it.');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const format=(v,d=3)=>Number.isFinite(v)?(Math.abs(v)<.0005 && v!==0?v.toExponential(2):v.toFixed(d)):'—';

// Two exact standing-wave modes on a unit square with homogeneous Dirichlet boundary.
function analyticWave(t,x,y){return .76*Math.sin(Math.PI*x)*Math.sin(Math.PI*y)*Math.cos(Math.PI*Math.SQRT2*t)+.24*Math.sin(2*Math.PI*x)*Math.sin(Math.PI*y)*Math.cos(Math.PI*Math.sqrt(5)*t)}

// Standard feedforward evaluation of the real PyTorch-exported trained MLP.
function evaluate(model,t,x,y){
 let a=[t,x,y];
 for(let L=0;L<model.layers.length;L++){
  const layer=model.layers[L];const last=L===model.layers.length-1;const next=new Array(layer.bias.length);
  for(let k=0;k<next.length;k++){
    const w=layer.weights[k];let z=layer.bias[k];
    for(let j=0;j<a.length;j++) z+=w[j]*a[j];
    next[k]=last?z:Math.tanh(z);
  }
  a=next;
 }
 return a[0];
}

// Forward-mode automatic differentiation through tanh MLP layers.
// Each neuron carries value, gradient [dt,dx,dy], and diagonal Hessian [dtt,dxx,dyy].
// This matches PyTorch's autograd (chain rule); we export weights after training for offline use.
function differentiate(model,t,x,y){
 let a=[t,x,y],grad=[[1,0,0],[0,1,0],[0,0,1]],hess=[[0,0,0],[0,0,0],[0,0,0]];
 for(let L=0;L<model.layers.length;L++){
  const layer=model.layers[L];const last=L===model.layers.length-1;
  const v=new Array(layer.bias.length),g=new Array(v.length),h=new Array(v.length);
  for(let k=0;k<v.length;k++){
    const w=layer.weights[k];let z=layer.bias[k];const dz=[0,0,0],d2z=[0,0,0];
    for(let j=0;j<a.length;j++){
      const wj=w[j];z+=wj*a[j];
      dz[0]+=wj*grad[j][0];dz[1]+=wj*grad[j][1];dz[2]+=wj*grad[j][2];
      d2z[0]+=wj*hess[j][0];d2z[1]+=wj*hess[j][1];d2z[2]+=wj*hess[j][2];
    }
    if(last){v[k]=z;g[k]=dz;h[k]=d2z}
    else{
      const v0=Math.tanh(z),f1=1-v0*v0,f2=-2*v0*f1;
      v[k]=v0;g[k]=dz.map(d=>f1*d);h[k]=d2z.map((d,axis)=>f1*d+f2*dz[axis]*dz[axis]);
    }
  }
  a=v;grad=g;hess=h;
 }
 const residual=hess[0][0]-hess[0][1]-hess[0][2];
 return {prediction:a[0],dtt:hess[0][0],dxx:hess[0][1],dyy:hess[0][2],residual};
}

// Tab navigation. All pages are in the same browser app.
function openView(name){
 $$('.view').forEach(n=>n.classList.toggle('active',n.id===name));
 $$('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
 if(name==='learn')renderSamplePoints();
 if(name==='experiment')requestExperimentUpdate();
 // Each tab is a separate page-like view: always start at its top.
 const root=document.scrollingElement || document.documentElement;
 const previousBehavior=root.style.scrollBehavior;
 root.style.scrollBehavior='auto';
 window.scrollTo(0,0);
 requestAnimationFrame(()=>{
   window.scrollTo(0,0);
   root.style.scrollBehavior=previousBehavior;
 });
}
$$('[data-view]').forEach(n=>n.addEventListener('click',()=>openView(n.dataset.view)));
$$('[data-go]').forEach(n=>n.addEventListener('click',()=>openView(n.dataset.go)));

// Explore: a true finite-difference wave solver + light-responsive water material.
// The shader only changes presentation; arbitrary-click results are NOT PINN predictions.
const water=$('#water-canvas');
const N=112;
let curr=new Float32Array(N*N),prev=new Float32Array(N*N),next=new Float32Array(N*N);
let waterSpeed=.68,dropStrength=.7,paused=false,dropCount=0,lastFrame=0;
const pond=window.createPondRenderer?.(water,N);
if(!pond) console.warn('WebGL unavailable; switch to software water visualization.');
let ctx=null;
if(!pond)ctx=water.getContext('2d');
const cpuPond=ctx?window.createCpuWaterRenderer?.(ctx,N):null;
function dropAt(x,y,strength=dropStrength){
  x=clamp(x,6,N-7);y=clamp(y,6,N-7);
  const radius=4.8;
  for(let i=Math.max(1,Math.floor(x-4*radius));i<Math.min(N-1,Math.ceil(x+4*radius));i++){
    for(let j=Math.max(1,Math.floor(y-4*radius));j<Math.min(N-1,Math.ceil(y+4*radius));j++){
      const r2=(i-x)**2+(j-y)**2;
      const amount=strength*Math.exp(-r2/(radius*radius));
      curr[i*N+j]+=amount;prev[i*N+j]+=amount;
    }
  }
  if(pond) pond.dropAt(x,y);
  dropCount++;$('#rippleCounter').textContent=String(dropCount).padStart(2,'0')+' disturbances';
}
function resetWater(){curr.fill(0);prev.fill(0);next.fill(0);dropCount=0;$('#rippleCounter').textContent='00 disturbances';dropAt(N*.53,N*.54,.85)}
function advanceWater(){
  const k=.12+waterSpeed*.33;
  for(let i=1;i<N-1;i++)for(let j=1;j<N-1;j++){
    const q=i*N+j;
    const lap=curr[q+N]+curr[q-N]+curr[q+1]+curr[q-1]-4*curr[q];
    next[q]=1.993*curr[q]-.993*prev[q]+k*lap;
  }
  for(let i=0;i<N;i++){next[i]=0;next[(N-1)*N+i]=0;next[i*N]=0;next[i*N+N-1]=0;}
  const old=prev;prev=curr;curr=next;next=old;
}
function sizeCanvas(canvas){const dpr=Math.min(window.devicePixelRatio||1,1.6);const w=canvas.clientWidth,h=canvas.clientHeight;const cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}return {w:cw,h:ch};}
function drawWater(t){
 if(pond){pond.render(curr,t);return;}
 if(cpuPond){cpuPond.render(curr,t);return;}
 const {w,h}=sizeCanvas(water);ctx.fillStyle='#0a343e';ctx.fillRect(0,0,w,h);
}
function onCanvasDrop(ev){
  if(pond){const p=pond.eventToGrid(ev);dropAt(p.x,p.y);}
  else{const r=water.getBoundingClientRect();dropAt((ev.clientX-r.left)/r.width*(N-1),(1-(ev.clientY-r.top)/r.height)*(N-1));}
}
water.addEventListener('pointerdown',onCanvasDrop);
$('#dropButton').addEventListener('click',()=>dropAt(16+Math.random()*(N-32),16+Math.random()*(N-32)));
$('#resetButton').addEventListener('click',resetWater);
$('#playButton').addEventListener('click',()=>{paused=!paused;$('#playButton').textContent=paused?'▶ Resume':'Ⅱ Pause';$('.stage-status').textContent=paused?'◉ SIMULATION PAUSED':'● SIMULATION RUNNING'});
$('#dropStrength').addEventListener('input',e=>{dropStrength=Number(e.target.value);$('#strengthReadout').textContent=dropStrength.toFixed(2)});
$('#waveSpeed').addEventListener('input',e=>{waterSpeed=Number(e.target.value);$('#waveSpeedValue').textContent=waterSpeed.toFixed(2);$('#speedReadout').textContent=waterSpeed.toFixed(2)});
const sensorCoords=[{x:.18,y:.22},{x:.37,y:.39},{x:.58,y:.18},{x:.78,y:.44},{x:.26,y:.75},{x:.54,y:.67},{x:.81,y:.78}];
let sensorsOn=false, selectedSensor=0;
const overlay=$('#sensorOverlay');
sensorCoords.forEach((loc,i)=>{
 const b=document.createElement('button');b.type='button';b.className='sensor-marker';b.style.left=`${loc.x*100}%`;b.style.top=`${loc.y*100}%`;b.textContent=String(i+1);b.setAttribute('aria-label',`Read sensor ${i+1}`);
 b.addEventListener('click',(e)=>{e.stopPropagation();selectedSensor=i;updateSensorReadout();});overlay.appendChild(b);
});
function updateSensorReadout(){
 if(!sensorsOn)return;
 overlay.querySelectorAll('.sensor-marker').forEach((b,i)=>b.classList.toggle('selected',i===selectedSensor));
 const p=sensorCoords[selectedSensor],i=Math.max(0,Math.min(N-1,Math.round(p.x*(N-1)))),j=Math.max(0,Math.min(N-1,Math.round((1-p.y)*(N-1))));
 const value=curr[i*N+j];
 $('#sensorReadout').textContent=`Probe ${selectedSensor+1}: relative surface height ${value>=0?'+':''}${value.toFixed(3)} (simulation units). The rest of the field is unmeasured.`;
}
$('#sensorToggle').addEventListener('click',()=>{sensorsOn=!sensorsOn;overlay.hidden=!sensorsOn;$('#sensorToggle').textContent=sensorsOn?'Hide sensors':'Show 7 sensors';$('#sensorToggle').setAttribute('aria-pressed',String(sensorsOn));if(sensorsOn)updateSensorReadout();else $('#sensorReadout').textContent='Most of the water remains unobserved.';});
function frame(ts){if(ts-lastFrame>28){lastFrame=ts;if(!paused){advanceWater();advanceWater()}if($('#explore').classList.contains('active')){drawWater(ts/1000);updateSensorReadout();}}requestAnimationFrame(frame);}

// Learn — progressive general explanation, without a problem-specific model or objective.
const lessonNames=['predict','rules','residual','optimize'];
let activeLesson='predict';
function showLesson(name){
 if(!lessonNames.includes(name))return;
 activeLesson=name;
 $$('[data-lesson]').forEach(b=>{const on=b.dataset.lesson===name;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false')});
 $$('[data-lesson-panel]').forEach(p=>{const on=p.dataset.lessonPanel===name;p.hidden=!on;p.classList.toggle('active',on)});
 if(name==='rules')renderSamplePoints();
}
$$('[data-lesson]').forEach(b=>b.addEventListener('click',()=>showLesson(b.dataset.lesson)));
$$('[data-next-lesson]').forEach(b=>b.addEventListener('click',()=>showLesson(b.dataset.nextLesson)));
const sampleBlurb={
 domain:'<b>PDE / interior points</b> · Check the governing equation at locations without requiring the true solution there.',
 initial:'<b>Initial-condition points</b> · Specify the starting state of a time-dependent system.',
 boundary:'<b>Boundary-condition points</b> · Specify behavior on the spatial boundary.',
 observed:'<b>Observed data</b> · Supply known values at sampled coordinates (optional).'
};
let sampleFocus='domain';
$$('[data-samples]').forEach(b=>b.addEventListener('click',()=>{
 sampleFocus=b.dataset.samples;
 $$('[data-samples]').forEach(x=>x.classList.toggle('active',x===b));
 $('#sampleDescription').innerHTML=sampleBlurb[sampleFocus];
 renderSamplePoints();
}));
function renderSamplePoints(){
 const cv=$('#general-samples-canvas');if(!cv)return;
 const c=cv.getContext('2d'),W=cv.width,H=cv.height;
 c.fillStyle='#0c2033';c.fillRect(0,0,W,H);
 const L=50,R=22,T=22,B=37,w=W-L-R,h=H-T-B;
 for(let q=0;q<=6;q++){
  const x=L+q*w/6,y=T+q*h/6;c.strokeStyle='#33516b';c.lineWidth=.6;c.beginPath();c.moveTo(x,T);c.lineTo(x,T+h);c.moveTo(L,y);c.lineTo(L+w,y);c.stroke();
 }
 c.strokeStyle='#8ba9c4';c.lineWidth=1.5;c.strokeRect(L,T,w,h);
 c.fillStyle='#a9c2d6';c.font='13px system-ui';c.fillText('position x',W-120,H-10);c.fillText('time t',9,16);
 c.fillText('t = 0',L+4,H-12);c.save();c.translate(L-30,T+h/2);c.rotate(-Math.PI/2);c.fillText('spatial boundary',-55,0);c.restore();
 let state=12345;const rand=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296};
 const points={domain:[],initial:[],boundary:[],observed:[]};
 for(let i=0;i<68;i++)points.domain.push([L+11+rand()*(w-22),T+11+rand()*(h-22)]);
 for(let i=0;i<23;i++)points.initial.push([L+rand()*w,T+h]);
 for(let i=0;i<18;i++){const yy=T+rand()*h;points.boundary.push([i%2?L:L+w,yy]);}
 for(let i=0;i<15;i++)points.observed.push([L+rand()*w,T+rand()*h]);
 const colors={domain:'#f4ba73',initial:'#64e7da',boundary:'#b6a0ff',observed:'#79b9f6'};
 for(const category of ['domain','initial','boundary','observed']){
  const highlighted=sampleFocus===category;
  c.globalAlpha=highlighted?1:.2;c.fillStyle=colors[category];
  for(const [x,y] of points[category]){c.beginPath();c.arc(x,y,highlighted?4:2.9,0,Math.PI*2);c.fill();}
 }
 c.globalAlpha=1;
 c.font='12px system-ui';c.fillStyle='#b9c9d9';c.fillText('Ω: a space-time domain (schematic)',L+8,T+18);
}
function changeTraining(mode){
 const pinn=mode==='pinn';
 $$('[data-training]').forEach(b=>b.classList.toggle('active',b.dataset.training===mode));
 $('#pinnLossSource').classList.toggle('inactive',!pinn);
 $('#trainingFormula').innerHTML=pinn?'ℒ = λ<sub>d</sub>ℒ<sub>data</sub> + λ<sub>f</sub>ℒ<sub>physics</sub> + λ<sub>IC</sub>ℒ<sub>IC</sub> + λ<sub>BC</sub>ℒ<sub>BC</sub>':'ℒ = ℒ<sub>data</sub>';
 $('#trainingExplanation').textContent=pinn?'The physics-informed objective adds PDE and applicable condition losses. This toggle illustrates the formula; it does not retrain a model.':'A supervised network can learn by fitting known target values. This is an illustrative objective, not a model training run.';
}
$$('[data-training]').forEach(b=>b.addEventListener('click',()=>changeTraining(b.dataset.training)));
$$('[data-concept-answer]').forEach(b=>b.addEventListener('click',()=>{
 $$('[data-concept-answer]').forEach(x=>x.classList.toggle('active',x===b));
 const yes=b.dataset.conceptAnswer==='yes';
 $('#conceptFeedback').textContent=yes?'Correct. Automatic differentiation provides the derivatives needed to evaluate a governing equation at an unlabeled interior point.':'Try again. The PDE residual uses derivatives of the network output; it does not need a target solution value at that interior point.';
 $('#conceptFeedback').classList.toggle('correct',yes);
}));

// Experiment — evaluate real trained MLP on the full spatial field.
let activeModel='pinn',experimentScheduled=false;
function selectExperimentModel(id){
 if(!MODELS?.[id])return;
 activeModel=id;
 $$('[data-model]').forEach(x=>x.classList.toggle('active',x.dataset.model===id));
 $$('[data-limit]').forEach(x=>x.classList.toggle('active', (id==='pinn' && x.dataset.limit==='correct') || (id==='wrong' && x.dataset.limit==='wrong')));
 historySelection = -1;requestExperimentUpdate();
}
$$('[data-model]').forEach(b=>b.addEventListener('click',()=>selectExperimentModel(b.dataset.model)));
$$('[data-limit]').forEach(b=>b.addEventListener('click',()=>selectExperimentModel(b.dataset.limit==='wrong'?'wrong':'pinn')));
let historySelection=-1;
$('#historyStep').addEventListener('input',e=>{historySelection=Number(e.target.value);renderTrainingInspector();drawHistory(MODELS[activeModel],historySelection);});
$('#history-canvas').addEventListener('click',e=>{
 const cv=$('#history-canvas'),r=cv.getBoundingClientRect();const portion=(e.clientX-r.left)/r.width;
 const m=MODELS[activeModel].history;const ratio=clamp((portion*cv.width-45)/(cv.width-65),0,1);
 historySelection=Math.round(ratio*(m.length-1));renderTrainingInspector();drawHistory(MODELS[activeModel],historySelection);
});
$('#expTime').addEventListener('input',requestExperimentUpdate);
function requestExperimentUpdate(){if(experimentScheduled)return;experimentScheduled=true;requestAnimationFrame(()=>{experimentScheduled=false;updateExperiment()})}
const RGB={navy:[18,37,75],violet:[107,87,157],dark:[20,52,79],cyan:[77,200,204],bright:[229,236,180],error:[243,134,109]};
function lerp(a,b,t){return a+(b-a)*t}
function interpColor(a,b,t){return a.map((v,i)=>Math.round(lerp(v,b[i],t)))}
function colorWave(value){const a=clamp(Math.abs(value),0,1);return value<0?interpColor([23,53,83],[177,111,213],a):interpColor([23,53,83],[238,242,165],a)}
function colorError(value){const s=clamp(value,0,1);if(s<.5)return interpColor([15,38,62],[80,152,184],s*2);return interpColor([80,152,184],RGB.error,(s-.5)*2)}
function paintHeatmap(canvas,values,size,isError=false){const c=canvas.getContext('2d');let img=c.createImageData(size,size);for(let i=0;i<size;i++)for(let j=0;j<size;j++){
 const color=isError?colorError(values[(size-1-j)*size+i]):colorWave(values[(size-1-j)*size+i]);const idx=4*(j*size+i);img.data[idx]=color[0];img.data[idx+1]=color[1];img.data[idx+2]=color[2];img.data[idx+3]=255;
}const temp=document.createElement('canvas');temp.width=size;temp.height=size;temp.getContext('2d').putImageData(img,0,0);c.imageSmoothingEnabled=true;c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(temp,0,0,canvas.width,canvas.height);
 c.strokeStyle='#a3e9e72d';c.lineWidth=.7;for(let i=1;i<5;i++){c.beginPath();c.moveTo(canvas.width*i/5,0);c.lineTo(canvas.width*i/5,canvas.height);c.stroke();c.beginPath();c.moveTo(0,canvas.height*i/5);c.lineTo(canvas.width,canvas.height*i/5);c.stroke()}
 c.strokeStyle='#afcde071';c.lineWidth=1;c.strokeRect(.5,.5,canvas.width-1,canvas.height-1)}
function drawHistory(model){const canvas=$('#history-canvas'),c=canvas.getContext('2d');const w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.fillStyle='#102035';c.fillRect(0,0,w,h);const m={left:45,right:20,top:13,bottom:25};const hvals=model.history;const xsteps=hvals.map(a=>a[0]);const all=hvals.flatMap(a=>[Math.max(a[1],1e-7),Math.max(a[2],1e-7)]).map(v=>Math.log10(v));const minY=Math.floor(Math.min(...all)-.25),maxY=Math.ceil(Math.max(...all)+.25);const px=(v)=>m.left+(v-xsteps[0])/(xsteps[xsteps.length-1]-xsteps[0])*(w-m.left-m.right);const py=(v)=>m.top+(maxY-Math.log10(Math.max(v,1e-7)))/(maxY-minY)*(h-m.top-m.bottom);
 for(let k=minY;k<=maxY;k++){let y=m.top+(maxY-k)/(maxY-minY)*(h-m.top-m.bottom);c.strokeStyle='#49627b66';c.beginPath();c.moveTo(m.left,y);c.lineTo(w-m.right,y);c.stroke();c.fillStyle='#8fa8bb';c.font='12px system-ui';c.fillText(`10${k>=0?'^'+k:'^'+k}`,4,y+4)}
 for(let s=0;s<=4;s++){const x=m.left+s/4*(w-m.left-m.right);c.strokeStyle='#42627b45';c.beginPath();c.moveTo(x,m.top);c.lineTo(x,h-m.bottom);c.stroke();c.fillStyle='#849bae';c.fillText(Math.round(s/4*xsteps[xsteps.length-1]),x-14,h-7)}
 function line(col,offset){c.lineWidth=2.5;c.strokeStyle=col;c.beginPath();hvals.forEach((p,i)=>{const x=px(p[0]),y=py(p[offset]);if(!i)c.moveTo(x,y);else c.lineTo(x,y)});c.stroke()}
 line('#9b94ef',2);line('#65e6d8',1)
 if(Number.isInteger(historySelection) && historySelection>=0){const point=hvals[Math.min(historySelection,hvals.length-1)];const x=px(point[0]);c.strokeStyle='#f4ce8b';c.lineWidth=1.6;c.beginPath();c.moveTo(x,m.top);c.lineTo(x,h-m.bottom);c.stroke();c.fillStyle='#f4ce8b';c.beginPath();c.arc(x,py(point[1]),4,0,Math.PI*2);c.fill();}
}
function renderTrainingInspector(){
 const model=MODELS[activeModel];if(!model)return;
 const h=model.history;
 if(historySelection<0)historySelection=h.length-1;
 historySelection=clamp(historySelection,0,h.length-1);
 const slider=$('#historyStep');slider.max=String(h.length-1);slider.value=String(historySelection);
 const p=h[historySelection];
 $('#historyStepValue').textContent=`${p[0]} / ${h[h.length-1][0]}`;
 $('#inspectorTotal').textContent=format(p[1],5);
 $('#inspectorData').textContent=format(p[2],5);
 $('#inspectorPhysics').textContent=model.lambda===0?'Not used':format(p[3],5);
}
function renderLimitComparison(t){
 if(!MODELS.wrong)return;
 const n=33,correct=new Float32Array(n*n),wrong=new Float32Array(n*n);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=i/(n-1),y=j/(n-1),idx=j*n+i;
  correct[idx]=evaluate(MODELS.pinn,t,x,y);wrong[idx]=evaluate(MODELS.wrong,t,x,y);
 }
 paintHeatmap($('#limits-correct'),correct,n);paintHeatmap($('#limits-wrong'),wrong,n);
 $('#limitCorrectL2').textContent=(100*MODELS.pinn.metrics.relativeL2).toFixed(2)+'%';
 $('#limitWrongL2').textContent=(100*MODELS.wrong.metrics.relativeL2).toFixed(2)+'%';
 $('#limitCorrectRes').textContent=MODELS.pinn.metrics.residualRms.toFixed(3);
 $('#limitWrongRes').textContent=MODELS.wrong.metrics.residualRms.toFixed(3);
 $('#limitCorrectAssumed').textContent=MODELS.pinn.metrics.residualRms.toFixed(3);
 $('#limitWrongAssumed').textContent=MODELS.wrong.assumedResidualRms.toFixed(3);
}
function updateExperiment(){if(!MODELS)return;const model=MODELS[activeModel];const t=Number($('#expTime').value);$('#expTimeValue').textContent='t = '+t.toFixed(2);$('#metricLambda').textContent=model.lambda.toFixed(1);
 const n=43,Np=n*n;const ref=new Float32Array(Np),pred=new Float32Array(Np),err=new Float32Array(Np);let ss=0,yy=0;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=i/(n-1),y=j/(n-1),idx=j*n+i;const a=analyticWave(t,x,y),b=evaluate(model,t,x,y);ref[idx]=a;pred[idx]=b;err[idx]=Math.abs(a-b);ss+=(a-b)**2;yy+=a*a}
 paintHeatmap($('#ref-map'),ref,n);paintHeatmap($('#pred-map'),pred,n);paintHeatmap($('#err-map'),err,n,true);
 const rel=Math.sqrt(ss/Math.max(yy,1e-10));$('#metricL2').textContent=(100*rel).toFixed(1)+'%';
 let rr=0,count=0;
 for(let j=1;j<12;j+=2)for(let i=1;i<12;i+=2){const q=differentiate(model,t,i/12,j/12);rr+=q.residual**2;count++}
 $('#metricResidual').textContent=Math.sqrt(rr/count).toFixed(3);
 renderTrainingInspector();drawHistory(model,historySelection);renderLimitComparison(t);
 window.dispatchEvent(new CustomEvent('pinn:experiment-updated',{detail:{model:activeModel,time:t,fields:{reference:ref,prediction:pred,error:err}}}));
}

// Read-only access for the teaching panels; the original model functions stay unchanged.
window.PINN_TEACHING=Object.freeze({
 analyticWave,evaluate,differentiate,
 getModel:(id=activeModel)=>MODELS[id],
 getModelId:()=>activeModel,
 getTime:()=>Number($('#expTime').value)
});

// Start the web application.
resetWater();showLesson('predict');changeTraining('data');updateExperiment();requestAnimationFrame(frame);

