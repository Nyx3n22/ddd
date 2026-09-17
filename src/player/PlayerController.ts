import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { gameState } from '../core/GameState';
import { eventBus } from '../core/EventBus';

export class PlayerController {
  camera: THREE.PerspectiveCamera;
  tppCamera: THREE.Group;
  input: InputManager;
  velocity = new THREE.Vector3();
  position = new THREE.Vector3(0,2,10);
  yaw = 0;
  pitch = 0;
  isCrouching = false;
  isSprinting = false;
  isGrounded = true;
  fpp = true;
  private height = 1.7;
  private crouchHeight = 1.0;
  private pointerLocked = false;

  constructor(camera:THREE.PerspectiveCamera, input:InputManager){
    this.camera=camera;
    this.input=input;
    this.tppCamera=new THREE.Group();
    // pointer lock
    document.addEventListener('click', ()=>{
      const overlayOpen = document.querySelector('.overlay.open');
      if(!overlayOpen && !this.pointerLocked){
        (document.getElementById('game-canvas') as HTMLCanvasElement).requestPointerLock();
      }
    });
    document.addEventListener('pointerlockchange', ()=>{
      this.pointerLocked = document.pointerLockElement === document.getElementById('game-canvas');
    });
    document.addEventListener('mousemove', e=>{
      if(!this.pointerLocked) return;
      const sens=0.002;
      this.yaw -= e.movementX*sens;
      this.pitch -= e.movementY*sens;
      this.pitch=Math.max(-Math.PI/2+0.1, Math.min(Math.PI/2-0.1, this.pitch));
    });
    eventBus.on('teleport', ({x,y,z})=>{ this.position.set(x,y,z); });
  }

  update(dt:number){
    const speedBase = 3.5;
    const crouchSpeed = 1.5;
    const sprintSpeed = 6.0;

    this.isCrouching = this.input.isDown('crouch');
    this.isSprinting = this.input.isDown('sprint') && !this.isCrouching && gameState.needs.fatigue<90 && gameState.player.getSkill('endurance')>-1;

    let speed = this.isCrouching? crouchSpeed : this.isSprinting? sprintSpeed : speedBase;
    // injury penalty
    speed *= 1 - gameState.injury.getMovementPenalty();
    // needs penalty
    speed *= 1 - gameState.needs.getModifiers().staminaPenalty;

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    forward.set(Math.sin(this.yaw),0,Math.cos(this.yaw)).normalize();
    right.set(Math.sin(this.yaw+Math.PI/2),0,Math.cos(this.yaw+Math.PI/2)).normalize();

    const move = new THREE.Vector3();
    if(this.input.isDown('forward')) move.addScaledVector(forward, -1);
    if(this.input.isDown('back')) move.addScaledVector(forward, 1);
    if(this.input.isDown('left')) move.addScaledVector(right, -1);
    if(this.input.isDown('right')) move.addScaledVector(right, 1);
    if(move.length()>0){
      move.normalize().multiplyScalar(speed*dt);
      this.position.add(move);
      gameState.needs.tick(dt, this.isSprinting, false);
      gameState.player.useSkill('stealth_move', this.isCrouching?2:1);
      if(this.isSprinting) gameState.player.useSkill('endurance',1);
    } else {
      gameState.needs.tick(dt,false,false);
    }

    // jump
    if(this.input.isDown('jump') && this.isGrounded){
      this.velocity.y=5;
      this.isGrounded=false;
    }
    // gravity
    this.velocity.y -= 9.8*dt;
    this.position.y += this.velocity.y*dt;
    if(this.position.y<=2){ this.position.y=2; this.velocity.y=0; this.isGrounded=true; }

    // perspective toggle
    if(this.input.justPressed('perspective')){
      this.fpp=!this.fpp;
      gameState.fpp=this.fpp;
      eventBus.emit('perspectiveChanged', this.fpp);
    }

    // update camera
    const camHeight = this.isCrouching? this.crouchHeight : this.height;
    if(this.fpp){
      this.camera.position.copy(this.position).add(new THREE.Vector3(0,camHeight-0.2,0));
      this.camera.rotation.order='YXZ';
      this.camera.rotation.y=this.yaw;
      this.camera.rotation.x=this.pitch;
    } else {
      // third person behind
      const dist=4;
      const behind = new THREE.Vector3(Math.sin(this.yaw)*dist, -1.5, Math.cos(this.yaw)*dist);
      this.camera.position.copy(this.position).add(new THREE.Vector3(0,camHeight,0)).add(behind);
      this.camera.lookAt(this.position.clone().add(new THREE.Vector3(0,1,0)));
    }

    // stamina
    if(this.isSprinting) gameState.needs.fatigue=Math.min(100, gameState.needs.fatigue+dt*8);
    else gameState.needs.fatigue=Math.max(0, gameState.needs.fatigue-dt*2);

    // sync gameState player pos
    gameState.player.position={x:this.position.x,y:this.position.y,z:this.position.z};
    gameState.player.rotation={x:this.pitch,y:this.yaw};
  }

  getLookDir(){
    const dir=new THREE.Vector3(0,0,-1);
    dir.applyEuler(new THREE.Euler(this.pitch,this.yaw,0,'YXZ'));
    return dir;
  }
}
