/* Physically driven height-map shading on 2-D canvas for WebGL-disabled environments.
 * Precomputed, procedural reflection environment + dynamic normal/refraction sampling.
 */
(function(){
'use strict';
window.createCpuWaterRenderer=function(ctx,N){
 const cnv=ctx.canvas,buffer=document.createElement('canvas');
 const W=470,H=216;buffer.width=W;buffer.height=H;
 const bc=buffer.getContext('2d'),pixels=bc.createImageData(W,H),out=pixels.data;
 let bg=new Float32Array(W*H*3);
 const fract=v=>v-Math.floor(v),mix=(a,b,t)=>a+(b-a)*t;
 const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.545);
 const noise=(x,y)=>{
  const xi=Math.floor(x),yi=Math.floor(y);let sx=fract(x),sy=fract(y);sx=sx*sx*(3-2*sx);sy=sy*sy*(3-2*sy);
  return mix(mix(hash(xi,yi),hash(xi+1,yi),sx),mix(hash(xi,yi+1),hash(xi+1,yi+1),sx),sy);
 };
 function fbm(x,y){return .52*noise(x,y)+.26*noise(2.06*x,2.06*y)+.13*noise(4.13*x,4.13*y)+.065*noise(8.35*x,8.35*y);}
 const sstep=(lo,hi,x)=>{let q=Math.max(0,Math.min(1,(x-lo)/(hi-lo)));return q*q*(3-2*q)};
 // A reflected, defocused canopy and sky above an amber/teal pond floor.
 for(let py=0;py<H;py++)for(let px=0;px<W;px++){
  const u=px/W,v=py/H;
  const giant=fbm(u*2.8+2.3,v*3.5+3.5);
  const small=fbm(u*11.2+5.5,v*6.4-8.2);
  const edge=(1-sstep(0,.2,u))*.17+(1-sstep(0,.18,1-u))*.1;
  const top=sstep(.37,1,v)*.12;
  const canopy=sstep(.30,.56,giant*.66+small*.34+edge+top);
  const skyNoise=fbm(u*3.0,v*2.1+1.3);
  let sky=[84+69*skyNoise,127+76*skyNoise,122+62*skyNoise];
  let leaves=[14+13*small,46+33*small,39+26*small];
  let b=[mix(sky[0],leaves[0],canopy*.86),mix(sky[1],leaves[1],canopy*.86),mix(sky[2],leaves[2],canopy*.86)];
  // Warm shallow sediment and subtle stones in bottom right.
  const floorMix=sstep(.35,.9,u)*sstep(.05,.68,1-v)*.21;
  const grains=fbm(u*24,v*27+1);
  b=[mix(b[0],57+70*grains,floorMix),mix(b[1],81+75*grains,floorMix),mix(b[2],64+50*grains,floorMix)];
  const glow=Math.exp(-((u-.69)**2/0.13+(v-.73)**2/0.36))*.19;
  const p=3*(py*W+px);
  bg[p]=b[0]+glow*60;bg[p+1]=b[1]+glow*52;bg[p+2]=b[2]+glow*35;
 }
 let hasDrawn=false;
 function sample(curr,x,y){
  const xx=Math.max(1,Math.min(N-3,x)),yy=Math.max(1,Math.min(N-3,y));
  const i=Math.floor(xx),j=Math.floor(yy),fx=xx-i,fy=yy-j;
  const a=curr[i*N+j],b=curr[(i+1)*N+j],c=curr[i*N+j+1],d=curr[(i+1)*N+j+1];
  return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;
 }
 function render(curr,t){
  const winW=cnv.clientWidth,winH=cnv.clientHeight,pr=Math.min(window.devicePixelRatio||1,1.5);
  const w=Math.max(1,Math.round(winW*pr)),h=Math.max(1,Math.round(winH*pr));
  if(cnv.width!==w||cnv.height!==h){cnv.width=w;cnv.height=h;}
  let q=0;
  const speedV=(t*.004)%1;
  for(let py=0;py<H;py++){
   const ty=1-py/(H-1);
   for(let px=0;px<W;px++){
    const tx=px/(W-1);
    const hx=tx*(N-1),hy=ty*(N-1);
    const s1=sample(curr,hx+1.6,hy),s2=sample(curr,hx-1.6,hy);
    const s3=sample(curr,hx,hy+1.6),s4=sample(curr,hx,hy-1.6);
    const slopeX=(s1-s2)*1.20,slopeY=(s3-s4)*1.20;
    const mm=Math.min(1.5,Math.hypot(slopeX,slopeY)*3.0);
    const ripple=slopeX*.9-slopeY*.67;
    const distortX=Math.round(slopeX*90 + (noise(tx*12+speedV,ty*11)-.5)*1.4);
    const distortY=Math.round(slopeY*66);
    const rx=Math.max(0,Math.min(W-1,px+distortX)),ry=Math.max(0,Math.min(H-1,py+distortY));
    const src=3*(ry*W+rx);
    const spec=Math.pow(Math.max(0,Math.min(1,.64+slopeX*2.2-slopeY*2.0)),22)*2.5;
    const shine=Math.pow(Math.max(0,Math.min(1,.58+slopeY*1.1+slopeX*2.1)),15)*.35;
    const light=Math.max(.64,Math.min(1.28,.88+ripple*2.8));
    const brightness=spec*125+shine*46+mm*18;
    const bgtexture=(noise(tx*38+speedV,ty*29)-.5)*3;
    out[q]=Math.max(0,Math.min(255,bg[src]*light+brightness*1.04+bgtexture));
    out[q+1]=Math.max(0,Math.min(255,bg[src+1]*light+brightness*1.13+bgtexture));
    out[q+2]=Math.max(0,Math.min(255,bg[src+2]*light+brightness*1.08+bgtexture));
    out[q+3]=255;q+=4;
   }
  }
  bc.putImageData(pixels,0,0);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(buffer,0,0,w,h);
  // Gentle sunlight in a wide soft glint, similar to a surface reflection.
  const g=ctx.createRadialGradient(w*.70,h*.23,5,w*.70,h*.23,w*.65);
  g.addColorStop(0,'rgba(244,253,234,.09)');g.addColorStop(.4,'rgba(197,235,215,.04)');g.addColorStop(1,'rgba(140,183,168,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 }
 return {render};
};
})();
