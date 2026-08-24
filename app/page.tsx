"use client";
import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";

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
  other:       {bg:"#E1E4F5",color:"#333A5C"},
};
// Shared fallback for unmatched/custom categories — was a flat gray pair
// that only just cleared the WCAG AA contrast minimum (4.75:1) at small
// pill font sizes; this matches the palette's stronger pastel+saturated
// pattern used everywhere else (~8.7:1).
const CAT_STYLE_DEFAULT=CAT_STYLES.other;

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

// ── Supabase row <-> app-state mapping (cloud sync) ─────────────────────────
function taskToRow(t:Task,userId:string){
  return{
    id:t.id,user_id:userId,title:t.title,category:t.category,priority:t.priority,
    type:t.type,date:t.date||null,time:t.time||null,recurring:t.recurring||null,
    notes:t.notes||null,done:t.done,deleted:t.deleted,checklist:t.checklist,
  };
}
function rowToTask(r:any):Task{
  return{
    id:r.id,title:r.title,category:r.category,priority:r.priority,type:r.type,
    date:r.date||"",time:r.time||"",recurring:r.recurring||"",notes:r.notes||"",
    done:!!r.done,deleted:!!r.deleted,checklist:r.checklist||[],
  };
}
function routineToRow(r:Routine,userId:string){
  return{
    id:r.id,user_id:userId,label:r.label,category:r.category,days:r.days,
    time:r.time||null,duration:r.duration,intensity:r.intensity,notes:r.notes||null,
    completions:r.completions||{},
  };
}
function rowToRoutine(r:any):Routine{
  return{
    id:r.id,label:r.label,category:r.category,days:r.days||[],time:r.time||"",
    duration:r.duration||0,intensity:(r.intensity as any)||"normal",notes:r.notes||"",
    completions:r.completions||{},
  };
}
// Single shared client — each call to createClient() spins up its own GoTrueClient
// that auto-initializes and broadcasts session state over a BroadcastChannel to every
// other instance sharing the same storage key, which was re-firing SIGNED_IN (and the
// "Welcome back" toast) on unrelated state updates like restoring a task.
let _supabaseClient:SupabaseClient|null=null;
async function getSupabaseClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  if(!_supabaseClient){
    const{createClient}=await import("@supabase/supabase-js");
    _supabaseClient=createClient(url,key);
  }
  return _supabaseClient;
}

// ── Shared small components ──────────────────────────────────────────────────

