// colorType 2 (RGB), stride = w*3+1
const zlib = require('zlib');
const fs = require('fs');
function analyzePNG(file) {
  const buf = fs.readFileSync(file);
  let pos = 8; let w, h; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.slice(pos+4, pos+8).toString();
    if (type === 'IHDR') { w = buf.readUInt32BE(pos+8); h = buf.readUInt32BE(pos+12); }
    if (type === 'IDAT') idat.push(buf.slice(pos+8, pos+8+len));
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 3, stride = w*bpp + 1;
  // 正确做 PNG 逆滤波（支持 0-4 全部 filter）
  const img = Buffer.alloc(h * w * bpp);
  for (let y = 0; y < h; y++) {
    const filter = raw[y*stride];
    const rowIn = raw.slice(y*stride+1, (y+1)*stride);
    const rowOut = img.slice(y*w*bpp, (y+1)*w*bpp);
    for (let x = 0; x < w*bpp; x++) {
      const a = x >= bpp ? rowOut[x-bpp] : 0;
      const b = y > 0 ? img[(y-1)*w*bpp + x] : 0;
      const c = (x >= bpp && y > 0) ? img[(y-1)*w*bpp + x-bpp] : 0;
      let val = rowIn[x];
      switch (filter) {
        case 0: break;
        case 1: val = (val + a) & 255; break;
        case 2: val = (val + b) & 255; break;
        case 3: val = (val + ((a + b) >> 1)) & 255; break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p-a), pb = Math.abs(p-b), pc = Math.abs(p-c);
          val = (val + (pa<=pb && pa<=pc ? a : pb<=pc ? b : c)) & 255; break;
        }
      }
      rowOut[x] = val;
    }
  }
  // 统计颜色直方（降采样）
  const hist = {};
  let total = 0;
  for (let y = 0; y < h; y += 5) {
    for (let x = 0; x < w; x += 5) {
      const o = (y*w + x)*bpp;
      const key = img[o]+','+img[o+1]+','+img[o+2];
      hist[key] = (hist[key]||0)+1;
      total++;
    }
  }
  const top = Object.entries(hist).sort((a,b)=>b[1]-a[1]).slice(0,6);
  console.log(file.split('/').pop(), w+'x'+h, 'total', total);
  top.forEach(([k,n]) => console.log('   rgb('+k+')', (n/total*100).toFixed(1)+'%'));
}
process.argv.slice(2).forEach(f => { try { analyzePNG(f); } catch(e) { console.log(f,'ERR',e.message.slice(0,100)); } });
