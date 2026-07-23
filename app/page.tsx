"use client";
import React, { useState, useEffect, useCallback, createContext, useContext } from "react";

type Category = "study"|"legal"|"trading"|"finance"|"business"|"career"|"health"|"driving"|"admin"|"property"|"content"|"personal"|"family"|"faith"|"fitness"|"nutrition"|"mental"|"travel"|"technology"|"creative"|"social"|"volunteering"|"language"|"reading"|"music"|"sports"|"cooking"|"shopping"|"events"|"medical"|"insurance"|"tax"|"debt"|"savings"|"investment"|"side_hustle"|"networking"|"interview"|"project"|"research"|"writing"|"design"|"marketing"|"sales"|"customer"|"hr"|"legal_work"|"compliance"|"environment"|"community"|"charity"|"education"|"childcare"|"pets"|"home"|"vehicle"|"utilities"|"subscriptions"|"other";
type Priority = "urgent"|"high"|"medium";
type TaskType = "milestone"|"ongoing";
type View = "daily"|"all"|"week"|"archive";
type Filter = "all"|"ongoing"|"milestone"|"done"|Category;
type Lang = "en"|"ar"|"fr"|"tr"|"ur";

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

// ── Translations ──────────────────────────────────────────────────────────────
const T:Record<Lang,Record<string,string>> = {
  en:{
    appName:"The Docket", daily:"Daily Routine", allTasks:"All Tasks",
    week:"Week", archive:"Finished & Deleted", settings:"Settings",
    newTask:"New Task", save:"Save Task", cancel:"Cancel", addStep:"Add",
    prayerSetting:"Accurate prayer times",
    prayerDesc:"Uses your location to fetch real prayer times",
    prayerLoading:"📍 Fetching your location…",
    prayerDone:"✓ Prayer times updated for today",
    prayerError:"⚠ Could not get location — check browser permissions",
    notifSetting:"Notifications",
    notifDesc:"Browser alerts when a scheduled item is due",
    darkMode:"Dark mode",
    darkDesc:"Switch to a dark colour scheme",
    language:"Language",
    languageDesc:"Change the app display language",
    nothingToday:"Nothing scheduled today.",
    nothingHere:"Nothing here.",
    allOpen:"All Open", ongoing:"Ongoing", completable:"Completable",
    category:"Category", show:"Show", overdue:"OVERDUE",
    urgent:"urgent", high:"high", medium:"medium",
    chatPlaceholder:"e.g. add a task to revise Land Law",
    chatWelcome:"Tell me what to add, remove, or change — I'll ask questions to get it right.",
    send:"Send", working:"Working on it…",
    steps:"Steps", taskTitle:"Task", notes:"Notes",
    dueDate:"Due / target date", nature:"Nature", recurring:"Recurring",
    oneOff:"One-off", daily2:"Daily", weekly:"Weekly",
    milestone:"Completable", ongoing2:"Ongoing",
    finishedDeleted:"Finished & Deleted", restore:"↺",
    landLawExam:"Land Law exam", cheshireOak:"Cheshire Oak",
    ongoingProjects:"Ongoing projects", completableOpen:"Completable, still open",
    prayerPlaceholder:"⚠ Prayer times are placeholders — enable accurate times in Settings ⚙️",
    weekView:"Week View",
  },
  ar:{
    appName:"الدفتر", daily:"الروتين اليومي", allTasks:"جميع المهام",
    week:"الأسبوع", archive:"المنجزة والمحذوفة", settings:"الإعدادات",
    newTask:"مهمة جديدة", save:"حفظ", cancel:"إلغاء", addStep:"إضافة",
    prayerSetting:"أوقات الصلاة الدقيقة",
    prayerDesc:"يستخدم موقعك لجلب أوقات الصلاة الحقيقية",
    prayerLoading:"📍 جاري تحديد موقعك…",
    prayerDone:"✓ تم تحديث أوقات الصلاة لهذا اليوم",
    prayerError:"⚠ تعذّر الحصول على الموقع — تحقق من إذن الموقع",
    notifSetting:"الإشعارات",
    notifDesc:"تنبيهات المتصفح عند موعد عنصر مجدول",
    darkMode:"الوضع الداكن",
    darkDesc:"التبديل إلى نظام ألوان داكن",
    language:"اللغة",
    languageDesc:"تغيير لغة العرض",
    nothingToday:"لا شيء مجدول اليوم.",
    nothingHere:"لا يوجد شيء هنا.",
    allOpen:"الكل المفتوح", ongoing:"جارٍ", completable:"قابل للإنجاز",
    category:"الفئة", show:"عرض", overdue:"متأخر",
    urgent:"عاجل", high:"مرتفع", medium:"متوسط",
    chatPlaceholder:"مثال: أضف مهمة لمراجعة القانون",
    chatWelcome:"أخبرني بما تريد إضافته أو تغييره — سأسألك لأفهم أكثر.",
    send:"إرسال", working:"جاري المعالجة…",
    steps:"الخطوات", taskTitle:"المهمة", notes:"ملاحظات",
    dueDate:"تاريخ الاستحقاق", nature:"الطبيعة", recurring:"متكرر",
    oneOff:"مرة واحدة", daily2:"يومياً", weekly:"أسبوعياً",
    milestone:"قابل للإنجاز", ongoing2:"مستمر",
    finishedDeleted:"المنجزة والمحذوفة", restore:"↺",
    landLawExam:"امتحان قانون الأراضي", cheshireOak:"مقابلة تشيشاير أوك",
    ongoingProjects:"مشاريع جارية", completableOpen:"مهام قابلة للإنجاز",
    prayerPlaceholder:"⚠ أوقات الصلاة تقريبية — فعّل الأوقات الدقيقة من الإعدادات ⚙️",
    weekView:"عرض الأسبوع",
  },
  fr:{
    appName:"The Docket", daily:"Routine Quotidienne", allTasks:"Toutes les Tâches",
    week:"Semaine", archive:"Terminées & Supprimées", settings:"Paramètres",
    newTask:"Nouvelle Tâche", save:"Enregistrer", cancel:"Annuler", addStep:"Ajouter",
    prayerSetting:"Heures de prière précises",
    prayerDesc:"Utilise votre position pour les heures de prière",
    prayerLoading:"📍 Localisation en cours…",
    prayerDone:"✓ Heures de prière mises à jour",
    prayerError:"⚠ Impossible d'obtenir la localisation",
    notifSetting:"Notifications",
    notifDesc:"Alertes navigateur pour les éléments planifiés",
    darkMode:"Mode sombre",
    darkDesc:"Passer à un thème sombre",
    language:"Langue",
    languageDesc:"Changer la langue d'affichage",
    nothingToday:"Rien de planifié aujourd'hui.",
    nothingHere:"Rien ici.",
    allOpen:"Tout ouvert", ongoing:"En cours", completable:"Réalisable",
    category:"Catégorie", show:"Afficher", overdue:"EN RETARD",
    urgent:"urgent", high:"élevé", medium:"moyen",
    chatPlaceholder:"ex. ajouter une tâche pour réviser",
    chatWelcome:"Dites-moi ce que vous voulez ajouter ou modifier.",
    send:"Envoyer", working:"En cours…",
    steps:"Étapes", taskTitle:"Tâche", notes:"Notes",
    dueDate:"Date limite", nature:"Nature", recurring:"Récurrent",
    oneOff:"Ponctuel", daily2:"Quotidien", weekly:"Hebdomadaire",
    milestone:"Réalisable", ongoing2:"Continu",
    finishedDeleted:"Terminées & Supprimées", restore:"↺",
    landLawExam:"Examen droit foncier", cheshireOak:"Entretien Cheshire Oak",
    ongoingProjects:"Projets en cours", completableOpen:"Tâches réalisables",
    prayerPlaceholder:"⚠ Heures de prière approximatives — activez-les dans Paramètres ⚙️",
    weekView:"Vue Semaine",
  },
  tr:{
    appName:"The Docket", daily:"Günlük Rutin", allTasks:"Tüm Görevler",
    week:"Hafta", archive:"Tamamlanan & Silinenler", settings:"Ayarlar",
    newTask:"Yeni Görev", save:"Kaydet", cancel:"İptal", addStep:"Ekle",
    prayerSetting:"Doğru namaz vakitleri",
    prayerDesc:"Gerçek namaz vakitleri için konumunuzu kullanır",
    prayerLoading:"📍 Konumunuz alınıyor…",
    prayerDone:"✓ Namaz vakitleri güncellendi",
    prayerError:"⚠ Konum alınamadı — izinleri kontrol edin",
    notifSetting:"Bildirimler",
    notifDesc:"Zamanlanmış öğeler için tarayıcı uyarıları",
    darkMode:"Karanlık mod",
    darkDesc:"Koyu renk şemasına geç",
    language:"Dil",
    languageDesc:"Uygulama dilini değiştir",
    nothingToday:"Bugün planlanmış bir şey yok.",
    nothingHere:"Burada bir şey yok.",
    allOpen:"Tümü Açık", ongoing:"Devam Eden", completable:"Tamamlanabilir",
    category:"Kategori", show:"Göster", overdue:"GECİKMİŞ",
    urgent:"acil", high:"yüksek", medium:"orta",
    chatPlaceholder:"örn. revizyon için görev ekle",
    chatWelcome:"Ne eklemek veya değiştirmek istediğinizi söyleyin.",
    send:"Gönder", working:"İşleniyor…",
    steps:"Adımlar", taskTitle:"Görev", notes:"Notlar",
    dueDate:"Son tarih", nature:"Tür", recurring:"Tekrar",
    oneOff:"Tek seferlik", daily2:"Günlük", weekly:"Haftalık",
    milestone:"Tamamlanabilir", ongoing2:"Süregelen",
    finishedDeleted:"Tamamlanan & Silinenler", restore:"↺",
    landLawExam:"Arazi Hukuku sınavı", cheshireOak:"Cheshire Oak görüşmesi",
    ongoingProjects:"Devam eden projeler", completableOpen:"Tamamlanabilir görevler",
    prayerPlaceholder:"⚠ Namaz vakitleri tahmini — Ayarlar'dan doğru vakitleri etkinleştirin ⚙️",
    weekView:"Haftalık Görünüm",
  },
  ur:{
    appName:"The Docket", daily:"روزانہ معمول", allTasks:"تمام کام",
    week:"ہفتہ", archive:"مکمل اور حذف", settings:"ترتیبات",
    newTask:"نیا کام", save:"محفوظ", cancel:"منسوخ", addStep:"شامل",
    prayerSetting:"درست اوقات نماز",
    prayerDesc:"آپ کے مقام سے نماز کے اوقات لیتا ہے",
    prayerLoading:"📍 مقام حاصل ہو رہا ہے…",
    prayerDone:"✓ نماز کے اوقات آج کے لیے اپ ڈیٹ ہو گئے",
    prayerError:"⚠ مقام نہیں مل سکا — اجازت چیک کریں",
    notifSetting:"اطلاعات",
    notifDesc:"مقررہ وقت پر براؤزر الرٹ",
    darkMode:"تاریک موڈ",
    darkDesc:"تاریک رنگ سکیم پر جائیں",
    language:"زبان",
    languageDesc:"ایپ کی زبان تبدیل کریں",
    nothingToday:"آج کچھ شیڈول نہیں۔",
    nothingHere:"یہاں کچھ نہیں۔",
    allOpen:"سب کھلے", ongoing:"جاری", completable:"مکمل ہونے والا",
    category:"زمرہ", show:"دکھائیں", overdue:"تاخیر",
    urgent:"فوری", high:"اہم", medium:"معمولی",
    chatPlaceholder:"مثال: نظر ثانی کے لیے کام شامل کریں",
    chatWelcome:"بتائیں کیا شامل یا تبدیل کرنا ہے۔",
    send:"بھیجیں", working:"کام جاری…",
    steps:"مراحل", taskTitle:"کام", notes:"نوٹس",
    dueDate:"آخری تاریخ", nature:"نوعیت", recurring:"دہرائیں",
    oneOff:"ایک بار", daily2:"روزانہ", weekly:"ہفتہ وار",
    milestone:"مکمل ہونے والا", ongoing2:"جاری",
    finishedDeleted:"مکمل اور حذف", restore:"↺",
    landLawExam:"لینڈ لاء امتحان", cheshireOak:"چیشائر اوک انٹرویو",
    ongoingProjects:"جاری منصوبے", completableOpen:"مکمل ہونے والے کام",
    prayerPlaceholder:"⚠ اوقات نماز تخمینی ہیں — ترتیبات میں درست اوقات فعال کریں ⚙️",
    weekView:"ہفتہ وار نظارہ",
  },
};

