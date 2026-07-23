"use client";
import React, { useState, useEffect, useCallback } from "react";

type Category = "study"|"trading"|"business"|"career"|"health"|"admin"|"faith";
type Priority = "urgent"|"high"|"medium";
type TaskType = "milestone"|"ongoing";
type View = "daily"|"all"|"week"|"archive";
type Filter = "all"|"ongoing"|"milestone"|"done"|Category;

interface Step { id:number; text:string; done:boolean; }
interface Task {
  id:number; title:string; category:Category; priority:Priority;
  type:TaskType; date:string; time:string; recurring:string;
  notes:string; done:boolean; deleted:boolean; checklist:Step[];
}
interface Routine {
  id:number; label:string; category:Category; days:string[];
  time:string; duration:number; intensity:"normal"|"high";
  notes:string; completions:Record<string,boolean>;
}

const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_LABELS:Record<string,string> = {
  mon:"Monday",tue:"Tuesday",wed:"Wednesday",thu:"Thursday",
  fri:"Friday",sat:"Saturday",sun:"Sunday",
};
const CATS:Record<string,{label:string}> = {
  study:{label:"Study"},trading:{label:"Trading & Investing"},
  business:{label:"Business"},career:{label:"Career"},
  health:{label:"Health & Fitness"},admin:{label:"Admin & Housing"},
  faith:{label:"Faith"},
};
const CAT_STYLES:Record<string,{bg:string;color:string}> = {
  study:   {bg:"#ECE9FA",color:"#5a4fae"},
  trading: {bg:"#DCEEE3",color:"#2f6b4f"},
  business:{bg:"#F6E9D3",color:"#9c6a1f"},
  career:  {bg:"#F4DFDA",color:"#a5382f"},
  health:  {bg:"#E4E9F9",color:"#3D52A0"},
  admin:   {bg:"#DCEEF0",color:"#3d7a8a"},
  faith:   {bg:"#DCF0E6",color:"#1f7a52"},
};

const C = {
  navy:"#232A4D", primary:"#3D52A0", accent:"#7091E6",
  accent2:"#8697C4", border:"#DCD9EE", muted:"#6b7094",
  muted2:"#9a9dbb", urgent:"#C0503C", urgentSoft:"#F4DFDA",
  sage:"#3E7C5D", sageSoft:"#DCEEE3", surface:"#FFFFFF",
  surface2:"#F6F4FB", bg:"#EDE8F5",
};

const STORAGE_TASKS="docket-tasks-v2";
const STORAGE_ROUTINES="docket-routines-v1";

function todayISO(){return new Date().toISOString().slice(0,10);}
function todayDayKey(){return ["sun","mon","tue","wed","thu","fri","sat"][new Date().getDay()];}
function daysUntil(d:string){
  if(!d)return null;
  return Math.round((new Date(d).getTime()-new Date(todayISO()).getTime())/86400000);
}
function fmtDate(d:string){
  if(!d)return "";
  return new Date(d+"T00:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
}
function nextWeekday(target:number){
  const d=new Date(); let diff=(target-d.getDay()+7)%7; if(!diff)diff=7;
  d.setDate(d.getDate()+diff); return d.toISOString().slice(0,10);
}
function computeStreak(r:Routine){
  let streak=0;
  const d=new Date(todayISO()+"T00:00:00");
  const days=r.days||[...DAYS];
  while(!days.includes(["sun","mon","tue","wed","thu","fri","sat"][d.getDay()]))d.setDate(d.getDate()-1);
  while(true){
    const iso=d.toISOString().slice(0,10);
    const dk=["sun","mon","tue","wed","thu","fri","sat"][d.getDay()];
    if(!days.includes(dk)){d.setDate(d.getDate()-1);continue;}
    if(r.completions?.[iso]){streak++;d.setDate(d.getDate()-1);}else break;
  }
  return streak;
}

function defaultTasks():Task[]{
  const mon=nextWeekday(1);
  return [
    {id:1,title:"Work on ISA agent build with ChatGPT",category:"business",priority:"medium",type:"ongoing",date:"",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]},
    {id:2,title:'Check Trading 212 portfolio ("Halal Made Simple")',category:"trading",priority:"medium",type:"ongoing",date:todayISO(),time:"",recurring:"daily",notes:"",done:false,deleted:false,checklist:[]},
    {id:3,title:"Revise Land Law for exam",category:"study",priority:"urgent",type:"milestone",date:"2026-07-29",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]},
    {id:4,title:"Prepare for motorbike theory test",category:"health",priority:"medium",type:"milestone",date:"",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]},
    {id:5,title:"Cheshire Oak coach interview",category:"career",priority:"urgent",type:"milestone",date:mon,time:"12:30",recurring:"",notes:"12:30pm — prep beforehand.",done:false,deleted:false,checklist:[]},
    {id:6,title:"CPS Paralegal Assistant interview (async)",category:"career",priority:"high",type:"milestone",date:"",time:"",recurring:"",notes:"Not live — complete before deadline.",done:false,deleted:false,checklist:[]},
    {id:7,title:"Contact Universal Credit re: rent/housing issue",category:"admin",priority:"urgent",type:"milestone",date:todayISO(),time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]},
    {id:8,title:"Sort out ongoing car issue",category:"admin",priority:"high",type:"milestone",date:"",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]},
    {id:9,title:"Submit fee waiver application",category:"admin",priority:"high",type:"milestone",date:"",time:"",recurring:"",notes:"Add deadline once confirmed.",done:false,deleted:false,checklist:[]},
    {id:10,title:"Contact water utility about the bill",category:"admin",priority:"high",type:"milestone",date:"",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]},
    {id:11,title:"Integrate Facebook liked-reels tool into Claude workflow",category:"business",priority:"medium",type:"ongoing",date:"",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]},
  ];
}
function defaultRoutines():Routine[]{
  return [
    {id:1,label:"Fajr",category:"faith",days:[...DAYS],time:"04:30",duration:15,intensity:"normal",notes:"",completions:{}},
    {id:2,label:"Gym session",category:"health",days:DAYS.filter(d=>d!=="sun"),time:"07:00",duration:60,intensity:"high",notes:"",completions:{}},
    {id:3,label:"Breakfast",category:"health",days:[...DAYS],time:"07:30",duration:20,intensity:"normal",notes:"",completions:{}},
    {id:4,label:"Trading 212 check-in",category:"trading",days:[...DAYS],time:"08:00",duration:15,intensity:"normal",notes:"",completions:{}},
    {id:5,label:"Develop Claude / AI tools account",category:"business",days:[...DAYS],time:"09:00",duration:45,intensity:"normal",notes:"",completions:{}},
    {id:6,label:"Work on AI investment agent",category:"trading",days:[...DAYS],time:"10:00",duration:60,intensity:"normal",notes:"",completions:{}},
    {id:7,label:"Work on vending company",category:"business",days:[...DAYS],time:"11:15",duration:45,intensity:"normal",notes:"",completions:{}},
    {id:8,label:"Dhuhr",category:"faith",days:[...DAYS],time:"13:15",duration:15,intensity:"normal",notes:"",completions:{}},
    {id:9,label:"Lunch",category:"health",days:[...DAYS],time:"13:30",duration:30,intensity:"normal",notes:"",completions:{}},
    {id:10,label:"Revise Land Law",category:"study",days:[...DAYS],time:"15:00",duration:90,intensity:"normal",notes:"",completions:{}},
    {id:11,label:"Asr",category:"faith",days:[...DAYS],time:"17:00",duration:15,intensity:"normal",notes:"",completions:{}},
    {id:12,label:"Work on Broasted",category:"business",days:[...DAYS],time:"18:00",duration:60,intensity:"normal",notes:"",completions:{}},
    {id:13,label:"Football",category:"health",days:["sun"],time:"18:00",duration:90,intensity:"high",notes:"",completions:{}},
    {id:14,label:"Work on clothing company",category:"business",days:[...DAYS],time:"19:15",duration:45,intensity:"normal",notes:"",completions:{}},
    {id:15,label:"Maghrib",category:"faith",days:[...DAYS],time:"21:15",duration:15,intensity:"normal",notes:"",completions:{}},
    {id:16,label:"Dinner",category:"health",days:[...DAYS],time:"21:30",duration:30,intensity:"normal",notes:"",completions:{}},
    {id:17,label:"Isha",category:"faith",days:[...DAYS],time:"23:00",duration:15,intensity:"normal",notes:"",completions:{}},
    {id:18,label:"Read Quran",category:"faith",days:[...DAYS],time:"",duration:20,intensity:"normal",notes:"",completions:{}},
    {id:19,label:"Publish content on Underdeen Instagram",category:"faith",days:["sun"],time:"20:00",duration:30,intensity:"normal",notes:"",completions:{}},
  ];
}

