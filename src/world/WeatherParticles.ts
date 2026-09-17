import * as THREE from 'three';

export class WeatherParticles {
  private scene:THREE.Scene;
  private rain:THREE.Points | null = null;
  private fogMesh:THREE.Mesh | null = null;
  private snow:THREE.Points | null = null;

  constructor(scene:THREE.Scene){
    this.scene=scene;
    this.createRain();
    this.createFog();
    this.createSnow();
  }

  private createRain(){
    const count=2000;
    const geo=new THREE.BufferGeometry();
    const pos=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      pos[i*3]=(Math.random()-0.5)*200;
      pos[i*3+1]=Math.random()*100+10;
      pos[i*3+2]=(Math.random()-0.5)*200;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const mat=new THREE.PointsMaterial({color:0x8a8aaa, size:0.2, transparent:true, opacity:0.6});
    const points=new THREE.Points(geo,mat);
    points.visible=false;
    this.scene.add(points);
    this.rain=points;
  }

  private createFog(){
    const geo=new THREE.PlaneGeometry(1000,1000);
    const mat=new THREE.MeshStandardMaterial({color:0x5a5a5a, transparent:true, opacity:0.15, depthWrite:false});
    const mesh=new THREE.Mesh(geo,mat);
    mesh.rotation.x=-Math.PI/2;
    mesh.position.y=8;
    mesh.visible=false;
    this.scene.add(mesh);
    this.fogMesh=mesh;
  }

  private createSnow(){
    const count=1500;
    const geo=new THREE.BufferGeometry();
    const pos=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      pos[i*3]=(Math.random()-0.5)*200;
      pos[i*3+1]=Math.random()*80+5;
      pos[i*3+2]=(Math.random()-0.5)*200;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const mat=new THREE.PointsMaterial({color:0xffffff, size:0.3, transparent:true, opacity:0.7});
    const points=new THREE.Points(geo,mat);
    points.visible=false;
    this.scene.add(points);
    this.snow=points;
  }

  setWeather(type:string, playerPos:THREE.Vector3){
    if(this.rain) this.rain.visible = type==='rain' || type==='storm';
    if(this.fogMesh) this.fogMesh.visible = type==='fog';
    if(this.snow) this.snow.visible = type==='snow';
    if(this.rain && this.rain.visible){
      this.rain.position.set(playerPos.x,0,playerPos.z);
      const positions=this.rain.geometry.attributes.position as THREE.BufferAttribute;
      for(let i=0;i<positions.count;i++){
        let y=positions.getY(i);
        y-=0.5 + Math.random()*0.5;
        if(y<0) y=50+Math.random()*50;
        positions.setY(i,y);
      }
      positions.needsUpdate=true;
    }
    if(this.snow && this.snow.visible){
      this.snow.position.set(playerPos.x,0,playerPos.z);
      const positions=this.snow.geometry.attributes.position as THREE.BufferAttribute;
      for(let i=0;i<positions.count;i++){
        let y=positions.getY(i);
        y-=0.1 + Math.random()*0.2;
        if(y<0) y=40+Math.random()*40;
        positions.setY(i,y);
        positions.setX(i, positions.getX(i)+(Math.random()-0.5)*0.05);
      }
      positions.needsUpdate=true;
    }
  }
}
