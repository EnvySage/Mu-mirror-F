const zlib = require('zlib');
const fs = require('fs');
function analyzePNG(file) {
  const buf = fs.readFileSync(file);
  let pos = 8;
  let w, h, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.slice(pos+4, pos+8).toString();
    if (type === 'IHDR') { w = buf.readUInt32BE(pos+8); h = buf.readUInt32BE(pos+12); }
    if (type === 'IDAT') idat.push(buf.slice(pos+8, pos+8+len));
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w*4+1;
  let nonWhite = 0, total = 0;
  for (let y = 0; y < h; y += 3) {
    for (let x = 1; x < stride; x += 8) {
      const b = raw[y*stride + x];
      total++;
      if (b !== 255) nonWhite++;
    }
  }
  const pct = (nonWhite/total*100).toFixed(1);
  console.log(file.split('/').pop(), w+'x'+h, 'nonWhitePct', pct);
}
process.argv.slice(2).forEach(f => {
  try { analyzePNG(f); } catch(e) { console.log(f, 'ERR', e.message.slice(0,80)); }
});
