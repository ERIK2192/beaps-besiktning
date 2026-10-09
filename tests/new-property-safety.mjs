// Run: node tests/new-property-safety.mjs. No network, disk data changes or browser needed.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { filingPath } from '../cflib/dropbox.js';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
new vm.Script(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')));
const names = html.slice(html.indexOf('const DBX_PARENT ='), html.indexOf('// Which photos already'));
const tidy = html.slice(html.indexOf('async function tidyGallery(){'), html.indexOf('// tyst = running'));
const ctx = vm.createContext({ NEW_PROPERTY:'Nytt objekt', S:null, pad:n=>String(n).padStart(2,'0'),
  AUTH:{}, withTimeout:p=>p, log:()=>{}, flushSave:async()=>{}, schedulePush:()=>{} });
vm.runInContext(names + '\n' + tidy,ctx);
const folder = s=>{ctx.S=s;return vm.runInContext('dropboxSubfolder()',ctx)};
const base={id:'aaaa1111bbb',created:1791547200000,type:'Nytt objekt',address:'A'.repeat(250),apt:'1',counter:{name:''}};
const a=folder({...base}), b=folder({...base,id:'cccc2222ddd'});
assert.notEqual(filingPath({},a),filingPath({},b));
assert.ok(a.endsWith(' aaaa1111bbb'));
assert.ok(a.split('/')[1].length<=120);
assert.equal(filingPath({},a),'/Longstay PICTURES/'+a);
assert.ok(!folder({...base,address:'Storgatan 1/3'}).includes('1/3'));
const historical='MOVE IN/MIN - Gammal adress 1 Tidigare hyresgäst';
for(const type of ['Inflytt','Utflytt','Nytt objekt','Upplåsning']) {
  assert.equal(folder({...base,type,dropbox:{subfolder:historical}}),historical);
}
let sent;
ctx.fetch=async(url,opts)=>{sent=JSON.parse(opts.body);return {ok:true,json:async()=>({ok:true,removed:0})}};
ctx.S={...base,rooms:[{photos:[{id:'room'}]}],checks:[{photos:[{id:'hidden-check'}]}],
  tech:[{photos:[{id:'equipment'}]}],video:{stored:true},gallery:{token:'test',done:['room','hidden-check','equipment','video','deleted']}};
// No photoCache or videoURL exists in this context: retained references must still be sent.
await vm.runInContext('tidyGallery()',ctx);
assert.deepEqual(sent.ids.sort(),['equipment','hidden-check','room','video']);
assert.ok(!ctx.S.gallery.done.includes('deleted'));
assert.equal(ctx.S.gallery.done.length,4);
console.log('PASS syntax, unique long paths, stable historical folders, retained media without thumbnails');