const LANG_LABELS:Record<Lang,string> = {
  en:"English", ar:"العربية", fr:"Français", tr:"Türkçe", ur:"اردو"
};
const RTL_LANGS:Lang[] = ["ar","ur"];

// ── Theme colours (light + dark) ──────────────────────────────────────────────
function getC(dark:boolean){
  return dark ? {
    navy:"#E8EAF6", primary:"#7C9CE8", accent:"#7091E6",
    accent2:"#8697C4", border:"#2a2d3e", muted:"#9099b8",
    muted2:"#5a6080", urgent:"#E87070", urgentSoft:"#3a1f1f",
    sage:"#5DBB8A", sageSoft:"#1a2e24", surface:"#1a1c2a",
    surface2:"#13141f", bg:"#0f1019",
  } : {
    navy:"#232A4D", primary:"#3D52A0", accent:"#7091E6",
    accent2:"#8697C4", border:"#DCD9EE", muted:"#6b7094",
    muted2:"#9a9dbb", urgent:"#C0503C", urgentSoft:"#F4DFDA",
    sage:"#3E7C5D", sageSoft:"#DCEEE3", surface:"#FFFFFF",
    surface2:"#F6F4FB", bg:"#EDE8F5",
  };
}

// ── App context for theme + language ─────────────────────────────────────────
const AppCtx = createContext<{dark:boolean;lang:Lang;t:(k:string)=>string;dir:"ltr"|"rtl"}>({
  dark:false, lang:"en", t:(k)=>k, dir:"ltr"
});
function useApp(){ return useContext(AppCtx); }

