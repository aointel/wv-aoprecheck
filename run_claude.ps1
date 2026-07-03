Set-Location C:\dev\AOIrail
claude --permission-mode bypassPermissions --print @'
Build the AOI Application - Senior Combo intake form.

## Task
Create a multi-step wizard page at /application in the AOIrail React app for collecting all data needed to fill a Senior Combo eApp, then syncing it to EappSync via the server.

## Flow (exact order)
1. Height/Weight/Tobacco per person (primary then spouse)
2. Build chart auto-decline check
3. 14 Senior medical questions per person (one at a time, large Yes/No buttons)
4. Prescription drug addendum (always required for every senior)
5. Beneficiaries (primary + optional contingent)
6. Banking/ACH
7. Review + Sync button

## Build Chart
```typescript
const BUILD_CHART: Record<number, [number,number,number,number,number,number,number,number,number]> = {
  56:[140,172,179,186,190,195,203,208,212],57:[145,178,185,192,197,202,211,215,220],
  58:[150,185,192,199,204,209,218,223,228],59:[155,191,199,206,211,216,226,231,236],
  60:[161,198,205,213,218,223,233,239,244],61:[166,204,212,220,225,231,241,247,252],
  62:[172,211,219,227,233,238,249,255,260],63:[177,218,226,235,240,246,257,263,269],
  64:[183,225,234,242,248,254,266,271,277],65:[189,232,241,250,256,262,274,280,286],
  66:[195,239,248,258,264,270,282,289,295],67:[201,246,256,265,272,278,291,297,304],
  68:[207,254,264,273,280,287,300,306,313],69:[213,261,271,282,288,295,309,315,322],
  70:[219,269,279,290,297,304,318,325,332],71:[225,277,287,298,305,312,327,334,341],
  72:[232,284,295,306,314,321,336,343,351],73:[238,292,304,315,323,330,345,353,361],
  74:[245,300,312,324,332,339,355,363,370],75:[252,309,321,333,341,349,365,373,381],
  76:[258,317,329,341,350,358,374,383,391],
};
// [maxAcceptable, T2, T3, T4, T5, T6, T8, T10, T12]
// weight > T12 = AUTO DECLINE
```

## 14 Senior Medical Questions
```typescript
const SENIOR_MQ = [
  {key:'MQRejectedByAIL',section:'SectionA',text:'Has the proposed insured ever been rejected for life insurance by American Income Life?'},
  {key:'MQSmokeCigarettesTobacco',section:'SectionA',text:'Has the proposed insured used tobacco in the past 12 months?'},
  {key:'MQTerminalIllness',section:'SectionA',text:'Has the proposed insured been advised that they have a terminal illness?'},
  {key:'MQOrganTransplant',section:'SectionA',text:'Has the proposed insured been advised to have or had a heart, lung, liver or bone marrow transplant?'},
  {key:'MQlTreated4ALS',section:'SectionA',text:"Has the proposed insured been diagnosed or treated for ALS, Alzheimer's disease, or senile dementia?"},
  {key:'MQKidneyDisease',section:'SectionA',text:'Has the proposed insured been diagnosed with chronic kidney failure including kidney dialysis?'},
  {key:'MQAmputationCausedByDisease',section:'SectionA',text:'Has the proposed insured had an amputation caused by disease?'},
  {key:'MQAIDS',section:'SectionA',text:'Has the proposed insured been diagnosed with or tested positive for HIV/AIDS?'},
  {key:'MQConfined2NursingFacility',section:'SectionA',text:'Is the proposed insured currently confined to a nursing facility or receiving home health care?'},
  {key:'MQReceivingTreatment',section:'SectionA',text:'Is the proposed insured currently receiving treatment, medication or therapy for any illness or injury?'},
  {key:'MQ12MonthsLostWeight',section:'SectionA',text:'Has the proposed insured lost 10 or more pounds unintentionally in the last 12 months?'},
  {key:'MQArthritisBackKnee',section:'SectionB',text:'In the last 10 years, has the proposed insured had arthritis or any injury to back, knees or joints?'},
  {key:'MQTreatment4HodgkinsLeukemiaMalignantCancer',section:'SectionC',text:'In the last 10 years, has the proposed insured been diagnosed/treated for cancer, tumor or unexplained masses?'},
  {key:'MQDrugAlcoholAbuse',section:'SectionB',text:'Has the proposed insured been treated for alcoholism or drug abuse?'},
];
```
Any Yes on senior MQ = declined (show red banner listing which ones). Still proceed to Rx.