function CatPill({category,done}:{category:string;done?:boolean}){
  const s=CAT_STYLES[category]??CAT_STYLE_DEFAULT;
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
  const s=CAT_STYLES[value]??CAT_STYLE_DEFAULT;
  const displayLabel=selected?`${selected.icon} ${selected.label}`:value||"Select category";
  return(
    <div style={{position:"relative"}}>
      <div onClick={()=>{setOpen(o=>!o);setCustomMode(false);}}
        style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${open?C.primary:C.border}`,
          borderRadius:9,background:dark?"#16192A":"#FFFFFF",display:"flex",
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
          background:dark?"#16192A":"#FFFFFF",border:`1.5px solid ${C.primary}`,borderRadius:9,
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
              const st=CAT_STYLES[k]??CAT_STYLE_DEFAULT;
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

// ── Date Picker ────────────────────────────────────────────────────────────────
// Compact popover calendar, styled to match the app rather than the native
// <input type="date"> widget. Adapts the same month-grid math CalendarView
// uses (firstDay/daysInMonth/startDow, 7-col grid with empty offset cells)
// but without CalendarView's task/event overlay — this only needs day cells.
const DP_MONTH_NAMES=["January","February","March","April","May","June","July","August","September","October","November","December"];
const DP_DOW=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function DatePicker({value,onChange,dark}:{value:string;onChange:(v:string)=>void;dark:boolean}){
  const C=getC(dark);
  const[open,setOpen]=useState(false);
  const parsed=value?new Date(value+"T12:00:00"):null;
  const now=new Date();
  const[viewMonth,setViewMonth]=useState(parsed?parsed.getMonth():now.getMonth());
  const[viewYear,setViewYear]=useState(parsed?parsed.getFullYear():now.getFullYear());

  const firstDay=new Date(viewYear,viewMonth,1);
  const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
  const startDow=(firstDay.getDay()+6)%7; // 0=Mon
  const monthISO=`${viewYear}-${String(viewMonth+1).padStart(2,"0")}`;

  function selectDay(day:number){
    onChange(`${monthISO}-${String(day).padStart(2,"0")}`);
    setOpen(false);
  }

  const displayLabel=parsed
    ?parsed.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})
    :"Select a date";

  return(
    <div style={{position:"relative"}}>
      <div onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",padding:"12px 14px",borderRadius:12,cursor:"pointer",
          border:`1.5px solid ${open?C.primary:C.border}`,fontSize:14,
          background:dark?"#1A1D2E":"#F8F7FE",color:value?C.navy:C.muted,
          display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
          transition:"border-color 0.2s"}}>
        <span style={{display:"flex",alignItems:"center",gap:8}}>
          <i className="ti ti-calendar" style={{fontSize:15,color:C.muted}} aria-hidden="true"/>
          {displayLabel}
        </span>
        {value&&(
          <i className="ti ti-x" style={{fontSize:14,color:C.muted}} aria-hidden="true"
            onClick={e=>{e.stopPropagation();onChange("");}}/>
        )}
      </div>
      {open&&(
        <div onClick={e=>e.stopPropagation()}
          style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:999,width:280,
            background:dark?"#16192A":"#FFFFFF",border:`1.5px solid ${C.primary}`,
            borderRadius:14,boxShadow:"0 8px 30px rgba(35,42,77,0.2)",padding:12}}>
          {/* Month nav */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1);}}
              style={{width:28,height:28,borderRadius:8,border:`1px solid ${C.border}`,
                background:C.surface2,cursor:"pointer",fontSize:14,color:C.navy}}>‹</button>
            <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:13,color:C.navy}}>
              {DP_MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1);}}
              style={{width:28,height:28,borderRadius:8,border:`1px solid ${C.border}`,
                background:C.surface2,cursor:"pointer",fontSize:14,color:C.navy}}>›</button>
          </div>
          {/* Day-of-week headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",marginBottom:4}}>
            {DP_DOW.map(d=>(
              <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,
                color:C.muted,padding:"4px 0"}}>{d}</div>
            ))}
          </div>
          {/* Day grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:2}}>
            {Array.from({length:startDow}).map((_,i)=><div key={`e-${i}`}/>)}
            {Array.from({length:daysInMonth}).map((_,i)=>{
              const day=i+1;
              const iso=`${monthISO}-${String(day).padStart(2,"0")}`;
              const isToday=iso===todayISO();
              const isSelected=iso===value;
              return(
                <button key={day} onClick={()=>selectDay(day)}
                  style={{aspectRatio:"1",borderRadius:8,border:"none",cursor:"pointer",
                    fontSize:12,fontWeight:isSelected||isToday?700:500,
                    background:isSelected?C.primary:isToday?`${C.primary}18`:"transparent",
                    color:isSelected?"white":isToday?C.primary:C.navy,
                    transition:"background 0.1s"}}
                  onMouseEnter={e=>{if(!isSelected)e.currentTarget.style.background=C.surface2;}}
                  onMouseLeave={e=>{if(!isSelected)e.currentTarget.style.background=isToday?`${C.primary}18`:"transparent";}}>
                  {day}
                </button>
              );
            })}
          </div>
          <button onClick={()=>{onChange(todayISO());setOpen(false);}}
            style={{width:"100%",marginTop:10,padding:"7px",borderRadius:8,cursor:"pointer",
              border:`1px solid ${C.border}`,background:"transparent",
              fontSize:11,fontWeight:700,color:C.primary}}>
            Today
          </button>
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
  const[title,setTitle]=useState(initial?.title??"");
  const[category,setCategory]=useState<Category>(initial?.category??"study");
  const[priority,setPriority]=useState<Priority>(initial?.priority??"medium");
  const[type,setType]=useState<TaskType>(initial?.type??"milestone");
  const[date,setDate]=useState(initial?.date??"");
  const[recurring,setRecurring]=useState(initial?.recurring??"");
  const[notes,setNotes]=useState(initial?.notes??"");

  const priorityOpts=[
    {v:"urgent",label:"Urgent",icon:"ti-flame",color:"#D94F3D",bg:"rgba(217,79,61,0.1)"},
    {v:"high",label:"High",icon:"ti-arrow-up",color:"#C9A84C",bg:"rgba(201,168,76,0.1)"},
    {v:"medium",label:"Medium",icon:"ti-minus",color:"#4C5FD5",bg:"rgba(76,95,213,0.1)"},
  ];
  const typeOpts=[
    {v:"milestone",label:"Completable",icon:"ti-circle-check",desc:"Has a clear end"},
    {v:"ongoing",label:"Ongoing",icon:"ti-repeat",desc:"No fixed finish"},
  ];
  const recurringOpts=[
    {v:"",label:"One-off"},
    {v:"daily",label:"Daily"},
    {v:"every_2_days",label:"Every 2 days"},
    {v:"every_3_days",label:"Every 3 days"},
    {v:"weekdays",label:"Weekdays"},
    {v:"weekends",label:"Weekends"},
    {v:"weekly",label:"Weekly"},
    {v:"biweekly",label:"Bi-weekly"},
    {v:"monthly",label:"Monthly"},
  ];

  const inp:React.CSSProperties={
    width:"100%",padding:"12px 14px",borderRadius:12,
    border:`1.5px solid ${C.border}`,fontSize:14,
    background:dark?"#1A1D2E":"#F8F7FE",
    color:C.navy,outline:"none",fontFamily:"inherit",
    transition:"border-color 0.2s",
  };

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,
      background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:dark?"#16192A":"#FFFFFF",borderRadius:24,width:"100%",maxWidth:460,
          maxHeight:"90vh",display:"flex",flexDirection:"column",
          boxShadow:"0 40px 100px rgba(0,0,0,0.45)",border:`1px solid ${C.border}`,
          overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${C.border}`,
          display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,
              background:"linear-gradient(145deg,#6677E8,#4C5FD5)",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className={`ti ${initial?.id?"ti-pencil":"ti-plus"}`}
                style={{fontSize:17,color:"white"}} aria-hidden="true"/>
            </div>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,
              fontSize:17,color:C.navy}}>
              {initial?.id?"Edit Task":"New Task"}
            </p>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",
            cursor:"pointer",color:C.muted}}>
            <i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/>
          </button>
        </div>

        {/* Scrollable form */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
          {/* Task title */}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted2,letterSpacing:"1px",
              textTransform:"uppercase",marginBottom:8}}>Task name</p>
            <input value={title} onChange={e=>setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              style={inp}
              onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
              onBlur={e=>(e.target.style.borderColor=C.border)}
              onKeyDown={e=>e.key==="Enter"&&title.trim()&&(onSave({title,category,priority,type,date,time:"",recurring,notes}),onClose())}/>
          </div>

          {/* Category */}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted2,letterSpacing:"1px",
              textTransform:"uppercase",marginBottom:8}}>Category</p>
            <CategoryPicker value={category} onChange={setCategory}/>
          </div>

          {/* Priority */}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted2,letterSpacing:"1px",
              textTransform:"uppercase",marginBottom:8}}>Priority</p>
            <div style={{display:"flex",gap:8}}>
              {priorityOpts.map(p=>(
                <button key={p.v} onClick={()=>setPriority(p.v as Priority)}
                  style={{flex:1,padding:"10px 8px",borderRadius:12,cursor:"pointer",
                    border:`2px solid ${priority===p.v?p.color:C.border}`,
                    background:priority===p.v?p.bg:"transparent",
                    display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                    transition:"all 0.15s"}}>
                  <i className={`ti ${p.icon}`} style={{fontSize:18,color:priority===p.v?p.color:C.muted}} aria-hidden="true"/>
                  <span style={{fontSize:11,fontWeight:700,color:priority===p.v?p.color:C.muted}}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nature/Type */}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted2,letterSpacing:"1px",
              textTransform:"uppercase",marginBottom:8}}>Nature</p>
            <div style={{display:"flex",gap:8}}>
              {typeOpts.map(tp=>(
                <button key={tp.v} onClick={()=>setType(tp.v as TaskType)}
                  style={{flex:1,padding:"12px",borderRadius:12,cursor:"pointer",
                    border:`2px solid ${type===tp.v?C.primary:C.border}`,
                    background:type===tp.v?"rgba(76,95,213,0.08)":"transparent",
                    display:"flex",alignItems:"center",gap:10,transition:"all 0.15s"}}>
                  <i className={`ti ${tp.icon}`} style={{fontSize:18,
                    color:type===tp.v?C.primary:C.muted,flexShrink:0}} aria-hidden="true"/>
                  <div style={{textAlign:"left"}}>
                    <p style={{fontSize:12,fontWeight:700,color:type===tp.v?C.primary:C.navy}}>{tp.label}</p>
                    <p style={{fontSize:10,color:C.muted2}}>{tp.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recurring */}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted2,letterSpacing:"1px",
              textTransform:"uppercase",marginBottom:8}}>Repeats</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {recurringOpts.map(r=>(
                <button key={r.v} onClick={()=>setRecurring(r.v)}
                  style={{flex:"1 1 27%",padding:"10px 6px",borderRadius:10,cursor:"pointer",
                    border:`2px solid ${recurring===r.v?C.primary:C.border}`,
                    background:recurring===r.v?"rgba(76,95,213,0.08)":"transparent",
                    fontSize:12,fontWeight:700,whiteSpace:"nowrap",
                    color:recurring===r.v?C.primary:C.muted,
                    transition:"all 0.15s"}}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted2,letterSpacing:"1px",
              textTransform:"uppercase",marginBottom:8}}>Due date</p>
            <DatePicker value={date} onChange={setDate} dark={dark}/>
          </div>

          {/* Notes */}
          <div style={{marginBottom:4}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted2,letterSpacing:"1px",
              textTransform:"uppercase",marginBottom:8}}>Notes <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span></p>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
              placeholder="Any details worth remembering…"
              style={{...inp,resize:"vertical"}}
              onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
              onBlur={e=>(e.target.style.borderColor=C.border)}/>
          </div>
        </div>

        {/* Footer buttons */}
        <div style={{padding:"14px 24px 20px",borderTop:`1px solid ${C.border}`,
          display:"flex",gap:10,flexShrink:0}}>
          <button onClick={onClose}
            style={{flex:1,padding:"12px",borderRadius:12,
              border:`1.5px solid ${C.border}`,fontSize:13,fontWeight:700,
              color:C.muted,background:"transparent",cursor:"pointer",
              transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.color=C.primary;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}>
            Cancel
          </button>
          <button onClick={()=>{if(!title.trim())return;
            onSave({title,category,priority,type,date,time:"",recurring,notes});onClose();}}
            className="pill-btn"
            style={{flex:2,padding:"12px",
              background:title.trim()
                ?"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)"
                :C.border,
              color:"white",border:"none",fontSize:13,fontWeight:700,
              opacity:title.trim()?1:0.6,cursor:title.trim()?"pointer":"not-allowed",
              boxShadow:title.trim()?"0 6px 20px rgba(76,95,213,0.4)":"none"}}>
            <i className="ti ti-check" style={{fontSize:14,marginRight:6}} aria-hidden="true"/>
            {initial?.id?"Save Changes":"Add Task"}
          </button>
        </div>
      </div>
    </div>
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

// ── Shared sign-in / register form ────────────────────────────────────────────
// Used by InfoModal's login modal AND OnboardingScreen's mandatory first step,
// so auth behavior (OAuth, email/password, forgot-password, register terms
// agreement) never drifts between the two entry points.
function AuthForm({dark,onUserChange,onOpenLegal,onSuccess,onClose}:{
  dark:boolean;
  onUserChange:(u:{name:string;email:string;avatar?:string;id?:string}|null)=>void;
  onOpenLegal:(m:"terms"|"privacy")=>void;
  onSuccess?:()=>void;
  onClose?:()=>void;
}){
  const C=getC(dark);
  const[view,setView]=useState<"main"|"forgot">("main");
  const[authTab,setAuthTab]=useState<"login"|"register">("login");
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[confirmPassword,setConfirmPassword]=useState("");
  const[name,setName]=useState("");
  const[authStatus,setAuthStatus]=useState<"idle"|"loading"|"success"|"error"|"confirm">("idle");
  const[authMsg,setAuthMsg]=useState("");
  const[registerAgreed,setRegisterAgreed]=useState(false);

  const SITE_URL=typeof window!=="undefined"?window.location.origin:"";

  async function handleAuth(){
    if(!email||!password){setAuthMsg("Please fill in all fields.");setAuthStatus("error");return;}
    if(authTab==="register"&&password!==confirmPassword){
      setAuthMsg("Passwords do not match.");setAuthStatus("error");return;
    }
    if(authTab==="register"&&password.length<6){
      setAuthMsg("Password must be at least 6 characters.");setAuthStatus("error");return;
    }
    if(authTab==="register"&&!registerAgreed){
      setAuthMsg("Please agree to the Terms & Conditions and Privacy Policy to continue.");setAuthStatus("error");return;
    }
    setAuthStatus("loading");setAuthMsg("");
    const sb=await getSupabaseClient();
    if(!sb){setAuthMsg("Supabase not configured. Add environment variables in Vercel.");setAuthStatus("error");return;}
    try{
      if(authTab==="register"){
        const{error}=await sb.auth.signUp({
          email,password,
          options:{data:{full_name:name||email.split("@")[0]},emailRedirectTo:SITE_URL}
        });
        if(error){setAuthMsg(error.message);setAuthStatus("error");return;}
        setAuthStatus("confirm");
        setAuthMsg("✓ Account created! Check "+email+" for a confirmation link. Click it then return here to sign in.");
      } else {
        const{data,error}=await sb.auth.signInWithPassword({email,password});
        if(error){
          if(error.message.toLowerCase().includes("email not confirmed")||error.message.toLowerCase().includes("not confirmed")){
            setAuthMsg("Please confirm your email first. Check your inbox for the verification link we sent.");
            setAuthStatus("confirm");
          } else if(error.message.toLowerCase().includes("invalid")){
            setAuthMsg("Incorrect email or password. Please try again.");
            setAuthStatus("error");
          } else {
            setAuthMsg(error.message);setAuthStatus("error");
          }
          return;
        }
        if(data.user){
          const displayName=data.user.user_metadata?.full_name||data.user.email?.split("@")[0]||"User";
          onUserChange({name:displayName,email:data.user.email||"",avatar:data.user.user_metadata?.avatar_url,id:data.user.id});
          setAuthStatus("success");
          setAuthMsg("Welcome back, "+displayName+"!");
          setTimeout(()=>onSuccess?.(),1500);
        }
      }
    }catch(e:any){setAuthMsg(e.message||"Something went wrong.");setAuthStatus("error");}
  }

  async function handleOAuth(provider:"google"|"apple"){
    const sb=await getSupabaseClient();
    if(!sb){setAuthMsg("Supabase not configured.");setAuthStatus("error");return;}
    try{
      await sb.auth.signInWithOAuth({provider,options:{redirectTo:SITE_URL}});
    }catch(e:any){setAuthMsg(e.message);setAuthStatus("error");}
  }

  async function handleForgotPassword(){
    if(!email){setAuthMsg("Enter your email address above first.");setAuthStatus("error");return;}
    setAuthStatus("loading");
    const sb=await getSupabaseClient();
    if(!sb){setAuthStatus("error");return;}
    try{
      const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:SITE_URL+"?reset=true"});
      if(error){setAuthMsg(error.message);setAuthStatus("error");return;}
      setAuthStatus("confirm");
      setAuthMsg("✓ Password reset email sent to "+email+". Click the link in the email to set a new password.");
    }catch(e:any){setAuthMsg(e.message);setAuthStatus("error");}
  }

  const inp:React.CSSProperties={
    width:"100%",padding:"13px 16px",borderRadius:12,
    border:`1.5px solid ${C.border}`,fontSize:14,
    background:dark?"#1A1D2E":"#F8F7FE",
    color:C.navy,outline:"none",fontFamily:"inherit",marginBottom:12,
    transition:"border-color 0.2s",
  };

  if(view==="forgot") return(
    <>
      <div style={{padding:"24px 24px 0",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>{setView("main");setAuthStatus("idle");setAuthMsg("");}}
          style={{background:"none",border:"none",cursor:"pointer",color:C.muted,
            display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:600}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}} aria-hidden="true"/>Back
        </button>
      </div>
      <div style={{padding:"16px 24px 28px",textAlign:"center"}}>
        <div style={{width:56,height:56,borderRadius:16,margin:"0 auto 16px",
          background:"linear-gradient(145deg,#E8C84C,#C9A84C)",
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:"0 8px 24px rgba(201,168,76,0.4)"}}>
          <i className="ti ti-mail" style={{fontSize:26,color:"white"}} aria-hidden="true"/>
        </div>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:20,
          color:C.navy,marginBottom:8}}>Reset your password</p>
        <p style={{fontSize:13,color:C.muted,marginBottom:20,lineHeight:1.5}}>
          Enter your email and we'll send you a link to reset your password.
        </p>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
          placeholder="Your email address" style={inp}
          onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
          onBlur={e=>(e.target.style.borderColor=C.border)}
          onKeyDown={e=>e.key==="Enter"&&handleForgotPassword()}/>
        {authMsg&&(
          <div style={{padding:"12px 14px",borderRadius:12,marginBottom:14,fontSize:13,
            lineHeight:1.5,textAlign:"left",
            background:authStatus==="confirm"?"rgba(46,139,87,0.1)":"rgba(217,79,61,0.1)",
            color:authStatus==="confirm"?C.sage:C.urgent,
            border:`1px solid ${authStatus==="confirm"?"rgba(46,139,87,0.25)":"rgba(217,79,61,0.25)"}`}}>
            {authMsg}
          </div>
        )}
        {authStatus!=="confirm"&&(
          <button onClick={handleForgotPassword} disabled={authStatus==="loading"}
            className="pill-btn"
            style={{width:"100%",padding:"14px",fontSize:15,fontWeight:700,
              background:"linear-gradient(145deg,#6677E8,#4C5FD5)",color:"white",border:"none",
              opacity:authStatus==="loading"?0.7:1,
              boxShadow:"0 6px 20px rgba(76,95,213,0.4)"}}>
            {authStatus==="loading"?"Sending…":"Send Reset Link"}
          </button>
        )}
      </div>
    </>
  );

  return(
    <>
      {/* Header */}
      <div style={{padding:"24px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40,height:40,borderRadius:11,
            background:"linear-gradient(145deg,#6677E8,#4C5FD5)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <i className="ti ti-user-circle" style={{fontSize:20,color:"white"}} aria-hidden="true"/>
          </div>
          <div>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:17,color:C.navy}}>
              {authTab==="login"?"Welcome":"Join The Docket"}
            </p>
            <p style={{fontSize:11,color:C.muted}}>
              {authTab==="login"?"Sign in to sync your data":"Create your free account"}
            </p>
          </div>
        </div>
        {onClose&&(
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted}}>
            <i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/>
          </button>
        )}
      </div>

      {/* OAuth buttons */}
      <div style={{padding:"20px 24px 0",display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={()=>handleOAuth("google")}
          style={{width:"100%",padding:"12px 16px",borderRadius:12,cursor:"pointer",
            border:`1.5px solid ${C.border}`,background:dark?"#1E2235":"#F8F7FE",
            display:"flex",alignItems:"center",justifyContent:"center",gap:10,
            fontSize:14,fontWeight:600,color:C.navy,transition:"all 0.15s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="#4C5FD5";e.currentTarget.style.background=dark?"#252840":"#EEF0FF";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=dark?"#1E2235":"#F8F7FE";}}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
        <button onClick={()=>handleOAuth("apple")}
          style={{width:"100%",padding:"12px 16px",borderRadius:12,cursor:"pointer",
            border:`1.5px solid ${C.border}`,background:dark?"#1E2235":"#000000",
            display:"flex",alignItems:"center",justifyContent:"center",gap:10,
            fontSize:14,fontWeight:600,color:"white",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.85"}
          onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 3.99zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Continue with Apple
        </button>
      </div>

      {/* Divider */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 24px 0"}}>
        <div style={{flex:1,height:1,background:C.border}}/>
        <span style={{fontSize:11,color:C.muted2,fontWeight:500}}>or use email</span>
        <div style={{flex:1,height:1,background:C.border}}/>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",margin:"14px 24px 0",background:C.surface2,
        borderRadius:12,padding:4,gap:4}}>
        {(["login","register"] as const).map(tab=>(
          <button key={tab} onClick={()=>{setAuthTab(tab);setAuthMsg("");setAuthStatus("idle");}}
            style={{flex:1,padding:"9px 0",borderRadius:9,fontSize:13,fontWeight:700,
              border:"none",cursor:"pointer",transition:"all 0.15s",
              background:authTab===tab?"linear-gradient(135deg,#4C5FD5,#2A3699)":"transparent",
              color:authTab===tab?"white":C.muted,
              boxShadow:authTab===tab?"0 4px 12px rgba(76,95,213,0.4)":"none"}}>
            {tab==="login"?"Sign In":"Register"}
          </button>
        ))}
      </div>

      {/* Form */}
      <div style={{padding:"16px 24px 24px"}}>
        {authTab==="register"&&(
          <input value={name} onChange={e=>setName(e.target.value)}
            placeholder="Full name (optional)" style={inp}
            onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
            onBlur={e=>(e.target.style.borderColor=C.border)}/>
        )}
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
          placeholder="Email address" style={inp}
          onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
          onBlur={e=>(e.target.style.borderColor=C.border)}/>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
          placeholder={authTab==="register"?"Password (min. 6 characters)":"Password"}
          style={inp}
          onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
          onBlur={e=>(e.target.style.borderColor=C.border)}
          onKeyDown={e=>e.key==="Enter"&&authTab==="login"&&handleAuth()}/>
        {authTab==="register"&&(
          <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
            placeholder="Confirm password" style={{...inp,marginBottom:16}}
            onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
            onBlur={e=>(e.target.style.borderColor=C.border)}
            onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
        )}
        {authTab==="register"&&(
          <label style={{display:"flex",alignItems:"flex-start",gap:9,marginBottom:14,cursor:"pointer"}}>
            <input type="checkbox" checked={registerAgreed} onChange={e=>setRegisterAgreed(e.target.checked)}
              style={{marginTop:2,width:15,height:15,flexShrink:0,accentColor:"#4C5FD5",cursor:"pointer"}}/>
            <span style={{fontSize:11.5,color:C.muted,lineHeight:1.5}}>
              I agree to the{" "}
              <span onClick={e=>{e.preventDefault();onOpenLegal("terms");}}
                style={{color:C.primary,fontWeight:600,textDecoration:"underline",cursor:"pointer"}}>Terms & Conditions</span>
              {" "}and{" "}
              <span onClick={e=>{e.preventDefault();onOpenLegal("privacy");}}
                style={{color:C.primary,fontWeight:600,textDecoration:"underline",cursor:"pointer"}}>Privacy Policy</span>
            </span>
          </label>
        )}
        {authMsg&&(
          <div style={{padding:"12px 14px",borderRadius:12,marginBottom:14,fontSize:13,
            lineHeight:1.5,
            background:authStatus==="success"||authStatus==="confirm"?"rgba(46,139,87,0.1)":"rgba(217,79,61,0.1)",
            color:authStatus==="success"||authStatus==="confirm"?C.sage:C.urgent,
            border:`1px solid ${authStatus==="success"||authStatus==="confirm"?"rgba(46,139,87,0.25)":"rgba(217,79,61,0.25)"}`}}>
            {authMsg}
          </div>
        )}
        {authStatus!=="confirm"&&(
          <button onClick={handleAuth} disabled={authStatus==="loading"} className="pill-btn"
            style={{width:"100%",padding:"14px",fontSize:15,fontWeight:700,
              background:authStatus==="success"
                ?"linear-gradient(135deg,#2E8B57,#1A5235)"
                :"linear-gradient(145deg,#6677E8,#4C5FD5,#2A3699)",
              color:"white",border:"none",cursor:"pointer",opacity:authStatus==="loading"?0.7:1,
              boxShadow:"0 6px 20px rgba(76,95,213,0.45)"}}>
            {authStatus==="loading"?"Please wait…":authStatus==="success"?"✓ Signed in!":authTab==="login"?"Sign In →":"Create Account →"}
          </button>
        )}
        {authStatus==="confirm"&&authTab==="register"&&(
          <button onClick={()=>{setAuthTab("login");setAuthStatus("idle");setAuthMsg("");}} className="pill-btn"
            style={{width:"100%",padding:"14px",fontSize:14,fontWeight:700,
              background:"linear-gradient(145deg,#6677E8,#4C5FD5)",color:"white",border:"none",
              boxShadow:"0 6px 20px rgba(76,95,213,0.4)"}}>
            Go to Sign In
          </button>
        )}
        {authTab==="login"&&authStatus!=="confirm"&&(
          <p style={{textAlign:"center",fontSize:12,color:C.muted2,marginTop:12}}>
            <span style={{color:C.primary,cursor:"pointer",fontWeight:600}}
              onClick={()=>{setView("forgot");setAuthStatus("idle");setAuthMsg("");}}>
              Forgot your password?
            </span>
          </p>
        )}
        {authTab==="login"&&authStatus==="confirm"&&(
          <div style={{marginTop:12,padding:"12px",borderRadius:10,
            background:dark?"#1E2235":"#F0F4FF",textAlign:"center"}}>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>
              Didn't receive the email? Check your spam folder or{" "}
              <span style={{color:C.primary,cursor:"pointer",fontWeight:600}}
                onClick={async()=>{
                  const sb=await getSupabaseClient();
                  if(!sb) return;
                  await sb.auth.resend({type:"signup",email});
                  setAuthMsg("Confirmation email resent to "+email);
                }}>resend it</span>.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────
function InfoModal({modal,onClose,dark,user,onUserChange,onNavigate,isPro,subPeriodEnd,subTier}:{
  modal:string;onClose:()=>void;dark:boolean;
  user:{name:string;email:string;avatar?:string;id?:string}|null;
  onUserChange:(u:{name:string;email:string;avatar?:string;id?:string}|null)=>void;
  onNavigate?:(m:string)=>void;
  isPro?:boolean;
  subPeriodEnd?:string|null;
  subTier?:string|null;
}){
  const C=getC(dark);
  const[authStatus,setAuthStatus]=useState<"idle"|"loading"|"success"|"error"|"confirm">("idle");
  const[authMsg,setAuthMsg]=useState("");
  const[cameFromAuth,setCameFromAuth]=useState(false);
  const[openFaq,setOpenFaq]=useState<string|null>(null);
  // Which pricing card is currently selected in the subscription modal —
  // declared up here (not inside the modal==="subscription" branch below)
  // since InfoModal can navigate between modal values without unmounting
  // (e.g. login -> terms via onNavigate), so a hook inside a conditional
  // branch keyed on `modal` would violate the rules of hooks the moment
  // `modal` changed away from "subscription" without a full remount.
  // Defaults to "pro", matching the existing "recommended" default.
  const[selectedTier,setSelectedTier]=useState<"free"|"pro"|"max">("pro");
  // Independently reads the same usage table (sonnet_count/opus_count) that
  // powers the "Opus — N left" indicator in the chat input, so the Usage
  // card's numbers always agree with it. Pro-only — usage tracking never
  // runs server-side for accounts with no active subscription (no billing
  // period to key it against), so there's nothing real to show non-Pro users.
  const[usage,setUsage]=useState<{sonnet_count:number;opus_count:number}|null>(null);
  useEffect(()=>{
    if(!isPro||!user?.id){setUsage(null);return;}
    let cancelled=false;
    (async()=>{
      const sb=await getSupabaseClient();
      if(!sb)return;
      const{data,error}=await sb.from("usage")
        .select("sonnet_count,opus_count").eq("user_id",user.id).maybeSingle();
      if(cancelled)return;
      if(error){console.error("Failed to load usage:",error);return;}
      setUsage({sonnet_count:data?.sonnet_count??0,opus_count:data?.opus_count??0});
    })();
    return()=>{cancelled=true;};
  },[isPro,user?.id]);

  // Email marketing preference, stored in the same auth user_metadata as
  // full_name. The `user` prop here is a normalized {name,email,avatar,id}
  // shape without user_metadata, so this reads it fresh via getUser() rather
  // than threading a new field through every setUser(...) call site in the
  // app. Defaults to false (off) until the real value loads — an unset or
  // not-yet-loaded preference must never render as opted in.
  const[emailOptIn,setEmailOptIn]=useState(false);
  // "Let the AI automatically remember useful details" — same user_metadata
  // storage as email_opt_in, loaded via the same getUser() call to avoid a
  // second round trip. Unlike email_opt_in this defaults to true (on): it's
  // core to how the assistant is meant to work, not a marketing-style
  // opt-in, so both the not-yet-loaded state and an unset preference should
  // read as enabled — matching /api/ask's own server-side default (unset
  // means enabled; only an explicit `false` turns it off).
  const[autoMemoryEnabled,setAutoMemoryEnabled]=useState(true);
  useEffect(()=>{
    if(!user?.id){setEmailOptIn(false);setAutoMemoryEnabled(true);return;}
    let cancelled=false;
    (async()=>{
      const sb=await getSupabaseClient();
      if(!sb)return;
      const{data,error}=await sb.auth.getUser();
      if(cancelled)return;
      if(error){console.error("Failed to load user preferences:",error);return;}
      setEmailOptIn(!!data.user?.user_metadata?.email_opt_in);
      setAutoMemoryEnabled(data.user?.user_metadata?.auto_memory_enabled!==false);
    })();
    return()=>{cancelled=true;};
  },[user?.id]);

  // AI memory management — InfoModal is conditionally rendered ({activeModal
  // && <InfoModal .../>}) so it fully unmounts on close, meaning this effect
  // re-fires fresh every time the Profile view is reopened without needing
  // `modal` as an explicit dependency, same as the Usage card's fetch above.
  const[memories,setMemories]=useState<{id:string;content:string;source:string;created_at:string}[]>([]);
  const[memoriesLoading,setMemoriesLoading]=useState(false);
  const[deletingMemoryId,setDeletingMemoryId]=useState<string|null>(null);
  const[clearingMemories,setClearingMemories]=useState(false);
  useEffect(()=>{
    if(!user?.id){setMemories([]);return;}
    let cancelled=false;
    (async()=>{
      setMemoriesLoading(true);
      try{
        const headers=await getAuthHeader();
        const res=await fetch("/api/memories",{headers});
        const data=await res.json();
        if(!cancelled)setMemories(Array.isArray(data.memories)?data.memories:[]);
      }catch(err){
        console.error("Failed to load memories:",err);
      }finally{
        if(!cancelled)setMemoriesLoading(false);
      }
    })();
    return()=>{cancelled=true;};
  },[user?.id]);

  async function handleDeleteMemory(id:string){
    setDeletingMemoryId(id);
    try{
      const headers=await getAuthHeader();
      const res=await fetch(`/api/memories/${id}`,{method:"DELETE",headers});
      if(!res.ok)throw new Error(`Failed to delete memory (${res.status})`);
      setMemories(prev=>prev.filter(m=>m.id!==id));
    }catch(err){
      console.error("Failed to delete memory:",err);
    }finally{
      setDeletingMemoryId(null);
    }
  }

  async function handleClearAllMemories(){
    if(!window.confirm("Clear everything the AI remembers about you? This can't be undone."))return;
    setClearingMemories(true);
    try{
      const headers=await getAuthHeader();
      const res=await fetch("/api/memories",{method:"DELETE",headers});
      if(!res.ok)throw new Error(`Failed to clear memories (${res.status})`);
      setMemories([]);
    }catch(err){
      console.error("Failed to clear memories:",err);
    }finally{
      setClearingMemories(false);
    }
  }

  async function toggleEmailOptIn(){
    const next=!emailOptIn;
    setEmailOptIn(next);
    const sb=await getSupabaseClient();
    if(!sb) return;
    const{error}=await sb.auth.updateUser({data:{email_opt_in:next}});
    if(error){
      setEmailOptIn(!next);
      setAuthMsg("Could not update email preference.");setAuthStatus("error");
      return;
    }
    setAuthMsg(next?"✓ You'll get product updates by email":"✓ Email updates turned off");
    setAuthStatus("success");
  }

  async function toggleAutoMemory(){
    const next=!autoMemoryEnabled;
    setAutoMemoryEnabled(next);
    const sb=await getSupabaseClient();
    if(!sb)return;
    const{error}=await sb.auth.updateUser({data:{auto_memory_enabled:next}});
    if(error){
      setAutoMemoryEnabled(!next);
      setAuthMsg("Could not update memory preference.");setAuthStatus("error");
      return;
    }
    setAuthMsg(next?"✓ Automatic memory turned on":"✓ Automatic memory turned off — explicit \"remember\" requests still work");
    setAuthStatus("success");
  }

  async function handleSignOut(){
    const sb=await getSupabaseClient();
    if(sb) await sb.auth.signOut();
    onUserChange(null);
    onClose();
  }

  const staticContent:Record<string,{title:string;icon:string;body:string}>={
    subscription:{title:"The Docket Pro",icon:"ti-crown",body:"£4.99/month · 7-day free trial\n\n✓ Unlimited AI assistant requests\n✓ Sync across all your devices\n✓ Auto prayer times (no setup needed)\n✓ Advanced analytics & insights\n✓ Priority support\n✓ Early access to new features\n\nCancel anytime · No hidden fees\n\nSubscription management will be available once you create an account."},
    widgets:{title:"Widgets & Shortcuts",icon:"ti-layout-grid",body:"Home screen widgets are coming in a future update.\n\nYou'll be able to see:\n• Today's routine at a glance\n• Upcoming tasks and deadlines\n• Prayer times countdown\n• Quick-add task button\n\nDirectly from your home screen without opening the app."},
    siri:{title:"Siri & Shortcuts",icon:"ti-microphone",body:"Siri integration is planned for a future release.\n\nYou'll be able to say:\n• 'Add a task to The Docket'\n• 'What's on my Docket today?'\n• 'Mark my gym session as done'\n\nAll hands-free using your voice."},
    help:{title:"Help & Feedback",icon:"ti-help-circle",body:"Getting started:\n\n• Tap ✦ to open the AI assistant\n• Say what you need in plain English\n• Tap ⚙️ to access Settings\n• Enable prayer times for your location\n\nFor support or feedback:\nsupport@thedocket.app\n\nWe read every message."},
    privacy:{title:"Privacy & Permissions",icon:"ti-shield-lock",body:"Your privacy matters to us.\n\nData storage: Tasks and routines stay on your device until you create an account.\n\nLocation: Used only for prayer times via Aladhan API. Never stored or shared.\n\nNotifications: Only for scheduled item reminders. Never for marketing.\n\nAI assistant: Processed by Anthropic or Groq. No conversation data is retained after your session ends."},
    terms:{title:"Terms & Conditions",icon:"ti-file-description",body:"By using The Docket, you agree:\n\n1. The app is provided as-is without warranty\n2. You are responsible for the accuracy of your data\n3. Pro subscriptions are billed monthly\n4. Refunds available within 7 days of purchase\n5. We may update terms with reasonable notice\n6. The AI assistant is a productivity tool, not professional advice\n\nFull terms: thedocket.app/terms"},
  };

  // ── Logged-in profile view ────────────────────────────────────────────────
  if(modal==="login"&&user) return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,
      background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:dark?"#16192A":"#FFFFFF",borderRadius:24,width:"100%",maxWidth:440,
          maxHeight:"88vh",display:"flex",flexDirection:"column",
          boxShadow:"0 40px 100px rgba(0,0,0,0.5)",border:`1px solid ${C.border}`,overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"20px 24px 16px",display:"flex",justifyContent:"space-between",
          alignItems:"center",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:48,height:48,borderRadius:"50%",
              background:"linear-gradient(145deg,#6677E8,#4C5FD5)",
              display:"flex",alignItems:"center",justifyContent:"center",
              overflow:"hidden",boxShadow:"0 4px 14px rgba(76,95,213,0.4)"}}>
              {user.avatar
                ?<img src={user.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :<i className="ti ti-user" style={{fontSize:22,color:"white"}} aria-hidden="true"/>}
            </div>
            <div>
              <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,
                fontSize:16,color:C.navy}}>{user.name}</p>
              <span style={{background:"rgba(76,95,213,0.1)",color:C.primary,
                padding:"2px 10px",borderRadius:50,fontSize:10,fontWeight:700}}>
                ✓ Signed in
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted}}>
            <i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/>
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>

          {/* ── Account card ─────────────────────────────────────────────── */}
          <div style={{background:dark?"rgba(255,255,255,0.04)":"#F8F7FE",
            border:`1px solid ${C.border}`,borderRadius:16,padding:"16px 18px",marginBottom:14}}>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:"1.5px",color:C.muted2,
              textTransform:"uppercase",marginBottom:14}}>Account</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <p style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>Display Name</p>
                <div style={{display:"flex",gap:8}}>
                  <input defaultValue={user.name} id="profile-name"
                    style={{flex:1,padding:"11px 14px",borderRadius:10,
                      border:`1.5px solid ${C.border}`,fontSize:14,
                      background:dark?"#1A1D2E":"#F8F7FE",
                      color:C.navy,outline:"none",fontFamily:"inherit"}}
                    onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
                    onBlur={e=>(e.target.style.borderColor=C.border)}/>
                  <button className="sq-btn" onClick={async()=>{
                      const newName=(document.getElementById("profile-name") as HTMLInputElement)?.value?.trim();
                      if(!newName) return;
                      const sb=await getSupabaseClient();
                      if(!sb) return;
                      await sb.auth.updateUser({data:{full_name:newName}});
                      onUserChange({...user,name:newName});
                      setAuthMsg("✓ Name updated");setAuthStatus("success");
                    }}
                    style={{padding:"0 16px",borderRadius:10,fontSize:12,fontWeight:700,
                      background:"linear-gradient(135deg,#4C5FD5,#2A3699)",color:"white",
                      whiteSpace:"nowrap"}}>
                    Save
                  </button>
                </div>
              </div>
              <div>
                <p style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>Email</p>
                <input value={user.email} disabled
                  style={{width:"100%",padding:"11px 14px",borderRadius:10,
                    border:`1.5px solid ${C.border}`,fontSize:14,
                    background:dark?"#13151f":"#F0F0F8",
                    color:C.muted,fontFamily:"inherit",cursor:"not-allowed"}}/>
                <p style={{fontSize:10,color:C.muted2,marginTop:4}}>Email changes require re-verification. Contact support to update.</p>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
              <p style={{fontSize:12,fontWeight:600,color:C.navy,paddingRight:12}}>
                Email me about product updates and tips
              </p>
              <button className="sq-btn" onClick={toggleEmailOptIn}
                style={{width:52,height:28,borderRadius:14,
                  background:emailOptIn?"linear-gradient(135deg,#5DE8A0,#2E8B57)":C.border,
                  position:"relative",flexShrink:0,
                  boxShadow:emailOptIn?"0 4px 12px rgba(46,139,87,0.4)":"none"}}>
                <span style={{position:"absolute",top:4,left:emailOptIn?26:4,width:20,height:20,
                  borderRadius:"50%",background:"white",transition:"left 0.25s",
                  boxShadow:"0 2px 6px rgba(0,0,0,0.25)"}}/>
              </button>
            </div>
            {authMsg&&(
              <div style={{padding:"10px 14px",borderRadius:10,marginTop:12,fontSize:13,
                background:authStatus==="success"?"rgba(46,139,87,0.1)":"rgba(217,79,61,0.1)",
                color:authStatus==="success"?C.sage:C.urgent,
                border:`1px solid ${authStatus==="success"?"rgba(46,139,87,0.25)":"rgba(217,79,61,0.25)"}`}}>
                {authMsg}
              </div>
            )}
          </div>

          {/* ── Plan card ─────────────────────────────────────────────────── */}
          <div style={{background:dark?"rgba(255,255,255,0.04)":"#F8F7FE",
            border:`1px solid ${C.border}`,borderRadius:16,padding:"16px 18px",marginBottom:14}}>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:"1.5px",color:C.muted2,
              textTransform:"uppercase",marginBottom:14}}>Plan</p>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <div style={{width:40,height:40,borderRadius:11,flexShrink:0,
                background:isPro?"linear-gradient(145deg,#F5B342,#D98E1F)":C.surface,
                border:isPro?"none":`1px solid ${C.border}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:isPro?"0 4px 14px rgba(217,158,31,0.4)":"none"}}>
                <i className={`ti ${isPro?"ti-crown":"ti-user"}`}
                  style={{fontSize:19,color:isPro?"white":C.muted}} aria-hidden="true"/>
              </div>
              <div>
                <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:16,color:C.navy}}>
                  {isPro?(subTier==="max"?"The Docket Max":"The Docket Pro"):"Free Plan"}
                </p>
                <p style={{fontSize:11.5,color:C.muted}}>
                  {isPro
                    ?(subPeriodEnd
                        ?`Renews ${new Date(subPeriodEnd).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}`
                        :"Active subscription")
                    :"Upgrade for unlimited Opus access and more"}
                </p>
              </div>
            </div>
            {isPro ? (
              <button className="sq-btn" onClick={async()=>{
                  try{
                    const authHeaders=await getAuthHeader();
                    const res=await fetch("/api/stripe/portal",{
                      method:"POST",
                      headers:{"Content-Type":"application/json",...authHeaders}
                    });
                    const data=await res.json();
                    if(data.url) window.location.href=data.url;
                    else alert("Could not open billing portal: "+data.error);
                  }catch(e:any){alert("Something went wrong: "+e.message);}
                }}
                style={{display:"flex",width:"100%",alignItems:"center",justifyContent:"center",gap:8,
                  padding:"12px 14px",borderRadius:12,border:`1px solid ${C.border}`,
                  background:C.surface2,color:C.navy,fontSize:13,fontWeight:600}}>
                <i className="ti ti-settings" style={{fontSize:16,color:"#C9A84C"}} aria-hidden="true"/>
                Manage Subscription
              </button>
            ) : (
              <button className="sq-btn" onClick={async()=>{
                  try{
                    const authHeaders=await getAuthHeader();
                    const res=await fetch("/api/stripe/checkout",{
                      method:"POST",
                      headers:{"Content-Type":"application/json",...authHeaders},
                      body:JSON.stringify({})
                    });
                    const data=await res.json();
                    if(data.url) window.location.href=data.url;
                    else alert("Payment error: "+data.error);
                  }catch(e:any){alert("Something went wrong: "+e.message);}
                }}
                style={{display:"flex",width:"100%",alignItems:"center",justifyContent:"center",gap:8,
                  padding:"12px 14px",borderRadius:12,
                  background:"linear-gradient(135deg,#4C5FD5,#2A3699)",color:"white",
                  fontSize:13,fontWeight:700}}>
                <i className="ti ti-crown" style={{fontSize:16}} aria-hidden="true"/>
                Try Pro Free for 7 Days
              </button>
            )}
          </div>

          {/* ── Usage card ────────────────────────────────────────────────── */}
          <div style={{background:dark?"rgba(255,255,255,0.04)":"#F8F7FE",
            border:`1px solid ${C.border}`,borderRadius:16,padding:"16px 18px",marginBottom:14}}>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:"1.5px",color:C.muted2,
              textTransform:"uppercase",marginBottom:14}}>Usage this period</p>
            {isPro?(
              <>
                {/* Sonnet — uncapped for Pro, so this is a plain count rather than a fill bar with a fabricated denominator */}
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.navy,display:"flex",alignItems:"center",gap:6}}>
                      <i className="ti ti-message-circle" style={{fontSize:14,color:C.primary}} aria-hidden="true"/>
                      Sonnet 5 messages
                    </span>
                    <span style={{fontSize:12,color:C.navy}}>
                      <span style={{fontWeight:700}}>{usage?usage.sonnet_count:"–"}</span>
                      <span style={{color:C.muted2}}> · Unlimited</span>
                    </span>
                  </div>
                  <div style={{height:6,borderRadius:3,background:C.border,overflow:"hidden"}}>
                    <div style={{height:"100%",width:"100%",borderRadius:3,
                      background:"linear-gradient(90deg,#6677E8,#4C5FD5)"}}/>
                  </div>
                </div>
                {/* Opus — real 50/period cap, same usage-table row as the chat input's "Opus — N left" indicator */}
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.navy,display:"flex",alignItems:"center",gap:6}}>
                      <i className="ti ti-brain" style={{fontSize:14,color:"#8670E8"}} aria-hidden="true"/>
                      Opus 4.8 credits
                    </span>
                    <span style={{fontSize:12,fontWeight:700,color:C.navy}}>
                      {usage?usage.opus_count:"–"} / {opusLimitForTier(subTier)}
                    </span>
                  </div>
                  <div style={{height:6,borderRadius:3,background:C.border,overflow:"hidden"}}>
                    <div style={{height:"100%",
                      width:`${usage?Math.min(100,(usage.opus_count/opusLimitForTier(subTier))*100):0}%`,
                      borderRadius:3,background:"linear-gradient(90deg,#C4A8FF,#8670E8)",transition:"width 0.3s"}}/>
                  </div>
                </div>
              </>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
                  background:"rgba(76,95,213,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <i className="ti ti-chart-bar" style={{fontSize:17,color:C.primary}} aria-hidden="true"/>
                </div>
                <p style={{fontSize:12,color:C.muted,lineHeight:1.4}}>
                  Usage tracking is included with Pro — see exactly how many Sonnet and Opus messages you've used each billing period.
                </p>
              </div>
            )}
          </div>

          {/* ── AI Memory card ────────────────────────────────────────────── */}
          <div style={{background:dark?"rgba(255,255,255,0.04)":"#F8F7FE",
            border:`1px solid ${C.border}`,borderRadius:16,padding:"16px 18px",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <p style={{fontSize:10,fontWeight:700,letterSpacing:"1.5px",color:C.muted2,
                textTransform:"uppercase"}}>AI Memory</p>
              {memories.length>0&&(
                <button onClick={handleClearAllMemories} disabled={clearingMemories}
                  style={{fontSize:11,fontWeight:600,color:C.urgent,background:"none",border:"none",
                    cursor:clearingMemories?"default":"pointer",opacity:clearingMemories?0.5:1}}>
                  {clearingMemories?"Clearing…":"Clear all"}
                </button>
              )}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              paddingBottom:14,marginBottom:14,borderBottom:`1px solid ${C.border}`}}>
              <p style={{fontSize:12,fontWeight:600,color:C.navy,paddingRight:12,lineHeight:1.4}}>
                Let the AI automatically remember useful details
              </p>
              <button className="sq-btn" onClick={toggleAutoMemory}
                title={autoMemoryEnabled?"Turn off automatic memory":"Turn on automatic memory"}
                style={{width:52,height:28,borderRadius:14,
                  background:autoMemoryEnabled?"linear-gradient(135deg,#5DE8A0,#2E8B57)":C.border,
                  position:"relative",flexShrink:0,
                  boxShadow:autoMemoryEnabled?"0 4px 12px rgba(46,139,87,0.4)":"none"}}>
                <span style={{position:"absolute",top:4,left:autoMemoryEnabled?26:4,width:20,height:20,
                  borderRadius:"50%",background:"white",transition:"left 0.25s",
                  boxShadow:"0 2px 6px rgba(0,0,0,0.25)"}}/>
              </button>
            </div>
            {memoriesLoading?(
              <p style={{fontSize:12,color:C.muted}}>Loading…</p>
            ):memories.length===0?(
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
                  background:"rgba(76,95,213,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <i className="ti ti-brain" style={{fontSize:17,color:C.primary}} aria-hidden="true"/>
                </div>
                <p style={{fontSize:12,color:C.muted,lineHeight:1.4}}>
                  Nothing remembered yet — ask the assistant to remember something, or it'll pick up durable details on its own as you chat.
                </p>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {memories.map(m=>(
                  <div key={m.id} style={{display:"flex",alignItems:"flex-start",gap:8,
                    padding:"9px 10px",borderRadius:10,
                    background:dark?"rgba(255,255,255,0.03)":"white",
                    border:`1px solid ${C.border}`}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:12,color:C.navy,lineHeight:1.4}}>{m.content}</p>
                      <p style={{fontSize:10,color:C.muted2,marginTop:3}}>{formatConversationTime(m.created_at)}</p>
                    </div>
                    <button onClick={()=>handleDeleteMemory(m.id)} disabled={deletingMemoryId===m.id}
                      title="Delete memory"
                      style={{width:22,height:22,borderRadius:6,border:"none",background:"transparent",
                        cursor:"pointer",color:C.muted2,flexShrink:0,display:"flex",
                        alignItems:"center",justifyContent:"center"}}
                      onMouseEnter={e=>{e.currentTarget.style.color=C.urgent;}}
                      onMouseLeave={e=>{e.currentTarget.style.color=C.muted2;}}>
                      <i className={`ti ${deletingMemoryId===m.id?"ti-loader-2":"ti-x"}`}
                        style={{fontSize:13}} aria-hidden="true"/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Sign out ──────────────────────────────────────────────────── */}
          <div style={{height:1,background:C.border,marginBottom:14}}/>
          <button className="sq-btn" onClick={handleSignOut}
            style={{display:"flex",width:"100%",alignItems:"center",gap:10,padding:"12px 14px",
              borderRadius:12,border:`1px solid rgba(217,79,61,0.25)`,
              background:"rgba(217,79,61,0.06)",
              color:C.urgent,fontSize:13,fontWeight:600}}>
            <i className="ti ti-logout" style={{fontSize:16}} aria-hidden="true"/>
            Sign out of {user.email}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Sign-in / register view (not logged in) ───────────────────────────────
  if(modal==="login") return(
    // No backdrop-click-to-close here (unlike other modals) — this one has
    // real typed input (email/password) that an accidental outside click
    // would otherwise silently discard. Still closeable via the explicit X
    // button AuthForm renders from the onClose prop passed below.
    <div style={{position:"fixed",inset:0,zIndex:200,
      background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:dark?"#16192A":"#FFFFFF",borderRadius:24,width:"100%",maxWidth:440,
          maxHeight:"90vh",overflowY:"auto",
          boxShadow:"0 40px 100px rgba(0,0,0,0.5)",border:`1px solid ${C.border}`}}>
        <AuthForm dark={dark} onUserChange={onUserChange}
          onOpenLegal={m=>{setCameFromAuth(true);onNavigate?.(m);}}
          onSuccess={onClose} onClose={onClose}/>
      </div>
    </div>
  );

  // Premium modals
  if(modal==="subscription"){
    async function handleSubCheckout(tier:"pro"|"max"){
      // The top-level auth gate means this modal should never be reachable
      // without a real signed-in user, but this stays as a defensive guard
      // for the edge case of a sign-out happening while it's open.
      if(!user?.id){onClose();setTimeout(()=>onNavigate?.("login"),100);return;}
      try{
        const authHeaders=await getAuthHeader();
        const res=await fetch("/api/stripe/checkout",{
          method:"POST",
          headers:{"Content-Type":"application/json",...authHeaders},
          body:JSON.stringify({tier})
        });
        const data=await res.json();
        if(data.url) window.location.href=data.url;
        else{setAuthMsg("Payment error: "+data.error);setAuthStatus("error");}
      }catch(e:any){setAuthMsg("Something went wrong: "+e.message);setAuthStatus("error");}
    }
    const plans=[
      {id:"free",name:"Free",icon:"ti-user",accent:C.muted,price:"£0",priceSuffix:"/month",
        iconBg:C.surface,iconBorder:`1.5px solid ${C.border}`,
        features:[
          {icon:"ti-message-circle",label:"Sonnet messages",value:"10/day"},
          {icon:"ti-brain",label:"Opus messages",value:"—"},
          {icon:"ti-devices",label:"Device sync",value:"This device only"},
          {icon:"ti-moon-stars",label:"Prayer times",value:"Manual"},
          {icon:"ti-headset",label:"Support",value:"Community"},
          {icon:"ti-rocket",label:"Early access",value:"—"},
        ],
        cta:"Continue Free",onClick:onClose,ctaStyle:{background:"transparent",color:C.navy,border:`1.5px solid ${C.border}`}},
      {id:"pro",name:"Pro",icon:"ti-crown",accent:C.primary,price:"£4.99",priceSuffix:"/month",
        // Plain text label only now, not a frame/badge — see the card
        // render below for why (was conflicting with the selection frame).
        recommended:true,
        disclosure:"7 days free, then £4.99/month. Renews automatically until cancelled.",
        iconBg:"linear-gradient(145deg,#6677E8,#4C5FD5)",iconShadow:"0 4px 14px rgba(76,95,213,0.4)",
        features:[
          {icon:"ti-message-circle",label:"Sonnet messages",value:"Unlimited"},
          {icon:"ti-brain",label:"Opus messages",value:"50/month"},
          {icon:"ti-devices",label:"Device sync",value:"All devices"},
          {icon:"ti-moon-stars",label:"Prayer times",value:"Auto"},
          {icon:"ti-headset",label:"Support",value:"Priority 24h"},
          {icon:"ti-rocket",label:"Early access",value:"✓"},
        ],
        cta:user?.id?"Start My Free 7 Days →":"Sign in to Start Free Trial",onClick:()=>handleSubCheckout("pro"),
        ctaStyle:{background:"linear-gradient(145deg,#6677E8,#4C5FD5,#2A3699)",color:"white",border:"none",boxShadow:"0 6px 20px rgba(76,95,213,0.4)"}},
      {id:"max",name:"Max",icon:"ti-bolt",accent:"#8670E8",price:"£14.99",priceSuffix:"/month",
        disclosure:"7 days free, then £14.99/month. Renews automatically until cancelled.",
        iconBg:"linear-gradient(145deg,#A78BFA,#8670E8)",iconShadow:"0 4px 14px rgba(134,112,232,0.4)",
        features:[
          {icon:"ti-message-circle",label:"Sonnet messages",value:"500/month"},
          {icon:"ti-brain",label:"Opus messages",value:"120/month"},
          {icon:"ti-devices",label:"Device sync",value:"All devices"},
          {icon:"ti-moon-stars",label:"Prayer times",value:"Auto"},
          {icon:"ti-headset",label:"Support",value:"Priority 24h"},
          {icon:"ti-rocket",label:"Early access",value:"✓"},
        ],
        cta:user?.id?"Try Docket Max →":"Sign in to Try Max",onClick:()=>handleSubCheckout("max"),
        ctaStyle:{background:"linear-gradient(145deg,#A78BFA,#8670E8,#5B3FBF)",color:"white",border:"none",boxShadow:"0 6px 20px rgba(134,112,232,0.35)"}},
    ];
    return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,
      background:"rgba(0,0,0,0.65)",backdropFilter:"blur(10px)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:dark?"#16192A":"#FFFFFF",borderRadius:28,width:"100%",maxWidth:820,
          maxHeight:"90vh",display:"flex",flexDirection:"column",
          boxShadow:"0 40px 120px rgba(0,0,0,0.5)",border:`1px solid ${C.border}`,overflow:"hidden"}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#4C5FD5,#6677E8,#8670E8)",
          padding:"22px 24px",position:"relative",flexShrink:0,textAlign:"center"}}>
          <button onClick={onClose} style={{position:"absolute",top:14,right:14,
            background:"rgba(255,255,255,0.15)",border:"none",cursor:"pointer",
            width:28,height:28,borderRadius:7,color:"white",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <i className="ti ti-x" style={{fontSize:15}} aria-hidden="true"/></button>
          <div style={{width:44,height:44,borderRadius:12,background:"rgba(255,255,255,0.2)",
            margin:"0 auto 10px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <i className="ti ti-sparkles" style={{fontSize:22,color:"#FFD700"}} aria-hidden="true"/></div>
          <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:19,
            color:"white",marginBottom:4}}>Choose Your Plan</p>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.85)"}}>
            Free forever, or unlock more with Pro or Max
          </p>
        </div>
        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto",padding:"20px"}}>
          {authStatus==="error"&&authMsg&&(
            <div style={{padding:"10px 14px",borderRadius:10,marginBottom:16,fontSize:13,
              background:"rgba(217,79,61,0.1)",color:C.urgent,
              border:`1px solid rgba(217,79,61,0.25)`}}>
              {authMsg}
            </div>
          )}
          <div className="pricing-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16}}>
            {plans.map(plan=>{
              const selected=selectedTier===plan.id;
              return(
              <div key={plan.id} onClick={()=>setSelectedTier(plan.id as "free"|"pro"|"max")}
                style={{position:"relative",display:"flex",flexDirection:"column",cursor:"pointer",
                borderRadius:18,padding:"20px 18px",
                // One signal now, not two competing ones: the blue frame is
                // driven ONLY by selection (selectedTier, pre-set to "pro"
                // so it shows on load). "Recommended" is plain text below,
                // with no border/background/badge of its own, so it can
                // never visually compete with — or get mistaken for — the
                // selection frame, including when Pro is both recommended
                // and selected at once.
                border:selected?`2px solid ${C.primary}`:`1.5px solid ${C.border}`,
                background:dark?"rgba(255,255,255,0.02)":"#FAFAFC",
                boxShadow:selected?"0 16px 40px rgba(76,95,213,0.25)":"none"}}>
                {plan.recommended&&(
                  <p style={{textAlign:"center",fontSize:9.5,fontWeight:700,letterSpacing:0.5,
                    textTransform:"uppercase",color:C.muted2,marginBottom:8}}>Recommended</p>
                )}
                <div style={{width:44,height:44,borderRadius:12,margin:"0 auto 12px",
                  background:plan.iconBg,border:plan.iconBorder,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  boxShadow:plan.iconShadow||"none"}}>
                  <i className={`ti ${plan.icon}`} style={{fontSize:21,color:plan.iconBorder?C.muted:"white"}} aria-hidden="true"/>
                </div>
                <p style={{textAlign:"center",fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,
                  fontSize:16,color:C.navy,marginBottom:4}}>{plan.name}</p>
                <div style={{textAlign:"center",marginBottom:plan.disclosure?4:14}}>
                  <span style={{fontSize:23,fontWeight:800,fontFamily:"'Space Grotesk',sans-serif",color:C.navy}}>{plan.price}</span>
                  <span style={{fontSize:11,color:C.muted}}>{plan.priceSuffix}</span>
                </div>
                {plan.disclosure&&(
                  <p style={{textAlign:"center",fontSize:10,fontWeight:700,color:C.sage,lineHeight:1.4,marginBottom:14}}>
                    <i className="ti ti-shield-check" style={{fontSize:11}} aria-hidden="true"/> {plan.disclosure}
                  </p>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:16,flex:1}}>
                  {plan.features.map(f=>(
                    <div key={f.label} style={{display:"flex",alignItems:"center",gap:7}}>
                      <i className={`ti ${f.icon}`} style={{fontSize:13,color:plan.accent,flexShrink:0,width:15}} aria-hidden="true"/>
                      <span style={{fontSize:11,color:C.muted,flex:1}}>{f.label}</span>
                      <span style={{fontSize:11,fontWeight:700,color:C.navy,textAlign:"right"}}>{f.value}</span>
                    </div>
                  ))}
                </div>
                <button className="sq-btn" onClick={plan.onClick}
                  style={{width:"100%",padding:"11px",borderRadius:12,fontSize:12.5,fontWeight:800,
                    ...plan.ctaStyle}}>
                  {plan.cta}
                </button>
              </div>
              );
            })}
          </div>
          <p style={{display:"flex",alignItems:"center",justifyContent:"center",flexWrap:"wrap",gap:4,
            fontSize:11,color:C.muted2,marginTop:6}}>
            Cancel anytime before day 7 and you won't be charged · Secure payment via Stripe
            <i className="ti ti-lock" style={{fontSize:11,color:C.muted2}} aria-hidden="true"/>
          </p>
        </div>
      </div>
    </div>
    );
  }

  if(modal==="help") return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:dark?"#16192A":"#FFFFFF",borderRadius:28,width:"100%",maxWidth:500,maxHeight:"88vh",boxShadow:"0 40px 120px rgba(0,0,0,0.5)",border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"24px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:40,height:40,borderRadius:11,background:"linear-gradient(145deg,#6677E8,#4C5FD5)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-help-circle" style={{fontSize:20,color:"white"}} aria-hidden="true"/></div>
            <div><p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:17,color:C.navy}}>Help & Support</p>
              <p style={{fontSize:11,color:C.muted}}>We're here to help</p></div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted}}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
        </div>
        <div style={{padding:"20px 24px",overflowY:"auto",flex:1}}>
          {[
            {category:"Getting Started",icon:"ti-rocket",items:[
              {q:"How do I add my first task?",a:"Tap the + button bottom-right, or just tell the AI assistant what you need — e.g. \"add a task to revise Land Law by Friday.\""},
              {q:"What's the difference between a task and a routine?",a:"Tasks are one-off or ongoing items with a specific end, like an assignment or errand. Routines are recurring habits tied to specific days and times, like gym or prayer, and appear in your Daily Routine every week."},
              {q:"Do I need an account to use The Docket?",a:"Yes. A free account is required to use The Docket — it keeps your tasks, routines and AI conversations backed up and synced across every device you use."},
              {q:"Can I change the app's language?",a:"Yes — Settings supports English, Arabic, French, Turkish and Urdu, including full right-to-left layout for Arabic and Urdu."},
            ]},
            {category:"The AI Assistant",icon:"ti-sparkles",items:[
              {q:"What can I ask the AI assistant to do?",a:"Add, edit, complete or delete tasks and routines; find free time in your schedule; break a big task into steps; and answer questions like \"what's on tomorrow?\" — all in plain English."},
              {q:"Will it make changes without asking me first?",a:"For anything significant, like adding a new routine or rescheduling something, it confirms with you first. Simple things you explicitly asked for, like marking a task done, happen immediately."},
              {q:"Is there a limit to how much I can use it?",a:"Free accounts get 10 AI requests a day. Pro removes that limit entirely."},
              {q:"Can I undo something the AI did?",a:"Yes — just say \"undo\" and it will revert the last change it made."},
            ]},
            {category:"Tasks & Routines",icon:"ti-checkbox",items:[
              {q:"How do I mark something as done?",a:"Tap the checkbox next to any task or routine in Daily Routine, All Tasks, or Calendar view."},
              {q:"Where do finished or deleted items go?",a:"They move to Finished & Deleted in the sidebar, where you can review them or restore anything removed by mistake."},
              {q:"Can I break a task into smaller steps?",a:"Yes — open any task and use the Steps section to add a checklist, or ask the AI assistant to do it for you."},
              {q:"How accurate are the public holidays and Islamic dates on the Calendar?",a:"UK bank holidays and major awareness days are exact. Islamic dates (Ramadan, Eid, etc.) are estimates and may shift by a day depending on local moon sighting."},
            ]},
            {category:"Account & Sync",icon:"ti-devices",items:[
              {q:"How do I sync my data across devices?",a:"Create a free account from the sidebar. Once signed in, your tasks and routines sync to the cloud automatically and appear on any device you sign into."},
              {q:"I forgot my password — what do I do?",a:"On the sign-in screen, tap \"Forgot your password?\" and we'll email you a reset link."},
              {q:"Can I change my name or password later?",a:"You can update your display name any time from Profile in the sidebar. To change your password, use \"Forgot your password?\" on the sign-in screen to receive a reset link."},
            ]},
            {category:"Subscription & Billing",icon:"ti-crown",items:[
              {q:"What does Pro actually unlock?",a:"Unlimited AI requests, sync across every device, automatic prayer times, productivity insights, and priority support — see the full comparison on the Subscription screen."},
              {q:"When does my free trial end, and will I be charged automatically?",a:"Your trial lasts 7 days from when you start it. You won't be charged until it ends, and you can cancel anytime before then with nothing taken."},
              {q:"How do I cancel my subscription?",a:"Open Profile from the sidebar and manage your subscription there. Cancellation takes effect at the end of your current billing period, so you keep Pro until then."},
              {q:"Do you offer refunds?",a:"Since every subscription starts with a 7-day free trial, we generally don't refund charges made after that trial ends — but email support@thedocket.app if something's gone wrong and we'll take a look."},
            ]},
            {category:"Privacy & Data",icon:"ti-shield-lock",items:[
              {q:"Is my data safe?",a:"Yes. Your account data is encrypted in transit and at rest on EU servers. See our full Privacy Policy for details."},
              {q:"Do you sell my data or show ads?",a:"No. We don't sell data to third parties, and The Docket carries no advertising."},
            ]},
            {category:"Troubleshooting",icon:"ti-tool",items:[
              {q:"The app won't load or looks broken.",a:"Try a hard refresh (Ctrl/Cmd + Shift + R), or clear your browser cache for this site. If it persists, email us your browser and device details."},
              {q:"My tasks aren't syncing between devices.",a:"Make sure you're signed into the same account on both devices and have an internet connection — sync happens automatically in the background."},
              {q:"Notifications aren't working.",a:"Toggle notifications on in Settings, then check your browser's site permissions — it needs explicit permission to show notifications for this site."},
            ]},
          ].map((cat,ci)=>(
            <div key={ci} style={{marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <i className={`ti ${cat.icon}`} style={{fontSize:14,color:C.primary}} aria-hidden="true"/>
                <p style={{fontSize:10.5,fontWeight:700,letterSpacing:"1px",color:C.muted2,
                  textTransform:"uppercase"}}>{cat.category}</p>
              </div>
              {cat.items.map((faq,i)=>{
                const key=`${ci}-${i}`;
                const open=openFaq===key;
                return(
                  <div key={key} style={{marginBottom:8,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`}}>
                    <button onClick={()=>setOpenFaq(open?null:key)}
                      style={{width:"100%",display:"flex",gap:10,padding:"12px 14px",
                        background:dark?"rgba(255,255,255,0.03)":"#F8F7FE",alignItems:"center",
                        border:"none",cursor:"pointer",textAlign:"left"}}>
                      <p style={{flex:1,fontSize:12.5,fontWeight:700,color:C.navy}}>{faq.q}</p>
                      <i className={`ti ${open?"ti-chevron-up":"ti-chevron-down"}`}
                        style={{fontSize:13,color:C.muted2,flexShrink:0}} aria-hidden="true"/>
                    </button>
                    {open&&(
                      <div style={{padding:"12px 14px"}}>
                        <p style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{borderRadius:16,padding:"20px",marginTop:12,background:"linear-gradient(135deg,rgba(76,95,213,0.08),rgba(134,112,232,0.05))",border:`1px solid rgba(76,95,213,0.15)`}}>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:15,color:C.navy,marginBottom:6}}>Still need help?</p>
            <p style={{fontSize:13,color:C.muted,lineHeight:1.5,marginBottom:14}}>Our support team responds within 24 hours.</p>
            <a href="mailto:support@thedocket.app" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px",borderRadius:12,background:"linear-gradient(145deg,#6677E8,#4C5FD5)",color:"white",textDecoration:"none",fontSize:13,fontWeight:700}}>
              <i className="ti ti-mail" style={{fontSize:15}} aria-hidden="true"/>support@thedocket.app</a>
          </div>
        </div>
      </div>
    </div>
  );

  if(modal==="privacy") return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:dark?"#16192A":"#FFFFFF",borderRadius:28,width:"100%",maxWidth:520,maxHeight:"88vh",boxShadow:"0 40px 120px rgba(0,0,0,0.5)",border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"24px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {cameFromAuth&&(
              <button onClick={()=>onNavigate?.("login")} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,marginRight:2}}>
                <i className="ti ti-arrow-left" style={{fontSize:18}} aria-hidden="true"/></button>
            )}
            <div style={{width:40,height:40,borderRadius:11,background:"linear-gradient(145deg,#2E8B57,#1A5235)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-shield-lock" style={{fontSize:20,color:"white"}} aria-hidden="true"/></div>
            <div><p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:17,color:C.navy}}>Privacy Policy</p>
              <p style={{fontSize:11,color:C.muted}}>Last updated August 2026</p></div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted}}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
        </div>
        <div style={{padding:"20px 24px",overflowY:"auto",flex:1}}>
          <p style={{fontSize:12.5,color:C.muted,lineHeight:1.6,marginBottom:16}}>
            This policy explains what personal data The Docket collects, why, and what rights you have over it under UK data protection law (UK GDPR).
          </p>
          {[
            {icon:"ti-building",color:"#4C5FD5",title:"1. Who We Are",text:"The Docket is operated by [your legal or trading name], based in the United Kingdom. We are the data controller responsible for your personal data. Contact us at privacy@thedocket.app for anything data-related."},
            {icon:"ti-database",color:"#4C5FD5",title:"2. What We Collect",text:"Account details (name, email); the tasks, routines and notes you create; your approximate location, only if you enable prayer times; and basic technical data (browser, device, IP address) needed to run the service securely."},
            {icon:"ti-device-floppy",color:"#4C5FD5",title:"3. Local Device Preferences",text:"Some settings, like theme, language and notification preferences, are stored only in your browser's local storage for convenience. Your tasks, routines and account details always live in your encrypted account, not just locally."},
            {icon:"ti-settings",color:"#4C5FD5",title:"4. How We Use Your Data",text:"To provide the core service, process subscription payments, respond to support requests, and keep The Docket secure and working correctly. We do not use your data for advertising, and we never sell it."},
            {icon:"ti-map-pin",color:"#2E8B57",title:"5. Location Data",text:"If you switch on Accurate Prayer Times, your device's coordinates are sent to the Aladhan prayer times API for that single calculation. We don't store your location, track your movement, or share it with anyone else."},
            {icon:"ti-sparkles",color:"#8670E8",title:"6. The AI Assistant",text:"Messages you send to the Docket AI assistant are processed by our AI providers, Anthropic and/or Groq, to generate a response. We don't use your conversations to train AI models, and content isn't retained by us after your session ends."},
            {icon:"ti-credit-card",color:"#C9A84C",title:"7. Payments",text:"Subscription payments are handled entirely by Stripe, a PCI-DSS compliant processor. We never see or store your full card details — only limited billing metadata, like subscription status, is shared back to us."},
            {icon:"ti-server",color:"#4C5FD5",title:"8. Where Data Is Stored",text:"Account and task data is stored with Supabase on servers located in the EU, encrypted in transit and at rest. We only share data with the service providers named in this policy, where necessary to run The Docket."},
            {icon:"ti-cookie",color:"#C9A84C",title:"9. Cookies & Local Storage",text:"We use browser local storage to keep the app working — your tasks, theme, and language preference. This is essential to the service and isn't used for tracking or third-party advertising."},
            {icon:"ti-user-check",color:"#2E8B57",title:"10. Your Rights",text:"Under UK GDPR you can ask to access, correct, delete, or export your personal data, and object to or restrict certain processing. Email privacy@thedocket.app — we respond within 30 days. You can also complain to the ICO at ico.org.uk at any time."},
            {icon:"ti-clock",color:"#4C5FD5",title:"11. Data Retention",text:"We keep your account data for as long as your account is active. If you delete your account, we delete your personal data within 30 days, except where we're legally required to retain billing records for longer (typically 6 years, under UK tax law)."},
            {icon:"ti-shield",color:"#D94F3D",title:"12. Children's Privacy",text:"The Docket isn't directed at children under 16, and we don't knowingly collect data from anyone under that age. If you believe a child has given us personal data, contact us and we'll remove it."},
            {icon:"ti-refresh",color:"#4C5FD5",title:"13. Changes to This Policy",text:"We may update this policy as the service evolves. Material changes will be flagged in the app. Continued use of The Docket after an update means you accept the revised policy."},
          ].map((item,i)=>(
            <div key={i} style={{display:"flex",gap:14,padding:"16px 0",borderBottom:i<12?`1px solid ${C.border}`:"none"}}>
              <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:`${item.color}18`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <i className={`ti ${item.icon}`} style={{fontSize:18,color:item.color}} aria-hidden="true"/></div>
              <div><p style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:4}}>{item.title}</p>
                <p style={{fontSize:12.5,color:C.muted,lineHeight:1.6}}>{item.text}</p></div>
            </div>
          ))}
          <div style={{marginTop:16,padding:"14px",borderRadius:12,textAlign:"center",background:dark?"rgba(255,255,255,0.03)":"#F8F7FE",border:`1px solid ${C.border}`}}>
            <p style={{fontSize:12,color:C.muted}}>Questions about your data? <a href="mailto:privacy@thedocket.app" style={{color:C.primary,fontWeight:600,textDecoration:"none"}}>privacy@thedocket.app</a></p>
          </div>
        </div>
      </div>
    </div>
  );

  if(modal==="terms") return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:dark?"#16192A":"#FFFFFF",borderRadius:28,width:"100%",maxWidth:520,maxHeight:"88vh",boxShadow:"0 40px 120px rgba(0,0,0,0.5)",border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"24px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {cameFromAuth&&(
              <button onClick={()=>onNavigate?.("login")} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,marginRight:2}}>
                <i className="ti ti-arrow-left" style={{fontSize:18}} aria-hidden="true"/></button>
            )}
            <div style={{width:40,height:40,borderRadius:11,background:"linear-gradient(145deg,#6677E8,#4C5FD5)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-file-description" style={{fontSize:20,color:"white"}} aria-hidden="true"/></div>
            <div><p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:17,color:C.navy}}>Terms & Conditions</p>
              <p style={{fontSize:11,color:C.muted}}>Last updated August 2026</p></div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted}}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
        </div>
        <div style={{padding:"20px 24px",overflowY:"auto",flex:1}}>
          <p style={{fontSize:12.5,color:C.muted,lineHeight:1.6,marginBottom:16}}>
            These Terms govern your use of The Docket. Please read them alongside our Privacy Policy, which explains how we handle your data.
          </p>
          {[
            {n:"1",t:"Acceptance of These Terms",b:"By creating an account, starting a free trial, or otherwise using The Docket, you agree to be bound by these Terms. If you don't agree, please don't use the service."},
            {n:"2",t:"About the Service",b:"The Docket is a personal task, routine and scheduling app with an AI assistant, available as a free tier and a paid Pro subscription. We may add, change, or remove features over time."},
            {n:"3",t:"Eligibility",b:"You must be at least 16 years old to create an account. By registering, you confirm you meet this requirement and that the information you provide is accurate."},
            {n:"4",t:"Your Account & Security",b:"You're responsible for keeping your login credentials secure and for all activity under your account. Tell us immediately at support@thedocket.app if you suspect unauthorised access."},
            {n:"5",t:"Account Required",b:"A registered account is required to use The Docket — there is no guest or local-only mode. If you sign out, you'll need to sign back in before you can access your tasks again."},
            {n:"6",t:"Subscription, Trial & Billing",b:"Pro costs £4.99/month with a 7-day free trial. You won't be charged until the trial ends. Subscriptions renew automatically each month via Stripe until cancelled."},
            {n:"7",t:"Cancellations & Refunds",b:"Cancel anytime from your account settings — you keep Pro access until the end of the current billing period, with no further charges. Because Pro includes a free trial, we don't generally refund charges made after that trial ends, except where required by law."},
            {n:"8",t:"Acceptable Use",b:"Don't use The Docket for anything unlawful, to harass others, to attempt to access other users' data, or to interfere with or reverse-engineer the service."},
            {n:"9",t:"The AI Assistant",b:"The AI assistant is a productivity tool, not professional, legal, medical, or financial advice. It can make mistakes — always use your own judgement, especially for anything time-sensitive or important."},
            {n:"10",t:"Third-Party Services",b:"We rely on trusted providers to run The Docket: Supabase (data storage), Stripe (payments), Anthropic and Groq (AI processing), and Aladhan (prayer times). Their own terms may also apply to your use of those specific features."},
            {n:"11",t:"Intellectual Property & Your Content",b:"The Docket's design, branding and code are our property and may not be copied or redistributed without permission. You keep ownership of the tasks, notes and content you create — we store and process it only to provide the service."},
            {n:"12",t:"Privacy",b:"Our Privacy Policy explains what data we collect and how we use it, and forms part of these Terms."},
            {n:"13",t:"Disclaimers",b:"The Docket is provided \"as is.\" We aim for high reliability but don't guarantee the service will be uninterrupted, error-free, or available at all times."},
            {n:"14",t:"Limitation of Liability",b:"To the fullest extent permitted by law, we're not liable for indirect or consequential losses arising from your use of The Docket, including missed deadlines or appointments. Nothing here limits liability for death, personal injury caused by negligence, or fraud."},
            {n:"15",t:"Indemnity",b:"You agree to cover reasonable losses we incur as a direct result of your breach of these Terms or misuse of the service."},
            {n:"16",t:"Termination",b:"We may suspend or terminate accounts that breach these Terms, or that we reasonably believe are being used fraudulently or abusively. You can delete your account at any time from Settings."},
            {n:"17",t:"Changes to These Terms",b:"We may update these Terms as the service evolves. We'll flag material changes in the app; continuing to use The Docket after an update means you accept the revised Terms."},
            {n:"18",t:"Governing Law",b:"These Terms are governed by the laws of England and Wales, and any disputes are subject to the exclusive jurisdiction of the courts of England and Wales."},
          ].map((term,i)=>(
            <div key={i} style={{display:"flex",gap:14,padding:"13px 0",borderBottom:i<17?`1px solid ${C.border}`:"none"}}>
              <span style={{width:26,height:26,borderRadius:7,flexShrink:0,background:"rgba(76,95,213,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:C.primary}}>{term.n}</span>
              <div><p style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:3}}>{term.t}</p>
                <p style={{fontSize:12.5,color:C.muted,lineHeight:1.6}}>{term.b}</p></div>
            </div>
          ))}
          <div style={{marginTop:16,padding:"14px",borderRadius:12,textAlign:"center",background:dark?"rgba(255,255,255,0.03)":"#F8F7FE",border:`1px solid ${C.border}`}}>
            <p style={{fontSize:12,color:C.muted}}>Questions? <a href="mailto:legal@thedocket.app" style={{color:C.primary,fontWeight:600,textDecoration:"none"}}>legal@thedocket.app</a></p>
          </div>
        </div>
      </div>
    </div>
  );

  if(modal==="widgets"||modal==="siri") return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:dark?"#16192A":"#FFFFFF",borderRadius:28,width:"100%",maxWidth:460,boxShadow:"0 40px 120px rgba(0,0,0,0.5)",border:`1px solid ${C.border}`}}>
        <div style={{padding:"24px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:40,height:40,borderRadius:11,background:modal==="widgets"?"linear-gradient(145deg,#C9A84C,#8A6820)":"linear-gradient(145deg,#5DE8A0,#2E8B57)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className={`ti ${modal==="widgets"?"ti-layout-grid":"ti-microphone"}`} style={{fontSize:20,color:"white"}} aria-hidden="true"/></div>
            <div><p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:17,color:C.navy}}>{modal==="widgets"?"Widgets & Shortcuts":"Siri & Shortcuts"}</p>
              <p style={{fontSize:11,color:C.muted}}>Coming soon</p></div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted}}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
        </div>
        <div style={{padding:"24px"}}>
          <p style={{fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:16}}>{modal==="widgets"?"Home screen widgets and quick actions are coming in a future update.":"Siri integration and voice commands are planned for a future release."}</p>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
            {(modal==="widgets"?[{icon:"ti-home",text:"Home screen widget — today's routine at a glance"},{icon:"ti-bolt",text:"Quick add — new tasks without opening the app"},{icon:"ti-moon-stars",text:"Prayer times widget — always on your home screen"}]
              :[{icon:"ti-microphone",text:"'Hey Siri, add a task to The Docket'"},{icon:"ti-microphone",text:"'Hey Siri, what's on my Docket today?'"},{icon:"ti-microphone",text:"'Hey Siri, mark my gym session as done'"}])
              .map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,background:dark?"rgba(255,255,255,0.04)":"#F8F7FE",border:`1px solid ${C.border}`}}>
                <i className={`ti ${item.icon}`} style={{fontSize:16,color:C.primary,flexShrink:0}} aria-hidden="true"/>
                <p style={{fontSize:12.5,color:C.navy}}>{item.text}</p>
              </div>
            ))}
          </div>
          <div style={{padding:"16px",borderRadius:14,textAlign:"center",background:"linear-gradient(135deg,rgba(76,95,213,0.08),rgba(134,112,232,0.05))",border:`1px solid rgba(76,95,213,0.15)`}}>
            <a href="mailto:support@thedocket.app" style={{color:C.primary,fontWeight:600,textDecoration:"none",fontSize:13}}>Vote for this feature →</a>
          </div>
        </div>
      </div>
    </div>
  );

  return null;
}