const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_LABELS:Record<string,string> = {
  mon:"Monday",tue:"Tuesday",wed:"Wednesday",thu:"Thursday",
  fri:"Friday",sat:"Saturday",sun:"Sunday",
};
const DAY_LABELS_LANG:Record<Lang,Record<string,string>> = {
  en:DAY_LABELS,
  ar:{mon:"الاثنين",tue:"الثلاثاء",wed:"الأربعاء",thu:"الخميس",fri:"الجمعة",sat:"السبت",sun:"الأحد"},
  fr:{mon:"Lundi",tue:"Mardi",wed:"Mercredi",thu:"Jeudi",fri:"Vendredi",sat:"Samedi",sun:"Dimanche"},
  tr:{mon:"Pazartesi",tue:"Salı",wed:"Çarşamba",thu:"Perşembe",fri:"Cuma",sat:"Cumartesi",sun:"Pazar"},
  ur:{mon:"پیر",tue:"منگل",wed:"بدھ",thu:"جمعرات",fri:"جمعہ",sat:"ہفتہ",sun:"اتوار"},
};
const CATS:Record<string,{label:string}> = {
  // Life & Wellbeing
  health:      {label:"Health & Fitness"},
  fitness:     {label:"Fitness & Exercise"},
  nutrition:   {label:"Nutrition & Diet"},
  mental:      {label:"Mental Health"},
  medical:     {label:"Medical & Appointments"},
  // Faith & Personal
  faith:       {label:"Faith & Spirituality"},
  personal:    {label:"Personal Development"},
  reading:     {label:"Reading & Books"},
  music:       {label:"Music"},
  creative:    {label:"Creative & Arts"},
  language:    {label:"Language Learning"},
  // Study & Knowledge
  study:       {label:"Study"},
  research:    {label:"Research"},
  writing:     {label:"Writing"},
  education:   {label:"Education"},
  // Career & Work
  career:      {label:"Career"},
  interview:   {label:"Interviews & Applications"},
  networking:  {label:"Networking"},
  project:     {label:"Projects"},
  hr:          {label:"HR & People"},
  // Business
  business:    {label:"Business"},
  side_hustle: {label:"Side Hustle"},
  marketing:   {label:"Marketing"},
  sales:       {label:"Sales"},
  design:      {label:"Design"},
  content:     {label:"Content Creation"},
  customer:    {label:"Customer Service"},
  // Finance
  finance:     {label:"Finance"},
  trading:     {label:"Trading & Investing"},
  savings:     {label:"Savings & Goals"},
  investment:  {label:"Investments"},
  debt:        {label:"Debt & Loans"},
  tax:         {label:"Tax & Accounting"},
  insurance:   {label:"Insurance"},
  subscriptions:{label:"Subscriptions"},
  // Legal
  legal:       {label:"Legal"},
  legal_work:  {label:"Legal Work"},
  compliance:  {label:"Compliance"},
  // Home & Life Admin
  admin:       {label:"Admin & Housing"},
  home:        {label:"Home & DIY"},
  property:    {label:"Property"},
  utilities:   {label:"Utilities & Bills"},
  vehicle:     {label:"Vehicle & Transport"},
  driving:     {label:"Driving"},
  shopping:    {label:"Shopping & Errands"},
  // Family & Social
  family:      {label:"Family"},
  childcare:   {label:"Childcare"},
  pets:        {label:"Pets"},
  social:      {label:"Social Life"},
  events:      {label:"Events & Occasions"},
  // Technology
  technology:  {label:"Technology & Tech"},
  // Travel
  travel:      {label:"Travel & Holidays"},
  // Community
  volunteering:{label:"Volunteering"},
  charity:     {label:"Charity & Giving"},
  community:   {label:"Community"},
  environment: {label:"Environment"},
  // Sports
  sports:      {label:"Sports"},
  cooking:     {label:"Cooking & Recipes"},
  // Other
  other:       {label:"Other"},
};

