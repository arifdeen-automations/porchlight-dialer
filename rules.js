/* Porchlight Dialer: calling rules.
   Pure functions with no DOM access, shared by the browser app (index.html)
   and the Node test suite (tests/rules.test.js). Times are minutes after midnight. */
const fmt=m=>{m=((Math.round(m)%1440)+1440)%1440;let h=Math.floor(m/60);const mm=m%60,ap=h>=12?'PM':'AM';h=h%12||12;return `${h}:${String(mm).padStart(2,'0')} ${ap}`;};
const toHHMM=m=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const fromHHMM=s=>{const[h,m]=String(s).split(':').map(Number);return h*60+(m||0);};
const digits=s=>String(s).replace(/\D/g,'').slice(-10);
/* ---------- rules (pure) ---------- */
const DEFAULT_STATES={
  CA:{name:'California',zone:'Pacific',off:0,start:480,end:1260},
  NV:{name:'Nevada',zone:'Pacific',off:0,start:480,end:1260},
  AZ:{name:'Arizona',zone:'Mountain, no DST',off:0,start:480,end:1260},
  CO:{name:'Colorado',zone:'Mountain',off:1,start:480,end:1260},
  TX:{name:'Texas',zone:'Central',off:2,start:480,end:1260},
  OH:{name:'Ohio',zone:'Eastern',off:3,start:480,end:1260},
  GA:{name:'Georgia',zone:'Eastern',off:3,start:480,end:1260},
  FL:{name:'Florida',zone:'Eastern',off:3,start:480,end:1200}
};
const DEFAULT_DNC='(937) 555-0119\n702.555.0188\n';
const defaultCfg=()=>({states:JSON.parse(JSON.stringify(DEFAULT_STATES)),dailyLimit:3,dncText:DEFAULT_DNC});
const dncSet=cfg=>new Set(cfg.dncText.split(/[\n,;]+/).map(digits).filter(d=>d.length===10));
const localMin=(lead,now,cfg)=>now+cfg.states[lead.state].off*60;

function canCall(lead,now,cfg){
  if(dncSet(cfg).has(digits(lead.phone)))return{ok:false,kind:'block',reason:'On do-not-call list'};
  if(lead.attemptsToday>=cfg.dailyLimit)return{ok:false,kind:'block',reason:`Daily call limit reached (${lead.attemptsToday}/${cfg.dailyLimit})`};
  const st=cfg.states[lead.state],l=localMin(lead,now,cfg);
  if(l<st.start||l>=st.end)return{ok:false,kind:'wait',reason:`Outside calling hours in ${lead.state} (${fmt(l)} local)`,opens:l<st.start?st.start:null};
  return{ok:true};
}
function canText(lead,now,cfg){
  if(dncSet(cfg).has(digits(lead.phone)))return{ok:false,kind:'block',reason:'On do-not-call list'};
  if(lead.textOptOut)return{ok:false,kind:'block',reason:'Opted out of texts'};
  const st=cfg.states[lead.state],l=localMin(lead,now,cfg);
  if(l<st.start||l>=st.end)return{ok:false,kind:'wait',reason:`Quiet hours in ${lead.state} (${fmt(l)} local)`};
  return{ok:true};
}
function dueCall(lead,now,cfg){
  if(lead.closed||lead.busy)return null;
  const l=localMin(lead,now,cfg);
  return lead.touches.filter(t=>t.type==='call'&&t.status==='pending'&&t.due<=l).sort((a,b)=>a.due-b.due)[0]||null;
}
/* Builds the call queue: every lead with a call due now, checked against the rules, earliest due first (in Pacific terms). */
function evaluateQueue(leads,now,cfg){
  const items=[];
  for(const lead of leads){const touch=dueCall(lead,now,cfg);if(touch)items.push({lead,touch,check:canCall(lead,now,cfg),duePT:touch.due-cfg.states[lead.state].off*60});}
  items.sort((a,b)=>a.duePT-b.duePT);
  return{items,ready:items.filter(i=>i.check.ok),blocked:items.filter(i=>i.check.kind==='block'),waiting:items.filter(i=>i.check.kind==='wait')};
}
/* Pairs free agents with ready leads. Never returns more dials than free agents. */
function planDial(leads,agents,now,cfg){
  const free=agents.filter(a=>a.status==='available');
  const q=evaluateQueue(leads,now,cfg);
  return q.ready.slice(0,free.length).map((it,i)=>({agentId:free[i].id,leadId:it.lead.id,touchId:it.touch.id}));
}


if (typeof module !== 'undefined') {
  module.exports = { fmt, toHHMM, fromHHMM, digits, DEFAULT_STATES, defaultCfg, dncSet, localMin, canCall, canText, dueCall, evaluateQueue, planDial };
}