// ── Shared small components ──────────────────────────────────────────────────

function CatPill({category,done}:{category:string;done?:boolean}){
  const s=CAT_STYLES[category]??CAT_STYLES.study;
  return(
    <span style={{background:s.bg,color:s.color,padding:"5px 12px",borderRadius:8,
      fontSize:12.5,fontWeight:600,lineHeight:1.3,display:"inline-block",
      textDecoration:done?"line-through":"none",opacity:done?0.55:1}}>
      {CATS[category]?.label??category}
    </span>
  );
}

function Checkbox({checked,onClick,small}:{checked:boolean;onClick:()=>void;small?:boolean}){
  const sz=small?16:20;
  return(
    <button onClick={onClick} style={{width:sz,height:sz,borderRadius:small?5:6,
      border:`2px solid ${checked?C.sage:C.border}`,background:checked?C.sage:"white",
      display:"flex",alignItems:"center",justifyContent:"center",
      flexShrink:0,cursor:"pointer",transition:"all 0.15s"}}>
      {checked&&<span style={{color:"white",fontWeight:700,fontSize:small?8:11}}>✓</span>}
    </button>
  );
}

function Modal({children,onClose}:{children:React.ReactNode;onClose:()=>void}){
  return(
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(35,42,77,0.35)",
        backdropFilter:"blur(2px)",display:"flex",alignItems:"center",
        justifyContent:"center",zIndex:50,padding:20}}>
      <div style={{background:"white",borderRadius:18,padding:28,width:"100%",
        maxWidth:440,boxShadow:"0 30px 80px rgba(35,42,77,0.25)",
        maxHeight:"90vh",overflowY:"auto"}}>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({children}:{children:React.ReactNode}){
  return<label style={{display:"block",fontSize:11,fontWeight:600,
    color:C.muted,marginBottom:6,letterSpacing:0.3}}>{children}</label>;
}
const inputStyle:React.CSSProperties={width:"100%",padding:"10px 12px",
  border:`1.5px solid ${C.border}`,borderRadius:9,fontSize:13,
  background:C.surface2,color:C.navy,outline:"none",fontFamily:"inherit"};

// ── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({initial,onClose,onSave}:{
  initial?:Partial<Task>;onClose:()=>void;
  onSave:(t:Omit<Task,"id"|"done"|"deleted"|"checklist">)=>void;
}){
  const[title,setTitle]=useState(initial?.title??"");
  const[category,setCategory]=useState<Category>(initial?.category??"study");
  const[priority,setPriority]=useState<Priority>(initial?.priority??"medium");
  const[type,setType]=useState<TaskType>(initial?.type??"milestone");
  const[date,setDate]=useState(initial?.date??"");
  const[recurring,setRecurring]=useState(initial?.recurring??"");
  const[notes,setNotes]=useState(initial?.notes??"");
  return(
    <Modal onClose={onClose}>
      <h3 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,
        color:C.navy,marginBottom:18}}>{initial?.id?"Edit Task":"New Task"}</h3>
      <div style={{marginBottom:14}}>
        <FieldLabel>Task</FieldLabel>
        <input value={title} onChange={e=>setTitle(e.target.value)}
          placeholder="e.g. Revise Land Law" style={inputStyle}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div><FieldLabel>Category</FieldLabel>
          <select value={category} onChange={e=>setCategory(e.target.value as Category)} style={inputStyle}>
            {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div><FieldLabel>Priority</FieldLabel>
          <select value={priority} onChange={e=>setPriority(e.target.value as Priority)} style={inputStyle}>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div><FieldLabel>Nature</FieldLabel>
          <select value={type} onChange={e=>setType(e.target.value as TaskType)} style={inputStyle}>
            <option value="milestone">Completable</option>
            <option value="ongoing">Ongoing</option>
          </select>
        </div>
        <div><FieldLabel>Recurring</FieldLabel>
          <select value={recurring} onChange={e=>setRecurring(e.target.value)} style={inputStyle}>
            <option value="">One-off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <FieldLabel>Due / target date</FieldLabel>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inputStyle}/>
      </div>
      <div style={{marginBottom:20}}>
        <FieldLabel>Notes</FieldLabel>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
          placeholder="Any detail worth remembering"
          style={{...inputStyle,resize:"vertical"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
        <button onClick={onClose} style={{padding:"10px 18px",borderRadius:9,
          border:`1.5px solid ${C.border}`,fontSize:13,fontWeight:600,
          color:C.muted,background:"none",cursor:"pointer"}}>Cancel</button>
        <button onClick={()=>{if(!title.trim())return;
          onSave({title,category,priority,type,date,time:"",recurring,notes});onClose();}}
          style={{padding:"10px 18px",borderRadius:9,background:C.navy,
            color:"white",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          {initial?.id?"Save Changes":"Save Task"}
        </button>
      </div>
    </Modal>
  );
}

// ── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({task,onToggle,onDelete,onEdit,onAddStep,onToggleStep,onRemoveStep,isArchive,onRestore}:{
  task:Task;onToggle:()=>void;onDelete:()=>void;onEdit:()=>void;
  onAddStep:(t:string)=>void;onToggleStep:(id:number)=>void;
  onRemoveStep:(id:number)=>void;isArchive?:boolean;onRestore?:()=>void;
}){
  const[expanded,setExpanded]=useState(false);
  const[stepInput,setStepInput]=useState("");
  const d=task.date?daysUntil(task.date):null;
  const overdue=d!==null&&d<0&&!task.done;
  const cl=task.checklist??[];
  const clDone=cl.filter(s=>s.done).length;
  return(
    <div style={{background:"white",border:`1px solid ${overdue&&!task.done?C.urgent:C.border}`,
      borderRadius:14,padding:"15px 17px",marginBottom:9,
      display:"flex",gap:13,transition:"box-shadow 0.15s"}}>
      {isArchive
        ?<button onClick={onRestore} style={{background:"none",border:"none",
            color:C.muted2,cursor:"pointer",fontSize:18,marginTop:2,flexShrink:0}}>↺</button>
        :<Checkbox checked={task.done} onClick={onToggle}/>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,fontSize:15.5,
            color:C.navy,letterSpacing:-0.2,
            textDecoration:task.done?"line-through":"none"}}>{task.title}</p>
          <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
            {task.priority!=="medium"&&(
              <span style={{fontSize:9,fontWeight:700,letterSpacing:0.5,
                padding:"3px 8px",borderRadius:7,textTransform:"uppercase",
                background:task.priority==="urgent"?C.urgentSoft:"#E4E9F9",
                color:task.priority==="urgent"?C.urgent:C.primary}}>{task.priority}</span>
            )}
            {!isArchive&&<>
              <button onClick={onEdit} style={{background:"none",border:"none",
                color:C.muted2,cursor:"pointer",fontSize:14,padding:"3px 5px"}}>✎</button>
              <button onClick={onDelete} style={{background:"none",border:"none",
                color:C.muted2,cursor:"pointer",fontSize:14,padding:"3px 5px"}}>✕</button>
            </>}
          </div>
        </div>
        {task.notes&&<p style={{fontSize:12,color:C.muted,marginTop:3,lineHeight:1.5}}>{task.notes}</p>}
        <div style={{display:"flex",gap:7,marginTop:9,flexWrap:"wrap",alignItems:"center"}}>
          <CatPill category={task.category}/>
          {task.deleted&&<span style={{fontSize:10,fontWeight:600,padding:"3px 8px",
            borderRadius:7,background:C.urgentSoft,color:C.urgent}}>🗑 Deleted</span>}
          {task.done&&!task.deleted&&<span style={{fontSize:10,fontWeight:600,padding:"3px 8px",
            borderRadius:7,background:C.sageSoft,color:C.sage}}>✓ Completed</span>}
          {task.type==="ongoing"&&<span style={{fontSize:10,fontWeight:600,padding:"3px 8px",
            borderRadius:7,background:"#E4E9F9",color:C.primary}}>◆ ONGOING</span>}
          {task.date&&<span style={{fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:7,
            background:overdue?C.urgentSoft:C.surface2,
            color:overdue?C.urgent:C.muted}}>
            {overdue?"OVERDUE · ":""}{fmtDate(task.date)}{task.time?` · ${task.time}`:""}
          </span>}
          {task.recurring&&<span style={{fontSize:10,fontWeight:600,padding:"3px 8px",
            borderRadius:7,background:C.sageSoft,color:C.sage}}>{task.recurring}</span>}
        </div>
        {!isArchive&&<>
          <button onClick={()=>setExpanded(e=>!e)}
            style={{display:"flex",alignItems:"center",gap:6,marginTop:9,
              fontSize:11,fontWeight:600,color:C.primary,background:"none",
              border:"none",cursor:"pointer"}}>
            {cl.length>0&&<span style={{background:"#E4E9F9",color:C.primary,
              padding:"2px 7px",borderRadius:6,fontFamily:"monospace",fontSize:9.5}}>
              {clDone}/{cl.length}</span>}
            {expanded?"▲":"▼"} Steps
          </button>
          {expanded&&<div style={{marginTop:7,background:C.surface2,borderRadius:10,padding:"9px 11px"}}>
            {cl.map(s=>(
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 0"}}>
                <Checkbox checked={s.done} onClick={()=>onToggleStep(s.id)} small/>
                <span style={{flex:1,fontSize:11.5,color:C.navy,
                  textDecoration:s.done?"line-through":"none"}}>{s.text}</span>
                <button onClick={()=>onRemoveStep(s.id)}
                  style={{background:"none",border:"none",color:C.muted2,
                    cursor:"pointer",fontSize:12}}>✕</button>
              </div>
            ))}
            <div style={{display:"flex",gap:6,marginTop:7}}>
              <input value={stepInput} onChange={e=>setStepInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&stepInput.trim()){onAddStep(stepInput.trim());setStepInput("");}}}
                placeholder="Add a step"
                style={{flex:1,padding:"6px 9px",border:`1.5px solid ${C.border}`,
                  borderRadius:7,fontSize:11.5,background:"white",fontFamily:"inherit"}}/>
              <button onClick={()=>{if(stepInput.trim()){onAddStep(stepInput.trim());setStepInput("");}}}
                style={{background:C.navy,color:"white",border:"none",
                  padding:"0 11px",borderRadius:7,fontSize:11.5,fontWeight:600,cursor:"pointer"}}>
                Add
              </button>
            </div>
          </div>}
        </>}
      </div>
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────
function Drawer({isOpen,onClose,currentView,setView}:{
  isOpen:boolean;onClose:()=>void;currentView:View;setView:(v:View)=>void;
}){
  const items:{key:View;label:string}[]=[
    {key:"daily",label:"Daily Routine"},{key:"all",label:"All Tasks"},{key:"week",label:"Week"},
  ];
  return(
    <>
      {isOpen&&<div onClick={onClose} style={{position:"fixed",inset:0,
        background:"rgba(35,42,77,0.3)",backdropFilter:"blur(2px)",zIndex:70}}/>}
      <aside style={{position:"fixed",top:0,left:0,bottom:0,width:250,
        background:"white",boxShadow:"8px 0 30px rgba(35,42,77,0.2)",
        padding:"24px 16px",zIndex:71,
        transform:isOpen?"translateX(0)":"translateX(-100%)",
        transition:"transform 0.2s ease",display:"flex",flexDirection:"column",gap:4}}>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
          fontSize:19,color:C.navy,marginBottom:18,padding:"0 8px"}}>The Docket</p>
        {items.map(it=>(
          <button key={it.key} onClick={()=>{setView(it.key);onClose();}}
            style={{textAlign:"left",padding:"12px 12px",borderRadius:10,
              fontSize:14,fontWeight:600,border:"none",cursor:"pointer",
              background:currentView===it.key?C.navy:C.surface2,
              color:currentView===it.key?"white":C.muted}}>
            {it.label}
          </button>
        ))}
        <div style={{marginTop:"auto"}}>
          <button onClick={()=>{setView("archive");onClose();}}
            style={{width:"100%",textAlign:"left",padding:"12px 12px",
              borderRadius:10,fontSize:14,fontWeight:600,border:"none",cursor:"pointer",
              background:currentView==="archive"?C.navy:C.surface2,
              color:currentView==="archive"?"white":C.muted}}>
            Finished &amp; Deleted
          </button>
        </div>
      </aside>
    </>
  );
}

