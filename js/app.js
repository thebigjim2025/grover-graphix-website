
  // mobile menu
  const menuBtn=document.getElementById('menu-btn');
  const navLinks=document.getElementById('nav-links');
  menuBtn.addEventListener('click',()=>navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>navLinks.classList.remove('open')));

  // scroll reveal
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target);} });
  },{threshold:.15});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

  // animated counters
  const counterIO=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting) return;
      const el=e.target, target=+el.dataset.count, suffix=el.dataset.suffix!==undefined?el.dataset.suffix:'+';
      const t0=performance.now(), dur=1400;
      (function tick(now){
        const p=Math.min((now-t0)/dur,1);
        el.textContent=Math.round(target*(1-Math.pow(1-p,3)))+(p===1?suffix:'');
        if(p<1) requestAnimationFrame(tick);
      })(t0);
      counterIO.unobserve(el);
    });
  },{threshold:.6});
  document.querySelectorAll('[data-count]').forEach(el=>counterIO.observe(el));

  // 3D tilt on cards + work pieces
  const tiltEls=document.querySelectorAll('.card,.work,.step');
  tiltEls.forEach(el=>{
    el.addEventListener('mousemove',e=>{
      const r=el.getBoundingClientRect();
      const px=(e.clientX-r.left)/r.width-.5, py=(e.clientY-r.top)/r.height-.5;
      el.style.transform=`perspective(1000px) rotateY(${px*10}deg) rotateX(${-py*10}deg) translateY(-6px)`;
      el.style.transition='transform .08s linear';
    });
    el.addEventListener('mouseleave',()=>{
      el.style.transition='transform .5s ease';
      el.style.transform='';
    });
  });


  // ---------- 3D scene: bloom + particle wordmark + devices + camera journey ----------
  (function(){
    const canvas=document.getElementById('grid-canvas');
    if(!window.THREE){ canvas.remove(); return; }

    const MOBILE=innerWidth<760;
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,120);
    camera.position.set(0,0,9);

    // lights
    scene.add(new THREE.AmbientLight(0x334466,.9));
    const l1=new THREE.PointLight(0x00e5ff,1.4,60); l1.position.set(6,4,6); scene.add(l1);
    const l2=new THREE.PointLight(0x7c5cff,1.3,60); l2.position.set(-6,-3,5); scene.add(l2);
    const l3=new THREE.PointLight(0xff3d9a,.9,60);  l3.position.set(0,6,-4); scene.add(l3);

    // ---- hero centrepiece ----
    const heroGroup=new THREE.Group();
    const knot=new THREE.Mesh(
      new THREE.TorusKnotGeometry(2.1,.55,180,24),
      new THREE.MeshStandardMaterial({color:0x0d1322,metalness:.85,roughness:.25,emissive:0x061020})
    );
    const knotWire=new THREE.Mesh(
      new THREE.TorusKnotGeometry(2.12,.56,90,12),
      new THREE.MeshBasicMaterial({color:0x00e5ff,wireframe:true,transparent:true,opacity:.28})
    );
    const core=new THREE.Mesh(
      new THREE.IcosahedronGeometry(.9,1),
      new THREE.MeshBasicMaterial({color:0x7c5cff,wireframe:true,transparent:true,opacity:.7})
    );
    heroGroup.add(knot,knotWire,core);
    heroGroup.position.set(3.4,.3,0);
    scene.add(heroGroup);

    // satellites orbiting the centrepiece
    const shardCols=[0x00e5ff,0x7c5cff,0xff3d9a,0x36f2b3];
    const sats=new THREE.Group();
    const SAT=MOBILE?4:7;
    for(let i=0;i<SAT;i++){
      const s=new THREE.Mesh(new THREE.IcosahedronGeometry(.16,0),
        new THREE.MeshBasicMaterial({color:shardCols[i%4],wireframe:true,transparent:true,opacity:.9}));
      s.userData={r:3.4+(i%3)*.5,sp:.4+i*.13,ph:i/SAT*Math.PI*2,tilt:i*.4};
      sats.add(s);
    }
    heroGroup.add(sats);

    // round glow sprite for particles
    const dotCanvas=document.createElement('canvas');dotCanvas.width=dotCanvas.height=64;
    (function(){const x=dotCanvas.getContext('2d');
      const g=x.createRadialGradient(32,32,0,32,32,32);
      g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.4,'rgba(255,255,255,.6)');g.addColorStop(1,'rgba(255,255,255,0)');
      x.fillStyle=g;x.fillRect(0,0,64,64);})();
    const dotTex=new THREE.CanvasTexture(dotCanvas);

    // ---- particle wordmark ----
    let word=null,wordHome=null,wordVel=null,wordN=0,wordActive=true;
    const WORD_Z=1.2;
    let wordBuilds=0;
    function buildWordmark(){
      const rebuild=wordBuilds++>0;
      if(word){scene.remove(word);word.geometry.dispose();word.material.dispose();}
      const cw=1024,ch=140,c2=document.createElement('canvas');c2.width=cw;c2.height=ch;
      const x=c2.getContext('2d');
      x.fillStyle='#fff';x.font='700 92px "Space Grotesk",Arial,sans-serif';
      x.textAlign='center';x.textBaseline='middle';
      x.fillText('GROVER GRAPHIX',cw/2,ch/2+4);
      const data=x.getImageData(0,0,cw,ch).data;
      const step=MOBILE?4:3, pts=[];
      for(let py=0;py<ch;py+=step)for(let px=0;px<cw;px+=step){
        if(data[(py*cw+px)*4+3]>128)pts.push([px,py]);
      }
      wordN=pts.length;
      const pos=new Float32Array(wordN*3),col=new Float32Array(wordN*3);
      wordHome=new Float32Array(wordN*3);wordVel=new Float32Array(wordN*3);
      const scale=MOBILE?.55:1, cA=new THREE.Color(0x00e5ff),cB=new THREE.Color(0x7c5cff),cC=new THREE.Color(0xff3d9a),tmp=new THREE.Color();
      for(let i=0;i<wordN;i++){
        const u=pts[i][0]/cw;
        const wx=(u-.5)*12.5*scale, wy=-((pts[i][1]/ch)-.5)*1.7*scale-3.3, wz=WORD_Z+(Math.random()-.5)*.2;
        wordHome[i*3]=wx;wordHome[i*3+1]=wy;wordHome[i*3+2]=wz;
        // first build: big scatter for the assembly moment; rebuilds: tiny scatter
        pos[i*3]=wx+(Math.random()-.5)*18/ (rebuild?12:1);pos[i*3+1]=wy+(Math.random()-.5)*12/(rebuild?12:1);pos[i*3+2]=wz+(Math.random()-.5)*10/(rebuild?12:1);
        (u<.5?tmp.copy(cA).lerp(cB,u*2):tmp.copy(cB).lerp(cC,(u-.5)*2));
        col[i*3]=tmp.r;col[i*3+1]=tmp.g;col[i*3+2]=tmp.b;
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      g.setAttribute('color',new THREE.BufferAttribute(col,3));
      word=new THREE.Points(g,new THREE.PointsMaterial({size:MOBILE?.08:.095,map:dotTex,vertexColors:true,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));
      scene.add(word);
    }
    buildWordmark();
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>buildWordmark());

    // mouse point on the wordmark plane (for scatter)
    const ray=new THREE.Raycaster(), mVec=new THREE.Vector2(), wordPlane=new THREE.Plane(new THREE.Vector3(0,0,1),-WORD_Z), hit=new THREE.Vector3();
    let hitOk=false;

    // ---- device mockups (solutions station) ----
    function screenTex(title,accent,phone){
      const w=phone?512:1024,h=phone?1024:640;
      const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
      x.fillStyle='#0a0e1a';x.fillRect(0,0,w,h);
      const grad=x.createLinearGradient(0,0,w,0);grad.addColorStop(0,accent);grad.addColorStop(1,'#7c5cff');
      x.fillStyle=grad;x.fillRect(0,0,w,phone?170:120);
      x.fillStyle='#04121a';x.font=`700 ${phone?54:56}px Arial`;x.textBaseline='middle';
      x.fillText(title,40,phone?95:66);
      // cards
      x.fillStyle='#111a2e';
      const rows=phone?5:3, cols=phone?1:2, cw2=(w-80-(cols-1)*30)/cols, chh=phone?120:130;
      for(let r=0;r<rows;r++)for(let cc=0;cc<cols;cc++){
        const cx=40+cc*(cw2+30), cy=(phone?220:170)+r*(chh+26);
        x.fillRect(cx,cy,cw2,chh);
        x.fillStyle=accent;x.fillRect(cx,cy,10,chh);x.fillStyle='#111a2e';
        x.fillStyle='#2a3550';x.fillRect(cx+34,cy+30,cw2*.55,18);x.fillRect(cx+34,cy+64,cw2*.35,14);
        x.fillStyle='#111a2e';
      }
      // chart bars (bottom)
      if(!phone){for(let i=0;i<12;i++){const bh=30+Math.abs(Math.sin(i*1.7))*120;
        x.fillStyle=i%3?'#1d3a5f':accent;x.fillRect(60+i*80,h-40-bh,44,bh);}}
      const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
    }
    const devices=new THREE.Group();
    const darkMat=new THREE.MeshStandardMaterial({color:0x0b1020,metalness:.8,roughness:.35});
    // phone — Empowered Tradie
    const phone=new THREE.Group();
    phone.add(new THREE.Mesh(new THREE.BoxGeometry(1.18,2.4,.09),darkMat));
    const pScreen=new THREE.Mesh(new THREE.PlaneGeometry(1.06,2.26),
      new THREE.MeshBasicMaterial({map:screenTex('Empowered Tradie','#00e5ff',true)}));
    pScreen.position.z=.051;phone.add(pScreen);
    phone.position.set(7.6,-1.4,-3);phone.rotation.y=-.45;
    devices.add(phone);
    // laptop — Prenota
    const laptop=new THREE.Group();
    const base=new THREE.Mesh(new THREE.BoxGeometry(2.7,.09,1.75),darkMat);laptop.add(base);
    const lid=new THREE.Group();
    lid.add(new THREE.Mesh(new THREE.BoxGeometry(2.7,1.7,.07),darkMat));
    const lScreen=new THREE.Mesh(new THREE.PlaneGeometry(2.55,1.55),
      new THREE.MeshBasicMaterial({map:screenTex('Prenota','#ff3d9a',false)}));
    lScreen.position.z=.04;lid.add(lScreen);
    lid.position.set(0,.85,-.83);lid.rotation.x=-.32;
    laptop.add(lid);
    laptop.position.set(10.3,-3.1,-4.6);laptop.rotation.y=-.55;
    devices.add(laptop);
    scene.add(devices);

    // ---- shard field ----
    const shards=new THREE.Group();
    const shardGeos=[
      new THREE.OctahedronGeometry(.5),new THREE.TetrahedronGeometry(.45),new THREE.IcosahedronGeometry(.4),
      new THREE.DodecahedronGeometry(.42),new THREE.TorusGeometry(.42,.12,10,26),
      new THREE.ConeGeometry(.36,.7,6),new THREE.BoxGeometry(.5,.5,.5)
    ];
    const SHARDS=MOBILE?36:80;
    for(let i=0;i<SHARDS;i++){
      const m=new THREE.Mesh(shardGeos[i%shardGeos.length],
        new THREE.MeshBasicMaterial({color:shardCols[i%4],wireframe:true,transparent:true,opacity:.28+Math.random()*.25}));
      m.position.set((Math.random()-.5)*30,(Math.random()-.5)*18,-2-Math.random()*16);
      m.rotation.set(Math.random()*3,Math.random()*3,0);
      m.scale.setScalar(.6+Math.random()*1.1);
      m.userData={rs:.002+Math.random()*.007,fs:.4+Math.random()*.8,fa:.15+Math.random()*.35,y0:m.position.y,ph:Math.random()*6.28};
      shards.add(m);
    }
    scene.add(shards);

    // ---- ring system (capabilities station) ----
    const rings=new THREE.Group();
    const ringCols=[0x00e5ff,0x7c5cff,0xff3d9a];
    for(let i=0;i<3;i++){
      const r=new THREE.Mesh(new THREE.TorusGeometry(1.5+i*.55,.03,10,90),
        new THREE.MeshBasicMaterial({color:ringCols[i],transparent:true,opacity:.35}));
      r.rotation.x=1.1+i*.4;r.rotation.y=i*.7;r.userData={sp:.15+i*.08};
      rings.add(r);
    }
    const ringCore=new THREE.Mesh(new THREE.OctahedronGeometry(.55,0),
      new THREE.MeshStandardMaterial({color:0x111a2e,metalness:.9,roughness:.2,emissive:0x0a1430}));
    rings.add(ringCore);
    rings.position.set(-5.6,2.2,-3);
    scene.add(rings);

    // ---- nested cubes (capabilities station) ----
    const cubes=new THREE.Group();
    for(let i=0;i<3;i++){
      const c=new THREE.Mesh(new THREE.BoxGeometry(1+i*.55,1+i*.55,1+i*.55),
        new THREE.MeshBasicMaterial({color:ringCols[i],wireframe:true,transparent:true,opacity:.4-i*.09}));
      c.userData={sp:(i%2?-1:1)*(.3-i*.07)};
      cubes.add(c);
    }
    cubes.position.set(-8,3.6,-6);
    scene.add(cubes);

    // ---- ring tunnel (process station) ----
    const tunnel=new THREE.Group();
    const TUN=MOBILE?8:14;
    for(let i=0;i<TUN;i++){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(3.2+i*.28,.02,8,64),
        new THREE.MeshBasicMaterial({color:ringCols[i%3],transparent:true,opacity:.22-i*.011}));
      ring.position.z=-8-i*2.6;
      ring.userData={sp:(i%2?1:-1)*(.1+i*.02)};
      tunnel.add(ring);
    }
    tunnel.position.set(0,-1,0);
    scene.add(tunnel);

    // ---- helix (lab station) ----
    const helix=new THREE.Group();
    const HEL=MOBILE?26:44;
    const sGeo=new THREE.SphereGeometry(.09,8,8);
    for(let i=0;i<HEL;i++){
      const a=i/HEL*Math.PI*5,y=i/HEL*11-5.5;
      for(const pc of [[0,0x00e5ff],[Math.PI,0xff3d9a]]){
        const s=new THREE.Mesh(sGeo,new THREE.MeshBasicMaterial({color:pc[1],transparent:true,opacity:.75}));
        s.position.set(Math.cos(a+pc[0])*1.1,y,Math.sin(a+pc[0])*1.1);
        helix.add(s);
      }
      if(i%3===0){
        const bar=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,2.2,5),
          new THREE.MeshBasicMaterial({color:0x7c5cff,transparent:true,opacity:.35}));
        bar.position.y=y;bar.rotation.z=Math.PI/2;bar.rotation.y=-a;
        helix.add(bar);
      }
    }
    helix.position.set(-9,-2,-6);
    scene.add(helix);

    // ---- deep filler ----
    const bigSphere=new THREE.Mesh(new THREE.SphereGeometry(7,24,18),
      new THREE.MeshBasicMaterial({color:0x2b4a8f,wireframe:true,transparent:true,opacity:.12}));
    bigSphere.position.set(0,-4,-16);
    scene.add(bigSphere);
    const rings2=new THREE.Group();
    for(let i=0;i<4;i++){
      const r=new THREE.Mesh(new THREE.TorusGeometry(1.1+i*.45,.025,8,80),
        new THREE.MeshBasicMaterial({color:ringCols[(i+1)%3],transparent:true,opacity:.3}));
      r.rotation.x=.6+i*.5;r.rotation.z=i*.9;r.userData={sp:.2+i*.07};
      rings2.add(r);
    }
    const rings2Core=new THREE.Mesh(new THREE.DodecahedronGeometry(.5,0),
      new THREE.MeshBasicMaterial({color:0x36f2b3,wireframe:true,transparent:true,opacity:.8}));
    rings2.add(rings2Core);
    rings2.position.set(-2,-7,-9);
    scene.add(rings2);

    // grid floor
    const gridGeo=new THREE.PlaneGeometry(60,34,MOBILE?24:46,MOBILE?14:26);
    const grid=new THREE.Mesh(gridGeo,new THREE.MeshBasicMaterial({color:0x1c3a7a,wireframe:true,transparent:true,opacity:.16}));
    grid.rotation.x=-Math.PI/2.15;grid.position.set(0,-8,-8);
    scene.add(grid);
    const gpos=gridGeo.attributes.position,gz0=Float32Array.from(gpos.array);

    // particle layers
    function makePoints(n,spread,colr,size,op){
      const g=new THREE.BufferGeometry(),a=new Float32Array(n*3);
      for(let i=0;i<n;i++){a[i*3]=(Math.random()-.5)*spread;a[i*3+1]=(Math.random()-.5)*spread*.6;a[i*3+2]=-3-Math.random()*24;}
      g.setAttribute('position',new THREE.BufferAttribute(a,3));
      const p=new THREE.Points(g,new THREE.PointsMaterial({color:colr,size:size*1.6,map:dotTex,transparent:true,opacity:op,depthWrite:false}));
      scene.add(p);return p;
    }
    const stars=makePoints(700,42,0x5a8cff,.05,.8);
    const dust=makePoints(MOBILE?200:450,44,0x00e5ff,.035,.6);
    const sparks=makePoints(MOBILE?120:260,40,0xff3d9a,.045,.5);

    // ---- bloom composer ----
    let composer=null,useBloom=false;
    try{
      composer=new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene,camera));
      const bloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),MOBILE?.7:.95,.6,.12);
      composer.addPass(bloom);
      useBloom=true;
    }catch(e){useBloom=false;}

    // ---- camera journey ----
    // waypoints: [camera position, look-at target]
    const WAYPTS=[
      [[0,0,9],[.8,-.6,0]],          // hero — knot + wordmark
      [[-2.6,1.6,3],[-6.4,3,-5]],    // capabilities — rings + cubes
      [[0,-1,5],[0,-1,-24]],         // process — down the tunnel
      [[3.4,-.7,4.2],[8.8,-2.3,-4.2]],// solutions — devices
      [[-4.6,-1.2,-.5],[-9,-2,-6]],  // lab — helix
      [[0,1.5,13],[0,-1.5,-4]]       // contact — wide pull-back
    ];
    let fracs=[0,.2,.4,.6,.8,1];
    function computeFracs(){
      const ids=['top','capabilities','process','solutions','lab','contact'];
      const dh=Math.max(1,document.body.scrollHeight-innerHeight);
      fracs=ids.map(id=>{const el=document.getElementById(id);return el?Math.min(1,el.offsetTop/dh):0;});
      fracs[0]=0;fracs[fracs.length-1]=1;
    }
    const smooth=x=>x*x*(3-2*x);
    const camPos=new THREE.Vector3(0,0,9),camLook=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3();
    function journey(scroll){
      let i=0;
      while(i<fracs.length-2&&scroll>fracs[i+1])i++;
      const span=Math.max(.0001,fracs[i+1]-fracs[i]);
      const p=smooth(Math.min(1,Math.max(0,(scroll-fracs[i])/span)));
      v1.fromArray(WAYPTS[i][0]).lerp(v2.fromArray(WAYPTS[i+1][0]),p);
      camPos.copy(v1);
      v1.fromArray(WAYPTS[i][1]).lerp(v2.fromArray(WAYPTS[i+1][1]),p);
      camLook.copy(v1);
    }

    // ---- input ----
    let mx=0,my=0,tx=0,ty=0;
    addEventListener('mousemove',e=>{
      tx=e.clientX/innerWidth-.5;ty=e.clientY/innerHeight-.5;
      mVec.x=tx*2;mVec.y=-ty*2;
      ray.setFromCamera(mVec,camera);
      hitOk=ray.ray.intersectPlane(wordPlane,hit)!==null;
    },{passive:true});
    function resize(){
      renderer.setSize(innerWidth,innerHeight,false);
      if(composer)composer.setSize(innerWidth,innerHeight);
      camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
      heroGroup.position.x=innerWidth<760?0:3.4;
      heroGroup.scale.setScalar(innerWidth<760?.62:1);
      computeFracs();
    }
    resize();addEventListener('resize',resize);
    addEventListener('load',computeFracs);

    // ---- adaptive quality ----
    let frames=0,lastCheck=performance.now(),quality=2;
    function degrade(){
      if(quality===2){
        renderer.setPixelRatio(1);useBloom=false;
        scene.remove(sparks);
        for(let i=shards.children.length-1;i>0;i-=2)shards.remove(shards.children[i]);
        quality=1;
      }else if(quality===1){
        [tunnel,grid,helix,cubes,rings2,dust].forEach(o=>scene.remove(o));
        wordActive=false;
        quality=0;
      }
    }

    const clock=new THREE.Clock();
    (function animate(){
      const t=clock.getElapsedTime();
      frames++;
      const now=performance.now();
      if(now-lastCheck>2000){
        const fps=frames/((now-lastCheck)/1000);
        if(fps<26&&t>3)degrade();
        frames=0;lastCheck=now;
      }
      mx+=(tx-mx)*.04;my+=(ty-my)*.04;
      const scroll=scrollY/Math.max(1,document.body.scrollHeight-innerHeight);

      // hero centrepiece
      heroGroup.rotation.y=t*.22+mx*.9;
      heroGroup.rotation.x=t*.11+my*.6;
      core.rotation.y=-t*.6;core.rotation.z=t*.35;
      core.scale.setScalar(1+Math.sin(t*1.6)*.06);
      sats.children.forEach(s=>{
        const u=s.userData,a=t*u.sp+u.ph;
        s.position.set(Math.cos(a)*u.r,Math.sin(a)*u.r*Math.sin(u.tilt),Math.sin(a)*u.r*Math.cos(u.tilt));
        s.rotation.x=t;s.rotation.y=t*1.3;
      });

      // wordmark particle physics (fades out past the hero)
      if(word){
        word.material.opacity=Math.max(0,.95*(1-scroll*5));
        word.visible=word.material.opacity>.01;
      }
      if(word&&wordActive&&word.visible){
        const pa=word.geometry.attributes.position.array;
        const R=1.6,R2=R*R;
        for(let i=0;i<wordN;i++){
          const ix=i*3;
          let px=pa[ix],py=pa[ix+1],pz=pa[ix+2];
          // spring home
          wordVel[ix]+=(wordHome[ix]-px)*.022;
          wordVel[ix+1]+=(wordHome[ix+1]-py)*.022;
          wordVel[ix+2]+=(wordHome[ix+2]-pz)*.022;
          // mouse scatter
          if(hitOk){
            const dx=px-hit.x,dy=py-hit.y,d2=dx*dx+dy*dy;
            if(d2<R2&&d2>.0001){
              const f=(1-d2/R2)*.09/Math.sqrt(d2);
              wordVel[ix]+=dx*f;wordVel[ix+1]+=dy*f;wordVel[ix+2]+=(Math.random()-.5)*.02;
            }
          }
          wordVel[ix]*=.88;wordVel[ix+1]*=.88;wordVel[ix+2]*=.88;
          pa[ix]=px+wordVel[ix];pa[ix+1]=py+wordVel[ix+1];pa[ix+2]=pz+wordVel[ix+2];
        }
        word.geometry.attributes.position.needsUpdate=true;
      }

      // devices float
      phone.position.y=-1.4+Math.sin(t*.9)*.14;phone.rotation.y=-.45+Math.sin(t*.4)*.12;
      laptop.position.y=-3.1+Math.sin(t*.7+1)*.12;laptop.rotation.y=-.55+Math.sin(t*.33+2)*.1;

      // ambient motion
      shards.children.forEach(sh=>{
        sh.rotation.x+=sh.userData.rs;sh.rotation.y+=sh.userData.rs*1.4;
        sh.position.y=sh.userData.y0+Math.sin(t*sh.userData.fs+sh.userData.ph)*sh.userData.fa;
      });
      rings.children.forEach(r=>{if(r.userData.sp){r.rotation.z+=r.userData.sp*.01;r.rotation.x+=r.userData.sp*.004;}});
      ringCore.rotation.y=t*.5;ringCore.rotation.x=t*.3;
      rings.position.y=2.2+Math.sin(t*.5)*.3;
      cubes.children.forEach(c=>{c.rotation.x+=c.userData.sp*.01;c.rotation.y+=c.userData.sp*.014;});
      cubes.position.y=3.6+Math.sin(t*.6)*.4;
      tunnel.children.forEach((r,i)=>{r.rotation.z+=r.userData.sp*.01;r.scale.setScalar(1+Math.sin(t*.8+i*.5)*.04);});
      helix.rotation.y=t*.5;
      rings2.children.forEach(r=>{if(r.userData.sp)r.rotation.z+=r.userData.sp*.012;});
      rings2Core.rotation.y=-t*.7;rings2Core.rotation.z=t*.4;
      bigSphere.rotation.y=t*.03;
      if(quality>0){
        for(let i=0;i<gpos.count;i++){
          const gx=gz0[i*3],gy=gz0[i*3+1];
          gpos.array[i*3+2]=Math.sin(gx*.4+t*1.1)*.45+Math.cos(gy*.5+t*.8)*.35;
        }
        gpos.needsUpdate=true;
      }
      stars.rotation.y=t*.012+mx*.15;
      dust.rotation.y=t*.02;sparks.rotation.y=-t*.015;

      // camera journey + parallax
      journey(scroll);
      camera.position.set(camPos.x+mx*1.2,camPos.y-my*.9,camPos.z);
      camera.lookAt(camLook.x+mx*.4,camLook.y-my*.3,camLook.z);

      if(useBloom&&composer)composer.render();else renderer.render(scene,camera);
      requestAnimationFrame(animate);
    })();
  })();
