const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');
const load=Module._load;const calls=[];let fail=false;
Module._load=function(name,...args){
 if(name==='../rusty-media')return {useRustMedia:()=>true,loadRustMedia:()=>({captureFrame:async(...args)=>{calls.push(args);if(fail)throw Error('native failure');return {data:Buffer.from('89504e470d0a1a0a','hex')};}})};
 if(name==='screenshot-desktop')return ()=>{throw Error('Legacy capture must not run');};
 if(name==='../files/utils')return {saveFile(){throw Error('No intermediate image file');}};
 if(name==='../utils')return {resizeImage(){throw Error('No JS image processing');}};
 return load.call(this,name,...args);
};
const {takeAndSendScreenshot}=require('../src/commanding/screenshot-handler.ts');Module._load=load;
test('screenshot command composes native PNG capture/resize and reports native errors',async()=>{
 const sent=[],ws={send:value=>sent.push(value)};await takeAndSendScreenshot(ws);
 assert.deepEqual(calls[0],[800,85,null,true,'png']);assert.equal(sent[0],'data:image/png;base64,iVBORw0KGgo=');
 fail=true;await takeAndSendScreenshot(ws);assert.equal(JSON.parse(sent[1]).type,'error');
});