function Drawer({isOpen,onClose,currentView,setView,onOpenModal,user,onUserChange}:{
  isOpen:boolean;onClose:()=>void;currentView:View;setView:(v:View)=>void;
  onOpenModal:(m:string)=>void;
  user:{name:string;email:string;avatar?:string;id?:string}|null;
  onUserChange:(u:{name:string;email:string;avatar?:string;id?:string}|null)=>void;
}){
  const{t,dark}=useApp();
  const C=getC(dark);
  const navItems:{key:View;label:string;icon:string}[]=[
    {key:"daily",label:"Daily Routine",icon:"ti-calendar-week"},
    {key:"all",label:"All Tasks",icon:"ti-checkbox"},
    {key:"calendar",label:"Calendar",icon:"ti-calendar"},
    {key:"archive",label:"Finished & Deleted",icon:"ti-archive"},
  ];
  const accountItems:{label:string;icon:string;modal:string}[]=[
    {label:"Subscription",icon:"ti-crown",modal:"subscription"},
  ];
  const supportItems:{label:string;icon:string;modal:string}[]=[
    {label:"Widgets & Shortcuts",icon:"ti-layout-grid",modal:"widgets"},
    {label:"Siri & Shortcuts",icon:"ti-microphone",modal:"siri"},
    {label:"Help & Feedback",icon:"ti-help-circle",modal:"help"},
    {label:"Privacy & Permissions",icon:"ti-shield-lock",modal:"privacy"},
    {label:"Terms & Conditions",icon:"ti-file-description",modal:"terms"},
  ];
  function NavBtn({item}:{item:{key:View;label:string;icon:string}}){
    const active=currentView===item.key;
    return(
      <button onClick={()=>{setView(item.key);onClose();}}
        style={{display:"flex",alignItems:"center",gap:10,width:"100%",
          textAlign:"left",padding:"11px 12px",borderRadius:10,
          fontSize:13.5,fontWeight:600,border:"none",cursor:"pointer",marginBottom:2,
          background:active?"linear-gradient(135deg,#4C5FD5,#2A3699)":"transparent",
          color:active?"white":C.muted,
          boxShadow:active?"0 4px 14px rgba(76,95,213,0.35)":"none"}}>
        <i className={`ti ${item.icon}`} style={{fontSize:17,flexShrink:0,
          color:active?"rgba(255,255,255,0.8)":C.muted2}} aria-hidden="true"/>
        {item.label}
      </button>
    );
  }
  function ActionBtn({label,icon,modal}:{label:string;icon:string;modal:string}){
    return(
      <button onClick={()=>{onOpenModal(modal);onClose();}}
        style={{display:"flex",alignItems:"center",gap:10,width:"100%",
          textAlign:"left",padding:"10px 12px",borderRadius:10,
          fontSize:13,fontWeight:500,border:"none",cursor:"pointer",
          background:"transparent",color:C.muted,marginBottom:1,transition:"all 0.12s"}}
        onMouseEnter={e=>{e.currentTarget.style.background=C.surface2;e.currentTarget.style.color=C.navy;}}
        onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.muted;}}>
        <i className={`ti ${icon}`} style={{fontSize:16,flexShrink:0,color:C.muted2}} aria-hidden="true"/>
        {label}
      </button>
    );
  }
  return(
    <>
      {isOpen&&<div onClick={onClose} style={{position:"fixed",inset:0,
        background:"rgba(0,0,0,0.45)",backdropFilter:"blur(4px)",zIndex:70}}/>}
      <aside style={{position:"fixed",top:0,left:0,bottom:0,width:264,
        background:dark?"#16192A":"#FFFFFF",
        boxShadow:"8px 0 40px rgba(0,0,0,0.3)",zIndex:71,overflowY:"auto",
        transform:isOpen?"translateX(0)":"translateX(-100%)",
        transition:"transform 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        display:"flex",flexDirection:"column"}}>
        {/* User profile section */}
        {user?(
          <div style={{padding:"16px 16px 12px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <div style={{width:44,height:44,borderRadius:"50%",flexShrink:0,
                background:"linear-gradient(145deg,#6677E8,#4C5FD5)",
                display:"flex",alignItems:"center",justifyContent:"center",
                overflow:"hidden",boxShadow:"0 4px 12px rgba(76,95,213,0.35)"}}>
                {user.avatar
                  ?<img src={user.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<i className="ti ti-user" style={{fontSize:20,color:"white"}} aria-hidden="true"/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
                  fontSize:14,color:C.navy,overflow:"hidden",textOverflow:"ellipsis",
                  whiteSpace:"nowrap"}}>{user.name}</p>
                <p style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",
                  whiteSpace:"nowrap"}}>{user.email}</p>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{onOpenModal("login");onClose();}}
                style={{flex:1,padding:"8px",borderRadius:9,fontSize:12,fontWeight:600,
                  border:`1px solid ${C.border}`,background:C.surface2,
                  color:C.navy,cursor:"pointer",display:"flex",alignItems:"center",
                  justifyContent:"center",gap:5}}>
                <i className="ti ti-user-edit" style={{fontSize:13}} aria-hidden="true"/>
                Profile
              </button>
              {user.id&&(
              <button onClick={async()=>{
                  const sb=await getSupabaseClient();
                  if(sb) await sb.auth.signOut();
                  onUserChange(null);
                  onClose();
                }}
                style={{flex:1,padding:"8px",borderRadius:9,fontSize:12,fontWeight:600,
                  border:`1px solid rgba(217,79,61,0.3)`,
                  background:"rgba(217,79,61,0.08)",
                  color:C.urgent,cursor:"pointer",display:"flex",alignItems:"center",
                  justifyContent:"center",gap:5}}>
                <i className="ti ti-logout" style={{fontSize:13}} aria-hidden="true"/>
                Sign out
              </button>
              )}
            </div>
          </div>
        ):(
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}>
            <button onClick={()=>{onOpenModal("login");onClose();}}
              style={{width:"100%",padding:"10px",borderRadius:10,fontSize:13,fontWeight:600,
                background:"linear-gradient(135deg,#4C5FD5,#2A3699)",color:"white",
                border:"none",cursor:"pointer",display:"flex",alignItems:"center",
                justifyContent:"center",gap:8,
                boxShadow:"0 4px 14px rgba(76,95,213,0.35)"}}>
              <i className="ti ti-user-circle" style={{fontSize:16}} aria-hidden="true"/>
              Sign in / Create account
            </button>
          </div>
        )}

        <div style={{padding:"10px 12px 6px"}}>
          <p style={{fontSize:9,fontWeight:700,letterSpacing:"1.5px",color:C.muted2,
            textTransform:"uppercase",padding:"4px 12px 6px"}}>Navigation</p>
          {navItems.map(item=><NavBtn key={item.key} item={item}/>)}
        </div>
        <div style={{height:1,background:C.border,margin:"4px 16px"}}/>
        <div style={{padding:"6px 12px"}}>
          <p style={{fontSize:9,fontWeight:700,letterSpacing:"1.5px",color:C.muted2,
            textTransform:"uppercase",padding:"4px 12px 6px"}}>Account</p>
          {accountItems.map(item=><ActionBtn key={item.label} {...item}/>)}
        </div>
        <div style={{height:1,background:C.border,margin:"4px 16px"}}/>
        <div style={{padding:"6px 12px"}}>
          <p style={{fontSize:9,fontWeight:700,letterSpacing:"1.5px",color:C.muted2,
            textTransform:"uppercase",padding:"4px 12px 6px"}}>Support</p>
          {supportItems.map(item=><ActionBtn key={item.label} {...item}/>)}
        </div>
        <div style={{marginTop:"auto",padding:"14px 20px",borderTop:`1px solid ${C.border}`}}>
          <p style={{fontSize:10,color:C.muted2,textAlign:"center"}}>The Docket v1.0</p>
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
  const catEntries=Object.entries(CATS);

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
      <Btn f="done" label="Finished & Deleted" count={archived.length}/>
      <div style={{height:1,background:C.border,margin:"6px 4px"}}/>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:C.muted2,
        textTransform:"uppercase",padding:"6px 10px 6px"}}>Category</p>
      <div style={{maxHeight:260,overflowY:"auto",paddingRight:2}}>
        {catEntries.map(([k,v])=>(
          <Btn key={k} f={k as Filter} label={v.label} count={open.filter(t=>t.category===k).length}/>
        ))}
      </div>
      <div style={{height:1,background:C.border,margin:"6px 4px"}}/>
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

