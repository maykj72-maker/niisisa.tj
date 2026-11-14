/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-expressions */
// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function createTower(cv: HTMLCanvasElement, wrap: HTMLElement) {
const r=new THREE.WebGLRenderer({canvas:cv,antialias:true});
r.setPixelRatio(Math.min(devicePixelRatio,2));r.shadowMap.enabled=true;
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(55,1,.5,3000);
const L=(a,b,t)=>a+(b-a)*t, cl=x=>Math.min(1,Math.max(0,x)), sm=x=>x*x*(3-2*x);
// sky dome with shader: day -> sunset
const skyU={t:{value:0}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(1500,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:skyU,
vertexShader:"varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
fragmentShader:`varying vec3 p;uniform float t;
void main(){float h=normalize(p).y;
vec3 dT=vec3(.25,.5,.85),dH=vec3(.75,.85,.95);
vec3 sT=vec3(.12,.12,.35),sM=vec3(.95,.35,.3),sH=vec3(1.,.72,.3);
vec3 day=mix(dH,dT,pow(clamp(h,0.,1.),.5));
vec3 sun=mix(sH,sM,smoothstep(0.,.25,h));sun=mix(sun,sT,smoothstep(.2,.8,h));
vec3 c=mix(day,sun,t);
vec3 d=normalize(p);vec3 sd=normalize(vec3(-.3,.04,-1.));
float s=max(dot(d,sd),0.);c+=vec3(1.,.7,.35)*pow(s,200.)*3.*t+vec3(1.,.5,.2)*pow(s,8.)*.5*t;
gl_FragColor=vec4(c,1.);}`}));
scene.add(sky);
scene.fog=new THREE.Fog(0xcfe0f0,200,1400);

const hemi=new THREE.HemisphereLight(0xcfe6ff,0x556644,1.0);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(120,200,80);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-150,right:150,top:150,bottom:-150,far:600});scene.add(sun);

// bay water
const water=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000,80,80),new THREE.MeshStandardMaterial({color:0x1e5a8a,roughness:.25,metalness:.3,emissive:0x0a2a4a,emissiveIntensity:1}));
water.rotation.x=-Math.PI/2;water.position.y=-1;scene.add(water);
const wp=water.geometry.attributes.position, w0=wp.array.slice();
// land
const land=new THREE.Mesh(new THREE.CylinderGeometry(190,210,6,64),new THREE.MeshStandardMaterial({color:0x8a8478,roughness:1}));
land.position.y=-3;land.receiveShadow=true;scene.add(land);
const pit=new THREE.Mesh(new THREE.CircleGeometry(40,40),new THREE.MeshStandardMaterial({color:0x5b5348,roughness:1}));
pit.rotation.x=-Math.PI/2;pit.position.y=.05;scene.add(pit);

