import * as THREE from 'three';
import { gameState } from '../core/GameState';
import { eventBus } from '../core/EventBus';

type Chunk = { x:number, z:number, mesh:THREE.Mesh, discovered:boolean };

export class World {
  scene: THREE.Scene;
  chunks = new Map<string, Chunk>();
  chunkSize = 100;
  renderDistance = 2;
  npcs: THREE.Group[] = [];
  lights: {x:number,y:number,z:number,intensity:number}[] = [];
  private playerPos = new THREE.Vector3();

  constructor(scene:THREE.Scene){
    this.scene=scene;
    this.createBaseTerrain();
    this.createLocations();
    this.createNPCs();
  }

  private createBaseTerrain(){
    // large plane with vertex colors for biomes
    const size=1000;
    const segments=64;
    const geo=new THREE.PlaneGeometry(size,size,segments,segments);
    const colors=[];
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i), y=pos.getY(i);
      const dist=Math.hypot(x,y);
      // height based on distance and noise
      const h=Math.sin(x*0.01)*5 + Math.cos(y*0.01)*5 - dist*0.02 + (Math.random()-0.5)*2;
      pos.setZ(i,h);
      // color by biome
      let r=0.25,g=0.22,b=0.18;
      if(dist<120){ r=0.22; g=0.20; b=0.16; } // port
      else if(dist<250){ r=0.18; g=0.28; b=0.16; } // forest
      else if(dist<350){ r=0.15; g=0.18; b=0.12; } // swamp darker
      else if(dist<450){ r=0.35; g=0.32; b=0.28; } // quarry
      else { r=0.30; g=0.30; b=0.32; } // cliffs
      colors.push(r,g,b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
    geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.9, metalness:0.05});
    const mesh=new THREE.Mesh(geo,mat);
    mesh.rotation.x=-Math.PI/2;
    mesh.receiveShadow=true;
    this.scene.add(mesh);
  }

  private createLocations(){
    const locs=[
      {name:'Port Elenem', x:0,z:0,color:0x8a6d4b,size:30},
      {name:'Miasto', x:60,z:-20,color:0x5a4a3a,size:40},
      {name:'Bagna', x:-150,z:80,color:0x2a3a2a,size:60},
      {name:'Lasy', x:120,z:120,color:0x1a2a1a,size:80},
      {name:'Kamieniołom', x:-200,z:-150,color:0x4a4a4a,size:50},
      {name:'Klify', x:250,z:-100,color:0x6a6a6a,size:70},
      {name:'Ruiny Opactwa', x:0,z:250,color:0x3a332c,size:45},
      {name:'Obóz Dzikich Rycerzy', x:-100,z:-250,color:0x6b2a2a,size:55},
      {name:'Wsie', x:180,z:0,color:0x3a4a2a,size:50},
    ];
    locs.forEach(l=>{
      const group=new THREE.Group();
      group.position.set(l.x,1,l.z);
      // simple buildings
      for(let i=0;i<5;i++){
        const h=4+Math.random()*6;
        const geo=new THREE.BoxGeometry(6+Math.random()*6,h,6+Math.random()*6);
        const mat=new THREE.MeshStandardMaterial({color:l.color, roughness:0.9});
        const b=new THREE.Mesh(geo,mat);
        b.position.set((Math.random()-0.5)*l.size, h/2, (Math.random()-0.5)*l.size);
        b.castShadow=true; b.receiveShadow=true;
        group.add(b);
      }
      // marker light
      const light=new THREE.PointLight(l.color,0.5,20);
      light.position.set(0,8,0);
      group.add(light);
      this.lights.push({x:l.x,y:8,z:l.z,intensity:0.5});
      this.scene.add(group);
    });
    // water plane for port
    const waterGeo=new THREE.PlaneGeometry(300,300);
    const waterMat=new THREE.MeshStandardMaterial({color:0x1a2a3a, roughness:0.2, metalness:0.6, transparent:true, opacity:0.7});
    const water=new THREE.Mesh(waterGeo,waterMat);
    water.rotation.x=-Math.PI/2;
    water.position.set(-120,0.2,0);
    this.scene.add(water);
  }

  private createNPCs(){
    const names=['Strażnik Portu','Kupiec','Zielarka','Sołtys','Opat','Przemytnik','Karczmarz'];
    names.forEach((name,i)=>{
      const group=new THREE.Group();
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.4,1.6,4,8), new THREE.MeshStandardMaterial({color:0x5a4a3a}));
      body.position.y=1;
      group.add(body);
      const head=new THREE.Mesh(new THREE.SphereGeometry(0.35,8,8), new THREE.MeshStandardMaterial({color:0xd6c7b8}));
      head.position.y=2.1;
      group.add(head);
      group.position.set((Math.random()-0.5)*200,0,(Math.random()-0.5)*200);
      group.userData={name, id:name.toLowerCase().replace(' ','_'), interactable:true};
      this.scene.add(group);
      this.npcs.push(group);
    });
  }

  update(playerPos:THREE.Vector3){
    this.playerPos.copy(playerPos);
    // chunk streaming logic simplified: update fog based on distance, etc.
    // In full implementation would load/unload chunks
    // Here we just update LOD or cull distant NPCs
    this.npcs.forEach(npc=>{
      const d=npc.position.distanceTo(playerPos);
      npc.visible = d<150;
    });
  }

  getLocationAt(x:number,z:number){
    const dist=Math.hypot(x,z);
    if(dist<80) return 'Port Elenem - Nabrzeże';
    if(dist<150) return 'Miasto - Rynek';
    if(x<-100 && z>50) return 'Bagna - Trzęsawiska';
    if(x>80 && z>80) return 'Lasy - Gęstwina';
    if(x<-150) return 'Kamieniołom';
    if(x>200) return 'Klify';
    if(z>200) return 'Ruiny Opactwa';
    if(z<-200) return 'Obóz Dzikich Rycerzy';
    return 'Gościniec';
  }

  raycastInteract(origin:THREE.Vector3, dir:THREE.Vector3){
    const ray=new THREE.Raycaster(origin,dir,0,5);
    const hits=ray.intersectObjects(this.npcs,true);
    if(hits.length>0){
      let obj:any=hits[0].object;
      while(obj && !obj.userData?.interactable) obj=obj.parent;
      if(obj?.userData?.interactable) return obj;
    }
    return null;
  }
}