// ── Chat blob (pure CSS/SVG — no WebGL) ─────────────────────────────────────
// Replaces the old FlowingOrb (React Three Fiber + real WebGL bloom
// rendering), which is now deleted entirely along with FlowingOrbCanvas.tsx
// and the R3F/three/postprocessing dependencies — WebGL broke repeatedly on
// iOS Safari earlier this session and was already permanently disabled in
// favor of a CSS fallback (ORB_R3F_DISABLED) before this replacement, so
// nothing here is a regression from what was actually shipping.
//
// Also now doubles as the chat's open/close control (see its two call sites
// in Chatbot below) instead of being purely decorative — the corner instance
// opens the chat, the header instance (while open) closes it.
//
// The multiple-blurred-circles-blended-with-"screen" technique is the same
// one the old CSS fallback used; new here is an SVG "goo" filter (blur, then
// sharpen the alpha channel via a color matrix, then composite) wrapping
// them, which merges what would otherwise read as three separate fuzzy
// circles into one seamless organic blob. Cheap, broadly supported, no
// WebGL — but genuinely untested on real iOS hardware yet. If it ever
// misbehaves there, the fix is just deleting the <filter> and the
// filter:url(...) line that references it; the blurred circles underneath
// still work fine on their own.
const ChatBlob=React.forwardRef<{setAmplitude:(v:number|null)=>void},
  {size?:number;active?:boolean;onClick?:()=>void;title?:string}>(
  function ChatBlob({size=52,active=false,onClick,title},ref){
    // Voice-amplitude reactivity (fed every animation frame from real TTS
    // audio while a reply is playing — see speak() in Chatbot) is applied
    // imperatively via this ref, not React state, so 60fps updates never
    // trigger a re-render — same intent as the old FlowingOrb's
    // manualAmpRef, just a direct style write instead of a value read
    // inside a WebGL render loop.
    const ampElRef=React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref,()=>({
      setAmplitude:(v:number|null)=>{
        const el=ampElRef.current;
        if(el) el.style.transform=v!=null?`scale(${1+v*0.25})`:"scale(1)";
      },
    }),[]);
    // Unique per mount so two simultaneous instances (corner + header, both
    // visible at once while the panel is open) never collide on the same
    // <filter> id.
    const gooId=React.useId().replace(/[^a-zA-Z0-9]/g,"");
    // Every looping animation's name/duration is now a FIXED string,
    // never built from `active` — changing any part of an element's
    // `animation` value (even just the duration) makes the browser treat
    // it as a new animation and restart it from 0%, regardless of whether
    // the component re-rendered or remounted. Since `active` used to be
    // interpolated directly into these five animation strings, every
    // loading-state flip (twice per message: start and end) restarted all
    // five, which read as the blob stuttering/jumping on every send and
    // receive. Speed is now changed via the Web Animations API instead
    // (below) — adjusting playbackRate on the already-running animations,
    // which speeds up or slows down the same ongoing timeline with no
    // restart.
    const breatheRef=React.useRef<HTMLDivElement>(null);
    const spinRef=React.useRef<HTMLDivElement>(null);
    const move1Ref=React.useRef<HTMLDivElement>(null);
    const move2Ref=React.useRef<HTMLDivElement>(null);
    const move3Ref=React.useRef<HTMLDivElement>(null);
    useEffect(()=>{
      const rate=active?2.2:1;
      for(const r of [breatheRef,spinRef,move1Ref,move2Ref,move3Ref]){
        const el=r.current;
        if(!el) continue;
        for(const anim of el.getAnimations()) anim.playbackRate=rate;
      }
    },[active]);
    return(
      <div onClick={onClick} title={title}
        style={{width:size,height:size,flexShrink:0,cursor:onClick?"pointer":"default"}}>
        <div ref={ampElRef} style={{width:"100%",height:"100%",transition:"transform 0.1s ease-out"}}>
          <div ref={breatheRef} style={{width:"100%",height:"100%",borderRadius:"50%",position:"relative",overflow:"hidden",
            animation:"chatBlobBreathe 3.6s ease-in-out infinite",
            transition:"box-shadow 0.3s ease",
            background:"radial-gradient(circle at 50% 50%,#2A1660,#120A30 80%)",
            boxShadow:active
              ?"0 0 28px rgba(134,112,232,0.8), 0 0 54px rgba(76,95,213,0.4)"
              :"0 0 18px rgba(134,112,232,0.45), 0 0 36px rgba(76,95,213,0.22)"}}>
            <style>{`
              @keyframes chatBlobBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
              @keyframes chatBlobMove1{0%,100%{transform:translate(-10%,-10%) scale(1)}50%{transform:translate(14%,10%) scale(1.3)}}
              @keyframes chatBlobMove2{0%,100%{transform:translate(14%,14%) scale(1.05)}50%{transform:translate(-10%,-14%) scale(0.85)}}
              @keyframes chatBlobMove3{0%,100%{transform:translate(0%,18%) scale(1)}50%{transform:translate(-18%,-6%) scale(1.2)}}
              @keyframes chatBlobSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
            `}</style>
            {/* Goo filter — was reading as three separate fuzzy circles
                instead of one blob. Two real bugs, not a device limitation:
                the trailing feComposite atop re-composited the original
                SHARP circle graphics back on top of the merged/blurred
                shape, undoing the exact softening the blur+contrast steps
                produced (removed below — the color-matrix result is now
                the filter's own output, the standard recipe). Also
                stdDeviation=6 was too weak to bridge the gap between the
                three small circles at this element size — raised to 12,
                with the color-matrix contrast retuned to match, and an
                explicit filter region added (SVG's default -10%/120% region
                risked clipping the wider blur). */}
            <svg width="0" height="0" style={{position:"absolute"}} aria-hidden="true">
              <filter id={`chatBlobGoo${gooId}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur"/>
                <feColorMatrix in="blur" mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -12" result="goo"/>
              </filter>
            </svg>
            <div ref={spinRef} style={{position:"absolute",inset:"-30%",
              animation:"chatBlobSpin 20s linear infinite",
              filter:`url(#chatBlobGoo${gooId})`}}>
              <div ref={move1Ref} style={{position:"absolute",width:"70%",height:"70%",left:"15%",top:"5%",borderRadius:"50%",
                background:"radial-gradient(circle,#A78BFA,transparent 70%)",
                animation:"chatBlobMove1 6s ease-in-out infinite",mixBlendMode:"screen"}}/>
              <div ref={move2Ref} style={{position:"absolute",width:"65%",height:"65%",left:"20%",top:"25%",borderRadius:"50%",
                background:"radial-gradient(circle,#6677E8,transparent 70%)",
                animation:"chatBlobMove2 7s ease-in-out infinite",mixBlendMode:"screen"}}/>
              <div ref={move3Ref} style={{position:"absolute",width:"60%",height:"60%",left:"10%",top:"30%",borderRadius:"50%",
                background:"radial-gradient(circle,#8670E8,transparent 70%)",
                animation:"chatBlobMove3 8s ease-in-out infinite",mixBlendMode:"screen"}}/>
            </div>
          </div>
        </div>
      </div>
    );
  });

// react-markdown renders bare <p>/<ul>/<ol>/<li>/<strong> tags with browser
// default margins, which look wrong crammed into a tight chat bubble — these
// overrides tighten spacing to match the bubble's existing typography.
// Color/font-size/line-height already inherit from the bubble's own inline
// styles, so only spacing and list markers need setting here.
const markdownComponents={
  p:({children}:any)=><p style={{margin:"0 0 6px 0"}}>{children}</p>,
  ul:({children}:any)=><ul style={{margin:"0 0 6px 0",paddingLeft:18,listStyle:"disc"}}>{children}</ul>,
  ol:({children}:any)=><ol style={{margin:"0 0 6px 0",paddingLeft:18,listStyle:"decimal"}}>{children}</ol>,
  li:({children}:any)=><li style={{marginBottom:2}}>{children}</li>,
  strong:({children}:any)=><strong style={{fontWeight:700}}>{children}</strong>,
};

// ── Chatbot ──────────────────────────────────────────────────────────────────
// Keep in sync with opusLimitForTier in app/api/ask/route.ts — this is only
// used for the "(N left)" display; the server independently enforces the
// real limit and this function has no effect on that enforcement.
function opusLimitForTier(tier?:string|null):number{
  return tier==="max"?120:50;
}

// Longest edge Anthropic recommends for image inputs — larger images are
// downscaled before they ever reach Claude, not just for payload size but
// because Claude gains no quality benefit past this resolution anyway.
const IMAGE_MAX_EDGE=1568;
// Defensive ceiling on the final base64 data URL. The resize step above
// should always land well under this in practice (a few hundred KB at
// quality 0.85) — this exists as a backstop against an unexpectedly large
// output, partly because Vercel's serverless functions cap request bodies
// around 4.5MB and the full /api/ask payload also carries the system
// prompt and prior messages, not just the image.
const IMAGE_MAX_DATAURL_LENGTH=2_000_000;

// Normalizes whatever image file the user picked — including HEIC from an
// iPhone camera, which Claude's API doesn't accept — into a size-capped
// JPEG data URL. Decoding through <img>/<canvas> is also the real
// validation: if the browser can't render the file as an image at all,
// img.onerror fires and we reject with a clear message instead of silently
// producing nothing.
function processImageFile(file:File):Promise<string>{
  return new Promise((resolve,reject)=>{
    if(file.type&&!file.type.startsWith("image/")){
      reject(new Error("That doesn't look like an image file."));
      return;
    }
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("Couldn't read that file."));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error("Couldn't decode that image — try a different file."));
      img.onload=()=>{
        let{width,height}=img;
        if(width>IMAGE_MAX_EDGE||height>IMAGE_MAX_EDGE){
          if(width>=height){height=Math.round(height*(IMAGE_MAX_EDGE/width));width=IMAGE_MAX_EDGE;}
          else{width=Math.round(width*(IMAGE_MAX_EDGE/height));height=IMAGE_MAX_EDGE;}
        }
        const canvas=document.createElement("canvas");
        canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext("2d");
        if(!ctx){reject(new Error("Couldn't process that image on this device."));return;}
        ctx.drawImage(img,0,0,width,height);
        const dataUrl=canvas.toDataURL("image/jpeg",0.85);
        if(dataUrl.length>IMAGE_MAX_DATAURL_LENGTH){
          reject(new Error("That image is too large to attach, even after compression."));
          return;
        }
        resolve(dataUrl);
      };
      img.src=reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Builds the message array actually sent to /api/ask. Only the most recent
// user turn keeps its real image bytes — every earlier message that had an
// image is downgraded to a text placeholder instead. Re-sending full image
// data for every past attachment on every subsequent request would grow
// token cost roughly with conversation length for no real benefit: Claude
// already produced whatever it needed to from that image in its own reply,
// and the placeholder preserves enough context (something was attached,
// and roughly when) for the model to still make sense of the user
// referencing "that photo" later, without re-paying for the pixels every
// turn. The trade-off is real — if the user asks a NEW question specifically
// about an older image's contents, the model only has the placeholder text,
// not the image itself, to work from — but that's a narrower case than the
// steady cost growth of keeping every image live for the whole conversation.
function buildApiMessages(msgs:{role:"user"|"assistant";content:string;imageDataUrl?:string}[]){
  const lastIdx=msgs.length-1;
  return msgs.map((m,i)=>{
    if(m.role!=="user"||!m.imageDataUrl) return{role:m.role,content:m.content};
    if(i===lastIdx){
      const base64=m.imageDataUrl.split(",")[1]??"";
      const blocks:any[]=[];
      if(m.content.trim()) blocks.push({type:"text",text:m.content});
      blocks.push({type:"image",source:{type:"base64",media_type:"image/jpeg",data:base64}});
      return{role:m.role,content:blocks};
    }
    return{role:m.role,content:(m.content.trim()?m.content+" ":"")+"[user attached an image]"};
  });
}

const CHATBOT_GREETING="Hi! I'm your Docket assistant. Tell me what you need — I'll find the best slot in your schedule and confirm before adding anything.";

// Every authenticated API route (/api/ask, /api/speak, /api/conversations,
// /api/memories, /api/stripe/checkout, /api/stripe/portal) verifies this
// same bearer token server-side rather than trusting a client-sent userId —
// this is the one place it gets attached to a request.
async function getAuthHeader():Promise<Record<string,string>>{
  const sb=await getSupabaseClient();
  if(!sb) return{};
  const{data:{session}}=await sb.auth.getSession();
  return session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{};
}

// "2 hours ago" for anything within the last day, otherwise a short date —
// matches the en-GB day-then-month convention used everywhere else in this
// app (fmtDate, the calendar views, etc.), with the year added only when
// it isn't the current one.
function formatConversationTime(iso:string):string{
  const date=new Date(iso);
  const diffMin=Math.round((Date.now()-date.getTime())/60000);
  if(diffMin<1) return "Just now";
  if(diffMin<60) return `${diffMin} minute${diffMin===1?"":"s"} ago`;
  const diffHr=Math.round(diffMin/60);
  if(diffHr<24) return `${diffHr} hour${diffHr===1?"":"s"} ago`;
  const sameYear=date.getFullYear()===new Date().getFullYear();
  return date.toLocaleDateString("en-GB",{day:"numeric",month:"short",...(sameYear?{}:{year:"numeric"})});
}

function Chatbot({tasks,routines,onAction,user,isPro,tier}:{tasks:Task[];routines:Routine[];onAction:(a:any[])=>void;
  user?:{id?:string}|null;isPro?:boolean;tier?:string|null;}){
  const{t,dark}=useApp();
  const C=getC(dark);
  // C.border/C.surface2 are near-transparent tints meant for subtle layering
  // over textured surfaces — against the input row's solid white/navy bar
  // they read as invisible. These give the mic/send/model-selector buttons
  // an actually-visible idle background+border in both themes.
  const inputBtnBg=dark?"#2A2F52":"#EEF0FB";
  const inputBtnBorder=dark?"1.5px solid rgba(255,255,255,0.18)":"1.5px solid rgba(76,95,213,0.28)";
  const[open,setOpen]=useState(false);
  const[expanded,setExpanded]=useState(false);
  // iOS Safari doesn't shrink the layout viewport when the on-screen
  // keyboard opens — only the visual viewport shrinks/scrolls — so this
  // panel's bottom-anchored position:fixed and vh-based height (both
  // relative to the layout viewport) end up placing the input row and
  // recent messages behind the keyboard instead of just above it.
  // keyboardInset is how much of the layout viewport's bottom is currently
  // covered (0 when the keyboard is closed, or on browsers without
  // visualViewport, in which case this never updates from its 0 default
  // and the panel falls back to its plain vh/bottom values below).
  const[keyboardInset,setKeyboardInset]=useState(0);
  const[visibleHeight,setVisibleHeight]=useState<number|null>(null);
  // Declared here (rather than down by its own lock effect below) so
  // updateFromViewport just below can reference it — see that function's
  // own comment for why.
  const chatScrollLockY=React.useRef(0);
  // Re-measures the visible viewport and, only while the keyboard is
  // actually covering something, cancels iOS Safari's native "scroll the
  // focused input into view" pan (see the inline comment below for why
  // that's needed at all). Extracted to a stable function — rather than
  // defined inline inside the effect below — so the input's onBlur can
  // also call it directly: relying solely on the visualViewport listener
  // meant this only ever re-ran on whatever cadence the browser delivers
  // resize/scroll events on, which on keyboard-close was slow and laggy
  // enough (~1s) to look broken, and calling scrollTo() unconditionally
  // during that close transition — not just while a keyboard was actually
  // open — fought the native close animation and could blur the input /
  // drop the keyboard as a side effect, which is what made the panel
  // depend on keeping focus to look right.
  const updateFromViewport=useCallback(()=>{
    const vv=typeof window!=="undefined"?window.visualViewport:null;
    if(!vv)return;
    setVisibleHeight(vv.height);
    const inset=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);
    setKeyboardInset(inset);
    // The position:fixed body-lock below only ever blocks manual
    // touch-drag scrolling — it does nothing to stop iOS Safari's own
    // native scroll-into-view pan, which is the actual root cause of the
    // background app becoming visible through/around this panel while
    // the input is focused. Only correct for it while the keyboard is
    // genuinely open (inset>0) — that pan can't happen once it's closed,
    // and correcting unconditionally is what caused the lag/focus-loss
    // above.
    if(inset>0&&window.scrollY!==chatScrollLockY.current){
      window.scrollTo(0,chatScrollLockY.current);
    }
  },[]);
  useEffect(()=>{
    if(!open)return;
    const vv=typeof window!=="undefined"?window.visualViewport:null;
    if(!vv)return;
    updateFromViewport();
    vv.addEventListener("resize",updateFromViewport);
    vv.addEventListener("scroll",updateFromViewport);
    return()=>{
      vv.removeEventListener("resize",updateFromViewport);
      vv.removeEventListener("scroll",updateFromViewport);
    };
  },[open,updateFromViewport]);
  // Panel background — a soft blue-violet radial glow from top-center,
  // echoing the orb, fading into the base color toward the bottom. Lives
  // on the outer panel frame only (which spans the panel's full height);
  // the header/messages/input sections are transparent so this reads as
  // one continuous background across all of them instead of each section
  // repainting its own copy relative to its own (much shorter) box.
  const DARK_PANEL_BG="radial-gradient(ellipse 140% 70% at 50% 0%, rgba(134,112,232,0.28) 0%, rgba(76,95,213,0.12) 35%, rgba(14,16,32,0) 70%), #0E1020";
  const LIGHT_PANEL_BG="radial-gradient(ellipse 140% 70% at 50% 0%, rgba(134,112,232,0.14) 0%, rgba(255,255,255,0) 65%), #FAFAF8";
  const panelBg=dark?DARK_PANEL_BG:LIGHT_PANEL_BG;
  const[messages,setMessages]=useState<{role:"user"|"assistant";content:string;imageDataUrl?:string;opusFallback?:boolean}[]>([
    {role:"assistant",content:CHATBOT_GREETING},
  ]);
  const[input,setInput]=useState("");
  // Pending image attachment — reviewed via a small preview before sending,
  // never auto-attached. Holds the already-processed (resized/JPEG) data URL.
  const[pendingImage,setPendingImage]=useState<string|null>(null);
  const[imageError,setImageError]=useState<string|null>(null);
  const fileInputRef=React.useRef<HTMLInputElement>(null);
  const[selectedModel,setSelectedModel]=useState<"sonnet"|"opus">("sonnet");
  const[modelMenuOpen,setModelMenuOpen]=useState(false);
  const[opusCount,setOpusCount]=useState<number|null>(null);
  const[loading,setLoading]=useState(false);
  // Phase 1 of persistent chat history — null until /api/ask creates (or
  // resolves) a conversation for this chat session, then reused for every
  // later turn so they land in the same conversation instead of each
  // starting a new one.
  const[conversationId,setConversationId]=useState<string|null>(null);
  // Phase 2 — the history sidebar itself.
  const[historyOpen,setHistoryOpen]=useState(false);
  const[conversations,setConversations]=useState<{id:string;title:string;updated_at:string}[]>([]);
  const[historyLoading,setHistoryLoading]=useState(false);
  const[loadingConversationId,setLoadingConversationId]=useState<string|null>(null);
  const[deletingId,setDeletingId]=useState<string|null>(null);
  const[clearingAll,setClearingAll]=useState(false);
  const[voiceOn,setVoiceOn]=useState(true);
  const voiceOnRef=React.useRef(true); // mirrors voiceOn for reads inside in-flight async speak() calls, which otherwise close over a stale value
  const orbRef=React.useRef<{setAmplitude:(v:number|null)=>void}>(null);
  const audioElRef=React.useRef<HTMLAudioElement|null>(null);
  const speakAudioCtxRef=React.useRef<AudioContext|null>(null);
  const speakRafRef=React.useRef<number>(0);
  const messagesEndRef=React.useRef<HTMLDivElement>(null);

  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({behavior:"smooth"});
  },[messages,loading]);

  // ── Voice input (speech-to-text via the browser's built-in Web Speech API) ──
  const[listening,setListening]=useState(false);
  const recognitionRef=React.useRef<any>(null);
  const speechSupported=typeof window!=="undefined"
    &&!!((window as any).SpeechRecognition||(window as any).webkitSpeechRecognition);

  useEffect(()=>{
    return()=>{recognitionRef.current?.stop();};
  },[]);

  function toggleMic(){
    if(listening){
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognitionCtor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    // Diagnostic only (iOS Safari mic button reportedly does nothing) — not
    // changing behavior here, just making every step of this path visible.
    console.log("[mic] SpeechRecognition constructor available:",!!SpeechRecognitionCtor);
    if(!SpeechRecognitionCtor){
      console.error("[mic] No SpeechRecognition/webkitSpeechRecognition on window — unsupported in this browser.");
      return;
    }
    const recognition=new SpeechRecognitionCtor();
    recognition.continuous=false;
    recognition.interimResults=true;
    recognition.onstart=()=>{console.log("[mic] recognition.onstart fired — actively listening.");};
    recognition.onresult=(e:any)=>{
      let transcript="";
      for(let i=0;i<e.results.length;i++)transcript+=e.results[i][0].transcript;
      setInput(transcript);
    };
    recognition.onend=()=>{console.log("[mic] recognition.onend fired.");setListening(false);recognitionRef.current=null;};
    recognition.onerror=(e:any)=>{
      console.error("[mic] recognition.onerror fired:",e?.error,e?.message,e);
      setListening(false);recognitionRef.current=null;
    };
    recognitionRef.current=recognition;
    setListening(true);
    try{
      recognition.start();
      console.log("[mic] recognition.start() called without throwing.");
    }catch(err){
      console.error("[mic] recognition.start() threw synchronously:",err);
      setListening(false);
      recognitionRef.current=null;
    }
  }

  function stopSpeaking(){
    if(audioElRef.current){audioElRef.current.pause();audioElRef.current=null;}
    cancelAnimationFrame(speakRafRef.current);
    orbRef.current?.setAmplitude(null);
  }

  async function speak(text:string){
    if(!voiceOn){console.log("Voice reply skipped: muted.");return;}
    if(!text.trim())return;
    stopSpeaking(); // interrupt any speech still playing from a previous reply
    try{
      const authHeaders=await getAuthHeader();
      const res=await fetch("/api/speak",{method:"POST",
        headers:{"Content-Type":"application/json",...authHeaders},
        body:JSON.stringify({text})});
      if(!res.ok){
        const errText=await res.text().catch(()=>"");
        console.error("Voice API returned an error status:",res.status,errText.slice(0,500));
        return; // voice is a nice-to-have — fail silently in the UI rather than breaking the chat
      }
      const contentType=res.headers.get("content-type")||"";
      if(!contentType.startsWith("audio/")){
        // The route responded 200 but with something that isn't audio — almost
        // always means the underlying ElevenLabs call itself failed (bad key,
        // quota exceeded, invalid voice ID) and that error got forwarded as if
        // it were the audio body. Surface the real message instead of letting
        // the browser fail with an opaque "no supported source" error.
        const bodyText=await res.text().catch(()=>"");
        console.error("Voice API did not return audio. Content-Type was:",contentType,"— body:",bodyText.slice(0,500));
        return;
      }
      const blob=await res.blob();
      const url=URL.createObjectURL(blob);
      const audio=new Audio(url);
      audioElRef.current=audio;

      let ctx=speakAudioCtxRef.current;
      if(!ctx){
        const AudioCtxClass:typeof AudioContext=
          (window as any).AudioContext||(window as any).webkitAudioContext;
        ctx=new AudioCtxClass();
        speakAudioCtxRef.current=ctx;
      }
      if(!ctx)return; // unreachable in practice, but makes the non-null case explicit to TypeScript
      const source=ctx.createMediaElementSource(audio);
      const analyser=ctx.createAnalyser();
      analyser.fftSize=512;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      const data=new Uint8Array(analyser.frequencyBinCount);

      function loop(){
        speakRafRef.current=requestAnimationFrame(loop);
        analyser.getByteFrequencyData(data);
        let sum=0;
        for(let i=0;i<data.length;i++)sum+=data[i];
        orbRef.current?.setAmplitude(sum/data.length/255);
      }
      loop();

      if(!voiceOnRef.current){
        // Muted while the fetch/decode above was still in flight — audioElRef
        // was still null when the mute click ran, so stopSpeaking() had
        // nothing to pause. Re-check right before playback actually starts.
        cancelAnimationFrame(speakRafRef.current);
        URL.revokeObjectURL(url);
        if(audioElRef.current===audio) audioElRef.current=null;
        return;
      }
      await audio.play();
      audio.onended=()=>{
        cancelAnimationFrame(speakRafRef.current);
        orbRef.current?.setAmplitude(null);
        URL.revokeObjectURL(url);
        if(audioElRef.current===audio) audioElRef.current=null;
      };
    }catch(err){
      console.error("Voice playback failed:",err);
      orbRef.current?.setAmplitude(null);
    }
  }

  // Stop any speech immediately if the chat panel is closed mid-reply
  useEffect(()=>{ if(!open) stopSpeaking(); },[open]);

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

Every reply you give is automatically spoken aloud to the user through a voice feature, in addition to being shown as text. You have a voice — never claim you can't speak, that you're text-only, or that you're unable to talk. If the user asks you to speak instead of type, just respond normally; your reply will be read aloud automatically.

Today is ${todayISO()} (${new Date().toLocaleDateString("en-GB",{weekday:"long"})}).

=== USER'S COMPLETE SCHEDULE ===
${JSON.stringify(scheduleContext(),null,2)}

=== ACTIVE TASKS ===
${JSON.stringify(tasks.filter(t=>!t.deleted&&!t.done).map(t=>({id:t.id,title:t.title,type:t.type,category:t.category,priority:t.priority,date:t.date,time:t.time,notes:t.notes})))}

=== ALL ROUTINES ===
${JSON.stringify(routines.map(r=>({id:r.id,label:r.label,days:r.days,time:r.time,duration:r.duration,intensity:r.intensity})))}

=== RESPONSE FORMAT ===
Always respond with ONLY valid JSON — no markdown, no code fences, no plain text before or after the JSON object:
{"actions": [...], "reply": "your message to the user"}

CRITICAL JSON VALIDITY RULES — a broken response shows the user nothing useful, so these are non-negotiable:
- The "reply" value must be a single JSON string. If your reply spans multiple sentences or would naturally have line breaks, use the escape sequence \n within the string — never a literal line break.
- Do not use unescaped double-quote characters inside the "reply" string. If you need to quote something the user said, use single quotes instead.
- Output exactly one JSON object and nothing else — no leading acknowledgment, no trailing notes, no markdown formatting of any kind.
- This applies no matter how many actions you're returning — even 3, 5, or 10 at once. They ALL go inside the "actions" array of that same single JSON object. Never break out of the envelope to list actions as prose, even briefly before explaining what you did.

WRONG (never do this, even with multiple actions):
added: [{"type":"add_routine","routine":{"label":"Stretch","category":"fitness","days":["mon","wed","fri"],"time":"07:00","duration":15,"intensity":"normal"}},{"type":"add_routine","routine":{"label":"Read","category":"reading","days":["mon","tue","wed","thu","fri"],"time":"21:00","duration":20,"intensity":"normal"}}]
I've set up your morning stretch and evening reading routines.

RIGHT:
{"actions":[{"type":"add_routine","routine":{"label":"Stretch","category":"fitness","days":["mon","wed","fri"],"time":"07:00","duration":15,"intensity":"normal"}},{"type":"add_routine","routine":{"label":"Read","category":"reading","days":["mon","tue","wed","thu","fri"],"time":"21:00","duration":20,"intensity":"normal"}}],"reply":"I've set up your morning stretch and evening reading routines."}

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

REMEMBER A FACT ABOUT THE USER (persists across all future conversations): {"type":"remember","content":"TEXT","source":"explicit"|"automatic"}

Multiple actions can be combined in one response: {"actions":[action1, action2, ...],"reply":"..."}

=== VALID VALUES ===
Days: mon, tue, wed, thu, fri, sat, sun
Categories: study, legal, trading, finance, business, career, health, fitness, driving, admin, property, content, personal, family, faith, technology, travel, sports, mental, medical, nutrition, reading, music, creative, language, writing, research, education, side_hustle, marketing, sales, design, content, customer, savings, investment, debt, tax, insurance, home, utilities, vehicle, shopping, childcare, pets, social, events, volunteering, charity, community, environment, cooking, other
Priorities: urgent, high, medium
Intensity: normal, high (high = physically demanding, avoid double-booking with other high intensity)

=== MEMORY ===
You can save a durable fact about this user with {"type":"remember","content":"...","source":"explicit"|"automatic"}. Saved memories are shown to you at the start of every future conversation, forever, until the user deletes them — this is not a scratchpad for the current chat, it's a standing record. Only save something you would still want to know six months from now.

ALWAYS save a memory (source: "explicit") the moment the user directly asks you to remember something, states how they want to be addressed, or gives you a standing instruction for how to treat them going forward — "remember that I...", "from now on, call me X", "just so you know, I always prefer...". Do this immediately and silently alongside whatever else you're doing in that turn; you don't need to ask permission or make a big deal of it beyond a brief acknowledgment in your reply.

OPTIONALLY save a memory (source: "automatic") when the user reveals something durable and meaningful about themselves in the course of normal conversation — a real ongoing project, a genuine standing preference, a significant life change. Be conservative: the overwhelming majority of messages should produce zero memories. If you're genuinely unsure whether something is worth remembering, don't save it — a memory you should have made but didn't costs nothing; a trivial or wrong one keeps resurfacing and erodes trust every time it does.

NEVER save an automatic memory that states or implies anything about the user's health or medical conditions, race or ethnicity, religious or philosophical beliefs, political opinions, trade union membership, sex life or sexual orientation, or genetic/biometric information — no matter how naturally it came up or how relevant it might seem to scheduling. This restriction applies ONLY to automatic memories. If the user directly and explicitly asks you to remember something in one of these categories ("remember that I'm vegetarian for religious reasons", "remember I have a peanut allergy"), that's their own deliberate choice — save it normally as an explicit memory. The restriction is specifically about you inferring and saving this on your own initiative, not about the topic being unmentionable. If you're genuinely unsure whether a detail falls into one of these categories, treat it as if it does and don't save it automatically.

The underlying task or reply is never affected by this — only whether a memory gets created alongside it:
- "I have a dentist appointment, I'm pretty anxious about it" → add_task for the appointment as normal; do NOT create a memory noting their anxiety
- "Can't do a morning workout during Ramadan, let's shift it to after Iftar" → update_routine with the new time as normal; do NOT create a memory recording their religion or fasting
- "I need Friday afternoons kept free for prayer" → schedule around it as normal; do NOT create a memory stating their religious practice

Save (automatic):
- "I'm training for a marathon in October" → an ongoing goal with real duration, worth knowing about for months
- "I'm a night owl, I do my best deep work after 10pm" → a durable pattern that should genuinely shape how you schedule things for them
- "I just started a new job as a nurse, my shifts rotate" → a significant, ongoing change to their life that affects everything else you help with

Don't save:
- "add gym at 6pm tomorrow" → a routine task request, not a fact about the person
- "I'm a bit tired today" → transient, says nothing about tomorrow
- "actually make that 7pm instead" → a one-off correction, not a lasting preference
- anything you already see listed under "WHAT YOU KNOW ABOUT THIS USER" below — don't create a duplicate of something already remembered

Write "content" as a short, self-contained statement in third person, the way you'd write a note for someone else to read later — "Prefers to be called Mo, not Mohamad" or "Training for a marathon in October" — not a copy-paste of their raw message.

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
- Any request using words like "every day", "daily", "weekly routine", "every week", "each [day]" signals a recurring routine → use add_routine with the right days, never a single one-off add_task. If someone says "set up a weekly routine" with no further detail, that is NOT enough information to act — see the disambiguation example below.

CONVERSATION STYLE:
- Talk like a sharp, friendly human assistant having an actual back-and-forth conversation — not a form that spits out "Task added." Read what the person actually said and respond to it directly, in your own words, every time.
- Match your reply length to the moment. A quick confirmation of something fully specified can be one sentence. But when you're proposing a plan, explaining a schedule, or the request is genuinely complex, take 2–5 sentences to actually explain your thinking — don't compress everything into a clipped one-liner just to be brief.
- Never reuse the same generic confirmation phrase ("Task added", "Done") without saying what was actually added — name the task or routine, the day(s)/time, and briefly why you chose that slot.
- If a request is ambiguous or underspecified — for example "set up a weekly routine for me" with no detail on what it covers, how often, or when — do NOT guess and silently add one vague task. Ask a direct follow-up question about what they want covered and roughly how often, and wait for their answer before adding anything.
- When suggesting a schedule slot, be SPECIFIC: "Tuesday and Thursday at 3pm for 60 minutes" not "sometime in the afternoon."
- For anything with real weight (a new routine, rescheduling, deleting something), confirm first — describe the plan in a sentence or two and ask if it works.
- For simple things the user already fully specified (marking something done, a time change they explicitly gave), just do it — no need to over-confirm.
- One clarifying question at a time is fine and often necessary — ask it, then act on the answer. Don't interrogate with multiple questions at once.
- If a request is only slightly vague but you can make a sensible, low-risk assumption, make the assumption, act on it, and clearly state what you assumed so they can correct it in one message — reserve outright clarifying questions for genuinely underspecified requests like the "weekly routine" example above.
- When explaining a multi-part plan or routine (e.g. laying out a full daily schedule, or summarizing several things you just added), use markdown *inside the "reply" string's text* instead of one dense paragraph: a numbered list for sequential steps, **bold** labels for the name of each task/routine/time, and a short paragraph break between distinct ideas — the way ChatGPT formats a structured answer. (This is separate from the RESPONSE FORMAT rule above, which is about the outer JSON envelope itself never being wrapped in code fences — the reply text inside it should still use markdown when it helps.) Keep single-sentence confirmations and quick answers as plain prose; save the structure for when there's genuinely more than one part to lay out.

UNDO: If user says "undo", "revert", "go back", "undo that" → use {"type":"undo"} immediately.

COMPLETION & STATUS:
- "I finished X", "done with X", "completed X", "X is done" → complete_task immediately, no confirmation
- "remove X", "delete X", "get rid of X" → remove it, confirm briefly after
- "mark X as done" → complete_task

SMART SCHEDULING EXAMPLES:
User: "set up a weekly routine for me" (nothing else specified)
→ This is too vague to act on. Do NOT add anything yet. Reply: "Happy to set that up — what do you want it to cover (study, gym, prayer, something else), and how many days a week?" Wait for their answer, then add_routine once you know.

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

  // Real Opus-credits indicator (Phase 2) — reads the usage row /api/ask
  // writes. Refetched on mount/user change and again after every send() so
  // the "(N left)" count reflects the just-sent message right away.
  const refreshOpusCount=useCallback(async()=>{
    if(!user?.id){setOpusCount(null);return;}
    const sb=await getSupabaseClient();
    if(!sb)return;
    const{data,error}=await sb.from("usage")
      .select("opus_count").eq("user_id",user.id).maybeSingle();
    if(error){console.error("Failed to load Opus usage count:",error);return;}
    setOpusCount(data?.opus_count??0);
  },[user?.id]);
  useEffect(()=>{refreshOpusCount();},[refreshOpusCount]);

  async function send(){
    if((!input.trim()&&!pendingImage)||loading)return;
    const userMsg=input.trim();
    const attachedImage=pendingImage;
    setInput("");
    setPendingImage(null);
    setImageError(null);
    // selectedModel is persistent — unlike the old one-shot toggle it is
    // NOT reset here, and applies to every message until the user changes it.
    const newMsgs=[...messages,{role:"user" as const,content:userMsg,
      ...(attachedImage?{imageDataUrl:attachedImage}:{})}];
    setMessages([...newMsgs,{role:"assistant" as const,content:"Working on it…"}]);
    setLoading(true);
    try{
      const authHeaders=await getAuthHeader();
      const res=await fetch("/api/ask",{method:"POST",
        headers:{"Content-Type":"application/json",...authHeaders},
        body:JSON.stringify({system:systemPrompt,messages:buildApiMessages(newMsgs.slice(-20)),
          ...(selectedModel==="opus"?{useOpus:true}:{}),
          ...(conversationId?{conversationId}:{})})});
      if(res.status===401){
        setMessages([...newMsgs,{role:"assistant",content:"Your session's expired — please sign in again to keep chatting."}]);
        setLoading(false);
        return;
      }
      const data=await res.json();
      // The route always returns clean {actions, reply} directly now —
      // Claude via forced tool_choice, Groq via server-side recovery — so
      // there's no raw text to parse here anymore.
      const actions=Array.isArray(data.actions)?data.actions:[];
      const reply=data.reply??"I had trouble processing that — could you try rephrasing?";
      onAction(actions);
      setMessages([...newMsgs,{role:"assistant",content:reply,
        ...(data.opusFallback?{opusFallback:true}:{})}]);
      // Only ever moves from null to a real id (or keeps the existing one) —
      // a persistence failure server-side returns null, which must never
      // knock an already-established conversation back to "start a new
      // one" on the next message.
      if(data.conversationId) setConversationId(data.conversationId);
      speak(reply);
      refreshOpusCount();
    }catch{
      setMessages([...newMsgs,{role:"assistant",content:"Something went wrong — try rephrasing."}]);
    }finally{setLoading(false);}
  }

  // Locks background scroll while the chat panel is open, mirroring the
  // position:fixed pinning technique the app-level Drawer/modal lock uses
  // (see the top-level App component) — a separate effect since the chat
  // panel is scoped to Chatbot, not one of the app-level overlays that lock
  // already covers. The two can't actually be open at once in practice (the
  // chat's own full-viewport backdrop blocks reaching the Drawer toggle or
  // anything that opens a modal while it's up), so there's no real risk of
  // the two effects fighting over document.body.style.
  //
  // Gated on `open` (the whole chat panel), not just `historyOpen` (its
  // sidebar) — that was the original scope here, which meant scrolling the
  // message list to its top/bottom bled straight through to the page behind
  // it any time the panel was open with the sidebar closed, i.e. normal
  // chat use. `open` is a strict superset of `historyOpen` (the sidebar can
  // only be open while the panel itself is), so one condition covers both.
  // (chatScrollLockY itself is declared earlier, alongside the keyboard-
  // tracking effect, which also needs to reference it.)
  useEffect(()=>{
    if(open){
      chatScrollLockY.current=window.scrollY;
      document.body.style.position="fixed";
      document.body.style.top=`-${chatScrollLockY.current}px`;
      document.body.style.width="100%";
    }else{
      document.body.style.position="";
      document.body.style.top="";
      document.body.style.width="";
      window.scrollTo(0,chatScrollLockY.current);
    }
    return()=>{
      document.body.style.position="";
      document.body.style.top="";
      document.body.style.width="";
    };
  },[open]);

  const fetchConversations=React.useCallback(async()=>{
    if(!user?.id)return;
    setHistoryLoading(true);
    try{
      const headers=await getAuthHeader();
      const res=await fetch("/api/conversations",{headers});
      const data=await res.json();
      setConversations(Array.isArray(data.conversations)?data.conversations:[]);
    }catch(err){
      console.error("Failed to load conversation history:",err);
    }finally{
      setHistoryLoading(false);
    }
  },[user?.id]);
  useEffect(()=>{if(historyOpen)fetchConversations();},[historyOpen,fetchConversations]);

  function startNewChat(){
    setMessages([{role:"assistant",content:CHATBOT_GREETING}]);
    setConversationId(null);
    setHistoryOpen(false);
  }

  async function openConversation(id:string){
    if(loadingConversationId)return;
    setLoadingConversationId(id);
    try{
      const headers=await getAuthHeader();
      const res=await fetch(`/api/conversations/${id}`,{headers});
      if(!res.ok)throw new Error(`Failed to load conversation (${res.status})`);
      const data=await res.json();
      const loaded=(data.messages??[]).map((m:any)=>({
        role:m.role,content:m.content,
        // Signed URLs from the server render exactly like the base64 data
        // URLs a fresh attachment produces — <img src> doesn't care which.
        ...(m.image_url?{imageDataUrl:m.image_url}:{}),
      }));
      setMessages(loaded.length>0?loaded:[{role:"assistant",content:CHATBOT_GREETING}]);
      setConversationId(id);
      setHistoryOpen(false);
    }catch(err){
      console.error("Failed to open conversation:",err);
    }finally{
      setLoadingConversationId(null);
    }
  }

  async function deleteConversation(id:string,e:React.MouseEvent){
    e.stopPropagation();
    if(!window.confirm("Delete this conversation? This can't be undone."))return;
    setDeletingId(id);
    try{
      const headers=await getAuthHeader();
      const res=await fetch(`/api/conversations/${id}`,{method:"DELETE",headers});
      if(!res.ok)throw new Error(`Failed to delete conversation (${res.status})`);
      setConversations(prev=>prev.filter(c=>c.id!==id));
      if(conversationId===id)startNewChat();
    }catch(err){
      console.error("Failed to delete conversation:",err);
    }finally{
      setDeletingId(null);
    }
  }

  async function clearAllHistory(){
    if(!window.confirm("Clear ALL chat history? This permanently deletes every saved conversation and can't be undone."))return;
    setClearingAll(true);
    try{
      const headers=await getAuthHeader();
      const res=await fetch("/api/conversations",{method:"DELETE",headers});
      if(!res.ok)throw new Error(`Failed to clear history (${res.status})`);
      setConversations([]);
      startNewChat();
    }catch(err){
      console.error("Failed to clear all history:",err);
    }finally{
      setClearingAll(false);
    }
  }

  return(<>
      {/* Corner blob — only rendered while closed. The header's own blob
          instance (below, inside the panel) takes over as the close
          control once open, per Round 1's two-instance approach: rather
          than one element visually traveling between the corner and the
          panel header (a true shared-element morph — a Round 2 idea if
          this feels good), the panel itself plays a scale+fade-in
          animation anchored at this corner, so opening still reads as
          "the blob expands into the panel" without the added risk of
          animating a single element's position AND size AND merging it
          into the panel shape all at once. */}
      {!open&&(
        <div style={{position:"fixed",bottom:30,right:102,zIndex:40}}>
          <ChatBlob size={60} onClick={()=>setOpen(true)} title="Open Docket AI"/>
        </div>
      )}

      {open&&(
        <>
          <div onClick={()=>{setOpen(false);setExpanded(false);}}
            style={{position:"fixed",inset:0,zIndex:58,background:"transparent"}}/>
          <div style={{position:"fixed",
            bottom:(expanded?0:20)+keyboardInset,right:expanded?0:20,
            top:expanded?0:"auto",left:expanded?0:"auto",
            zIndex:60,
            // Scoped to `right` only — that's the sole property still
            // exclusively driven by the deliberate, discrete `expanded`
            // toggle. `bottom` is now also driven by keyboardInset, which
            // visualViewport can update several times through the native
            // keyboard-open animation; animating it here would make the
            // panel chase a moving target instead of tracking the keyboard
            // directly. `top`/`left` only ever toggle between 0 and "auto",
            // which CSS can't meaningfully tween anyway.
            transition:"right 0.3s cubic-bezier(0.34,1.56,0.64,1)"}}>
            <div style={{
              width:expanded?"100vw":"min(400px, calc(100vw - 40px))",
              height:expanded
                ?(visibleHeight!=null?`${visibleHeight}px`:"100vh")
                :(visibleHeight!=null?`${Math.min(600,visibleHeight-40)}px`:"min(600px, calc(100vh - 40px))"),
              maxHeight:expanded
                ?(visibleHeight!=null?`${visibleHeight}px`:"100vh")
                :(visibleHeight!=null?`${visibleHeight-40}px`:"calc(100vh - 40px)"),
              borderRadius:expanded?0:24,
              display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",
              // Reverted to a plain, clean floating card — three rim-lit
              // passes (outward glow, then inward glow, then a gold retint)
              // never read as an intentional premium effect on a real
              // device in either theme, and the panel background itself is
              // being rethought anyway (see panelBg above). Revisit edge
              // treatment once the background tone is settled.
              background:panelBg,
              border:expanded?"none":`1px solid ${C.border}`,
              boxShadow:expanded?"none":"0 32px 80px rgba(0,0,0,0.45)",
              // Round 1 of the blob-replaces-orb work: rather than the blob
              // itself visually traveling into the panel (a true morph —
              // deferred to Round 2, only if this feels good on device),
              // the panel plays its own scale+fade-in on mount, anchored at
              // the bottom-right corner where the blob sits, so opening
              // still reads as "expanding from the blob" without the extra
              // risk of animating one element's position+size+shape at
              // once. Only fires on a genuine open — toggling `expanded`
              // afterward doesn't remount this block, so no replay.
              transformOrigin:"bottom right",
              animation:"chatPanelExpandIn 0.32s cubic-bezier(0.34,1.56,0.64,1)"}}>
              <style>{`@keyframes chatPanelExpandIn{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}`}</style>

              {/* History sidebar — slides out from the left, clipped to this
                  chat panel's own bounds (its parent has overflow:hidden),
                  not the whole app, unlike the main Drawer it borrows its
                  visual language from. */}
              {/* Excludes the sidebar's own width instead of covering the
                  whole panel (inset:0, as it did before) — under the
                  sidebar's footprint this dim was purely decorative, not
                  functional: clicks on the sidebar are already stopped via
                  e.stopPropagation() on the sidebar itself below, so the
                  overlay was never actually needed there for click-to-close.
                  Now that the sidebar shows the real panel gradient through
                  a translucent veil (see below) instead of a flat repaint,
                  leaving the dim underneath it would just be muddying the
                  exact gradient the veil is trying to reveal cleanly —
                  cutting it out keeps that gradient saturated, which also
                  sharpens the contrast against the dimmed area beside it. */}
              <div onClick={()=>setHistoryOpen(false)}
                style={{position:"absolute",top:0,right:0,bottom:0,
                  left:expanded?320:260,zIndex:9,
                  // Theme-aware — 40% black was only ever tuned for dark
                  // mode, where the panel is already deep-toned enough that
                  // it reads as "subtly inactive." In light mode the same
                  // 0.4 drags the panel to a grey-mauve that the sidebar
                  // (undimmed, sitting above this layer) doesn't share,
                  // which was most of the remaining light-mode mismatch —
                  // the veil below was never going to close a gap this
                  // large by itself. Lighter in light mode since the same
                  // "this area is inactive" signal needs far less darkening
                  // over a near-white base to read clearly.
                  background:dark?"rgba(0,0,0,0.4)":"rgba(0,0,0,0.14)",
                  opacity:historyOpen?1:0,
                  pointerEvents:historyOpen?"auto":"none",
                  transition:"opacity 0.22s"}}/>
              <div onClick={e=>e.stopPropagation()}
                style={{position:"absolute",top:0,left:0,bottom:0,zIndex:10,
                  width:expanded?320:260,
                  // Transparent-ish veil, not a repainted copy of panelBg —
                  // the same call already made for the input pill (see its
                  // own comment a bit further down), refined twice now: a
                  // flat color matching the gradient's own base endpoint was
                  // also wrong, since that endpoint is only what the
                  // *bottom* half of the panel converges to (the ellipse
                  // reaches full transparency 49% down the box) — the top,
                  // where the glow is strongest AND horizontally centered
                  // right where the sidebar sits, looked nothing like it.
                  // A veil lets the panel's actual gradient show through at
                  // every point, correct by construction, with no formula
                  // to keep in sync or scale to get wrong.
                  //
                  // A veil alone at low alpha (0.04/0.50) turned out to be a
                  // real legibility bug, not just a tuning issue: message
                  // bubbles and text scrolling behind the sidebar were
                  // visibly mixing with the sidebar's own content instead of
                  // being hidden by it. Fixed with backdrop-filter blur
                  // below, not by raising the veil alpha — a smooth
                  // gradient survives a blur essentially unchanged (colour
                  // is low-frequency), while the high-frequency detail in
                  // bubbles/text behind it is destroyed, which is exactly
                  // the separation needed: gradient continuity for the
                  // colour match, blur for the content the sidebar has to
                  // occlude. Verified via a standalone repro (mirroring
                  // this exact ancestor chain — overflow:hidden + border-
                  // radius panel, absolutely-positioned sidebar) with a
                  // marker drawn at the sidebar's measured right edge:
                  // fully illegible on the sidebar's side of that edge, at
                  // every scroll position, with no bleed either direction.
                  // Not verified on actual Safari/iOS from this
                  // environment — WebKit has a known history of
                  // backdrop-filter misbehaving under nested overflow:
                  // hidden + border-radius ancestors, and that can't be
                  // ruled out here without a real device test.
                  // Light-mode veil dropped 0.55 -> 0.20 — 0.55 over an
                  // already-light blurred gradient landed near-white, the
                  // same flat-card problem in a different disguise. Dark
                  // mode's 0.08 is untouched (see the dim-overlay comment
                  // above for the other, larger half of the light-mode fix:
                  // the overlay beside the sidebar was carrying most of the
                  // gap, not this veil).
                  backdropFilter:"blur(28px)",
                  WebkitBackdropFilter:"blur(28px)",
                  background:dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.20)",
                  borderRight:`1px solid ${dark?"rgba(255,255,255,0.10)":"rgba(20,20,43,0.08)"}`,
                  // Right edge (the one actually visible, facing into the
                  // panel) rounded to match the outer panel's own 24px
                  // corner language — was 0 (hard square cut) on every
                  // corner. Left corners stay square: in non-expanded mode
                  // they're already clipped into the outer panel's own
                  // rounded shape by its overflow:hidden, and in expanded
                  // (fullscreen) mode the outer panel itself is square too,
                  // so square left corners are correct in both states.
                  borderRadius:"0 24px 24px 0",
                  // Only painted while actually open — defensive against a
                  // reported faint shading strip down the panel's left edge
                  // that didn't reproduce in an isolated Chromium test
                  // (overflow:hidden correctly clipped both the translated
                  // sidebar and its shadow there), but could still be a
                  // Safari-specific compositing/clip quirk I can't test
                  // from here. If nothing's painted when closed, there's
                  // nothing to bleed regardless of the exact mechanism.
                  // Dialect matched to the input pill's shadow (tinted in
                  // light mode, since a colored shadow barely reads against
                  // a dark background there; flat black in dark mode, same
                  // as the pill's own dark variant) rather than the outer
                  // panel's flat-black-in-both-themes dialect it had
                  // before — offset/blur kept as a horizontal spread
                  // (appropriate for a left-anchored sliding sheet) instead
                  // of copying the pill's own all-around vertical values,
                  // which were sized for a 36px-tall pill, not a full-height
                  // panel.
                  boxShadow:historyOpen
                    ?(dark?"8px 0 28px rgba(0,0,0,0.3)":"8px 0 28px rgba(76,95,213,0.16)")
                    :"none",
                  transform:historyOpen?"translateX(0)":"translateX(-100%)",
                  transition:"transform 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                  display:"flex",flexDirection:"column",overflow:"hidden"}}>
                <div style={{padding:"16px 16px 12px",
                  borderBottom:`1px solid ${dark?"rgba(255,255,255,0.10)":"rgba(20,20,43,0.08)"}`,
                  display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                  <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:13,color:C.navy}}>
                    Chat history
                  </p>
                  <button onClick={()=>setHistoryOpen(false)} className="pill-btn"
                    style={{width:28,height:28,border:"none",background:"transparent",
                      cursor:"pointer",color:C.muted}}>
                    <i className="ti ti-x" style={{fontSize:14}} aria-hidden="true"/>
                  </button>
                </div>

                <div style={{padding:"12px 12px 8px",flexShrink:0}}>
                  {/* Same gradient as the send button, not a separate one —
                      one "primary action" token reused across the panel
                      instead of two similar-but-different gradients. */}
                  <button onClick={startNewChat}
                    style={{width:"100%",padding:"10px 14px",borderRadius:12,fontSize:12.5,fontWeight:600,
                      border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
                      background:"linear-gradient(145deg,#6677E8,#4C5FD5)",color:"white",
                      boxShadow:"0 6px 18px rgba(76,95,213,0.28)"}}>
                    <i className="ti ti-plus" style={{fontSize:14}} aria-hidden="true"/>
                    New chat
                  </button>
                </div>

                <div style={{flex:1,overflowY:"auto",padding:"6px 10px"}}>
                  {!user?.id?(
                    <p style={{fontSize:11.5,color:C.muted,padding:"16px 10px",textAlign:"center"}}>
                      Sign in to save and view your chat history.
                    </p>
                  ):historyLoading?(
                    <p style={{fontSize:11.5,color:C.muted,padding:"16px 10px",textAlign:"center"}}>Loading…</p>
                  ):conversations.length===0?(
                    <p style={{fontSize:11.5,color:C.muted,padding:"16px 10px",textAlign:"center"}}>
                      No past conversations yet.
                    </p>
                  ):conversations.map(c=>(
                    <div key={c.id} onClick={()=>openConversation(c.id)}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"10px 12px",borderRadius:12,
                        cursor:loadingConversationId?"default":"pointer",marginBottom:4,
                        opacity:loadingConversationId&&loadingConversationId!==c.id?0.5:1,
                        background:conversationId===c.id?(dark?"rgba(76,95,213,0.18)":"rgba(76,95,213,0.1)"):"transparent"}}
                      onMouseEnter={e=>{if(conversationId!==c.id)e.currentTarget.style.background=C.surface2;}}
                      onMouseLeave={e=>{if(conversationId!==c.id)e.currentTarget.style.background="transparent";}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:12,fontWeight:600,color:C.navy,whiteSpace:"nowrap",
                          overflow:"hidden",textOverflow:"ellipsis"}}>{c.title}</p>
                        <p style={{fontSize:10,color:C.muted}}>{formatConversationTime(c.updated_at)}</p>
                      </div>
                      <button onClick={e=>deleteConversation(c.id,e)}
                        disabled={deletingId===c.id}
                        title="Delete conversation"
                        style={{width:24,height:24,borderRadius:8,border:"none",background:"transparent",
                          cursor:"pointer",color:C.muted2,flexShrink:0,display:"flex",
                          alignItems:"center",justifyContent:"center"}}
                        onMouseEnter={e=>{e.currentTarget.style.color=C.urgent;}}
                        onMouseLeave={e=>{e.currentTarget.style.color=C.muted2;}}>
                        <i className={`ti ${deletingId===c.id?"ti-loader-2":"ti-trash"}`}
                          style={{fontSize:13}} aria-hidden="true"/>
                      </button>
                    </div>
                  ))}
                </div>

                {conversations.length>0&&(
                  <div style={{padding:"10px 12px 14px",
                    borderTop:`1px solid ${dark?"rgba(255,255,255,0.10)":"rgba(20,20,43,0.08)"}`,flexShrink:0}}>
                    <button onClick={clearAllHistory} disabled={clearingAll}
                      style={{width:"100%",padding:"10px",borderRadius:10,fontSize:11.5,fontWeight:600,
                        border:"1px solid rgba(217,79,61,0.3)",background:"rgba(217,79,61,0.08)",
                        color:C.urgent,cursor:clearingAll?"default":"pointer",opacity:clearingAll?0.6:1}}>
                      {clearingAll?"Clearing…":"Clear all history"}
                    </button>
                  </div>
                )}
              </div>

              {/* Header strip — no purple, no title text, but filled with the
                  same solid color as the panel itself (not transparent) so
                  it reads as one continuous surface with the message area
                  below it instead of showing the page through a see-through
                  gap. Same fill in both expanded and non-expanded — just a
                  mount point for the orb (Group B replaces it) and an
                  anchor for the control buttons. Button colors are
                  theme-aware (inputBtnBg/inputBtnBorder, the same pair the
                  input row's own attach/mic buttons use) since they no
                  longer sit on a dark purple bar that guaranteed contrast
                  regardless of theme. */}
              <div style={{
                // Transparent — the gradient lives on the outer panel frame
                // (which spans the panel's full height) so it reads as one
                // continuous background behind header+messages+input,
                // instead of each section independently repainting its own
                // copy of the same gradient relative to its own (much
                // shorter) box, which would create visible seams/repeated
                // glows at each section boundary.
                background:"transparent",
                // Expanded (fullscreen) padding tightened to match
                // non-expanded's vertical rhythm — with the title text gone,
                // the taller 16/12 padding just left extra empty height
                // above the messages for no reason. justifyContent:center
                // in expanded mode also stops the orb from reading as
                // "stranded at the far left with a large dead gap before
                // the corner buttons" — centering it makes the empty space
                // on either side look like deliberate framing instead of
                // leftover layout, without adding any placeholder content
                // (Group B fills this properly later).
                padding:expanded?"10px 24px 8px":"10px 20px 8px",
                display:"flex",flexDirection:"row",
                justifyContent:expanded?"center":"flex-start",
                alignItems:"center",gap:12,
                position:"relative",flexShrink:0}}>
                {/* Control buttons — sized/shaped to match the input row's
                    attach/mic/send (36px, fully round via pill-btn, 15px
                    icons, transparent+borderless idle, border only when a
                    button has a real "on" state to signal). Previously
                    28px/radius-8/always-boxed via inputBtnBg+inputBtnBorder
                    — the pre-restyle toolbar language that never got
                    updated when the input row moved to the de-boxed look. */}
                <div style={{position:"absolute",top:10,right:10,display:"flex",gap:10}}>
                  <button onClick={()=>setHistoryOpen(o=>!o)}
                    title="Chat history" className="pill-btn"
                    style={{width:36,height:36,
                      background:historyOpen?(dark?"rgba(76,95,213,0.35)":"rgba(76,95,213,0.18)"):"transparent",
                      border:historyOpen?inputBtnBorder:"none",
                      cursor:"pointer",color:historyOpen?C.primary:C.muted}}>
                    <i className="ti ti-history" style={{fontSize:15}} aria-hidden="true"/>
                  </button>
                  <button onClick={()=>{setVoiceOn(v=>{const next=!v;voiceOnRef.current=next;if(!next)stopSpeaking();return next;});}}
                    title={voiceOn?"Mute voice replies":"Unmute voice replies"} className="pill-btn"
                    style={{width:36,height:36,background:"transparent",border:"none",
                      cursor:"pointer",color:C.muted}}>
                    <i className={`ti ${voiceOn?"ti-volume":"ti-volume-off"}`}
                      style={{fontSize:15}} aria-hidden="true"/>
                  </button>
                  <button onClick={()=>setExpanded(e=>!e)} className="pill-btn"
                    style={{width:36,height:36,background:"transparent",border:"none",
                      cursor:"pointer",color:C.muted}}>
                    <i className={`ti ${expanded?"ti-minimize":"ti-maximize"}`}
                      style={{fontSize:15}} aria-hidden="true"/>
                  </button>
                  {/* X removed — the blob below is now the close control. */}
                </div>

                {/* The blob doubles as the close control while open (was
                    the X button above) — tapping it does the same full
                    close as the old X did (stop any playing speech, close
                    the panel, drop out of expanded mode). */}
                <div style={{flexShrink:0,
                  filter:"drop-shadow(0 0 16px rgba(134,112,232,0.6)) drop-shadow(0 0 30px rgba(76,95,213,0.3))",
                  transition:"all 0.3s"}}>
                  <ChatBlob ref={orbRef} size={expanded?42:34} active={loading}
                    onClick={()=>{stopSpeaking();setOpen(false);setExpanded(false);}}
                    title="Close"/>
                </div>
              </div>

              {/* Messages — transparent, see the header strip's comment
                  above on why (single continuous gradient on the outer
                  frame, not repainted per-section). */}
              <div style={{flex:1,overflowY:"auto",padding:"16px",
                display:"flex",flexDirection:"column",gap:10,
                background:"transparent"}}>
                {messages.map((m,i)=>(
                  <div key={i} style={{
                    maxWidth:expanded?"60%":"85%",padding:"12px 16px",
                    borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                    fontSize:13,lineHeight:1.6,
                    alignSelf:m.role==="user"?"flex-end":"flex-start",
                    background:m.role==="user"
                      ?"linear-gradient(135deg,#6677E8,#4C5FD5)"
                      :dark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.9)",
                    color:m.role==="user"?"white":C.navy,
                    boxShadow:m.role==="user"
                      ?"0 4px 14px rgba(76,95,213,0.35)"
                      :"0 2px 8px rgba(0,0,0,0.06)",
                    border:m.role==="assistant"?`1px solid ${dark?"rgba(255,255,255,0.08)":C.border}`:"none"}}>
                    {m.role==="assistant"&&(
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                        <div style={{width:16,height:16,borderRadius:"50%",
                          background:"linear-gradient(135deg,#8670E8,#4C5FD5)",
                          display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <i className="ti ti-sparkles" style={{fontSize:9,color:"white"}} aria-hidden="true"/>
                        </div>
                        <span style={{fontSize:10,fontWeight:700,color:C.primary,letterSpacing:"0.5px"}}>DOCKET AI</span>
                      </div>
                    )}
                    {m.role==="user"&&m.imageDataUrl&&(
                      <img src={m.imageDataUrl} alt="Attached"
                        style={{display:"block",maxWidth:"100%",borderRadius:10,
                          marginBottom:m.content?6:0}}/>
                    )}
                    {m.role==="assistant"
                      ?<ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
                      :m.content}
                    {m.opusFallback&&(
                      <p style={{fontSize:10.5,color:C.muted2,marginTop:6,paddingTop:6,
                        borderTop:`1px solid ${dark?"rgba(255,255,255,0.08)":C.border}`,fontStyle:"italic"}}>
                        <i className="ti ti-info-circle" style={{fontSize:11,marginRight:3}} aria-hidden="true"/>
                        Opus credits used up this month — sent with the standard model instead.
                      </p>
                    )}
                  </div>
                ))}
                {loading&&(
                  <div style={{alignSelf:"flex-start",padding:"12px 16px",borderRadius:"18px 18px 18px 4px",
                    background:dark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.9)",
                    border:`1px solid ${C.border}`,display:"flex",gap:6,alignItems:"center"}}>
                    {[0,1,2].map(i=>(
                      <div key={i} style={{width:6,height:6,borderRadius:"50%",
                        background:C.primary,opacity:0.7,
                        animation:`dot 1.2s ease-in-out ${i*0.2}s infinite`}}/>
                    ))}
                    <style>{`@keyframes dot{0%,80%,100%{transform:scale(0.8);opacity:0.4}40%{transform:scale(1.2);opacity:1}}`}</style>
                  </div>
                )}
                <div ref={messagesEndRef}/>
              </div>

              {/* Input — transparent now too (was a separate translucent
                  tint + top border, which is exactly the two-zone seam
                  being removed), same reasoning as the header/messages
                  above: one continuous gradient on the outer frame shows
                  through all three sections instead of each repainting its
                  own copy. backdropFilter dropped too — it did nothing
                  useful once this stopped being its own translucent layer. */}
              <div style={{padding:"12px 16px 16px",
                background:"transparent",flexShrink:0}}>
                {pendingImage&&(
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,
                    padding:"6px 10px",borderRadius:12,
                    background:dark?"rgba(255,255,255,0.05)":"#F0EFFC",
                    border:`1px solid ${C.border}`}}>
                    <img src={pendingImage} alt="Attached preview"
                      style={{width:36,height:36,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
                    <span style={{fontSize:11,color:C.muted,flex:1}}>Image attached</span>
                    <button onClick={()=>setPendingImage(null)} title="Remove image"
                      style={{background:"none",border:"none",cursor:"pointer",color:C.muted2,padding:4}}>
                      <i className="ti ti-x" style={{fontSize:14}} aria-hidden="true"/>
                    </button>
                  </div>
                )}
                {imageError&&(
                  <p style={{fontSize:11,color:C.urgent,marginBottom:8}}>{imageError}</p>
                )}
                {/* Chosen fill: a solid, elevated surface (unchanged
                    approach, refined values) rather than anything
                    translucent — it sits directly over the gradient panel
                    background now, and a see-through pill would pick up
                    whatever glow/color is behind it inconsistently as the
                    conversation scrolls. Border softened to a low-contrast
                    hairline (was a much more visible 1.5px C.border) and
                    the shadow widened/softened, with a faint brand-blue
                    tint in light mode — reads as "premium lifted pill"
                    rather than "boxed input," while still being clearly
                    Docket's own palette, not a ChatGPT reskin. */}
                <div style={{display:"flex",gap:10,alignItems:"center",
                  background:dark?"#1A1D3E":"#FFFFFF",
                  borderRadius:24,padding:"8px 8px 8px 18px",
                  border:`1px solid ${dark?"rgba(255,255,255,0.10)":"rgba(20,20,43,0.08)"}`,
                  boxShadow:dark?"0 8px 24px rgba(0,0,0,0.35)":"0 8px 24px rgba(76,95,213,0.12)"}}>
                  <input value={input} onChange={e=>setInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&send()}
                    // Optimistic early re-measure for when this blur means
                    // the keyboard is on its way down (e.g. tapping Send) —
                    // doesn't replace the visualViewport listener above
                    // (still the source of truth once the browser actually
                    // reports the resize), just gives it a head start
                    // instead of waiting solely on that event's own timing.
                    onBlur={updateFromViewport}
                    placeholder="Ask Docket…"
                    // minWidth:0 overrides the browser's non-zero intrinsic
                    // min-width for text inputs, which flex:1 alone doesn't
                    // touch — without it, this row's fixed-width siblings
                    // (attach, mic, send, plus the Pro-only model-selector
                    // pill) could add up to more than the panel has room
                    // for, and since the row doesn't wrap or scroll, the
                    // overflow got silently clipped by the chat panel's own
                    // overflow:hidden — send, being last, disappeared first.
                    // fontSize 16, not 13 — iOS Safari auto-zooms the whole
                    // page on focus for any input under 16px, which both
                    // looks broken and fights the keyboard-inset fix above.
                    style={{flex:1,minWidth:0,border:"none",outline:"none",fontSize:16,
                      background:"transparent",color:C.navy,fontFamily:"inherit"}}/>
                  {isPro&&(
                    <div style={{position:"relative",flexShrink:0}}>
                      {/* De-boxed — minimal inline text + chevron (like
                          ChatGPT's model switcher), no border/filled
                          background. Labels are display-only renames
                          (Sonnet->Nova, Opus->Vega); selectedModel's actual
                          values ("sonnet"|"opus") and everything routing on
                          them are untouched. */}
                      <button onClick={()=>setModelMenuOpen(v=>!v)}
                        className="pill-btn"
                        title="Choose which model sends your next messages"
                        style={{display:"flex",alignItems:"center",gap:4,height:36,
                          padding:"0 6px",whiteSpace:"nowrap",
                          border:"none",background:"transparent",color:C.muted,
                          fontSize:11,fontWeight:700,fontFamily:"inherit"}}>
                        {selectedModel==="opus"?"Vega":"Nova"}
                        <i className="ti ti-chevron-down" style={{fontSize:12,
                          transform:modelMenuOpen?"rotate(180deg)":"none",transition:"transform 0.15s"}} aria-hidden="true"/>
                      </button>
                      {modelMenuOpen&&(<>
                        <div onClick={()=>setModelMenuOpen(false)}
                          style={{position:"fixed",inset:0,zIndex:200}}/>
                        <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,
                          minWidth:190,background:dark?"#1A1D3E":"#FFFFFF",
                          border:`1.5px solid ${dark?"rgba(255,255,255,0.14)":C.border}`,
                          borderRadius:12,boxShadow:"0 8px 24px rgba(0,0,0,0.25)",
                          overflow:"hidden",zIndex:201}}>
                          <button onClick={()=>{setSelectedModel("sonnet");setModelMenuOpen(false);}}
                            style={{display:"flex",width:"100%",alignItems:"center",justifyContent:"space-between",
                              padding:"10px 14px",border:"none",cursor:"pointer",fontSize:12.5,fontWeight:600,
                              background:selectedModel==="sonnet"?(dark?"rgba(255,255,255,0.06)":"#F0EFFC"):"transparent",
                              color:C.navy,textAlign:"left",fontFamily:"inherit"}}>
                            Nova
                            {selectedModel==="sonnet"&&<i className="ti ti-check" style={{fontSize:13,color:C.primary}} aria-hidden="true"/>}
                          </button>
                          <button onClick={()=>{setSelectedModel("opus");setModelMenuOpen(false);}}
                            style={{display:"flex",width:"100%",alignItems:"center",justifyContent:"space-between",
                              padding:"10px 14px",cursor:"pointer",fontSize:12.5,fontWeight:600,
                              border:"none",borderTop:`1px solid ${dark?"rgba(255,255,255,0.08)":C.border}`,
                              background:selectedModel==="opus"?(dark?"rgba(255,255,255,0.06)":"#F0EFFC"):"transparent",
                              color:C.navy,textAlign:"left",fontFamily:"inherit"}}>
                            <span>Vega{opusCount!=null?` — ${Math.max(0,opusLimitForTier(tier)-opusCount)} left`:""}</span>
                            {selectedModel==="opus"&&<i className="ti ti-check" style={{fontSize:13,color:C.primary,marginLeft:8}} aria-hidden="true"/>}
                          </button>
                        </div>
                      </>)}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}}
                    onChange={async e=>{
                      const file=e.target.files?.[0];
                      e.target.value="";
                      if(!file) return;
                      setImageError(null);
                      try{
                        const dataUrl=await processImageFile(file);
                        setPendingImage(dataUrl);
                      }catch(err:any){
                        setImageError(err?.message||"Couldn't process that image.");
                      }
                    }}/>
                  {/* Idle state de-boxed (no border/fill, just a muted
                      icon) to match the cleaner toolbar look — toggled/
                      active states (image attached, mic listening) keep
                      their filled accent color so they're still clearly
                      "on," they just no longer have a permanent border/fill
                      while idle. */}
                  <button onClick={()=>fileInputRef.current?.click()} title="Attach an image"
                    className="pill-btn"
                    style={{width:36,height:36,
                      background:pendingImage?C.primary:"transparent",
                      color:pendingImage?"white":C.muted,
                      border:pendingImage?"1.5px solid transparent":"none",cursor:"pointer",
                      flexShrink:0}}>
                    <i className="ti ti-paperclip" style={{fontSize:15}} aria-hidden="true"/>
                  </button>
                  {speechSupported&&(
                    <button onClick={toggleMic} title={listening?"Stop listening":"Speak your message"}
                      className="pill-btn"
                      style={{width:36,height:36,
                        background:listening?"#E14D4D":"transparent",
                        color:listening?"white":C.muted,
                        border:listening?"1.5px solid #E14D4D":"none",cursor:"pointer",
                        flexShrink:0,animation:listening?"micPulse 1.2s ease-in-out infinite":"none"}}>
                      <i className="ti ti-microphone" style={{fontSize:15}} aria-hidden="true"/>
                    </button>
                  )}
                  <style>{`@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(225,77,77,0.5)}50%{box-shadow:0 0 0 8px rgba(225,77,77,0)}}`}</style>
                  {/* Kept as the accent button (filled brand gradient) once
                    there's something to send, matching attach/mic's new
                    transparent/borderless idle state otherwise instead of
                    the old boxed inputBtnBg/inputBtnBorder fallback. */}
                  <button onClick={send} disabled={loading||(!input.trim()&&!pendingImage)}
                    className="pill-btn"
                    style={{width:36,height:36,
                      background:(input.trim()||pendingImage)
                        ?"linear-gradient(145deg,#6677E8,#4C5FD5)"
                        :"transparent",
                      color:(input.trim()||pendingImage)?"white":C.muted,
                      border:(input.trim()||pendingImage)?"1.5px solid transparent":"none",cursor:"pointer",
                      opacity:loading||(!input.trim()&&!pendingImage)?0.5:1,flexShrink:0}}>
                    <i className="ti ti-send" style={{fontSize:15}} aria-hidden="true"/>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
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
  public:    {bg:"#E4E9F9",color:"#3D52A0",icon:"ti-flag"},
  religious: {bg:"#DCF0E6",color:"#1f7a52",icon:"ti-building"},
  awareness: {bg:"#F6E9D3",color:"#9c6a1f",icon:"ti-heart-handshake"},
  cultural:  {bg:"#FFE4F0",color:"#a53070",icon:"ti-confetti"},
  islamic:   {bg:"#DCF0E6",color:"#1f7a52",icon:"ti-moon-stars"},
  bank:      {bg:"#EDE0F5",color:"#7a3a9e",icon:"ti-building-bank"},
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
            padding:"3px 8px",borderRadius:6,display:"inline-flex",alignItems:"center",gap:4}}>
            <i className={`ti ${v.icon}`} style={{fontSize:11}} aria-hidden="true"/>
            {k.charAt(0).toUpperCase()+k.slice(1)}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",borderBottom:`1px solid ${C.border}`}}>
          {DOW.map(d=>(
            <div key={d} style={{padding:"8px 4px",textAlign:"center",fontSize:10.5,
              fontWeight:700,color:C.muted,background:C.surface2}}>{d}</div>
          ))}
        </div>
        {/* Days */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))"}}>
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
                        <i className={`ti ${st.icon}`} style={{fontSize:8}} aria-hidden="true"/> {ev.name}
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
                    <i className={`ti ${st.icon}`} style={{fontSize:16,color:st.color,flexShrink:0}} aria-hidden="true"/>
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
  // time starts null so server-render and the client's pre-hydration render
  // are identical (both show the placeholder) — Date() is only ever evaluated
  // inside useEffect, which runs client-side only, after hydration completes.
  const[time,setTime]=useState<Date|null>(null);
  useEffect(()=>{
    setTime(new Date());
    const id=setInterval(()=>setTime(new Date()),1000);
    return()=>clearInterval(id);
  },[]);
  const hh=time?String(time.getHours()).padStart(2,"0"):"--";
  const mm=time?String(time.getMinutes()).padStart(2,"0"):"--";
  const ss=time?String(time.getSeconds()).padStart(2,"0"):"--";
  const dateLabel=time?time.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"";
  const weekNum=time?String(Math.ceil((time.getDate()+new Date(time.getFullYear(),time.getMonth(),1).getDay())/7)):"–";
  const monthShort=time?time.toLocaleDateString("en-GB",{month:"short"}):"";
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
          {dateLabel}
        </p>
      </div>
      <div style={{textAlign:"right"}}>
        <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,
          color:C.muted2,letterSpacing:"2px",textTransform:"uppercase"}}>Week</p>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:28,
          color:C.navy,lineHeight:1,marginTop:2}}>
          {weekNum}
        </p>
        <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,
          color:C.muted2,letterSpacing:"1px",textTransform:"uppercase",marginTop:2}}>
          of {monthShort}
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
  {id:"other",icon:"ti-dots-circle-horizontal",label:"Something Else"},
];

