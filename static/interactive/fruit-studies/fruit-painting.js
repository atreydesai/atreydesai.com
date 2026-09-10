/*
 * FruitPainting — nine procedural fruits in dependency-free Canvas 2D.
 * Technique studied at https://persimmon.humansand.ai/assets/persimmon-underpainting.html
 * New implementation of the geometry, sampling, pigment lighting and interactions.
 * Usage: const painting = new FruitPainting(document.querySelector('canvas'), {fruit:'pear'});
 * API: setFruit(name), setLight('daylight'|'golden'|'dusk'), setGrain(0.65..1.6),
 *      setScatter(boolean), reset(), destroy().
 */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const unit = (x, y, z) => { const m = Math.hypot(x, y, z) || 1; return [x/m, y/m, z/m]; };
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const mix = (a, b, t) => a.map((v, i) => v + (b[i]-v)*t);
  const linear = c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4;
  const lab = ([r,g,b]) => {
    const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b);
    const m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b);
    const s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
    return [.2104542553*l + .793617785*m - .0040720468*s,
      1.9779984951*l - 2.428592205*m + .4505937099*s,
      .0259040371*l + .7827717662*m - .808675766*s];
  };
  // A finite paint box creates separate orange, violet and green marks.
  const swatches = ['fff6cc','f7edac','f6dc67','f6cb3b','efb52d','ffc26a',
    'ffa83c','f89532','f57b34','ec663a','e95344','d8424b','ef947d','edb7a0',
    'd96879','bc496b','a53e68','c583ba','ad69aa','9157a5','7757a6','6354a4',
    '505ca9','3d6db1','528cc1','80acd0','a6c6db','b9b4d9','d0c6e0','357e7e',
    '399c94','6db5a7','a2d1b7','c9dfb5','315c68','3c765e','528f65','78a85d',
    'a3bb68','d1d48c','354a78','494f72','a67d4c',
    'a72d38','8e243e','c8383e','ee5552','f07763','792346','622a50','453456',
    '503975','714394','a784c1','c2a4d4','d5c145','e9d655','b5c153','93a64a',
    'f7e38a','ded092','54714b','5f523b','8c6841'];
  const palette = swatches.map(h => {
    const rgb = [0,2,4].map(i => parseInt(h.slice(i,i+2),16));
    return {rgb, lab:lab(rgb.map(v => linear(v/255)))};
  });
  const presets = {
    daylight: {direction:unit(-.62,-.68,.78), tint:[.9,.94,1], ambient:[.14,.12,.105]},
    golden: {direction:unit(-.85,-.28,.7), tint:[1.13,.76,.46], ambient:[.08,.10,.16]},
    dusk: {direction:unit(.55,-.35,.68), tint:[.65,.76,1.04], ambient:[.095,.085,.13]},
  };
  function random(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let n = Math.imul(seed ^ seed>>>15, seed | 1);
      n ^= n + Math.imul(n ^ n>>>7, n | 61);
      return ((n ^ n>>>14)>>>0) / 4294967296;
    };
  }
  // Bridson sampling: a minimum separation prevents visible rows and clumps.
  function poisson(x0,y0,x1,y1,distance,rng) {
    const cell = distance / Math.SQRT2, cols = Math.ceil((x1-x0)/cell);
    const rows = Math.ceil((y1-y0)/cell), grid = new Int32Array(cols*rows).fill(-1);
    const points = [], active = [];
    const add = (x,y) => {
      grid[Math.floor((y-y0)/cell)*cols + Math.floor((x-x0)/cell)] = points.length;
      active.push(points.length); points.push([x,y]);
    };
    add(x0+rng()*(x1-x0), y0+rng()*(y1-y0));
    while (active.length) {
      const slot = Math.floor(rng()*active.length), p = points[active[slot]];
      let placed = false;
      for (let attempt=0; attempt<20; attempt++) {
        const angle = TAU*rng(), radius = distance*Math.sqrt(1+3*rng());
        const x = p[0]+Math.cos(angle)*radius, y = p[1]+Math.sin(angle)*radius;
        if (x<x0 || x>=x1 || y<y0 || y>=y1) continue;
        const gx=Math.floor((x-x0)/cell), gy=Math.floor((y-y0)/cell);
        let clear=true;
        for(let j=Math.max(0,gy-2); j<=Math.min(rows-1,gy+2)&&clear; j++) {
          for(let i=Math.max(0,gx-2); i<=Math.min(cols-1,gx+2); i++) {
            const idx=grid[j*cols+i];
            if(idx>=0 && (points[idx][0]-x)**2+(points[idx][1]-y)**2<distance**2) {clear=false; break;}
          }
        }
        if(clear) {add(x,y); placed=true; break;}
      }
      if(!placed) {active[slot]=active[active.length-1]; active.pop();}
    }
    return points;
  }
  // All geometry is in fruit radii. Positive y points down the screen.
  function shape(x,y) {
    const exponent=2.40-.16*ease((y+.28)/.65), v=y/.79;
    const a=Math.atan2(v,x);
    return (Math.abs(x)**exponent+Math.abs(v)**exponent)
      *(1+.035*Math.sin(2*a+.6)+.016*Math.sin(3*a-.6));
  }
  function height(x,y) {
    const v=y/.79, s=shape(x,y), power=2.40-.16*ease((y+.28)/.65);
    const edge=Math.max(0,s)**(2/power), round=x*x+v*v;
    const z=Math.sqrt(Math.max(0,1-(round+(edge-round)*ease((edge-.15)/.65))));
    const az=Math.atan2(x,Math.max(.001,z));
    const lobes=.026*Math.cos(4*az+.7)*ease((edge-.18)/.62);
    const dimple=.1*Math.exp(-x*x/.16-(v+.92)**2/.03)*ease(z/.25);
    return z*(.92+lobes)-dimple;
  }
  function normal(x,y) {
    const e=.0015;
    return unit(-(height(x+e,y)-height(x-e,y))/(2*e),
      -(height(x,y+e)-height(x,y-e))/(2*e),1);
  }
  const leafAngles=[-2.53,-.67,.86,2.48];
  function leafAt(x,y) {
    const py=(y+.68)/.65, r=Math.hypot(x,py);
    if((Math.abs(x)<.026 && y<-.67 && y>-.79)||r<.045) return {kind:2};
    for(let k=0;k<4;k++) {
      const cs=Math.cos(leafAngles[k]), sn=Math.sin(leafAngles[k]);
      const u=x*cs+py*sn, length=[.475,.405,.44,.365][k], t=u/length;
      if(t<=0 || t>=1) continue;
      const w=.137*Math.sin(Math.PI*t**.62);
      const across=-x*sn+py*cs - .025*Math.sin(u/.43*Math.PI)*[1,-1,1.5,-.7][k];
      if(Math.abs(across)<w) return {kind:1,k,t,edge:across/w};
    }
    return r<.115 ? {kind:1,k:0,t:0,edge:0} : null;
  }

  // Each fruit supplies an implicit silhouette and a curved depth field.
  const FRUITS = {
    persimmon:{name:'Persimmon',skin:[.88,.28,.033],flesh:[.99,.095,.010],depth:.92},
    apple:{name:'Apple',skin:[.69,.025,.018],flesh:[.95,.085,.025],depth:.84},
    pear:{name:'Pear',skin:[.43,.56,.052],flesh:[.76,.56,.06],depth:.75},
    orange:{name:'Orange',skin:[.97,.32,.021],flesh:[1,.17,.012],depth:.85},
    lemon:{name:'Lemon',skin:[.98,.79,.024],flesh:[1,.60,.028],depth:.57},
    strawberry:{name:'Strawberry',skin:[.88,.024,.033],flesh:[1,.046,.035],depth:.68},
    plum:{name:'Plum',skin:[.16,.036,.29],flesh:[.29,.025,.18],depth:.72},
    cherries:{name:'Cherries',skin:[.57,.009,.022],flesh:[.79,.018,.04],depth:.43},
    banana:{name:'Banana',skin:[.98,.69,.055],flesh:[1,.52,.035],depth:.22},
  };
  function fruitShape(fruit,x,y) {
    if(fruit==='persimmon')return shape(x,y);
    if(fruit==='apple') {
      const u=x/.9,v=(y-.05)/.83,angle=Math.atan2(v,u);
      const notch=.10*Math.exp(-1*((angle+Math.PI/2)/.23)**2);
      const radius=1+.028*Math.cos(4*angle)-notch;
      return (Math.abs(u)**2.4+Math.abs(v)**2.2)/(radius*radius);
    }
    if(fruit==='pear') {
      const width=.37+.54*ease((y+.59)/1.02),v=(y+.01)/.96;
      return (x/width)**2+v*v;
    }
    if(fruit==='orange')return (x/.86)**2+((y-.04)/.84)**2;
    if(fruit==='lemon') {
      const angle=-.29,u=x*Math.cos(angle)+y*Math.sin(angle),v=-x*Math.sin(angle)+y*Math.cos(angle);
      return Math.abs(u/1.06)**1.7+(v/.56)**2;
    }
    if(fruit==='strawberry') {
      const v=(y+.01)/.84,width=.88-.47*ease((y+.57)/1.25);
      return (x/width)**2+v*v;
    }
    if(fruit==='plum')return (x/.73)**2+((y-.02)/.88)**2;
    if(fruit==='cherries')return Math.min(((x+.43)/.43)**2+((y-.37)/.46)**2,((x-.38)/.45)**2+((y-.27)/.47)**2);
    if(fruit==='banana') {
      const u=x*Math.cos(.12)+y*Math.sin(.12),v=(-x*Math.sin(.12)+y*Math.cos(.12)+.53)/.86;
      const angle=Math.atan2(v,u),t=(angle-.20)/2.72;
      if(t<=0||t>=1)return 10;
      const thickness=.045+.195*Math.sin(Math.PI*t)**.55;
      return ((Math.hypot(u,v)-1.10)/thickness)**2;
    }
    return 10;
  }
  function fruitHeight(fruit,x,y) {
    if(fruit==='persimmon')return height(x,y);
    const s=fruitShape(fruit,x,y),z=Math.sqrt(Math.max(0,1-s));
    let h=z*FRUITS[fruit].depth;
    if(fruit==='apple')h-=.10*Math.exp(-x*x/.07-(y+.67)**2/.035)*ease(z/.2);
    if(fruit==='plum')h-=.045*Math.exp(-1*((x-.09*Math.sin(y*2))/.045)**2)*ease(z/.3);
    if(fruit==='banana')h*=1+.11*Math.sin(x*2);
    return h;
  }
  function fruitNormal(fruit,x,y) {
    const e=.0015;
    return unit(-(fruitHeight(fruit,x+e,y)-fruitHeight(fruit,x-e,y))/(2*e),
      -(fruitHeight(fruit,x,y+e)-fruitHeight(fruit,x,y-e))/(2*e),1);
  }
  function pointedLeaf(x,y,ox,oy,angle,length,width) {
    const dx=x-ox,dy=y-oy,cs=Math.cos(angle),sn=Math.sin(angle);
    const along=dx*cs+dy*sn,across=-dx*sn+dy*cs,t=along/length;
    if(t<=0||t>=1)return null;
    const half=width*Math.sin(Math.PI*t)**.8;
    return Math.abs(across)<half ? {kind:1,k:0,t,edge:across/half} : null;
  }
  function fruitFoliage(fruit,x,y) {
    if(fruit==='persimmon')return leafAt(x,y);
    if(fruit==='banana') {
      if(((x+1.07)/.08)**2+((y+.48)/.13)**2<1)return {kind:2};
      return null;
    }
    if(fruit==='strawberry') {
      for(let k=0;k<5;k++) {
        const angle=-Math.PI+k*Math.PI/4;
        const leaf=pointedLeaf(x,y,0,-.68,angle,.42,.075);
        if(leaf)return leaf;
      }
      return Math.abs(x)<.022&&y>-.95&&y<-.68?{kind:2}:null;
    }
    if(fruit==='cherries') {
      if(y>-.98&&y<.08) {
        const t=(y+.98)/1.06;
        const left=.12-.57*t+.08*Math.sin(t*Math.PI),right=.12+.25*t+.12*Math.sin(t*Math.PI);
        if(Math.min(Math.abs(x-left),Math.abs(x-right))<.014)return {kind:2};
      }
      return pointedLeaf(x,y,.12,-.97,2.78,.48,.12);
    }
    const origins={apple:[0,-.69],pear:[-.025,-.89],orange:[0,-.74],lemon:[-.95,.25],plum:[0,-.8]};
    const [ox,oy]=origins[fruit];
    if(fruit==='lemon')return pointedLeaf(x,y,ox,oy,-2.25,.31,.095);
    if(y<oy+.055&&y>oy-.23&&Math.abs(x-(ox+(oy-y)*.26))<.024)return {kind:2};
    const direction=fruit==='pear'?-2.83:-.46;
    return pointedLeaf(x,y,ox+.025,oy-.10,direction,fruit==='orange'?.42:.46,.105);
  }

  class FruitPainting {
    constructor(canvas, options={}) {
      if(!(canvas instanceof HTMLCanvasElement)) throw new TypeError('Expected a canvas');
      this.canvas=canvas; this.ctx=canvas.getContext('2d');
      if(!this.ctx) throw new Error('Canvas 2D is unavailable');
      this.options={seed:84237,background:'#e8edde',fruit:'persimmon',interactive:true,...options};
      this.fruit=this.options.fruit;
      if(!FRUITS[this.fruit])throw new RangeError('Unknown fruit');
      this.grain=clamp(Number(this.options.grain)||1,.65,1.6); this.lightName='daylight'; this.light=[...presets.daylight.direction];
      this.targetLight=[...this.light]; this.spread=0; this.targetSpread=0;
      this.ripples=[]; this.dragging=false; this.frameId=0; this.disposed=false;
      this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
      this.events=new AbortController(); this.visible=true;
      this.wash=document.createElement('canvas'); this.wash.width=this.wash.height=160;
      this.washCtx=this.wash.getContext('2d');
      this.originalTabindex=canvas.getAttribute('tabindex');
      if(this.options.interactive&&!canvas.hasAttribute('tabindex')) canvas.tabIndex=0;
      this.makeDots(); if(this.options.interactive)this.bind();
      else document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.request();},{signal:this.events.signal});
      this.observer=new ResizeObserver(()=>this.resize()); this.observer.observe(canvas);
      this.visibility=new IntersectionObserver(([entry])=>{
        this.visible=entry.isIntersecting;
        if(this.visible) this.request();
      }); this.visibility.observe(canvas);
      this.resize();
    }
    shape(x,y) {return fruitShape(this.fruit,x,y);}
    surfaceHeight(x,y) {return fruitHeight(this.fruit,x,y);}
    normal(x,y) {return fruitNormal(this.fruit,x,y);}
    makeDots() {
      const rng=random(this.options.seed+Object.keys(FRUITS).indexOf(this.fruit)*7919), spacing=.0195*this.grain;
      this.dots=[];
      const add=(x,y,region)=>{
        const kind=region?.kind||0, n=this.shape(x,y)<=1 ? this.normal(x,y) : unit(-.25,-.55,.8);
        if(kind===1) {n[0]+=.18*region.t;n[1]-=.12*region.t;}
        const r=spacing*1.2*(.66+rng()*.70)*(this.shape(x,y)>.92?.78:1);
        this.dots.push({x,y,kind,n:unit(...n),r:kind===2?r*.7:r,
          squash:.68+rng()*.32,rotation:rng()*Math.PI,alpha:.81+rng()*.18,
          pick:rng(),accent:rng(),variation:.95+rng()*.1,phase:rng()*TAU,
          destination:[rng()*2-1,rng()*2-1], color:[0,0,0], css:''});
      };
      const body=poisson(-1.36,-1.24,1.36,1.10,spacing*1.38,rng);
      for(const [x,y] of body) if(this.shape(x,y)<=1&&!fruitFoliage(this.fruit,x,y))add(x,y,null);
      for(let i=0,count=body.length*.13;i<count;i++) {
        const x=rng()*2.72-1.36,y=rng()*2.34-1.24;
        if(this.shape(x,y)<=1&&!fruitFoliage(this.fruit,x,y))add(x,y,null);
      }
      // Thin stems use denser sampling than the body so they remain continuous.
      for(const [x,y] of poisson(-1.38,-1.26,1.38,.22,spacing*.83,rng)) {
        const region=fruitFoliage(this.fruit,x,y);if(region)add(x,y,region);
      }
      if(this.fruit==='strawberry') {
        for(const [x,y] of poisson(-.78,-.58,.78,.75,.17,rng)) {
          if(this.shape(x,y)>.87||fruitFoliage(this.fruit,x,y))continue;
          add(x,y,{kind:3});const seed=this.dots[this.dots.length-1];
          seed.r=.023;seed.squash=.47;seed.rotation=Math.PI/2+x*.3;
        }
      }
      this.needsColor=true;this.request();
    }
    // Shade a continuous surface, then choose one of four nearby paint colors.
    colorize() {
      const preset=presets[this.lightName], L=this.light, H=unit(L[0],L[1],L[2]+1);
      const fill=unit(-.12,-.90,.42);
      for(const d of this.dots) {
        if(d.kind===2||d.kind===3) {
          d.color=d.kind===3?[213,186,96]:[92,100,59];
          d.css=`rgb(${d.color.join(',')})`;continue;
        }
        const n=d.n, facing=dot(n,L), overhead=.26*clamp((dot(n,fill)+.25)/1.25);
        const material=FRUITS[this.fruit];
        let alb=d.kind===1?[.065,.23,.115]:material.skin;
        const flesh=d.kind===1?[.20,.48,.11]:material.flesh;
        if(d.kind===0&&this.fruit==='apple') {
          const stripe=ease((Math.sin(d.x*23+d.y*4)-.3)/.7)*.22;
          alb=mix(alb,[.95,.45,.04],stripe);
        }
        if(d.kind===0&&this.fruit==='pear'&&d.accent>.965)alb=[.36,.23,.035];
        if(d.kind===0&&this.fruit==='banana'&&Math.abs(d.x)>1.04)alb=mix(alb,[.22,.30,.025],.55);
        const wrap=d.kind===1?[.148,.148,.042]:[.151,.049,.018];
        const z=clamp(this.surfaceHeight(d.x,d.y)/material.depth);
        const occlusion=(1-.42*ease((d.y/.79-.45)/.55)*Math.sqrt(1-z))
          *(1-.3*Math.exp(-(d.x*d.x+(d.y/.79+.9)**2*2.5)/.2));
        const shadowQ=((d.x+.2*L[0])/.46)**2+((d.y/.79+.85+.22*L[1])/.17)**2;
        const shadow=d.kind===0&&['persimmon','strawberry','apple'].includes(this.fruit) ? .70*Math.max(0,1-shadowQ)**2 : 0;
        const highlight=.065*Math.max(0,dot(n,H))**65;
        const glow=.42*(.10*Math.exp(-((facing+.05)**2)/.125)+.025);
        const bounce=.20*clamp(dot(n,unit(.46,.8,.3)))*(1-z)**1.6;
        const rgb=alb.map((a,i)=>a*clamp((facing+wrap[i])/(1+wrap[i]))*(1-shadow)*preset.tint[i]
          +a*[1,.92,.78][i]*overhead + mix(alb,flesh,.21)[i]*preset.ambient[i]*occlusion
          +flesh[i]*glow*preset.tint[i]+highlight*preset.tint[i]+a*bounce);
        const target=lab(rgb.map(v=>v<.75?v:.75+.25*(1-Math.exp(-(v-.75)/.25))));
        target[0]=.55+(target[0]-.55)*1.12; target[1]*=1.34; target[2]*=1.34;
        const passage=.5+.25*Math.sin(d.x*4.2+d.y*3.5)+.25*Math.sin(d.y*6.8-d.x*2.1);
        const shade=ease((.6-facing-overhead)/1.15);
        const cool=shade*(.23+.24*passage)*(1-.9*ease((target[0]-.80)/.16));
        if(d.kind===0) {
          if(d.accent<cool) {target[1]=.025+passage*.085; target[2]=-.145+passage*.045;}
          else if(d.accent<cool+shade*.13&&['persimmon','apple','strawberry','cherries','plum'].includes(this.fruit)) {target[1]=.145; target[2]=-.023;}
          else if(d.accent>.975&&shade>.15) {target[1]=-.09; target[2]=-.027;}
          else if(d.accent>.955&&target[0]>.69&&target[0]<.88) {target[1]=-.045;target[2]=.055;}
        } else {
          target[0]=Math.max(.43,target[0]);
          if(d.accent<.25) {target[1]=-.042;target[2]=-.072;}
          else if(d.accent>.78) {target[1]=-.075;target[2]=.13;target[0]=Math.max(.65,target[0]);}
          else {target[1]=Math.min(-.055,target[1]);target[2]*=.6;}
        }
        const nearest=[];
        for(const p of palette) {
          const distance=2*(p.lab[0]-target[0])**2+(p.lab[1]-target[1])**2+(p.lab[2]-target[2])**2;
          let at=0; while(at<nearest.length&&nearest[at].distance<distance) at++;
          if(at<4) {nearest.splice(at,0,{p,distance,weight:1/(distance+.0003)**.9});nearest.length=Math.min(4,nearest.length);}
        }
        let choice=d.pick*nearest.reduce((sum,p)=>sum+p.weight,0), selected=nearest[3];
        for(const p of nearest) {choice-=p.weight;if(choice<=0){selected=p;break;}}
        d.color=selected.p.rgb.map(v=>Math.round(clamp(v*d.variation,0,255)));
        d.css=`rgb(${d.color.join(',')})`;
      }
      this.makeWash(); this.needsColor=false;
    }
    // Normalized pigment splats on a small offscreen field fill pinholes softly.
    makeWash() {
      const size=160, field=new Float32Array(size*size*4), scale=size/2.9;
      for(const d of this.dots) if(d.kind===0) {
        const cx=(d.x+1.45)*scale,cy=(d.y+1.45)*scale,r=Math.max(2,d.r*4.4*scale);
        for(let y=Math.max(0,Math.ceil(cy-r));y<Math.min(size,cy+r);y++) {
          for(let x=Math.max(0,Math.ceil(cx-r));x<Math.min(size,cx+r);x++) {
            const q=((x-cx)**2+(y-cy)**2)/(r*r); if(q>=1) continue;
            const weight=(1-q)**2*d.alpha,i=(y*size+x)*4;
            for(let c=0;c<3;c++) field[i+c]+=d.color[c]*weight;
            field[i+3]+=weight;
          }
        }
      }
      const pixels=this.washCtx.createImageData(size,size);
      for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
        const i=(y*size+x)*4,w=field[i+3];
        if(w<=.8||this.shape(x/scale-1.45,y/scale-1.45)>1) continue;
        for(let c=0;c<3;c++) pixels.data[i+c]=field[i+c]/w;
        const luminance=.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2];
        pixels.data[i+3]=255*ease((w-.8)/2)*(.15+.27*ease((218-luminance)/145));
      }
      this.washCtx.putImageData(pixels,0,0);
    }
    resize() {
      const bounds=this.canvas.getBoundingClientRect(); if(!bounds.width||!bounds.height) return;
      this.width=bounds.width; this.height=bounds.height;
      this.dpr=Math.min(devicePixelRatio||1,2,Math.sqrt(8000000/(this.width*this.height)));
      this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);
      this.radius=Math.min(this.width*.34,this.height*.38);this.cx=this.width*.5;this.cy=this.height*.55;
      this.request();
    }
    request() {
      if(!this.disposed&&!this.frameId&&this.visible&&!document.hidden) this.frameId=requestAnimationFrame(t=>this.draw(t));
    }
    draw(now) {
      this.frameId=0; if(this.disposed||!this.radius||!this.visible||document.hidden) return;
      const dt=Math.min(50,now-(this.lastFrame||now));this.lastFrame=now;
      const follow=this.reduced.matches?1:1-Math.exp(-dt/115);
      const delta=Math.hypot(...this.light.map((v,i)=>v-this.targetLight[i]));
      if(delta>.003) {this.light=unit(...mix(this.light,this.targetLight,follow));this.needsColor=true;}
      const spreading=Math.abs(this.targetSpread-this.spread)>.001;
      if(spreading) this.spread+= (this.targetSpread-this.spread)*(this.reduced.matches?1:1-Math.exp(-dt/240));
      else this.spread=this.targetSpread;
      if(this.needsColor) this.colorize();
      this.ripples=this.reduced.matches?[]:this.ripples.filter(r=>now-r.time<2600);
      const ctx=this.ctx,R=this.radius;
      ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.width,this.height);
      if(this.options.background) {ctx.fillStyle=this.options.background;ctx.fillRect(0,0,this.width,this.height);}
      ctx.globalAlpha=1-ease(this.spread*3);
      ctx.drawImage(this.wash,this.cx-1.45*R,this.cy-1.45*R,2.9*R,2.9*R);
      for(const d of this.dots) {
        const scatter=ease(this.spread);
        let x=this.cx+d.x*R,y=this.cy+d.y*R;
        x+=(this.width*(.5+.47*d.destination[0])-x)*scatter;
        y+=(this.height*(.5+.44*d.destination[1])-y)*scatter;
        let ripple=0;
        for(const wave of this.ripples) {
          // Angular distance approximates waves travelling around the curved skin.
          const dist=Math.acos(clamp(dot(d.n,wave.normal),-1,1));
          const age=(now-wave.time)/1000,front=dist-age*1.9;
          ripple+=Math.sin(front*25)*Math.exp(-front*front*9)*Math.exp(-age*1.8)*wave.strength;
        }
        ctx.fillStyle=d.css;
        if(Math.abs(ripple)>.035&&d.kind<2) {
          const color=mix(d.color,ripple>0?[255,224,158]:[120,118,194],clamp(Math.abs(ripple)*.75));
          ctx.fillStyle=`rgb(${color.map(Math.round).join(',')})`;
        }
        const r=d.r*R;
        ctx.globalAlpha=d.alpha*(1-scatter*.62);
        ctx.beginPath();ctx.ellipse(x,y,r,r*d.squash,d.rotation,0,TAU);ctx.fill();
      }
      ctx.globalAlpha=1;
      this.canvas.dataset.marks=String(this.dots.length);
      this.canvas.dataset.ready='true';this.canvas.dataset.fruit=this.fruit;
      if(delta>.003||spreading||this.ripples.length) this.request();
    }
    point(event) {
      const b=this.canvas.getBoundingClientRect();
      return [(event.clientX-b.left-this.cx)/this.radius,(event.clientY-b.top-this.cy)/this.radius];
    }
    wave(point,strength=.85) {
      if(this.reduced.matches||this.shape(...point)>1.1) return;
      const now=performance.now();
      if(this.lastWave&&now-this.lastWave<45) return;
      this.lastWave=now;this.ripples.push({normal:this.normal(...point),time:now,strength});
      if(this.ripples.length>14)this.ripples.shift();this.request();
    }
    bind() {
      const signal=this.events.signal,on=(target,type,fn,opts={})=>target.addEventListener(type,fn,{...opts,signal});
      on(this.canvas,'pointerdown',e=>{
        if(e.button!==0) return;
        this.dragging=true;this.canvas.setPointerCapture(e.pointerId);this.wave(this.point(e));
      });
      on(this.canvas,'pointermove',e=>{
        if(e.pointerType==='touch'&&!this.dragging) return;
        const p=this.point(e);this.targetLight=unit(clamp(p[0],-1.4,1.4),clamp(p[1],-1.3,1.3),.9);
        if(this.dragging)this.wave(p);this.request();
      });
      on(this.canvas,'pointerup',()=>{this.dragging=false;});
      on(this.canvas,'pointercancel',()=>{this.dragging=false;});
      on(this.canvas,'lostpointercapture',()=>{this.dragging=false;});
      on(this.canvas,'pointerleave',()=>{if(!this.dragging){this.targetLight=[...presets[this.lightName].direction];this.request();}});
      on(this.canvas,'keydown',e=>{
        const moves={ArrowLeft:[-.16,0],ArrowRight:[.16,0],ArrowUp:[0,-.16],ArrowDown:[0,.16]};
        if(moves[e.key]) {e.preventDefault();const [x,y]=moves[e.key];this.targetLight=unit(this.targetLight[0]+x,this.targetLight[1]+y,.85);this.request();}
        else if(e.key.toLowerCase()==='s')this.setScatter(!this.targetSpread);
        else if(e.key==='Escape')this.reset();
        else if(e.key==='+'||e.key==='=')this.setGrain(this.grain+.1);
        else if(e.key==='-')this.setGrain(this.grain-.1);
        else if(['1','2','3'].includes(e.key))this.setLight(['daylight','golden','dusk'][Number(e.key)-1]);
      });
      on(document,'visibilitychange',()=>{if(!document.hidden){this.lastFrame=performance.now();this.request();}});
      on(this.reduced,'change',()=>this.request());
    }
    changed() {this.canvas.dispatchEvent(new CustomEvent('paintingchange',{detail:{fruit:this.fruit,grain:this.grain,light:this.lightName,scattered:!!this.targetSpread}}));}
    setFruit(name) {
      if(!FRUITS[name])throw new RangeError('Unknown fruit');
      this.fruit=name;this.ripples=[];this.lastWave=0;this.spread=0;this.targetSpread=0;
      this.makeDots();this.changed();
    }
    setLight(name) {
      if(!presets[name])throw new RangeError('Unknown light preset');
      this.lightName=name;this.targetLight=[...presets[name].direction];this.needsColor=true;this.request();this.changed();
    }
    setGrain(value) {
      if(!Number.isFinite(Number(value)))throw new TypeError('Grain must be a finite number');
      this.grain=clamp(Number(value),.65,1.6);this.makeDots();this.changed();
    }
    setScatter(value) {this.targetSpread=value?1:0;this.request();this.changed();}
    reset() {
      this.lightName='daylight';this.targetLight=[...presets.daylight.direction];this.targetSpread=0;
      this.ripples=[];this.needsColor=true;if(this.grain!==1){this.grain=1;this.makeDots();}
      this.request();this.changed();
    }
    destroy() {
      this.disposed=true;cancelAnimationFrame(this.frameId);this.events.abort();
      this.observer.disconnect();this.visibility.disconnect();
      if(this.originalTabindex===null)this.canvas.removeAttribute('tabindex');
      else this.canvas.setAttribute('tabindex',this.originalTabindex);
    }
  }
  FruitPainting.fruits=Object.freeze(Object.fromEntries(Object.entries(FRUITS).map(([id,fruit])=>[id,fruit.name])));
  window.FruitPainting=FruitPainting;
  window.PersimmonPainting=FruitPainting; // Backward-compatible constructor.
})();
