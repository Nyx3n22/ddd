import * as THREE from 'three';

export type BuildingType = 'house'|'tavern'|'smith'|'church'|'warehouse'|'hut';

export class BuildingGenerator {
  static create(type:BuildingType, pos:THREE.Vector3, scene:THREE.Scene){
    const group = new THREE.Group();
    group.position.copy(pos);
    const matWood = new THREE.MeshStandardMaterial({color:0x3a2a1a, roughness:0.9});
    const matStone = new THREE.MeshStandardMaterial({color:0x5a5a5a, roughness:0.85});
    const matThatch = new THREE.MeshStandardMaterial({color:0x4a3a2a, roughness:1});
    const matPlaster = new THREE.MeshStandardMaterial({color:0x8a7a6a, roughness:0.8});

    let width=6+Math.random()*4, depth=6+Math.random()*4, height=4+Math.random()*3;
    if(type==='tavern'){ width=12; depth=10; height=6; }
    if(type==='church'){ width=18; depth=24; height=10; }
    if(type==='warehouse'){ width=14; depth=8; height=5; }
    if(type==='hut'){ width=4; depth=4; height=3; }

    // walls
    const walls = new THREE.Mesh(new THREE.BoxGeometry(width,height,depth), type==='church'?matStone:type==='hut'?matWood:matPlaster);
    walls.position.y=height/2;
    walls.castShadow=true; walls.receiveShadow=true;
    group.add(walls);

    // roof
    const roofH = height*0.6;
    const roofGeo = new THREE.ConeGeometry(Math.max(width,depth)*0.7, roofH, 4);
    const roof = new THREE.Mesh(roofGeo, matThatch);
    roof.position.y=height+roofH/2;
    roof.rotation.y=Math.PI/4;
    roof.castShadow=true;
    group.add(roof);

    // door
    const door = new THREE.Mesh(new THREE.BoxGeometry(1,2,0.2), matWood);
    door.position.set(0,1,depth/2+0.1);
    group.add(door);

    // windows
    if(type!=='hut'){
      for(let i=0;i<2;i++){
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.8,0.2), new THREE.MeshStandardMaterial({color:0x1a1a0a, emissive:0x2a1a0a, emissiveIntensity:0.2}));
        win.position.set((i===0?-width/3:width/3), height*0.6, depth/2+0.1);
        group.add(win);
      }
    }

    // chimney
    if(Math.random()>0.3){
      const chim = new THREE.Mesh(new THREE.BoxGeometry(0.8,2,0.8), matStone);
      chim.position.set(width*0.3, height+1, 0);
      group.add(chim);
    }

    // interior light
    const light = new THREE.PointLight(0xffaa55, 0.6, 12);
    light.position.set(0, height*0.7, 0);
    group.add(light);

    scene.add(group);
    return group;
  }

  static createVillage(center:THREE.Vector3, count:number, scene:THREE.Scene){
    const groups:THREE.Group[]=[];
    for(let i=0;i<count;i++){
      const angle=Math.random()*Math.PI*2;
      const r=Math.random()*30;
      const pos=new THREE.Vector3(center.x+Math.cos(angle)*r, 0, center.z+Math.sin(angle)*r);
      pos.y=0.1;
      const types:BuildingType[]=['house','house','house','hut','tavern','smith','warehouse'];
      const type=types[Math.floor(Math.random()*types.length)];
      groups.push(this.create(type,pos,scene));
    }
    return groups;
  }
}