const CAT_STYLES:Record<string,{bg:string;color:string}> = {
  health:      {bg:"#E4E9F9",color:"#3D52A0"},
  fitness:     {bg:"#DCE8FA",color:"#2a4a8a"},
  nutrition:   {bg:"#E0F5DC",color:"#2d7a25"},
  mental:      {bg:"#F0E8FA",color:"#6a3a9a"},
  medical:     {bg:"#FAE8E8",color:"#9a2a2a"},
  faith:       {bg:"#DCF0E6",color:"#1f7a52"},
  personal:    {bg:"#E0EEF5",color:"#2f5f8a"},
  reading:     {bg:"#FFF8DC",color:"#8a6a10"},
  music:       {bg:"#F5E0FA",color:"#8a2a9a"},
  creative:    {bg:"#FFE4F0",color:"#a53070"},
  language:    {bg:"#E4FAF5",color:"#1a7a6a"},
  study:       {bg:"#ECE9FA",color:"#5a4fae"},
  research:    {bg:"#E8E4FA",color:"#4a3a9e"},
  writing:     {bg:"#FAF0E4",color:"#8a5a1a"},
  education:   {bg:"#E4ECFA",color:"#2a3a9e"},
  career:      {bg:"#F4DFDA",color:"#a5382f"},
  interview:   {bg:"#FAE0DC",color:"#9a2f25"},
  networking:  {bg:"#FAE8DC",color:"#9a4a1a"},
  project:     {bg:"#DCEAF4",color:"#2a5a8a"},
  hr:          {bg:"#F5DCFA",color:"#8a2a9a"},
  business:    {bg:"#F6E9D3",color:"#9c6a1f"},
  side_hustle: {bg:"#FAF0DC",color:"#8a6a10"},
  marketing:   {bg:"#FAE4DC",color:"#9a3a1a"},
  sales:       {bg:"#FAEADC",color:"#9a5a1a"},
  design:      {bg:"#FFE8F5",color:"#9a2070"},
  content:     {bg:"#FFE4F0",color:"#a53070"},
  customer:    {bg:"#DCFAF0",color:"#1a8a5a"},
  finance:     {bg:"#D6EEE0",color:"#1f6b45"},
  trading:     {bg:"#DCEEE3",color:"#2f6b4f"},
  savings:     {bg:"#DCF0DC",color:"#2a7a2a"},
  investment:  {bg:"#D8EED8",color:"#257a25"},
  debt:        {bg:"#FAE0E0",color:"#9a2a2a"},
  tax:         {bg:"#F5E8DC",color:"#8a5a1a"},
  insurance:   {bg:"#DCF0FA",color:"#1a5a8a"},
  subscriptions:{bg:"#F0DCFA",color:"#7a1a9a"},
  legal:       {bg:"#EDE0F5",color:"#7a3a9e"},
  legal_work:  {bg:"#E8DCF5",color:"#6a2a9e"},
  compliance:  {bg:"#F5E0E0",color:"#9a2a3a"},
  admin:       {bg:"#DCEEF0",color:"#3d7a8a"},
  home:        {bg:"#E8F0DC",color:"#4a6a2a"},
  property:    {bg:"#E8F0E0",color:"#4a6e2f"},
  utilities:   {bg:"#DCF0F5",color:"#1a6a7a"},
  vehicle:     {bg:"#F5F0DC",color:"#7a6a1a"},
  driving:     {bg:"#FFF0D9",color:"#9c6010"},
  shopping:    {bg:"#FAE8F5",color:"#9a2a7a"},
  family:      {bg:"#FFF0E4",color:"#9c5030"},
  childcare:   {bg:"#FAF0E8",color:"#9a5a2a"},
  pets:        {bg:"#F0FAE4",color:"#5a8a2a"},
  social:      {bg:"#FAE8EC",color:"#9a2a4a"},
  events:      {bg:"#F5E0FA",color:"#8a1a9a"},
  technology:  {bg:"#DCE8F5",color:"#2a4a8a"},
  travel:      {bg:"#DCF5FA",color:"#1a6a7a"},
  volunteering:{bg:"#E4FAE8",color:"#2a8a3a"},
  charity:     {bg:"#FAE4E8",color:"#9a2a3a"},
  community:   {bg:"#E8FAE4",color:"#3a8a2a"},
  environment: {bg:"#DCF5DC",color:"#2a7a2a"},
  sports:      {bg:"#DCE4FA",color:"#2a3a9a"},
  cooking:     {bg:"#FAF0DC",color:"#9a6a1a"},
  other:       {bg:"#F0F0F0",color:"#6a6a6a"},
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
  const{dark}=useApp();
  const C=getC(dark);
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
  const{dark}=useApp();
  const C=getC(dark);
  return(
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(35,42,77,0.35)",
        backdropFilter:"blur(2px)",display:"flex",alignItems:"center",
        justifyContent:"center",zIndex:50,padding:20}}>
      <div style={{background:C.surface,borderRadius:18,padding:28,width:"100%",
        maxWidth:440,boxShadow:"0 30px 80px rgba(35,42,77,0.25)",
        maxHeight:"90vh",overflowY:"auto"}}>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({children}:{children:React.ReactNode}){
  const{dark}=useApp();
  const C=getC(dark);
  return<label style={{display:"block",fontSize:11,fontWeight:600,
    color:C.muted,marginBottom:6,letterSpacing:0.3}}>{children}</label>;
}
function useInputStyle():React.CSSProperties{
  const{dark}=useApp();
  const C=getC(dark);
  return{width:"100%",padding:"10px 12px",
    border:`1.5px solid ${C.border}`,borderRadius:9,fontSize:13,
    background:C.surface2,color:C.navy,outline:"none",fontFamily:"inherit"};
}

