/* Procedural water renderer for PINN Playground.
 * Numerical wave heights still originate in app.js; the shader is a MATERIAL,
 * not an alternative physical prediction. WebGL 1, offline, no external assets.
 */
(function(){
'use strict';
window.createPondRenderer=function(canvas,N){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  if(!gl) return null;
  const vsrc=`
    attribute vec2 pos;
    varying vec2 vUv;
    void main(){vUv=.5*(pos+1.);gl_Position=vec4(pos,0.,1.);}
  `;
  const fsrc=`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D heightTex;
    uniform vec2 texel;
    uniform vec2 res;
    uniform float time;
    uniform vec2 clickUv;
    uniform float clickAge;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
                 mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
    }
    float fbm(vec2 p){
       float v=.0,a=.54;
       for(int k=0;k<4;k++){v+=a*noise(p);p*=2.06;a*=.48;}
       return v;
    }
    float h(vec2 p){return (texture2D(heightTex,clamp(p,vec2(.001),vec2(.999))).r-.5)*2.;}
    void main(){
      // A top-down shaded WATER surface, rather than a meshed mathematics plot.
      vec2 uv=vUv;
      float hm=h(uv);
      float hx=h(uv+vec2(texel.x,0.))-h(uv-vec2(texel.x,0.));
      float hy=h(uv+vec2(0.,texel.y))-h(uv-vec2(0.,texel.y));
      vec2 slope=vec2(hx,hy);
      vec3 normal=normalize(vec3(-slope*29.,1.));
      // Smooth moving micro-normal detail keeps the still water alive.
      vec2 microUv=uv*vec2(9.0,7.0)+vec2(time*.008,time*.006);
      float n1=noise(microUv),n2=noise(microUv+vec2(.03,.05));
      normal=normalize(normal+vec3((n1-.48)*.042,(n2-.48)*.047,0.));
      vec2 refr=uv+normal.xy*.028;
      float fine=fbm(refr*vec2(7.0,5.0));
      float mottled=fbm(refr*vec2(23.,19.)+7.);
      // Colored pebbles and sandy sediment beneath dark, shallow water.
      vec3 bed=mix(vec3(.035,.117,.105),vec3(.115,.225,.166),smoothstep(.22,.82,fine));
      bed += .042*(mottled-.5);
      float pebbles=noise(refr*vec2(47.,31.));
      bed+=.035*smoothstep(.52,.9,pebbles);
      // Reflected foliage and pale sky are displaced by the same water normals.
      vec2 ru=uv+normal.xy*.096;
      float branches=fbm(ru*vec2(2.3,3.7)+vec2(-.2,.3));
      float leaves=fbm(ru*vec2(8.3,5.1)+vec2(2.4,-1.8));
      float shade=smoothstep(.33,.67,branches*.75+leaves*.25);
      vec3 sky=vec3(.27,.51,.55);
      sky=mix(sky,vec3(.61,.74,.67),smoothstep(.42,.78,fbm(ru*vec2(2.0,4.5))));
      vec3 tree=vec3(.028,.102,.084);
      vec3 reflection=mix(sky,tree,shade*.81);
      float horizonWeight=.13+.35*smoothstep(.40,1.,uv.y);
      float fresnel=.20+.19*pow(1.-clamp(normal.z,.0,1.),1.25);
      vec3 color=mix(bed,reflection,clamp(.31+horizonWeight+fresnel,.0,.84));
      // Gentle sunlight caustics visible in the water, particularly in shallow patches.
      float caustic=pow(abs(sin((refr.x*.84+refr.y*.42+fine*.35)*41.+time*.25)),13.);
      color+=vec3(.13,.15,.10)*caustic*(.20+.5*(1.-shade));
      // Energy-carrying wave slopes catch sharp white highlights.
      vec3 L=normalize(vec3(-.31,.43,.86));
      vec3 V=normalize(vec3(0.,.10,1.));
      vec3 halfV=normalize(L+V);
      float spec=pow(max(dot(normal,halfV),0.),92.);
      float broad=pow(max(dot(normal,halfV),0.),17.);
      float wave=clamp(length(slope)*16.,0.,1.);
      color+=vec3(.50,.77,.72)*spec*(.5+1.7*wave);
      color+=vec3(.15,.25,.23)*broad*(.12+wave);
      // A tiny translucent impact crown. Its wave propagation still comes from the numerical solver.
      float a=clickAge;
      if(a<1.5){
        float d=length((uv-clickUv)*vec2(res.x/res.y,1.));
        float ring=exp(-pow((d-(.025+a*.090)) /(.006+a*.005),2.));
        color+=vec3(.31,.48,.45)*ring*exp(-a*2.1);
        float centerGlow=exp(-d*d/(.00033+a*.002));
        color+=vec3(.20,.36,.35)*centerGlow*exp(-a*8.);
      }
      // A natural rim, much less diagrammatic than axes and a numbered grid.
      float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
      color*=.80+.20*smoothstep(.0,.18,edge);
      float treeShadow=fbm(uv*vec2(12.,4.)+vec2(3.,5.));
      color-=vec3(.034,.037,.027)*smoothstep(.65,.95,treeShadow);
      color=pow(max(color,0.),vec3(.86));
      // Filmic highlight/gamma: water is kept dark teal, not cyan synthetic geometry.
      gl_FragColor=vec4(clamp(color,0.,1.),1.);
    }
  `;
  function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){throw new Error(gl.getShaderInfoLog(s));}return s;}
  let program;
  try{
    program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vsrc));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fsrc));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  }catch(e){console.warn('Pond shader fallback:',e);return null;}
  gl.useProgram(program);
  const vertices=new Float32Array([-1,-1,1,-1,-1,1,1,1]);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
  const pos=gl.getAttribLocation(program,'pos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program,'heightTex'),0);
  gl.uniform2f(gl.getUniformLocation(program,'texel'),1/N,1/N);
  const uRes=gl.getUniformLocation(program,'res'),uTime=gl.getUniformLocation(program,'time');
  const uClick=gl.getUniformLocation(program,'clickUv'),uClickAge=gl.getUniformLocation(program,'clickAge');
  const heights=new Uint8Array(N*N*4);
  let lastClick=[.5,.5],lastClickTime=-10;
  function dropAt(x,y){lastClick=[x/(N-1),y/(N-1)];lastClickTime=performance.now()/1000;}
  function render(curr,t){
    let cw=canvas.clientWidth,ch=canvas.clientHeight,dpr=Math.min(window.devicePixelRatio||1,1.6);
    let w=Math.max(1,Math.floor(cw*dpr)),h=Math.max(1,Math.floor(ch*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
    // CPU simulation index i*N+j, texture columns i and rows j.
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){
      const v=clamp(curr[i*N+j],-1.0,1.0);
      const q=4*(j*N+i);heights[q]=Math.floor(127.5+v*127.);heights[q+1]=heights[q+2]=heights[q];heights[q+3]=255;
    }
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,N,N,0,gl.RGBA,gl.UNSIGNED_BYTE,heights);
    gl.uniform2f(uRes,w,h);gl.uniform1f(uTime,t);
    gl.uniform2f(uClick,lastClick[0],lastClick[1]);gl.uniform1f(uClickAge,t-lastClickTime);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  function eventToGrid(event){const r=canvas.getBoundingClientRect();return {x:clamp((event.clientX-r.left)/r.width,0,1)*(N-1),y:clamp(1-(event.clientY-r.top)/r.height,0,1)*(N-1)};}
  return {render,dropAt,eventToGrid,active:true};
};
})();
