// Genera icone PNG (192 e 512) senza dipendenze esterne.
// Disegna lo "Zaino in Spalla": blu notte, sole, zaino corallo, sentiero.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
  }
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function makeIcon(size, file) {
  // "Zaino in Spalla": fondo blu notte sfumato, sole, zaino corallo, sentiero puntinato
  const duskA=[46,62,107], duskB=[22,32,58];
  const sunset=[255,107,74], sunsetD=[225,78,46], sole=[255,193,69], sand=[246,238,223];
  const strap=[16,22,42], white=[255,255,255];
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  const inRR=(u,v,x0,y0,x1,y1,r)=>{
    if(u<x0||u>x1||v<y0||v>y1) return false;
    const dx=Math.max(x0+r-u,0,u-(x1-r)), dy=Math.max(y0+r-v,0,v-(y1-r));
    return dx*dx+dy*dy<=r*r;
  };
  const rows=[];
  for(let y=0;y<size;y++){
    const row=Buffer.alloc(1+size*3); row[0]=0;
    for(let x=0;x<size;x++){
      const u=x/size, v=y/size;
      let px=mix(duskA,duskB,(u+v)/2);
      const pathV=0.885-(u-0.5)*0.12;
      if(Math.abs(v-pathV)<0.011 && Math.floor(u*16)%2===0) px=mix(px,white,0.55);
      if(inRR(u,v,0.265,0.30,0.335,0.74,0.03)) px=strap;
      if(inRR(u,v,0.665,0.30,0.735,0.74,0.03)) px=strap;
      if(inRR(u,v,0.30,0.285,0.70,0.755,0.105)) px=mix(sunset,sunsetD,(v-0.285)/0.47);
      if(inRR(u,v,0.345,0.245,0.655,0.415,0.075)) px=sole;
      if(inRR(u,v,0.385,0.555,0.615,0.705,0.05)) px=sand;
      const sd=Math.hypot(u-0.80,v-0.155);
      if(sd<0.088) px=mix([255,224,138],sole,sd/0.088);
      else if(sd<0.125) px=mix(px,sole,(0.125-sd)/0.037*0.5);
      const o=1+x*3;
      row[o]=px[0]|0; row[o+1]=px[1]|0; row[o+2]=px[2]|0;
    }
    rows.push(row);
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=2;
  const png=Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk('IHDR',ihdr),
    chunk('IDAT',deflateSync(Buffer.concat(rows))),
    chunk('IEND',Buffer.alloc(0)),
  ]);
  writeFileSync(file,png);
  console.log('creato',file,png.length,'byte');
}
makeIcon(192, new URL('../public/icons/icon-192.png', import.meta.url).pathname);
makeIcon(512, new URL('../public/icons/icon-512.png', import.meta.url).pathname);