## Files to create/edit

### client/src/pages/application/SeniorComboWizard.tsx
Full wizard component. State:
```typescript
interface PersonBuild { heightFt:number; heightIn:number; weightLbs:number; tobacco:boolean; tobaccoDate:string; }
interface PersonMQ { [key:string]: boolean; }
interface RxEntry { name:string; dosage:string; doctor:string; reason:string; duration:string; }
interface SeniorComboState {
  primary: PersonBuild & { mq: PersonMQ };
  spouse: PersonBuild & { mq: PersonMQ };
  hasSpouse: boolean;
  spouseHasLife: boolean;
  primaryName: string;
  spouseName: string;
  primaryRx: RxEntry[];
  spouseRx: RxEntry[];
  bene1: {name:string;relationship:string;dob:string;pct:number};
  bene2: {name:string;relationship:string;dob:string;pct:number;enabled:boolean};
  banking: {bankName:string;routing:string;account:string;accountType:'Checking'|'Savings';drawDay:number;holderName:string};
}
```

Steps: 'build' | 'mq-primary' | 'mq-spouse' | 'rx-primary' | 'rx-spouse' | 'beneficiaries' | 'banking' | 'review'

Medical questions: show one question at a time. Big YES button (green) and NO button (red/gray). Person name at top. Question number/total. Progress bar.

Pre-fill tobacco MQ from build step answer.

After MQ step for each person: if any Yes, show decline banner. Don't block — show "Continue anyway" for agent.

### client/src/pages/application/index.tsx
Wrapper. On load, GET /api/hppro/eapp-pending to get names/spouse status from inject_payload.
Pass primaryName, spouseName, spouseHasLife to wizard.

### Add to client/src/App.tsx
Import and add route: <Route path="/application" component={ApplicationPage} />

### POST /api/application/senior-combo in server/routes.ts
Find the existing hppro eapp routes (search for "eapp-pending") and add after them:

```typescript
app.post('/api/application/senior-combo', async (req, res) => {
  try {
    const email = await resolveAgentEmailFromRequest(req);
    if (!email) return res.status(401).json({ ok: false });
    
    const body = req.body as Record<string, unknown>;
    
    // Build flat inject payload from body
    const flat: Record<string,string> = {};
    
    // Medical questions primary
    const MQ_KEYS = ['MQRejectedByAIL','MQSmokeCigarettesTobacco','MQTerminalIllness','MQOrganTransplant',
      'MQlTreated4ALS','MQKidneyDisease','MQAmputationCausedByDisease','MQAIDS',
      'MQConfined2NursingFacility','MQReceivingTreatment','MQ12MonthsLostWeight',
      'MQArthritisBackKnee','MQTreatment4HodgkinsLeukemiaMalignantCancer','MQDrugAlcoholAbuse'];
    const MQ_SECTIONS: Record<string,string> = {
      MQArthritisBackKnee:'SectionB', MQTreatment4HodgkinsLeukemiaMalignantCancer:'SectionC',
      MQDrugAlcoholAbuse:'SectionB'
    };
    const getSection = (k:string) => MQ_SECTIONS[k] || 'SectionA';
    
    const primaryMQ = (body.primaryMQ || {}) as Record<string,boolean>;
    const spouseMQ = (body.spouseMQ || {}) as Record<string,boolean>;
    
    for (const k of MQ_KEYS) {
      const sec = getSection(k);
      const pVal = primaryMQ[k] ? 'True' : 'False';
      flat[`${sec}.${k}Yes`] = pVal;
      flat[`${sec}.${k}No`] = pVal === 'True' ? 'False' : 'True';
      const sVal = spouseMQ[k] ? 'True' : 'False';
      flat[`${sec}.${k}SpouseYes`] = sVal;
      flat[`${sec}.${k}SpouseNo`] = sVal === 'True' ? 'False' : 'True';
    }
    
    // Height/weight/tobacco
    const s = (v:unknown) => v == null ? '' : String(v);
    flat.insured1Height = s(body.primaryHeightInches);
    flat.insured1Weight = s(body.primaryWeight);
    flat.insured1Tobacco = (body.primaryTobacco as boolean) ? 'True' : 'False';
    flat.spouse1Height = s(body.spouseHeightInches);
    flat.spouse1Weight = s(body.spouseWeight);
    flat.spouse1Tobacco = (body.spouseTobacco as boolean) ? 'True' : 'False';
    
    // Rx primary
    for (let i = 1; i <= 10; i++) {
      const rx = (body.primaryRx as any[])?.[i-1];
      if (rx) { flat[`rx${i}Name`]=rx.name||''; flat[`rx${i}Dosage`]=rx.dosage||''; flat[`rx${i}Doctor`]=rx.doctor||''; flat[`rx${i}Reason`]=rx.reason||''; flat[`rx${i}Duration`]=rx.duration||''; }
    }
    // Rx spouse
    for (let i = 1; i <= 10; i++) {
      const rx = (body.spouseRx as any[])?.[i-1];
      if (rx) { flat[`rxSp${i}Name`]=rx.name||''; flat[`rxSp${i}Dosage`]=rx.dosage||''; flat[`rxSp${i}Doctor`]=rx.doctor||''; flat[`rxSp${i}Reason`]=rx.reason||''; flat[`rxSp${i}Duration`]=rx.duration||''; }
    }
    
    // Beneficiaries
    const b1 = body.bene1 as any;
    if (b1) { flat.beneficiary1Name=b1.name||''; flat.beneficiary1Relationship=b1.relationship||''; flat.beneficiary1Dob=b1.dob||''; flat.beneficiary1Pct=String(b1.pct||100); }
    const b2 = body.bene2 as any;
    if (b2?.enabled) { flat.beneficiary2Name=b2.name||''; flat.beneficiary2Relationship=b2.relationship||''; flat.beneficiary2Dob=b2.dob||''; flat.beneficiary2Pct=String(b2.pct||0); }
    
    // Banking
    const bk = body.banking as any;
    if (bk) { flat.bankName=bk.bankName||''; flat.routingNumber=bk.routing||''; flat.accountNumber=bk.account||''; flat.accountType=bk.accountType||'Checking'; flat.drawDay=String(bk.drawDay||1); flat.bankHolderName=bk.holderName||''; }
    
    // Merge with existing pending record if any
    if (supabaseAdmin) {
      const { data: existing } = await supabaseAdmin.from('hppro_eapp_pending').select('id,inject_payload,presentation_guid').eq('agent_email', email).is('consumed_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
      
      const merged = { ...(existing?.inject_payload as Record<string,string> || {}), ...flat };
      
      if (existing?.id) {
        await supabaseAdmin.from('hppro_eapp_pending').update({ inject_payload: merged }).eq('id', existing.id);
      }
      
      // Push to EappSync
      let injected = false;
      try {
        const r = await fetch('http://localhost:7432/inject-next', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged)
        });
        injected = r.ok;
      } catch {}
      
      return res.json({ ok: true, injected });
    }
    
    return res.json({ ok: true, injected: false });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});
```

### C:\dev\inject_escd_only.cs - add MQ + height/weight handling