// ── Searchable Category Picker ────────────────────────────────────────────────
function CategoryPicker({value,onChange}:{value:string;onChange:(v:Category)=>void}){
  const{dark}=useApp();
  const C=getC(dark);
  const inputStyle=useInputStyle();
  const[search,setSearch]=useState("");
  const[open,setOpen]=useState(false);
  const filtered=Object.entries(CATS).filter(([,v])=>
    v.label.toLowerCase().includes(search.toLowerCase())
  );
  const selected=CATS[value];
  const s=CAT_STYLES[value]??{bg:"#F0F0F0",color:"#6a6a6a"};
  return(
    <div style={{position:"relative"}}>
      <div onClick={()=>setOpen(o=>!o)}
        style={{...inputStyle,display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none"}}>
        {selected&&<span style={{background:s.bg,color:s.color,padding:"2px 8px",
          borderRadius:6,fontSize:11,fontWeight:600,flexShrink:0}}>{selected.label}</span>}
        <span style={{color:C.muted,fontSize:12,flex:1}}>
          {open?"Type to search…":"Click to change category"}
        </span>
        <span style={{color:C.muted2,fontSize:12}}>{open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,
          background:C.surface,border:`1.5px solid ${C.primary}`,borderRadius:9,
          boxShadow:"0 8px 24px rgba(35,42,77,0.18)",zIndex:999,overflow:"hidden"}}>
          <div style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}`}}>
            <input
              autoFocus
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Search categories…"
              style={{width:"100%",border:"none",outline:"none",fontSize:13,
                background:"transparent",color:C.navy,fontFamily:"inherit"}}/>
          </div>
          <div style={{maxHeight:220,overflowY:"auto"}}>
            {filtered.length===0&&(
              <div style={{padding:"12px 14px",fontSize:12,color:C.muted2,textAlign:"center"}}>
                No categories found
              </div>
            )}
            {filtered.map(([k,v])=>{
              const st=CAT_STYLES[k]??{bg:"#F0F0F0",color:"#6a6a6a"};
              return(
                <div key={k} onClick={()=>{onChange(k as Category);setOpen(false);setSearch("");}}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",
                    cursor:"pointer",background:k===value?C.surface2:"transparent",
                    transition:"background 0.1s"}}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)}
                  onMouseLeave={e=>(e.currentTarget.style.background=k===value?C.surface2:"transparent")}>
                  <span style={{background:st.bg,color:st.color,padding:"2px 8px",
                    borderRadius:6,fontSize:11,fontWeight:600,minWidth:60,textAlign:"center"}}>
                    {v.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Task Modal ────────────────────────────────────────────────────────────────
function TaskModal({initial,onClose,onSave}:{
  initial?:Partial<Task>;onClose:()=>void;
  onSave:(t:Omit<Task,"id"|"done"|"deleted"|"checklist">)=>void;
}){
  const{t,dark}=useApp();
  const C=getC(dark);
  const inputStyle=useInputStyle();
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
          placeholder="" style={inputStyle}/>
      </div>
      <div style={{marginBottom:14}}>
        <FieldLabel>Category</FieldLabel>
        <CategoryPicker value={category} onChange={setCategory}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div><FieldLabel>Priority</FieldLabel>
          <select value={priority} onChange={e=>setPriority(e.target.value as Priority)} style={inputStyle}>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </div>
        <div><FieldLabel>Nature</FieldLabel>
          <select value={type} onChange={e=>setType(e.target.value as TaskType)} style={inputStyle}>
            <option value="milestone">Completable</option>
            <option value="ongoing">Ongoing</option>
          </select>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
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
  const{dark}=useApp();
  const C=getC(dark);
  const[expanded,setExpanded]=useState(false);
  const[stepInput,setStepInput]=useState("");
  const d=task.date?daysUntil(task.date):null;
  const overdue=d!==null&&d<0&&!task.done;
  const cl=task.checklist??[];
  const clDone=cl.filter(s=>s.done).length;
  return(
    <div style={{background:C.surface,border:`1px solid ${overdue&&!task.done?C.urgent:C.border}`,
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
                  borderRadius:7,fontSize:11.5,background:C.surface,fontFamily:"inherit"}}/>
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
  const{t,dark}=useApp();
  const C=getC(dark);
  const items:{key:View;label:string}[]=[
    {key:"daily",label:t("daily")},{key:"all",label:t("allTasks")},{key:"week",label:t("week")},
  ];
  return(
    <>
      {isOpen&&<div onClick={onClose} style={{position:"fixed",inset:0,
        background:"rgba(35,42,77,0.3)",backdropFilter:"blur(2px)",zIndex:70}}/>}
      <aside style={{position:"fixed",top:0,left:0,bottom:0,width:250,
        background:C.surface,boxShadow:"8px 0 30px rgba(35,42,77,0.2)",
        padding:"24px 16px",zIndex:71,
        transform:isOpen?"translateX(0)":"translateX(-100%)",
        transition:"transform 0.2s ease",display:"flex",flexDirection:"column",gap:4}}>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
          fontSize:19,color:C.navy,marginBottom:18,padding:"0 8px"}}>{t("appName")}</p>
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
            {t("archive")}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── All Tasks Sidebar ────────────────────────────────────────────────────────
function TaskSidebar({tasks,filter,setFilter}:{tasks:Task[];filter:Filter;setFilter:(f:Filter)=>void;}){
  const{t,dark}=useApp();
  const C=getC(dark);
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
    <div style={{background:C.surface,borderRadius:14,border:`1px solid ${C.border}`,
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
  const{dark}=useApp();
  const C=getC(dark);
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
  const{t,dark}=useApp();
  const C=getC(dark);
  const[open,setOpen]=useState(false);
  const[messages,setMessages]=useState<{role:"user"|"assistant";content:string}[]>([
    {role:"assistant",content:t("chatWelcome")},
  ]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);

  const taskList=tasks.filter(t=>!t.deleted).map(t=>({id:t.id,title:t.title,done:t.done,type:t.type,category:t.category}));
  const systemPrompt=`You are Docket, a smart personal assistant inside a task management app. You help Mo — a law student, paralegal, and entrepreneur in Liverpool — manage his tasks and routine intelligently.

You MUST always respond with a valid JSON object in this exact format:
{"actions": [...], "reply": "your message to Mo"}

CONVERSATION RULES — follow these strictly:
1. When Mo mentions adding something, ALWAYS ask at least one clarifying question before acting — unless the answer is completely obvious from context.
2. Ask ONE question at a time. Never bombard with multiple questions at once.
3. Key questions to ask depending on context:
   - Is this a one-off task (completable) or an ongoing project with no end date?
   - What category does it fall under? (study, trading, business, career, health, admin, faith)
   - How urgent is it? (urgent, high, medium)
   - Does it need a specific time or deadline?
   - Should it repeat daily or weekly?
4. Once you have enough information, create the task with the right fields filled in.
5. When Mo says he finished/completed/done with something, use complete_task immediately — no questions needed.
6. Be friendly, brief, and natural. Talk like a helpful assistant, not a robot.
7. If Mo's message is casual or unclear, ask for clarification rather than guessing.

ACTIONS available (only include actions when you have enough info):
- Add task: {"type":"add_task","task":{"title":"","category":"study","priority":"medium","type":"milestone","date":"","time":"","recurring":"","notes":""}}
- Complete task: {"type":"complete_task","id": NUMBER}
- Delete task: {"type":"remove_task","id": NUMBER}
- Update task: {"type":"update_task","id": NUMBER,"changes":{}}

Categories: study, legal, legal_work, compliance, trading, finance, savings, investment, debt, tax, insurance, subscriptions, business, side_hustle, marketing, sales, design, content, customer, career, interview, networking, project, hr, health, fitness, nutrition, mental, medical, driving, vehicle, admin, home, property, utilities, shopping, family, childcare, pets, social, events, technology, travel, volunteering, charity, community, environment, sports, cooking, reading, music, creative, language, writing, research, education, personal, faith, other
Priorities: urgent, high, medium
Task types: milestone (has a clear end), ongoing (no fixed finish)

Mo's current tasks: ${JSON.stringify(taskList)}

EXAMPLES of good behaviour:
- Mo: "add gym" → reply: "Sure! Is this a one-off session or a recurring daily habit?" → actions: []
- Mo: "daily habit" → reply: "Got it — what time do you usually go? And should I mark it as high intensity?" → actions: []
- Mo: "7am, yes" → reply: "Added gym as a daily routine at 7am." → actions: [{add_task...}]
- Mo: "I finished the Cheshire Oak interview" → reply: "Great work! I'll mark that as complete." → actions: [{complete_task...}]

If you truly have no actions to take: {"actions":[],"reply":"your conversational reply"}
NEVER return plain text. ALWAYS return valid JSON.`;

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
          <div style={{background:C.surface,borderRadius:18,width:380,height:560,
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
  const[prayerEnabled,setPrayerEnabled]=useState(false);
  const[prayerStatus,setPrayerStatus]=useState<"idle"|"loading"|"done"|"error">("idle");
  const[showSettings,setShowSettings]=useState(false);
  const[dark,setDark]=useState(false);
  const[lang,setLang]=useState<Lang>("en");

  const C=getC(dark);
  const dir:("ltr"|"rtl")=RTL_LANGS.includes(lang)?"rtl":"ltr";
  const t=(k:string)=>T[lang]?.[k]??T.en[k]??k;
  const dayLabels=DAY_LABELS_LANG[lang]??DAY_LABELS;

  useEffect(()=>{
    const t=localStorage.getItem(STORAGE_TASKS);
    const r=localStorage.getItem(STORAGE_ROUTINES);
    setTasks(t?JSON.parse(t):defaultTasks());
    setRoutines(r?JSON.parse(r):defaultRoutines());
    setIsLoaded(true);
  },[]);
  useEffect(()=>{if(isLoaded)localStorage.setItem(STORAGE_TASKS,JSON.stringify(tasks));},[tasks,isLoaded]);
  useEffect(()=>{if(isLoaded)localStorage.setItem(STORAGE_ROUTINES,JSON.stringify(routines));},[routines,isLoaded]);

  // Load prayer setting from storage
  useEffect(()=>{
    const saved=localStorage.getItem("docket-prayer-enabled");
    if(saved==="true") setPrayerEnabled(true);
    const savedDark=localStorage.getItem("docket-dark");
    if(savedDark==="true") setDark(true);
    const savedLang=localStorage.getItem("docket-lang") as Lang;
    if(savedLang && T[savedLang]) setLang(savedLang);
  },[]);
  useEffect(()=>{
    if(isLoaded) localStorage.setItem("docket-prayer-enabled", prayerEnabled?"true":"false");
  },[prayerEnabled,isLoaded]);
  useEffect(()=>{
    localStorage.setItem("docket-dark",dark?"true":"false");
    document.body.classList.toggle("dark",dark);
    document.documentElement.style.background = dark?"#0f1019":"#EDE8F5";
    document.body.style.background = dark?"#0f1019":"#EDE8F5";
    document.body.style.minHeight = "100%";
  },[dark]);
  useEffect(()=>{ localStorage.setItem("docket-lang",lang); },[lang]);

  // Prayer names to update
  const PRAYER_NAMES=["Fajr","Dhuhr","Asr","Maghrib","Isha"];

  async function fetchAndApplyPrayerTimes(){
    setPrayerStatus("loading");
    try{
      const pos = await new Promise<GeolocationPosition>((resolve,reject)=>
        navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:8000})
      );
      const{latitude,longitude}=pos.coords;
      const res=await fetch(
        `https://api.aladhan.com/v1/timings/${todayISO()}?latitude=${latitude}&longitude=${longitude}&method=2`
      );
      const data=await res.json();
      if(data.code!==200) throw new Error("Aladhan API error");
      const timings=data.data.timings;
      // Map prayer name → Aladhan key
      const map:Record<string,string>={Fajr:"Fajr",Dhuhr:"Dhuhr",Asr:"Asr",Maghrib:"Maghrib",Isha:"Isha"};
      setRoutines(prev=>prev.map(r=>{
        if(!PRAYER_NAMES.includes(r.label)) return r;
        const key=map[r.label];
        const rawTime=timings[key]; // format "HH:MM"
        if(!rawTime) return r;
        return{...r, time:rawTime.slice(0,5)};
      }));
      setPrayerStatus("done");
    }catch(e){
      console.error("Prayer times fetch failed:",e);
      setPrayerStatus("error");
    }
  }

  async function togglePrayer(){
    const next=!prayerEnabled;
    setPrayerEnabled(next);
    if(next) await fetchAndApplyPrayerTimes();
  }

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
    <AppCtx.Provider value={{dark,lang,t,dir}}>
    <div style={{minHeight:"100vh",background:C.bg,position:"relative",
      fontFamily:"'Inter',sans-serif",color:C.navy,direction:dir,
      backgroundAttachment:"fixed",
      backgroundImage:dark
        ?"radial-gradient(ellipse at top left, rgba(112,145,230,0.12), transparent 50%), radial-gradient(ellipse at bottom right, rgba(61,82,160,0.08), transparent 50%)"
        :"radial-gradient(ellipse at top left, rgba(112,145,230,0.25), transparent 50%), radial-gradient(ellipse at bottom right, rgba(61,82,160,0.12), transparent 50%)"}}>

      {/* Blobs — light mode only */}
      {!dark&&<div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
        <div className="blob blob-1"/><div className="blob blob-2"/>
        <div className="blob blob-3"/><div className="blob blob-4"/>
      </div>}

      <Drawer isOpen={isDrawerOpen} onClose={()=>setIsDrawerOpen(false)}
        currentView={currentView} setView={setCurrentView}/>

      {/* Nav */}
      <nav style={{position:"relative",zIndex:10,display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:"20px 20px 12px"}}>
        <button onClick={()=>setIsDrawerOpen(true)}
          style={{width:44,height:44,borderRadius:12,background:C.surface,
            border:`1px solid ${C.border}`,boxShadow:"0 6px 18px rgba(35,42,77,0.1)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:18,color:C.navy,cursor:"pointer"}}>☰</button>
        <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
          fontSize:17,color:C.navy}}>{t("appName")}</span>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowSettings(s=>!s)}
            style={{width:44,height:44,borderRadius:12,background:C.surface,
              border:`1px solid ${C.border}`,boxShadow:"0 6px 18px rgba(35,42,77,0.1)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:17,cursor:"pointer"}} title="Settings">⚙️</button>
          <button onClick={toggleNotifications}
            style={{width:44,height:44,borderRadius:12,
              border:`1px solid ${notifEnabled?C.sage:C.border}`,
              background:notifEnabled?C.sage:"white",
              boxShadow:"0 6px 18px rgba(35,42,77,0.1)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:17,cursor:"pointer"}}>
            {notifEnabled?"🔔":"🔕"}
          </button>
        </div>
      </nav>

      {/* Settings Panel */}
      {showSettings&&(
        <div style={{position:"relative",zIndex:10,maxWidth:1100,margin:"0 auto",
          padding:"0 20px 16px"}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,
            padding:"18px 20px"}}>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
              fontSize:16,color:C.navy,marginBottom:14}}>{t("settings")}</p>

            {/* Dark mode */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <div>
                <p style={{fontWeight:600,fontSize:14,color:C.navy}}>{t("darkMode")}</p>
                <p style={{fontSize:12,color:C.muted,marginTop:2}}>{t("darkDesc")}</p>
              </div>
              <button onClick={()=>setDark(d=>!d)}
                style={{width:48,height:26,borderRadius:13,border:"none",cursor:"pointer",
                  background:dark?C.sage:C.border,position:"relative",transition:"background 0.2s",flexShrink:0}}>
                <span style={{position:"absolute",top:3,left:dark?24:3,width:20,height:20,
                  borderRadius:"50%",background:"#fff",transition:"left 0.2s",
                  boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
              </button>
            </div>

            {/* Language */}
            <div style={{padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <p style={{fontWeight:600,fontSize:14,color:C.navy}}>{t("language")}</p>
              <p style={{fontSize:12,color:C.muted,marginTop:2,marginBottom:10}}>{t("languageDesc")}</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {(Object.entries(LANG_LABELS) as [Lang,string][]).map(([code,label])=>(
                  <button key={code} onClick={()=>setLang(code)}
                    style={{padding:"7px 14px",borderRadius:8,border:`1.5px solid ${lang===code?C.primary:C.border}`,
                      background:lang===code?C.primary:"transparent",
                      color:lang===code?"white":C.muted,
                      fontSize:13,fontWeight:600,cursor:"pointer",
                      fontFamily:code==="ar"||code==="ur"?"'Segoe UI',sans-serif":"inherit"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prayer times toggle */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <div>
                <p style={{fontWeight:600,fontSize:14,color:C.navy}}>{t("prayerSetting")}</p>
                <p style={{fontSize:12,color:C.muted,marginTop:2}}>{t("prayerDesc")}</p>
                {prayerStatus==="loading"&&<p style={{fontSize:11,color:C.accent,marginTop:4}}>{t("prayerLoading")}</p>}
                {prayerStatus==="done"&&<p style={{fontSize:11,color:C.sage,marginTop:4}}>{t("prayerDone")}</p>}
                {prayerStatus==="error"&&<p style={{fontSize:11,color:C.urgent,marginTop:4}}>{t("prayerError")}</p>}
              </div>
              <button onClick={togglePrayer}
                style={{width:48,height:26,borderRadius:13,border:"none",cursor:"pointer",
                  background:prayerEnabled?C.sage:C.border,
                  position:"relative",transition:"background 0.2s",flexShrink:0}}>
                <span style={{position:"absolute",top:3,
                  left:prayerEnabled?24:3,width:20,height:20,borderRadius:"50%",
                  background:"#fff",transition:"left 0.2s",
                  boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
              </button>
            </div>

            {/* Notifications toggle */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"12px 0"}}>
              <div>
                <p style={{fontWeight:600,fontSize:14,color:C.navy}}>{t("notifSetting")}</p>
                <p style={{fontSize:12,color:C.muted,marginTop:2}}>{t("notifDesc")}</p>
              </div>
              <button onClick={toggleNotifications}
                style={{width:48,height:26,borderRadius:13,border:"none",cursor:"pointer",
                  background:notifEnabled?C.sage:C.border,
                  position:"relative",transition:"background 0.2s",flexShrink:0}}>
                <span style={{position:"absolute",top:3,
                  left:notifEnabled?24:3,width:20,height:20,borderRadius:"50%",
                  background:"#fff",transition:"left 0.2s",
                  boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main style={{position:"relative",zIndex:10,maxWidth:1100,margin:"0 auto",padding:"0 20px 100px"}}>

        {/* Countdown chips */}
        {(examTask||interviewTask)&&(
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
            {examTask&&(
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,
                padding:"10px 15px",display:"flex",alignItems:"center",gap:9}}>
                <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:17,
                  color:(daysUntil(examTask.date)??1)<0?C.urgent:C.primary}}>
                  {daysUntil(examTask.date)===null?"—":daysUntil(examTask.date)===0?"Today":`${daysUntil(examTask.date)}d`}
                </span>
                <span style={{fontSize:11,color:C.muted,fontWeight:500}}>Land Law exam</span>
              </div>
            )}
            {interviewTask&&(
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,
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
              fontSize:26,color:C.navy,marginBottom:4}}>{t("daily")}</p>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,
              color:C.muted,marginBottom:20}}>
              {new Date().toLocaleDateString(lang==="ar"?"ar-SA":lang==="fr"?"fr-FR":lang==="tr"?"tr-TR":lang==="ur"?"ur-PK":"en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            </p>
            <div style={{background:dark?"#1a2535":"#E4E9F9",color:C.primary,fontSize:12,
              padding:"11px 15px",borderRadius:10,marginBottom:16,lineHeight:1.5}}>
              {prayerEnabled?t("prayerDone"):t("prayerPlaceholder")}
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
            <div style={{background:C.surface,border:`1px solid ${C.border}`,
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
                fontSize:26,color:C.navy}}>{t("allTasks")}</p>
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
              fontSize:26,color:C.navy,marginBottom:20}}>{t("week")}</p>
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
            <div style={{background:C.surface,border:`1px solid ${C.border}`,
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
              fontSize:26,color:C.navy,marginBottom:20}}>{t("archive")}</p>
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
    </AppCtx.Provider>
  );
}