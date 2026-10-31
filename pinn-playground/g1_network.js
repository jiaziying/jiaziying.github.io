
/** Network diagram and pointwise activations from actual exported PyTorch weights. */
'use strict';
(() => {
 const root=document.getElementById('g1Explorer');if(!root)return;
 const $=id=>document.getElementById(id);
 const models=window.PINN_MODELS?.models;
 if(!models){root.insertAdjacentHTML('beforeend','<p>Model weights unavailable.</p>');return;}
 const modelFor=id=>id==='wrong'?window.PINN_WRONG_MODEL:models[id];
 let activeLayer=1,activeUnit=0,activeModel='pinn',trace=[];
 const layerTitles=['Inputs','Hidden 1','Hidden 2','Hidden 3','Output'];
 const X=[61,218,369,520,698];
 const g=$('g1Graph')?.getContext('2d');if(!g)return;
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 const num=n=>Number.isFinite(n)?(n!==0&&Math.abs(n)<.0005?n.toExponential(2):n.toFixed(4)):'—';
 function traceForward(model,t,x,y){
   let a=[t,x,y];let out=[{a:a.slice(),z:null}];
   model.layers.forEach((l,i)=>{
     const z=l.bias.map((b,j)=>l.weights[j].reduce((sum,w,k)=>sum+w*a[k],b));
     a=i===model.layers.length-1?z:z.map(Math.tanh);out.push({a:a.slice(),z:z.slice()});
   });
   return out;
 }
 function coordinates(layer){
   if(layer===0)return [[X[0],98],[X[0],141],[X[0],184]];
   if(layer===4)return [[X[4],141]];
   return Array.from({length:48},(_,i)=>[X[layer]-24.75+(i%4)*16.5,49+Math.floor(i/4)*16.35]);
 }
 function activatedColor(value){
   let m=clamp(Math.abs(value),0,1),low=value>=0?[39,116,122]:[101,76,133],hi=value>=0?[116,243,211]:[203,173,246];
   return `rgb(${low.map((v,i)=>Math.round(v+(hi[i]-v)*(.28+.72*m))).join(',')})`;
 }
 function rounded(x,y,w,h,r,fill,stroke){
   g.beginPath();if(g.roundRect)g.roundRect(x,y,w,h,r);else{g.rect(x,y,w,h)}g.fillStyle=fill;g.fill();g.strokeStyle=stroke;g.lineWidth=1;g.stroke();
 }
 function draw(){
   const W=$('g1Graph').width,H=$('g1Graph').height;
   g.clearRect(0,0,W,H);
   let bg=g.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#0d1e30');bg.addColorStop(1,'#12293b');g.fillStyle=bg;g.fillRect(0,0,W,H);
   for(let l=0;l<5;l++){
     let bx=X[l]-(l===0||l===4?49:57),bw=l===0||l===4?98:114;
     rounded(bx,30,bw,207,10,l===activeLayer?'rgba(43,125,126,.21)':'rgba(29,54,75,.35)',l===activeLayer?'#5dcab9':'#345068');
     g.textAlign='center';g.font='600 12px system-ui';g.fillStyle=l===activeLayer?'#c5f7e8':'#aec8d9';g.fillText(layerTitles[l],X[l],17);
     g.font='10px system-ui';g.fillStyle='#7596ab';g.fillText(l===0?'3 coordinates':l===4?'1 scalar':'48 units',X[l],251);
   }
   // The arrows indicate an information-flow direction, not a selected-only sparse architecture.
   for(let l=0;l<4;l++){
     let sx=X[l]+(l===0?51:59),ex=X[l+1]-(l===3?51:59);
     for(let row of [104,141,178]){
       g.beginPath();g.strokeStyle='rgba(121,172,189,.3)';g.lineWidth=1;g.moveTo(sx,row);g.bezierCurveTo((sx+ex)/2,row,(sx+ex)/2,row,ex-4,row);g.stroke();
     }
     g.beginPath();g.fillStyle='#6f9da9';g.moveTo(ex-2,141);g.lineTo(ex-9,137);g.lineTo(ex-9,145);g.fill();
   }
   if(activeLayer>0){
     let row=modelFor(activeModel).layers[activeLayer-1].weights[activeUnit],dst=coordinates(activeLayer)[activeUnit];
     let strongest=row.map((w,i)=>({w,i})).sort((a,b)=>Math.abs(b.w)-Math.abs(a.w)).slice(0,Math.min(6,row.length));
     strongest.forEach(({w,i})=>{
       let src=coordinates(activeLayer-1)[i],mid=(src[0]+dst[0])/2;
       g.beginPath();g.strokeStyle=w>=0?'rgba(125,235,205,.65)':'rgba(206,160,247,.60)';g.lineWidth=1.25+Math.min(1.4,Math.abs(w));
       g.moveTo(src[0]+4,src[1]);g.bezierCurveTo(mid,src[1],mid,dst[1],dst[0]-5,dst[1]);g.stroke();
     });
   }
   for(let l=0;l<5;l++){
     coordinates(l).forEach(([x,y],i)=>{
       const selected=activeLayer===l&&activeUnit===i,r=l===0||l===4?8.5:5.4;
       if(selected){g.beginPath();g.arc(x,y,r+5,0,Math.PI*2);g.fillStyle='rgba(255,223,149,.16)';g.fill()}
       g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=activatedColor(trace[l].a[i]);g.fill();g.strokeStyle=selected?'#ffe6ad':'#e7f6ff55';g.lineWidth=selected?2.3:.5;g.stroke();
       if(l===0){g.fillStyle='#c1d5e0';g.textAlign='right';g.font='600 12px system-ui';g.fillText(['t','x','y'][i],x-17,y+4)}
     });
   }
 }
 function show(){
   const model=modelFor(activeModel);if(!model)return;
   const count=trace[activeLayer].a.length;activeUnit=clamp(activeUnit,0,count-1);
   const slider=$('g1Unit');slider.max=String(count);slider.value=String(activeUnit+1);slider.disabled=count===1;
   $('g1UnitCount').textContent=`${activeUnit+1} / ${count}`;
   $('g1LayerSelect').value=String(activeLayer);
   $('g1SelectedLayer').textContent=layerTitles[activeLayer]+(activeLayer>0&&activeLayer<4?` · #${activeUnit+1}`:'');
   $('g1Activation').textContent=num(trace[activeLayer].a[activeUnit]);
   $('g1Preactivation').textContent=activeLayer===0?'Input':num(trace[activeLayer].z[activeUnit]);
   $('g1Bias').textContent=activeLayer===0?'—':num(model.layers[activeLayer-1].bias[activeUnit]);
   $('g1NeuronFormula').textContent=activeLayer===0?'Input coordinate from the probe':activeLayer===4?'uθ = Σᵢ wᵢ aᵢ + b':'aⱼ = tanh(Σᵢ wⱼᵢ aᵢ + bⱼ)';
   draw();
 }
 function update(){
   const model=modelFor(activeModel);if(!model)return;
   const t=Number($('expTime').value),x=Number($('g1X').value),y=Number($('g1Y').value);
   trace=traceForward(model,t,x,y);$('g1XValue').textContent=x.toFixed(2);$('g1YValue').textContent=y.toFixed(2);$('g1TimeValue').textContent=t.toFixed(2);$('g1FieldOutput').textContent=num(trace[4].a[0]);show();
 }
 function syncToExperiment(){
   const selected=document.querySelector('.model-option.active');activeModel=selected?.dataset.model||(document.querySelector('[data-limit="wrong"].active')?'wrong':'pinn');
   const labels={data:'MLP · λ = 0',pinn:'PINN · λ = 0.3',strong:'PINN · λ = 2.0',wrong:'PINN · wrong wave speed'};
   $('g1CurrentModel').textContent=labels[activeModel]||'Trained model';update();
 }
 $('g1LayerSelect').addEventListener('change',e=>{activeLayer=Number(e.target.value);activeUnit=0;show()});
 $('g1Unit').addEventListener('input',e=>{activeUnit=Number(e.target.value)-1;show()});
 ['g1X','g1Y'].forEach(id=>$(id).addEventListener('input',update));
 $('expTime').addEventListener('input',syncToExperiment);
 document.querySelectorAll('[data-model],[data-limit]').forEach(btn=>btn.addEventListener('click',()=>requestAnimationFrame(syncToExperiment)));
 $('g1Graph').addEventListener('click',e=>{
   const rect=$('g1Graph').getBoundingClientRect(),x=(e.clientX-rect.left)*$('g1Graph').width/rect.width,y=(e.clientY-rect.top)*$('g1Graph').height/rect.height;
   let closest={dist:Infinity,layer:0,idx:0};
   for(let l=0;l<5;l++)coordinates(l).forEach(([px,py],i)=>{let d=Math.hypot(x-px,y-py);if(d<closest.dist)closest={dist:d,layer:l,idx:i}});
   if(closest.dist<=15){activeLayer=closest.layer;activeUnit=closest.idx;show();}
 });
 syncToExperiment();
 window.PINN_G1_TEST={traceForward,layerCount:()=>trace.length,output:()=>trace[4].a[0],activeModel:()=>activeModel};
})();


