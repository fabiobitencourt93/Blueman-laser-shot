import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';

type Rect = { x:number; y:number; w:number; h:number };
type Enemy = Rect & { vx:number; hp:number; maxHp:number; kind:'walker'|'flyer' };
type Shot = Rect & { vx:number; owner:'player'|'enemy'; life:number };
type Level = { name:string; sky:string; floor:number; platforms:Rect[]; enemies:Enemy[]; goalX:number };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;

  readonly W = 1100;
  readonly H = 620;

  levelIndex = 0;
  lives = 3;
  health = 100;
  score = 0;
  running = false;
  won = false;
  paused = false;
  message = 'Clique em INICIAR';
  controls = { left:false, right:false, jump:false, shoot:false };

  player: Rect & { vx:number; vy:number; onGround:boolean; inv:number; facing:number } =
    {x:90,y:420,w:38,h:56,vx:0,vy:0,onGround:false,inv:0,facing:1};

  shots: Shot[] = [];
  enemies: Enemy[] = [];
  level!: Level;
  cameraX = 0;

  private readonly levels: Level[] = [
    {
      name:'Fábrica Abandonada', sky:'#081426', floor:548, goalX:3150,
      platforms:[
        {x:0,y:548,w:3400,h:72},{x:430,y:455,w:180,h:24},{x:730,y:390,w:190,h:24},
        {x:1050,y:470,w:180,h:24},{x:1390,y:410,w:190,h:24},{x:1710,y:335,w:210,h:24},
        {x:2050,y:455,w:210,h:24},{x:2390,y:385,w:180,h:24},{x:2700,y:320,w:230,h:24}
      ],
      enemies:[
        {x:520,y:410,w:40,h:45,vx:-45,hp:3,maxHp:3,kind:'walker'},
        {x:820,y:345,w:40,h:45,vx:45,hp:3,maxHp:3,kind:'walker'},
        {x:1130,y:425,w:40,h:45,vx:-55,hp:4,maxHp:4,kind:'walker'},
        {x:1450,y:365,w:40,h:45,vx:50,hp:4,maxHp:4,kind:'walker'},
        {x:1780,y:285,w:44,h:40,vx:-60,hp:5,maxHp:5,kind:'flyer'},
        {x:2160,y:410,w:40,h:45,vx:55,hp:4,maxHp:4,kind:'walker'},
        {x:2450,y:340,w:44,h:40,vx:-70,hp:5,maxHp:5,kind:'flyer'},
        {x:2780,y:275,w:40,h:45,vx:55,hp:6,maxHp:6,kind:'walker'}
      ]
    },
    {
      name:'Fortaleza Neon', sky:'#160b2d', floor:548, goalX:3450,
      platforms:[
        {x:0,y:548,w:3700,h:72},{x:360,y:450,w:170,h:24},{x:650,y:350,w:150,h:24},
        {x:920,y:445,w:160,h:24},{x:1210,y:300,w:170,h:24},{x:1500,y:420,w:170,h:24},
        {x:1800,y:330,w:180,h:24},{x:2110,y:455,w:180,h:24},{x:2400,y:350,w:170,h:24},
        {x:2700,y:285,w:190,h:24},{x:3050,y:410,w:220,h:24}
      ],
      enemies:[
        {x:430,y:405,w:40,h:45,vx:60,hp:4,maxHp:4,kind:'walker'},
        {x:700,y:305,w:44,h:40,vx:-70,hp:5,maxHp:5,kind:'flyer'},
        {x:970,y:400,w:40,h:45,vx:-65,hp:4,maxHp:4,kind:'walker'},
        {x:1270,y:255,w:44,h:40,vx:65,hp:6,maxHp:6,kind:'flyer'},
        {x:1550,y:375,w:40,h:45,vx:75,hp:5,maxHp:5,kind:'walker'},
        {x:1860,y:285,w:44,h:40,vx:-75,hp:7,maxHp:7,kind:'flyer'},
        {x:2160,y:410,w:40,h:45,vx:-75,hp:5,maxHp:5,kind:'walker'},
        {x:2450,y:305,w:44,h:40,vx:80,hp:7,maxHp:7,kind:'flyer'},
        {x:2750,y:240,w:40,h:45,vx:-80,hp:7,maxHp:7,kind:'walker'},
        {x:3130,y:355,w:48,h:52,vx:-90,hp:12,maxHp:12,kind:'walker'}
      ]
    }
  ];

  ngAfterViewInit(): void {
    this.ctx = this.canvas.nativeElement.getContext('2d')!;
    this.resetLevel();
    this.resizeCanvas();
    this.raf = requestAnimationFrame(this.loop);
  }

  ngOnDestroy(): void { cancelAnimationFrame(this.raf); }

  start(): void {
    this.running = true; this.paused = false; this.won = false; this.message = '';
    this.resetLevel();
  }

  restart(): void {
    this.lives = 3; this.health = 100; this.score = 0; this.levelIndex = 0; this.won = false;
    this.start();
  }

  nextLevel(): void {
    if (this.levelIndex < this.levels.length - 1) {
      this.levelIndex++; this.health = 100; this.message = `Fase ${this.levelIndex + 1}: ${this.levels[this.levelIndex].name}`;
      this.resetLevel(); setTimeout(() => this.message = '', 1300);
    } else {
      this.won = true; this.running = false; this.message = 'MISSÃO CONCLUÍDA!';
    }
  }

  togglePause(): void { if (this.running) this.paused = !this.paused; }

  private resetLevel(): void {
    this.level = structuredClone(this.levels[this.levelIndex]);
    this.enemies = this.level.enemies;
    this.shots = [];
    this.player = {x:90,y:430,w:38,h:56,vx:0,vy:0,onGround:false,inv:0,facing:1};
    this.cameraX = 0;
  }

  private loop = (time:number) => {
    const dt = Math.min((time - this.last) / 1000 || 0, 0.033);
    this.last = time;
    if (this.running && !this.paused && !this.won) this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt:number): void {
    const p = this.player;
    const speed = 250, gravity = 1550, jump = 590;
    p.vx = this.controls.left ? -speed : this.controls.right ? speed : 0;
    if (p.vx !== 0) p.facing = Math.sign(p.vx);
    if (this.controls.jump && p.onGround) { p.vy = -jump; p.onGround = false; }
    p.vy += gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.onGround = false;

    for (const platform of this.level.platforms) {
      if (this.collides(p, platform) && p.vy >= 0 && p.y + p.h - p.vy * dt <= platform.y + 4) {
        p.y = platform.y - p.h; p.vy = 0; p.onGround = true;
      }
    }
    if (p.x < 0) p.x = 0;

    if (this.controls.shoot && this.shots.filter(s => s.owner === 'player').length < 4) {
      this.fire();
      this.controls.shoot = false;
    }

    for (const s of this.shots) {
      s.x += s.vx * dt; s.life -= dt;
      for (const e of this.enemies) {
        if (s.owner === 'player' && e.hp > 0 && this.collides(s,e)) {
          e.hp--; s.life = 0; this.score += 10;
        }
      }
    }
    this.shots = this.shots.filter(s => s.life > 0 && s.x > this.cameraX - 100 && s.x < this.cameraX + this.W + 100);

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.x += e.vx * dt;
      const home = this.level.platforms.find(pl => e.x + e.w/2 >= pl.x && e.x + e.w/2 <= pl.x+pl.w && Math.abs((e.y+e.h)-pl.y)<8);
      if (home && (e.x < home.x || e.x + e.w > home.x + home.w)) e.vx *= -1;
      if (e.kind === 'flyer') e.y += Math.sin(performance.now()/250 + e.x/100) * 0.35;
      if (this.collides(p,e)) this.damage(15);
    }

    if (p.inv > 0) p.inv -= dt;
    if (p.x >= this.level.goalX) this.nextLevel();
    if (p.y > this.H + 150) this.damage(100);

    this.cameraX = Math.max(0, Math.min(this.level.goalX - this.W + 160, p.x - 300));
  }

  private fire(): void {
    const p = this.player;
    this.shots.push({x:p.x + (p.facing > 0 ? p.w : -18), y:p.y+20,w:18,h:7,vx:p.facing*620,owner:'player',life:1.5});
  }

  private damage(amount:number): void {
    if (this.player.inv > 0) return;
    this.health -= amount; this.player.inv = 1;
    if (this.health <= 0) {
      this.lives--;
      if (this.lives <= 0) {
        this.running = false; this.message = 'GAME OVER — pressione REINICIAR';
      } else {
        this.health = 100; this.player.x = Math.max(80, this.cameraX + 80); this.player.y = 420; this.player.vy = 0;
      }
    }
  }

  private collides(a:Rect,b:Rect):boolean {
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  @HostListener('window:keydown', ['$event'])
  keydown(e:KeyboardEvent): void {
    const k=e.key.toLowerCase();
    if (['arrowleft','arrowright','arrowup',' ','z','x','p'].includes(k)) e.preventDefault();
    if (k==='arrowleft'||k==='a') this.controls.left=true;
    if (k==='arrowright'||k==='d') this.controls.right=true;
    if (k==='arrowup'||k==='w'||k===' ') this.controls.jump=true;
    if (k==='z'||k==='x'||k==='j') this.controls.shoot=true;
    if (k==='p') this.togglePause();
  }

  @HostListener('window:keyup', ['$event'])
  keyup(e:KeyboardEvent): void {
    const k=e.key.toLowerCase();
    if (k==='arrowleft'||k==='a') this.controls.left=false;
    if (k==='arrowright'||k==='d') this.controls.right=false;
    if (k==='arrowup'||k==='w'||k===' ') this.controls.jump=false;
  }

  private draw(): void {
    const c=this.ctx;
    c.clearRect(0,0,this.W,this.H);
    c.fillStyle=this.level?.sky ?? '#081426'; c.fillRect(0,0,this.W,this.H);
    this.drawBackground(c);
    c.save(); c.translate(-this.cameraX,0);
    for (const pl of this.level.platforms) this.drawPlatform(c,pl);
    for (const e of this.enemies) if(e.hp>0) this.drawEnemy(c,e);
    for (const s of this.shots) this.drawShot(c,s);
    this.drawPlayer(c);
    this.drawGoal(c);
    c.restore();
  }

  private drawBackground(c:CanvasRenderingContext2D):void {
    c.fillStyle='rgba(50,90,160,.12)';
    for(let x=-((this.cameraX*.2)%320);x<this.W;x+=320){ c.fillRect(x,150,170,260); c.fillRect(x+210,250,80,160); }
    c.strokeStyle='rgba(90,170,255,.12)'; c.lineWidth=2;
    for(let y=90;y<520;y+=55){ c.beginPath(); c.moveTo(0,y); c.lineTo(this.W,y); c.stroke(); }
    c.fillStyle='#070a12'; c.fillRect(0,0,this.W,42);
  }

  private drawPlatform(c:CanvasRenderingContext2D,p:Rect):void {
    c.fillStyle='#18283b'; c.fillRect(p.x,p.y,p.w,p.h);
    c.fillStyle='#4fd7ff'; c.fillRect(p.x,p.y,p.w,5);
    c.fillStyle='rgba(255,255,255,.08)';
    for(let x=p.x+12;x<p.x+p.w;x+=35)c.fillRect(x,p.y+12,20,4);
  }

  private drawPlayer(c:CanvasRenderingContext2D):void {
    const p=this.player;
    if(p.inv>0 && Math.floor(performance.now()/80)%2===0)return;
    c.fillStyle='#30d5ff'; c.fillRect(p.x+7,p.y+13,24,39);
    c.fillStyle='#eaf8ff'; c.fillRect(p.x+10,p.y+18,18,12);
    c.fillStyle='#2364ff'; c.fillRect(p.x+4,p.y,30,18);
    c.fillStyle='#0a1934'; c.fillRect(p.x+(p.facing>0?27:7),p.y+21,4,5);
    c.fillStyle='#2364ff'; c.fillRect(p.x,p.y+36,8,18); c.fillRect(p.x+30,p.y+36,8,18);
  }

  private drawEnemy(c:CanvasRenderingContext2D,e:Enemy):void {
    c.fillStyle=e.kind==='flyer'?'#ff4d8d':'#ff703d'; c.fillRect(e.x,e.y,e.w,e.h);
    c.fillStyle='#2a0c19'; c.fillRect(e.x+8,e.y+9,e.w-16,12);
    c.fillStyle='#fff'; c.fillRect(e.x+12,e.y+12,6,5); c.fillRect(e.x+e.w-18,e.y+12,6,5);
    c.fillStyle='#0b1020'; c.fillRect(e.x+5,e.y+e.h-8,e.w-10,6);
    c.fillStyle='#101622'; c.fillRect(e.x,e.y-8,e.w,4);
    c.fillStyle='#70ff9a'; c.fillRect(e.x,e.y-8,e.w*(e.hp/e.maxHp),4);
  }

  private drawShot(c:CanvasRenderingContext2D,s:Shot):void {
    c.fillStyle='#fff36b'; c.fillRect(s.x,s.y,s.w,s.h);
    c.fillStyle='#52f6ff'; c.fillRect(s.x,s.y+1,6,s.h-2);
  }

  private drawGoal(c:CanvasRenderingContext2D):void {
    const x=this.level.goalX;
    c.fillStyle='#d8f7ff'; c.fillRect(x,380,8,168);
    c.fillStyle='#8a5cff'; c.beginPath(); c.moveTo(x+8,385); c.lineTo(x+95,410); c.lineTo(x+8,435); c.closePath(); c.fill();
    c.fillStyle='#fff'; c.font='bold 16px system-ui'; c.fillText('FIM',x+25,405);
  }

  private resizeCanvas():void {
    const canvas=this.canvas.nativeElement;
    const dpr=window.devicePixelRatio||1;
    canvas.width=this.W*dpr; canvas.height=this.H*dpr;
    canvas.style.aspectRatio=`${this.W}/${this.H}`;
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
  }
}