function OnboardingScreen({onComplete,dark,onOpenModal,user,onUserChange}:{
  onComplete:(goals:string[])=>void;
  dark:boolean;
  onOpenModal:(m:string)=>void;
  user:{name:string;email:string;avatar?:string;id?:string}|null;
  onUserChange:(u:{name:string;email:string;avatar?:string;id?:string}|null)=>void;
}){
  const C=getC(dark);
  const[step,setStep]=useState(0);
  const[goals,setGoals]=useState<string[]>([]);
  const[otherGoalText,setOtherGoalText]=useState("");
  const[animating,setAnimating]=useState(false);

  function next(){
    setAnimating(true);
    setTimeout(()=>{setStep(s=>s+1);setAnimating(false);},350);
  }
  function finish(){
    setAnimating(true);
    setTimeout(()=>onComplete(goals),600);
  }
  function toggleGoal(id:string){
    setGoals(g=>g.includes(id)?g.filter(x=>x!==id):[...g,id]);
  }
  async function handleCheckout(tier:"pro"|"max"){
    // Complete onboarding first (seed goal tasks, mark docket-onboarded) so
    // the user always lands back in the real app after checkout — whether
    // they finish the Stripe flow, cancel, or just close that tab.
    onComplete(goals);
    try{
      const authHeaders=await getAuthHeader();
      const res=await fetch("/api/stripe/checkout",{
        method:"POST",
        headers:{"Content-Type":"application/json",...authHeaders},
        body:JSON.stringify({tier})
      });
      const data=await res.json();
      if(data.url) window.location.href=data.url;
      else alert("Payment error: "+data.error);
    }catch(e:any){alert("Something went wrong: "+e.message);}
  }

  const steps=[
    // Step 0: Sign in / register — required before continuing. Once `user`
    // is set (fresh sign-in, or a restored session on reload/OAuth-return),
    // show a lightweight confirmation instead of re-prompting for a login.
    <div key="0">
      {user ? (
        <div style={{textAlign:"center"}}>
          <div style={{width:64,height:64,borderRadius:"50%",margin:"0 auto 20px",overflow:"hidden",
            background:"linear-gradient(145deg,#8BA8FF 0%,#4C5FD5 45%,#1A2566 100%)",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 16px 48px rgba(76,95,213,0.5)"}}>
            {user.avatar
              ?<img src={user.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              :<i className="ti ti-check" style={{fontSize:32,color:"white"}} aria-hidden="true"/>}
          </div>
          <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:28,fontWeight:800,
            color:C.navy,letterSpacing:"-0.5px",marginBottom:8,lineHeight:1.2}}>
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p style={{fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:28}}>
            You're signed in as {user.email}.
          </p>
          <button className="pill-btn" onClick={next}
            style={{background:"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)",
              color:"white",padding:"16px 48px",fontSize:16,fontWeight:700,
              boxShadow:"0 8px 28px rgba(76,95,213,0.5)"}}>
            Continue
          </button>
        </div>
      ):(
        <AuthForm dark={dark} onUserChange={onUserChange} onOpenLegal={onOpenModal}/>
      )}
    </div>,

    // Step 1: Goals
    <div key="1" style={{textAlign:"center"}}>
      <div style={{width:52,height:52,borderRadius:14,margin:"0 auto 16px",
        background:"linear-gradient(145deg,#5DE8A0 0%,#2E8B57 45%,#1A5235 100%)",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 12px 36px rgba(46,139,87,0.45)"}}>
        <i className="ti ti-target" style={{fontSize:24,color:"white"}} aria-hidden="true"/>
      </div>
      <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:26,fontWeight:800,
        color:C.navy,letterSpacing:"-0.5px",marginBottom:8}}>
        What do you want to track?
      </h2>
      <p style={{fontSize:14,color:C.muted,marginBottom:24}}>
        Pick everything that matters to you. Your Docket will be built around these.
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
        {OB_GOALS.map(g=>{
          const active=goals.includes(g.id);
          return(
            <button key={g.id} onClick={()=>toggleGoal(g.id)}
              style={{padding:"10px 12px",borderRadius:12,cursor:"pointer",
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
      {goals.includes("other")&&(
        <input type="text" value={otherGoalText} onChange={e=>setOtherGoalText(e.target.value)}
          placeholder="What else would you like to track?" maxLength={80}
          style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`2px solid ${C.border}`,
            background:C.surface2,color:C.navy,fontSize:13,marginBottom:20,
            fontFamily:"inherit",boxSizing:"border-box"}}/>
      )}
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

    // Step 2: Account choice
    <div key="2" style={{textAlign:"center"}}>
      <div style={{width:52,height:52,borderRadius:14,margin:"0 auto 16px",
        background:"linear-gradient(145deg,#FFD580 0%,#E8A020 45%,#B06800 100%)",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 12px 36px rgba(232,160,32,0.5)"}}>
        <i className="ti ti-crown" style={{fontSize:24,color:"white"}} aria-hidden="true"/>
      </div>
      <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:26,fontWeight:800,
        color:C.navy,letterSpacing:"-0.5px",marginBottom:8}}>How do you want to start?</h2>
      <p style={{fontSize:14,color:C.muted,marginBottom:28}}>
        Start free or unlock the full Docket experience.
      </p>

      {/* Pro option */}
      <button onClick={()=>handleCheckout("pro")}
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
            <p style={{fontWeight:700,fontSize:15,color:C.primary,marginBottom:2}}>Try Pro free for 7 days</p>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.4}}>
              Then £4.99/mo (16p a day) · 50 Opus messages/mo · Sync everywhere · Cancel anytime
            </p>
          </div>
        </div>
        <div style={{marginTop:12,display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Everything in free","Unlimited Sonnet messages","Sync across devices","Prayer time auto-update","Advanced analytics","Priority support"].map(f=>(
            <span key={f} style={{fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:50,
              background:"rgba(76,95,213,0.1)",border:"1px solid rgba(76,95,213,0.2)",
              color:C.primary}}>{f}</span>
          ))}
        </div>
      </button>
      <p style={{fontSize:11,color:C.muted2,marginTop:8,marginBottom:16}}>
        7 days free, then £4.99/mo · Renews automatically until cancelled
      </p>

      {/* Max option */}
      <button onClick={()=>handleCheckout("max")}
        style={{width:"100%",padding:"18px 20px",borderRadius:16,cursor:"pointer",
          border:"2px solid #8670E8",
          background:"linear-gradient(135deg,rgba(134,112,232,0.08),rgba(167,139,250,0.05))",
          marginBottom:8,textAlign:"left",position:"relative",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:44,height:44,borderRadius:12,
            background:"linear-gradient(145deg,#A78BFA,#8670E8)",
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
            boxShadow:"0 4px 14px rgba(134,112,232,0.4)"}}>
            <i className="ti ti-bolt" style={{fontSize:22,color:"white"}} aria-hidden="true"/>
          </div>
          <div style={{textAlign:"left"}}>
            <p style={{fontWeight:700,fontSize:15,color:"#8670E8",marginBottom:2}}>Go further with Max</p>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.4}}>
              £14.99/mo · 500 Sonnet + 120 Opus messages/mo · Priority support
            </p>
          </div>
        </div>
        <div style={{marginTop:12,display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Everything in Pro","500 Sonnet messages/mo","120 Opus messages/mo","Priority support","Early access"].map(f=>(
            <span key={f} style={{fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:50,
              background:"rgba(134,112,232,0.1)",border:"1px solid rgba(134,112,232,0.2)",
              color:"#8670E8"}}>{f}</span>
          ))}
        </div>
      </button>
      <p style={{fontSize:11,color:C.muted2,marginTop:8,marginBottom:16}}>
        7 days free, then £14.99/mo · Renews automatically until cancelled
      </p>

      <p onClick={next}
        style={{fontSize:12,color:C.muted,marginTop:18,fontWeight:600,
          textDecoration:"underline",cursor:"pointer"}}>
        Skip trial, continue with Free
      </p>
    </div>,

    // Step 3: AI intro
    <div key="3" style={{textAlign:"center"}}>
      <div style={{width:52,height:52,borderRadius:14,margin:"0 auto 16px",
        background:"linear-gradient(145deg,#C4A8FF 0%,#8670E8 45%,#4A2A9E 100%)",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 12px 36px rgba(134,112,232,0.5)"}}>
        <i className="ti ti-sparkles" style={{fontSize:24,color:"white"}} aria-hidden="true"/>
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
      <div className="glass" style={{position:"relative",width:"100%",maxWidth:440,
        borderRadius:28,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",
        boxShadow:"0 40px 120px rgba(0,0,0,0.3)",
        opacity:animating?0:1,transform:animating?"translateY(12px)":"translateY(0)",
        transition:"opacity 0.35s ease, transform 0.35s ease"}}>

        {/* Header row - progress dots (no close button — onboarding must be completed, starting with sign-in) */}
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",
          padding:"24px 24px 0",flexShrink:0}}>
          <div style={{display:"flex",gap:8}}>
            {steps.map((_,i)=>(
              <div key={i} style={{height:4,borderRadius:2,transition:"all 0.3s",
                width:i===step?28:8,
                background:i<=step?C.primary:C.border}}/>
            ))}
          </div>
        </div>

        {/* Step content - scrollable. Step 0's AuthForm supplies its own
            24px horizontal padding (shared with InfoModal's login modal),
            so drop this wrapper's sides there to avoid doubling it up. */}
        <div style={{flex:1,overflowY:"auto",
          padding:(step===0&&!user)?"24px 0 28px":"24px 24px 28px"}}>
          {steps[step]}
        </div>
      </div>
    </div>
  );
}

