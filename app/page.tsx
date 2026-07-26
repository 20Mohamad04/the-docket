"use client";
import React, { useState, useEffect, useCallback, createContext, useContext } from "react";

type Category = "study"|"legal"|"trading"|"finance"|"business"|"career"|"health"|"driving"|"admin"|"property"|"content"|"personal"|"family"|"faith"|"fitness"|"nutrition"|"mental"|"travel"|"technology"|"creative"|"social"|"volunteering"|"language"|"reading"|"music"|"sports"|"cooking"|"shopping"|"events"|"medical"|"insurance"|"tax"|"debt"|"savings"|"investment"|"side_hustle"|"networking"|"interview"|"project"|"research"|"writing"|"design"|"marketing"|"sales"|"customer"|"hr"|"legal_work"|"compliance"|"environment"|"community"|"charity"|"education"|"childcare"|"pets"|"home"|"vehicle"|"utilities"|"subscriptions"|"other";
type Priority = "urgent"|"high"|"medium";
type TaskType = "milestone"|"ongoing";
type View = "daily"|"all"|"calendar"|"archive";
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
    navy:"#ECF0FF", primary:"#7C9CF0", accent:"#8BA8FF",
    accent2:"#9AADF0", border:"rgba(255,255,255,0.07)", muted:"#8A96C0",
    muted2:"#505878", urgent:"#FF6B6B", urgentSoft:"rgba(255,107,107,0.12)",
    sage:"#4CC38A", sageSoft:"rgba(76,195,138,0.12)", surface:"rgba(255,255,255,0.05)",
    surface2:"rgba(255,255,255,0.025)", bg:"#080A14",
    gold:"#D4A843",
  } : {
    navy:"#181D3B", primary:"#4C5FD5", accent:"#6677E8",
    accent2:"#8892D8", border:"rgba(76,95,213,0.13)", muted:"#6B7299",
    muted2:"#A8AFCC", urgent:"#D94F3D", urgentSoft:"#FDECEA",
    sage:"#2E8B57", sageSoft:"#E0F5EB", surface:"rgba(255,255,255,0.78)",
    surface2:"rgba(255,255,255,0.42)", bg:"#E9E6F4",
    gold:"#C9A84C",
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
const CATS:Record<string,{label:string;icon:string}> = {
  health:      {label:"Health & Fitness",    icon:"ti-heart-rate-monitor"},
  fitness:     {label:"Fitness & Exercise",  icon:"ti-run"},
  nutrition:   {label:"Nutrition & Diet",    icon:"ti-apple"},
  mental:      {label:"Mental Health",       icon:"ti-brain"},
  medical:     {label:"Medical",             icon:"ti-stethoscope"},
  faith:       {label:"Faith & Spirituality",icon:"ti-moon-stars"},
  personal:    {label:"Personal Dev",        icon:"ti-seeding"},
  reading:     {label:"Reading & Books",     icon:"ti-book"},
  music:       {label:"Music",               icon:"ti-music"},
  creative:    {label:"Creative & Arts",     icon:"ti-palette"},
  language:    {label:"Language Learning",   icon:"ti-language"},
  study:       {label:"Study",               icon:"ti-school"},
  research:    {label:"Research",            icon:"ti-microscope"},
  writing:     {label:"Writing",             icon:"ti-pencil"},
  education:   {label:"Education",           icon:"ti-certificate"},
  career:      {label:"Career",              icon:"ti-briefcase"},
  interview:   {label:"Interviews",          icon:"ti-users"},
  networking:  {label:"Networking",          icon:"ti-network"},
  project:     {label:"Projects",            icon:"ti-layout-kanban"},
  hr:          {label:"HR & People",         icon:"ti-user-check"},
  business:    {label:"Business",            icon:"ti-building"},
  side_hustle: {label:"Side Hustle",         icon:"ti-bolt"},
  marketing:   {label:"Marketing",           icon:"ti-speakerphone"},
  sales:       {label:"Sales",               icon:"ti-target"},
  design:      {label:"Design",              icon:"ti-brush"},
  content:     {label:"Content Creation",    icon:"ti-device-mobile"},
  customer:    {label:"Customer Service",    icon:"ti-headset"},
  finance:     {label:"Finance",             icon:"ti-coin"},
  trading:     {label:"Trading & Investing", icon:"ti-chart-line"},
  savings:     {label:"Savings & Goals",     icon:"ti-piggy-bank"},
  investment:  {label:"Investments",         icon:"ti-trending-up"},
  debt:        {label:"Debt & Loans",        icon:"ti-credit-card"},
  tax:         {label:"Tax & Accounting",    icon:"ti-receipt"},
  insurance:   {label:"Insurance",           icon:"ti-shield"},
  subscriptions:{label:"Subscriptions",      icon:"ti-repeat"},
  legal:       {label:"Legal",               icon:"ti-scale"},
  legal_work:  {label:"Legal Work",          icon:"ti-file-text"},
  compliance:  {label:"Compliance",          icon:"ti-checkbox"},
  admin:       {label:"Admin & Housing",     icon:"ti-home"},
  home:        {label:"Home & DIY",          icon:"ti-tool"},
  property:    {label:"Property",            icon:"ti-building-estate"},
  utilities:   {label:"Utilities & Bills",   icon:"ti-bulb"},
  vehicle:     {label:"Vehicle",             icon:"ti-car"},
  driving:     {label:"Driving",             icon:"ti-steering-wheel"},
  shopping:    {label:"Shopping & Errands",  icon:"ti-shopping-cart"},
  family:      {label:"Family",              icon:"ti-users-group"},
  childcare:   {label:"Childcare",           icon:"ti-baby-carriage"},
  pets:        {label:"Pets",                icon:"ti-paw"},
  social:      {label:"Social Life",         icon:"ti-confetti"},
  events:      {label:"Events",              icon:"ti-calendar-event"},
  technology:  {label:"Technology",          icon:"ti-cpu"},
  travel:      {label:"Travel & Holidays",   icon:"ti-plane"},
  volunteering:{label:"Volunteering",        icon:"ti-hand-helping"},
  charity:     {label:"Charity & Giving",    icon:"ti-heart"},
  community:   {label:"Community",           icon:"ti-topology-star"},
  environment: {label:"Environment",         icon:"ti-leaf"},
  sports:      {label:"Sports",              icon:"ti-ball-football"},
  cooking:     {label:"Cooking & Recipes",   icon:"ti-chef-hat"},
  other:       {label:"Other",               icon:"ti-dots-circle-horizontal"},
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

function defaultTasks():Task[]{ return []; }
function defaultRoutines():Routine[]{ return []; }

// ── Shared small components ──────────────────────────────────────────────────

function CatPill({category,done}:{category:string;done?:boolean}){
  const s=CAT_STYLES[category]??{bg:"#F0F0F0",color:"#6a6a6a"};
  const cat=CATS[category];
  const label=cat?.label??category;
  const icon=cat?.icon??"ti-dots-circle-horizontal";
  return(
    <span style={{background:s.bg,color:s.color,padding:"4px 11px 4px 8px",borderRadius:50,
      fontSize:11.5,fontWeight:700,lineHeight:1.3,display:"inline-flex",
      alignItems:"center",gap:5,letterSpacing:"-0.1px",
      textDecoration:done?"line-through":"none",opacity:done?0.55:1}}>
      <i className={`ti ${icon}`} style={{fontSize:13}} aria-hidden="true"/>
      {label}
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
      <div className="glass" style={{borderRadius:22,padding:30,width:"100%",maxWidth:460,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.35)"}}>
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
function CategoryPicker({value,onChange}:{value:string;onChange:(v:any)=>void}){
  const{dark}=useApp();
  const C=getC(dark);
  const[search,setSearch]=useState("");
  const[open,setOpen]=useState(false);
  const[customMode,setCustomMode]=useState(false);
  const[customVal,setCustomVal]=useState("");
  const filtered=Object.entries(CATS).filter(([k,v])=>
    v.label.toLowerCase().includes(search.toLowerCase())||
    k.toLowerCase().includes(search.toLowerCase())
  );
  const selected=CATS[value];
  const s=CAT_STYLES[value]??{bg:"#F0F0F0",color:"#6a6a6a"};
  const displayLabel=selected?`${selected.icon} ${selected.label}`:value||"Select category";
  return(
    <div style={{position:"relative"}}>
      <div onClick={()=>{setOpen(o=>!o);setCustomMode(false);}}
        style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${open?C.primary:C.border}`,
          borderRadius:9,background:C.surface2,display:"flex",
          alignItems:"center",gap:8,cursor:"pointer",userSelect:"none",
          boxShadow:open?"0 0 0 3px rgba(61,82,160,0.12)":"none",
          transition:"all 0.15s"}}>
        <span style={{background:s.bg,color:s.color,padding:"3px 10px 3px 8px",
          borderRadius:50,fontSize:11.5,fontWeight:700,flexShrink:0,display:"flex",alignItems:"center",gap:5}}>
          {selected&&<i className={`ti ${selected.icon}`} style={{fontSize:13}} aria-hidden="true"/>}
          {selected?selected.label:value||"Category"}
        </span>
        <span style={{color:C.muted2,fontSize:12,flex:1}}>{open?"Search or type custom…":"Click to change"}</span>
        <span style={{color:C.muted2,fontSize:11}}>{open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,
          background:C.surface,border:`1.5px solid ${C.primary}`,borderRadius:9,
          boxShadow:"0 8px 30px rgba(35,42,77,0.2)",zIndex:999,overflow:"hidden"}}>
          <div style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:6}}>
            <input autoFocus value={search}
              onChange={e=>{setSearch(e.target.value);setCustomMode(false);}}
              placeholder="Search categories…"
              style={{flex:1,border:"none",outline:"none",fontSize:13,
                background:"transparent",color:C.navy,fontFamily:"inherit"}}/>
            <button onClick={()=>{setCustomMode(true);setSearch("");}}
              style={{fontSize:10,fontWeight:700,color:C.primary,background:"#E4E9F9",
                border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",flexShrink:0}}>
              + CUSTOM
            </button>
          </div>
          {customMode&&(
            <div style={{padding:"10px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:6}}>
              <input autoFocus value={customVal} onChange={e=>setCustomVal(e.target.value)}
                placeholder="Type your own category…"
                onKeyDown={e=>{if(e.key==="Enter"&&customVal.trim()){onChange(customVal.trim());setOpen(false);setCustomVal("");setCustomMode(false);}}}
                style={{flex:1,border:`1.5px solid ${C.primary}`,borderRadius:7,padding:"7px 9px",
                  outline:"none",fontSize:13,background:C.surface,color:C.navy,fontFamily:"inherit"}}/>
              <button onClick={()=>{if(customVal.trim()){onChange(customVal.trim());setOpen(false);setCustomVal("");setCustomMode(false);}}}
                style={{background:C.primary,color:"white",border:"none",borderRadius:7,
                  padding:"0 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Add</button>
            </div>
          )}
          <div style={{maxHeight:240,overflowY:"auto"}}>
            {filtered.length===0&&!customMode&&(
              <div style={{padding:"12px 14px",fontSize:12,color:C.muted2,textAlign:"center"}}>
                No match — click + CUSTOM to add your own
              </div>
            )}
            {filtered.map(([k,v])=>{
              const st=CAT_STYLES[k]??{bg:"#F0F0F0",color:"#6a6a6a"};
              return(
                <div key={k} onClick={()=>{onChange(k);setOpen(false);setSearch("");}}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",
                    cursor:"pointer",background:k===value?C.surface2:"transparent",
                    transition:"background 0.1s"}}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)}
                  onMouseLeave={e=>(e.currentTarget.style.background=k===value?C.surface2:"transparent")}>
                  <i className={`ti ${v.icon}`} style={{fontSize:16,width:22,textAlign:"center",flexShrink:0,color:st.color}} aria-hidden="true"/>
                  <span style={{background:st.bg,color:st.color,padding:"3px 10px",
                    borderRadius:6,fontSize:12,fontWeight:600}}>{v.label}</span>
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
          className="pill-btn" style={{padding:"12px 24px",
            background:"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)",
            color:"white",border:"none",fontSize:13,
            boxShadow:"0 6px 20px rgba(76,95,213,0.5)"}}>
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
    <div className="glass" style={{border:`1px solid ${overdue&&!task.done?C.urgent+"44":C.border}`,
      borderRadius:18,padding:"18px 20px",marginBottom:12,
      display:"flex",gap:14,transition:"all 0.2s",
      boxShadow:overdue&&!task.done?`0 4px 20px rgba(217,79,61,0.15)`:undefined}}>
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
    {key:"daily",label:"Daily Routine"},{key:"all",label:"All Tasks"},{key:"calendar",label:"Calendar"},
  ];
  return(
    <>
      {isOpen&&<div onClick={onClose} style={{position:"fixed",inset:0,
        background:"rgba(35,42,77,0.3)",backdropFilter:"blur(2px)",zIndex:70}}/>}
      <aside style={{position:"fixed",top:0,left:0,bottom:0,width:250,
        background:C.surface,backdropFilter:"blur(20px)",boxShadow:"8px 0 40px rgba(0,0,0,0.3)",
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
  const[showAllCats,setShowAllCats]=useState(false);
  const open=tasks.filter(t=>!t.done&&!t.deleted);
  const archived=tasks.filter(t=>t.done||t.deleted);
  const CAT_LIMIT=6;
  const catEntries=Object.entries(CATS);
  const visibleCats=showAllCats?catEntries:catEntries.slice(0,CAT_LIMIT);
  const hiddenCount=catEntries.length-CAT_LIMIT;

  function Btn({f,label,count}:{f:Filter;label:string;count:number}){
    const active=filter===f;
    return(
      <button onClick={()=>setFilter(f)} style={{width:"100%",display:"flex",
        justifyContent:"space-between",alignItems:"center",
        padding:"10px 12px",borderRadius:10,fontSize:13.5,fontWeight:600,
        border:"none",cursor:"pointer",
        background:active?"linear-gradient(135deg,#4C5FD5 0%,#2A3699 100%)":"transparent",
        color:active?"white":C.muted,marginBottom:3,
        boxShadow:active?"0 4px 14px rgba(76,95,213,0.4)":"none"}}>
        <span>{label}</span>
        <span style={{fontFamily:"monospace",fontSize:11,opacity:0.75}}>{count}</span>
      </button>
    );
  }
  return(
    <div className="glass" style={{borderRadius:18,padding:12,height:"fit-content"}}>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:C.muted2,
        textTransform:"uppercase",padding:"6px 10px 6px"}}>Show</p>
      <Btn f="all" label="All Open" count={open.length}/>
      <Btn f="ongoing" label="Ongoing" count={open.filter(t=>t.type==="ongoing").length}/>
      <Btn f="milestone" label="Completable" count={open.filter(t=>t.type==="milestone").length}/>
      <div style={{height:1,background:C.border,margin:"6px 4px"}}/>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:C.muted2,
        textTransform:"uppercase",padding:"6px 10px 6px"}}>Category</p>
      {visibleCats.map(([k,v])=>(
        <Btn key={k} f={k as Filter} label={v.label} count={open.filter(t=>t.category===k).length}/>
      ))}
      {/* View more / less toggle */}
      <button onClick={()=>setShowAllCats(s=>!s)}
        style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",
          gap:6,padding:"8px 12px",borderRadius:10,fontSize:12,fontWeight:600,
          border:`1px dashed ${C.border}`,background:"transparent",
          color:C.primary,cursor:"pointer",marginTop:4,marginBottom:4,
          transition:"all 0.15s"}}
        onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)}
        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
        <i className={`ti ${showAllCats?"ti-chevron-up":"ti-chevron-down"}`}
          style={{fontSize:13}} aria-hidden="true"/>
        {showAllCats?`Show less`:`View ${hiddenCount} more categories`}
      </button>
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
    {role:"assistant",content:"Hi! I'm your Docket assistant. Tell me what you need — I'll find the best slot in your schedule and confirm before adding anything."},
  ]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);

  const scheduleContext=()=>{
    const occ:Record<string,string[]>={};
    DAYS.forEach(d=>{
      const slots=routines
        .filter(r=>(r.days??[]).includes(d)&&r.time)
        .sort((a,b)=>(a.time||"").localeCompare(b.time||""))
        .map(r=>`${r.time} ${r.label} (${r.duration}min)`);
      if(slots.length) occ[d]=slots;
    });
    return occ;
  };

  const systemPrompt=`You are Docket — an elite AI chief of staff and personal scheduler built into a task management app. You are extraordinarily capable, intelligent, and proactive. You think deeply before acting, reason carefully about the user's life and schedule, and always do exactly the right thing.

Today is ${todayISO()} (${new Date().toLocaleDateString("en-GB",{weekday:"long"})}).

=== USER'S COMPLETE SCHEDULE ===
${JSON.stringify(scheduleContext(),null,2)}

=== ACTIVE TASKS ===
${JSON.stringify(tasks.filter(t=>!t.deleted&&!t.done).map(t=>({id:t.id,title:t.title,type:t.type,category:t.category,priority:t.priority,date:t.date,time:t.time,notes:t.notes})))}

=== ALL ROUTINES ===
${JSON.stringify(routines.map(r=>({id:r.id,label:r.label,days:r.days,time:r.time,duration:r.duration,intensity:r.intensity})))}

=== RESPONSE FORMAT ===
Always respond with ONLY valid JSON — no markdown, no plain text outside the JSON:
{"actions": [...], "reply": "your message to the user"}

=== COMPLETE ACTION REFERENCE ===
ADD RECURRING ROUTINE (appears in Daily Routine + Week view every week):
{"type":"add_routine","routine":{"label":"NAME","category":"CATEGORY","days":["mon","wed","fri"],"time":"16:00","duration":90,"intensity":"normal"}}

ADD ONE-OFF TASK (appears in Week view on specific date, All Tasks):
{"type":"add_task","task":{"title":"NAME","category":"CATEGORY","priority":"medium","type":"milestone","date":"YYYY-MM-DD","time":"HH:MM","recurring":"","notes":""}}

ADD ONGOING PROJECT (no fixed end, appears in All Tasks):
{"type":"add_task","task":{"title":"NAME","category":"CATEGORY","priority":"medium","type":"ongoing","date":"","time":"","recurring":"","notes":""}}

COMPLETE A TASK: {"type":"complete_task","id":NUMBER}
DELETE A TASK: {"type":"remove_task","id":NUMBER}
UPDATE A TASK: {"type":"update_task","id":NUMBER,"changes":{"title":"NEW","priority":"high","date":"YYYY-MM-DD","notes":"..."}}
REOPEN A TASK: {"type":"reopen_task","id":NUMBER}

ADD CHECKLIST STEP: {"type":"add_step","task_id":NUMBER,"text":"Step description"}
REMOVE STEP: {"type":"remove_step","task_id":NUMBER,"step_id":NUMBER}

UPDATE ROUTINE (change time, days, label, duration): {"type":"update_routine","id":NUMBER,"changes":{"time":"07:30","days":["mon","tue","wed"],"duration":45}}
REMOVE ROUTINE: {"type":"remove_routine","id":NUMBER}
MARK ROUTINE DONE TODAY: {"type":"mark_routine_done","routine_id":NUMBER,"date":"${todayISO()}"}
UNDO LAST ACTION: {"type":"undo"}

Multiple actions can be combined in one response: {"actions":[action1, action2, ...],"reply":"..."}

=== VALID VALUES ===
Days: mon, tue, wed, thu, fri, sat, sun
Categories: study, legal, trading, finance, business, career, health, fitness, driving, admin, property, content, personal, family, faith, technology, travel, sports, mental, medical, nutrition, reading, music, creative, language, writing, research, education, side_hustle, marketing, sales, design, content, customer, savings, investment, debt, tax, insurance, home, utilities, vehicle, shopping, childcare, pets, social, events, volunteering, charity, community, environment, cooking, other
Priorities: urgent, high, medium
Intensity: normal, high (high = physically demanding, avoid double-booking with other high intensity)

=== HOW TO BEHAVE — READ CAREFULLY ===

INTELLIGENCE & REASONING:
- Think about what the user actually needs, not just what they literally said
- If someone says "I'm tired in the morning", don't schedule intense tasks before 10am
- Estimate realistic durations: quick check = 15min, reading = 30-60min, study session = 60-90min, workout = 45-90min, meal = 20-30min, interview prep = 45-60min, deep work = 90-120min
- Look at the full schedule before suggesting times — find genuinely free slots
- Never double-book. Never schedule high-intensity activities on the same day
- Consider energy levels: hard cognitive work in the morning, lighter tasks in the afternoon/evening
- If a user seems overwhelmed, suggest prioritising and breaking tasks into smaller steps

WHAT TO ADD WHERE:
- Recurring habits/routines (gym, prayer, study, meals) → add_routine
- Specific appointments/deadlines/events → add_task with exact date and time
- Open-ended ongoing projects → add_task with type "ongoing", no date
- Breaking a big task into steps → add_step multiple times

CONVERSATION STYLE:
- Be warm, direct, and genuinely helpful — like a brilliant friend who happens to be a world-class assistant
- Keep replies SHORT — 1-3 sentences max unless explaining something complex
- When suggesting a schedule slot, be SPECIFIC: "Tuesday and Thursday at 3pm for 60 minutes" not "sometime in the afternoon"
- When you're about to add/change something important, confirm first — say what you're going to do and ask "does that work?"
- For simple changes (completing a task, updating a time the user just specified), just do it — no need to confirm trivial edits
- Never ask more than one question at a time
- If the user's request is vague, make your best intelligent guess and tell them what you assumed

UNDO: If user says "undo", "revert", "go back", "undo that" → use {"type":"undo"} immediately.

COMPLETION & STATUS:
- "I finished X", "done with X", "completed X", "X is done" → complete_task immediately, no confirmation
- "remove X", "delete X", "get rid of X" → remove it, confirm briefly after
- "mark X as done" → complete_task

SMART SCHEDULING EXAMPLES:
User: "add a morning run to my routine"
→ Check schedule. If 06:30 is free most days: "I'll add a 30-minute morning run at 06:30 on weekdays — does that work?"
→ On confirmation: add_routine with days mon-fri, time 06:30, duration 30, intensity high

User: "I need to study for my exam next week"  
→ "Your exam is on 29 July — that's X days away. I'd suggest 2-hour study blocks on Mon/Wed/Fri starting this week. You have free time at 15:00 on those days. Want me to add that?"
→ On confirmation: add_routine with those days and time

User: "reschedule my gym to 8am"
→ Find the gym routine ID. Check if 08:00 is free. update_routine with time "08:00". Reply: "Done — gym moved to 8am."

User: "what's on tomorrow?"
→ Look at tomorrow's day key in the schedule. List what's there. No actions needed. Reply with a clear summary.

User: "I'm feeling overwhelmed"
→ Look at their task list. Identify the most urgent items. Suggest focusing on just the top 2-3. Offer to break a task into steps if it seems too big.

User: "clear my Wednesday afternoon"
→ Find all routines on Wednesday. Identify ones in the afternoon (12:00+). Ask which ones to remove or if they want all of them cleared. Then remove_routine for the confirmed ones.

User: "add steps to my CPS interview prep"
→ add_step multiple times with intelligent suggested steps like "Research CPS values and mission", "Prepare competency answers using STAR method", "Prepare 3 questions to ask the interviewer", "Do a mock interview", "Review your CV and application"

REMEMBER: You can do ANYTHING the user asks. There is no limit to what you can help with. Be the most capable, thoughtful, intelligent assistant possible.`;

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
      let parsed:any={};
      try{ parsed=JSON.parse(raw); }catch(e){ console.error("Parse failed:",raw); }
      let actions:any[]=[];
      if(Array.isArray(parsed.actions)&&parsed.actions.length>0) actions=parsed.actions;
      else if(parsed.type) actions=[parsed];
      else if(parsed.action?.type) actions=[parsed.action];
      onAction(actions);
      setMessages([...newMsgs,{role:"assistant",content:parsed.reply??parsed.message??"Done."}]);
    }catch{
      setMessages([...newMsgs,{role:"assistant",content:"Something went wrong — try rephrasing."}]);
    }finally{setLoading(false);}
  }

  return(<>
      <button onClick={()=>setOpen(o=>!o)}
        className="pill-btn" style={{position:"fixed",bottom:30,right:102,width:60,height:60,
          color:"white",
          background:"linear-gradient(145deg,#B8A8FF 0%,#8670E8 40%,#4C5FD5 100%)",
          boxShadow:"0 12px 36px rgba(76,95,213,0.7), 0 4px 10px rgba(0,0,0,0.3)",
          zIndex:40}}>
          <i className="ti ti-sparkles" style={{fontSize:24,color:"white"}} aria-hidden="true"/>
        </button>
      {open&&(
        <div style={{position:"fixed",bottom:20,right:20,zIndex:60}}>
          <div className="glass" style={{borderRadius:24,width:400,height:590,display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,0.35)"}}>
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
                style={{backgroundImage:"linear-gradient(135deg,#3D52A0 0%,#232A4D 100%)",
                  color:"white",border:"none",
                  padding:"0 16px",borderRadius:10,fontWeight:600,
                  fontSize:12.5,cursor:"pointer",opacity:loading?0.5:1,
                  boxShadow:"0 3px 10px rgba(35,42,77,0.3)"}}>Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Calendar View ────────────────────────────────────────────────────────────
const HOLIDAYS:Record<string,{name:string;type:"public"|"religious"|"awareness"|"cultural"}[]> = {
  "01-01":[{name:"New Year's Day",type:"public"}],
  "01-15":[{name:"Martin Luther King Jr. Day",type:"public"}],
  "01-27":[{name:"Holocaust Memorial Day",type:"awareness"}],
  "02-14":[{name:"Valentine's Day",type:"cultural"}],
  "03-08":[{name:"International Women's Day",type:"awareness"}],
  "03-17":[{name:"St Patrick's Day",type:"cultural"}],
  "03-21":[{name:"World Down Syndrome Day",type:"awareness"},{name:"Nowruz (Persian New Year)",type:"cultural"}],
  "03-22":[{name:"World Water Day",type:"awareness"}],
  "04-01":[{name:"April Fool's Day",type:"cultural"}],
  "04-07":[{name:"World Health Day",type:"awareness"}],
  "04-22":[{name:"Earth Day",type:"awareness"}],
  "05-01":[{name:"International Labour Day",type:"public"}],
  "05-04":[{name:"Star Wars Day",type:"cultural"}],
  "05-15":[{name:"International Day of Families",type:"awareness"}],
  "06-01":[{name:"World Children's Day",type:"awareness"}],
  "06-05":[{name:"World Environment Day",type:"awareness"}],
  "06-21":[{name:"World Music Day",type:"cultural"}],
  "07-04":[{name:"US Independence Day",type:"public"}],
  "08-12":[{name:"International Youth Day",type:"awareness"}],
  "09-21":[{name:"International Day of Peace",type:"awareness"}],
  "10-01":[{name:"International Day of Older Persons",type:"awareness"}],
  "10-05":[{name:"World Teachers' Day",type:"awareness"}],
  "10-10":[{name:"World Mental Health Day",type:"awareness"}],
  "10-16":[{name:"World Food Day",type:"awareness"}],
  "10-31":[{name:"Halloween",type:"cultural"}],
  "11-05":[{name:"Guy Fawkes Night (UK)",type:"cultural"}],
  "11-11":[{name:"Remembrance Day",type:"public"}],
  "12-01":[{name:"World AIDS Day",type:"awareness"}],
  "12-10":[{name:"Human Rights Day",type:"awareness"}],
  "12-25":[{name:"Christmas Day",type:"public"}],
  "12-26":[{name:"Boxing Day (UK)",type:"public"}],
  "12-31":[{name:"New Year's Eve",type:"cultural"}],
};
// UK Bank Holidays 2026
const UK_BANK_2026:string[]=["2026-01-01","2026-04-03","2026-04-06","2026-05-04","2026-05-25","2026-08-31","2026-12-25","2026-12-28"];
// Islamic dates vary yearly — approximate 2026 dates
const ISLAMIC_2026:Record<string,string>={
  "2026-01-20":"Ramadan begins (approx)",
  "2026-02-18":"Eid al-Fitr (approx)",
  "2026-04-26":"Eid al-Adha (approx)",
  "2026-05-16":"Islamic New Year (approx)",
  "2026-07-25":"Day of Arafah (approx)",
};

const TYPE_STYLE:Record<string,{bg:string;color:string;icon:string}>={
  public:    {bg:"#E4E9F9",color:"#3D52A0",icon:"🏛️"},
  religious: {bg:"#DCF0E6",color:"#1f7a52",icon:"🕌"},
  awareness: {bg:"#F6E9D3",color:"#9c6a1f",icon:"🎗️"},
  cultural:  {bg:"#FFE4F0",color:"#a53070",icon:"🎉"},
  islamic:   {bg:"#DCF0E6",color:"#1f7a52",icon:"☪️"},
  bank:      {bg:"#EDE0F5",color:"#7a3a9e",icon:"🏦"},
};

function CalendarView({tasks,routines,dark,C}:{tasks:Task[];routines:Routine[];dark:boolean;C:ReturnType<typeof getC>}){
  const now=new Date();
  const[viewMonth,setViewMonth]=useState(now.getMonth());
  const[viewYear,setViewYear]=useState(now.getFullYear());
  const[selectedDay,setSelectedDay]=useState<string|null>(null);

  const firstDay=new Date(viewYear,viewMonth,1);
  const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
  const startDow=(firstDay.getDay()+6)%7; // 0=Mon

  const monthISO=`${viewYear}-${String(viewMonth+1).padStart(2,"0")}`;

  function getDayData(day:number){
    const iso=`${monthISO}-${String(day).padStart(2,"0")}`;
    const mmdd=iso.slice(5);
    const events:{name:string;type:string}[]=[];
    if(UK_BANK_2026.includes(iso)) events.push({name:"UK Bank Holiday",type:"bank"});
    if(ISLAMIC_2026[iso]) events.push({name:ISLAMIC_2026[iso],type:"islamic"});
    (HOLIDAYS[mmdd]||[]).forEach(h=>events.push({name:h.name,type:h.type}));
    const dayTasks=tasks.filter(t=>t.date===iso&&!t.deleted);
    const dayKey=["sun","mon","tue","wed","thu","fri","sat"][new Date(iso+"T12:00:00").getDay()];
    const dayRoutines=routines.filter(r=>(r.days??[]).includes(dayKey));
    return{iso,events,tasks:dayTasks,routineCount:dayRoutines.length};
  }

  const MONTH_NAMES=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  const selData=selectedDay?getDayData(parseInt(selectedDay)):null;

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:22,color:C.navy}}>
          Calendar
        </p>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1);}}
            style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,
              background:C.surface,cursor:"pointer",fontSize:16,color:C.navy,
              backgroundImage:`linear-gradient(135deg,${C.surface},${C.surface2})`,
              boxShadow:"0 2px 6px rgba(35,42,77,0.08)"}}>‹</button>
          <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:15,color:C.navy,minWidth:130,textAlign:"center"}}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1);}}
            style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,
              background:C.surface,cursor:"pointer",fontSize:16,color:C.navy,
              backgroundImage:`linear-gradient(135deg,${C.surface},${C.surface2})`,
              boxShadow:"0 2px 6px rgba(35,42,77,0.08)"}}>›</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {Object.entries(TYPE_STYLE).map(([k,v])=>(
          <span key={k} style={{background:v.bg,color:v.color,fontSize:10,fontWeight:600,
            padding:"3px 8px",borderRadius:6}}>{v.icon} {k.charAt(0).toUpperCase()+k.slice(1)}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:`1px solid ${C.border}`}}>
          {DOW.map(d=>(
            <div key={d} style={{padding:"8px 4px",textAlign:"center",fontSize:10.5,
              fontWeight:700,color:C.muted,background:C.surface2}}>{d}</div>
          ))}
        </div>
        {/* Days */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {Array.from({length:startDow}).map((_,i)=>(
            <div key={`empty-${i}`} style={{minHeight:70,borderRight:`1px solid ${C.border}`,
              borderBottom:`1px solid ${C.border}`,background:C.surface2,opacity:0.4}}/>
          ))}
          {Array.from({length:daysInMonth}).map((_,i)=>{
            const day=i+1;
            const{iso,events,tasks:dt,routineCount}=getDayData(day);
            const isToday=iso===todayISO();
            const isSelected=selectedDay===String(day);
            const hasTasks=dt.length>0;
            const hasEvents=events.length>0;
            return(
              <div key={day} onClick={()=>setSelectedDay(isSelected?null:String(day))}
                style={{minHeight:70,borderRight:`1px solid ${C.border}`,
                  borderBottom:`1px solid ${C.border}`,padding:"6px 6px 4px",
                  cursor:"pointer",position:"relative",transition:"background 0.1s",
                  background:isSelected?C.surface2:isToday?`${C.primary}18`:C.surface}}
                onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)}
                onMouseLeave={e=>(e.currentTarget.style.background=isSelected?C.surface2:isToday?`${C.primary}18`:C.surface)}>
                <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:isToday?700:500,
                  fontSize:13,color:isToday?C.primary:C.navy,
                  background:isToday?"transparent":"none"}}>
                  {day}
                </span>
                <div style={{marginTop:2,display:"flex",flexDirection:"column",gap:1}}>
                  {events.slice(0,2).map((ev,ei)=>{
                    const st=TYPE_STYLE[ev.type]??TYPE_STYLE.cultural;
                    return(
                      <div key={ei} style={{background:st.bg,color:st.color,fontSize:8.5,
                        fontWeight:600,padding:"1px 4px",borderRadius:3,
                        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {st.icon} {ev.name}
                      </div>
                    );
                  })}
                  {events.length>2&&<div style={{fontSize:8,color:C.muted}}>+{events.length-2} more</div>}
                </div>
                {(hasTasks||routineCount>0)&&(
                  <div style={{position:"absolute",bottom:4,right:5,display:"flex",gap:2}}>
                    {hasTasks&&<span style={{width:6,height:6,borderRadius:"50%",background:C.urgent}}/>}
                    {routineCount>0&&<span style={{width:6,height:6,borderRadius:"50%",background:C.sage}}/>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selData&&(
        <div style={{marginTop:14,background:C.surface,border:`1px solid ${C.border}`,
          borderRadius:14,padding:"16px 18px"}}>
          <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:15,
            color:C.navy,marginBottom:10}}>
            {new Date(selData.iso+"T12:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}
          </p>
          {selData.events.length>0&&(
            <div style={{marginBottom:10}}>
              {selData.events.map((ev,i)=>{
                const st=TYPE_STYLE[ev.type]??TYPE_STYLE.cultural;
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                    padding:"6px 0",borderBottom:i<selData.events.length-1?`1px solid ${C.border}`:"none"}}>
                    <span style={{fontSize:16}}>{st.icon}</span>
                    <span style={{fontSize:13,fontWeight:600,color:C.navy}}>{ev.name}</span>
                    <span style={{background:st.bg,color:st.color,fontSize:10,fontWeight:600,
                      padding:"2px 7px",borderRadius:5,marginLeft:"auto"}}>{ev.type}</span>
                  </div>
                );
              })}
            </div>
          )}
          {selData.tasks.length>0&&(
            <div>
              <p style={{fontSize:10,fontWeight:700,color:C.muted2,letterSpacing:1,
                textTransform:"uppercase",marginBottom:6}}>Tasks this day</p>
              {selData.tasks.map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0"}}>
                  <CatPill category={t.category}/>
                  <span style={{fontSize:13,color:C.navy,fontWeight:500}}>{t.title}</span>
                </div>
              ))}
            </div>
          )}
          {selData.events.length===0&&selData.tasks.length===0&&(
            <p style={{fontSize:13,color:C.muted2}}>No events or tasks on this day.</p>
          )}
        </div>
      )}

      {/* Dot legend */}
      <div style={{display:"flex",gap:14,marginTop:10,fontSize:10.5,color:C.muted}}>
        <span><span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:C.urgent,marginRight:4,verticalAlign:"middle"}}/>Has task</span>
        <span><span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:C.sage,marginRight:4,verticalAlign:"middle"}}/>Has routine</span>
      </div>
    </div>
  );
}

// ── Live Clock — signature element ───────────────────────────────────────────
function LiveClock({dark,C}:{dark:boolean;C:ReturnType<typeof getC>}){
  const[time,setTime]=useState(new Date());
  useEffect(()=>{
    const id=setInterval(()=>setTime(new Date()),1000);
    return()=>clearInterval(id);
  },[]);
  const hh=String(time.getHours()).padStart(2,"0");
  const mm=String(time.getMinutes()).padStart(2,"0");
  const ss=String(time.getSeconds()).padStart(2,"0");
  return(
    <div className="glass" style={{borderRadius:20,padding:"20px 24px",marginBottom:18,
      background:dark?"rgba(0,0,0,0.1)":"rgba(255,255,255,0.05)",
      display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <p style={{fontFamily:"'IBM Plex Mono',monospace",fontWeight:500,
          fontSize:42,color:C.primary,letterSpacing:"-1px",lineHeight:1}}>
          {hh}<span style={{opacity:0.5,animation:"pulse 1s infinite"}}>:</span>{mm}
          <span style={{fontSize:24,color:C.muted,marginLeft:6}}>{ss}</span>
        </p>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:500,
          color:C.muted,marginTop:4}}>
          {time.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
        </p>
      </div>
      <div style={{textAlign:"right"}}>
        <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,
          color:C.muted2,letterSpacing:"2px",textTransform:"uppercase"}}>Week</p>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:28,
          color:C.navy,lineHeight:1,marginTop:2}}>
          {String(Math.ceil((time.getDate()+new Date(time.getFullYear(),time.getMonth(),1).getDay())/7))}
        </p>
        <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,
          color:C.muted2,letterSpacing:"1px",textTransform:"uppercase",marginTop:2}}>
          of {time.toLocaleDateString("en-GB",{month:"short"})}
        </p>
      </div>
    </div>
  );
}

// ── Premium Onboarding Screen ─────────────────────────────────────────────────
const OB_GOALS=[
  {id:"work",icon:"ti-briefcase",label:"Work & Career"},
  {id:"study",icon:"ti-school",label:"Study & Learning"},
  {id:"health",icon:"ti-heart-rate-monitor",label:"Health & Fitness"},
  {id:"faith",icon:"ti-moon-stars",label:"Faith & Spirituality"},
  {id:"business",icon:"ti-building",label:"Business & Side Hustles"},
  {id:"finance",icon:"ti-chart-line",label:"Finance & Investing"},
  {id:"family",icon:"ti-users-group",label:"Family & Personal"},
  {id:"travel",icon:"ti-plane",label:"Travel & Lifestyle"},
];

function OnboardingScreen({onComplete,dark}:{onComplete:(name:string,goals:string[])=>void;dark:boolean}){
  const C=getC(dark);
  const[step,setStep]=useState(0);
  const[name,setName]=useState("");
  const[goals,setGoals]=useState<string[]>([]);
  const[animating,setAnimating]=useState(false);

  function next(){
    setAnimating(true);
    setTimeout(()=>{setStep(s=>s+1);setAnimating(false);},350);
  }
  function finish(){
    setAnimating(true);
    setTimeout(()=>onComplete(name,goals),600);
  }
  function toggleGoal(id:string){
    setGoals(g=>g.includes(id)?g.filter(x=>x!==id):[...g,id]);
  }

  const steps=[
    // Step 0: Welcome
    <div key="0" style={{textAlign:"center",padding:"0 8px"}}>
      <div style={{width:80,height:80,borderRadius:24,margin:"0 auto 28px",
        background:"linear-gradient(145deg,#8BA8FF 0%,#4C5FD5 45%,#1A2566 100%)",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 16px 48px rgba(76,95,213,0.5)"}}>
        <i className="ti ti-check" style={{fontSize:40,color:"white"}} aria-hidden="true"/>
      </div>
      <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:32,fontWeight:800,
        color:C.navy,letterSpacing:"-1px",marginBottom:12,lineHeight:1.1}}>
        Welcome to<br/>The Docket
      </h1>
      <p style={{fontSize:15,color:C.muted,lineHeight:1.6,marginBottom:36,maxWidth:280,margin:"0 auto 36px"}}>
        Your intelligent personal planner. Built to keep you focused, on time, and in control of everything that matters.
      </p>
      <button className="pill-btn" onClick={next}
        style={{background:"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)",
          color:"white",padding:"16px 48px",fontSize:16,fontWeight:700,
          boxShadow:"0 8px 28px rgba(76,95,213,0.5)"}}>
        Get started
      </button>
      <p style={{fontSize:11,color:C.muted2,marginTop:20,letterSpacing:"0.5px"}}>
        No account needed · Works offline · Your data stays private
      </p>
    </div>,

    // Step 1: Name
    <div key="1" style={{textAlign:"center",padding:"0 8px"}}>
      <div style={{width:64,height:64,borderRadius:20,margin:"0 auto 24px",
        background:"linear-gradient(145deg,#E8C84C 0%,#C9A84C 45%,#8A6820 100%)",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 12px 36px rgba(201,168,76,0.45)"}}>
        <i className="ti ti-user" style={{fontSize:30,color:"white"}} aria-hidden="true"/>
      </div>
      <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:26,fontWeight:800,
        color:C.navy,letterSpacing:"-0.5px",marginBottom:8}}>What's your name?</h2>
      <p style={{fontSize:14,color:C.muted,marginBottom:28}}>
        Your Docket assistant will use this to personalise your experience.
      </p>
      <input
        autoFocus
        value={name}
        onChange={e=>setName(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&name.trim()&&next()}
        placeholder="Your first name"
        style={{width:"100%",padding:"16px 20px",borderRadius:14,
          border:`2px solid ${name?C.primary:C.border}`,
          fontSize:18,fontWeight:600,textAlign:"center",
          background:C.surface2,color:C.navy,outline:"none",
          fontFamily:"'Space Grotesk',sans-serif",
          transition:"border-color 0.2s",marginBottom:24}}
      />
      <button className="pill-btn" onClick={next} disabled={!name.trim()}
        style={{background:name.trim()
          ?"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)"
          :C.border,
          color:"white",padding:"14px 40px",fontSize:15,fontWeight:700,
          boxShadow:name.trim()?"0 8px 28px rgba(76,95,213,0.45)":"none",
          opacity:name.trim()?1:0.6,
          cursor:name.trim()?"pointer":"not-allowed"}}>
        Continue
      </button>
    </div>,

    // Step 2: Goals
    <div key="2" style={{textAlign:"center",padding:"0 8px"}}>
      <div style={{width:64,height:64,borderRadius:20,margin:"0 auto 24px",
        background:"linear-gradient(145deg,#5DE8A0 0%,#2E8B57 45%,#1A5235 100%)",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 12px 36px rgba(46,139,87,0.45)"}}>
        <i className="ti ti-target" style={{fontSize:30,color:"white"}} aria-hidden="true"/>
      </div>
      <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:26,fontWeight:800,
        color:C.navy,letterSpacing:"-0.5px",marginBottom:8}}>
        What do you want to track?
      </h2>
      <p style={{fontSize:14,color:C.muted,marginBottom:24}}>
        Pick everything that matters to you. Your Docket will be built around these.
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:28}}>
        {OB_GOALS.map(g=>{
          const active=goals.includes(g.id);
          return(
            <button key={g.id} onClick={()=>toggleGoal(g.id)}
              style={{padding:"14px 12px",borderRadius:14,cursor:"pointer",
                border:`2px solid ${active?C.primary:C.border}`,
                background:active?"linear-gradient(135deg,rgba(76,95,213,0.12),rgba(76,95,213,0.06))":C.surface2,
                display:"flex",alignItems:"center",gap:10,transition:"all 0.15s",
                boxShadow:active?"0 4px 16px rgba(76,95,213,0.2)":"none"}}>
              <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
                background:active?"linear-gradient(135deg,#4C5FD5,#2A3699)":C.surface,
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:active?"0 4px 12px rgba(76,95,213,0.4)":"none"}}>
                <i className={`ti ${g.icon}`} style={{fontSize:18,color:active?"white":C.muted}} aria-hidden="true"/>
              </div>
              <span style={{fontSize:13,fontWeight:600,color:active?C.primary:C.navy,
                textAlign:"left",lineHeight:1.2}}>{g.label}</span>
            </button>
          );
        })}
      </div>
      <button className="pill-btn" onClick={next} disabled={goals.length===0}
        style={{background:goals.length>0
          ?"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)"
          :C.border,
          color:"white",padding:"14px 40px",fontSize:15,fontWeight:700,
          boxShadow:goals.length>0?"0 8px 28px rgba(76,95,213,0.45)":"none",
          opacity:goals.length>0?1:0.6,
          cursor:goals.length>0?"pointer":"not-allowed"}}>
        {goals.length===0?"Pick at least one":goals.length===1?"Continue with 1 focus":`Continue with ${goals.length} focuses`}
      </button>
    </div>,

    // Step 3: Account choice
    <div key="3" style={{textAlign:"center",padding:"0 8px"}}>
      <div style={{width:64,height:64,borderRadius:20,margin:"0 auto 24px",
        background:"linear-gradient(145deg,#FFD580 0%,#E8A020 45%,#B06800 100%)",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 12px 36px rgba(232,160,32,0.5)"}}>
        <i className="ti ti-crown" style={{fontSize:30,color:"white"}} aria-hidden="true"/>
      </div>
      <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:26,fontWeight:800,
        color:C.navy,letterSpacing:"-0.5px",marginBottom:8}}>How do you want to start?</h2>
      <p style={{fontSize:14,color:C.muted,marginBottom:28}}>
        Start free or unlock the full Docket experience.
      </p>

      {/* Guest option */}
      <button onClick={next}
        style={{width:"100%",padding:"18px 20px",borderRadius:16,cursor:"pointer",
          border:`2px solid ${C.border}`,background:C.surface2,
          marginBottom:12,textAlign:"left",transition:"all 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary}
        onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:44,height:44,borderRadius:12,background:C.surface,
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
            border:`1px solid ${C.border}`}}>
            <i className="ti ti-user" style={{fontSize:22,color:C.muted}} aria-hidden="true"/>
          </div>
          <div style={{textAlign:"left"}}>
            <p style={{fontWeight:700,fontSize:15,color:C.navy,marginBottom:2}}>Continue as guest</p>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.4}}>
              Free · Data stays on this device · No account needed
            </p>
          </div>
        </div>
        <div style={{marginTop:12,display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Daily routine","Task manager","Week view","Calendar","AI assistant (limited)"].map(f=>(
            <span key={f} style={{fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:50,
              background:C.surface2,border:`1px solid ${C.border}`,color:C.muted}}>{f}</span>
          ))}
        </div>
      </button>

      {/* Pro option */}
      <button onClick={next}
        style={{width:"100%",padding:"18px 20px",borderRadius:16,cursor:"pointer",
          border:"2px solid #4C5FD5",
          background:"linear-gradient(135deg,rgba(76,95,213,0.08),rgba(134,112,232,0.05))",
          marginBottom:8,textAlign:"left",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,right:0,background:"linear-gradient(135deg,#4C5FD5,#8670E8)",
          padding:"4px 12px",borderRadius:"0 14px 0 10px",
          fontSize:10,fontWeight:700,color:"white",letterSpacing:"0.5px"}}>MOST POPULAR</div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:44,height:44,borderRadius:12,
            background:"linear-gradient(145deg,#6677E8,#4C5FD5)",
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
            boxShadow:"0 4px 14px rgba(76,95,213,0.4)"}}>
            <i className="ti ti-crown" style={{fontSize:22,color:"white"}} aria-hidden="true"/>
          </div>
          <div style={{textAlign:"left"}}>
            <p style={{fontWeight:700,fontSize:15,color:C.primary,marginBottom:2}}>The Docket Pro — £4.99/mo</p>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.4}}>
              Unlimited AI · Cloud sync · All devices · Priority support
            </p>
          </div>
        </div>
        <div style={{marginTop:12,display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Everything in free","Unlimited AI requests","Sync across devices","Prayer time auto-update","Advanced analytics","Priority support"].map(f=>(
            <span key={f} style={{fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:50,
              background:"rgba(76,95,213,0.1)",border:"1px solid rgba(76,95,213,0.2)",
              color:C.primary}}>{f}</span>
          ))}
        </div>
      </button>
      <p style={{fontSize:11,color:C.muted2,marginTop:8}}>
        7-day free trial · Cancel anytime · No hidden fees
      </p>
    </div>,

    // Step 4: AI intro
    <div key="4" style={{textAlign:"center",padding:"0 8px"}}>
      <div style={{width:64,height:64,borderRadius:20,margin:"0 auto 24px",
        background:"linear-gradient(145deg,#C4A8FF 0%,#8670E8 45%,#4A2A9E 100%)",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 12px 36px rgba(134,112,232,0.5)"}}>
        <i className="ti ti-sparkles" style={{fontSize:30,color:"white"}} aria-hidden="true"/>
      </div>
      <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:26,fontWeight:800,
        color:C.navy,letterSpacing:"-0.5px",marginBottom:12}}>
        Meet your AI assistant
      </h2>
      <p style={{fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:28,maxWidth:300,margin:"0 auto 28px"}}>
        Just talk to it naturally. It can add tasks, schedule your week, find free slots, break projects into steps, and remind you what needs doing — all in one message.
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28,textAlign:"left"}}>
        {[
          {icon:"ti-calendar-plus",text:"\"Add gym to my Monday and Wednesday routine at 7am\""},
          {icon:"ti-check",text:"\"I finished the project — mark it as done\""},
          {icon:"ti-clock",text:"\"What's on my schedule tomorrow?\""},
          {icon:"ti-brain",text:"\"I'm overwhelmed — help me prioritise\""},
        ].map((ex,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,
            padding:"12px 14px",borderRadius:12,
            background:C.surface2,border:`1px solid ${C.border}`}}>
            <i className={`ti ${ex.icon}`} style={{fontSize:18,color:C.primary,flexShrink:0}} aria-hidden="true"/>
            <span style={{fontSize:12,color:C.muted,fontStyle:"italic",lineHeight:1.4}}>{ex.text}</span>
          </div>
        ))}
      </div>
      <button className="pill-btn" onClick={finish}
        style={{background:"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)",
          color:"white",padding:"16px 48px",fontSize:16,fontWeight:700,
          boxShadow:"0 8px 28px rgba(76,95,213,0.5)"}}>
        Open my Docket ✦
      </button>
    </div>,
  ];

  return(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",
      alignItems:"center",justifyContent:"center",padding:20}}>
      {/* Background */}
      <div style={{position:"absolute",inset:0,
        background:dark?"rgba(8,10,20,0.92)":"rgba(237,232,245,0.92)",
        backdropFilter:"blur(20px)"}}/>

      {/* Card */}
      <div className="glass" style={{position:"relative",width:"100%",maxWidth:420,
        borderRadius:28,padding:"40px 32px",
        boxShadow:"0 40px 120px rgba(0,0,0,0.3)",
        opacity:animating?0:1,transform:animating?"translateY(12px)":"translateY(0)",
        transition:"opacity 0.35s ease, transform 0.35s ease"}}>

        {/* Progress dots */}
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:36}}>
          {steps.map((_,i)=>(
            <div key={i} style={{height:4,borderRadius:2,transition:"all 0.3s",
              width:i===step?28:8,
              background:i<=step?C.primary:C.border}}/>
          ))}
        </div>

        {/* Step content */}
        {steps[step]}

        {/* Skip for first step only */}
        {step===0&&(
          <button onClick={finish}
            style={{display:"block",margin:"16px auto 0",background:"none",border:"none",
              fontSize:12,color:C.muted2,cursor:"pointer",textDecoration:"underline"}}>
            Skip setup
          </button>
        )}
      </div>
    </div>
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
  const[undoStack,setUndoStack]=useState<{tasks:Task[];routines:Routine[]}[]>([]);
  const[prayerStatus,setPrayerStatus]=useState<"idle"|"loading"|"done"|"error">("idle");
  const[showSettings,setShowSettings]=useState(false);
  const[dark,setDark]=useState(false);
  const[lang,setLang]=useState<Lang>("en");
  const[onboarding,setOnboarding]=useState(false);
  const[obStep,setObStep]=useState(0);
  const[obName,setObName]=useState("");
  const[obGoals,setObGoals]=useState<string[]>([]);
  const[obComplete,setObComplete]=useState(false);

  const C=getC(dark);
  const dir:("ltr"|"rtl")=RTL_LANGS.includes(lang)?"rtl":"ltr";
  const t=(k:string)=>T[lang]?.[k]??T.en[k]??k;
  const dayLabels=DAY_LABELS_LANG[lang]??DAY_LABELS;

  useEffect(()=>{
    // Load Tabler Icons CSS
    if(!document.querySelector('[data-tabler-css]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css';
      link.setAttribute('data-tabler-css','1');
      document.head.appendChild(link);
    }
    const t=localStorage.getItem(STORAGE_TASKS);
    const r=localStorage.getItem(STORAGE_ROUTINES);
    const visited=localStorage.getItem("docket-onboarded");
    setTasks(t?JSON.parse(t):defaultTasks());
    setRoutines(r?JSON.parse(r):defaultRoutines());
    setIsLoaded(true);
    if(!visited) setOnboarding(true);
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
    document.documentElement.style.background = dark?"#080A14":"#E9E6F4";
    document.body.style.background = dark?"#080A14":"#E9E6F4";
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

  const undoLast=useCallback(()=>{
    setUndoStack(stack=>{
      if(!stack.length) return stack;
      const prev=stack[stack.length-1];
      setTasks(prev.tasks);
      setRoutines(prev.routines);
      return stack.slice(0,-1);
    });
  },[]);

  const handleAiActions=useCallback((actions:any[])=>{
    if(actions.length>0){
      setUndoStack(s=>[...s.slice(-9),{tasks:[...tasks],routines:[...routines]}]);
    }
    actions.forEach(a=>{
      if(a.type==="undo"){undoLast();return;}
      if(a.type==="add_task")addTask({title:a.task?.title??"Untitled",category:a.task?.category??"study",priority:a.task?.priority??"medium",type:a.task?.type??"milestone",date:a.task?.date??"",time:a.task?.time??"",recurring:a.task?.recurring??"",notes:a.task?.notes??""});
      else if(a.type==="remove_task")deleteTask(a.id);
      else if(a.type==="update_task")updateTask(a.id,a.changes??{});
      else if(a.type==="complete_task")updateTask(a.id,{done:true});
      else if(a.type==="reopen_task")updateTask(a.id,{done:false,deleted:false});
      else if(a.type==="add_step")addStep(a.task_id,a.text??"Step");
      else if(a.type==="toggle_step")toggleStep(a.task_id,a.step_id);
      else if(a.type==="remove_step")removeStep(a.task_id,a.step_id);
      else if(a.type==="add_routine"){
        const r=a.routine??{};
        const days=Array.isArray(r.days)?r.days.filter((d:string)=>DAYS.includes(d)):DAYS;
        setRoutines(prev=>[...prev,{
          id:Math.max(0,...prev.map((x:Routine)=>x.id))+1,
          label:r.label??"New routine",
          category:r.category??"health",
          days,
          time:r.time??"09:00",
          duration:r.duration??60,
          intensity:r.intensity??"normal",
          notes:r.notes??"",
          completions:{},
        }]);
      }
      else if(a.type==="update_routine"){
        setRoutines(prev=>prev.map((r:Routine)=>r.id===a.id?{...r,...(a.changes??{})}:r));
      }
      else if(a.type==="remove_routine"){
        setRoutines(prev=>prev.filter((r:Routine)=>r.id!==a.id));
      }
      else if(a.type==="mark_routine_done"){
        setRoutines(prev=>prev.map((r:Routine)=>r.id===a.routine_id?{...r,completions:{...r.completions,[a.date]:true}}:r));
      }
    });
  },[addTask,deleteTask,updateTask,addStep,toggleStep,removeStep,setRoutines,tasks,routines,undoLast]);

  async function toggleNotifications(){
    // Toggle off
    if(notifEnabled){ setNotifEnabled(false); return; }
    // Try to get browser permission, but don't block the toggle if unavailable
    if(typeof Notification!=="undefined" && Notification.permission!=="granted"){
      try{
        const perm=await Notification.requestPermission();
        if(perm==="granted"){
          new Notification("The Docket",{body:"Notifications are on — I'll alert you when items are due."});
        }
      }catch(e){
        // Permission API not available in this browser — still enable the toggle
        console.log("Notification permission not available");
      }
    }
    // Always enable the toggle regardless of permission result
    setNotifEnabled(true);
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

  function completeOnboarding(name:string, goals:string[]){
    localStorage.setItem("docket-onboarded","true");
    localStorage.setItem("docket-user-name",name);
    const welcomeTasks:Task[]=[];
    if(goals.includes("health")) welcomeTasks.push({id:Date.now()+1,title:"Start a daily exercise habit",category:"fitness",priority:"medium",type:"ongoing",date:"",time:"",recurring:"daily",notes:"",done:false,deleted:false,checklist:[]});
    if(goals.includes("study")) welcomeTasks.push({id:Date.now()+2,title:"Set a daily study goal",category:"study",priority:"medium",type:"ongoing",date:"",time:"",recurring:"daily",notes:"",done:false,deleted:false,checklist:[]});
    if(goals.includes("finance")) welcomeTasks.push({id:Date.now()+3,title:"Review my finances this week",category:"finance",priority:"medium",type:"milestone",date:"",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]});
    if(goals.includes("faith")) welcomeTasks.push({id:Date.now()+4,title:"Establish a daily prayer routine",category:"faith",priority:"medium",type:"ongoing",date:"",time:"",recurring:"daily",notes:"",done:false,deleted:false,checklist:[]});
    if(goals.includes("business")) welcomeTasks.push({id:Date.now()+5,title:"Define my top business priority this week",category:"business",priority:"high",type:"milestone",date:"",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]});
    if(goals.includes("work")) welcomeTasks.push({id:Date.now()+6,title:"Set this week's career goal",category:"career",priority:"medium",type:"milestone",date:"",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]});
    if(welcomeTasks.length>0) setTasks(welcomeTasks);
    setOnboarding(false);
  }

  return(
    <AppCtx.Provider value={{dark,lang,t,dir}}>
    {onboarding&&<OnboardingScreen onComplete={completeOnboarding} dark={dark}/>}
    <div style={{minHeight:"100vh",background:C.bg,position:"relative",
      fontFamily:"'Inter',sans-serif",color:C.navy,direction:dir,
      backgroundAttachment:"fixed",
      backgroundImage:dark
        ?"radial-gradient(ellipse at top left, rgba(112,145,230,0.12), transparent 50%), radial-gradient(ellipse at bottom right, rgba(61,82,160,0.08), transparent 50%)"
        :"radial-gradient(ellipse at top left, rgba(112,145,230,0.25), transparent 50%), radial-gradient(ellipse at bottom right, rgba(61,82,160,0.12), transparent 50%)"}}>

      {/* 3D animated background */}
      <div className="bg-canvas">
        <div className="geo-layer">
          <div className="geo-ring geo-ring-1"/>
          <div className="geo-ring geo-ring-2"/>
          <div className="geo-ring geo-ring-3"/>
          <div className="geo-ring geo-ring-4"/>
          <div className="geo-ring geo-ring-5"/>
        </div>
        <div className="orb orb-1"/>
        <div className="orb orb-2"/>
        <div className="orb orb-3"/>
      </div>

      <Drawer isOpen={isDrawerOpen} onClose={()=>setIsDrawerOpen(false)}
        currentView={currentView} setView={setCurrentView}/>

      {/* Nav */}
      <nav style={{position:"relative",zIndex:10,display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:"22px 22px 14px"}}>
        <button onClick={()=>setIsDrawerOpen(true)} className="sq-btn"
          style={{width:52,height:52,color:"white",
            background:"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)",
            boxShadow:"0 8px 28px rgba(76,95,213,0.6), 0 3px 8px rgba(0,0,0,0.25)"}}>
          <i className="ti ti-layout-sidebar" style={{fontSize:22,color:"white"}} aria-hidden="true"/></button>
        <div style={{textAlign:"center"}}>
          <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,
            fontSize:18,color:C.navy,letterSpacing:"-0.5px"}}>{t("appName")}</p>
          <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,
            color:C.muted,letterSpacing:"2px",textTransform:"uppercase",marginTop:2}}>
            {new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowSettings(s=>!s)} className="sq-btn"
            style={{width:52,height:52,fontSize:22,cursor:"pointer",
              background:"linear-gradient(145deg,#9B7FE8 0%,#6B4FD8 45%,#3A1A9E 100%)",
              boxShadow:"0 8px 28px rgba(107,79,216,0.55), 0 3px 8px rgba(0,0,0,0.25)"}} title="Settings">
            <i className="ti ti-adjustments-horizontal" style={{fontSize:22,color:"white"}} aria-hidden="true"/></button>
          <button onClick={toggleNotifications} className="sq-btn"
            style={{width:52,height:52,cursor:"pointer",
              background:notifEnabled
                ?"linear-gradient(145deg,#5DE8A0 0%,#2E8B57 45%,#1A5235 100%)"
                :"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)",
              boxShadow:notifEnabled
                ?"0 8px 28px rgba(46,139,87,0.55), 0 3px 8px rgba(0,0,0,0.25)"
                :"0 8px 28px rgba(76,95,213,0.55), 0 3px 8px rgba(0,0,0,0.25)"}}>
            <i className={`ti ${notifEnabled?"ti-bell-ringing":"ti-bell-off"}`}
              style={{fontSize:22,color:"white"}} aria-hidden="true"/>
          </button>
        </div>
      </nav>

      {/* Settings Panel */}
      {showSettings&&(
        <div style={{position:"relative",zIndex:10,maxWidth:1100,margin:"0 auto",
          padding:"0 20px 16px"}}>
          <div className="glass" style={{borderRadius:20,padding:"24px 26px"}}>
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
                style={{width:52,height:28,borderRadius:14,border:"none",cursor:"pointer",
                  background:notifEnabled
                    ?"linear-gradient(135deg,#5DE8A0,#2E8B57)"
                    :C.border,
                  position:"relative",transition:"all 0.25s",flexShrink:0,
                  boxShadow:notifEnabled?"0 4px 12px rgba(46,139,87,0.4)":"none"}}>
                <span style={{position:"absolute",top:4,
                  left:notifEnabled?26:4,width:20,height:20,borderRadius:"50%",
                  background:"white",transition:"left 0.25s",
                  boxShadow:"0 2px 6px rgba(0,0,0,0.25)"}}/>
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
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,
                padding:"12px 18px",display:"flex",alignItems:"center",gap:10,
                backdropFilter:"blur(12px)",
                boxShadow:"0 4px 16px rgba(35,42,77,0.12)"}}>
                <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:20,
                  color:(daysUntil(examTask.date)??1)<0?C.urgent:C.primary}}>
                  {daysUntil(examTask.date)===null?"—":daysUntil(examTask.date)===0?"Today":`${daysUntil(examTask.date)}d`}
                </span>
                <span style={{fontSize:11,color:C.navy,fontWeight:600}}>Land Law exam</span>
              </div>
            )}
            {interviewTask&&(
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,
                padding:"12px 18px",display:"flex",alignItems:"center",gap:10,
                backdropFilter:"blur(12px)",
                boxShadow:"0 4px 16px rgba(35,42,77,0.12)"}}>
                <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:20,
                  color:(daysUntil(interviewTask.date)??1)<0?C.urgent:C.primary}}>
                  {daysUntil(interviewTask.date)===null?"—":daysUntil(interviewTask.date)===0?"Today":`${daysUntil(interviewTask.date)}d`}
                </span>
                <span style={{fontSize:11,color:C.navy,fontWeight:600}}>Cheshire Oak</span>
              </div>
            )}
          </div>
        )}

        {/* ── DAILY ─────────────────────────────────────────────────────── */}
        {currentView==="daily"&&(
          <div>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
              fontSize:24,color:C.navy,marginBottom:10,letterSpacing:"-0.5px"}}>Daily Routine</p>
            <LiveClock dark={dark} C={C}/>
            {/* Week day picker */}
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
              {weekDates.map(day=>{
                const active=selectedWeekDay===day.key;
                const isToday=day.key===todayDayKey();
                const highOnDay=routines.filter(r=>r.intensity==="high"&&(r.days??[]).includes(day.key));
                const hasConflict=highOnDay.length>1;
                return(
                  <button key={day.key} onClick={()=>setSelectedWeekDay(day.key)}
                    style={{position:"relative",flexShrink:0,width:50,paddingTop:8,paddingBottom:8,
                      borderRadius:10,textAlign:"center",cursor:"pointer",transition:"all 0.15s",
                      border:`1.5px solid ${active?C.navy:isToday?C.primary:C.border}`,
                      background:active?C.navy:C.surface,
                      backgroundImage:active?"linear-gradient(135deg,#3D52A0 0%,#232A4D 100%)":"none",
                      boxShadow:active?"0 4px 14px rgba(35,42,77,0.35)":"none"}}>
                    <p style={{fontSize:9,fontWeight:700,textTransform:"uppercase",
                      letterSpacing:0.5,color:active?"rgba(255,255,255,0.75)":C.muted}}>
                      {(DAY_LABELS[day.key]||day.key).slice(0,3)}
                    </p>
                    <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
                      fontSize:15,marginTop:1,color:active?"white":C.navy}}>{day.dayNum}</p>
                    {isToday&&!active&&<div style={{width:4,height:4,borderRadius:"50%",
                      background:C.primary,margin:"2px auto 0"}}/>}
                    {hasConflict&&<span style={{position:"absolute",top:4,right:5,
                      width:5,height:5,borderRadius:"50%",background:C.urgent}}/>}
                  </button>
                );
              })}
            </div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,
              color:C.muted,marginBottom:10}}>
              {selDay?.label||new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}
            </p>
            <div style={{background:dark?"#1a2535":"#E4E9F9",color:C.primary,fontSize:12,
              padding:"10px 14px",borderRadius:10,marginBottom:14,lineHeight:1.5}}>
              {prayerEnabled?t("prayerDone"):t("prayerPlaceholder")}
            </div>
            {(()=>{
              const ov=tasks.filter(t=>!t.done&&!t.deleted&&t.date&&(daysUntil(t.date)??0)<0);
              const og=tasks.filter(t=>t.type==="ongoing"&&!t.done&&!t.deleted);
              return(ov.length||og.length)?(<div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:14}}>
                {ov.map(t=><span key={t.id} style={{fontSize:11,fontWeight:600,
                  padding:"5px 10px",borderRadius:20,background:C.urgentSoft,color:C.urgent}}>
                  ⚠ {t.title}</span>)}
                {og.slice(0,3).map(t=><span key={t.id} style={{fontSize:11,fontWeight:600,
                  padding:"5px 10px",borderRadius:20,background:"#E4E9F9",color:C.primary}}>
                  ◆ {t.title}</span>)}
              </div>):null;
            })()}
            <div className="glass" style={{borderRadius:20,padding:"4px 24px"}}>
              {selectedDayItems.length?selectedDayItems.map((it,i)=>(
                <TimelineRow key={i} item={it} onCheck={()=>{
                  const dayDate=selDay?.date??todayISO();
                  if(it.routineId)toggleRoutineDate(it.routineId,dayDate);
                  else if(it.taskId)toggleTask(it.taskId);
                }}/>
              )):<p style={{textAlign:"center",color:C.muted2,padding:"40px 0",
                fontFamily:"'Space Grotesk',sans-serif",fontWeight:600}}>Nothing scheduled.</p>}
            </div>
          </div>
        )}

        {/* ── ALL TASKS ──────────────────────────────────────────────────── */}
        {currentView==="all"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"center",marginBottom:20}}>
              <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
                fontSize:26,color:C.navy,letterSpacing:"-0.5px"}}>{t("allTasks")}</p>
              <button onClick={()=>setIsAddingTask(true)}
                className="pill-btn" style={{
                  background:"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)",
                  color:"white",fontSize:14,fontWeight:700,
                  padding:"12px 24px",border:"none",cursor:"pointer",
                  boxShadow:"0 6px 20px rgba(76,95,213,0.5)"}}>
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

        {/* ── CALENDAR ────────────────────────────────────────────────── */}
        {currentView==="calendar"&&(
          <CalendarView tasks={tasks} routines={routines} dark={dark} C={C}/>
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
        className="pill-btn" style={{position:"fixed",bottom:30,right:30,width:60,height:60,
          color:"white",
          background:"linear-gradient(145deg,#8BAAFF 0%,#4C5FD5 40%,#1A2566 100%)",
          boxShadow:"0 12px 36px rgba(76,95,213,0.7), 0 4px 10px rgba(0,0,0,0.3)",
          zIndex:40}}>
          <i className="ti ti-plus" style={{fontSize:28,color:"white"}} aria-hidden="true"/>
        </button>

      <Chatbot tasks={tasks} routines={routines} onAction={handleAiActions}/>

      {isAddingTask&&<TaskModal onClose={()=>setIsAddingTask(false)} onSave={addTask}/>}
      {editingTask&&<TaskModal initial={editingTask} onClose={()=>setEditingTask(null)}
        onSave={data=>{updateTask(editingTask.id,data);setEditingTask(null);}}/>}
    </div>
    </AppCtx.Provider>
  );
}