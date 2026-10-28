// Real authenticated socket delivery benchmark. No capture, encoding or transport mocks.
const assert = require('node:assert/strict');
const { performance, monitorEventLoopDelay } = require('node:perf_hooks');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { createHash } = require('node:crypto');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
exports.run = async function(socket, Jimp) {
  assert.equal(process.platform,'darwin');
  const directory=mkdtempSync(join(tmpdir(),'rusty-frame-fixture-'));
  let fixture;
  try {
    const compile=spawnSync('swiftc',[join(__dirname,'frame-target.swift'),'-o',join(directory,'target')],{encoding:'utf8'});
    assert.equal(compile.status,0,compile.stderr);
    fixture=spawn(join(directory,'target'),[],{stdio:['pipe','pipe','inherit']});
    await Promise.race([once(fixture.stdout,'data'),pause(10000).then(()=>{throw Error('Frame fixture did not start');})]);
    const results=[];
    for(const workload of ['static','motion']) {
      fixture.stdin.write(workload+'\n'); await pause(750);
      socket.send(JSON.stringify({type:'vnc_quality_update',width:1440,jpegQuality:85,fps:30}));
      // Warm the actual capture path before the measured subscription.
      let warmed=false;
      const warm=raw=>{if(['screen-update','vnc_screen_update'].includes(JSON.parse(raw).type))warmed=true;}; socket.on('message',warm);
      socket.send(JSON.stringify({type:'vnc_start'}));
      for(let i=0;!warmed && i<200;i++)await pause(50);
      socket.send(JSON.stringify({type:'vnc_stop'}));socket.off('message',warm);assert(warmed,'Native capture warm-up must deliver');await pause(300);
      const frames=[],pings=[],pending=[]; let firstImage,lastImage;
      const loop=monitorEventLoopDelay({resolution:10}); loop.enable();
      const cpu=process.cpuUsage(),begin=performance.now();
      const listener=raw=>{
        const received=performance.now(),message=JSON.parse(raw);
        if(['screen-update','vnc_screen_update'].includes(message.type)) {
          const image=Buffer.from(message.image,'base64'); firstImage ||= image;lastImage=image;
          frames.push({received_ms:received-begin,bytes:image.length,width:message.dimensions.width,height:message.dimensions.height,
            sha256:createHash('sha256').update(image).digest('hex')});
        } else if(message.type==='pong' && pending.length) pings.push(received-pending.shift());
      };
      socket.on('message',listener);
      socket.send(JSON.stringify({type:'vnc_start'}));
      const ping=setInterval(()=>{pending.push(performance.now());socket.send(JSON.stringify({type:'ping'}));},200);
      await pause(10000);
      const elapsed=performance.now()-begin,usage=process.cpuUsage(cpu);
      clearInterval(ping);socket.send(JSON.stringify({type:'vnc_stop'}));socket.off('message',listener);loop.disable();
      assert(frames.length>=3,'Frames must arrive throughout the run');
      assert(frames.every(f=>f.width===1440&&f.height===810),'Matched 1440x810 dimensions required; adjust fixture for another display');
      // Decode after measurement so the observation work does not stall the host loop.
      for(const encoded of [firstImage,lastImage]) {
        const decoded=await Jimp.read(encoded);assert.equal(decoded.width,1440);assert.equal(decoded.height,810);
        assert.equal(encoded.subarray(0,2).toString('hex'),'ffd8');
      }
      const unique=new Set(frames.map(f=>f.sha256)).size;
      if(workload==='motion')assert(unique>=3,'Motion must change delivered pixels');
      results.push({workload,duration_ms:elapsed,frames,delivered_fps:frames.length*1000/elapsed,
        first_frame_ms:frames[0].received_ms,unique_frames:unique,ping_rtt_ms:pings,
        host_cpu_ms:(usage.user+usage.system)/1000,host_cpu_percent:(usage.user+usage.system)/10/elapsed,
        event_loop_p95_ms:loop.percentile(95)/1e6,event_loop_max_ms:loop.max/1e6,
        correctness:{jpeg_decoded:true,dimensions:true,motion_changes:workload==='motion'?unique>=3:null}});
      await pause(300);
    }
    return {settings:{width:1440,height:810,jpegQuality:85,fps:30,adaptive:false},
      cpu_scope:'Current Node/extension-host process including Rust workers and harness; excludes OS capture subprocesses, WindowServer, VS Code renderer and fixture. Not total system CPU.',
      latency_scope:'Socket subscription to first JPEG; ping round trip during streaming. Not glass-to-glass latency.',results};
  } finally {fixture?.stdin.end();if(fixture)await Promise.race([once(fixture,'exit'),pause(2000)]);fixture?.kill();rmSync(directory,{recursive:true,force:true});}
};
