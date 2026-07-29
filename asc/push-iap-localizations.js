// 「평생 이용」(NON_CONSUMABLE) 인앱구입 현지화 업로드
//   node asc/push-iap-localizations.js          ← dry-run
//   node asc/push-iap-localizations.js --apply  ← 실제 반영
// ⚠️ 심사 제출은 하지 않는다. 제출 버튼은 사람이 누른다.
// 2026-07-29: 9개 언어 반영 완료(en-US ja zh-Hans es-ES fr-FR de-DE it pt-BR ru)
// 「평생 이용」 인앱구입 9개 언어 추가. --apply 없으면 계획만 출력.
const fs=require('fs'),crypto=require('crypto');
const KEY_ID='4625N6447U',ISSUER='6e48e6c7-afd0-4509-bbd8-0da831b29972';
const KEY_PATH=`${process.env.HOME}/Downloads/AuthKey_${KEY_ID}.p8`;
const IAP_ID='6772863857';
const APPLY=process.argv.includes('--apply');
// name ≤30자, description ≤45자 (Apple 제한)
const L={
 'en-US':{name:'Lifetime Premium',      description:'All premium features, forever. One payment.'},
 'ja':   {name:'買い切り（永久利用）',        description:'すべてのプレミアム機能を永久に利用できます'},
 'zh-Hans':{name:'终身解锁',            description:'一次购买，永久畅享全部高级功能'},
 'es-ES':{name:'Acceso de por vida',   description:'Todas las funciones Premium para siempre'},
 'fr-FR':{name:'Accès à vie',          description:'Toutes les fonctions Premium, à vie'},
 'de-DE':{name:'Lebenslanger Zugang',  description:'Alle Premium-Funktionen, dauerhaft'},
 'it':   {name:'Accesso a vita',       description:'Tutte le funzioni Premium, per sempre'},
 'pt-BR':{name:'Acesso vitalício',     description:'Todos os recursos Premium, para sempre'},
 'ru':   {name:'Пожизненный доступ',   description:'Все премиум-функции навсегда'},
};
const b64u=b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function token(){const n=Math.floor(Date.now()/1000);const h=b64u(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'}));
 const p=b64u(JSON.stringify({iss:ISSUER,iat:n,exp:n+1200,aud:'appstoreconnect-v1'}));
 const s=crypto.createSign('SHA256');s.update(`${h}.${p}`);
 return `${h}.${p}.${b64u(s.sign({key:fs.readFileSync(KEY_PATH),dsaEncoding:'ieee-p1363'}))}`;}
async function asc(m,p,body){const r=await fetch('https://api.appstoreconnect.apple.com'+p,{method:m,
 headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t}
 if(r.status>=400)throw new Error(`${m} ${p} → ${r.status} ${JSON.stringify(j?.errors||j).slice(0,300)}`);return j;}
(async()=>{
 console.log(APPLY?'=== 실제 반영 (--apply) ===\n':'=== dry-run · 아무것도 안 바꿈 ===\n');
 // 길이 검사
 let bad=0;
 for(const [loc,v] of Object.entries(L)){
   if([...v.name].length>30){console.log(`🔴 ${loc} name ${[...v.name].length}자 (30 초과)`);bad++;}
   if([...v.description].length>45){console.log(`🔴 ${loc} desc ${[...v.description].length}자 (45 초과)`);bad++;}
 }
 if(bad){console.log('길이 위반 → 중단');return;}
 console.log('✅ 길이 검사 통과 (name≤30, desc≤45)\n');
 const cur=await asc('GET',`/v2/inAppPurchases/${IAP_ID}/inAppPurchaseLocalizations?limit=50`);
 const have=new Set(cur.data.map(x=>x.attributes.locale));
 console.log('기존 현지화:',[...have].join(', '),'\n');
 for(const [loc,v] of Object.entries(L)){
   if(have.has(loc)){console.log(`- ${loc}  이미 있음 → 건너뜀`);continue;}
   console.log(`+ ${loc}  "${v.name}" / "${v.description}"`);
   if(APPLY){
     await asc('POST','/v1/inAppPurchaseLocalizations',{data:{type:'inAppPurchaseLocalizations',
      attributes:{locale:loc,name:v.name,description:v.description},
      relationships:{inAppPurchaseV2:{data:{type:"inAppPurchases",id:IAP_ID}}}}});
     console.log(`  ✅ 생성됨`);
   }
 }
 const after=await asc('GET',`/v2/inAppPurchases/${IAP_ID}/inAppPurchaseLocalizations?limit=50`);
 console.log(`\n최종 현지화 ${after.data.length}개:`,after.data.map(x=>x.attributes.locale).join(', '));
})().catch(e=>console.error('ERR',e.message));