// tower: N floors, tapered, glass + slabs + columns
const N=60,FH=3.2,W0=26;
const floors=[];
const slabM=new THREE.MeshStandardMaterial({color:0xdddddd,roughness:.6});
const glassM=new THREE.MeshStandardMaterial({color:0x6fa8d8,roughness:.08,metalness:.8,transparent:true,opacity:.8,emissive:0xffb060,emissiveIntensity:0});
const colM=new THREE.MeshStandardMaterial({color:0x777777,metalness:.5,roughness:.4});
const tower=new THREE.Group();scene.add(tower);
for(let i=0;i<N;i++){
  const w=W0*(1-.35*Math.pow(i/N,1.3))*(1+.05*Math.sin(i*.4));
  const g=new THREE.Group();g.position.y=i*FH;g.rotation.y=i*.012;
  const slab=new THREE.Mesh(new THREE.BoxGeometry(w+1,.5,w+1),slabM);slab.castShadow=slab.receiveShadow=true;g.add(slab);
  const glass=new THREE.Mesh(new THREE.BoxGeometry(w,FH-.5,w),glassM);glass.position.y=FH/2;glass.castShadow=true;g.add(glass);
  for(const[x,z]of[[1,1],[1,-1],[-1,1],[-1,-1]]){const c=new THREE.Mesh(new THREE.BoxGeometry(.8,FH,.8),colM);c.position.set(x*w/2,FH/2,z*w/2);g.add(c);}
  g.userData={glass,slab,base:i*FH};
  g.visible=false;tower.add(g);floors.push(g);
}
const top=N*FH;
const spire=new THREE.Mesh(new THREE.ConeGeometry(1.2,28,8),colM);spire.position.y=top+14;spire.visible=false;tower.add(spire);
const core=new THREE.Mesh(new THREE.BoxGeometry(6,N*FH,6),new THREE.MeshStandardMaterial({color:0x999999}));core.position.y=N*FH/2;tower.add(core);
// scaffold: frame above current floor
const scaf=new THREE.Group();scene.add(scaf);
const sMat=new THREE.MeshStandardMaterial({color:0xffa500});
const cr=new THREE.Group();scene.add(cr);
function crane(x,z,h,rot){const g=new THREE.Group();g.position.set(x,0,z);
  const m=new THREE.Mesh(new THREE.BoxGeometry(2,h,2),sMat);m.position.y=h/2;m.castShadow=true;g.add(m);
  const jib=new THREE.Group();jib.position.y=h;const a=new THREE.Mesh(new THREE.BoxGeometry(60,1.5,1.5),sMat);a.position.x=15;jib.add(a);
  const cw=new THREE.Mesh(new THREE.BoxGeometry(6,4,3),new THREE.MeshStandardMaterial({color:0x555555}));cw.position.x=-12;jib.add(cw);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(3,3,3),new THREE.MeshStandardMaterial({color:0xeeeeee}));cab.position.set(0,-2.5,0);jib.add(cab);
  const hook=new THREE.Mesh(new THREE.BoxGeometry(.3,12,.3),colM);hook.position.set(30,-6,0);jib.add(hook);
  jib.rotation.y=rot;g.add(jib);g.userData.jib=jib;g.userData.r=rot;cr.add(g);return g;}
const cranes=[crane(32,24,N*FH*.8,0),crane(-34,-20,N*FH*.65,2)];
// containers/trucks/small buildings
const cm=[0xc0392b,0x2980b9,0xe67e22,0x27ae60];
for(let i=0;i<14;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(12,3,3),new THREE.MeshStandardMaterial({color:cm[i%4]}));
  const a=i/14*Math.PI*2+.3,d=70+Math.random()*60;b.position.set(Math.cos(a)*d,1.5,Math.sin(a)*d);b.rotation.y=Math.random()*3;b.castShadow=true;scene.add(b);}
// city across the bay
const cityM=new THREE.MeshStandardMaterial({color:0x2a3144,emissive:0xffc070,emissiveIntensity:0});
for(let i=0;i<120;i++){const h=10+Math.random()*60,w=6+Math.random()*10;
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),cityM);const a=(Math.random()-.5)*1.6-Math.PI/2;const d=900+Math.random()*250;
  b.position.set(Math.cos(a)*d,h/2,Math.sin(a)*d);scene.add(b);}