// ── All Tasks Sidebar ────────────────────────────────────────────────────────
function TaskSidebar({tasks,filter,setFilter}:{tasks:Task[];filter:Filter;setFilter:(f:Filter)=>void;}){
  const open=tasks.filter(t=>!t.done&&!t.deleted);
  const archived=tasks.filter(t=>t.done||t.deleted);
  function Btn({f,label,count}:{f:Filter;label:string;count:number}){
    const active=filter===f;
    return(
      <button onClick={()=>setFilter(f)} style={{width:"100%",display:"flex",
        justifyContent:"space-between",alignItems:"center",
        padding:"10px 12px",borderRadius:8,fontSize:13.5,fontWeight:600,
        border:"none",cursor:"pointer",
        background:active?C.primary:"transparent",
        color:active?"white":C.muted,marginBottom:2}}>
        <span>{label}</span>
        <span style={{fontFamily:"monospace",fontSize:11,opacity:0.75}}>{count}</span>
      </button>
    );
  }
  return(
    <div style={{background:"white",borderRadius:14,border:`1px solid ${C.border}`,
      padding:10,height:"fit-content"}}>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:C.muted2,
        textTransform:"uppercase",padding:"6px 10px 6px"}}>Show</p>
      <Btn f="all" label="All Open" count={open.length}/>
      <Btn f="ongoing" label="Ongoing" count={open.filter(t=>t.type==="ongoing").length}/>
      <Btn f="milestone" label="Completable" count={open.filter(t=>t.type==="milestone").length}/>
      <div style={{height:1,background:C.border,margin:"6px 4px"}}/>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:C.muted2,
        textTransform:"uppercase",padding:"6px 10px 6px"}}>Category</p>
      {Object.entries(CATS).map(([k,v])=>(
        <Btn key={k} f={k as Filter} label={v.label} count={open.filter(t=>t.category===k).length}/>
      ))}
      <div style={{height:1,background:C.border,margin:"6px 4px"}}/>
      <Btn f="done" label="Finished & Deleted" count={archived.length}/>
    </div>
  );
}

