(() => {
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const ROOM_W = 960, ROOM_H = 600;
const GRID_W = 9, GRID_H = 9;
const CENTER_X = 4, CENTER_Y = 4;
const rand = (a,b) => Math.random() * (b-a) + a;
const rint = (a,b) => Math.floor(rand(a,b+1));
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const choice = arr => arr[Math.floor(Math.random()*arr.length)];
const keyOf = (x,y) => `${x},${y}`;

let keys = Object.create(null);
let rooms = new Map();
let roomX = CENTER_X, roomY = CENTER_Y;
let gameOver = false, shopOpen = false, bestiaryOpen = false;
let message = "Welcome to the dungeon. Find the exits!";
let messageTime = 220, totalKills = 0, totalChests = 0;
let frame = 0, attackPressed = false;
let discoveredSpecies = new Set();
let killedSpecies = new Map();
let armor = 0, potions = 2;

const player = {
  x: ROOM_W/2, y: ROOM_H/2, r: 15, hp: 120, maxHp: 120,
  speed: 3.15, damage: 24, weapon: "Rusty Dagger",
  facingX: 1, facingY: 0, moving: false, attackTimer: 0,
  attackCooldown: 0, hurtTimer: 0, walkPhase: 0, idlePhase: 0
};

const weapons = [
  {name:"Iron Sword", price:45, damage:34, desc:"A reliable blade"},
  {name:"Knight's Longsword", price:100, damage:48, desc:"Long reach and sharp edge"},
  {name:"Frost Axe", price:160, damage:64, desc:"A heavy icy axe"},
  {name:"Ember Blade", price:235, damage:82, desc:"Burning ancient steel"},
  {name:"Moonfang", price:340, damage:105, desc:"A legendary weapon"},
  {name:"Stormcaller Staff", price:420, damage:125, desc:"Crackling arcane power"}
];
const shopItems = [
  ...weapons.map(w => ({...w, kind:"weapon"})),
  {name:"Small Potion", price:25, kind:"heal", amount:45, desc:"Restore 45 HP"},
  {name:"Grand Potion", price:65, kind:"heal", amount:100, desc:"Restore 100 HP"},
  {name:"Heart Crystal", price:110, kind:"heart", desc:"Increase maximum HP"},
  {name:"Leather Armor", price:75, kind:"armor", amount:1, desc:"Take less damage"},
  {name:"Royal Armor", price:190, kind:"armor", amount:2, desc:"Much better protection"},
  {name:"Swift Boots", price:95, kind:"speed", desc:"Move faster"},
  {name:"Gold Magnet", price:130, kind:"magnet", desc:"Find extra gold"},
  {name:"Revival Charm", price:180, kind:"revive", desc:"One-time emergency revive"}
];

// 50 distinct species, built from readable names + varied combat profiles.
// Their appearance is also varied by color, body shape, horns, wings and markings.
const speciesNames = [
"Bog Slime","Moss Slime","Ash Slime","Frost Slime","Venom Slime",
"Crypt Skeleton","Bone Archer","Grave Guard","Rust Knight","Skull Mage",
"Cave Bat","Vampire Bat","Nightwing","Gloom Moth","Cinder Crow",
"Forest Goblin","Cave Goblin","Orc Brute","Orc Shaman","Hill Troll",
"Stone Golem","Moss Golem","Crystal Golem","Iron Sentinel","Dust Elemental",
"Fire Wisp","Ice Wisp","Storm Sprite","Shadow Wraith","Lost Spirit",
"Spiderling","Cave Spider","Web Stalker","Poison Scuttler","Fang Beetle",
"Dire Wolf","Cursed Hound","Swamp Lurker","Marsh Stalker","Thorn Beast",
"Dark Cultist","Rune Acolyte","Witch of the Deep","Plague Doctor","Hollow Knight",
"Mini Mimic","Cursed Chestling","Living Armor","Doom Imp","Abyss Guard"
];
const palettes = ["#69c76c","#4b9d79","#a2b64e","#7b9ed6","#9b65c4","#d8d1b8","#9d9aa6","#8c6b4c","#b2a17e","#bf654b","#8d68b2","#c65e77","#4c5d83","#b5a05d","#b96b40","#76a54d","#4c8b5e","#71914b","#8fbd63","#8d795e","#858d98","#688b69","#62b4bc","#9ca6b0","#a98a62","#e8b45b","#8dd5e8","#9c9ef0","#71618c","#b5b5cf","#a1a85d","#657e45","#54784e","#8fa64b","#ad9d54","#9b8b70","#80645a","#6a8b69","#577c74","#839e51","#6c4d85","#9173a8","#74508e","#9e6b67","#4e596e","#a67a43","#9b6844","#9a9c9d","#bb674a","#554e68"];

const monsterSpecies = speciesNames.map((name,i) => {
  const tier = Math.floor(i/10);
  const bossLike = i >= 45;
  return {
    id:i, name, color:palettes[i], hp: 28 + tier*22 + (i%5)*7,
    damage: 5 + tier*3 + (i%4), speed: 0.62 + (i%5)*0.13,
    gold: 7 + tier*7 + (i%6)*3, size: 13 + (i%4)*3,
    shape: i%6, horns: i%3===0, wings: i%7===0,
    bossLike
  };
});

const bosses = [
  {name:"Gorvath, the Stone King", hp:560, damage:24, speed:0.72, color:"#8d7562", gold:220, size:43, shape:2, boss:true},
  {name:"Nyxara, Queen of Shadows", hp:680, damage:28, speed:1.05, color:"#7654a8", gold:280, size:40, shape:3, boss:true},
  {name:"The Molten Warden", hp:820, damage:34, speed:0.8, color:"#d45a36", gold:350, size:48, shape:1, boss:true},
  {name:"Elder Frostwyrm", hp:950, damage:37, speed:0.95, color:"#70b9d0", gold:420, size:50, shape:4, boss:true},
  {name:"The Hollow Emperor", hp:1250, damage:42, speed:1.0, color:"#b9a2a0", gold:600, size:54, shape:5, boss:true}
];

const roomDecor = [
  {name:"Mossy Crypt", floor:"#343b32", accent:"#65784d", decor:"moss"},
  {name:"Forgotten Library", floor:"#3b302d", accent:"#a8794e", decor:"books"},
  {name:"Crystal Cavern", floor:"#293b43", accent:"#62aebd", decor:"crystal"},
  {name:"Sunken Temple", floor:"#343b40", accent:"#a6a16a", decor:"water"},
  {name:"Fungal Grotto", floor:"#3b303e", accent:"#9c679b", decor:"fungus"},
  {name:"Ashen Hall", floor:"#40312b", accent:"#bc6540", decor:"embers"},
  {name:"Royal Catacombs", floor:"#34313b", accent:"#b49a67", decor:"bones"},
  {name:"Overgrown Garden", floor:"#2e3d31", accent:"#78a45b", decor:"vines"},
  {name:"Ancient Forge", floor:"#3d3028", accent:"#d08a43", decor:"forge"}
];

function setMessage(text, time=150) { message=text; messageTime=time; }

function createMonster(spec, x, y, isBoss=false) {
  return {
    id: spec.id ?? -1, name:spec.name, x,y, hp:spec.hp, maxHp:spec.hp,
    damage:spec.damage, speed:spec.speed, gold:spec.gold, color:spec.color,
    size:spec.size, shape:spec.shape ?? 0, horns:!!spec.horns, wings:!!spec.wings,
    boss:isBoss || !!spec.boss, alive:true, hurt:0, attack:0,
    phase:rand(0,Math.PI*2), walk:0, hitCooldown:0
  };
}

function roomAt(x,y) {
  const k=keyOf(x,y);
  if (rooms.has(k)) return rooms.get(k);
  const index=(x*7+y*11+Math.abs(x-y)*3)%roomDecor.length;
  const decor=roomDecor[(index+roomDecor.length)%roomDecor.length];
  const room={x,y,decor,monsters:[],chests:[],props:[],cleared:false,discovered:true,bossRoom:false};
  const bossIndex = (x===1&&y===1)?0:(x===7&&y===1)?1:(x===1&&y===7)?2:(x===7&&y===7)?3:(x===4&&y===0)?4:-1;
  if (bossIndex>=0 && !room.bossDefeated) {
    room.bossRoom=true;
    const b=bosses[bossIndex];
    room.monsters.push(createMonster(b,ROOM_W/2,ROOM_H/2,true));
  } else {
    const count=rint(3,6);
    for(let i=0;i<count;i++) {
      let s=choice(monsterSpecies);
      const px=rand(150,ROOM_W-150), py=rand(125,ROOM_H-125);
      room.monsters.push(createMonster(s,px,py));
    }
  }
  const chestCount=rint(1,3);
  for(let i=0;i<chestCount;i++) room.chests.push({x:rand(100,ROOM_W-100),y:rand(100,ROOM_H-100),opened:false,reward:rint(25,85)});
  for(let i=0;i<22;i++) {
    room.props.push({x:rand(45,ROOM_W-45),y:rand(45,ROOM_H-45),type:choice(["rock","pillar","rubble","torch","plant"]),size:rand(8,22),seed:rand(0,100)});
  }
  rooms.set(k,room);
  return room;
}
let room=roomAt(roomX,roomY);
room.monsters=[]; room.chests=[]; // peaceful starting chamber

function changeRoom(dx,dy) {
  roomX=clamp(roomX+dx,0,GRID_W-1);
  roomY=clamp(roomY+dy,0,GRID_H-1);
  room=roomAt(roomX,roomY);
  player.x=dx>0?34:dx<0?ROOM_W-34:clamp(player.x,55,ROOM_W-55);
  player.y=dy>0?34:dy<0?ROOM_H-34:clamp(player.y,55,ROOM_H-55);
  setMessage(room.decor.name);
}

function tryMove() {
  if(gameOver||shopOpen||bestiaryOpen) return;
  let dx=0,dy=0;
  if(keys.w||keys.arrowup)dy--;
  if(keys.s||keys.arrowdown)dy++;
  if(keys.a||keys.arrowleft)dx--;
  if(keys.d||keys.arrowright)dx++;
  player.moving=!!(dx||dy);
  if(player.moving) {
    const len=Math.hypot(dx,dy); dx/=len; dy/=len;
    player.x+=dx*player.speed; player.y+=dy*player.speed;
    player.facingX=dx; player.facingY=dy;
    player.walkPhase+=0.22;
  } else player.idlePhase+=0.045;

  const doorX=player.y>ROOM_H/2-58&&player.y<ROOM_H/2+58;
  const doorY=player.x>ROOM_W/2-62&&player.x<ROOM_W/2+62;
  if(player.x<18) { if(doorX&&roomX>0)changeRoom(-1,0); else player.x=18; }
  if(player.x>ROOM_W-18) { if(doorX&&roomX<GRID_W-1)changeRoom(1,0); else player.x=ROOM_W-18; }
  if(player.y<18) { if(doorY&&roomY>0)changeRoom(0,-1); else player.y=18; }
  if(player.y>ROOM_H-18) { if(doorY&&roomY<GRID_H-1)changeRoom(0,1); else player.y=ROOM_H-18; }
}

function doAttack() {
  if(gameOver||shopOpen||bestiaryOpen||player.attackCooldown>0)return;
  player.attackTimer=13; player.attackCooldown=23;
  let hits=0;
  for(const m of room.monsters) {
    if(!m.alive)continue;
    const dx=m.x-player.x,dy=m.y-player.y,dist=Math.hypot(dx,dy);
    const dot=(dx*player.facingX+dy*player.facingY)/(dist||1);
    if(dist<m.size+62&&dot>-0.25) {
      m.hp-=player.damage; m.hurt=10; m.hitCooldown=14; hits++;
      if(m.hp<=0) {
        m.alive=false; totalKills++; gold+=m.gold;
        killedSpecies.set(m.name,(killedSpecies.get(m.name)||0)+1);
        if(m.id>=0) discoveredSpecies.add(m.id);
        setMessage(`${m.name} defeated! +${m.gold} gold`);
      }
    }
  }
  if(!hits)setMessage("Your attack missed.",55);
}
let gold=130, hasRevive=false, magnet=false;
function updateMonsters() {
  for(const m of room.monsters) {
    if(!m.alive)continue;
    m.phase+=0.055;
    if(m.hurt>0)m.hurt--;
    if(m.attack>0)m.attack--;
    if(m.hitCooldown>0)m.hitCooldown--;
    const dx=player.x-m.x,dy=player.y-m.y,dist=Math.hypot(dx,dy);
    const aggro=dist<390;
    if(aggro&&dist>m.size+player.r+9) {
      m.x+=(dx/(dist||1))*m.speed;
      m.y+=(dy/(dist||1))*m.speed;
      m.walk+=0.16;
    } else if(dist<=m.size+player.r+9&&m.hitCooldown===0&&player.hurtTimer===0) {
      m.attack=12; m.hitCooldown=55;
      const reduction=Math.max(0,armor*2);
      const dmg=Math.max(1,m.damage-reduction);
      player.hp-=dmg; player.hurtTimer=38;
      setMessage(`${m.name} hits you for ${dmg} damage!`,70);
      if(player.hp<=0) {
        if(hasRevive) { hasRevive=false; player.hp=1; setMessage("Revival Charm saved you!",150); }
        else { player.hp=0; gameOver=true; }
      }
    }
  }
  room.cleared=room.monsters.every(m=>!m.alive);
}
function interact() {
  if(gameOver||shopOpen||bestiaryOpen)return;
  for(const c of room.chests) {
    if(!c.opened&&Math.hypot(c.x-player.x,c.y-player.y)<66) {
      c.opened=true; totalChests++;
      const reward=magnet?Math.round(c.reward*1.25):c.reward;
      gold+=reward; setMessage(`Treasure chest! +${reward} gold`); return;
    }
  }
  if(Math.hypot(ROOM_W/2-player.x,ROOM_H/2-player.y)<90&&room.bossRoom&&room.cleared) {
    setMessage("The boss chamber is conquered!");
  } else setMessage("Move closer to a chest to open it.",70);
}
function buyItem(index) {
  const item=shopItems[index]; if(!item)return;
  if(gold<item.price){setMessage("Not enough gold!");return;}
  if(item.kind==="heal"&&player.hp===player.maxHp){setMessage("Your health is already full.");return;}
  gold-=item.price;
  if(item.kind==="weapon"){player.weapon=item.name;player.damage=item.damage;}
  if(item.kind==="heal")player.hp=Math.min(player.maxHp,player.hp+item.amount);
  if(item.kind==="heart"){player.maxHp+=25;player.hp+=25;}
  if(item.kind==="armor")armor=Math.max(armor,item.amount);
  if(item.kind==="speed")player.speed=Math.min(5,player.speed+0.35);
  if(item.kind==="magnet")magnet=true;
  if(item.kind==="revive")hasRevive=true;
  setMessage(`${item.name} purchased!`);
}

function drawFloor() {
  const d=room.decor;
  ctx.fillStyle=d.floor;ctx.fillRect(0,0,W,H);
  const tile=48;
  for(let y=0;y<H;y+=tile)for(let x=0;x<W;x+=tile) {
    ctx.fillStyle=((x/tile+y/tile)%2===0)?"#ffffff08":"#00000008";
    ctx.fillRect(x,y,tile-1,tile-1);
    ctx.strokeStyle="#00000012";ctx.strokeRect(x+1,y+1,tile-3,tile-3);
  }
  // Themed floor details.
  for(let i=0;i<36;i++) {
    const x=(i*173+room.x*37)%W,y=(i*97+room.y*53)%H;
    ctx.fillStyle=d.accent+"22";
    if(d.decor==="crystal") {ctx.beginPath();ctx.moveTo(x,y-9);ctx.lineTo(x+6,y);ctx.lineTo(x,y+9);ctx.lineTo(x-6,y);ctx.closePath();ctx.fill();}
    else if(d.decor==="water") {ctx.beginPath();ctx.ellipse(x,y,12,4,0,0,Math.PI*2);ctx.fill();}
    else if(d.decor==="embers") {ctx.fillRect(x,y,3,3);}
    else {ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}
  }
  // Stone perimeter with openings.
  ctx.fillStyle="#171719";ctx.fillRect(0,0,W,17);ctx.fillRect(0,H-17,W,17);ctx.fillRect(0,0,17,H);ctx.fillRect(W-17,0,17,H);
  ctx.fillStyle="#97714a";
  if(roomX>0)ctx.fillRect(0,H/2-57,22,114);
  if(roomX<GRID_W-1)ctx.fillRect(W-22,H/2-57,22,114);
  if(roomY>0)ctx.fillRect(W/2-62,0,124,22);
  if(roomY<GRID_H-1)ctx.fillRect(W/2-62,H-22,124,22);
  ctx.fillStyle="#d5b47a";
  if(roomX>0)ctx.fillRect(4,H/2-39,5,78);
  if(roomX<GRID_W-1)ctx.fillRect(W-9,H/2-39,5,78);
  if(roomY>0)ctx.fillRect(W/2-44,4,88,5);
  if(roomY<GRID_H-1)ctx.fillRect(W/2-44,H-9,88,5);
}
function drawProps() {
  for(const p of room.props) {
    // Keep walkable centre and door lanes clear.
    if(Math.abs(p.x-W/2)<75||Math.abs(p.y-H/2)<62)continue;
    ctx.save();ctx.translate(p.x,p.y);
    if(p.type==="rock"||p.type==="rubble") {
      ctx.fillStyle="#17171755";ctx.beginPath();ctx.ellipse(2,7,p.size,p.size*.55,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=p.type==="rock"?"#68645e":"#514b49";
      ctx.beginPath();ctx.moveTo(-p.size,-3);ctx.lineTo(-p.size*.4,-p.size);ctx.lineTo(p.size*.8,-p.size*.7);ctx.lineTo(p.size,4);ctx.lineTo(0,p.size*.65);ctx.closePath();ctx.fill();
      ctx.fillStyle="#ffffff20";ctx.fillRect(-p.size*.3,-p.size*.55,5,3);
    } else if(p.type==="pillar") {
      ctx.fillStyle="#181719";ctx.fillRect(-9,-22,18,43);
      ctx.fillStyle="#918575";ctx.fillRect(-8,-23,16,39);
      ctx.fillStyle="#c5ad8a";ctx.fillRect(-11,-25,22,7);
      ctx.fillRect(-11,13,22,7);
    } else if(p.type==="torch") {
      ctx.fillStyle="#5c3923";ctx.fillRect(-3,-3,6,19);
      ctx.fillStyle="#ffad4e";ctx.beginPath();ctx.arc(0,-8,7+Math.sin(frame*.15+p.seed)*2,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#ffe69a";ctx.beginPath();ctx.arc(0,-9,3,0,Math.PI*2);ctx.fill();
    } else {
      ctx.fillStyle=p.type==="plant"?"#4d8150":"#8d5a91";
      ctx.beginPath();ctx.arc(-5,0,8,0,Math.PI*2);ctx.arc(5,-5,7,0,Math.PI*2);ctx.arc(5,5,6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#d9a4d8";ctx.fillRect(-2,-3,4,4);
    }
    ctx.restore();
  }
}
function drawChest(c) {
  ctx.save();ctx.translate(c.x,c.y);
  ctx.fillStyle="#0008";ctx.fillRect(-19,8,40,7);
  ctx.fillStyle=c.opened?"#4c3828":"#85491f";ctx.fillRect(-18,-9,36,25);
  ctx.fillStyle=c.opened?"#6d543a":"#d6a347";ctx.fillRect(-20,-12,40,9);
  ctx.fillStyle="#e9c66b";ctx.fillRect(-3,-5,6,13);
  if(!c.opened){ctx.fillStyle="#fff1a8";ctx.fillRect(-2,-3,4,4);ctx.globalAlpha=.15+Math.sin(frame*.12)*.1;ctx.fillStyle="#ffe18a";ctx.fillRect(-23,-20,46,4);}
  ctx.restore();
}
function drawMonster(m) {
  if(!m.alive)return;
  const bob=Math.sin(frame*.09+m.phase)*2.2;
  const step=Math.sin(m.walk)*2.5;
  ctx.save();ctx.translate(m.x,m.y+bob);
  // soft shadow
  ctx.fillStyle="#0007";ctx.beginPath();ctx.ellipse(0,m.size*.72,m.size*1.1,6,0,0,Math.PI*2);ctx.fill();
  const body=m.hurt>0?"#fff":m.color;
  const squash=m.attack>0?1.16:1;
  ctx.scale(1/squash,squash);
  // silhouette differences
  ctx.fillStyle=body;
  if(m.shape===0){ctx.beginPath();ctx.moveTo(-m.size,-2);ctx.quadraticCurveTo(-m.size,-m.size*1.4,0,-m.size);ctx.quadraticCurveTo(m.size,-m.size*1.4,m.size,0);ctx.lineTo(m.size,m.size*.65);ctx.quadraticCurveTo(0,m.size*1.1,-m.size,m.size*.65);ctx.fill();}
  else if(m.shape===1){ctx.fillRect(-m.size*.8,-m.size*.8,m.size*1.6,m.size*1.6);ctx.fillRect(-m.size,-m.size*.4,m.size*2,m.size*.8);}
  else if(m.shape===2){ctx.fillRect(-m.size*.65,-m.size,m.size*1.3,m.size*1.8);ctx.fillRect(-m.size,-m.size*.45,m.size*2,m.size*.35);}
  else if(m.shape===3){ctx.beginPath();ctx.ellipse(0,0,m.size*.75,m.size*1.1,0,0,Math.PI*2);ctx.fill();ctx.fillRect(-m.size*1.5,-5,m.size*3,10);}
  else if(m.shape===4){ctx.beginPath();ctx.moveTo(0,-m.size*1.3);ctx.lineTo(m.size,-m.size*.2);ctx.lineTo(m.size*.6,m.size);ctx.lineTo(-m.size*.6,m.size);ctx.lineTo(-m.size,-m.size*.2);ctx.closePath();ctx.fill();}
  else {ctx.beginPath();ctx.arc(0,0,m.size,0,Math.PI*2);ctx.fill();ctx.fillRect(-m.size*.9,0,m.size*1.8,m.size*.7);}
  // horns / ears / wings
  if(m.horns){ctx.fillStyle="#d5c5a7";ctx.beginPath();ctx.moveTo(-m.size*.55,-m.size*.55);ctx.lineTo(-m.size*.9,-m.size*1.35);ctx.lineTo(-m.size*.1,-m.size*.75);ctx.fill();ctx.beginPath();ctx.moveTo(m.size*.55,-m.size*.55);ctx.lineTo(m.size*.9,-m.size*1.35);ctx.lineTo(m.size*.1,-m.size*.75);ctx.fill();}
  if(m.wings){ctx.fillStyle=m.color;ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(-m.size*.5,0);ctx.lineTo(-m.size*1.8,-m.size*.8+Math.sin(frame*.25)*5);ctx.lineTo(-m.size*1.4,m.size*.7);ctx.fill();ctx.beginPath();ctx.moveTo(m.size*.5,0);ctx.lineTo(m.size*1.8,-m.size*.8-Math.sin(frame*.25)*5);ctx.lineTo(m.size*1.4,m.size*.7);ctx.fill();ctx.globalAlpha=1;}
  // face
  ctx.fillStyle="#17151a";
  ctx.fillRect(-m.size*.43,-m.size*.18,Math.max(3,m.size*.22),Math.max(3,m.size*.15));
  ctx.fillRect(m.size*.2,-m.size*.18,Math.max(3,m.size*.22),Math.max(3,m.size*.15));
  ctx.fillStyle="#fff0b0";ctx.fillRect(-m.size*.34,-m.size*.17,3,3);ctx.fillRect(m.size*.29,-m.size*.17,3,3);
  // feet animate
  ctx.fillStyle="#282126";ctx.fillRect(-m.size*.6,m.size*.55+step,m.size*.42,5);ctx.fillRect(m.size*.18,m.size*.55-step,m.size*.42,5);
  // boss crown detail
  if(m.boss){ctx.fillStyle="#e8c56e";ctx.fillRect(-m.size*.55,-m.size*1.15,m.size*1.1,5);ctx.fillRect(-m.size*.5,-m.size*1.35,5,8);ctx.fillRect(m.size*.4,-m.size*1.35,5,8);}
  ctx.restore();
  const barW=m.boss?112:Math.max(54,m.size*2.5), barY=m.y-m.size-34;
  ctx.textAlign="center";ctx.font=m.boss?"bold 14px Arial":"bold 11px Arial";
  ctx.fillStyle="#fff";ctx.fillText(m.name,m.x,barY-5);
  ctx.fillStyle="#171313";ctx.fillRect(m.x-barW/2,barY,barW,9);
  ctx.fillStyle=m.hp/m.maxHp>.5?"#59cf68":m.hp/m.maxHp>.25?"#e4b34b":"#db514b";
  ctx.fillRect(m.x-barW/2+1,barY+1,(barW-2)*clamp(m.hp/m.maxHp,0,1),7);
  ctx.strokeStyle="#d9d0c0";ctx.strokeRect(m.x-barW/2,barY,barW,9);
  ctx.font="10px Arial";ctx.fillStyle="#fff";ctx.fillText(`${Math.ceil(m.hp)} / ${m.maxHp} HP`,m.x,barY-15);
}
function drawPlayer() {
  const bob=player.moving?Math.abs(Math.sin(player.walkPhase))*2.5:Math.sin(player.idlePhase)*1.3;
  const leg=player.moving?Math.sin(player.walkPhase)*5:Math.sin(player.idlePhase)*1.2;
  ctx.save();ctx.translate(player.x,player.y+bob);
  if(player.hurtTimer>0&&Math.floor(player.hurtTimer/4)%2===0)ctx.globalAlpha=.45;
  ctx.fillStyle="#0008";ctx.beginPath();ctx.ellipse(0,17,17,6,0,0,Math.PI*2);ctx.fill();
  // animated legs
  ctx.fillStyle="#29344b";ctx.fillRect(-10,7+leg,8,12);ctx.fillRect(2,7-leg,8,12);
  ctx.fillStyle="#765038";ctx.fillRect(-12,17+leg,11,5);ctx.fillRect(1,17-leg,11,5);
  // tunic and belt
  ctx.fillStyle="#416b9e";ctx.fillRect(-13,-8,26,22);
  ctx.fillStyle="#8ca9c9";ctx.fillRect(-12,-7,24,4);
  ctx.fillStyle="#d0a653";ctx.fillRect(-13,7,26,4);ctx.fillRect(-3,6,6,6);
  // arms animate
  const armSwing=player.moving?Math.sin(player.walkPhase)*4:Math.sin(player.idlePhase)*1.5;
  ctx.fillStyle="#d6b18a";ctx.fillRect(-17,-5+armSwing,5,14);ctx.fillRect(12,-5-armSwing,5,14);
  // helmet
  ctx.fillStyle="#aeb9c7";ctx.fillRect(-12,-23,24,17);
  ctx.fillStyle="#dce3e9";ctx.fillRect(-10,-26,20,7);
  ctx.fillStyle="#4d596a";ctx.fillRect(-8,-17,16,5);
  ctx.fillStyle="#1c2634";ctx.fillRect(player.facingX>=0?2:-8,-16,6,3);
  // weapon swing
  if(player.attackTimer>0) {
    const t=player.attackTimer/13;
    ctx.save();ctx.rotate((1-t)*player.facingX*.9);
    ctx.fillStyle="#d7e3eb";ctx.fillRect(14,-27,5,31);
    ctx.fillStyle="#f7e6b1";ctx.fillRect(12,-30,9,7);
    ctx.fillStyle="#8b5b32";ctx.fillRect(11,-3,11,5);
    ctx.restore();
    ctx.strokeStyle="#fff2b0";ctx.globalAlpha=.45;ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(0,0,44,-.9,1.0);ctx.stroke();
  }
  ctx.restore();
}
function drawHUD() {
  ctx.fillStyle="#100f12dd";ctx.fillRect(14,14,260,100);
  ctx.strokeStyle="#a58a60";ctx.strokeRect(14,14,260,100);
  ctx.textAlign="left";ctx.fillStyle="#f1d39a";ctx.font="bold 16px Georgia";ctx.fillText("DUNGEON HERO",27,36);
  ctx.fillStyle="#342a2a";ctx.fillRect(27,46,205,17);
  ctx.fillStyle="#d94d50";ctx.fillRect(28,47,203*player.hp/player.maxHp,15);
  ctx.fillStyle="#fff";ctx.font="11px Arial";ctx.fillText(`HP ${player.hp}/${player.maxHp}`,34,59);
  ctx.fillStyle="#f2c85e";ctx.font="bold 15px Arial";ctx.fillText(`✦ ${gold} gold`,27,86);
  ctx.fillStyle="#d7d9e4";ctx.font="12px Arial";ctx.fillText(`${player.weapon} · DMG ${player.damage}`,120,86);
  ctx.fillStyle="#c5c1b6";ctx.fillText(`Armor ${armor} · Potions ${potions}`,27,103);

  ctx.fillStyle="#100f12dd";ctx.fillRect(W-158,14,144,116);ctx.strokeStyle="#a58a60";ctx.strokeRect(W-158,14,144,116);
  ctx.fillStyle="#f1d39a";ctx.font="bold 12px Arial";ctx.fillText("DUNGEON MAP",W-147,32);
  for(let y=0;y<GRID_H;y++)for(let x=0;x<GRID_W;x++){
    const r=rooms.get(keyOf(x,y));ctx.fillStyle=(x===roomX&&y===roomY)?"#edc36d":r?"#718b68":"#34323a";
    ctx.fillRect(W-148+x*14,40+y*9,10,6);
  }
  ctx.fillStyle="#c5c1b6";ctx.font="10px Arial";ctx.fillText(`Kills ${totalKills} · Chests ${totalChests}`,W-147,123);
  ctx.fillStyle="#fff";ctx.font="bold 13px Arial";ctx.textAlign="center";ctx.fillText(room.decor.name,W/2,27);
  if(room.bossRoom) {ctx.fillStyle="#ffbd67";ctx.font="bold 12px Arial";ctx.fillText("BOSS CHAMBER",W/2,45);}
}
function drawMessage() {
  if(messageTime<=0)return;
  ctx.fillStyle="#100e12dd";ctx.fillRect(W/2-250,H-47,500,32);
  ctx.strokeStyle="#9b7950";ctx.strokeRect(W/2-250,H-47,500,32);
  ctx.fillStyle="#f1d39a";ctx.font="bold 14px Arial";ctx.textAlign="center";ctx.fillText(message,W/2,H-26);
  messageTime--;
}
function drawShop() {
  ctx.fillStyle="#09080deF";ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#f0c779";ctx.font="bold 31px Georgia";ctx.textAlign="center";ctx.fillText("THE TRAVELLING MERCHANT",W/2,48);
  ctx.fillStyle="#fff";ctx.font="15px Arial";ctx.fillText(`Your gold: ${gold}  ·  Buy: 1–9, 0, Q, W, R`,W/2,75);
  const cols=2, rows=Math.ceil(shopItems.length/cols), cardW=405, cardH=49, gap=12;
  shopItems.forEach((it,i)=>{
    const col=i%cols,row=Math.floor(i/cols);
    const x=65+col*(cardW+20),y=96+row*(cardH+gap);
    ctx.fillStyle="#29242a";ctx.fillRect(x,y,cardW,cardH);
    ctx.strokeStyle="#846541";ctx.strokeRect(x,y,cardW,cardH);
    ctx.textAlign="left";ctx.fillStyle="#f0d7a4";ctx.font="bold 14px Arial";ctx.fillText(`${i+1}. ${it.name}`,x+10,y+18);
    ctx.fillStyle="#bcb3b6";ctx.font="11px Arial";ctx.fillText(it.desc||"",x+10,y+36);
    ctx.textAlign="right";ctx.fillStyle="#f2c85e";ctx.font="bold 13px Arial";ctx.fillText(`${it.price}g`,x+cardW-10,y+29);
  });
  ctx.textAlign="center";ctx.fillStyle="#c9c0c5";ctx.font="13px Arial";ctx.fillText("Press B or ESC to close",W/2,H-17);
}
function drawBestiary() {
  ctx.fillStyle="#09080df2";ctx.fillRect(0,0,W,H);
  ctx.textAlign="center";ctx.fillStyle="#f0c779";ctx.font="bold 32px Georgia";ctx.fillText("BESTIARY",W/2,43);
  ctx.fillStyle="#d5cbd0";ctx.font="13px Arial";ctx.fillText(`Monsters defeated: ${totalKills} · Unique species slain: ${killedSpecies.size}`,W/2,68);
  const entries=[...killedSpecies.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  if(!entries.length){
    ctx.fillStyle="#c5bdc4";ctx.font="18px Arial";ctx.fillText("No creatures defeated yet. Your discoveries will appear here!",W/2,300);
  } else {
    const start=Math.max(0,entries.length-24);
    const shown=entries.slice(start);
    shown.forEach(([name,count],i)=>{
      const col=i%3,row=Math.floor(i/3),x=55+col*285,y=95+row*47;
      ctx.fillStyle="#29242a";ctx.fillRect(x,y,265,38);ctx.strokeStyle="#776047";ctx.strokeRect(x,y,265,38);
      ctx.textAlign="left";ctx.fillStyle="#f0d7a4";ctx.font="bold 13px Arial";ctx.fillText(name,x+9,y+16);
      ctx.fillStyle="#bdb4bd";ctx.font="11px Arial";ctx.fillText(`Defeated: ${count} · Base HP: ${getSpeciesHP(name)}`,x+9,y+30);
    });
    if(entries.length>24){ctx.textAlign="center";ctx.fillStyle="#aaa";ctx.fillText(`Showing latest 24 of ${entries.length} species`,W/2,H-18);}
  }
  ctx.textAlign="center";ctx.fillStyle="#c9c0c5";ctx.font="13px Arial";ctx.fillText("Press J or ESC to close",W/2,H-38);
}
function getSpeciesHP(name) {
  const s=monsterSpecies.find(m=>m.name===name);
  const b=bosses.find(m=>m.name===name);
  return (s||b)?.hp ?? "?";
}
function drawGameOver() {
  ctx.fillStyle="#08070ceF";ctx.fillRect(0,0,W,H);
  ctx.textAlign="center";ctx.fillStyle="#d96a59";ctx.font="bold 54px Georgia";ctx.fillText("YOU HAVE FALLEN",W/2,245);
  ctx.fillStyle="#eee";ctx.font="20px Arial";ctx.fillText(`Monsters defeated: ${totalKills} · Gold collected: ${gold}`,W/2,294);
  ctx.fillStyle="#f0c779";ctx.fillText("Press R to begin a new adventure",W/2,345);
}
function update() {
  frame++;
  if(!gameOver&&!shopOpen&&!bestiaryOpen) {
    tryMove();updateMonsters();
    if(player.attackTimer>0)player.attackTimer--;
    if(player.attackCooldown>0)player.attackCooldown--;
    if(player.hurtTimer>0)player.hurtTimer--;
  }
}
function render() {
  drawFloor();drawProps();
  for(const c of room.chests)drawChest(c);
  for(const m of room.monsters)drawMonster(m);
  drawPlayer();drawHUD();drawMessage();
  if(shopOpen)drawShop();
  if(bestiaryOpen)drawBestiary();
  if(gameOver)drawGameOver();
}
function loop(){update();render();requestAnimationFrame(loop);}

document.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(k))e.preventDefault();
  if(gameOver){if(k==="r")location.reload();return;}
  if(shopOpen){
    if(k==="escape"||k==="b"){shopOpen=false;return;}
    if(k>="1"&&k<="9")buyItem(Number(k)-1);
    if(k==="0")buyItem(9);
    if(k==="q")buyItem(10);
    if(k==="w")buyItem(11);
    if(k==="r")buyItem(12);
    return;
  }
  if(bestiaryOpen){if(k==="escape"||k==="j")bestiaryOpen=false;return;}
  if(k==="b"){shopOpen=true;return;}
  if(k==="j"){bestiaryOpen=true;return;}
  if(k===" "){doAttack();return;}
  if(k==="e"){interact();return;}
  keys[k]=true;
});
document.addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;});
loop();
})();