In the FDS loop (after existing Application.City block), add:
```csharp
// Medical questions
foreach(string mqbase in new string[]{
    "SectionA.MQRejectedByAIL","SectionA.MQSmokeCigarettesTobacco","SectionA.MQTerminalIllness",
    "SectionA.MQOrganTransplant","SectionA.MQlTreated4ALS","SectionA.MQKidneyDisease",
    "SectionA.MQAmputationCausedByDisease","SectionA.MQAIDS","SectionA.MQConfined2NursingFacility",
    "SectionA.MQReceivingTreatment","SectionA.MQ12MonthsLostWeight",
    "SectionB.MQArthritisBackKnee","SectionC.MQTreatment4HodgkinsLeukemiaMalignantCancer","SectionB.MQDrugAlcoholAbuse"
}) {
    if(d.ContainsKey(mqbase+"Yes")){
        if(fullKey==mqbase+"Yes") entry.GetType().GetProperty("Value").SetValue(entry,d[mqbase+"Yes"],null);
        if(fullKey==mqbase+"No"){string v2=d[mqbase+"Yes"]=="True"?"False":"True";entry.GetType().GetProperty("Value").SetValue(entry,v2,null);}
    }
    if(d.ContainsKey(mqbase+"SpouseYes")){
        if(fullKey==mqbase+"SpouseYes") entry.GetType().GetProperty("Value").SetValue(entry,d[mqbase+"SpouseYes"],null);
        if(fullKey==mqbase+"SpouseNo"){string v2=d[mqbase+"SpouseYes"]=="True"?"False":"True";entry.GetType().GetProperty("Value").SetValue(entry,v2,null);}
    }
}
```

After the existing person updates in the OC loop, add height/weight:
```csharp
// Height/weight on persons
string h1s=Get(d,"insured1Height","0"),w1s=Get(d,"insured1Weight","0");
int h1val,w1val; int.TryParse(h1s,out h1val); int.TryParse(w1s,out w1val);
if(h1val>0&&oc.Contains("Insured1")) TrySet(oc["Insured1"],"Height",h1val);
if(w1val>0&&oc.Contains("Insured1")) TrySet(oc["Insured1"],"Weight",w1val);
string tobP=Get(d,"insured1Tobacco","False");
if(tobP.Length>0&&oc.Contains("Insured1")) TrySet(oc["Insured1"],"NonTobaccoUser",tobP!="True");
if(oc.Contains("Spouse1")){
    string hs=Get(d,"spouse1Height","0"),ws=Get(d,"spouse1Weight","0");
    int hsp,wsp; int.TryParse(hs,out hsp); int.TryParse(ws,out wsp);
    if(hsp>0) TrySet(oc["Spouse1"],"Height",hsp);
    if(wsp>0) TrySet(oc["Spouse1"],"Weight",wsp);
    string tobS=Get(d,"spouse1Tobacco","False");
    if(tobS.Length>0) TrySet(oc["Spouse1"],"NonTobaccoUser",tobS!="True");
}
```

After editing, recompile inject_escd_only.exe:
```
& "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe" /out:"C:\Program Files (x86)\AIL\eApp\inject_escd_only.exe" C:\dev\inject_escd_only.cs
```
(no /reference flags - it loads DLLs at runtime)

## Style
- AOIrail dark theme: bg-slate-900, text-slate-100, cyan-500 accents
- Large touch-friendly buttons for Yes/No
- Progress bar showing step/total
- Check existing pages in client/src/pages/ for patterns

## Commit
git add -A
git commit -m "feat: AOI Application - Senior Combo intake wizard (build chart, 14 MQ, Rx, beneficiaries, banking, sync)"
git push origin master

When completely finished, run: openclaw system event --text "Done: Built Senior Combo wizard with build chart, 14 MQ, Rx addendum, beneficiaries, banking, eApp sync" --mode now
'@
