import * as THREE from 'three';

export class VegetationSystem {
  private scene:THREE.Scene;
  private trees:THREE.InstancedMesh | null = null;
  private grass:THREE.InstancedMesh | null = null;

  constructor(scene:THREE.Scene){
    this.scene=scene;
    this.createTrees();
    this.createGrass();
    this.createRocks();
  }

  private createTrees(){
    const count=400;
    const geo=new THREE.ConeGeometry(1,5,6);
    const mat=new THREE.MeshStandardMaterial({color:0x1a2a1a, roughness:0.9});
    const mesh=new THREE.InstancedMesh(geo,mat,count);
    mesh.castShadow=true; mesh.receiveShadow=true;
    const dummy=new THREE.Object3D();
    for(let i=0;i<count;i++){
      const x=(Math.random()-0.5)*800;
      const z=(Math.random()-0.5)*800;
      const dist=Math.hypot(x,z);
      if(dist<80) continue; // no trees in port
      dummy.position.set(x,2.5,z);
      dummy.scale.setScalar(0.8+Math.random()*0.6);
      dummy.rotation.y=Math.random()*Math.PI*2;
      dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    this.scene.add(mesh);
    this.trees=mesh;
  }

  private createGrass(){
    const count=2000;
    const geo=new THREE.PlaneGeometry(0.2,0.8);
    const mat=new THREE.MeshStandardMaterial({color:0x2a3a1a, side:THREE.DoubleSide, alphaTest:0.5});
    const mesh=new THREE.InstancedMesh(geo,mat,count);
    const dummy=new THREE.Object3D();
    for(let i=0;i<count;i++){
      const x=(Math.random()-0.5)*300;
      const z=(Math.random()-0.5)*300;
      dummy.position.set(x,0.4,z);
      dummy.rotation.y=Math.random()*Math.PI*2;
      dummy.rotation.x=Math.random()*0.3;
      dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    this.scene.add(mesh);
    this.grass=mesh;
  }

  private createRocks(){
    const count=150;
    const geo=new THREE.DodecahedronGeometry(0.5,0);
    const mat=new THREE.MeshStandardMaterial({color:0x4a4a4a, roughness:0.9});
    for(let i=0;i<count;i++){
      const mesh=new THREE.Mesh(geo,mat);
      mesh.position.set((Math.random()-0.5)*500,0.2,(Math.random()-0.5)*500);
      mesh.scale.setScalar(0.5+Math.random()*1.5);
      mesh.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
      mesh.castShadow=true; mesh.receiveShadow=true;
      this.scene.add(mesh);
    }
  }
}