// ── Sign-in gate ─────────────────────────────────────────────────────────────
// Shown instead of the app on a returning device with no authenticated user
// (post-sign-out, or any device where docket-onboarded is already true) — a
// lighter-weight sibling to OnboardingScreen's step 0 rather than reusing the
// full first-time wizard, since re-picking goals and plan tier makes no sense
// for someone who's already been through onboarding once.
function SignInGate({dark,onUserChange,onOpenModal}:{
  dark:boolean;
  onUserChange:(u:{name:string;email:string;avatar?:string;id?:string}|null)=>void;
  onOpenModal:(m:string)=>void;
}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",
      alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{position:"absolute",inset:0,
        background:dark?"rgba(8,10,20,0.92)":"rgba(237,232,245,0.92)",
        backdropFilter:"blur(20px)"}}/>
      <div className="glass" style={{position:"relative",width:"100%",maxWidth:440,
        borderRadius:28,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",
        boxShadow:"0 40px 120px rgba(0,0,0,0.3)"}}>
        {/* No heading of our own here — AuthForm renders its own
            "Welcome / Sign in to sync your data" header, so a second one
            above it would just repeat the same message. */}
        <div style={{flex:1,overflowY:"auto",padding:"24px 0 28px"}}>
          <AuthForm dark={dark} onUserChange={onUserChange} onOpenLegal={onOpenModal}/>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Home(){
  const[isDrawerOpen,setIsDrawerOpen]=useState(false);
  const[currentView,setCurrentView]=useState<View>("daily");
  const[isLoaded,setIsLoaded]=useState(false);
  // True once the initial Supabase session check has resolved (found a
  // session, found none, or Supabase isn't configured) — distinguishes
  // "still checking, don't judge yet" from "confirmed no real user," so the
  // top-level auth gate below can show a brief loading state instead of
  // flashing the sign-in screen at a user whose session just hasn't
  // restored yet.
  const[authChecked,setAuthChecked]=useState(false);
  const[taskFilter,setTaskFilter]=useState<Filter>("all");
  const[editingTask,setEditingTask]=useState<Task|null>(null);
  const[isAddingTask,setIsAddingTask]=useState(false);
  const[selectedWeekDay,setSelectedWeekDay]=useState(todayDayKey());
  const[selectedDate,setSelectedDate]=useState(todayISO());
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
  const[activeModal,setActiveModal]=useState<string|null>(null);

  // Starts null so server-render and the client's pre-hydration render are
  // identical (both show the placeholder) — same pattern LiveClock already
  // uses for the same reason. The header subtitle and the calendar view's
  // fallback day label both called new Date().toLocaleDateString(...)
  // directly in JSX; on this statically-prerendered page that bakes in
  // whatever date was true at BUILD time, which then mismatches the
  // client's real current date at hydration (React error #418) from the
  // moment of deploy onward. Setting the real date only inside an effect,
  // client-side, after hydration completes, avoids the mismatch entirely.
  const[clientToday,setClientToday]=useState<Date|null>(null);
  useEffect(()=>{setClientToday(new Date());},[]);

  // Lock body scroll when drawer or modal is open. overflow:hidden alone
  // doesn't reliably block touch-scroll bleed-through to the page behind an
  // open drawer on mobile browsers (notably iOS Safari) — pinning the body
  // with position:fixed at its current scroll offset, then restoring both
  // the position and the scroll offset on unlock, does.
  const scrollLockY=React.useRef(0);
  useEffect(()=>{
    const locked=isDrawerOpen||!!activeModal||onboarding;
    if(locked){
      scrollLockY.current=window.scrollY;
      document.body.style.position="fixed";
      document.body.style.top=`-${scrollLockY.current}px`;
      document.body.style.width="100%";
    }else{
      document.body.style.position="";
      document.body.style.top="";
      document.body.style.width="";
      window.scrollTo(0,scrollLockY.current);
    }
    return()=>{
      document.body.style.position="";
      document.body.style.top="";
      document.body.style.width="";
    };
  },[isDrawerOpen,activeModal,onboarding]);
  const[user,setUser]=useState<{name:string;email:string;avatar?:string;id?:string}|null>(null);
  const[showWelcome,setShowWelcome]=useState(false);
  const[welcomeMsg,setWelcomeMsg]=useState("");
  const[obStep,setObStep]=useState(0);
  const[obName,setObName]=useState("");
  const[obGoals,setObGoals]=useState<string[]>([]);
  const[obComplete,setObComplete]=useState(false);

  const C=getC(dark);
  const dir:("ltr"|"rtl")=RTL_LANGS.includes(lang)?"rtl":"ltr";
  const t=(k:string)=>T[lang]?.[k]??T.en[k]??k;
  const dayLabels=DAY_LABELS_LANG[lang]??DAY_LABELS;

  useEffect(()=>{
    // Tabler Icons CSS now loads via a <link> in app/layout.tsx's <head>
    // instead of being injected here — see that file for why.
    const t=localStorage.getItem(STORAGE_TASKS);
    const r=localStorage.getItem(STORAGE_ROUTINES);
    const urlParams=new URLSearchParams(window.location.search);
    // Debug console (Eruda) — only ever loads with ?debug=1 in the URL, e.g.
    // for diagnosing mobile-only issues (like the iOS Safari mic bug) without
    // a Mac to plug into. Never loads for normal users.
    if(urlParams.get("debug")==="1"&&!document.querySelector('[data-eruda]')){
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/eruda';
      script.setAttribute('data-eruda','1');
      script.onload=()=>{(window as any).eruda?.init();};
      document.body.appendChild(script);
    }
    // Handle Stripe redirect
    if(urlParams.get("subscription")==="success"){
      const purchasedTier=urlParams.get("tier")==="max"?"Max":"Pro";
      setWelcomeMsg(`🎉 You're now on The Docket ${purchasedTier}!`);
      setShowWelcome(true);
      setTimeout(()=>setShowWelcome(false),5000);
      window.history.replaceState({},"",window.location.pathname);
    }
    const visited=localStorage.getItem("docket-onboarded");
    // Guest mode is gone — this key used to restore a fake {name,
    // email:"Guest"} identity with no real Supabase account behind it.
    // Clear it unconditionally so a stale key from before that removal can
    // never resurface it.
    localStorage.removeItem("docket-user-name");
    const savedNotif=localStorage.getItem("docket-notif");
    if(savedNotif==="true") setNotifEnabled(true);
    // Check for existing Supabase session
    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(supabaseUrl&&supabaseKey){
      (async()=>{
        try{
          const sb=await getSupabaseClient();
          if(!sb){setAuthChecked(true);return;}
          const{data:{session}}=await sb.auth.getSession();
          if(session?.user){
            const u=session.user;
            const displayName=u.user_metadata?.full_name||u.email?.split("@")[0]||"User";
            setUser({name:displayName,email:u.email||"",avatar:u.user_metadata?.avatar_url,id:u.id});
            // docket-onboarded is per-DEVICE, but onboarding completion is
            // recorded per-ACCOUNT too (see completeOnboarding) — so a
            // device that's never seen this account before doesn't force it
            // through the wizard again. Also caches the flag locally so
            // future visits on this device skip this round-trip entirely.
            if(u.user_metadata?.onboarding_complete===true){
              localStorage.setItem("docket-onboarded","true");
              setOnboarding(false);
            }
          }
          setAuthChecked(true);
          sb.auth.onAuthStateChange((event,session)=>{
            if(session?.user){
              const u=session.user;
              const displayName=u.user_metadata?.full_name||u.email?.split("@")[0]||"User";
              setUser({name:displayName,email:u.email||"",avatar:u.user_metadata?.avatar_url,id:u.id});
              if(u.user_metadata?.onboarding_complete===true){
                localStorage.setItem("docket-onboarded","true");
                setOnboarding(false);
              }
              // Only show welcome on explicit sign in, not on page load session restore
              if(event==="SIGNED_IN"){
                const firstName=displayName.split(" ")[0];
                setWelcomeMsg(firstName);
                setShowWelcome(true);
                setTimeout(()=>setShowWelcome(false),4000);
              }
            } else if(event==="SIGNED_OUT"){
              setUser(null);
              setShowWelcome(false);
              // Sign-out only ends the Supabase session — tasks/routines are
              // local React state mirrored into localStorage, neither of
              // which auth touches on its own. Without this, the previous
              // account's data stays fully visible after signing out, since
              // the UI renders from this state, not from localStorage
              // directly (localStorage is only ever read once, on initial
              // mount). Device-level preferences (theme, language,
              // notifications, onboarding-complete) are deliberately left
              // alone — they aren't "whose data is this," and clearing
              // docket-onboarded would force a returning user through the
              // whole onboarding wizard again.
              setTasks([]);
              setRoutines([]);
              localStorage.removeItem(STORAGE_TASKS);
              localStorage.removeItem(STORAGE_ROUTINES);
            }
          });
        }catch(e){ console.log("Supabase session check failed",e); setAuthChecked(true); }
      })();
    }else{
      setAuthChecked(true);
    }
    setTasks(t?JSON.parse(t):defaultTasks());
    setRoutines(r?JSON.parse(r):defaultRoutines());
    setIsLoaded(true);
    if(!visited) setOnboarding(true);
  },[]);
  useEffect(()=>{if(isLoaded)localStorage.setItem(STORAGE_TASKS,JSON.stringify(tasks));},[tasks,isLoaded]);
  useEffect(()=>{if(isLoaded)localStorage.setItem(STORAGE_ROUTINES,JSON.stringify(routines));},[routines,isLoaded]);

  // ── Cloud sync (Supabase) — only for real signed-in accounts, not guests ──
  const cloudSyncingRef=React.useRef(false); // guard: true while pulling cloud data down, to skip the immediate echo-push back up
  const prevRoutineIdsRef=React.useRef<number[]>([]);

  async function loadCloudData(userId:string){
    const sb=await getSupabaseClient();
    if(!sb)return;
    const[{data:cloudTasks},{data:cloudRoutines}]=await Promise.all([
      sb.from("tasks").select("*").eq("user_id",userId),
      sb.from("routines").select("*").eq("user_id",userId),
    ]);
    cloudSyncingRef.current=true;
    const hasCloudTasks=!!cloudTasks&&cloudTasks.length>0;
    const hasCloudRoutines=!!cloudRoutines&&cloudRoutines.length>0;
    if(hasCloudTasks||hasCloudRoutines){
      // Account already has cloud data (e.g. signing in on a second device) — cloud wins
      if(hasCloudTasks)setTasks(cloudTasks!.map(rowToTask));
      if(hasCloudRoutines){
        const mapped=cloudRoutines!.map(rowToRoutine);
        setRoutines(mapped);
        prevRoutineIdsRef.current=mapped.map(r=>r.id);
      }
    }else{
      // First time this account has synced — push whatever's on this device up
      if(tasks.length>0) await sb.from("tasks").upsert(tasks.map(t=>taskToRow(t,userId)));
      if(routines.length>0){
        await sb.from("routines").upsert(routines.map(r=>routineToRow(r,userId)));
        prevRoutineIdsRef.current=routines.map(r=>r.id);
      }
    }
    setTimeout(()=>{cloudSyncingRef.current=false;},300);
  }

  useEffect(()=>{
    if(user?.id&&isLoaded) loadCloudData(user.id);
  },[user?.id,isLoaded]);

  // ── Pro status — reads the subscriptions row the Stripe webhook writes.
  // RLS restricts this to the signed-in user's own row. current_period_end
  // feeds the Plan card's renewal date in InfoModal; tier ('pro'/'max')
  // feeds the Opus limit shown in the Usage card and the chat input's
  // "Opus — N left" indicator.
  const[isPro,setIsPro]=useState(false);
  const[subPeriodEnd,setSubPeriodEnd]=useState<string|null>(null);
  const[subTier,setSubTier]=useState<string|null>(null);
  useEffect(()=>{
    if(!user?.id){setIsPro(false);setSubPeriodEnd(null);setSubTier(null);return;}
    let cancelled=false;
    (async()=>{
      const sb=await getSupabaseClient();
      if(!sb)return;
      const{data,error}=await sb.from("subscriptions")
        .select("status,current_period_end,tier").eq("user_id",user.id).maybeSingle();
      if(cancelled)return;
      if(error){console.error("Failed to load subscription status:",error);return;}
      // "trialing" grants the same full access as "active" — it's a trial
      // of the paid tier, not a lesser one, and Stripe reports it as
      // "trialing" (not "active") for the first 7 days by design.
      setIsPro(data?.status==="active"||data?.status==="trialing");
      setSubPeriodEnd(data?.current_period_end??null);
      setSubTier(data?.tier??null);
    })();
    return()=>{cancelled=true;};
  },[user?.id]);

  useEffect(()=>{
    if(!isLoaded||!user?.id||cloudSyncingRef.current)return;
    const uid=user.id;
    (async()=>{
      const sb=await getSupabaseClient();
      if(!sb||tasks.length===0)return;
      await sb.from("tasks").upsert(tasks.map(t=>taskToRow(t,uid)));
    })();
  },[tasks,isLoaded,user?.id]);

  useEffect(()=>{
    if(!isLoaded||!user?.id||cloudSyncingRef.current)return;
    const uid=user.id;
    (async()=>{
      const sb=await getSupabaseClient();
      if(!sb)return;
      if(routines.length>0) await sb.from("routines").upsert(routines.map(r=>routineToRow(r,uid)));
      const currentIds=routines.map(r=>r.id);
      const removed=prevRoutineIdsRef.current.filter(id=>!currentIds.includes(id));
      if(removed.length>0) await sb.from("routines").delete().in("id",removed);
      prevRoutineIdsRef.current=currentIds;
    })();
  },[routines,isLoaded,user?.id]);

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
    }catch(e:any){
      // Diagnostic only — behavior/UI message unchanged for now. Differentiate
      // the two failure points in the try block above: geolocation vs the
      // Aladhan fetch/response, so the console shows what actually broke
      // instead of a single generic "could not get location" guess.
      const isGeoError=e&&typeof e.code==="number"&&typeof e.message==="string"&&!(e instanceof Error);
      if(isGeoError){
        const codeNames:Record<number,string>={1:"PERMISSION_DENIED",2:"POSITION_UNAVAILABLE",3:"TIMEOUT"};
        console.error(`Prayer times: geolocation failed — code ${e.code} (${codeNames[e.code]??"unknown"}): ${e.message}`);
      } else if(e instanceof TypeError){
        console.error("Prayer times: network/fetch failure —",e.message,e);
      } else if(e instanceof Error){
        console.error("Prayer times: API/processing failure —",e.message,e);
      } else {
        console.error("Prayer times: unexpected failure —",e);
      }
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
  const[clearingArchive,setClearingArchive]=useState(false);
  // Deletes every finished/deleted task — nothing live is touched, since
  // the filter matches exactly what the archive view itself shows
  // (t.done||t.deleted). deleteTask above is a soft delete (only ever sets
  // deleted:true, never actually removes anything), and the tasks
  // cloud-sync effect only ever upserts — unlike the routines one right
  // below it, tasks has no "detect removed IDs and delete them from
  // Supabase" step at all. Filtering local state alone would look cleared
  // but not stay that way: the very next loadCloudData() (any reload, or
  // signing in elsewhere) does a full cloud-wins replace of tasks, which
  // would silently bring every "cleared" item back. So this explicitly
  // deletes the same rows from Supabase too, scoped to just the archived
  // IDs, rather than building out generic delete-tracking for all task
  // removals.
  async function clearArchive(){
    if(!window.confirm("Clear all finished and deleted tasks? This permanently removes them and can't be undone."))return;
    setClearingArchive(true);
    try{
      const archivedIds=tasks.filter(t=>t.done||t.deleted).map(t=>t.id);
      setTasks(p=>p.filter(t=>!(t.done||t.deleted)));
      if(user?.id&&archivedIds.length>0){
        const sb=await getSupabaseClient();
        if(sb){
          const{error}=await sb.from("tasks").delete().in("id",archivedIds);
          if(error) console.error("Failed to delete archived tasks from Supabase:",error);
        }
      }
    }finally{
      setClearingArchive(false);
    }
  }
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
    const next=!notifEnabled;
    setNotifEnabled(next);
    localStorage.setItem("docket-notif",next?"true":"false");
    if(next && typeof Notification!=="undefined" && Notification.permission!=="granted"){
      try{ await Notification.requestPermission(); }catch(e){}
    }
    if(next && typeof Notification!=="undefined" && Notification.permission==="granted"){
      try{ new Notification("The Docket",{body:"Notifications are on!"}); }catch(e){}
    }
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
    // Starts ~6 months (183 days) before the current week's Monday, not at
    // it. The previous fix (14 days back) helped but was still a fixed
    // window with a hard edge a few weeks back — a planner needs real
    // history, so this is a generously large fixed range rather than a
    // slightly-less-small one. Considered making the range grow
    // dynamically as the user scrolls back (extending the array near the
    // scroll edge) instead of a fixed window, but that needs careful
    // scroll-position preservation across a prepend (a classically fiddly
    // problem — get it slightly wrong and the list visibly jumps) for a
    // planner where "several months of history" already comfortably
    // covers realistic use. Not pursuing it unless this bound ever proves
    // insufficient in practice. Forward reach (20 days past Monday) is
    // unchanged. See the mount effect below for why today still needs to
    // be the default visible position despite the list starting so much
    // earlier.
    const start=new Date(monday);start.setDate(monday.getDate()-183);
    return Array.from({length:204},(_,i)=>{
      const d=new Date(start);d.setDate(start.getDate()+i);
      const key=["sun","mon","tue","wed","thu","fri","sat"][d.getDay()];
      return{key,date:d.toISOString().slice(0,10),dayNum:d.getDate(),
        label:d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}),
        month:d.toLocaleDateString("en-GB",{month:"short"})};
    });
  })();

  // weekDates now starts 2 weeks before today (see above), so without this
  // the day-picker strip would default to showing that earlier range on
  // load/view-switch instead of today — re-centers on today's chip
  // whenever the Daily view becomes active. Runs after paint (useEffect,
  // not useLayoutEffect), so the chip already exists in the DOM from this
  // same render by the time it fires.
  useEffect(()=>{
    if(currentView==="daily"){
      document.getElementById("day-picker-today")?.scrollIntoView({inline:"start",block:"nearest"});
    }
  },[currentView]);

  const dayScrollElRef=React.useRef<HTMLDivElement|null>(null);
  const dayTrackRef=React.useRef<HTMLDivElement|null>(null);
  const dayDragRef=React.useRef<{startX:number;startLeft:number;max:number;range:number}|null>(null);
  const[dayScrollMetrics,setDayScrollMetrics]=useState({left:0,max:1,client:1});
  const[viewedDate,setViewedDate]=useState<string|null>(null);

  // Drives both the slider thumb and the "where am I" date label from the
  // day-picker's actual scroll position. Deliberately NOT a native "scroll"
  // event listener: verified via a standalone repro that setting scrollLeft
  // programmatically (as the slider drag below does) — and scrolling more
  // generally — doesn't reliably dispatch a "scroll" event promptly in
  // every browser context (iOS Safari in particular is documented to fire
  // "scroll" only sparsely during momentum touch-scrolling). Relying on
  // that event left the thumb stuck at its initial default forever, which
  // is exactly what happened on real-device testing. Polling scrollLeft on
  // every animation frame instead sidesteps the question of whether/when a
  // "scroll" event fires — it just reads the live value directly — and
  // only calls setState when a value actually changed, so it costs a few
  // property reads on frames where nothing moved, not a re-render.
  React.useLayoutEffect(()=>{
    if(currentView!=="daily")return;
    let raf=0;
    let lastLeft=-1,lastMax=-1,lastClient=-1,lastIdx=-1;
    const measure=()=>{
      const el=dayScrollElRef.current;
      if(!el)return;
      const max=Math.max(1,el.scrollWidth-el.clientWidth);
      const client=el.clientWidth;
      const left=el.scrollLeft;
      if(left!==lastLeft||max!==lastMax||client!==lastClient){
        lastLeft=left;lastMax=max;lastClient=client;
        setDayScrollMetrics({left,max,client});
      }
      const step=Math.max(1,el.scrollWidth/Math.max(1,weekDates.length));
      const idx=Math.min(weekDates.length-1,Math.max(0,
        Math.round((left+client/2)/step-0.5)));
      if(idx!==lastIdx){
        lastIdx=idx;
        setViewedDate(weekDates[idx]?.date??null);
      }
    };
    const tick=()=>{measure();raf=requestAnimationFrame(tick);};
    measure();
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[currentView]);

  function dayTrackPointerDown(e:React.PointerEvent<HTMLDivElement>){
    const track=dayTrackRef.current,el=dayScrollElRef.current;
    if(!track||!el)return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect=track.getBoundingClientRect();
    const max=Math.max(1,el.scrollWidth-el.clientWidth);
    const thumbFrac=Math.max(0.06,Math.min(1,el.clientWidth/Math.max(1,el.scrollWidth)));
    const thumbPx=thumbFrac*rect.width;
    const range=Math.max(1,rect.width-thumbPx);
    dayDragRef.current={startX:e.clientX,startLeft:el.scrollLeft,max,range};
  }
  function dayTrackPointerMove(e:React.PointerEvent<HTMLDivElement>){
    const drag=dayDragRef.current,el=dayScrollElRef.current;
    if(!drag||!el)return;
    const dx=e.clientX-drag.startX;
    el.scrollLeft=Math.min(drag.max,Math.max(0,drag.startLeft+dx*(drag.max/drag.range)));
  }
  function dayTrackPointerEnd(){dayDragRef.current=null;}

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
  const selDay=weekDates.find(d=>d.date===selectedDate)||weekDates.find(d=>d.key===selectedWeekDay);
  const viewedDay=weekDates.find(d=>d.date===viewedDate)||selDay;
  const selectedDayItems=getDayItems(selectedDate,selectedWeekDay);

  function completeOnboarding(goals:string[]){
    localStorage.setItem("docket-onboarded","true");
    // Also record completion on the account itself (user_metadata, same
    // pattern as email_opt_in/auto_memory_enabled), not just this device —
    // otherwise signing into this account on a different browser has no way
    // to know the wizard was already finished and re-runs it. Best-effort,
    // fire-and-forget: docket-onboarded above already covers this device
    // immediately regardless of how this network call turns out.
    if(user?.id){
      (async()=>{
        const sb=await getSupabaseClient();
        if(!sb)return;
        const{error}=await sb.auth.updateUser({data:{onboarding_complete:true}});
        if(error) console.error("Failed to record onboarding completion on account:",error);
      })();
    }
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

  // ── Top-level auth gate ───────────────────────────────────────────────────
  // No guest/local-only access, ever. A first-time visitor is already fully
  // gated by the non-dismissible OnboardingScreen (its step 0 requires real
  // sign-in before `next()` unlocks), so this only applies to a RETURNING
  // device — `onboarding` is false, meaning docket-onboarded is already
  // true, but there's no authenticated user (fresh sign-out, or a session
  // that never restored). Checked on user?.id specifically, never on
  // user truthiness alone and never on billing/tier state — cancelling a
  // subscription must drop someone to Free while still signed in, not touch
  // this gate at all.
  if(!onboarding&&!user?.id&&!authChecked){
    return(
      <AppCtx.Provider value={{dark,lang,t,dir}}>
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",
          alignItems:"center",justifyContent:"center",background:dark?"#0a0d16":"#EDE8F5"}}>
          <div style={{width:36,height:36,borderRadius:"50%",
            border:`3px solid ${dark?"rgba(255,255,255,0.15)":"rgba(42,54,153,0.15)"}`,
            borderTopColor:C.primary,animation:"spin 0.8s linear infinite"}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </AppCtx.Provider>
    );
  }
  if(!onboarding&&!user?.id){
    return(
      <AppCtx.Provider value={{dark,lang,t,dir}}>
        <SignInGate dark={dark} onUserChange={setUser} onOpenModal={setActiveModal}/>
        {activeModal&&<InfoModal modal={activeModal} onClose={()=>setActiveModal(null)} dark={dark} user={user} onUserChange={setUser} onNavigate={setActiveModal} isPro={isPro} subPeriodEnd={subPeriodEnd} subTier={subTier}/>}
      </AppCtx.Provider>
    );
  }

  return(
    <AppCtx.Provider value={{dark,lang,t,dir}}>
    {onboarding&&<OnboardingScreen onComplete={completeOnboarding} dark={dark} onOpenModal={setActiveModal} user={user} onUserChange={setUser}/>}
    {/* Welcome toast animation */}
    {showWelcome&&(
      <div style={{position:"fixed",top:24,left:"50%",transform:"translateX(-50%)",
        zIndex:300,animation:"slideDown 0.5s cubic-bezier(0.34,1.56,0.64,1)"}}>
        <style>{`@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
        <div style={{background:"linear-gradient(135deg,#4C5FD5,#2A3699)",
          color:"white",padding:"14px 24px",borderRadius:50,
          boxShadow:"0 8px 32px rgba(76,95,213,0.6)",
          display:"flex",alignItems:"center",gap:10,
          fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:15,
          whiteSpace:"nowrap"}}>
          <span style={{fontSize:20}}>👋</span>
          Welcome back, {welcomeMsg}!
        </div>
      </div>
    )}
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
        currentView={currentView} setView={(v)=>{setCurrentView(v);setShowSettings(false);}}
        onOpenModal={setActiveModal} user={user} onUserChange={setUser}/>

      {/* Nav */}
      <nav style={{position:"relative",zIndex:10,display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:"22px 22px 14px"}}>
        <button onClick={()=>{setIsDrawerOpen(true);setShowSettings(false);}} className="sq-btn nav-btn"
          style={{width:52,height:52,color:"white",
            background:"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)",
            boxShadow:"0 8px 28px rgba(76,95,213,0.6), 0 3px 8px rgba(0,0,0,0.25)"}}>
          <i className="ti ti-layout-sidebar" style={{fontSize:22,color:"white"}} aria-hidden="true"/></button>
        <div style={{textAlign:"center"}}>
          <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,
            fontSize:18,color:C.navy,letterSpacing:"-0.5px"}}>{t("appName")}</p>
          <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,
            color:C.muted,letterSpacing:"2px",textTransform:"uppercase",marginTop:2}}>
            {clientToday?clientToday.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}):""}
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowSettings(s=>!s)} className="sq-btn nav-btn"
            style={{width:52,height:52,fontSize:22,cursor:"pointer",
              background:"linear-gradient(145deg,#9B7FE8 0%,#6B4FD8 45%,#3A1A9E 100%)",
              boxShadow:"0 8px 28px rgba(107,79,216,0.55), 0 3px 8px rgba(0,0,0,0.25)"}} title="Settings">
            <i className="ti ti-adjustments-horizontal" style={{fontSize:22,color:"white"}} aria-hidden="true"/></button>
        </div>
      </nav>

      {/* Settings Panel */}
      {showSettings&&(
        <>
        <div onClick={()=>setShowSettings(false)}
          style={{position:"fixed",inset:0,zIndex:14,background:"rgba(20,20,35,0.25)",backdropFilter:"blur(3px)"}}/>
        <div style={{position:"fixed",top:88,left:0,right:0,zIndex:15,maxWidth:1100,margin:"0 auto",
          padding:"0 20px 16px",maxHeight:"calc(100vh - 100px)",overflowY:"auto"}}>
          <div style={{borderRadius:20,padding:"24px 26px",
            background:dark?"#181B2E":"#FFFFFF",
            border:`1px solid ${C.border}`,
            boxShadow:"0 24px 60px rgba(0,0,0,0.35)"}}>
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
                style={{width:52,height:28,borderRadius:14,border:"none",cursor:"pointer",
                  background:dark?"linear-gradient(135deg,#5DE8A0,#2E8B57)":C.border,
                  position:"relative",transition:"all 0.25s",flexShrink:0,
                  boxShadow:dark?"0 4px 12px rgba(46,139,87,0.4)":"none"}}>
                <span style={{position:"absolute",top:4,left:dark?26:4,width:20,height:20,
                  borderRadius:"50%",background:"white",transition:"left 0.25s",
                  boxShadow:"0 2px 6px rgba(0,0,0,0.25)"}}/>
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
                style={{width:52,height:28,borderRadius:14,border:"none",cursor:"pointer",
                  background:prayerEnabled?"linear-gradient(135deg,#5DE8A0,#2E8B57)":C.border,
                  position:"relative",transition:"all 0.25s",flexShrink:0,
                  boxShadow:prayerEnabled?"0 4px 12px rgba(46,139,87,0.4)":"none"}}>
                <span style={{position:"absolute",top:4,
                  left:prayerEnabled?26:4,width:20,height:20,borderRadius:"50%",
                  background:"white",transition:"left 0.25s",
                  boxShadow:"0 2px 6px rgba(0,0,0,0.25)"}}/>
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
        </>
      )}

      {/* Content */}
      <main onClick={()=>{if(showSettings)setShowSettings(false);}}
        style={{position:"relative",zIndex:10,maxWidth:1100,margin:"0 auto",padding:"0 20px 100px"}}>

        {/* ── DAILY ─────────────────────────────────────────────────────── */}
        {currentView==="daily"&&(
          <div>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
              fontSize:24,color:C.navy,marginBottom:10,letterSpacing:"-0.5px"}}>Daily Routine</p>
            <LiveClock dark={dark} C={C}/>
            {/* Week day picker with arrows */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <button onClick={()=>{
                  const el=document.getElementById("day-picker-scroll");
                  if(el) el.scrollBy({left:-180,behavior:"smooth"});
                }}
                style={{width:32,height:32,borderRadius:9,flexShrink:0,border:`1px solid ${C.border}`,
                  background:C.surface,cursor:"pointer",color:C.navy,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                <i className="ti ti-chevron-left" style={{fontSize:15}} aria-hidden="true"/>
              </button>
              <div id="day-picker-scroll" ref={dayScrollElRef}
                style={{display:"flex",gap:6,overflowX:"auto",flex:1,
                  scrollbarWidth:"none",msOverflowStyle:"none",
                  padding:"3px 2px 3px",paddingBottom:4}}>
                <style>{`#day-picker-scroll::-webkit-scrollbar{display:none}`}</style>
                {weekDates.map(day=>{
                  const active=selectedDate===day.date;
                  const isToday=day.date===todayISO();
                  const highOnDay=routines.filter(r=>r.intensity==="high"&&(r.days??[]).includes(day.key));
                  const hasConflict=highOnDay.length>1;
                  return(
                    <button key={day.date} id={isToday?"day-picker-today":undefined}
                      className="day-chip" onClick={()=>{
                        setSelectedWeekDay(day.key);
                        setSelectedDate(day.date);
                      }}
                      style={{position:"relative",flexShrink:0,width:52,paddingTop:8,paddingBottom:8,
                        borderRadius:11,textAlign:"center",cursor:"pointer",transition:"all 0.15s",
                        background:active?"#4C5FD5":dark?"rgba(255,255,255,0.06)":C.surface,
                        border:active?`2px solid #8BA8FF`:isToday?`2px solid ${C.primary}`:`1.5px solid ${C.border}`,
                        boxShadow:active?"0 0 0 1px #4C5FD5":"none"}}>
                      <p style={{fontSize:9,fontWeight:700,textTransform:"uppercase",
                        letterSpacing:0.5,
                        color:active?"rgba(255,255,255,0.9)":isToday?C.primary:C.muted}}>
                        {(DAY_LABELS[day.key]||day.key).slice(0,3)}
                      </p>
                      <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,
                        fontSize:16,marginTop:2,
                        color:active?"#FFFFFF":isToday?C.primary:dark?"rgba(255,255,255,0.85)":C.navy}}>
                        {day.dayNum}
                      </p>
                      {isToday&&!active&&<div style={{width:4,height:4,borderRadius:"50%",
                        background:C.primary,margin:"2px auto 0"}}/>}
                      {hasConflict&&<span style={{position:"absolute",top:4,right:5,
                        width:5,height:5,borderRadius:"50%",background:C.urgent}}/>}
                    </button>
                  );
                })}
              </div>
              <button onClick={()=>{
                  const el=document.getElementById("day-picker-scroll");
                  if(el) el.scrollBy({left:180,behavior:"smooth"});
                }}
                style={{width:32,height:32,borderRadius:9,flexShrink:0,border:`1px solid ${C.border}`,
                  background:C.surface,cursor:"pointer",color:C.navy,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                <i className="ti ti-chevron-right" style={{fontSize:15}} aria-hidden="true"/>
              </button>
            </div>
            {/* Draggable scrollbar for the day strip above — inset by 40px
                (32px arrow button + 8px gap) on each side so it lines up
                exactly under the scrollable area, not the arrows. Pointer
                Events (not separate mouse/touch handlers) cover mouse,
                touch and pen in one code path; setPointerCapture keeps
                pointermove/pointerup targeting this element even once the
                finger/cursor drifts outside its bounds mid-drag. */}
            <div ref={dayTrackRef}
              onPointerDown={dayTrackPointerDown}
              onPointerMove={dayTrackPointerMove}
              onPointerUp={dayTrackPointerEnd}
              onPointerCancel={dayTrackPointerEnd}
              style={{position:"relative",height:16,margin:"0 40px 10px",
                display:"flex",alignItems:"center",cursor:"pointer",touchAction:"none"}}>
              <div style={{position:"absolute",left:0,right:0,height:5,borderRadius:3,
                background:dark?"rgba(255,255,255,0.08)":"rgba(15,23,42,0.07)"}}/>
              <div style={{position:"absolute",height:5,borderRadius:3,background:C.primary,
                opacity:0.85,pointerEvents:"none",
                left:`${dayScrollMetrics.max>0?(dayScrollMetrics.left/dayScrollMetrics.max)*(1-Math.max(0.06,Math.min(1,dayScrollMetrics.client/(dayScrollMetrics.client+dayScrollMetrics.max))))*100:0}%`,
                width:`${Math.max(0.06,Math.min(1,dayScrollMetrics.client/(dayScrollMetrics.client+dayScrollMetrics.max)))*100}%`}}/>
            </div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,
              color:C.muted,marginBottom:10}}>
              {viewedDay?.label||(clientToday?clientToday.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"}):"")}
            </p>

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
            <div className="all-tasks-grid" style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:22}}>
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
        {currentView==="archive"&&(()=>{
          const archived=tasks.filter(t=>t.done||t.deleted);
          return(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:12}}>
              <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
                fontSize:26,color:C.navy}}>{t("archive")}</p>
              {/* Matches the chat panel's "Clear all history" button —
                  same destructive-action styling and confirm() pattern
                  (see clearArchive above), so the two "wipe everything in
                  this list" actions in the app look and behave the same. */}
              {archived.length>0&&(
                <button onClick={clearArchive} disabled={clearingArchive}
                  style={{padding:"8px 14px",borderRadius:9,fontSize:12,fontWeight:600,flexShrink:0,
                    border:"1px solid rgba(217,79,61,0.3)",background:"rgba(217,79,61,0.08)",
                    color:C.urgent,cursor:clearingArchive?"default":"pointer",opacity:clearingArchive?0.6:1}}>
                  {clearingArchive?"Clearing…":"Clear all"}
                </button>
              )}
            </div>
            {archived.length===0
              ?<p style={{textAlign:"center",color:C.muted2,padding:"48px 0",
                  fontFamily:"'Space Grotesk',sans-serif",fontWeight:600}}>No archived tasks yet.</p>
              :archived.map(t=>(
                <TaskCard key={t.id} task={t}
                  onToggle={()=>toggleTask(t.id)} onDelete={()=>deleteTask(t.id)}
                  onEdit={()=>{}} onAddStep={()=>{}} onToggleStep={()=>{}} onRemoveStep={()=>{}}
                  isArchive onRestore={()=>restoreTask(t.id)}/>
              ))}
          </div>
          );
        })()}
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

      <Chatbot tasks={tasks} routines={routines} onAction={handleAiActions} user={user} isPro={isPro} tier={subTier}/>

      {isAddingTask&&<TaskModal onClose={()=>setIsAddingTask(false)} onSave={addTask}/>}
      {editingTask&&<TaskModal initial={editingTask} onClose={()=>setEditingTask(null)}
        onSave={data=>{updateTask(editingTask.id,data);setEditingTask(null);}}/>}
    </div>
      {activeModal&&<InfoModal modal={activeModal} onClose={()=>setActiveModal(null)} dark={dark} user={user} onUserChange={setUser} onNavigate={setActiveModal} isPro={isPro} subPeriodEnd={subPeriodEnd} subTier={subTier}/>}
    </AppCtx.Provider>
  );
}