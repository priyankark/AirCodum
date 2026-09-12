const {test}=require('node:test');const assert=require('node:assert/strict');const {EventEmitter}=require('node:events');const Module=require('node:module');
const calls=[];const original=Module._load;let child;
Module._load=function(name,...rest){if(name==='child_process')return {spawn:(file,args,options)=>{calls.push({file,args,options});child=new EventEmitter();child.pid=123;child.kill=()=>{child.killed=true};return child;}};return original.call(this,name,...rest);};
const {KeepAwake}=require('../src/keep-awake.ts');Module._load=original;
test('awake assertion is opted in, scoped to the extension PID and released when server stops',()=>{
 let changes=0;const awake=new KeepAwake(()=>changes++,()=>{});
 awake.update(false,true);awake.update(true,false);assert.equal(calls.length,0);
 awake.update(true,true);
 if(process.platform!=='darwin'){assert.equal(calls.length,0);return;}
 assert.deepEqual(calls[0],{file:'/usr/bin/caffeinate',args:['-is','-w',String(process.pid)],options:{stdio:'ignore'}});
 awake.update(true,true);assert.equal(calls.length,1);assert.equal(awake.active,true);
 child.emit('spawn');assert.equal(changes,1);awake.update(true,false);assert.equal(child.killed,true);assert.equal(awake.active,false);
});