// ── Timeline Row ─────────────────────────────────────────────────────────────
function TimelineRow({item,onCheck}:{
  item:{time:string;label:string;category:string;done:boolean;streak:number;conflict:boolean;};
  onCheck:()=>void;
}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",
      borderBottom:`1px solid ${C.border}`}}>
      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11.5,
        color:C.muted,width:48,flexShrink:0,fontWeight:500}}>
        {item.time||"—"}
      </span>
      <Checkbox checked={item.done} onClick={onCheck} small/>
      <div style={{flex:1}}>
        <CatPill category={item.category} done={item.done}/>
        {" "}
        <span style={{fontSize:13.5,fontWeight:600,color:C.navy,
          textDecoration:item.done?"line-through":"none"}}>{item.label}</span>
      </div>
      {item.streak>0&&(
        <span style={{fontFamily:"monospace",fontSize:10,color:C.sage,
          background:C.sageSoft,padding:"2px 7px",borderRadius:6,flexShrink:0}}>
          🔥 {item.streak}
        </span>
      )}
      {item.conflict&&(
        <span title="Scheduling clash" style={{fontSize:10,color:C.urgent,
          background:C.urgentSoft,padding:"2px 7px",borderRadius:6,
          flexShrink:0,cursor:"help"}}>⚡ clash</span>
      )}
    </div>
  );
}