// sun disc glow reflection strip
const glow=new THREE.Mesh(new THREE.PlaneGeometry(120,1800),new THREE.MeshBasicMaterial({color:0xffa850,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
glow.rotation.x=-Math.PI/2;glow.position.set(-300,-.5,-900);glow.rotation.z=0;scene.add(glow);
// birds-like particles (dust)
const dust=new THREE.Points(new THREE.BufferGeometry().setAttribute("position",new THREE.Float32BufferAttribute(Array.from({length:900},(_,i)=>(Math.random()-.5)*(i%3==1?200:500)+(i%3==1?100:0)),3)),new THREE.PointsMaterial({color:0xffffff,size:.8,transparent:true,opacity:.5}));
scene.add(dust);

const dayFog=new THREE.Color(0xcfe0f0),duskFog=new THREE.Color(0xf09060);
const dayHemi=new THREE.Color(0xcfe6ff),duskHemi=new THREE.Color(0xff9a70);
const dayW=new THREE.Color(0x1e5a8a),duskW=new THREE.Color(0xc0507a);

function resize(){const w=cv.clientWidth||innerWidth,h=cv.clientHeight||innerHeight;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
addEventListener("resize",resize);resize();
let target=0,cur=0;
const upd=()=>{const b=wrap.getBoundingClientRect(),m=b.height-innerHeight;target=m>0?cl(-b.top/m):0};
addEventListener("scroll",upd);upd();
const pts=[ // camera path: [angle, radius, height] by progress
 [0,150,35],[.25,115,45],[.5,95,110],[.75,110,170],[.9,150,150],[1,210,70]];
function path(p){const s=p*(pts.length-1),i=Math.min(pts.length-2,Math.floor(s)),t=sm(s-i);
 return pts[i].map((v,k)=>L(v,pts[i+1][k],t));}
const clock=new THREE.Clock();let raf=0;
function frame(){
  raf=requestAnimationFrame(frame);
  const time=clock.getElapsedTime();
  cur+=(target-cur)*.06;const p=cur;
  // construction progress 0.05..0.8
  const bp=cl((p-.05)/.7),n=bp*N;
  let topY=0;
  floors.forEach((g,i)=>{const k=cl(n-i);g.visible=k>0;if(k>0){g.scale.set(1,sm(k),1);g.position.y=g.userData.base;
    g.children.forEach(c=>{});if(k<1)topY=g.userData.base+FH*k;}else{}});
  if(n>=N)topY=top;
  spire.visible=bp>.97;spire.scale.y=cl((bp-.97)/.03);spire.position.y=top+14*spire.scale.y;
  core.scale.y=Math.max(.001,cl((topY+FH*3)/(N*FH)));core.position.y=core.scale.y*N*FH/2;
  // cranes sway & lift with tower
  cranes.forEach((c,i)=>{c.userData.jib.rotation.y=c.userData.r+Math.sin(time*.2+i)*.5;c.visible=bp<.995||true;});
  // sunset
  const st=sm(cl((p-.78)/.2));skyU.t.value=st;
  scene.fog.color.lerpColors(dayFog,duskFog,st);scene.fog.near=L(200,100,st);
  hemi.color.lerpColors(dayHemi,duskHemi,st);hemi.intensity=L(1,.55,st);
  sun.color.setHex(0xffffff).lerp(new THREE.Color(0xff8a40),st);sun.intensity=L(2.2,1.8,st);
  sun.position.set(L(120,-120,st),L(200,25,st),L(80,-300,st));
  water.material.color.lerpColors(dayW,duskW,st);water.material.emissive.lerpColors(new THREE.Color(0x0a2a4a),new THREE.Color(0x7a3050),st);
  glassM.emissiveIntensity=st*.9;cityM.emissiveIntensity=st*.6;glow.material.opacity=st*.5;
  r.toneMappingExposure=1;
  // water waves
  for(let i=0;i<wp.count;i++){const x=w0[i*3],y=w0[i*3+1];wp.array[i*3+2]=Math.sin(x*.02+time)*.6+Math.cos(y*.03+time*.8)*.6;}
  wp.needsUpdate=true;water.geometry.computeVertexNormals();
  // camera
  const [a,rad,h]=path(p);const ang=a*(Math.PI*2.5-.6)+.6;
  const focusY=L(10,Math.min(topY,N*FH)*.8+10,cl(p*2));
  const fy=L(focusY,150,st);
  cam.position.set(Math.cos(ang)*rad,h,Math.sin(ang)*rad);
  // in finale look toward sunset horizon
  const look=new THREE.Vector3(0,fy,0).lerp(new THREE.Vector3(-150,70,-700),st*.12);
  cam.lookAt(look);
  // UI
  r.render(scene,cam);
}
frame();
return()=>{cancelAnimationFrame(raf);removeEventListener("resize",resize);removeEventListener("scroll",upd);scene.traverse((o:any)=>{o.geometry?.dispose?.();const m=o.material;(Array.isArray(m)?m:m?[m]:[]).forEach((x:any)=>x.dispose?.())});r.dispose();};
}

export default function TowerScene({ onReady }: { onReady?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const cv = ref.current;
    const wrap = cv?.closest(".portal-hero-scroll") as HTMLElement | null;
    if (!cv || !wrap) return;
    let dispose: (() => void) | undefined;
    const header = document.querySelector(".unified-site-header") as HTMLElement | null;
    const setTop = () => wrap.style.setProperty("--hero-top", `${header ? header.offsetHeight : 0}px`);
    setTop();
    const ro = header ? new ResizeObserver(setTop) : null;
    if (header) ro?.observe(header);
    try {
      dispose = createTower(cv, wrap);
      onReady?.();
    } catch {
      setFailed(true);
    }
    return () => {
      ro?.disconnect();
      dispose?.();
    };
  }, [onReady]);
  if (failed) return null;
  return <canvas ref={ref} className="portal-hero__canvas" aria-hidden="true" />;
}