// ── Chatbot ──────────────────────────────────────────────────────────────────
function Chatbot({tasks,routines,onAction}:{tasks:Task[];routines:Routine[];onAction:(a:any[])=>void;}){
  const[open,setOpen]=useState(false);
  const[messages,setMessages]=useState<{role:"user"|"assistant";content:string}[]>([
    {role:"assistant",content:"Tell me what to add, remove, or change — tasks, steps, or routine slots."},
  ]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);

  const taskList=tasks.filter(t=>!t.deleted).map(t=>({id:t.id,title:t.title,done:t.done}));
  const systemPrompt=`You are a task assistant for The Docket app. Respond with ONLY a JSON object, no other text.

JSON format: {"actions": [...], "reply": "short message"}

To add a task: {"type":"add_task","task":{"title":"TITLE","category":"study","priority":"medium","type":"milestone","date":"","time":"","recurring":"","notes":""}}
To complete a task: {"type":"complete_task","id": ID}
To delete a task: {"type":"remove_task","id": ID}

Categories: study, trading, business, career, health, admin, faith
Priorities: urgent, high, medium

Current tasks: ${JSON.stringify(taskList)}

If nothing to do: {"actions":[],"reply":"your message"}`;

  async function send(){
    if(!input.trim()||loading)return;
    const userMsg=input.trim();
    setInput("");
    const newMsgs=[...messages,{role:"user" as const,content:userMsg}];
    setMessages([...newMsgs,{role:"assistant" as const,content:"Working on it…"}]);
    setLoading(true);
    try{
      const res=await fetch("/api/ask",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({system:systemPrompt,messages:newMsgs.slice(-20)})});
      const data=await res.json();
      const raw=(data.content??data.reply??"{}").replace(/^```json\s*/i,"").replace(/^```/,"").replace(/```$/,"").trim();
      console.log("Groq raw response:", raw);
      let parsed:any={};
      try{ parsed=JSON.parse(raw); }catch(e){ console.error("JSON parse failed:",raw); }
      console.log("Parsed actions:", parsed.actions);
      // Handle both {actions:[...]} and flat {type:"add_task",...} responses
      let actions=[];
      if(Array.isArray(parsed.actions)&&parsed.actions.length>0){
        actions=parsed.actions;
      } else if(parsed.type){
        // Groq returned a single action object directly
        actions=[parsed];
      } else if(parsed.action&&parsed.action.type){
        // Groq wrapped it in an "action" key
        actions=[parsed.action];
      }
      console.log("Actions to apply:", actions);
      onAction(actions);
      setMessages([...newMsgs,{role:"assistant",content:parsed.reply??parsed.message??"Done."}]);
    }catch{
      setMessages([...newMsgs,{role:"assistant",content:"Something went wrong — try rephrasing."}]);
    }finally{setLoading(false);}
  }

  return(
    <>
      <button onClick={()=>setOpen(o=>!o)}
        style={{position:"fixed",bottom:28,right:92,width:52,height:52,
          borderRadius:"50%",background:C.accent,color:"white",border:"none",
          fontSize:20,fontWeight:700,cursor:"pointer",
          boxShadow:"0 10px 30px rgba(112,145,230,0.4)",zIndex:40}}>✦</button>
      {open&&(
        <div style={{position:"fixed",bottom:20,right:20,zIndex:60}}>
          <div style={{background:"white",borderRadius:18,width:380,height:560,
            boxShadow:"0 30px 80px rgba(35,42,77,0.3)",
            display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"16px 18px",borderBottom:`1px solid ${C.border}`}}>
              <div>
                <h3 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,
                  fontWeight:700,color:C.navy}}>Ask Docket</h3>
                <p style={{fontSize:10.5,color:C.muted,marginTop:2}}>Add, remove or change tasks</p>
              </div>
              <button onClick={()=>setOpen(false)}
                style={{background:"none",border:"none",fontSize:17,color:C.muted,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"14px 16px",
              display:"flex",flexDirection:"column",gap:9}}>
              {messages.map((m,i)=>(
                <div key={i} style={{maxWidth:"85%",padding:"9px 12px",borderRadius:12,
                  fontSize:12.5,lineHeight:1.45,
                  alignSelf:m.role==="user"?"flex-end":"flex-start",
                  background:m.role==="user"?C.navy:C.surface2,
                  color:m.role==="user"?"white":C.navy}}>
                  {m.content}
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,padding:12,borderTop:`1px solid ${C.border}`}}>
              <input value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&send()}
                placeholder="e.g. move Fajr to 4:20am"
                style={{flex:1,padding:"10px 12px",border:`1.5px solid ${C.border}`,
                  borderRadius:10,fontSize:12.5,background:C.surface2,
                  fontFamily:"inherit",outline:"none"}}/>
              <button onClick={send} disabled={loading}
                style={{background:C.navy,color:"white",border:"none",
                  padding:"0 16px",borderRadius:10,fontWeight:600,
                  fontSize:12.5,cursor:"pointer",opacity:loading?0.5:1}}>Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Home(){
  const[isDrawerOpen,setIsDrawerOpen]=useState(false);
  const[currentView,setCurrentView]=useState<View>("daily");
  const[isLoaded,setIsLoaded]=useState(false);
  const[taskFilter,setTaskFilter]=useState<Filter>("all");
  const[editingTask,setEditingTask]=useState<Task|null>(null);
  const[isAddingTask,setIsAddingTask]=useState(false);
  const[selectedWeekDay,setSelectedWeekDay]=useState(todayDayKey());
  const[tasks,setTasks]=useState<Task[]>([]);
  const[routines,setRoutines]=useState<Routine[]>([]);
  const[notifEnabled,setNotifEnabled]=useState(false);

  useEffect(()=>{
    const t=localStorage.getItem(STORAGE_TASKS);
    const r=localStorage.getItem(STORAGE_ROUTINES);
    setTasks(t?JSON.parse(t):defaultTasks());
    setRoutines(r?JSON.parse(r):defaultRoutines());
    setIsLoaded(true);
  },[]);
  useEffect(()=>{if(isLoaded)localStorage.setItem(STORAGE_TASKS,JSON.stringify(tasks));},[tasks,isLoaded]);
  useEffect(()=>{if(isLoaded)localStorage.setItem(STORAGE_ROUTINES,JSON.stringify(routines));},[routines,isLoaded]);

  const addTask=useCallback((data:Omit<Task,"id"|"done"|"deleted"|"checklist">)=>{
    setTasks(p=>[...p,{id:Date.now(),...data,done:false,deleted:false,checklist:[]}]);
  },[]);
  const updateTask=useCallback((id:number,changes:Partial<Task>)=>{
    setTasks(p=>p.map(t=>t.id===id?{...t,...changes}:t));
  },[]);
  const toggleTask=useCallback((id:number)=>{
    setTasks(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t));
  },[]);
  const deleteTask=useCallback((id:number)=>{
    setTasks(p=>p.map(t=>t.id===id?{...t,deleted:true}:t));
  },[]);
  const restoreTask=useCallback((id:number)=>{
    setTasks(p=>p.map(t=>t.id===id?{...t,deleted:false,done:false}:t));
  },[]);
  const addStep=useCallback((taskId:number,text:string)=>{
    setTasks(p=>p.map(t=>t.id!==taskId?t:{...t,checklist:[...t.checklist,{id:Date.now(),text,done:false}]}));
  },[]);
  const toggleStep=useCallback((taskId:number,stepId:number)=>{
    setTasks(p=>p.map(t=>t.id!==taskId?t:{...t,checklist:t.checklist.map(s=>s.id===stepId?{...s,done:!s.done}:s)}));
  },[]);
  const removeStep=useCallback((taskId:number,stepId:number)=>{
    setTasks(p=>p.map(t=>t.id!==taskId?t:{...t,checklist:t.checklist.filter(s=>s.id!==stepId)}));
  },[]);
  const toggleRoutineDate=useCallback((routineId:number,dateISO:string)=>{
    setRoutines(p=>p.map(r=>r.id!==routineId?r:{...r,completions:{...r.completions,[dateISO]:!r.completions?.[dateISO]}}));
  },[]);

  const handleAiActions=useCallback((actions:any[])=>{
    actions.forEach(a=>{
      if(a.type==="add_task")addTask({title:a.task?.title??"Untitled",category:a.task?.category??"study",priority:a.task?.priority??"medium",type:a.task?.type??"milestone",date:a.task?.date??"",time:a.task?.time??"",recurring:a.task?.recurring??"",notes:a.task?.notes??""});
      else if(a.type==="remove_task")deleteTask(a.id);
      else if(a.type==="update_task")updateTask(a.id,a.changes??{});
      else if(a.type==="complete_task")updateTask(a.id,{done:true});
      else if(a.type==="reopen_task")updateTask(a.id,{done:false,deleted:false});
      else if(a.type==="add_step")addStep(a.task_id,a.text??"Step");
      else if(a.type==="toggle_step")toggleStep(a.task_id,a.step_id);
      else if(a.type==="remove_step")removeStep(a.task_id,a.step_id);
    });
  },[addTask,deleteTask,updateTask,addStep,toggleStep,removeStep]);

  async function toggleNotifications(){
    if(typeof Notification==="undefined"){alert("Not available here — try opening in a real browser tab.");return;}
    if(notifEnabled){setNotifEnabled(false);return;}
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){alert("Permission not granted.");return;}
    setNotifEnabled(true);
    new Notification("The Docket",{body:"Notifications are on!"});
  }

  // Computed
  const filteredTasks=(()=>{
    const base=taskFilter==="done"?tasks.filter(t=>t.done||t.deleted):tasks.filter(t=>!t.done&&!t.deleted);
    if(taskFilter==="done"||taskFilter==="all")return base;
    if(taskFilter==="ongoing"||taskFilter==="milestone")return base.filter(t=>t.type===taskFilter);
    return base.filter(t=>t.category===taskFilter);
  })();
  const sortedTasks=[...filteredTasks].sort((a,b)=>{
    const da=a.date?new Date(a.date).getTime():9e14;
    const db=b.date?new Date(b.date).getTime():9e14;
    return da-db;
  });

  const weekDates=(()=>{
    const now=new Date();
    const dayIdx=(now.getDay()+6)%7;
    const monday=new Date(now);monday.setDate(now.getDate()-dayIdx);
    return DAYS.map((key,i)=>{
      const d=new Date(monday);d.setDate(monday.getDate()+i);
      return{key,date:d.toISOString().slice(0,10),dayNum:d.getDate(),
        label:d.toLocaleDateString("en-GB",{day:"numeric",month:"short"})};
    });
  })();

  function getDayItems(dateISO:string,dayKey:string){
    const items:{time:string;label:string;category:string;done:boolean;streak:number;conflict:boolean;routineId?:number;taskId?:number}[]=[];
    routines.filter(r=>(r.days??[]).includes(dayKey)).forEach(r=>{
      const highOnDay=routines.filter(r2=>r2.id!==r.id&&r2.intensity==="high"&&(r2.days??[]).includes(dayKey));
      items.push({time:r.time??"",label:r.label,category:r.category,
        done:!!r.completions?.[dateISO],streak:computeStreak(r),
        conflict:r.intensity==="high"&&highOnDay.length>0,routineId:r.id});
    });
    tasks.filter(t=>!t.deleted&&t.date===dateISO).forEach(t=>{
      items.push({time:t.time??"",label:t.title,category:t.category,
        done:t.done,streak:0,conflict:false,taskId:t.id});
    });
    return items.sort((a,b)=>(a.time||"zz").localeCompare(b.time||"zz"));
  }

  const todayItems=getDayItems(todayISO(),todayDayKey());
  const selDay=weekDates.find(d=>d.key===selectedWeekDay);
  const selectedDayItems=getDayItems(selDay?.date??todayISO(),selectedWeekDay);

  const examTask=tasks.find(t=>!t.deleted&&t.title.toLowerCase().includes("land law"));
  const interviewTask=tasks.find(t=>!t.deleted&&t.title.toLowerCase().includes("cheshire oak"));

  return(
    <div style={{minHeight:"100vh",background:C.bg,position:"relative",
      fontFamily:"'Inter',sans-serif",color:C.navy}}>

      {/* Blobs */}
      <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
        <div className="blob blob-1"/><div className="blob blob-2"/>
        <div className="blob blob-3"/><div className="blob blob-4"/>
      </div>

      <Drawer isOpen={isDrawerOpen} onClose={()=>setIsDrawerOpen(false)}
        currentView={currentView} setView={setCurrentView}/>

      {/* Nav */}
      <nav style={{position:"relative",zIndex:10,display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:"20px 20px 12px"}}>
        <button onClick={()=>setIsDrawerOpen(true)}
          style={{width:44,height:44,borderRadius:12,background:"white",
            border:`1px solid ${C.border}`,boxShadow:"0 6px 18px rgba(35,42,77,0.1)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:18,color:C.navy,cursor:"pointer"}}>☰</button>
        <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
          fontSize:17,color:C.navy}}>The Docket</span>
        <button onClick={toggleNotifications}
          style={{width:44,height:44,borderRadius:12,
            border:`1px solid ${notifEnabled?C.sage:C.border}`,
            background:notifEnabled?C.sage:"white",
            boxShadow:"0 6px 18px rgba(35,42,77,0.1)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:17,cursor:"pointer"}}>
          {notifEnabled?"🔔":"🔕"}
        </button>
      </nav>

      {/* Content */}
      <main style={{position:"relative",zIndex:10,maxWidth:1100,margin:"0 auto",padding:"0 20px 100px"}}>

        {/* Countdown chips */}
        {(examTask||interviewTask)&&(
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
            {examTask&&(
              <div style={{background:"white",border:`1px solid ${C.border}`,borderRadius:12,
                padding:"10px 15px",display:"flex",alignItems:"center",gap:9}}>
                <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:17,
                  color:(daysUntil(examTask.date)??1)<0?C.urgent:C.primary}}>
                  {daysUntil(examTask.date)===null?"—":daysUntil(examTask.date)===0?"Today":`${daysUntil(examTask.date)}d`}
                </span>
                <span style={{fontSize:11,color:C.muted,fontWeight:500}}>Land Law exam</span>
              </div>
            )}
            {interviewTask&&(
              <div style={{background:"white",border:`1px solid ${C.border}`,borderRadius:12,
                padding:"10px 15px",display:"flex",alignItems:"center",gap:9}}>
                <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:17,
                  color:(daysUntil(interviewTask.date)??1)<0?C.urgent:C.primary}}>
                  {daysUntil(interviewTask.date)===null?"—":daysUntil(interviewTask.date)===0?"Today":`${daysUntil(interviewTask.date)}d`}
                </span>
                <span style={{fontSize:11,color:C.muted,fontWeight:500}}>Cheshire Oak</span>
              </div>
            )}
          </div>
        )}

        {/* ── DAILY ─────────────────────────────────────────────────────── */}
        {currentView==="daily"&&(
          <div>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
              fontSize:26,color:C.navy,marginBottom:4}}>Daily Routine</p>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,
              color:C.muted,marginBottom:20}}>
              {new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            </p>
            <div style={{background:"#E4E9F9",color:C.primary,fontSize:12,
              padding:"11px 15px",borderRadius:10,marginBottom:16,lineHeight:1.5}}>
              ⚠ Prayer times are placeholders — update them to match your local timetable.
            </div>
            {/* Overdue + ongoing chips */}
            {(()=>{
              const ov=tasks.filter(t=>!t.done&&!t.deleted&&t.date&&(daysUntil(t.date)??0)<0);
              const og=tasks.filter(t=>t.type==="ongoing"&&!t.done&&!t.deleted);
              return(ov.length||og.length)?(<div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:16}}>
                {ov.map(t=><span key={t.id} style={{fontSize:11.5,fontWeight:600,
                  padding:"6px 11px",borderRadius:20,background:C.urgentSoft,color:C.urgent}}>
                  ⚠ {t.title}</span>)}
                {og.slice(0,4).map(t=><span key={t.id} style={{fontSize:11.5,fontWeight:600,
                  padding:"6px 11px",borderRadius:20,background:"#E4E9F9",color:C.primary}}>
                  ◆ {t.title}</span>)}
              </div>):null;
            })()}
            <div style={{background:"white",border:`1px solid ${C.border}`,
              borderRadius:14,padding:"4px 20px"}}>
              {todayItems.length?todayItems.map((it,i)=>(
                <TimelineRow key={i} item={it} onCheck={()=>{
                  if(it.routineId)toggleRoutineDate(it.routineId,todayISO());
                  else if(it.taskId)toggleTask(it.taskId);
                }}/>
              )):<p style={{textAlign:"center",color:C.muted2,padding:"40px 0",
                fontFamily:"'Space Grotesk',sans-serif",fontWeight:600}}>Nothing scheduled today.</p>}
            </div>
          </div>
        )}

        {/* ── ALL TASKS ──────────────────────────────────────────────────── */}
        {currentView==="all"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"center",marginBottom:20}}>
              <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
                fontSize:26,color:C.navy}}>All Tasks</p>
              <button onClick={()=>setIsAddingTask(true)}
                style={{background:C.navy,color:"white",fontSize:13,fontWeight:600,
                  padding:"11px 20px",borderRadius:10,border:"none",cursor:"pointer"}}>
                + New Task
              </button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:22}}>
              <TaskSidebar tasks={tasks} filter={taskFilter} setFilter={setTaskFilter}/>
              <div>
                {sortedTasks.length?sortedTasks.map(t=>(
                  <TaskCard key={t.id} task={t}
                    onToggle={()=>toggleTask(t.id)}
                    onDelete={()=>deleteTask(t.id)}
                    onEdit={()=>setEditingTask(t)}
                    onAddStep={text=>addStep(t.id,text)}
                    onToggleStep={sid=>toggleStep(t.id,sid)}
                    onRemoveStep={sid=>removeStep(t.id,sid)}
                    isArchive={taskFilter==="done"}
                    onRestore={()=>restoreTask(t.id)}/>
                )):<p style={{textAlign:"center",color:C.muted2,padding:"48px 0",
                  fontFamily:"'Space Grotesk',sans-serif",fontWeight:600}}>Nothing here.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── WEEK ──────────────────────────────────────────────────────── */}
        {currentView==="week"&&(
          <div>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
              fontSize:26,color:C.navy,marginBottom:20}}>Week View</p>
            {/* Day chips */}
            <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:20}}>
              {weekDates.map(day=>{
                const highOnDay=routines.filter(r=>r.intensity==="high"&&(r.days??[]).includes(day.key));
                const hasConflict=highOnDay.length>1;
                const active=selectedWeekDay===day.key;
                const isToday=day.key===todayDayKey();
                return(
                  <button key={day.key} onClick={()=>setSelectedWeekDay(day.key)}
                    style={{position:"relative",flexShrink:0,width:58,paddingTop:10,paddingBottom:10,
                      borderRadius:12,textAlign:"center",cursor:"pointer",
                      border:`1.5px solid ${active?C.navy:isToday?C.primary:C.border}`,
                      background:active?C.navy:"white"}}>
                    <p style={{fontSize:10.5,fontWeight:700,textTransform:"uppercase",
                      letterSpacing:0.5,color:active?"white":C.muted}}>
                      {DAY_LABELS[day.key].slice(0,3)}
                    </p>
                    <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
                      fontSize:17,marginTop:2,color:active?"white":C.navy}}>{day.dayNum}</p>
                    {hasConflict&&<span style={{position:"absolute",top:6,right:8,
                      width:6,height:6,borderRadius:"50%",background:C.urgent}}/>}
                  </button>
                );
              })}
            </div>
            {/* Day detail */}
            <div style={{background:"white",border:`1px solid ${C.border}`,
              borderRadius:14,padding:"18px 20px"}}>
              <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
                fontSize:18,color:C.navy,marginBottom:12}}>
                {DAY_LABELS[selectedWeekDay]}{" "}
                <span style={{fontSize:14,color:C.muted,fontWeight:400,fontFamily:"inherit"}}>
                  {selDay?.label}
                </span>
              </p>
              {selectedDayItems.length?selectedDayItems.map((it,i)=>(
                <TimelineRow key={i} item={it} onCheck={()=>{
                  const dayDate=selDay?.date??todayISO();
                  if(it.routineId)toggleRoutineDate(it.routineId,dayDate);
                  else if(it.taskId)toggleTask(it.taskId);
                }}/>
              )):<p style={{textAlign:"center",color:C.muted2,padding:"32px 0",
                fontFamily:"'Space Grotesk',sans-serif",fontWeight:600}}>Nothing scheduled.</p>}
            </div>
          </div>
        )}

        {/* ── ARCHIVE ────────────────────────────────────────────────────── */}
        {currentView==="archive"&&(
          <div>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
              fontSize:26,color:C.navy,marginBottom:20}}>Finished &amp; Deleted</p>
            {tasks.filter(t=>t.done||t.deleted).length===0
              ?<p style={{textAlign:"center",color:C.muted2,padding:"48px 0",
                  fontFamily:"'Space Grotesk',sans-serif",fontWeight:600}}>No archived tasks yet.</p>
              :tasks.filter(t=>t.done||t.deleted).map(t=>(
                <TaskCard key={t.id} task={t}
                  onToggle={()=>toggleTask(t.id)} onDelete={()=>deleteTask(t.id)}
                  onEdit={()=>{}} onAddStep={()=>{}} onToggleStep={()=>{}} onRemoveStep={()=>{}}
                  isArchive onRestore={()=>restoreTask(t.id)}/>
              ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <button onClick={()=>setIsAddingTask(true)}
        style={{position:"fixed",bottom:28,right:28,width:52,height:52,
          borderRadius:"50%",background:C.navy,color:"white",border:"none",
          fontSize:24,cursor:"pointer",
          boxShadow:"0 10px 30px rgba(35,42,77,0.35)",zIndex:40}}>+</button>

      <Chatbot tasks={tasks} routines={routines} onAction={handleAiActions}/>

      {isAddingTask&&<TaskModal onClose={()=>setIsAddingTask(false)} onSave={addTask}/>}
      {editingTask&&<TaskModal initial={editingTask} onClose={()=>setEditingTask(null)}
        onSave={data=>{updateTask(editingTask.id,data);setEditingTask(null);}}/>}
    </div>
  );
}