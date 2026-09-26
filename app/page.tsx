"use client";
import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
// `import type`, not a value import — the compiler erases this entirely, so
// none of _prompt.ts's ~15 KB of prompt prose reaches the client bundle. Both
// sides sharing one definition is what stops the context shape drifting.
import type { ChatContext } from "./api/ask/_prompt";
import ReactMarkdown from "react-markdown";

type Category = "study"|"legal"|"trading"|"finance"|"business"|"career"|"health"|"driving"|"admin"|"property"|"content"|"personal"|"family"|"faith"|"fitness"|"nutrition"|"mental"|"travel"|"technology"|"creative"|"social"|"volunteering"|"language"|"reading"|"music"|"sports"|"cooking"|"shopping"|"events"|"medical"|"insurance"|"tax"|"debt"|"savings"|"investment"|"side_hustle"|"networking"|"interview"|"project"|"research"|"writing"|"design"|"marketing"|"sales"|"customer"|"hr"|"legal_work"|"compliance"|"environment"|"community"|"charity"|"education"|"childcare"|"pets"|"home"|"vehicle"|"utilities"|"subscriptions"|"other";
type Priority = "urgent"|"high"|"medium";
type TaskType = "milestone"|"ongoing";
type View = "daily"|"all"|"calendar"|"archive";
type Filter = "all"|"ongoing"|"milestone"|"done"|Category;
type Lang = "en"|"ar"|"fr"|"tr"|"ur"|"bn"|"es"|"hi"|"pt"|"ru"|"zh";

// Bottom nav bar's fixed footprint. The chat panel's own bottom offset and
// available height are derived from these plus the bar's measured height, so
// the panel always clears the bar by BOTTOM_NAV_GAP instead of floating over
// it, and the two can't drift apart if the bar's size or offset changes.
const BOTTOM_NAV_BOTTOM=20;
const BOTTOM_NAV_GAP=12;
// FIRST-PAINT FALLBACK ONLY — the bar's real height is measured at runtime
// (see measuredBarHeight in Chatbot). This counts the 44px icon row plus 8px
// of padding top and bottom, and that is all a static number can honestly
// cover: the bar's two hairline borders do NOT render at their nominal 0.5px.
// The browser snaps each to a whole device pixel, so the real height is
// devicePixelRatio-dependent — live measurement on a DPR-0.75 display put
// each border at 1.333px and the bar at 62.67px, which left the panel
// clearing it by only 9.33px instead of the intended 12.
const BOTTOM_NAV_HEIGHT_FALLBACK=60;
// Chat panel motion — open and close only. Both are keyframed scale+fade on
// the panel itself, which animates compositor-friendly properties and leaves
// layout alone.
//
// Expand/compress: position, size and radius all snap instantly, then the
// panel fades in from fully transparent. The cut itself is what sells the
// change; the fade is the soft reveal after it. It starts at 0 rather than a
// partial dip because a 0.7 floor over 200ms was measurably firing and still
// read as nothing at all — 30% of transparency at that speed is below the
// threshold of noticing, particularly against a light background.
//
// Two earlier approaches are deliberately not here. Transitioning the layout
// properties recalculated layout every frame and wobbled. FLIP animated a
// transform instead, which was smooth but scaled the panel's contents with
// it, warping text for the whole duration — unavoidable without
// inverse-scaling every child, which puts the per-frame cost straight back.
// Fading interpolates no geometry, so it can neither distort nor thrash.
const PANEL_OPEN_MS=250;
const PANEL_CLOSE_MS=200;
const PANEL_MORPH_MS=300;
const PANEL_EASE="cubic-bezier(0.4, 0, 0.2, 1)";
// Avatar card — the floating panel the top-left avatar opens, replacing the
// old slide-in drawer. Its top offset is derived from the nav's own padding
// and button size so it always hangs just under the avatar it belongs to.
const NAV_PAD=22;
const AVATAR_BTN=52;
const AVATAR_CARD_GAP=8;
const AVATAR_CARD_TOP=NAV_PAD+AVATAR_BTN+AVATAR_CARD_GAP;
const AVATAR_CARD_WIDTH=280;
const CARD_ANIM_MS=200;
// Subscription carousel. One card centred and interactive, the other two
// flanking it blurred and scaled down — replacing a three-column grid that
// collapsed to a stack you had to scroll through on a phone. SHIFT is how far
// a side card sits from centre: less than the card's own width, so the two
// behind it still peek out and read as tappable.
const CAROUSEL_CARD_W=236;
const CAROUSEL_SHIFT=150;
const CAROUSEL_H=330;
// Both expressed as CSS so they can shrink on a genuinely small screen
// rather than being clipped away. The vw figures keep the same card-to-shift
// ratio as the pixel values (150/236), so the composition holds as it
// scales. They only engage below roughly 370px wide — above that the min()
// picks the pixel value and nothing changes.
const CAROUSEL_CARD_W_CSS=`min(${CAROUSEL_CARD_W}px, 64vw)`;
const CAROUSEL_SHIFT_CSS=`min(${CAROUSEL_SHIFT}px, 41vw)`;
// Free-tier Nova allowance. Mirrors FREE_SONNET_DAILY_LIMIT in
// app/api/ask/route.ts, which is where it is actually enforced — this copy
// exists only so the card can state the number.
const FREE_NOVA_DAILY_LIMIT=10;
// Vega low-credit warning: the share of the cap that triggers it, and the
// localStorage prefix its dismissal is stored under. The key is completed
// with the usage period, so a dismissal lasts exactly as long as the credits
// it was about.
const VEGA_WARN_PCT=90;
const VEGA_WARN_KEY="docket-vega-warn-";

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
    week:"Week", archive:"Finished & Deleted",
    newTask:"New Task", cancel:"Cancel", addStep:"Add",
    prayerSetting:"Accurate prayer times",
    prayerLoading:"📍 Fetching your location…",
    prayerDone:"✓ Prayer times updated for today",
    prayerDenied:"⚠ Location access is blocked. Enable it in your browser's site settings to use accurate prayer times.",
    prayerTimeout:"⚠ Couldn't get your location in time. Try again, or check your connection.",
    prayerUnavailable:"⚠ Your device couldn't determine your location right now.",
    prayerService:"⚠ Couldn't reach the prayer times service. Try again shortly.",
    notifSetting:"Notifications",
    darkMode:"Dark mode",
    language:"Language",
    nothingToday:"Nothing scheduled today.",
    nothingHere:"Nothing here.",
    allOpen:"All Open", ongoing:"Ongoing", completable:"Completable",
    category:"Category", show:"Show", overdue:"OVERDUE",
    urgent:"urgent", high:"high", medium:"medium",
    working:"Working on it…",
    steps:"Steps", taskTitle:"Task", notes:"Notes",
    dueDate:"Due / target date", nature:"Nature", recurring:"Recurring",
    oneOff:"One-off", daily2:"Daily", weekly:"Weekly",
    milestone:"Completable", ongoing2:"Ongoing",
    finishedDeleted:"Finished & Deleted",
    calendar:"Calendar", addTask:"Add Task",
    chatAsk:"Ask Docket…", chatHistory:"Chat history", newChat:"New chat",
    historySignIn:"Sign in to save and view your chat history.",
    loading:"Loading…", noConversations:"No past conversations yet.",
    deleteConversation:"Delete conversation", close:"Close",
    attached:"Attached", attachedPreview:"Attached preview",
    imageAttached:"Image attached", removeImage:"Remove image",
    attachImage:"Attach an image",
    chooseModel:"Choose which model sends your next messages",
    opusExhausted:"Vega credits used up this month — sent with Nova instead.",
    editTask:"Edit Task", saveChanges:"Save Changes", priority:"Priority",
    taskTitlePlaceholder:"What needs to be done?", optional:"(optional)",
    notesPlaceholder:"Any details worth remembering…",
    typeMilestoneDesc:"Has a clear end", typeOngoingDesc:"No fixed finish",
    every2Days:"Every 2 days", every3Days:"Every 3 days",
    weekdays:"Weekdays", weekends:"Weekends", biweekly:"Bi-weekly", monthly:"Monthly",
    searchOrCustom:"Search or type custom…", clickToChange:"Click to change",
    searchCategories:"Search categories…", typeOwnCategory:"Type your own category…",
    selectDate:"Select a date",
    // Category labels. Prefixed so they stay visibly grouped and
    // cannot collide with a UI key of the same name.
    cat_health:"Health & Fitness", cat_fitness:"Fitness & Exercise", cat_nutrition:"Nutrition & Diet", cat_mental:"Mental Health",
    cat_medical:"Medical", cat_faith:"Faith & Spirituality", cat_personal:"Personal Dev", cat_reading:"Reading & Books",
    cat_music:"Music", cat_creative:"Creative & Arts", cat_language:"Language Learning", cat_study:"Study",
    cat_research:"Research", cat_writing:"Writing", cat_education:"Education", cat_career:"Career",
    cat_interview:"Interviews", cat_networking:"Networking", cat_project:"Projects", cat_hr:"HR & People",
    cat_business:"Business", cat_side_hustle:"Side Hustle", cat_marketing:"Marketing", cat_sales:"Sales",
    cat_design:"Design", cat_content:"Content Creation", cat_customer:"Customer Service", cat_finance:"Finance",
    cat_trading:"Trading & Investing", cat_savings:"Savings & Goals", cat_investment:"Investments", cat_debt:"Debt & Loans",
    cat_tax:"Tax & Accounting", cat_insurance:"Insurance", cat_subscriptions:"Subscriptions", cat_legal:"Legal",
    cat_legal_work:"Legal Work", cat_compliance:"Compliance", cat_admin:"Admin & Housing", cat_home:"Home & DIY",
    cat_property:"Property", cat_utilities:"Utilities & Bills", cat_vehicle:"Vehicle", cat_driving:"Driving",
    cat_shopping:"Shopping & Errands", cat_family:"Family", cat_childcare:"Childcare", cat_pets:"Pets",
    cat_social:"Social Life", cat_events:"Events", cat_technology:"Technology", cat_travel:"Travel & Holidays",
    cat_volunteering:"Volunteering", cat_charity:"Charity & Giving", cat_community:"Community", cat_environment:"Environment",
    cat_sports:"Sports", cat_cooking:"Cooking & Recipes", cat_other:"Other",
    tasksThisDay:"Tasks this day", noEventsThisDay:"No events or tasks on this day.",
    hasTask:"Has task", hasRoutine:"Has routine",
    holType_public:"Public", holType_religious:"Religious",
    holType_awareness:"Awareness", holType_cultural:"Cultural",
    holType_islamic:"Islamic", holType_bank:"Bank",
    // Holiday names. Only the internationally observed dates are
    // translated; nation-specific ones keep their English names.
    hol_newYear:"New Year's Day", hol_holocaustMemorial:"Holocaust Memorial Day",
    hol_valentines:"Valentine's Day", hol_womensDay:"International Women's Day",
    hol_downSyndrome:"World Down Syndrome Day", hol_nowruz:"Nowruz (Persian New Year)",
    hol_waterDay:"World Water Day", hol_healthDay:"World Health Day",
    hol_earthDay:"Earth Day", hol_labourDay:"International Labour Day",
    hol_familiesDay:"International Day of Families", hol_childrensDay:"World Children's Day",
    hol_environmentDay:"World Environment Day", hol_musicDay:"World Music Day",
    hol_youthDay:"International Youth Day", hol_peaceDay:"International Day of Peace",
    hol_olderPersons:"International Day of Older Persons", hol_teachersDay:"World Teachers' Day",
    hol_mentalHealthDay:"World Mental Health Day", hol_foodDay:"World Food Day",
    hol_aidsDay:"World AIDS Day", hol_humanRights:"Human Rights Day",
    hol_christmas:"Christmas Day", hol_newYearsEve:"New Year's Eve",
    hol_ramadan:"Ramadan begins (approx)", hol_eidFitr:"Eid al-Fitr (approx)",
    hol_eidAdha:"Eid al-Adha (approx)", hol_islamicNewYear:"Islamic New Year (approx)",
    hol_arafah:"Day of Arafah (approx)",
    subscription:"Subscription", widgetsShortcuts:"Widgets & Shortcuts",
    siriShortcuts:"Siri & Shortcuts", helpFeedback:"Help & Feedback",
    privacyPermissions:"Privacy & Permissions", termsConditions:"Terms & Conditions",
    switchToLight:"Switch to light mode", switchToDark:"Switch to dark mode",
    account:"Account", displayName:"Display Name", saveLabel:"Save", email:"Email",
    emailChangeNote:"Email changes require re-verification. Contact support to update.",
    marketingOptIn:"Product updates and tips",
    plan:"Plan", freePlan:"Free Plan", renewsOn:"Renews {date}",
    activeSubscription:"Active subscription",
    upgradeBlurb:"Upgrade for unlimited Nova, Vega credits and more",
    manageSubscription:"Manage Subscription", tryProFree:"Try Pro Free for 7 Days",
    signOutOf:"Sign out of {email}",
    errFillAll:"Please fill in all fields.", errPasswordMismatch:"Passwords do not match.",
    errPasswordShort:"Password must be at least 6 characters.",
    errAgreeTerms:"Please agree to the Terms & Conditions and Privacy Policy to continue.",
    msgCheckInbox:"Check your inbox at {email} for a confirmation link. Click it then return here to sign in.",
    errEmailNotConfirmed:"Please confirm your email first. Check your inbox for the verification link we sent.",
    errBadCredentials:"Incorrect email or password. Please try again.",
    msgWelcomeBack:"Welcome back, {name}!", errGeneric:"Something went wrong.",
    errEmailFirst:"Enter your email address above first.",
    msgResetSent:"Password reset link sent to {email}. Click the link in the email to set a new password.",
    msgResendSent:"Confirmation email resent to {email}",
    resetTitle:"Reset your password",
    resetBlurb:"Enter your email and we will send you a link to reset your password.",
    yourEmailAddress:"Your email address", sending:"Sending…", sendResetLink:"Send Reset Link",
    continueGoogle:"Continue with Google", continueApple:"Continue with Apple", orUseEmail:"or use email",
    welcomeHeading:"Welcome", joinHeading:"Join The Docket",
    signInSubtitle:"Sign in to sync your data", registerSubtitle:"Create your free account",
    signInTab:"Sign In", registerTab:"Register",
    fullNameOptional:"Full name (optional)", emailAddress:"Email address",
    passwordMin:"Password (min. 6 characters)", password:"Password", confirmPassword:"Confirm password",
    agreeTo:"I agree to the ", andWord:" and ", privacyPolicy:"Privacy Policy",
    pleaseWait:"Please wait…", signedIn:"✓ Signed in!",
    signInArrow:"Sign In →", createAccountArrow:"Create Account →",
    goToSignIn:"Go to Sign In", forgotPassword:"Forgot your password?",
    didntReceive:"Didn't receive the email? Check your spam folder or", resendIt:"resend it",
    legalEnglishNotice:"This document is provided in English. The English version governs in the event of any discrepancy with a translation.",
    vegaLowWarning:"Vega running low — you've used {pct}% of your credits this period.",
    syncBehind:"Saved on this device, but not yet backed up to your account. This will retry on its own.",
    allCategories:"All Categories",
    deleteAccount:"Delete Account",
    deleteAccountWarn:"This permanently deletes your account, every task, routine and conversation, and cancels any active subscription. It cannot be undone.",
    deleteAccountConfirm:"Type {email} to confirm",
    deleteAccountCta:"Permanently delete my account",
    deleting:"Deleting…", cancel2:"Cancel",
  },
  ar:{
    appName:"الدفتر", daily:"الروتين اليومي", allTasks:"جميع المهام",
    week:"الأسبوع", archive:"المنجزة والمحذوفة",
    newTask:"مهمة جديدة", cancel:"إلغاء", addStep:"إضافة",
    prayerSetting:"أوقات الصلاة الدقيقة",
    prayerLoading:"📍 جاري تحديد موقعك…",
    prayerDone:"✓ تم تحديث أوقات الصلاة لهذا اليوم",
    prayerDenied:"⚠ الوصول إلى الموقع محظور. فعّله من إعدادات الموقع في متصفحك.",
    prayerTimeout:"⚠ لم نتمكّن من تحديد موقعك في الوقت المحدد. حاول مجددًا أو تحقق من اتصالك.",
    prayerUnavailable:"⚠ تعذّر على جهازك تحديد الموقع حاليًا.",
    prayerService:"⚠ تعذّر الاتصال بخدمة أوقات الصلاة. حاول بعد قليل.",
    notifSetting:"الإشعارات",
    darkMode:"الوضع الداكن",
    language:"اللغة",
    nothingToday:"لا شيء مجدول اليوم.",
    nothingHere:"لا يوجد شيء هنا.",
    allOpen:"الكل المفتوح", ongoing:"جارٍ", completable:"قابل للإنجاز",
    category:"الفئة", show:"عرض", overdue:"متأخر",
    urgent:"عاجل", high:"مرتفع", medium:"متوسط",
    working:"جاري المعالجة…",
    steps:"الخطوات", taskTitle:"المهمة", notes:"ملاحظات",
    dueDate:"تاريخ الاستحقاق", nature:"الطبيعة", recurring:"متكرر",
    oneOff:"مرة واحدة", daily2:"يومياً", weekly:"أسبوعياً",
    milestone:"قابل للإنجاز", ongoing2:"مستمر",
    finishedDeleted:"المنجزة والمحذوفة",
    calendar:"التقويم", addTask:"إضافة مهمة",
    chatAsk:"اسأل الدفتر…", chatHistory:"سجل المحادثات", newChat:"محادثة جديدة",
    historySignIn:"سجّل الدخول لحفظ محادثاتك وعرضها.",
    loading:"جاري التحميل…", noConversations:"لا توجد محادثات سابقة.",
    deleteConversation:"حذف المحادثة", close:"إغلاق",
    attached:"مرفق", attachedPreview:"معاينة المرفق",
    imageAttached:"تم إرفاق صورة", removeImage:"إزالة الصورة",
    attachImage:"إرفاق صورة",
    chooseModel:"اختر النموذج الذي سيرسل رسائلك التالية",
    opusExhausted:"انتهى رصيد Vega هذا الشهر — تم الإرسال باستخدام Nova بدلًا منه.",
    editTask:"تعديل المهمة", saveChanges:"حفظ التغييرات", priority:"الأولوية",
    taskTitlePlaceholder:"ما الذي يجب إنجازه؟", optional:"(اختياري)",
    notesPlaceholder:"أي تفاصيل تستحق التذكّر…",
    typeMilestoneDesc:"لها نهاية واضحة", typeOngoingDesc:"بلا نهاية محدّدة",
    every2Days:"كل يومين", every3Days:"كل 3 أيام",
    weekdays:"أيام العمل", weekends:"عطلة نهاية الأسبوع", biweekly:"كل أسبوعين", monthly:"شهريًا",
    searchOrCustom:"ابحث أو اكتب فئة مخصّصة…", clickToChange:"اضغط للتغيير",
    searchCategories:"ابحث في الفئات…", typeOwnCategory:"اكتب فئتك الخاصة…",
    selectDate:"اختر تاريخًا",
    // Category labels. Prefixed so they stay visibly grouped and
    // cannot collide with a UI key of the same name.
    cat_health:"الصحة واللياقة", cat_fitness:"اللياقة والتمارين", cat_nutrition:"التغذية والحمية", cat_mental:"الصحة النفسية",
    cat_medical:"طبي", cat_faith:"الإيمان والروحانية", cat_personal:"التطوير الشخصي", cat_reading:"القراءة والكتب",
    cat_music:"الموسيقى", cat_creative:"الإبداع والفنون", cat_language:"تعلّم اللغات", cat_study:"الدراسة",
    cat_research:"البحث", cat_writing:"الكتابة", cat_education:"التعليم", cat_career:"المسار المهني",
    cat_interview:"المقابلات", cat_networking:"بناء العلاقات", cat_project:"المشاريع", cat_hr:"الموارد البشرية",
    cat_business:"الأعمال", cat_side_hustle:"عمل جانبي", cat_marketing:"التسويق", cat_sales:"المبيعات",
    cat_design:"التصميم", cat_content:"صناعة المحتوى", cat_customer:"خدمة العملاء", cat_finance:"المالية",
    cat_trading:"التداول والاستثمار", cat_savings:"الادخار والأهداف", cat_investment:"الاستثمارات", cat_debt:"الديون والقروض",
    cat_tax:"الضرائب والمحاسبة", cat_insurance:"التأمين", cat_subscriptions:"الاشتراكات", cat_legal:"قانوني",
    cat_legal_work:"عمل قانوني", cat_compliance:"الامتثال", cat_admin:"الإدارة والسكن", cat_home:"المنزل والصيانة",
    cat_property:"العقارات", cat_utilities:"المرافق والفواتير", cat_vehicle:"المركبة", cat_driving:"القيادة",
    cat_shopping:"التسوق والمشاوير", cat_family:"العائلة", cat_childcare:"رعاية الأطفال", cat_pets:"الحيوانات الأليفة",
    cat_social:"الحياة الاجتماعية", cat_events:"المناسبات", cat_technology:"التقنية", cat_travel:"السفر والعطلات",
    cat_volunteering:"العمل التطوعي", cat_charity:"الخير والتبرع", cat_community:"المجتمع", cat_environment:"البيئة",
    cat_sports:"الرياضة", cat_cooking:"الطبخ والوصفات", cat_other:"أخرى",
    tasksThisDay:"مهام هذا اليوم", noEventsThisDay:"لا توجد مناسبات أو مهام في هذا اليوم.",
    hasTask:"يوجد مهمة", hasRoutine:"يوجد روتين",
    holType_public:"رسمي", holType_religious:"ديني",
    holType_awareness:"توعية", holType_cultural:"ثقافي",
    holType_islamic:"إسلامي", holType_bank:"عطلة مصرفية",
    // Holiday names. Only the internationally observed dates are
    // translated; nation-specific ones keep their English names.
    hol_newYear:"رأس السنة الميلادية", hol_holocaustMemorial:"اليوم العالمي لإحياء ذكرى الهولوكوست",
    hol_valentines:"عيد الحب", hol_womensDay:"اليوم العالمي للمرأة",
    hol_downSyndrome:"اليوم العالمي لمتلازمة داون", hol_nowruz:"النيروز (رأس السنة الفارسية)",
    hol_waterDay:"اليوم العالمي للمياه", hol_healthDay:"يوم الصحة العالمي",
    hol_earthDay:"يوم الأرض", hol_labourDay:"عيد العمال العالمي",
    hol_familiesDay:"اليوم الدولي للأسر", hol_childrensDay:"اليوم العالمي للطفل",
    hol_environmentDay:"اليوم العالمي للبيئة", hol_musicDay:"اليوم العالمي للموسيقى",
    hol_youthDay:"اليوم الدولي للشباب", hol_peaceDay:"اليوم الدولي للسلام",
    hol_olderPersons:"اليوم الدولي لكبار السن", hol_teachersDay:"اليوم العالمي للمعلم",
    hol_mentalHealthDay:"اليوم العالمي للصحة النفسية", hol_foodDay:"يوم الأغذية العالمي",
    hol_aidsDay:"اليوم العالمي للإيدز", hol_humanRights:"يوم حقوق الإنسان",
    hol_christmas:"عيد الميلاد", hol_newYearsEve:"ليلة رأس السنة",
    hol_ramadan:"بداية رمضان (تقريبي)", hol_eidFitr:"عيد الفطر (تقريبي)",
    hol_eidAdha:"عيد الأضحى (تقريبي)", hol_islamicNewYear:"رأس السنة الهجرية (تقريبي)",
    hol_arafah:"يوم عرفة (تقريبي)",
    subscription:"الاشتراك", widgetsShortcuts:"الأدوات والاختصارات",
    siriShortcuts:"سيري والاختصارات", helpFeedback:"المساعدة والملاحظات",
    privacyPermissions:"الخصوصية والأذونات", termsConditions:"الشروط والأحكام",
    switchToLight:"التبديل إلى الوضع الفاتح", switchToDark:"التبديل إلى الوضع الداكن",
    account:"الحساب", displayName:"الاسم المعروض", saveLabel:"حفظ", email:"البريد الإلكتروني",
    emailChangeNote:"تغيير البريد الإلكتروني يتطلب إعادة تحقق. تواصل مع الدعم للتحديث.",
    marketingOptIn:"تحديثات المنتج والنصائح",
    plan:"الخطة", freePlan:"الخطة المجانية", renewsOn:"يتجدد في {date}",
    activeSubscription:"اشتراك نشط",
    upgradeBlurb:"قم بالترقية للحصول على Nova غير محدود ورصيد Vega والمزيد",
    manageSubscription:"إدارة الاشتراك", tryProFree:"جرّب Pro مجانًا لمدة 7 أيام",
    signOutOf:"تسجيل الخروج من {email}",
    errFillAll:"يرجى ملء جميع الحقول.", errPasswordMismatch:"كلمتا المرور غير متطابقتين.",
    errPasswordShort:"يجب ألا تقل كلمة المرور عن 6 أحرف.",
    errAgreeTerms:"يرجى الموافقة على الشروط والأحكام وسياسة الخصوصية للمتابعة.",
    msgCheckInbox:"تحقق من بريدك على {email} للعثور على رابط التأكيد. اضغط عليه ثم عد إلى هنا لتسجيل الدخول.",
    errEmailNotConfirmed:"يرجى تأكيد بريدك الإلكتروني أولًا. تحقق من صندوق الوارد بحثًا عن رابط التحقق.",
    errBadCredentials:"البريد الإلكتروني أو كلمة المرور غير صحيحة. حاول مرة أخرى.",
    msgWelcomeBack:"مرحبًا بعودتك، {name}!", errGeneric:"حدث خطأ ما.",
    errEmailFirst:"أدخل بريدك الإلكتروني في الأعلى أولًا.",
    msgResetSent:"تم إرسال رابط إعادة التعيين إلى {email}. اضغط على الرابط في البريد لتعيين كلمة مرور جديدة.",
    msgResendSent:"تمت إعادة إرسال بريد التأكيد إلى {email}",
    resetTitle:"إعادة تعيين كلمة المرور",
    resetBlurb:"أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.",
    yourEmailAddress:"بريدك الإلكتروني", sending:"جاري الإرسال…", sendResetLink:"إرسال رابط إعادة التعيين",
    continueGoogle:"المتابعة باستخدام Google", continueApple:"المتابعة باستخدام Apple", orUseEmail:"أو استخدم البريد الإلكتروني",
    welcomeHeading:"مرحبًا", joinHeading:"انضم إلى The Docket",
    signInSubtitle:"سجّل الدخول لمزامنة بياناتك", registerSubtitle:"أنشئ حسابك المجاني",
    signInTab:"تسجيل الدخول", registerTab:"إنشاء حساب",
    fullNameOptional:"الاسم الكامل (اختياري)", emailAddress:"البريد الإلكتروني",
    passwordMin:"كلمة المرور (6 أحرف على الأقل)", password:"كلمة المرور", confirmPassword:"تأكيد كلمة المرور",
    agreeTo:"أوافق على ", andWord:" و", privacyPolicy:"سياسة الخصوصية",
    pleaseWait:"يرجى الانتظار…", signedIn:"✓ تم تسجيل الدخول!",
    signInArrow:"تسجيل الدخول ←", createAccountArrow:"إنشاء حساب ←",
    goToSignIn:"الذهاب إلى تسجيل الدخول", forgotPassword:"نسيت كلمة المرور؟",
    didntReceive:"لم يصلك البريد؟ تحقق من مجلد الرسائل غير المرغوب فيها أو", resendIt:"أعد الإرسال",
    legalEnglishNotice:"هذا المستند متوفر باللغة الإنجليزية. النسخة الإنجليزية هي المعتمدة في حال وجود أي اختلاف مع أي ترجمة.",
    vegaLowWarning:"رصيد Vega على وشك النفاد — استخدمت {pct}٪ من رصيدك هذه الفترة.",
    syncBehind:"محفوظ على هذا الجهاز، لكن لم يُنسخ إلى حسابك بعد. ستتم إعادة المحاولة تلقائيًا.",
    allCategories:"جميع الفئات",
    deleteAccount:"حذف الحساب",
    deleteAccountWarn:"سيؤدي هذا إلى حذف حسابك وجميع المهام والروتينات والمحادثات نهائيًا، وإلغاء أي اشتراك نشط. لا يمكن التراجع عن ذلك.",
    deleteAccountConfirm:"اكتب {email} للتأكيد",
    deleteAccountCta:"احذف حسابي نهائيًا",
    deleting:"جاري الحذف…", cancel2:"إلغاء",
  },
  fr:{
    appName:"The Docket", daily:"Routine Quotidienne", allTasks:"Toutes les Tâches",
    week:"Semaine", archive:"Terminées & Supprimées",
    newTask:"Nouvelle Tâche", cancel:"Annuler", addStep:"Ajouter",
    prayerSetting:"Heures de prière précises",
    prayerLoading:"📍 Localisation en cours…",
    prayerDone:"✓ Heures de prière mises à jour",
    prayerDenied:"⚠ L'accès à la localisation est bloqué. Activez-le dans les paramètres du site de votre navigateur.",
    prayerTimeout:"⚠ Localisation trop longue. Réessayez ou vérifiez votre connexion.",
    prayerUnavailable:"⚠ Votre appareil n'a pas pu déterminer votre position pour le moment.",
    prayerService:"⚠ Impossible de joindre le service des heures de prière. Réessayez bientôt.",
    notifSetting:"Notifications",
    darkMode:"Mode sombre",
    language:"Langue",
    nothingToday:"Rien de planifié aujourd'hui.",
    nothingHere:"Rien ici.",
    allOpen:"Tout ouvert", ongoing:"En cours", completable:"Réalisable",
    category:"Catégorie", show:"Afficher", overdue:"EN RETARD",
    urgent:"urgent", high:"élevé", medium:"moyen",
    working:"En cours…",
    steps:"Étapes", taskTitle:"Tâche", notes:"Notes",
    dueDate:"Date limite", nature:"Nature", recurring:"Récurrent",
    oneOff:"Ponctuel", daily2:"Quotidien", weekly:"Hebdomadaire",
    milestone:"Réalisable", ongoing2:"Continu",
    finishedDeleted:"Terminées & Supprimées",
    calendar:"Calendrier", addTask:"Ajouter une tâche",
    chatAsk:"Demandez à Docket…", chatHistory:"Historique des discussions", newChat:"Nouvelle discussion",
    historySignIn:"Connectez-vous pour enregistrer et consulter votre historique.",
    loading:"Chargement…", noConversations:"Aucune conversation pour le moment.",
    deleteConversation:"Supprimer la conversation", close:"Fermer",
    attached:"Pièce jointe", attachedPreview:"Aperçu de la pièce jointe",
    imageAttached:"Image jointe", removeImage:"Retirer l'image",
    attachImage:"Joindre une image",
    chooseModel:"Choisissez le modèle qui enverra vos prochains messages",
    opusExhausted:"Crédits Vega épuisés ce mois-ci — envoyé avec Nova à la place.",
    editTask:"Modifier la tâche", saveChanges:"Enregistrer les modifications", priority:"Priorité",
    taskTitlePlaceholder:"Qu'y a-t-il à faire ?", optional:"(facultatif)",
    notesPlaceholder:"Des détails à retenir…",
    typeMilestoneDesc:"A une fin claire", typeOngoingDesc:"Sans fin définie",
    every2Days:"Tous les 2 jours", every3Days:"Tous les 3 jours",
    weekdays:"En semaine", weekends:"Le week-end", biweekly:"Toutes les 2 semaines", monthly:"Mensuel",
    searchOrCustom:"Rechercher ou saisir…", clickToChange:"Cliquez pour changer",
    searchCategories:"Rechercher des catégories…", typeOwnCategory:"Saisissez votre catégorie…",
    selectDate:"Choisir une date",
    // Category labels. Prefixed so they stay visibly grouped and
    // cannot collide with a UI key of the same name.
    cat_health:"Santé & Forme", cat_fitness:"Forme & Exercice", cat_nutrition:"Nutrition & Régime", cat_mental:"Santé mentale",
    cat_medical:"Médical", cat_faith:"Foi & Spiritualité", cat_personal:"Développement personnel", cat_reading:"Lecture & Livres",
    cat_music:"Musique", cat_creative:"Création & Arts", cat_language:"Apprentissage des langues", cat_study:"Études",
    cat_research:"Recherche", cat_writing:"Écriture", cat_education:"Éducation", cat_career:"Carrière",
    cat_interview:"Entretiens", cat_networking:"Réseautage", cat_project:"Projets", cat_hr:"RH & Personnel",
    cat_business:"Affaires", cat_side_hustle:"Activité secondaire", cat_marketing:"Marketing", cat_sales:"Ventes",
    cat_design:"Design", cat_content:"Création de contenu", cat_customer:"Service client", cat_finance:"Finances",
    cat_trading:"Trading & Investissement", cat_savings:"Épargne & Objectifs", cat_investment:"Investissements", cat_debt:"Dettes & Prêts",
    cat_tax:"Impôts & Comptabilité", cat_insurance:"Assurance", cat_subscriptions:"Abonnements", cat_legal:"Juridique",
    cat_legal_work:"Travail juridique", cat_compliance:"Conformité", cat_admin:"Admin & Logement", cat_home:"Maison & Bricolage",
    cat_property:"Immobilier", cat_utilities:"Charges & Factures", cat_vehicle:"Véhicule", cat_driving:"Conduite",
    cat_shopping:"Courses & Achats", cat_family:"Famille", cat_childcare:"Garde d'enfants", cat_pets:"Animaux",
    cat_social:"Vie sociale", cat_events:"Événements", cat_technology:"Technologie", cat_travel:"Voyages & Vacances",
    cat_volunteering:"Bénévolat", cat_charity:"Dons & Charité", cat_community:"Communauté", cat_environment:"Environnement",
    cat_sports:"Sport", cat_cooking:"Cuisine & Recettes", cat_other:"Autre",
    tasksThisDay:"Tâches du jour", noEventsThisDay:"Aucun événement ni tâche ce jour-là.",
    hasTask:"Contient une tâche", hasRoutine:"Contient une routine",
    holType_public:"Férié", holType_religious:"Religieux",
    holType_awareness:"Sensibilisation", holType_cultural:"Culturel",
    holType_islamic:"Islamique", holType_bank:"Férié bancaire",
    // Holiday names. Only the internationally observed dates are
    // translated; nation-specific ones keep their English names.
    hol_newYear:"Jour de l'An", hol_holocaustMemorial:"Journée de la mémoire de l'Holocauste",
    hol_valentines:"Saint-Valentin", hol_womensDay:"Journée internationale des femmes",
    hol_downSyndrome:"Journée mondiale de la trisomie 21", hol_nowruz:"Norouz (Nouvel An persan)",
    hol_waterDay:"Journée mondiale de l'eau", hol_healthDay:"Journée mondiale de la santé",
    hol_earthDay:"Jour de la Terre", hol_labourDay:"Journée internationale des travailleurs",
    hol_familiesDay:"Journée internationale des familles", hol_childrensDay:"Journée mondiale de l'enfance",
    hol_environmentDay:"Journée mondiale de l'environnement", hol_musicDay:"Fête de la musique",
    hol_youthDay:"Journée internationale de la jeunesse", hol_peaceDay:"Journée internationale de la paix",
    hol_olderPersons:"Journée internationale des personnes âgées", hol_teachersDay:"Journée mondiale des enseignants",
    hol_mentalHealthDay:"Journée mondiale de la santé mentale", hol_foodDay:"Journée mondiale de l'alimentation",
    hol_aidsDay:"Journée mondiale du sida", hol_humanRights:"Journée des droits de l'homme",
    hol_christmas:"Noël", hol_newYearsEve:"Réveillon du Nouvel An",
    hol_ramadan:"Début du Ramadan (approx.)", hol_eidFitr:"Aïd el-Fitr (approx.)",
    hol_eidAdha:"Aïd el-Adha (approx.)", hol_islamicNewYear:"Nouvel An musulman (approx.)",
    hol_arafah:"Jour d'Arafat (approx.)",
    subscription:"Abonnement", widgetsShortcuts:"Widgets et raccourcis",
    siriShortcuts:"Siri et raccourcis", helpFeedback:"Aide et commentaires",
    privacyPermissions:"Confidentialité et autorisations", termsConditions:"Conditions générales",
    switchToLight:"Passer au mode clair", switchToDark:"Passer au mode sombre",
    account:"Compte", displayName:"Nom affiché", saveLabel:"Enregistrer", email:"E-mail",
    emailChangeNote:"Changer d'e-mail nécessite une nouvelle vérification. Contactez le support.",
    marketingOptIn:"Nouveautés et conseils",
    plan:"Formule", freePlan:"Formule gratuite", renewsOn:"Renouvellement le {date}",
    activeSubscription:"Abonnement actif",
    upgradeBlurb:"Passez à la version supérieure pour Nova illimité, des crédits Vega et plus",
    manageSubscription:"Gérer l'abonnement", tryProFree:"Essayez Pro gratuitement 7 jours",
    signOutOf:"Se déconnecter de {email}",
    errFillAll:"Veuillez remplir tous les champs.", errPasswordMismatch:"Les mots de passe ne correspondent pas.",
    errPasswordShort:"Le mot de passe doit contenir au moins 6 caractères.",
    errAgreeTerms:"Veuillez accepter les Conditions générales et la Politique de confidentialité pour continuer.",
    msgCheckInbox:"Consultez votre boîte de réception à {email} pour le lien de confirmation. Cliquez dessus puis revenez ici pour vous connecter.",
    errEmailNotConfirmed:"Veuillez d'abord confirmer votre e-mail. Vérifiez votre boîte de réception.",
    errBadCredentials:"E-mail ou mot de passe incorrect. Veuillez réessayer.",
    msgWelcomeBack:"Bon retour, {name} !", errGeneric:"Une erreur est survenue.",
    errEmailFirst:"Saisissez d'abord votre adresse e-mail ci-dessus.",
    msgResetSent:"Lien de réinitialisation envoyé à {email}. Cliquez sur le lien pour définir un nouveau mot de passe.",
    msgResendSent:"E-mail de confirmation renvoyé à {email}",
    resetTitle:"Réinitialiser votre mot de passe",
    resetBlurb:"Saisissez votre e-mail et nous vous enverrons un lien de réinitialisation.",
    yourEmailAddress:"Votre adresse e-mail", sending:"Envoi…", sendResetLink:"Envoyer le lien",
    continueGoogle:"Continuer avec Google", continueApple:"Continuer avec Apple", orUseEmail:"ou par e-mail",
    welcomeHeading:"Bienvenue", joinHeading:"Rejoindre The Docket",
    signInSubtitle:"Connectez-vous pour synchroniser vos données", registerSubtitle:"Créez votre compte gratuit",
    signInTab:"Connexion", registerTab:"Inscription",
    fullNameOptional:"Nom complet (facultatif)", emailAddress:"Adresse e-mail",
    passwordMin:"Mot de passe (min. 6 caractères)", password:"Mot de passe", confirmPassword:"Confirmer le mot de passe",
    agreeTo:"J'accepte les ", andWord:" et la ", privacyPolicy:"Politique de confidentialité",
    pleaseWait:"Veuillez patienter…", signedIn:"✓ Connecté !",
    signInArrow:"Se connecter →", createAccountArrow:"Créer un compte →",
    goToSignIn:"Aller à la connexion", forgotPassword:"Mot de passe oublié ?",
    didntReceive:"E-mail non reçu ? Vérifiez vos spams ou", resendIt:"renvoyez-le",
    legalEnglishNotice:"Ce document est fourni en anglais. La version anglaise prévaut en cas de divergence avec une traduction.",
    vegaLowWarning:"Crédits Vega bientôt épuisés — vous avez utilisé {pct} % de vos crédits cette période.",
    syncBehind:"Enregistré sur cet appareil, mais pas encore sauvegardé sur votre compte. Une nouvelle tentative aura lieu automatiquement.",
    allCategories:"Toutes les catégories",
    deleteAccount:"Supprimer le compte",
    deleteAccountWarn:"Cela supprime définitivement votre compte, toutes vos tâches, routines et conversations, et annule tout abonnement actif. C'est irréversible.",
    deleteAccountConfirm:"Saisissez {email} pour confirmer",
    deleteAccountCta:"Supprimer définitivement mon compte",
    deleting:"Suppression…", cancel2:"Annuler",
  },
  tr:{
    appName:"The Docket", daily:"Günlük Rutin", allTasks:"Tüm Görevler",
    week:"Hafta", archive:"Tamamlanan & Silinenler",
    newTask:"Yeni Görev", cancel:"İptal", addStep:"Ekle",
    prayerSetting:"Doğru namaz vakitleri",
    prayerLoading:"📍 Konumunuz alınıyor…",
    prayerDone:"✓ Namaz vakitleri güncellendi",
    prayerDenied:"⚠ Konum erişimi engellendi. Tarayıcınızın site ayarlarından etkinleştirin.",
    prayerTimeout:"⚠ Konumunuz zamanında alınamadı. Tekrar deneyin veya bağlantınızı kontrol edin.",
    prayerUnavailable:"⚠ Cihazınız şu anda konumunuzu belirleyemedi.",
    prayerService:"⚠ Namaz vakitleri servisine ulaşılamadı. Birazdan tekrar deneyin.",
    notifSetting:"Bildirimler",
    darkMode:"Karanlık mod",
    language:"Dil",
    nothingToday:"Bugün planlanmış bir şey yok.",
    nothingHere:"Burada bir şey yok.",
    allOpen:"Tümü Açık", ongoing:"Devam Eden", completable:"Tamamlanabilir",
    category:"Kategori", show:"Göster", overdue:"GECİKMİŞ",
    urgent:"acil", high:"yüksek", medium:"orta",
    working:"İşleniyor…",
    steps:"Adımlar", taskTitle:"Görev", notes:"Notlar",
    dueDate:"Son tarih", nature:"Tür", recurring:"Tekrar",
    oneOff:"Tek seferlik", daily2:"Günlük", weekly:"Haftalık",
    milestone:"Tamamlanabilir", ongoing2:"Süregelen",
    finishedDeleted:"Tamamlanan & Silinenler",
    calendar:"Takvim", addTask:"Görev Ekle",
    chatAsk:"Docket'e sorun…", chatHistory:"Sohbet geçmişi", newChat:"Yeni sohbet",
    historySignIn:"Sohbet geçmişinizi kaydetmek ve görmek için giriş yapın.",
    loading:"Yükleniyor…", noConversations:"Henüz geçmiş sohbet yok.",
    deleteConversation:"Sohbeti sil", close:"Kapat",
    attached:"Ek", attachedPreview:"Ek önizlemesi",
    imageAttached:"Görsel eklendi", removeImage:"Görseli kaldır",
    attachImage:"Görsel ekle",
    chooseModel:"Sonraki mesajlarınızı hangi modelin göndereceğini seçin",
    opusExhausted:"Bu ay Vega krediniz bitti — bunun yerine Nova ile gönderildi.",
    editTask:"Görevi Düzenle", saveChanges:"Değişiklikleri Kaydet", priority:"Öncelik",
    taskTitlePlaceholder:"Ne yapılması gerekiyor?", optional:"(isteğe bağlı)",
    notesPlaceholder:"Hatırlanmaya değer ayrıntılar…",
    typeMilestoneDesc:"Belirli bir sonu var", typeOngoingDesc:"Sabit bir bitişi yok",
    every2Days:"2 günde bir", every3Days:"3 günde bir",
    weekdays:"Hafta içi", weekends:"Hafta sonu", biweekly:"İki haftada bir", monthly:"Aylık",
    searchOrCustom:"Arayın veya kendiniz yazın…", clickToChange:"Değiştirmek için tıklayın",
    searchCategories:"Kategorilerde ara…", typeOwnCategory:"Kendi kategorinizi yazın…",
    selectDate:"Bir tarih seçin",
    // Category labels. Prefixed so they stay visibly grouped and
    // cannot collide with a UI key of the same name.
    cat_health:"Sağlık & Form", cat_fitness:"Form & Egzersiz", cat_nutrition:"Beslenme & Diyet", cat_mental:"Ruh Sağlığı",
    cat_medical:"Tıbbi", cat_faith:"İnanç & Maneviyat", cat_personal:"Kişisel Gelişim", cat_reading:"Okuma & Kitaplar",
    cat_music:"Müzik", cat_creative:"Yaratıcılık & Sanat", cat_language:"Dil Öğrenimi", cat_study:"Ders Çalışma",
    cat_research:"Araştırma", cat_writing:"Yazma", cat_education:"Eğitim", cat_career:"Kariyer",
    cat_interview:"Mülakatlar", cat_networking:"Network", cat_project:"Projeler", cat_hr:"İK & İnsan",
    cat_business:"İş", cat_side_hustle:"Ek Gelir", cat_marketing:"Pazarlama", cat_sales:"Satış",
    cat_design:"Tasarım", cat_content:"İçerik Üretimi", cat_customer:"Müşteri Hizmetleri", cat_finance:"Finans",
    cat_trading:"Alım Satım & Yatırım", cat_savings:"Birikim & Hedefler", cat_investment:"Yatırımlar", cat_debt:"Borç & Krediler",
    cat_tax:"Vergi & Muhasebe", cat_insurance:"Sigorta", cat_subscriptions:"Abonelikler", cat_legal:"Hukuk",
    cat_legal_work:"Hukuki İşler", cat_compliance:"Uyum", cat_admin:"İdari & Konut", cat_home:"Ev & Tadilat",
    cat_property:"Emlak", cat_utilities:"Faturalar & Aidat", cat_vehicle:"Araç", cat_driving:"Sürüş",
    cat_shopping:"Alışveriş & İşler", cat_family:"Aile", cat_childcare:"Çocuk Bakımı", cat_pets:"Evcil Hayvanlar",
    cat_social:"Sosyal Hayat", cat_events:"Etkinlikler", cat_technology:"Teknoloji", cat_travel:"Seyahat & Tatil",
    cat_volunteering:"Gönüllülük", cat_charity:"Bağış & Yardım", cat_community:"Topluluk", cat_environment:"Çevre",
    cat_sports:"Spor", cat_cooking:"Yemek & Tarifler", cat_other:"Diğer",
    tasksThisDay:"Bu günün görevleri", noEventsThisDay:"Bu gün için etkinlik veya görev yok.",
    hasTask:"Görev var", hasRoutine:"Rutin var",
    holType_public:"Resmî", holType_religious:"Dinî",
    holType_awareness:"Farkındalık", holType_cultural:"Kültürel",
    holType_islamic:"İslami", holType_bank:"Banka tatili",
    // Holiday names. Only the internationally observed dates are
    // translated; nation-specific ones keep their English names.
    hol_newYear:"Yılbaşı", hol_holocaustMemorial:"Holokost'u Anma Günü",
    hol_valentines:"Sevgililer Günü", hol_womensDay:"Dünya Kadınlar Günü",
    hol_downSyndrome:"Dünya Down Sendromu Günü", hol_nowruz:"Nevruz (Pers Yeni Yılı)",
    hol_waterDay:"Dünya Su Günü", hol_healthDay:"Dünya Sağlık Günü",
    hol_earthDay:"Dünya Günü", hol_labourDay:"Dünya İşçi Bayramı",
    hol_familiesDay:"Dünya Aile Günü", hol_childrensDay:"Dünya Çocuk Günü",
    hol_environmentDay:"Dünya Çevre Günü", hol_musicDay:"Dünya Müzik Günü",
    hol_youthDay:"Dünya Gençlik Günü", hol_peaceDay:"Dünya Barış Günü",
    hol_olderPersons:"Dünya Yaşlılar Günü", hol_teachersDay:"Dünya Öğretmenler Günü",
    hol_mentalHealthDay:"Dünya Ruh Sağlığı Günü", hol_foodDay:"Dünya Gıda Günü",
    hol_aidsDay:"Dünya AIDS Günü", hol_humanRights:"İnsan Hakları Günü",
    hol_christmas:"Noel", hol_newYearsEve:"Yılbaşı Gecesi",
    hol_ramadan:"Ramazan başlangıcı (yaklaşık)", hol_eidFitr:"Ramazan Bayramı (yaklaşık)",
    hol_eidAdha:"Kurban Bayramı (yaklaşık)", hol_islamicNewYear:"Hicri Yılbaşı (yaklaşık)",
    hol_arafah:"Arefe Günü (yaklaşık)",
    subscription:"Abonelik", widgetsShortcuts:"Widget'lar ve Kısayollar",
    siriShortcuts:"Siri ve Kısayollar", helpFeedback:"Yardım ve Geri Bildirim",
    privacyPermissions:"Gizlilik ve İzinler", termsConditions:"Şartlar ve Koşullar",
    switchToLight:"Açık moda geç", switchToDark:"Koyu moda geç",
    account:"Hesap", displayName:"Görünen Ad", saveLabel:"Kaydet", email:"E-posta",
    emailChangeNote:"E-posta değişikliği yeniden doğrulama gerektirir. Güncellemek için destekle iletişime geçin.",
    marketingOptIn:"Ürün güncellemeleri ve ipuçları",
    plan:"Plan", freePlan:"Ücretsiz Plan", renewsOn:"{date} tarihinde yenilenir",
    activeSubscription:"Etkin abonelik",
    upgradeBlurb:"Sınırsız Nova, Vega kredileri ve daha fazlası için yükseltin",
    manageSubscription:"Aboneliği Yönet", tryProFree:"Pro'yu 7 Gün Ücretsiz Deneyin",
    signOutOf:"{email} hesabından çıkış yap",
    errFillAll:"Lütfen tüm alanları doldurun.", errPasswordMismatch:"Parolalar eşleşmiyor.",
    errPasswordShort:"Parola en az 6 karakter olmalıdır.",
    errAgreeTerms:"Devam etmek için Şartlar ve Koşullar ile Gizlilik Politikasını kabul edin.",
    msgCheckInbox:"Onay bağlantısı için {email} adresindeki gelen kutunuzu kontrol edin. Bağlantıya tıklayıp buraya dönün.",
    errEmailNotConfirmed:"Lütfen önce e-postanızı onaylayın. Gönderdiğimiz doğrulama bağlantısı için gelen kutunuza bakın.",
    errBadCredentials:"E-posta veya parola hatalı. Lütfen tekrar deneyin.",
    msgWelcomeBack:"Tekrar hoş geldin, {name}!", errGeneric:"Bir şeyler ters gitti.",
    errEmailFirst:"Önce yukarıya e-posta adresinizi girin.",
    msgResetSent:"Parola sıfırlama bağlantısı {email} adresine gönderildi. Yeni parola belirlemek için bağlantıya tıklayın.",
    msgResendSent:"Onay e-postası {email} adresine tekrar gönderildi",
    resetTitle:"Parolanızı sıfırlayın",
    resetBlurb:"E-postanızı girin, size bir sıfırlama bağlantısı gönderelim.",
    yourEmailAddress:"E-posta adresiniz", sending:"Gönderiliyor…", sendResetLink:"Sıfırlama Bağlantısı Gönder",
    continueGoogle:"Google ile devam et", continueApple:"Apple ile devam et", orUseEmail:"veya e-posta kullan",
    welcomeHeading:"Hoş geldiniz", joinHeading:"The Docket'e katılın",
    signInSubtitle:"Verilerinizi eşitlemek için giriş yapın", registerSubtitle:"Ücretsiz hesabınızı oluşturun",
    signInTab:"Giriş", registerTab:"Kayıt",
    fullNameOptional:"Ad soyad (isteğe bağlı)", emailAddress:"E-posta adresi",
    passwordMin:"Parola (en az 6 karakter)", password:"Parola", confirmPassword:"Parolayı onayla",
    agreeTo:"Şunları kabul ediyorum ", andWord:" ve ", privacyPolicy:"Gizlilik Politikası",
    pleaseWait:"Lütfen bekleyin…", signedIn:"✓ Giriş yapıldı!",
    signInArrow:"Giriş Yap →", createAccountArrow:"Hesap Oluştur →",
    goToSignIn:"Girişe git", forgotPassword:"Parolanızı mı unuttunuz?",
    didntReceive:"E-posta gelmedi mi? Spam klasörünü kontrol edin veya", resendIt:"tekrar gönderin",
    legalEnglishNotice:"Bu belge İngilizce olarak sunulmaktadır. Çeviriyle herhangi bir tutarsızlık olması hâlinde İngilizce sürüm geçerlidir.",
    vegaLowWarning:"Vega krediniz azalıyor — bu dönemde kredinizin %{pct}'ini kullandınız.",
    syncBehind:"Bu cihaza kaydedildi, ancak henüz hesabınıza yedeklenmedi. Otomatik olarak yeniden denenecek.",
    allCategories:"Tüm Kategoriler",
    deleteAccount:"Hesabı Sil",
    deleteAccountWarn:"Bu işlem hesabınızı, tüm görevlerinizi, rutinlerinizi ve sohbetlerinizi kalıcı olarak siler ve etkin aboneliği iptal eder. Geri alınamaz.",
    deleteAccountConfirm:"Onaylamak için {email} yazın",
    deleteAccountCta:"Hesabımı kalıcı olarak sil",
    deleting:"Siliniyor…", cancel2:"İptal",
  },
  ur:{
    appName:"The Docket", daily:"روزانہ معمول", allTasks:"تمام کام",
    week:"ہفتہ", archive:"مکمل اور حذف",
    newTask:"نیا کام", cancel:"منسوخ", addStep:"شامل",
    prayerSetting:"درست اوقات نماز",
    prayerLoading:"📍 مقام حاصل ہو رہا ہے…",
    prayerDone:"✓ نماز کے اوقات آج کے لیے اپ ڈیٹ ہو گئے",
    prayerDenied:"⚠ مقام تک رسائی بلاک ہے۔ اسے اپنے براؤزر کی سائٹ سیٹنگز میں آن کریں۔",
    prayerTimeout:"⚠ وقت پر مقام حاصل نہیں ہو سکا۔ دوبارہ کوشش کریں یا کنیکشن چیک کریں۔",
    prayerUnavailable:"⚠ آپ کا آلہ اس وقت مقام معلوم نہیں کر سکا۔",
    prayerService:"⚠ نماز اوقات کی سروس تک رسائی نہیں ہو سکی۔ تھوڑی دیر میں دوبارہ کوشش کریں۔",
    notifSetting:"اطلاعات",
    darkMode:"تاریک موڈ",
    language:"زبان",
    nothingToday:"آج کچھ شیڈول نہیں۔",
    nothingHere:"یہاں کچھ نہیں۔",
    allOpen:"سب کھلے", ongoing:"جاری", completable:"مکمل ہونے والا",
    category:"زمرہ", show:"دکھائیں", overdue:"تاخیر",
    urgent:"فوری", high:"اہم", medium:"معمولی",
    working:"کام جاری…",
    steps:"مراحل", taskTitle:"کام", notes:"نوٹس",
    dueDate:"آخری تاریخ", nature:"نوعیت", recurring:"دہرائیں",
    oneOff:"ایک بار", daily2:"روزانہ", weekly:"ہفتہ وار",
    milestone:"مکمل ہونے والا", ongoing2:"جاری",
    finishedDeleted:"مکمل اور حذف",
    calendar:"کیلنڈر", addTask:"کام شامل کریں",
    chatAsk:"ڈاکٹ سے پوچھیں…", chatHistory:"گفتگو کی تاریخ", newChat:"نئی گفتگو",
    historySignIn:"اپنی گفتگو محفوظ کرنے اور دیکھنے کے لیے سائن ان کریں۔",
    loading:"لوڈ ہو رہا ہے…", noConversations:"ابھی کوئی پرانی گفتگو نہیں۔",
    deleteConversation:"گفتگو حذف کریں", close:"بند کریں",
    attached:"منسلک", attachedPreview:"منسلکہ کا پیش منظر",
    imageAttached:"تصویر منسلک ہے", removeImage:"تصویر ہٹائیں",
    attachImage:"تصویر منسلک کریں",
    chooseModel:"منتخب کریں کہ آپ کے اگلے پیغامات کون سا ماڈل بھیجے",
    opusExhausted:"اس ماہ Vega کریڈٹ ختم — اس کے بجائے Nova سے بھیجا گیا۔",
    editTask:"کام میں ترمیم", saveChanges:"تبدیلیاں محفوظ کریں", priority:"ترجیح",
    taskTitlePlaceholder:"کیا کرنا ہے؟", optional:"(اختیاری)",
    notesPlaceholder:"یاد رکھنے کے قابل کوئی تفصیل…",
    typeMilestoneDesc:"واضح اختتام رکھتا ہے", typeOngoingDesc:"کوئی مقررہ اختتام نہیں",
    every2Days:"ہر 2 دن بعد", every3Days:"ہر 3 دن بعد",
    weekdays:"ہفتے کے دن", weekends:"ہفتہ وار تعطیل", biweekly:"ہر 2 ہفتے بعد", monthly:"ماہانہ",
    searchOrCustom:"تلاش کریں یا خود لکھیں…", clickToChange:"تبدیل کرنے کے لیے دبائیں",
    searchCategories:"زمرے تلاش کریں…", typeOwnCategory:"اپنا زمرہ لکھیں…",
    selectDate:"تاریخ منتخب کریں",
    // Category labels. Prefixed so they stay visibly grouped and
    // cannot collide with a UI key of the same name.
    cat_health:"صحت اور فٹنس", cat_fitness:"فٹنس اور ورزش", cat_nutrition:"غذائیت اور خوراک", cat_mental:"ذہنی صحت",
    cat_medical:"طبی", cat_faith:"ایمان اور روحانیت", cat_personal:"ذاتی ترقی", cat_reading:"مطالعہ اور کتابیں",
    cat_music:"موسیقی", cat_creative:"تخلیق اور فنون", cat_language:"زبان سیکھنا", cat_study:"تعلیم و مطالعہ",
    cat_research:"تحقیق", cat_writing:"تحریر", cat_education:"تعلیم", cat_career:"کیریئر",
    cat_interview:"انٹرویوز", cat_networking:"روابط", cat_project:"منصوبے", cat_hr:"ایچ آر اور عملہ",
    cat_business:"کاروبار", cat_side_hustle:"اضافی کام", cat_marketing:"مارکیٹنگ", cat_sales:"فروخت",
    cat_design:"ڈیزائن", cat_content:"مواد کی تخلیق", cat_customer:"کسٹمر سروس", cat_finance:"مالیات",
    cat_trading:"ٹریڈنگ اور سرمایہ کاری", cat_savings:"بچت اور اہداف", cat_investment:"سرمایہ کاری", cat_debt:"قرض اور ادھار",
    cat_tax:"ٹیکس اور اکاؤنٹنگ", cat_insurance:"انشورنس", cat_subscriptions:"سبسکرپشنز", cat_legal:"قانونی",
    cat_legal_work:"قانونی کام", cat_compliance:"تعمیل", cat_admin:"انتظامی اور رہائش", cat_home:"گھر اور مرمت",
    cat_property:"جائیداد", cat_utilities:"یوٹیلیٹی اور بل", cat_vehicle:"گاڑی", cat_driving:"ڈرائیونگ",
    cat_shopping:"خریداری اور کام", cat_family:"خاندان", cat_childcare:"بچوں کی دیکھ بھال", cat_pets:"پالتو جانور",
    cat_social:"سماجی زندگی", cat_events:"تقریبات", cat_technology:"ٹیکنالوجی", cat_travel:"سفر اور چھٹیاں",
    cat_volunteering:"رضاکارانہ کام", cat_charity:"خیرات اور عطیہ", cat_community:"کمیونٹی", cat_environment:"ماحول",
    cat_sports:"کھیل", cat_cooking:"کھانا پکانا اور ترکیبیں", cat_other:"دیگر",
    tasksThisDay:"اس دن کے کام", noEventsThisDay:"اس دن کوئی تقریب یا کام نہیں۔",
    hasTask:"کام موجود", hasRoutine:"معمول موجود",
    holType_public:"سرکاری", holType_religious:"مذہبی",
    holType_awareness:"آگاہی", holType_cultural:"ثقافتی",
    holType_islamic:"اسلامی", holType_bank:"بینک تعطیل",
    // Holiday names. Only the internationally observed dates are
    // translated; nation-specific ones keep their English names.
    hol_newYear:"نئے سال کا دن", hol_holocaustMemorial:"ہولوکاسٹ یادگاری دن",
    hol_valentines:"یومِ محبت", hol_womensDay:"خواتین کا عالمی دن",
    hol_downSyndrome:"ڈاؤن سنڈروم کا عالمی دن", hol_nowruz:"نوروز (فارسی نیا سال)",
    hol_waterDay:"پانی کا عالمی دن", hol_healthDay:"صحت کا عالمی دن",
    hol_earthDay:"یومِ ارض", hol_labourDay:"مزدوروں کا عالمی دن",
    hol_familiesDay:"خاندانوں کا عالمی دن", hol_childrensDay:"بچوں کا عالمی دن",
    hol_environmentDay:"ماحولیات کا عالمی دن", hol_musicDay:"موسیقی کا عالمی دن",
    hol_youthDay:"نوجوانوں کا عالمی دن", hol_peaceDay:"امن کا عالمی دن",
    hol_olderPersons:"بزرگوں کا عالمی دن", hol_teachersDay:"اساتذہ کا عالمی دن",
    hol_mentalHealthDay:"ذہنی صحت کا عالمی دن", hol_foodDay:"خوراک کا عالمی دن",
    hol_aidsDay:"ایڈز کا عالمی دن", hol_humanRights:"انسانی حقوق کا دن",
    hol_christmas:"کرسمس", hol_newYearsEve:"نئے سال کی شب",
    hol_ramadan:"رمضان کا آغاز (تخمینی)", hol_eidFitr:"عید الفطر (تخمینی)",
    hol_eidAdha:"عید الاضحیٰ (تخمینی)", hol_islamicNewYear:"اسلامی نیا سال (تخمینی)",
    hol_arafah:"یومِ عرفہ (تخمینی)",
    subscription:"سبسکرپشن", widgetsShortcuts:"ویجٹس اور شارٹ کٹس",
    siriShortcuts:"سری اور شارٹ کٹس", helpFeedback:"مدد اور رائے",
    privacyPermissions:"رازداری اور اجازتیں", termsConditions:"شرائط و ضوابط",
    switchToLight:"روشن موڈ پر جائیں", switchToDark:"تاریک موڈ پر جائیں",
    account:"اکاؤنٹ", displayName:"ظاہر ہونے والا نام", saveLabel:"محفوظ کریں", email:"ای میل",
    emailChangeNote:"ای میل کی تبدیلی کے لیے دوبارہ تصدیق ضروری ہے۔ اپ ڈیٹ کے لیے سپورٹ سے رابطہ کریں۔",
    marketingOptIn:"پروڈکٹ اپ ڈیٹس اور مشورے",
    plan:"پلان", freePlan:"مفت پلان", renewsOn:"{date} کو تجدید ہوگی",
    activeSubscription:"فعال سبسکرپشن",
    upgradeBlurb:"لامحدود Nova، Vega کریڈٹ اور مزید کے لیے اپ گریڈ کریں",
    manageSubscription:"سبسکرپشن کا انتظام", tryProFree:"Pro کو 7 دن مفت آزمائیں",
    signOutOf:"{email} سے سائن آؤٹ کریں",
    errFillAll:"براہ کرم تمام خانے پُر کریں۔", errPasswordMismatch:"پاس ورڈ مماثل نہیں ہیں۔",
    errPasswordShort:"پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔",
    errAgreeTerms:"جاری رکھنے کے لیے شرائط و ضوابط اور پرائیویسی پالیسی سے اتفاق کریں۔",
    msgCheckInbox:"تصدیقی لنک کے لیے {email} پر اپنا ان باکس دیکھیں۔ لنک پر کلک کریں اور یہاں واپس آئیں۔",
    errEmailNotConfirmed:"پہلے اپنے ای میل کی تصدیق کریں۔ بھیجے گئے تصدیقی لنک کے لیے ان باکس دیکھیں۔",
    errBadCredentials:"ای میل یا پاس ورڈ غلط ہے۔ دوبارہ کوشش کریں۔",
    msgWelcomeBack:"خوش آمدید، {name}!", errGeneric:"کچھ غلط ہو گیا۔",
    errEmailFirst:"پہلے اوپر اپنا ای میل پتہ درج کریں۔",
    msgResetSent:"پاس ورڈ ری سیٹ لنک {email} پر بھیج دیا گیا۔ نیا پاس ورڈ بنانے کے لیے لنک پر کلک کریں۔",
    msgResendSent:"تصدیقی ای میل دوبارہ {email} پر بھیجا گیا",
    resetTitle:"اپنا پاس ورڈ ری سیٹ کریں",
    resetBlurb:"اپنا ای میل درج کریں، ہم آپ کو ری سیٹ لنک بھیجیں گے۔",
    yourEmailAddress:"آپ کا ای میل پتہ", sending:"بھیجا جا رہا ہے…", sendResetLink:"ری سیٹ لنک بھیجیں",
    continueGoogle:"Google کے ساتھ جاری رکھیں", continueApple:"Apple کے ساتھ جاری رکھیں", orUseEmail:"یا ای میل استعمال کریں",
    welcomeHeading:"خوش آمدید", joinHeading:"The Docket میں شامل ہوں",
    signInSubtitle:"اپنا ڈیٹا ہم آہنگ کرنے کے لیے سائن ان کریں", registerSubtitle:"اپنا مفت اکاؤنٹ بنائیں",
    signInTab:"سائن ان", registerTab:"رجسٹر",
    fullNameOptional:"پورا نام (اختیاری)", emailAddress:"ای میل پتہ",
    passwordMin:"پاس ورڈ (کم از کم 6 حروف)", password:"پاس ورڈ", confirmPassword:"پاس ورڈ کی تصدیق",
    agreeTo:"میں اتفاق کرتا ہوں ", andWord:" اور ", privacyPolicy:"پرائیویسی پالیسی",
    pleaseWait:"براہ کرم انتظار کریں…", signedIn:"✓ سائن ان ہو گئے!",
    signInArrow:"سائن ان ←", createAccountArrow:"اکاؤنٹ بنائیں ←",
    goToSignIn:"سائن ان پر جائیں", forgotPassword:"پاس ورڈ بھول گئے؟",
    didntReceive:"ای میل نہیں ملا؟ اسپیم فولڈر دیکھیں یا", resendIt:"دوبارہ بھیجیں",
    legalEnglishNotice:"یہ دستاویز انگریزی میں فراہم کی گئی ہے۔ کسی بھی ترجمے سے اختلاف کی صورت میں انگریزی نسخہ ہی معتبر ہوگا۔",
    vegaLowWarning:"Vega کریڈٹ کم ہو رہے ہیں — آپ نے اس مدت میں اپنے {pct}٪ کریڈٹ استعمال کر لیے ہیں۔",
    syncBehind:"اس ڈیوائس پر محفوظ ہے، مگر ابھی آپ کے اکاؤنٹ میں بیک اپ نہیں ہوا۔ خودبخود دوبارہ کوشش ہوگی۔",
    allCategories:"تمام زمرے",
    deleteAccount:"اکاؤنٹ حذف کریں",
    deleteAccountWarn:"یہ آپ کا اکاؤنٹ، تمام کام، معمولات اور گفتگو مستقل طور پر حذف کر دے گا اور فعال سبسکرپشن منسوخ کر دے گا۔ اسے واپس نہیں کیا جا سکتا۔",
    deleteAccountConfirm:"تصدیق کے لیے {email} لکھیں",
    deleteAccountCta:"میرا اکاؤنٹ مستقل طور پر حذف کریں",
    deleting:"حذف ہو رہا ہے…", cancel2:"منسوخ",
  },
  bn:{
    appName:"The Docket", daily:"দৈনিক রুটিন", allTasks:"সব কাজ",
    week:"সপ্তাহ", archive:"সম্পন্ন ও মুছে ফেলা",
    newTask:"নতুন কাজ", cancel:"বাতিল", addStep:"যোগ করুন",
    prayerSetting:"সঠিক নামাজের সময়",
    prayerLoading:"📍 আপনার অবস্থান নেওয়া হচ্ছে…",
    prayerDone:"✓ আজকের নামাজের সময় হালনাগাদ হয়েছে",
    prayerDenied:"⚠ অবস্থানের অনুমতি বন্ধ আছে। ব্রাউজারের সাইট সেটিংসে এটি চালু করুন।",
    prayerTimeout:"⚠ সময়মতো আপনার অবস্থান পাওয়া যায়নি। আবার চেষ্টা করুন বা সংযোগ দেখুন।",
    prayerUnavailable:"⚠ আপনার ডিভাইস এই মুহূর্তে অবস্থান নির্ণয় করতে পারেনি।",
    prayerService:"⚠ নামাজের সময় সেবায় পৌঁছানো যায়নি। কিছুক্ষণ পর চেষ্টা করুন।",
    notifSetting:"বিজ্ঞপ্তি",
    darkMode:"ডার্ক মোড",
    language:"ভাষা",
    nothingToday:"আজ কিছু নির্ধারিত নেই।",
    nothingHere:"এখানে কিছু নেই।",
    allOpen:"সব খোলা", ongoing:"চলমান", completable:"সম্পন্নযোগ্য",
    category:"বিভাগ", show:"দেখান", overdue:"বিলম্বিত",
    urgent:"জরুরি", high:"উচ্চ", medium:"মাঝারি",
    working:"কাজ চলছে…",
    steps:"ধাপ", taskTitle:"কাজ", notes:"নোট",
    dueDate:"নির্ধারিত তারিখ", nature:"ধরন", recurring:"পুনরাবৃত্ত",
    oneOff:"একবার", daily2:"দৈনিক", weekly:"সাপ্তাহিক",
    milestone:"সম্পন্নযোগ্য", ongoing2:"চলমান",
    finishedDeleted:"সম্পন্ন ও মুছে ফেলা",
    calendar:"ক্যালেন্ডার", addTask:"কাজ যোগ করুন",
    chatAsk:"ডকেটকে জিজ্ঞাসা করুন…", chatHistory:"চ্যাটের ইতিহাস", newChat:"নতুন চ্যাট",
    historySignIn:"চ্যাটের ইতিহাস সংরক্ষণ ও দেখতে সাইন ইন করুন।",
    loading:"লোড হচ্ছে…", noConversations:"এখনও কোনো পুরোনো কথোপকথন নেই।",
    deleteConversation:"কথোপকথন মুছুন", close:"বন্ধ করুন",
    attached:"সংযুক্ত", attachedPreview:"সংযুক্তির প্রিভিউ",
    imageAttached:"ছবি সংযুক্ত হয়েছে", removeImage:"ছবি সরান",
    attachImage:"ছবি সংযুক্ত করুন",
    chooseModel:"আপনার পরবর্তী বার্তা কোন মডেল পাঠাবে তা বেছে নিন",
    opusExhausted:"এই মাসের Vega ক্রেডিট শেষ — পরিবর্তে Nova দিয়ে পাঠানো হয়েছে।",
    editTask:"কাজ সম্পাদনা", saveChanges:"পরিবর্তন সংরক্ষণ", priority:"অগ্রাধিকার",
    taskTitlePlaceholder:"কী করতে হবে?", optional:"(ঐচ্ছিক)",
    notesPlaceholder:"মনে রাখার মতো যেকোনো বিবরণ…",
    typeMilestoneDesc:"একটি নির্দিষ্ট শেষ আছে", typeOngoingDesc:"নির্দিষ্ট কোনো শেষ নেই",
    every2Days:"প্রতি 2 দিনে", every3Days:"প্রতি 3 দিনে",
    weekdays:"কর্মদিবস", weekends:"সপ্তাহান্ত", biweekly:"প্রতি 2 সপ্তাহে", monthly:"মাসিক",
    searchOrCustom:"খুঁজুন বা নিজে লিখুন…", clickToChange:"পরিবর্তন করতে ক্লিক করুন",
    searchCategories:"বিভাগ খুঁজুন…", typeOwnCategory:"নিজের বিভাগ লিখুন…",
    selectDate:"একটি তারিখ বাছুন",
    // Category labels. Prefixed so they stay visibly grouped and
    // cannot collide with a UI key of the same name.
    cat_health:"স্বাস্থ্য ও ফিটনেস", cat_fitness:"ফিটনেস ও ব্যায়াম", cat_nutrition:"পুষ্টি ও খাদ্য", cat_mental:"মানসিক স্বাস্থ্য",
    cat_medical:"চিকিৎসা", cat_faith:"বিশ্বাস ও আধ্যাত্মিকতা", cat_personal:"ব্যক্তিগত উন্নয়ন", cat_reading:"পড়া ও বই",
    cat_music:"সংগীত", cat_creative:"সৃজনশীলতা ও শিল্প", cat_language:"ভাষা শেখা", cat_study:"পড়াশোনা",
    cat_research:"গবেষণা", cat_writing:"লেখা", cat_education:"শিক্ষা", cat_career:"কর্মজীবন",
    cat_interview:"সাক্ষাৎকার", cat_networking:"নেটওয়ার্কিং", cat_project:"প্রকল্প", cat_hr:"এইচআর ও কর্মী",
    cat_business:"ব্যবসা", cat_side_hustle:"পার্শ্ব-আয়", cat_marketing:"বিপণন", cat_sales:"বিক্রয়",
    cat_design:"ডিজাইন", cat_content:"কনটেন্ট তৈরি", cat_customer:"গ্রাহক সেবা", cat_finance:"অর্থ",
    cat_trading:"ট্রেডিং ও বিনিয়োগ", cat_savings:"সঞ্চয় ও লক্ষ্য", cat_investment:"বিনিয়োগ", cat_debt:"ঋণ ও দেনা",
    cat_tax:"কর ও হিসাব", cat_insurance:"বিমা", cat_subscriptions:"সাবস্ক্রিপশন", cat_legal:"আইনি",
    cat_legal_work:"আইনি কাজ", cat_compliance:"সম্মতি", cat_admin:"প্রশাসন ও বাসস্থান", cat_home:"বাড়ি ও মেরামত",
    cat_property:"সম্পত্তি", cat_utilities:"ইউটিলিটি ও বিল", cat_vehicle:"যানবাহন", cat_driving:"ড্রাইভিং",
    cat_shopping:"কেনাকাটা ও কাজ", cat_family:"পরিবার", cat_childcare:"শিশু যত্ন", cat_pets:"পোষা প্রাণী",
    cat_social:"সামাজিক জীবন", cat_events:"অনুষ্ঠান", cat_technology:"প্রযুক্তি", cat_travel:"ভ্রমণ ও ছুটি",
    cat_volunteering:"স্বেচ্ছাসেবা", cat_charity:"দান ও সহায়তা", cat_community:"সম্প্রদায়", cat_environment:"পরিবেশ",
    cat_sports:"খেলাধুলা", cat_cooking:"রান্না ও রেসিপি", cat_other:"অন্যান্য",
    tasksThisDay:"এই দিনের কাজ", noEventsThisDay:"এই দিনে কোনো ইভেন্ট বা কাজ নেই।",
    hasTask:"কাজ আছে", hasRoutine:"রুটিন আছে",
    holType_public:"সরকারি", holType_religious:"ধর্মীয়",
    holType_awareness:"সচেতনতা", holType_cultural:"সাংস্কৃতিক",
    holType_islamic:"ইসলামি", holType_bank:"ব্যাংক ছুটি",
    // Holiday names. Only the internationally observed dates are
    // translated; nation-specific ones keep their English names.
    hol_newYear:"নববর্ষ দিবস", hol_holocaustMemorial:"হলোকস্ট স্মরণ দিবস",
    hol_valentines:"ভ্যালেন্টাইন্স ডে", hol_womensDay:"আন্তর্জাতিক নারী দিবস",
    hol_downSyndrome:"বিশ্ব ডাউন সিনড্রোম দিবস", hol_nowruz:"নওরোজ (পারস্য নববর্ষ)",
    hol_waterDay:"বিশ্ব পানি দিবস", hol_healthDay:"বিশ্ব স্বাস্থ্য দিবস",
    hol_earthDay:"ধরিত্রী দিবস", hol_labourDay:"আন্তর্জাতিক শ্রমিক দিবস",
    hol_familiesDay:"আন্তর্জাতিক পরিবার দিবস", hol_childrensDay:"বিশ্ব শিশু দিবস",
    hol_environmentDay:"বিশ্ব পরিবেশ দিবস", hol_musicDay:"বিশ্ব সংগীত দিবস",
    hol_youthDay:"আন্তর্জাতিক যুব দিবস", hol_peaceDay:"আন্তর্জাতিক শান্তি দিবস",
    hol_olderPersons:"আন্তর্জাতিক প্রবীণ দিবস", hol_teachersDay:"বিশ্ব শিক্ষক দিবস",
    hol_mentalHealthDay:"বিশ্ব মানসিক স্বাস্থ্য দিবস", hol_foodDay:"বিশ্ব খাদ্য দিবস",
    hol_aidsDay:"বিশ্ব এইডস দিবস", hol_humanRights:"মানবাধিকার দিবস",
    hol_christmas:"বড়দিন", hol_newYearsEve:"নববর্ষের প্রাক্কাল",
    hol_ramadan:"রমজান শুরু (আনুমানিক)", hol_eidFitr:"ঈদুল ফিতর (আনুমানিক)",
    hol_eidAdha:"ঈদুল আজহা (আনুমানিক)", hol_islamicNewYear:"হিজরি নববর্ষ (আনুমানিক)",
    hol_arafah:"আরাফাহ দিবস (আনুমানিক)",
    subscription:"সাবস্ক্রিপশন", widgetsShortcuts:"উইজেট ও শর্টকাট",
    siriShortcuts:"সিরি ও শর্টকাট", helpFeedback:"সহায়তা ও মতামত",
    privacyPermissions:"গোপনীয়তা ও অনুমতি", termsConditions:"শর্তাবলি",
    switchToLight:"হালকা মোডে যান", switchToDark:"ডার্ক মোডে যান",
    account:"অ্যাকাউন্ট", displayName:"প্রদর্শিত নাম", saveLabel:"সংরক্ষণ", email:"ইমেইল",
    emailChangeNote:"ইমেইল পরিবর্তনে পুনরায় যাচাই প্রয়োজন। হালনাগাদ করতে সহায়তায় যোগাযোগ করুন।",
    marketingOptIn:"পণ্যের হালনাগাদ ও পরামর্শ",
    plan:"প্ল্যান", freePlan:"ফ্রি প্ল্যান", renewsOn:"{date} তারিখে নবায়ন হবে",
    activeSubscription:"সক্রিয় সাবস্ক্রিপশন",
    upgradeBlurb:"সীমাহীন Nova, Vega ক্রেডিট ও আরও কিছুর জন্য আপগ্রেড করুন",
    manageSubscription:"সাবস্ক্রিপশন পরিচালনা", tryProFree:"Pro ৭ দিন বিনামূল্যে দেখুন",
    signOutOf:"{email} থেকে সাইন আউট করুন",
    errFillAll:"অনুগ্রহ করে সব ঘর পূরণ করুন।", errPasswordMismatch:"পাসওয়ার্ড মিলছে না।",
    errPasswordShort:"পাসওয়ার্ড অন্তত 6 অক্ষরের হতে হবে।",
    errAgreeTerms:"চালিয়ে যেতে শর্তাবলি ও গোপনীয়তা নীতিতে সম্মত হোন।",
    msgCheckInbox:"নিশ্চিতকরণ লিঙ্কের জন্য {email} ঠিকানার ইনবক্স দেখুন। লিঙ্কে ক্লিক করে এখানে ফিরে আসুন।",
    errEmailNotConfirmed:"আগে আপনার ইমেইল নিশ্চিত করুন। আমাদের পাঠানো যাচাই লিঙ্কের জন্য ইনবক্স দেখুন।",
    errBadCredentials:"ইমেইল বা পাসওয়ার্ড ভুল। আবার চেষ্টা করুন।",
    msgWelcomeBack:"আবার স্বাগতম, {name}!", errGeneric:"কিছু একটা ভুল হয়েছে।",
    errEmailFirst:"আগে উপরে আপনার ইমেইল ঠিকানা লিখুন।",
    msgResetSent:"পাসওয়ার্ড রিসেট লিঙ্ক {email} ঠিকানায় পাঠানো হয়েছে। নতুন পাসওয়ার্ড দিতে লিঙ্কে ক্লিক করুন।",
    msgResendSent:"নিশ্চিতকরণ ইমেইল আবার {email} ঠিকানায় পাঠানো হয়েছে",
    resetTitle:"আপনার পাসওয়ার্ড রিসেট করুন",
    resetBlurb:"আপনার ইমেইল দিন, আমরা রিসেট লিঙ্ক পাঠাব।",
    yourEmailAddress:"আপনার ইমেইল ঠিকানা", sending:"পাঠানো হচ্ছে…", sendResetLink:"রিসেট লিঙ্ক পাঠান",
    continueGoogle:"Google দিয়ে চালিয়ে যান", continueApple:"Apple দিয়ে চালিয়ে যান", orUseEmail:"অথবা ইমেইল ব্যবহার করুন",
    welcomeHeading:"স্বাগতম", joinHeading:"The Docket-এ যোগ দিন",
    signInSubtitle:"ডেটা সিঙ্ক করতে সাইন ইন করুন", registerSubtitle:"আপনার বিনামূল্যের অ্যাকাউন্ট তৈরি করুন",
    signInTab:"সাইন ইন", registerTab:"নিবন্ধন",
    fullNameOptional:"পুরো নাম (ঐচ্ছিক)", emailAddress:"ইমেইল ঠিকানা",
    passwordMin:"পাসওয়ার্ড (অন্তত 6 অক্ষর)", password:"পাসওয়ার্ড", confirmPassword:"পাসওয়ার্ড নিশ্চিত করুন",
    agreeTo:"আমি সম্মত ", andWord:" এবং ", privacyPolicy:"গোপনীয়তা নীতি",
    pleaseWait:"অনুগ্রহ করে অপেক্ষা করুন…", signedIn:"✓ সাইন ইন হয়েছে!",
    signInArrow:"সাইন ইন →", createAccountArrow:"অ্যাকাউন্ট তৈরি করুন →",
    goToSignIn:"সাইন ইনে যান", forgotPassword:"পাসওয়ার্ড ভুলে গেছেন?",
    didntReceive:"ইমেইল পাননি? স্প্যাম ফোল্ডার দেখুন অথবা", resendIt:"আবার পাঠান",
    legalEnglishNotice:"এই নথিটি ইংরেজিতে সরবরাহ করা হয়েছে। অনুবাদের সাথে কোনো অসঙ্গতি থাকলে ইংরেজি সংস্করণই প্রযোজ্য হবে।",
    vegaLowWarning:"Vega ক্রেডিট ফুরিয়ে আসছে — এই মেয়াদে আপনি আপনার {pct}% ক্রেডিট ব্যবহার করেছেন।",
    syncBehind:"এই ডিভাইসে সংরক্ষিত, তবে এখনও আপনার অ্যাকাউন্টে ব্যাকআপ হয়নি। স্বয়ংক্রিয়ভাবে আবার চেষ্টা করা হবে।",
    allCategories:"সব বিভাগ",
    deleteAccount:"অ্যাকাউন্ট মুছুন",
    deleteAccountWarn:"এটি আপনার অ্যাকাউন্ট, সমস্ত কাজ, রুটিন ও কথোপকথন স্থায়ীভাবে মুছে দেবে এবং সক্রিয় সাবস্ক্রিপশন বাতিল করবে। এটি ফেরানো যাবে না।",
    deleteAccountConfirm:"নিশ্চিত করতে {email} লিখুন",
    deleteAccountCta:"আমার অ্যাকাউন্ট স্থায়ীভাবে মুছুন",
    deleting:"মুছে ফেলা হচ্ছে…", cancel2:"বাতিল",
  },
  es:{
    appName:"The Docket", daily:"Rutina Diaria", allTasks:"Todas las Tareas",
    week:"Semana", archive:"Terminadas y Eliminadas",
    newTask:"Nueva Tarea", cancel:"Cancelar", addStep:"Añadir",
    prayerSetting:"Horarios de oración precisos",
    prayerLoading:"📍 Obteniendo tu ubicación…",
    prayerDone:"✓ Horarios de oración actualizados",
    prayerDenied:"⚠ El acceso a la ubicación está bloqueado. Actívalo en los ajustes del sitio en tu navegador.",
    prayerTimeout:"⚠ No se pudo obtener tu ubicación a tiempo. Inténtalo de nuevo o revisa tu conexión.",
    prayerUnavailable:"⚠ Tu dispositivo no pudo determinar tu ubicación en este momento.",
    prayerService:"⚠ No se pudo conectar con el servicio de horarios de oración. Inténtalo en unos minutos.",
    notifSetting:"Notificaciones",
    darkMode:"Modo oscuro",
    language:"Idioma",
    nothingToday:"Nada programado para hoy.",
    nothingHere:"Nada por aquí.",
    allOpen:"Todo Abierto", ongoing:"En curso", completable:"Completable",
    category:"Categoría", show:"Mostrar", overdue:"ATRASADO",
    urgent:"urgente", high:"alta", medium:"media",
    working:"Trabajando en ello…",
    steps:"Pasos", taskTitle:"Tarea", notes:"Notas",
    dueDate:"Fecha límite", nature:"Tipo", recurring:"Recurrente",
    oneOff:"Puntual", daily2:"Diaria", weekly:"Semanal",
    milestone:"Completable", ongoing2:"Continua",
    finishedDeleted:"Terminadas y Eliminadas",
    calendar:"Calendario", addTask:"Añadir Tarea",
    chatAsk:"Pregunta a Docket…", chatHistory:"Historial de chats", newChat:"Chat nuevo",
    historySignIn:"Inicia sesión para guardar y ver tu historial de chats.",
    loading:"Cargando…", noConversations:"Aún no hay conversaciones.",
    deleteConversation:"Eliminar conversación", close:"Cerrar",
    attached:"Adjunto", attachedPreview:"Vista previa del adjunto",
    imageAttached:"Imagen adjunta", removeImage:"Quitar la imagen",
    attachImage:"Adjuntar una imagen",
    chooseModel:"Elige qué modelo enviará tus próximos mensajes",
    opusExhausted:"Créditos de Vega agotados este mes — enviado con Nova en su lugar.",
    editTask:"Editar Tarea", saveChanges:"Guardar Cambios", priority:"Prioridad",
    taskTitlePlaceholder:"¿Qué hay que hacer?", optional:"(opcional)",
    notesPlaceholder:"Cualquier detalle que merezca recordarse…",
    typeMilestoneDesc:"Tiene un final claro", typeOngoingDesc:"Sin final fijo",
    every2Days:"Cada 2 días", every3Days:"Cada 3 días",
    weekdays:"Entre semana", weekends:"Fines de semana", biweekly:"Cada 2 semanas", monthly:"Mensual",
    searchOrCustom:"Busca o escribe una propia…", clickToChange:"Haz clic para cambiar",
    searchCategories:"Buscar categorías…", typeOwnCategory:"Escribe tu propia categoría…",
    selectDate:"Elige una fecha",
    // Category labels. Prefixed so they stay visibly grouped and
    // cannot collide with a UI key of the same name.
    cat_health:"Salud y Forma", cat_fitness:"Forma y Ejercicio", cat_nutrition:"Nutrición y Dieta", cat_mental:"Salud Mental",
    cat_medical:"Médico", cat_faith:"Fe y Espiritualidad", cat_personal:"Desarrollo Personal", cat_reading:"Lectura y Libros",
    cat_music:"Música", cat_creative:"Creatividad y Arte", cat_language:"Aprender Idiomas", cat_study:"Estudio",
    cat_research:"Investigación", cat_writing:"Escritura", cat_education:"Educación", cat_career:"Carrera",
    cat_interview:"Entrevistas", cat_networking:"Contactos", cat_project:"Proyectos", cat_hr:"RR. HH. y Personal",
    cat_business:"Negocios", cat_side_hustle:"Trabajo Extra", cat_marketing:"Marketing", cat_sales:"Ventas",
    cat_design:"Diseño", cat_content:"Creación de Contenido", cat_customer:"Atención al Cliente", cat_finance:"Finanzas",
    cat_trading:"Trading e Inversión", cat_savings:"Ahorro y Metas", cat_investment:"Inversiones", cat_debt:"Deudas y Préstamos",
    cat_tax:"Impuestos y Contabilidad", cat_insurance:"Seguros", cat_subscriptions:"Suscripciones", cat_legal:"Legal",
    cat_legal_work:"Trabajo Legal", cat_compliance:"Cumplimiento", cat_admin:"Trámites y Vivienda", cat_home:"Hogar y Bricolaje",
    cat_property:"Propiedad", cat_utilities:"Servicios y Facturas", cat_vehicle:"Vehículo", cat_driving:"Conducción",
    cat_shopping:"Compras y Recados", cat_family:"Familia", cat_childcare:"Cuidado Infantil", cat_pets:"Mascotas",
    cat_social:"Vida Social", cat_events:"Eventos", cat_technology:"Tecnología", cat_travel:"Viajes y Vacaciones",
    cat_volunteering:"Voluntariado", cat_charity:"Donaciones y Caridad", cat_community:"Comunidad", cat_environment:"Medio Ambiente",
    cat_sports:"Deportes", cat_cooking:"Cocina y Recetas", cat_other:"Otro",
    tasksThisDay:"Tareas de este día", noEventsThisDay:"No hay eventos ni tareas este día.",
    hasTask:"Tiene tarea", hasRoutine:"Tiene rutina",
    holType_public:"Festivo", holType_religious:"Religioso",
    holType_awareness:"Concienciación", holType_cultural:"Cultural",
    holType_islamic:"Islámico", holType_bank:"Festivo bancario",
    // Holiday names. Only the internationally observed dates are
    // translated; nation-specific ones keep their English names.
    hol_newYear:"Año Nuevo", hol_holocaustMemorial:"Día de la Memoria del Holocausto",
    hol_valentines:"San Valentín", hol_womensDay:"Día Internacional de la Mujer",
    hol_downSyndrome:"Día Mundial del Síndrome de Down", hol_nowruz:"Nowruz (Año Nuevo persa)",
    hol_waterDay:"Día Mundial del Agua", hol_healthDay:"Día Mundial de la Salud",
    hol_earthDay:"Día de la Tierra", hol_labourDay:"Día Internacional de los Trabajadores",
    hol_familiesDay:"Día Internacional de las Familias", hol_childrensDay:"Día Mundial de la Infancia",
    hol_environmentDay:"Día Mundial del Medio Ambiente", hol_musicDay:"Día Mundial de la Música",
    hol_youthDay:"Día Internacional de la Juventud", hol_peaceDay:"Día Internacional de la Paz",
    hol_olderPersons:"Día Internacional de las Personas Mayores", hol_teachersDay:"Día Mundial de los Docentes",
    hol_mentalHealthDay:"Día Mundial de la Salud Mental", hol_foodDay:"Día Mundial de la Alimentación",
    hol_aidsDay:"Día Mundial del Sida", hol_humanRights:"Día de los Derechos Humanos",
    hol_christmas:"Navidad", hol_newYearsEve:"Nochevieja",
    hol_ramadan:"Inicio del Ramadán (aprox.)", hol_eidFitr:"Eid al-Fitr (aprox.)",
    hol_eidAdha:"Eid al-Adha (aprox.)", hol_islamicNewYear:"Año Nuevo islámico (aprox.)",
    hol_arafah:"Día de Arafat (aprox.)",
    subscription:"Suscripción", widgetsShortcuts:"Widgets y accesos directos",
    siriShortcuts:"Siri y accesos directos", helpFeedback:"Ayuda y comentarios",
    privacyPermissions:"Privacidad y permisos", termsConditions:"Términos y Condiciones",
    switchToLight:"Cambiar a modo claro", switchToDark:"Cambiar a modo oscuro",
    account:"Cuenta", displayName:"Nombre visible", saveLabel:"Guardar", email:"Correo electrónico",
    emailChangeNote:"Cambiar el correo requiere volver a verificarlo. Contacta con soporte para actualizarlo.",
    marketingOptIn:"Novedades y consejos",
    plan:"Plan", freePlan:"Plan gratuito", renewsOn:"Se renueva el {date}",
    activeSubscription:"Suscripción activa",
    upgradeBlurb:"Mejora tu plan para Nova ilimitado, créditos Vega y más",
    manageSubscription:"Gestionar suscripción", tryProFree:"Prueba Pro gratis 7 días",
    signOutOf:"Cerrar sesión de {email}",
    errFillAll:"Por favor, completa todos los campos.", errPasswordMismatch:"Las contraseñas no coinciden.",
    errPasswordShort:"La contraseña debe tener al menos 6 caracteres.",
    errAgreeTerms:"Acepta los Términos y Condiciones y la Política de Privacidad para continuar.",
    msgCheckInbox:"Revisa tu bandeja de entrada en {email} para el enlace de confirmación. Haz clic y vuelve aquí para iniciar sesión.",
    errEmailNotConfirmed:"Confirma tu correo primero. Revisa tu bandeja de entrada para el enlace de verificación.",
    errBadCredentials:"Correo o contraseña incorrectos. Inténtalo de nuevo.",
    msgWelcomeBack:"¡Bienvenido de nuevo, {name}!", errGeneric:"Algo salió mal.",
    errEmailFirst:"Introduce primero tu correo arriba.",
    msgResetSent:"Enlace de restablecimiento enviado a {email}. Haz clic en el enlace para crear una nueva contraseña.",
    msgResendSent:"Correo de confirmación reenviado a {email}",
    resetTitle:"Restablece tu contraseña",
    resetBlurb:"Introduce tu correo y te enviaremos un enlace para restablecer la contraseña.",
    yourEmailAddress:"Tu correo electrónico", sending:"Enviando…", sendResetLink:"Enviar enlace",
    continueGoogle:"Continuar con Google", continueApple:"Continuar con Apple", orUseEmail:"o usa el correo",
    welcomeHeading:"Bienvenido", joinHeading:"Únete a The Docket",
    signInSubtitle:"Inicia sesión para sincronizar tus datos", registerSubtitle:"Crea tu cuenta gratuita",
    signInTab:"Iniciar sesión", registerTab:"Registrarse",
    fullNameOptional:"Nombre completo (opcional)", emailAddress:"Correo electrónico",
    passwordMin:"Contraseña (mín. 6 caracteres)", password:"Contraseña", confirmPassword:"Confirmar contraseña",
    agreeTo:"Acepto los ", andWord:" y la ", privacyPolicy:"Política de Privacidad",
    pleaseWait:"Espera…", signedIn:"✓ ¡Sesión iniciada!",
    signInArrow:"Iniciar sesión →", createAccountArrow:"Crear cuenta →",
    goToSignIn:"Ir a iniciar sesión", forgotPassword:"¿Olvidaste tu contraseña?",
    didntReceive:"¿No recibiste el correo? Revisa tu carpeta de spam o", resendIt:"reenvíalo",
    legalEnglishNotice:"Este documento se proporciona en inglés. La versión en inglés prevalecerá en caso de cualquier discrepancia con una traducción.",
    vegaLowWarning:"Créditos Vega casi agotados: has usado el {pct} % de tus créditos este periodo.",
    syncBehind:"Guardado en este dispositivo, pero aún no en tu cuenta. Se reintentará automáticamente.",
    allCategories:"Todas las categorías",
    deleteAccount:"Eliminar cuenta",
    deleteAccountWarn:"Esto elimina permanentemente tu cuenta, todas tus tareas, rutinas y conversaciones, y cancela cualquier suscripción activa. No se puede deshacer.",
    deleteAccountConfirm:"Escribe {email} para confirmar",
    deleteAccountCta:"Eliminar mi cuenta permanentemente",
    deleting:"Eliminando…", cancel2:"Cancelar",
  },
  hi:{
    appName:"The Docket", daily:"दैनिक दिनचर्या", allTasks:"सभी कार्य",
    week:"सप्ताह", archive:"पूर्ण और हटाए गए",
    newTask:"नया कार्य", cancel:"रद्द करें", addStep:"जोड़ें",
    prayerSetting:"सटीक नमाज़ के समय",
    prayerLoading:"📍 आपका स्थान पता किया जा रहा है…",
    prayerDone:"✓ आज के नमाज़ के समय अपडेट हो गए",
    prayerDenied:"⚠ स्थान की अनुमति अवरुद्ध है। इसे अपने ब्राउज़र की साइट सेटिंग्स में चालू करें।",
    prayerTimeout:"⚠ समय पर आपका स्थान नहीं मिल सका। फिर से कोशिश करें या कनेक्शन जाँचें।",
    prayerUnavailable:"⚠ आपका डिवाइस इस समय स्थान तय नहीं कर सका।",
    prayerService:"⚠ नमाज़ समय सेवा से संपर्क नहीं हो सका। थोड़ी देर बाद कोशिश करें।",
    notifSetting:"सूचनाएँ",
    darkMode:"डार्क मोड",
    language:"भाषा",
    nothingToday:"आज कुछ निर्धारित नहीं है।",
    nothingHere:"यहाँ कुछ नहीं है।",
    allOpen:"सभी खुले", ongoing:"जारी", completable:"पूर्ण होने योग्य",
    category:"श्रेणी", show:"दिखाएँ", overdue:"विलंबित",
    urgent:"अत्यावश्यक", high:"उच्च", medium:"मध्यम",
    working:"काम जारी है…",
    steps:"चरण", taskTitle:"कार्य", notes:"नोट्स",
    dueDate:"नियत तारीख", nature:"प्रकार", recurring:"आवर्ती",
    oneOff:"एक बार", daily2:"दैनिक", weekly:"साप्ताहिक",
    milestone:"पूर्ण होने योग्य", ongoing2:"निरंतर",
    finishedDeleted:"पूर्ण और हटाए गए",
    calendar:"कैलेंडर", addTask:"कार्य जोड़ें",
    chatAsk:"डॉकेट से पूछें…", chatHistory:"चैट इतिहास", newChat:"नई चैट",
    historySignIn:"अपना चैट इतिहास सहेजने और देखने के लिए साइन इन करें।",
    loading:"लोड हो रहा है…", noConversations:"अभी कोई पुरानी बातचीत नहीं।",
    deleteConversation:"बातचीत हटाएँ", close:"बंद करें",
    attached:"संलग्न", attachedPreview:"संलग्नक का पूर्वावलोकन",
    imageAttached:"छवि संलग्न है", removeImage:"छवि हटाएँ",
    attachImage:"छवि संलग्न करें",
    chooseModel:"चुनें कि आपके अगले संदेश कौन सा मॉडल भेजेगा",
    opusExhausted:"इस माह Vega क्रेडिट समाप्त — इसके बजाय Nova से भेजा गया।",
    editTask:"कार्य संपादित करें", saveChanges:"बदलाव सहेजें", priority:"प्राथमिकता",
    taskTitlePlaceholder:"क्या करना है?", optional:"(वैकल्पिक)",
    notesPlaceholder:"याद रखने लायक कोई भी विवरण…",
    typeMilestoneDesc:"इसका स्पष्ट अंत है", typeOngoingDesc:"कोई निश्चित अंत नहीं",
    every2Days:"हर 2 दिन में", every3Days:"हर 3 दिन में",
    weekdays:"कार्यदिवस", weekends:"सप्ताहांत", biweekly:"हर 2 सप्ताह में", monthly:"मासिक",
    searchOrCustom:"खोजें या स्वयं लिखें…", clickToChange:"बदलने के लिए क्लिक करें",
    searchCategories:"श्रेणियाँ खोजें…", typeOwnCategory:"अपनी श्रेणी लिखें…",
    selectDate:"तारीख चुनें",
    // Category labels. Prefixed so they stay visibly grouped and
    // cannot collide with a UI key of the same name.
    cat_health:"स्वास्थ्य और फिटनेस", cat_fitness:"फिटनेस और व्यायाम", cat_nutrition:"पोषण और आहार", cat_mental:"मानसिक स्वास्थ्य",
    cat_medical:"चिकित्सा", cat_faith:"आस्था और आध्यात्म", cat_personal:"व्यक्तिगत विकास", cat_reading:"पढ़ना और किताबें",
    cat_music:"संगीत", cat_creative:"रचनात्मकता और कला", cat_language:"भाषा सीखना", cat_study:"अध्ययन",
    cat_research:"शोध", cat_writing:"लेखन", cat_education:"शिक्षा", cat_career:"करियर",
    cat_interview:"साक्षात्कार", cat_networking:"नेटवर्किंग", cat_project:"परियोजनाएँ", cat_hr:"एचआर और कर्मचारी",
    cat_business:"व्यवसाय", cat_side_hustle:"अतिरिक्त काम", cat_marketing:"मार्केटिंग", cat_sales:"बिक्री",
    cat_design:"डिज़ाइन", cat_content:"कंटेंट निर्माण", cat_customer:"ग्राहक सेवा", cat_finance:"वित्त",
    cat_trading:"ट्रेडिंग और निवेश", cat_savings:"बचत और लक्ष्य", cat_investment:"निवेश", cat_debt:"कर्ज़ और ऋण",
    cat_tax:"कर और लेखा", cat_insurance:"बीमा", cat_subscriptions:"सदस्यताएँ", cat_legal:"कानूनी",
    cat_legal_work:"कानूनी कार्य", cat_compliance:"अनुपालन", cat_admin:"प्रशासन और आवास", cat_home:"घर और मरम्मत",
    cat_property:"संपत्ति", cat_utilities:"उपयोगिता और बिल", cat_vehicle:"वाहन", cat_driving:"ड्राइविंग",
    cat_shopping:"खरीदारी और काम", cat_family:"परिवार", cat_childcare:"बच्चों की देखभाल", cat_pets:"पालतू जानवर",
    cat_social:"सामाजिक जीवन", cat_events:"कार्यक्रम", cat_technology:"प्रौद्योगिकी", cat_travel:"यात्रा और छुट्टियाँ",
    cat_volunteering:"स्वयंसेवा", cat_charity:"दान और परोपकार", cat_community:"समुदाय", cat_environment:"पर्यावरण",
    cat_sports:"खेल", cat_cooking:"खाना और व्यंजन", cat_other:"अन्य",
    tasksThisDay:"इस दिन के कार्य", noEventsThisDay:"इस दिन कोई कार्यक्रम या कार्य नहीं।",
    hasTask:"कार्य है", hasRoutine:"दिनचर्या है",
    holType_public:"सार्वजनिक", holType_religious:"धार्मिक",
    holType_awareness:"जागरूकता", holType_cultural:"सांस्कृतिक",
    holType_islamic:"इस्लामी", holType_bank:"बैंक अवकाश",
    // Holiday names. Only the internationally observed dates are
    // translated; nation-specific ones keep their English names.
    hol_newYear:"नववर्ष दिवस", hol_holocaustMemorial:"होलोकॉस्ट स्मृति दिवस",
    hol_valentines:"वैलेंटाइन डे", hol_womensDay:"अंतर्राष्ट्रीय महिला दिवस",
    hol_downSyndrome:"विश्व डाउन सिंड्रोम दिवस", hol_nowruz:"नवरोज़ (फ़ारसी नववर्ष)",
    hol_waterDay:"विश्व जल दिवस", hol_healthDay:"विश्व स्वास्थ्य दिवस",
    hol_earthDay:"पृथ्वी दिवस", hol_labourDay:"अंतर्राष्ट्रीय श्रमिक दिवस",
    hol_familiesDay:"अंतर्राष्ट्रीय परिवार दिवस", hol_childrensDay:"विश्व बाल दिवस",
    hol_environmentDay:"विश्व पर्यावरण दिवस", hol_musicDay:"विश्व संगीत दिवस",
    hol_youthDay:"अंतर्राष्ट्रीय युवा दिवस", hol_peaceDay:"अंतर्राष्ट्रीय शांति दिवस",
    hol_olderPersons:"अंतर्राष्ट्रीय वृद्धजन दिवस", hol_teachersDay:"विश्व शिक्षक दिवस",
    hol_mentalHealthDay:"विश्व मानसिक स्वास्थ्य दिवस", hol_foodDay:"विश्व खाद्य दिवस",
    hol_aidsDay:"विश्व एड्स दिवस", hol_humanRights:"मानवाधिकार दिवस",
    hol_christmas:"क्रिसमस", hol_newYearsEve:"नववर्ष की पूर्वसंध्या",
    hol_ramadan:"रमज़ान आरंभ (लगभग)", hol_eidFitr:"ईद-उल-फ़ित्र (लगभग)",
    hol_eidAdha:"ईद-उल-अज़हा (लगभग)", hol_islamicNewYear:"इस्लामी नववर्ष (लगभग)",
    hol_arafah:"अराफ़ा का दिन (लगभग)",
    subscription:"सदस्यता", widgetsShortcuts:"विजेट और शॉर्टकट",
    siriShortcuts:"सिरी और शॉर्टकट", helpFeedback:"सहायता और प्रतिक्रिया",
    privacyPermissions:"गोपनीयता और अनुमतियाँ", termsConditions:"नियम और शर्तें",
    switchToLight:"लाइट मोड पर जाएँ", switchToDark:"डार्क मोड पर जाएँ",
    account:"खाता", displayName:"प्रदर्शित नाम", saveLabel:"सहेजें", email:"ईमेल",
    emailChangeNote:"ईमेल बदलने पर पुनः सत्यापन आवश्यक है। अपडेट के लिए सहायता से संपर्क करें।",
    marketingOptIn:"उत्पाद अपडेट और सुझाव",
    plan:"योजना", freePlan:"निःशुल्क योजना", renewsOn:"{date} को नवीनीकरण",
    activeSubscription:"सक्रिय सदस्यता",
    upgradeBlurb:"असीमित Nova, Vega क्रेडिट और अधिक के लिए अपग्रेड करें",
    manageSubscription:"सदस्यता प्रबंधित करें", tryProFree:"Pro को 7 दिन निःशुल्क आज़माएँ",
    signOutOf:"{email} से साइन आउट करें",
    errFillAll:"कृपया सभी फ़ील्ड भरें।", errPasswordMismatch:"पासवर्ड मेल नहीं खाते।",
    errPasswordShort:"पासवर्ड कम से कम 6 वर्णों का होना चाहिए।",
    errAgreeTerms:"जारी रखने के लिए नियम और शर्तें तथा गोपनीयता नीति स्वीकार करें।",
    msgCheckInbox:"पुष्टिकरण लिंक के लिए {email} पर अपना इनबॉक्स देखें। लिंक पर क्लिक करके यहाँ लौटें।",
    errEmailNotConfirmed:"पहले अपना ईमेल सत्यापित करें। भेजे गए सत्यापन लिंक के लिए इनबॉक्स देखें।",
    errBadCredentials:"ईमेल या पासवर्ड ग़लत है। कृपया पुनः प्रयास करें।",
    msgWelcomeBack:"वापसी पर स्वागत है, {name}!", errGeneric:"कुछ ग़लत हो गया।",
    errEmailFirst:"पहले ऊपर अपना ईमेल पता दर्ज करें।",
    msgResetSent:"पासवर्ड रीसेट लिंक {email} पर भेजा गया। नया पासवर्ड बनाने के लिए लिंक पर क्लिक करें।",
    msgResendSent:"पुष्टिकरण ईमेल पुनः {email} पर भेजा गया",
    resetTitle:"अपना पासवर्ड रीसेट करें",
    resetBlurb:"अपना ईमेल दर्ज करें, हम आपको रीसेट लिंक भेजेंगे।",
    yourEmailAddress:"आपका ईमेल पता", sending:"भेजा जा रहा है…", sendResetLink:"रीसेट लिंक भेजें",
    continueGoogle:"Google से जारी रखें", continueApple:"Apple से जारी रखें", orUseEmail:"या ईमेल का उपयोग करें",
    welcomeHeading:"स्वागत है", joinHeading:"The Docket से जुड़ें",
    signInSubtitle:"अपना डेटा सिंक करने के लिए साइन इन करें", registerSubtitle:"अपना निःशुल्क खाता बनाएँ",
    signInTab:"साइन इन", registerTab:"रजिस्टर",
    fullNameOptional:"पूरा नाम (वैकल्पिक)", emailAddress:"ईमेल पता",
    passwordMin:"पासवर्ड (कम से कम 6 वर्ण)", password:"पासवर्ड", confirmPassword:"पासवर्ड की पुष्टि करें",
    agreeTo:"मैं सहमत हूँ ", andWord:" और ", privacyPolicy:"गोपनीयता नीति",
    pleaseWait:"कृपया प्रतीक्षा करें…", signedIn:"✓ साइन इन हो गए!",
    signInArrow:"साइन इन →", createAccountArrow:"खाता बनाएँ →",
    goToSignIn:"साइन इन पर जाएँ", forgotPassword:"पासवर्ड भूल गए?",
    didntReceive:"ईमेल नहीं मिला? स्पैम फ़ोल्डर देखें या", resendIt:"पुनः भेजें",
    legalEnglishNotice:"यह दस्तावेज़ अंग्रेज़ी में प्रदान किया गया है। किसी भी अनुवाद से भिन्नता की स्थिति में अंग्रेज़ी संस्करण मान्य होगा।",
    vegaLowWarning:"Vega क्रेडिट कम हो रहे हैं — आपने इस अवधि में अपने {pct}% क्रेडिट उपयोग कर लिए हैं।",
    syncBehind:"इस डिवाइस पर सहेजा गया, लेकिन अभी तक आपके खाते में बैकअप नहीं हुआ। यह अपने आप पुनः प्रयास करेगा।",
    allCategories:"सभी श्रेणियाँ",
    deleteAccount:"खाता हटाएँ",
    deleteAccountWarn:"इससे आपका खाता, सभी कार्य, दिनचर्याएँ और बातचीत स्थायी रूप से हट जाएँगी और कोई भी सक्रिय सदस्यता रद्द हो जाएगी। इसे पूर्ववत नहीं किया जा सकता।",
    deleteAccountConfirm:"पुष्टि के लिए {email} लिखें",
    deleteAccountCta:"मेरा खाता स्थायी रूप से हटाएँ",
    deleting:"हटाया जा रहा है…", cancel2:"रद्द करें",
  },
  pt:{
    appName:"The Docket", daily:"Rotina Diária", allTasks:"Todas as Tarefas",
    week:"Semana", archive:"Concluídas e Excluídas",
    newTask:"Nova Tarefa", cancel:"Cancelar", addStep:"Adicionar",
    prayerSetting:"Horários de oração precisos",
    prayerLoading:"📍 Obtendo sua localização…",
    prayerDone:"✓ Horários de oração atualizados",
    prayerDenied:"⚠ O acesso à localização está bloqueado. Ative-o nas configurações do site no seu navegador.",
    prayerTimeout:"⚠ Não foi possível obter sua localização a tempo. Tente de novo ou verifique sua conexão.",
    prayerUnavailable:"⚠ Seu dispositivo não conseguiu determinar sua localização agora.",
    prayerService:"⚠ Não foi possível acessar o serviço de horários de oração. Tente em instantes.",
    notifSetting:"Notificações",
    darkMode:"Modo escuro",
    language:"Idioma",
    nothingToday:"Nada agendado para hoje.",
    nothingHere:"Nada aqui.",
    allOpen:"Tudo Aberto", ongoing:"Em andamento", completable:"Concluível",
    category:"Categoria", show:"Mostrar", overdue:"ATRASADO",
    urgent:"urgente", high:"alta", medium:"média",
    working:"Trabalhando nisso…",
    steps:"Etapas", taskTitle:"Tarefa", notes:"Notas",
    dueDate:"Data limite", nature:"Tipo", recurring:"Recorrente",
    oneOff:"Única", daily2:"Diária", weekly:"Semanal",
    milestone:"Concluível", ongoing2:"Contínua",
    finishedDeleted:"Concluídas e Excluídas",
    calendar:"Calendário", addTask:"Adicionar Tarefa",
    chatAsk:"Pergunte ao Docket…", chatHistory:"Histórico de conversas", newChat:"Nova conversa",
    historySignIn:"Entre para salvar e ver seu histórico de conversas.",
    loading:"Carregando…", noConversations:"Ainda não há conversas.",
    deleteConversation:"Excluir conversa", close:"Fechar",
    attached:"Anexo", attachedPreview:"Prévia do anexo",
    imageAttached:"Imagem anexada", removeImage:"Remover imagem",
    attachImage:"Anexar uma imagem",
    chooseModel:"Escolha qual modelo enviará suas próximas mensagens",
    opusExhausted:"Créditos Vega esgotados neste mês — enviado com Nova.",
    editTask:"Editar Tarefa", saveChanges:"Salvar Alterações", priority:"Prioridade",
    taskTitlePlaceholder:"O que precisa ser feito?", optional:"(opcional)",
    notesPlaceholder:"Qualquer detalhe que valha a pena lembrar…",
    typeMilestoneDesc:"Tem um fim claro", typeOngoingDesc:"Sem fim definido",
    every2Days:"A cada 2 dias", every3Days:"A cada 3 dias",
    weekdays:"Dias úteis", weekends:"Fins de semana", biweekly:"A cada 2 semanas", monthly:"Mensal",
    searchOrCustom:"Busque ou digite a sua…", clickToChange:"Clique para mudar",
    searchCategories:"Buscar categorias…", typeOwnCategory:"Digite sua própria categoria…",
    selectDate:"Escolha uma data",
    // Category labels. Prefixed so they stay visibly grouped and
    // cannot collide with a UI key of the same name.
    cat_health:"Saúde e Bem-estar", cat_fitness:"Exercício e Treino", cat_nutrition:"Nutrição e Dieta", cat_mental:"Saúde Mental",
    cat_medical:"Médico", cat_faith:"Fé e Espiritualidade", cat_personal:"Desenvolvimento Pessoal", cat_reading:"Leitura e Livros",
    cat_music:"Música", cat_creative:"Criatividade e Artes", cat_language:"Aprender Idiomas", cat_study:"Estudo",
    cat_research:"Pesquisa", cat_writing:"Escrita", cat_education:"Educação", cat_career:"Carreira",
    cat_interview:"Entrevistas", cat_networking:"Networking", cat_project:"Projetos", cat_hr:"RH e Pessoas",
    cat_business:"Negócios", cat_side_hustle:"Renda Extra", cat_marketing:"Marketing", cat_sales:"Vendas",
    cat_design:"Design", cat_content:"Criação de Conteúdo", cat_customer:"Atendimento ao Cliente", cat_finance:"Finanças",
    cat_trading:"Trading e Investimento", cat_savings:"Poupança e Metas", cat_investment:"Investimentos", cat_debt:"Dívidas e Empréstimos",
    cat_tax:"Impostos e Contabilidade", cat_insurance:"Seguros", cat_subscriptions:"Assinaturas", cat_legal:"Jurídico",
    cat_legal_work:"Trabalho Jurídico", cat_compliance:"Conformidade", cat_admin:"Administração e Moradia", cat_home:"Casa e Reformas",
    cat_property:"Imóveis", cat_utilities:"Contas e Serviços", cat_vehicle:"Veículo", cat_driving:"Direção",
    cat_shopping:"Compras e Tarefas", cat_family:"Família", cat_childcare:"Cuidado Infantil", cat_pets:"Animais",
    cat_social:"Vida Social", cat_events:"Eventos", cat_technology:"Tecnologia", cat_travel:"Viagens e Férias",
    cat_volunteering:"Voluntariado", cat_charity:"Doações e Caridade", cat_community:"Comunidade", cat_environment:"Meio Ambiente",
    cat_sports:"Esportes", cat_cooking:"Culinária e Receitas", cat_other:"Outro",
    tasksThisDay:"Tarefas deste dia", noEventsThisDay:"Nenhum evento ou tarefa neste dia.",
    hasTask:"Tem tarefa", hasRoutine:"Tem rotina",
    holType_public:"Feriado", holType_religious:"Religioso",
    holType_awareness:"Conscientização", holType_cultural:"Cultural",
    holType_islamic:"Islâmico", holType_bank:"Feriado bancário",
    // Holiday names. Only the internationally observed dates are
    // translated; nation-specific ones keep their English names.
    hol_newYear:"Ano Novo", hol_holocaustMemorial:"Dia da Memória do Holocausto",
    hol_valentines:"Dia dos Namorados", hol_womensDay:"Dia Internacional da Mulher",
    hol_downSyndrome:"Dia Mundial da Síndrome de Down", hol_nowruz:"Nowruz (Ano Novo persa)",
    hol_waterDay:"Dia Mundial da Água", hol_healthDay:"Dia Mundial da Saúde",
    hol_earthDay:"Dia da Terra", hol_labourDay:"Dia Internacional dos Trabalhadores",
    hol_familiesDay:"Dia Internacional das Famílias", hol_childrensDay:"Dia Mundial da Criança",
    hol_environmentDay:"Dia Mundial do Meio Ambiente", hol_musicDay:"Dia Mundial da Música",
    hol_youthDay:"Dia Internacional da Juventude", hol_peaceDay:"Dia Internacional da Paz",
    hol_olderPersons:"Dia Internacional do Idoso", hol_teachersDay:"Dia Mundial dos Professores",
    hol_mentalHealthDay:"Dia Mundial da Saúde Mental", hol_foodDay:"Dia Mundial da Alimentação",
    hol_aidsDay:"Dia Mundial de Luta contra a AIDS", hol_humanRights:"Dia dos Direitos Humanos",
    hol_christmas:"Natal", hol_newYearsEve:"Véspera de Ano Novo",
    hol_ramadan:"Início do Ramadã (aprox.)", hol_eidFitr:"Eid al-Fitr (aprox.)",
    hol_eidAdha:"Eid al-Adha (aprox.)", hol_islamicNewYear:"Ano Novo islâmico (aprox.)",
    hol_arafah:"Dia de Arafat (aprox.)",
    subscription:"Assinatura", widgetsShortcuts:"Widgets e atalhos",
    siriShortcuts:"Siri e atalhos", helpFeedback:"Ajuda e comentários",
    privacyPermissions:"Privacidade e permissões", termsConditions:"Termos e Condições",
    switchToLight:"Mudar para o modo claro", switchToDark:"Mudar para o modo escuro",
    account:"Conta", displayName:"Nome de exibição", saveLabel:"Salvar", email:"E-mail",
    emailChangeNote:"Alterar o e-mail exige nova verificação. Fale com o suporte para atualizar.",
    marketingOptIn:"Novidades e dicas",
    plan:"Plano", freePlan:"Plano gratuito", renewsOn:"Renova em {date}",
    activeSubscription:"Assinatura ativa",
    upgradeBlurb:"Faça upgrade para Nova ilimitado, créditos Vega e mais",
    manageSubscription:"Gerenciar assinatura", tryProFree:"Teste o Pro grátis por 7 dias",
    signOutOf:"Sair de {email}",
    errFillAll:"Preencha todos os campos.", errPasswordMismatch:"As senhas não coincidem.",
    errPasswordShort:"A senha deve ter pelo menos 6 caracteres.",
    errAgreeTerms:"Aceite os Termos e Condições e a Política de Privacidade para continuar.",
    msgCheckInbox:"Verifique sua caixa de entrada em {email} para o link de confirmação. Clique nele e volte aqui para entrar.",
    errEmailNotConfirmed:"Confirme seu e-mail primeiro. Procure o link de verificação na sua caixa de entrada.",
    errBadCredentials:"E-mail ou senha incorretos. Tente novamente.",
    msgWelcomeBack:"Bem-vindo de volta, {name}!", errGeneric:"Algo deu errado.",
    errEmailFirst:"Digite seu e-mail acima primeiro.",
    msgResetSent:"Link de redefinição enviado para {email}. Clique no link para definir uma nova senha.",
    msgResendSent:"E-mail de confirmação reenviado para {email}",
    resetTitle:"Redefina sua senha",
    resetBlurb:"Digite seu e-mail e enviaremos um link para redefinir sua senha.",
    yourEmailAddress:"Seu e-mail", sending:"Enviando…", sendResetLink:"Enviar link",
    continueGoogle:"Continuar com Google", continueApple:"Continuar com Apple", orUseEmail:"ou use o e-mail",
    welcomeHeading:"Bem-vindo", joinHeading:"Entre no The Docket",
    signInSubtitle:"Entre para sincronizar seus dados", registerSubtitle:"Crie sua conta gratuita",
    signInTab:"Entrar", registerTab:"Cadastrar",
    fullNameOptional:"Nome completo (opcional)", emailAddress:"E-mail",
    passwordMin:"Senha (mín. 6 caracteres)", password:"Senha", confirmPassword:"Confirmar senha",
    agreeTo:"Concordo com os ", andWord:" e a ", privacyPolicy:"Política de Privacidade",
    pleaseWait:"Aguarde…", signedIn:"✓ Conectado!",
    signInArrow:"Entrar →", createAccountArrow:"Criar conta →",
    goToSignIn:"Ir para entrar", forgotPassword:"Esqueceu sua senha?",
    didntReceive:"Não recebeu o e-mail? Verifique o spam ou", resendIt:"reenvie",
    legalEnglishNotice:"Este documento é fornecido em inglês. A versão em inglês prevalece em caso de qualquer divergência com uma tradução.",
    vegaLowWarning:"Créditos Vega quase esgotados — você usou {pct}% dos seus créditos neste período.",
    syncBehind:"Salvo neste dispositivo, mas ainda não na sua conta. Vai tentar novamente sozinho.",
    allCategories:"Todas as categorias",
    deleteAccount:"Excluir conta",
    deleteAccountWarn:"Isto exclui permanentemente sua conta, todas as tarefas, rotinas e conversas, e cancela qualquer assinatura ativa. Não pode ser desfeito.",
    deleteAccountConfirm:"Digite {email} para confirmar",
    deleteAccountCta:"Excluir minha conta permanentemente",
    deleting:"Excluindo…", cancel2:"Cancelar",
  },
  ru:{
    appName:"The Docket", daily:"Ежедневный распорядок", allTasks:"Все задачи",
    week:"Неделя", archive:"Завершённые и удалённые",
    newTask:"Новая задача", cancel:"Отмена", addStep:"Добавить",
    prayerSetting:"Точное время молитв",
    prayerLoading:"📍 Определяем ваше местоположение…",
    prayerDone:"✓ Время молитв обновлено на сегодня",
    prayerDenied:"⚠ Доступ к геолокации заблокирован. Включите его в настройках сайта в браузере.",
    prayerTimeout:"⚠ Не удалось определить местоположение вовремя. Повторите попытку или проверьте соединение.",
    prayerUnavailable:"⚠ Устройство не смогло определить ваше местоположение.",
    prayerService:"⚠ Не удалось связаться со службой времени молитв. Попробуйте позже.",
    notifSetting:"Уведомления",
    darkMode:"Тёмная тема",
    language:"Язык",
    nothingToday:"На сегодня ничего не запланировано.",
    nothingHere:"Здесь пусто.",
    allOpen:"Все открытые", ongoing:"В процессе", completable:"Завершаемые",
    category:"Категория", show:"Показать", overdue:"ПРОСРОЧЕНО",
    urgent:"срочно", high:"высокий", medium:"средний",
    working:"Работаю…",
    steps:"Шаги", taskTitle:"Задача", notes:"Заметки",
    dueDate:"Срок", nature:"Тип", recurring:"Повторяющаяся",
    oneOff:"Разовая", daily2:"Ежедневно", weekly:"Еженедельно",
    milestone:"Завершаемая", ongoing2:"Постоянная",
    finishedDeleted:"Завершённые и удалённые",
    calendar:"Календарь", addTask:"Добавить задачу",
    chatAsk:"Спросите Docket…", chatHistory:"История чатов", newChat:"Новый чат",
    historySignIn:"Войдите, чтобы сохранять и просматривать историю чатов.",
    loading:"Загрузка…", noConversations:"Прошлых бесед пока нет.",
    deleteConversation:"Удалить беседу", close:"Закрыть",
    attached:"Вложение", attachedPreview:"Предпросмотр вложения",
    imageAttached:"Изображение прикреплено", removeImage:"Убрать изображение",
    attachImage:"Прикрепить изображение",
    chooseModel:"Выберите, какая модель отправит следующие сообщения",
    opusExhausted:"Кредиты Vega на этот месяц исчерпаны — отправлено через Nova.",
    editTask:"Изменить задачу", saveChanges:"Сохранить изменения", priority:"Приоритет",
    taskTitlePlaceholder:"Что нужно сделать?", optional:"(необязательно)",
    notesPlaceholder:"Любые детали, которые стоит запомнить…",
    typeMilestoneDesc:"Есть чёткое завершение", typeOngoingDesc:"Без чёткого конца",
    every2Days:"Каждые 2 дня", every3Days:"Каждые 3 дня",
    weekdays:"По будням", weekends:"По выходным", biweekly:"Раз в 2 недели", monthly:"Ежемесячно",
    searchOrCustom:"Найдите или введите свою…", clickToChange:"Нажмите, чтобы изменить",
    searchCategories:"Поиск категорий…", typeOwnCategory:"Введите свою категорию…",
    selectDate:"Выберите дату",
    // Category labels. Prefixed so they stay visibly grouped and
    // cannot collide with a UI key of the same name.
    cat_health:"Здоровье и форма", cat_fitness:"Фитнес и тренировки", cat_nutrition:"Питание и диета", cat_mental:"Психическое здоровье",
    cat_medical:"Медицина", cat_faith:"Вера и духовность", cat_personal:"Саморазвитие", cat_reading:"Чтение и книги",
    cat_music:"Музыка", cat_creative:"Творчество и искусство", cat_language:"Изучение языков", cat_study:"Учёба",
    cat_research:"Исследования", cat_writing:"Письмо", cat_education:"Образование", cat_career:"Карьера",
    cat_interview:"Собеседования", cat_networking:"Нетворкинг", cat_project:"Проекты", cat_hr:"HR и персонал",
    cat_business:"Бизнес", cat_side_hustle:"Подработка", cat_marketing:"Маркетинг", cat_sales:"Продажи",
    cat_design:"Дизайн", cat_content:"Создание контента", cat_customer:"Поддержка клиентов", cat_finance:"Финансы",
    cat_trading:"Трейдинг и инвестиции", cat_savings:"Сбережения и цели", cat_investment:"Инвестиции", cat_debt:"Долги и кредиты",
    cat_tax:"Налоги и учёт", cat_insurance:"Страхование", cat_subscriptions:"Подписки", cat_legal:"Юридическое",
    cat_legal_work:"Юридическая работа", cat_compliance:"Комплаенс", cat_admin:"Администрация и жильё", cat_home:"Дом и ремонт",
    cat_property:"Недвижимость", cat_utilities:"Услуги и счета", cat_vehicle:"Транспорт", cat_driving:"Вождение",
    cat_shopping:"Покупки и дела", cat_family:"Семья", cat_childcare:"Уход за детьми", cat_pets:"Питомцы",
    cat_social:"Общение", cat_events:"Мероприятия", cat_technology:"Технологии", cat_travel:"Путешествия и отпуск",
    cat_volunteering:"Волонтёрство", cat_charity:"Благотворительность", cat_community:"Сообщество", cat_environment:"Экология",
    cat_sports:"Спорт", cat_cooking:"Готовка и рецепты", cat_other:"Другое",
    tasksThisDay:"Задачи на этот день", noEventsThisDay:"В этот день нет событий или задач.",
    hasTask:"Есть задача", hasRoutine:"Есть распорядок",
    holType_public:"Государственный", holType_religious:"Религиозный",
    holType_awareness:"Информационный", holType_cultural:"Культурный",
    holType_islamic:"Исламский", holType_bank:"Банковский выходной",
    // Holiday names. Only the internationally observed dates are
    // translated; nation-specific ones keep their English names.
    hol_newYear:"Новый год", hol_holocaustMemorial:"День памяти жертв Холокоста",
    hol_valentines:"День святого Валентина", hol_womensDay:"Международный женский день",
    hol_downSyndrome:"Всемирный день человека с синдромом Дауна", hol_nowruz:"Навруз (персидский Новый год)",
    hol_waterDay:"Всемирный день водных ресурсов", hol_healthDay:"Всемирный день здоровья",
    hol_earthDay:"День Земли", hol_labourDay:"Международный день труда",
    hol_familiesDay:"Международный день семей", hol_childrensDay:"Всемирный день ребёнка",
    hol_environmentDay:"Всемирный день окружающей среды", hol_musicDay:"Всемирный день музыки",
    hol_youthDay:"Международный день молодёжи", hol_peaceDay:"Международный день мира",
    hol_olderPersons:"Международный день пожилых людей", hol_teachersDay:"Всемирный день учителя",
    hol_mentalHealthDay:"Всемирный день психического здоровья", hol_foodDay:"Всемирный день продовольствия",
    hol_aidsDay:"Всемирный день борьбы со СПИДом", hol_humanRights:"День прав человека",
    hol_christmas:"Рождество", hol_newYearsEve:"Канун Нового года",
    hol_ramadan:"Начало Рамадана (прибл.)", hol_eidFitr:"Ураза-байрам (прибл.)",
    hol_eidAdha:"Курбан-байрам (прибл.)", hol_islamicNewYear:"Исламский Новый год (прибл.)",
    hol_arafah:"День Арафа (прибл.)",
    subscription:"Подписка", widgetsShortcuts:"Виджеты и быстрые команды",
    siriShortcuts:"Siri и быстрые команды", helpFeedback:"Помощь и отзывы",
    privacyPermissions:"Конфиденциальность и разрешения", termsConditions:"Условия использования",
    switchToLight:"Переключить на светлую тему", switchToDark:"Переключить на тёмную тему",
    account:"Аккаунт", displayName:"Отображаемое имя", saveLabel:"Сохранить", email:"Эл. почта",
    emailChangeNote:"Смена почты требует повторного подтверждения. Обратитесь в поддержку.",
    marketingOptIn:"Новости о продукте и советы",
    plan:"Тариф", freePlan:"Бесплатный тариф", renewsOn:"Продление {date}",
    activeSubscription:"Активная подписка",
    upgradeBlurb:"Перейдите на платный тариф: безлимитный Nova, кредиты Vega и не только",
    manageSubscription:"Управление подпиской", tryProFree:"Попробуйте Pro бесплатно 7 дней",
    signOutOf:"Выйти из {email}",
    errFillAll:"Пожалуйста, заполните все поля.", errPasswordMismatch:"Пароли не совпадают.",
    errPasswordShort:"Пароль должен содержать не менее 6 символов.",
    errAgreeTerms:"Чтобы продолжить, примите Условия использования и Политику конфиденциальности.",
    msgCheckInbox:"Проверьте почту {email} — там ссылка для подтверждения. Перейдите по ней и вернитесь сюда для входа.",
    errEmailNotConfirmed:"Сначала подтвердите адрес почты. Проверьте входящие — мы отправили ссылку.",
    errBadCredentials:"Неверная почта или пароль. Попробуйте ещё раз.",
    msgWelcomeBack:"С возвращением, {name}!", errGeneric:"Что-то пошло не так.",
    errEmailFirst:"Сначала введите адрес почты выше.",
    msgResetSent:"Ссылка для сброса пароля отправлена на {email}. Перейдите по ней, чтобы задать новый пароль.",
    msgResendSent:"Письмо с подтверждением повторно отправлено на {email}",
    resetTitle:"Сброс пароля",
    resetBlurb:"Введите адрес почты, и мы отправим ссылку для сброса пароля.",
    yourEmailAddress:"Ваш адрес эл. почты", sending:"Отправка…", sendResetLink:"Отправить ссылку",
    continueGoogle:"Продолжить с Google", continueApple:"Продолжить с Apple", orUseEmail:"или через почту",
    welcomeHeading:"Добро пожаловать", joinHeading:"Присоединяйтесь к The Docket",
    signInSubtitle:"Войдите, чтобы синхронизировать данные", registerSubtitle:"Создайте бесплатный аккаунт",
    signInTab:"Вход", registerTab:"Регистрация",
    fullNameOptional:"Полное имя (необязательно)", emailAddress:"Адрес эл. почты",
    passwordMin:"Пароль (минимум 6 символов)", password:"Пароль", confirmPassword:"Подтвердите пароль",
    agreeTo:"Я принимаю ", andWord:" и ", privacyPolicy:"Политику конфиденциальности",
    pleaseWait:"Подождите…", signedIn:"✓ Вход выполнен!",
    signInArrow:"Войти →", createAccountArrow:"Создать аккаунт →",
    goToSignIn:"Перейти ко входу", forgotPassword:"Забыли пароль?",
    didntReceive:"Письмо не пришло? Проверьте папку со спамом или", resendIt:"отправьте снова",
    legalEnglishNotice:"Этот документ предоставляется на английском языке. В случае любых расхождений с переводом преимущественную силу имеет английская версия.",
    vegaLowWarning:"Кредиты Vega на исходе — вы использовали {pct}% кредитов за период.",
    syncBehind:"Сохранено на этом устройстве, но ещё не выгружено в аккаунт. Повтор произойдёт автоматически.",
    allCategories:"Все категории",
    deleteAccount:"Удалить аккаунт",
    deleteAccountWarn:"Это безвозвратно удалит аккаунт, все задачи, распорядки и беседы, а также отменит активную подписку. Отменить это нельзя.",
    deleteAccountConfirm:"Введите {email} для подтверждения",
    deleteAccountCta:"Удалить мой аккаунт навсегда",
    deleting:"Удаление…", cancel2:"Отмена",
  },
  zh:{
    appName:"The Docket", daily:"每日例程", allTasks:"全部任务",
    week:"本周", archive:"已完成与已删除",
    newTask:"新建任务", cancel:"取消", addStep:"添加",
    prayerSetting:"精确礼拜时间",
    prayerLoading:"📍 正在获取你的位置…",
    prayerDone:"✓ 今日礼拜时间已更新",
    prayerDenied:"⚠ 位置访问已被阻止。请在浏览器的网站设置中开启。",
    prayerTimeout:"⚠ 未能及时获取你的位置。请重试或检查网络连接。",
    prayerUnavailable:"⚠ 你的设备目前无法确定位置。",
    prayerService:"⚠ 无法连接礼拜时间服务。请稍后再试。",
    notifSetting:"通知",
    darkMode:"深色模式",
    language:"语言",
    nothingToday:"今天没有安排。",
    nothingHere:"这里空空如也。",
    allOpen:"全部进行中", ongoing:"持续", completable:"可完成",
    category:"分类", show:"显示", overdue:"已逾期",
    urgent:"紧急", high:"高", medium:"中",
    working:"处理中…",
    steps:"步骤", taskTitle:"任务", notes:"备注",
    dueDate:"截止日期", nature:"类型", recurring:"重复",
    oneOff:"一次性", daily2:"每日", weekly:"每周",
    milestone:"可完成", ongoing2:"持续进行",
    finishedDeleted:"已完成与已删除",
    calendar:"日历", addTask:"添加任务",
    chatAsk:"向 Docket 提问…", chatHistory:"聊天记录", newChat:"新建对话",
    historySignIn:"登录后即可保存和查看聊天记录。",
    loading:"加载中…", noConversations:"暂无历史对话。",
    deleteConversation:"删除对话", close:"关闭",
    attached:"附件", attachedPreview:"附件预览",
    imageAttached:"已附加图片", removeImage:"移除图片",
    attachImage:"附加图片",
    chooseModel:"选择由哪个模型发送你接下来的消息",
    opusExhausted:"本月 Vega 额度已用完 — 已改用 Nova 发送。",
    editTask:"编辑任务", saveChanges:"保存更改", priority:"优先级",
    taskTitlePlaceholder:"需要做什么？", optional:"（可选）",
    notesPlaceholder:"任何值得记住的细节…",
    typeMilestoneDesc:"有明确的结束", typeOngoingDesc:"没有固定结束",
    every2Days:"每 2 天", every3Days:"每 3 天",
    weekdays:"工作日", weekends:"周末", biweekly:"每 2 周", monthly:"每月",
    searchOrCustom:"搜索或自行输入…", clickToChange:"点击更改",
    searchCategories:"搜索分类…", typeOwnCategory:"输入你自己的分类…",
    selectDate:"选择日期",
    // Category labels. Prefixed so they stay visibly grouped and
    // cannot collide with a UI key of the same name.
    cat_health:"健康与体能", cat_fitness:"健身与运动", cat_nutrition:"营养与饮食", cat_mental:"心理健康",
    cat_medical:"医疗", cat_faith:"信仰与灵修", cat_personal:"个人成长", cat_reading:"阅读与书籍",
    cat_music:"音乐", cat_creative:"创意与艺术", cat_language:"语言学习", cat_study:"学习",
    cat_research:"研究", cat_writing:"写作", cat_education:"教育", cat_career:"职业",
    cat_interview:"面试", cat_networking:"人脉", cat_project:"项目", cat_hr:"人力资源",
    cat_business:"商业", cat_side_hustle:"副业", cat_marketing:"市场营销", cat_sales:"销售",
    cat_design:"设计", cat_content:"内容创作", cat_customer:"客户服务", cat_finance:"财务",
    cat_trading:"交易与投资", cat_savings:"储蓄与目标", cat_investment:"投资", cat_debt:"债务与贷款",
    cat_tax:"税务与会计", cat_insurance:"保险", cat_subscriptions:"订阅", cat_legal:"法律",
    cat_legal_work:"法务工作", cat_compliance:"合规", cat_admin:"行政与住房", cat_home:"家居与装修",
    cat_property:"房产", cat_utilities:"水电与账单", cat_vehicle:"车辆", cat_driving:"驾驶",
    cat_shopping:"购物与杂事", cat_family:"家庭", cat_childcare:"育儿", cat_pets:"宠物",
    cat_social:"社交生活", cat_events:"活动", cat_technology:"科技", cat_travel:"旅行与假期",
    cat_volunteering:"志愿服务", cat_charity:"慈善捐赠", cat_community:"社区", cat_environment:"环境",
    cat_sports:"运动", cat_cooking:"烹饪与食谱", cat_other:"其他",
    tasksThisDay:"当天任务", noEventsThisDay:"这一天没有活动或任务。",
    hasTask:"有任务", hasRoutine:"有例程",
    holType_public:"公共假日", holType_religious:"宗教",
    holType_awareness:"公益日", holType_cultural:"文化",
    holType_islamic:"伊斯兰", holType_bank:"银行假日",
    // Holiday names. Only the internationally observed dates are
    // translated; nation-specific ones keep their English names.
    hol_newYear:"元旦", hol_holocaustMemorial:"国际大屠杀纪念日",
    hol_valentines:"情人节", hol_womensDay:"国际妇女节",
    hol_downSyndrome:"世界唐氏综合征日", hol_nowruz:"诺鲁孜节（波斯新年）",
    hol_waterDay:"世界水日", hol_healthDay:"世界卫生日",
    hol_earthDay:"世界地球日", hol_labourDay:"国际劳动节",
    hol_familiesDay:"国际家庭日", hol_childrensDay:"世界儿童日",
    hol_environmentDay:"世界环境日", hol_musicDay:"世界音乐日",
    hol_youthDay:"国际青年日", hol_peaceDay:"国际和平日",
    hol_olderPersons:"国际老年人日", hol_teachersDay:"世界教师日",
    hol_mentalHealthDay:"世界精神卫生日", hol_foodDay:"世界粮食日",
    hol_aidsDay:"世界艾滋病日", hol_humanRights:"人权日",
    hol_christmas:"圣诞节", hol_newYearsEve:"除夕",
    hol_ramadan:"斋月开始（约）", hol_eidFitr:"开斋节（约）",
    hol_eidAdha:"宰牲节（约）", hol_islamicNewYear:"伊斯兰新年（约）",
    hol_arafah:"阿拉法特日（约）",
    subscription:"订阅", widgetsShortcuts:"小组件与快捷指令",
    siriShortcuts:"Siri 与快捷指令", helpFeedback:"帮助与反馈",
    privacyPermissions:"隐私与权限", termsConditions:"条款与条件",
    switchToLight:"切换到浅色模式", switchToDark:"切换到深色模式",
    account:"账户", displayName:"显示名称", saveLabel:"保存", email:"电子邮件",
    emailChangeNote:"更改电子邮件需要重新验证。如需更新请联系支持。",
    marketingOptIn:"产品更新与使用技巧",
    plan:"方案", freePlan:"免费方案", renewsOn:"{date} 续订",
    activeSubscription:"订阅生效中",
    upgradeBlurb:"升级以获得无限 Nova、Vega 额度及更多功能",
    manageSubscription:"管理订阅", tryProFree:"免费试用 Pro 7 天",
    signOutOf:"退出 {email}",
    errFillAll:"请填写所有字段。", errPasswordMismatch:"两次输入的密码不一致。",
    errPasswordShort:"密码至少需要 6 个字符。",
    errAgreeTerms:"请先同意条款与条件以及隐私政策再继续。",
    msgCheckInbox:"请在 {email} 的收件箱中查收确认链接。点击链接后返回此处登录。",
    errEmailNotConfirmed:"请先确认你的电子邮件。查看收件箱中我们发送的验证链接。",
    errBadCredentials:"邮箱或密码不正确，请重试。",
    msgWelcomeBack:"欢迎回来，{name}！", errGeneric:"出了点问题。",
    errEmailFirst:"请先在上方输入你的邮箱地址。",
    msgResetSent:"密码重置链接已发送至 {email}。点击邮件中的链接设置新密码。",
    msgResendSent:"确认邮件已重新发送至 {email}",
    resetTitle:"重置密码",
    resetBlurb:"输入你的邮箱，我们会发送重置密码的链接。",
    yourEmailAddress:"你的邮箱地址", sending:"发送中…", sendResetLink:"发送重置链接",
    continueGoogle:"使用 Google 继续", continueApple:"使用 Apple 继续", orUseEmail:"或使用邮箱",
    welcomeHeading:"欢迎", joinHeading:"加入 The Docket",
    signInSubtitle:"登录以同步你的数据", registerSubtitle:"创建你的免费账户",
    signInTab:"登录", registerTab:"注册",
    fullNameOptional:"全名（可选）", emailAddress:"邮箱地址",
    passwordMin:"密码（至少 6 个字符）", password:"密码", confirmPassword:"确认密码",
    agreeTo:"我同意", andWord:"和", privacyPolicy:"隐私政策",
    pleaseWait:"请稍候…", signedIn:"✓ 已登录！",
    signInArrow:"登录 →", createAccountArrow:"创建账户 →",
    goToSignIn:"前往登录", forgotPassword:"忘记密码？",
    didntReceive:"没收到邮件？请检查垃圾邮件文件夹，或", resendIt:"重新发送",
    legalEnglishNotice:"本文件以英文提供。如译文与英文版本有任何出入，概以英文版本为准。",
    vegaLowWarning:"Vega 额度即将用完 — 本期你已使用 {pct}% 的额度。",
    syncBehind:"已保存在此设备，但尚未备份到你的账户。稍后会自动重试。",
    allCategories:"全部分类",
    deleteAccount:"删除账户",
    deleteAccountWarn:"这将永久删除你的账户、全部任务、例程与对话，并取消任何有效订阅。此操作无法撤销。",
    deleteAccountConfirm:"输入 {email} 以确认",
    deleteAccountCta:"永久删除我的账户",
    deleting:"删除中…", cancel2:"取消",
  },
};

// Endonyms — what speakers call their own language. This is what the selector
// shows, so someone who has landed in a language they can't read still
// recognises their own.
const LANG_LABELS:Record<Lang,string> = {
  en:"English", ar:"العربية", fr:"Français", tr:"Türkçe", ur:"اردو",
  bn:"বাংলা", es:"Español", hi:"हिन्दी", pt:"Português", ru:"Русский", zh:"中文"
};
// English names, shown next to the endonym wherever the two differ. Without
// them the alphabetical ordering below looks arbitrary — there is no way to
// see that বাংলা sits between العربية and English on purpose.
const LANG_NAMES_EN:Record<Lang,string> = {
  en:"English", ar:"Arabic", fr:"French", tr:"Turkish", ur:"Urdu",
  bn:"Bengali", es:"Spanish", hi:"Hindi", pt:"Portuguese", ru:"Russian", zh:"Mandarin Chinese"
};
// Alphabetical by English name. Object key order would otherwise decide the
// menu, which puts the order at the mercy of where the next language happens
// to get pasted into T.
const LANG_ORDER:Lang[] = ["ar","bn","en","fr","hi","zh","pt","ru","es","tr","ur"];
// Of the eleven, only these two are right-to-left.
const RTL_LANGS:Lang[] = ["ar","ur"];
// Inter covers Latin and Cyrillic but has no Arabic, Devanagari, Bengali or
// CJK glyphs. Per-glyph fallback would handle it, but naming a stack keeps the
// selector's metrics stable instead of varying with whatever the browser picks.
function langFont(code:Lang):string{
  if(code==="ar"||code==="ur") return "'Segoe UI','Noto Naskh Arabic',sans-serif";
  if(code==="hi"||code==="bn") return "'Nirmala UI','Noto Sans',sans-serif";
  if(code==="zh") return "'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif";
  return "inherit";
}

// BCP-47 tag per UI language, so every date the app prints gets its month and
// weekday names from the platform instead of a hardcoded English list. Region
// subtags pick the largest speaker population where the language spans several
// (bn-BD over bn-IN, pt-BR over pt-PT, zh-CN to match the Simplified strings).
//
// Arabic is deliberately plain "ar" and not "ar-SA": CLDR gives ar-SA the
// islamic-umalqura calendar, so Intl would render Gregorian dates as Hijri
// ones. Plain "ar" stays Gregorian with Arabic month names, which is what the
// rest of the app's date logic assumes.
const LANG_LOCALES:Record<Lang,string> = {
  en:"en-GB", ar:"ar", fr:"fr-FR", tr:"tr-TR", ur:"ur-PK",
  bn:"bn-BD", es:"es-ES", hi:"hi-IN", pt:"pt-BR", ru:"ru-RU", zh:"zh-CN"
};
function localeFor(code:Lang):string{ return LANG_LOCALES[code]??"en-GB"; }

// Month names and Monday-first weekday abbreviations, built from Intl rather
// than a hardcoded English list. Memoised per locale: constructing a
// DateTimeFormat is the expensive part and both calendar grids rebuild these
// on every render.
const monthNameCache=new Map<string,string[]>();
function monthNames(locale:string):string[]{
  const hit=monthNameCache.get(locale);
  if(hit) return hit;
  const f=new Intl.DateTimeFormat(locale,{month:"long"});
  // Noon UTC on the 15th — far enough from either boundary that no timezone
  // offset can roll the date into a neighbouring month.
  const v=Array.from({length:12},(_,m)=>f.format(new Date(Date.UTC(2021,m,15,12))));
  monthNameCache.set(locale,v);
  return v;
}
// Which day a calendar grid's first column holds, as a JS getDay() index
// (0=Sun). A CSS grid under direction:rtl fills its columns right-to-left, so
// the first column is the rightmost one — and a Monday-first week therefore
// put Monday on the right and Sunday stranded on the far left, which is not
// how an Arabic or Urdu reader scans a week. RTL starts on Sunday so the week
// reads Sunday→Saturday leading from the right edge.
function weekStartDay(dir:"ltr"|"rtl"):number{ return dir==="rtl"?0:1; }

// Weekday abbreviations in column order for a given start day. Paired with
// leadingBlanks below: both take the same start day, because a header row and
// a date grid that disagree about where the week begins is exactly the bug
// this replaced — the labels sat one column off from the dates under them.
const dowNameCache=new Map<string,string[]>();
function dowNames(locale:string,startDay:number):string[]{
  const key=`${locale}|${startDay}`;
  const hit=dowNameCache.get(key);
  if(hit) return hit;
  const f=new Intl.DateTimeFormat(locale,{weekday:"short"});
  // 3 January 2021 was a Sunday, so offsetting from it by startDay lands on
  // the requested first day and the seven following days run in order. Noon
  // UTC, or a negative timezone offset shifts the whole week back by a day.
  const v=Array.from({length:7},(_,i)=>f.format(new Date(Date.UTC(2021,0,3+startDay+i,12))));
  dowNameCache.set(key,v);
  return v;
}

// How many empty cells precede the 1st of the month, for a week beginning on
// startDay. The old form hardcoded the Monday case as (getDay()+6)%7.
function leadingBlanks(firstOfMonth:Date,startDay:number):number{
  return (firstOfMonth.getDay()-startDay+7)%7;
}

// Dates go through toLocaleDateString, which renders digits in whatever
// numbering system the locale resolves to — beng for bn-BD, latn for the
// other ten. Everything else on screen (day numbers, clock, times, counts)
// was a raw JS number React printed as ASCII, so a Bengali user saw "১৭
// সেপ" under the day strip and "17" in the chip directly above it: one date,
// two numeral systems.
//
// These map ASCII digits onto the locale's own, leaving what each locale
// resolves to entirely alone — Arabic stays latn, as decided. Working on
// strings rather than numbers keeps zero-padding ("07:30") and separators
// intact, which Intl.NumberFormat would drop.
const localeDigitCache=new Map<string,string[]|null>();
function localeDigits(locale:string):string[]|null{
  if(localeDigitCache.has(locale)) return localeDigitCache.get(locale)!;
  const f=new Intl.NumberFormat(locale,{useGrouping:false});
  const d=Array.from({length:10},(_,i)=>f.format(i));
  // null for a locale that already uses ASCII, so the ten that do skip the
  // replace entirely rather than paying for a no-op scan of every string.
  const v=d.every((x,i)=>x===String(i))?null:d;
  localeDigitCache.set(locale,v);
  return v;
}
function localeNum(value:string|number,locale:string):string{
  const s=String(value);
  const d=localeDigits(locale);
  if(!d) return s;
  return s.replace(/[0-9]/g,ch=>d[Number(ch)]);
}

// A horizontal scroller under direction:rtl starts at scrollLeft 0 on its
// RIGHT edge and runs NEGATIVE to -(scrollWidth-clientWidth) — the CSSOM-View
// behaviour every current engine implements. Code written against the LTR
// range 0..max therefore reads a negative number and clamps it to zero, which
// is what pinned the day strip's thumb outside its track and froze its date
// label on weekDates[0].
//
// These convert to and from a direction-agnostic "distance from the start
// edge", always 0..max, so the thumb maths, the drag clamp and the index
// lookup can each stay written the one way they already were.
function scrollStart(el:HTMLElement,rtl:boolean):number{
  return rtl?-el.scrollLeft:el.scrollLeft;
}
function setScrollStart(el:HTMLElement,rtl:boolean,v:number){
  el.scrollLeft=rtl?-v:v;
}

// ── Theme colours (light + dark) ──────────────────────────────────────────────
// Body scroll lock, shared by the chat panel's own effect and the app-level
// avatar-card/modal one so the two can't drift apart.
//
// Pinning the body with position:fixed is what actually blocks touch-scroll
// bleed-through on mobile — overflow:hidden alone doesn't — but it also stops
// the document scrolling, which takes the desktop scrollbar with it. The page
// then reflows into the ~17px the scrollbar had reserved, a visible sideways
// jump every time an overlay opens. Holding that width as padding keeps the
// content still. Measured BEFORE the pin, since pinning is what changes it.
function lockBodyScroll(scrollY:number){
  const scrollbarWidth=window.innerWidth-document.documentElement.clientWidth;
  document.body.style.position="fixed";
  document.body.style.top=`-${scrollY}px`;
  document.body.style.width="100%";
  if(scrollbarWidth>0) document.body.style.paddingRight=`${scrollbarWidth}px`;
}
function unlockBodyScroll(){
  document.body.style.position="";
  document.body.style.top="";
  document.body.style.width="";
  document.body.style.paddingRight="";
}

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

// Interpolating counterpart to t(). Values go in through {name} placeholders
// so each translation decides where they belong in its own grammar, instead of
// being concatenated onto a translated fragment — that concatenation is what
// put the Latin word "Renews" in front of an Arabic date and let the bidi
// algorithm reorder the whole line.
//
// An unknown placeholder is left in place rather than blanked, so a typo shows
// up as "{emial}" on screen instead of silently vanishing.
function tf(k:string,vars:Record<string,string|number>,t:(k:string)=>string):string{
  return t(k).replace(/\{(\w+)\}/g,(m,name)=>name in vars?String(vars[name]):m);
}

// The display name for a category. CATS keeps its English label as the source
// of truth — the AI prompt and the category search both read it — while the
// translated text lives in T under a cat_ prefix.
//
// A value that isn't in CATS is one the user typed themselves through the
// picker's "type your own category" box. That is their own words in their own
// language, so it is returned untouched rather than run through a lookup that
// would never match.
function catLabel(key:string,t:(k:string)=>string):string{
  const c=CATS[key];
  if(!c) return key;
  const tr=t("cat_"+key);
  // t() returns the key itself when nothing is defined; fall back to English
  // rather than printing "cat_health" at someone.
  return tr==="cat_"+key?c.label:tr;
}

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
function fmtDate(d:string,locale:string="en-GB"){
  if(!d)return "";
  return new Date(d+"T00:00:00").toLocaleDateString(locale,{weekday:"short",day:"numeric",month:"short"});
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

// The one place client-side ids are minted. Ids only need to be unique within
// a single account — the primary key is (user_id, id) — so the largest
// existing value plus one is sufficient, and unlike Date.now() it is correct
// when several are created in the same millisecond.
//
// That mattered: handleAiActions calls addTask and addStep inside a forEach,
// so an AI reply creating three tasks gave all three the same Date.now(), and
// the upsert collapsed them into one row. Three steps on one task got the same
// id too, which made removing one remove all three.
//
// Must be called INSIDE the functional updater, against the array being built,
// or consecutive calls in one tick all read the same pre-update state and the
// collision comes straight back. reduce rather than Math.max(...spread), which
// overflows the stack on a large enough array.
function nextId(existing:{id:number}[]):number{
  return existing.reduce((m,x)=>x.id>m?x.id:m,0)+1;
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
  const{t}=useApp();
  const s=CAT_STYLES[category]??CAT_STYLE_DEFAULT;
  const cat=CATS[category];
  const label=catLabel(category,t);
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

// ── Searchable Category Picker ────────────────────────────────────────────────
function CategoryPicker({value,onChange}:{value:string;onChange:(v:any)=>void}){
  const{dark,t}=useApp();
  const C=getC(dark);
  const[search,setSearch]=useState("");
  const[open,setOpen]=useState(false);
  const[customMode,setCustomMode]=useState(false);
  const[customVal,setCustomVal]=useState("");
  // Matched against the translated name, the English one and the raw key, so
  // someone typing in their own language finds the category and someone who
  // knows it by its English name still does too.
  const filtered=Object.entries(CATS).filter(([k,v])=>{
    const q=search.toLowerCase();
    return catLabel(k,t).toLowerCase().includes(q)||
      v.label.toLowerCase().includes(q)||
      k.toLowerCase().includes(q);
  });
  const selected=CATS[value];
  const s=CAT_STYLES[value]??CAT_STYLE_DEFAULT;
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
          {selected?catLabel(value,t):value||t("category")}
        </span>
        <span style={{color:C.muted2,fontSize:12,flex:1}}>{open?t("searchOrCustom"):t("clickToChange")}</span>
        <span style={{color:C.muted2,fontSize:11}}>{open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,
          background:dark?"#16192A":"#FFFFFF",border:`1.5px solid ${C.primary}`,borderRadius:9,
          boxShadow:"0 8px 30px rgba(35,42,77,0.2)",zIndex:999,overflow:"hidden"}}>
          <div style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:6}}>
            <input autoFocus value={search}
              onChange={e=>{setSearch(e.target.value);setCustomMode(false);}}
              placeholder={t("searchCategories")}
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
                placeholder={t("typeOwnCategory")}
                onKeyDown={e=>{if(e.key==="Enter"&&customVal.trim()){onChange(customVal.trim());setOpen(false);setCustomVal("");setCustomMode(false);}}}
                style={{flex:1,border:`1.5px solid ${C.primary}`,borderRadius:7,padding:"7px 9px",
                  outline:"none",fontSize:13,background:C.surface,color:C.navy,fontFamily:"inherit"}}/>
              <button onClick={()=>{if(customVal.trim()){onChange(customVal.trim());setOpen(false);setCustomVal("");setCustomMode(false);}}}
                style={{background:C.primary,color:"white",border:"none",borderRadius:7,
                  padding:"0 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{t("addStep")}</button>
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
                    borderRadius:6,fontSize:12,fontWeight:600}}>{catLabel(k,t)}</span>
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
function DatePicker({value,onChange,dark}:{value:string;onChange:(v:string)=>void;dark:boolean}){
  const{lang,dir,t}=useApp();
  const locale=localeFor(lang);
  const C=getC(dark);
  const[open,setOpen]=useState(false);
  const parsed=value?new Date(value+"T12:00:00"):null;
  const now=new Date();
  const[viewMonth,setViewMonth]=useState(parsed?parsed.getMonth():now.getMonth());
  const[viewYear,setViewYear]=useState(parsed?parsed.getFullYear():now.getFullYear());

  const firstDay=new Date(viewYear,viewMonth,1);
  const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
  const weekStart=weekStartDay(dir);
  const startDow=leadingBlanks(firstDay,weekStart);
  const monthISO=`${viewYear}-${String(viewMonth+1).padStart(2,"0")}`;

  function selectDay(day:number){
    onChange(`${monthISO}-${String(day).padStart(2,"0")}`);
    setOpen(false);
  }

  const displayLabel=parsed
    ?parsed.toLocaleDateString(locale,{weekday:"short",day:"numeric",month:"short",year:"numeric"})
    :t("selectDate");

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
              {monthNames(locale)[viewMonth]} {viewYear}
            </span>
            <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1);}}
              style={{width:28,height:28,borderRadius:8,border:`1px solid ${C.border}`,
                background:C.surface2,cursor:"pointer",fontSize:14,color:C.navy}}>›</button>
          </div>
          {/* Day-of-week headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",marginBottom:4}}>
            {/* Keyed by index, not by name — some locales abbreviate two
                weekdays identically, which would collide as React keys. */}
            {dowNames(locale,weekStart).map((d,i)=>(
              <div key={i} style={{textAlign:"center",fontSize:10,fontWeight:700,
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
  const{dark,t}=useApp();
  const C=getC(dark);
  const[title,setTitle]=useState(initial?.title??"");
  const[category,setCategory]=useState<Category>(initial?.category??"study");
  const[priority,setPriority]=useState<Priority>(initial?.priority??"medium");
  const[type,setType]=useState<TaskType>(initial?.type??"milestone");
  const[date,setDate]=useState(initial?.date??"");
  const[recurring,setRecurring]=useState(initial?.recurring??"");
  const[notes,setNotes]=useState(initial?.notes??"");

  const priorityOpts=[
    {v:"urgent",label:t("urgent"),icon:"ti-flame",color:"#D94F3D",bg:"rgba(217,79,61,0.1)"},
    {v:"high",label:t("high"),icon:"ti-arrow-up",color:"#C9A84C",bg:"rgba(201,168,76,0.1)"},
    {v:"medium",label:t("medium"),icon:"ti-minus",color:"#4C5FD5",bg:"rgba(76,95,213,0.1)"},
  ];
  const typeOpts=[
    {v:"milestone",label:t("milestone"),icon:"ti-circle-check",desc:t("typeMilestoneDesc")},
    {v:"ongoing",label:t("ongoing2"),icon:"ti-repeat",desc:t("typeOngoingDesc")},
  ];
  const recurringOpts=[
    {v:"",label:t("oneOff")},
    {v:"daily",label:t("daily2")},
    {v:"every_2_days",label:t("every2Days")},
    {v:"every_3_days",label:t("every3Days")},
    {v:"weekdays",label:t("weekdays")},
    {v:"weekends",label:t("weekends")},
    {v:"weekly",label:t("weekly")},
    {v:"biweekly",label:t("biweekly")},
    {v:"monthly",label:t("monthly")},
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
              {initial?.id?t("editTask"):t("newTask")}
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
              textTransform:"uppercase",marginBottom:8}}>{t("taskTitle")}</p>
            <input value={title} onChange={e=>setTitle(e.target.value)}
              placeholder={t("taskTitlePlaceholder")}
              autoFocus
              style={inp}
              onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
              onBlur={e=>(e.target.style.borderColor=C.border)}
              onKeyDown={e=>e.key==="Enter"&&title.trim()&&(onSave({title,category,priority,type,date,time:"",recurring,notes}),onClose())}/>
          </div>

          {/* Category */}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted2,letterSpacing:"1px",
              textTransform:"uppercase",marginBottom:8}}>{t("category")}</p>
            <CategoryPicker value={category} onChange={setCategory}/>
          </div>

          {/* Priority */}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted2,letterSpacing:"1px",
              textTransform:"uppercase",marginBottom:8}}>{t("priority")}</p>
            <div style={{display:"flex",gap:8}}>
              {priorityOpts.map(p=>(
                <button key={p.v} onClick={()=>setPriority(p.v as Priority)}
                  style={{flex:1,padding:"10px 8px",borderRadius:12,cursor:"pointer",
                    border:`2px solid ${priority===p.v?p.color:C.border}`,
                    background:priority===p.v?p.bg:"transparent",
                    display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                    transition:"all 0.15s"}}>
                  <i className={`ti ${p.icon}`} style={{fontSize:18,color:priority===p.v?p.color:C.muted}} aria-hidden="true"/>
                  {/* The priority keys are stored lowercase (they double as
                      inline words elsewhere); capitalize is a no-op in scripts
                      without letter case, so it is safe across all eleven. */}
                  <span style={{fontSize:11,fontWeight:700,textTransform:"capitalize",
                    color:priority===p.v?p.color:C.muted}}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nature/Type */}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted2,letterSpacing:"1px",
              textTransform:"uppercase",marginBottom:8}}>{t("nature")}</p>
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
              textTransform:"uppercase",marginBottom:8}}>{t("recurring")}</p>
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
              textTransform:"uppercase",marginBottom:8}}>{t("dueDate")}</p>
            <DatePicker value={date} onChange={setDate} dark={dark}/>
          </div>

          {/* Notes */}
          <div style={{marginBottom:4}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted2,letterSpacing:"1px",
              textTransform:"uppercase",marginBottom:8}}>{t("notes")} <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>{t("optional")}</span></p>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
              placeholder={t("notesPlaceholder")}
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
            {t("cancel")}
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
            {initial?.id?t("saveChanges"):t("addTask")}
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
  const{dark,lang,t}=useApp();
  const locale=localeFor(lang);
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
            borderRadius:7,background:"#E4E9F9",color:C.primary}}>◆ {t("ongoing")}</span>}
          {task.date&&<span style={{fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:7,
            background:overdue?C.urgentSoft:C.surface2,
            color:overdue?C.urgent:C.muted}}>
            {overdue?`${t("overdue")} · `:""}{fmtDate(task.date,locale)}{task.time?` · ${localeNum(task.time,locale)}`:""}
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
              {localeNum(clDone,locale)}/{localeNum(cl.length,locale)}</span>}
            {expanded?"▲":"▼"} {t("steps")}
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
                {t("addStep")}
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
  const{t}=useApp();
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
    if(!email||!password){setAuthMsg(t("errFillAll"));setAuthStatus("error");return;}
    if(authTab==="register"&&password!==confirmPassword){
      setAuthMsg(t("errPasswordMismatch"));setAuthStatus("error");return;
    }
    if(authTab==="register"&&password.length<6){
      setAuthMsg(t("errPasswordShort"));setAuthStatus("error");return;
    }
    if(authTab==="register"&&!registerAgreed){
      setAuthMsg(t("errAgreeTerms"));setAuthStatus("error");return;
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
        setAuthMsg("✓ "+tf("msgCheckInbox",{email},t));
      } else {
        const{data,error}=await sb.auth.signInWithPassword({email,password});
        if(error){
          if(error.message.toLowerCase().includes("email not confirmed")||error.message.toLowerCase().includes("not confirmed")){
            setAuthMsg(t("errEmailNotConfirmed"));
            setAuthStatus("confirm");
          } else if(error.message.toLowerCase().includes("invalid")){
            setAuthMsg(t("errBadCredentials"));
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
          setAuthMsg(tf("msgWelcomeBack",{name:displayName},t));
          setTimeout(()=>onSuccess?.(),1500);
        }
      }
    }catch(e:any){setAuthMsg(e.message||t("errGeneric"));setAuthStatus("error");}
  }

  async function handleOAuth(provider:"google"|"apple"){
    const sb=await getSupabaseClient();
    if(!sb){setAuthMsg("Supabase not configured.");setAuthStatus("error");return;}
    try{
      await sb.auth.signInWithOAuth({provider,options:{redirectTo:SITE_URL}});
    }catch(e:any){setAuthMsg(e.message);setAuthStatus("error");}
  }

  async function handleForgotPassword(){
    if(!email){setAuthMsg(t("errEmailFirst"));setAuthStatus("error");return;}
    setAuthStatus("loading");
    const sb=await getSupabaseClient();
    if(!sb){setAuthStatus("error");return;}
    try{
      const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:SITE_URL+"?reset=true"});
      if(error){setAuthMsg(error.message);setAuthStatus("error");return;}
      setAuthStatus("confirm");
      setAuthMsg("✓ "+tf("msgResetSent",{email},t));
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
          color:C.navy,marginBottom:8}}>{t("resetTitle")}</p>
        <p style={{fontSize:13,color:C.muted,marginBottom:20,lineHeight:1.5}}>
          {t("resetBlurb")}
        </p>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
          placeholder={t("yourEmailAddress")} style={inp}
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
            {authStatus==="loading"?t("sending"):t("sendResetLink")}
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
              {authTab==="login"?t("welcomeHeading"):t("joinHeading")}
            </p>
            <p style={{fontSize:11,color:C.muted}}>
              {authTab==="login"?t("signInSubtitle"):t("registerSubtitle")}
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
          {t("continueGoogle")}
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
          {t("continueApple")}
        </button>
      </div>

      {/* Divider */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 24px 0"}}>
        <div style={{flex:1,height:1,background:C.border}}/>
        <span style={{fontSize:11,color:C.muted2,fontWeight:500}}>{t("orUseEmail")}</span>
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
            {tab==="login"?t("signInTab"):t("registerTab")}
          </button>
        ))}
      </div>

      {/* Form */}
      <div style={{padding:"16px 24px 24px"}}>
        {authTab==="register"&&(
          <input value={name} onChange={e=>setName(e.target.value)}
            placeholder={t("fullNameOptional")} style={inp}
            onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
            onBlur={e=>(e.target.style.borderColor=C.border)}/>
        )}
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
          placeholder={t("emailAddress")} style={inp}
          onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
          onBlur={e=>(e.target.style.borderColor=C.border)}/>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
          placeholder={authTab==="register"?t("passwordMin"):t("password")}
          style={inp}
          onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
          onBlur={e=>(e.target.style.borderColor=C.border)}
          onKeyDown={e=>e.key==="Enter"&&authTab==="login"&&handleAuth()}/>
        {authTab==="register"&&(
          <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
            placeholder={t("confirmPassword")} style={{...inp,marginBottom:16}}
            onFocus={e=>(e.target.style.borderColor="#4C5FD5")}
            onBlur={e=>(e.target.style.borderColor=C.border)}
            onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
        )}
        {authTab==="register"&&(
          <label style={{display:"flex",alignItems:"flex-start",gap:9,marginBottom:14,cursor:"pointer"}}>
            <input type="checkbox" checked={registerAgreed} onChange={e=>setRegisterAgreed(e.target.checked)}
              style={{marginTop:2,width:15,height:15,flexShrink:0,accentColor:"#4C5FD5",cursor:"pointer"}}/>
            <span style={{fontSize:11.5,color:C.muted,lineHeight:1.5}}>
              {/* Separator lives in the translation, same as andWord below:
                  Chinese takes no space before the link, every other language
                  here does. */}
              {t("agreeTo")}
              <span onClick={e=>{e.preventDefault();onOpenLegal("terms");}}
                style={{color:C.primary,fontWeight:600,textDecoration:"underline",cursor:"pointer"}}>{t("termsConditions")}</span>
              {/* No {" "} around this: the spacing lives in the translation,
                  because not every language puts a space on both sides. Arabic
                  attaches و directly to the following word and Chinese uses no
                  word spacing at all. */}
              {t("andWord")}
              <span onClick={e=>{e.preventDefault();onOpenLegal("privacy");}}
                style={{color:C.primary,fontWeight:600,textDecoration:"underline",cursor:"pointer"}}>{t("privacyPolicy")}</span>
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
            {authStatus==="loading"?t("pleaseWait"):authStatus==="success"?t("signedIn"):authTab==="login"?t("signInArrow"):t("createAccountArrow")}
          </button>
        )}
        {authStatus==="confirm"&&authTab==="register"&&(
          <button onClick={()=>{setAuthTab("login");setAuthStatus("idle");setAuthMsg("");}} className="pill-btn"
            style={{width:"100%",padding:"14px",fontSize:14,fontWeight:700,
              background:"linear-gradient(145deg,#6677E8,#4C5FD5)",color:"white",border:"none",
              boxShadow:"0 6px 20px rgba(76,95,213,0.4)"}}>
            {t("goToSignIn")}
          </button>
        )}
        {authTab==="login"&&authStatus!=="confirm"&&(
          <p style={{textAlign:"center",fontSize:12,color:C.muted2,marginTop:12}}>
            <span style={{color:C.primary,cursor:"pointer",fontWeight:600}}
              onClick={()=>{setView("forgot");setAuthStatus("idle");setAuthMsg("");}}>
              {t("forgotPassword")}
            </span>
          </p>
        )}
        {authTab==="login"&&authStatus==="confirm"&&(
          <div style={{marginTop:12,padding:"12px",borderRadius:10,
            background:dark?"#1E2235":"#F0F4FF",textAlign:"center"}}>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>
              {t("didntReceive")}{" "}
              <span style={{color:C.primary,cursor:"pointer",fontWeight:600}}
                onClick={async()=>{
                  const sb=await getSupabaseClient();
                  if(!sb) return;
                  await sb.auth.resend({type:"signup",email});
                  setAuthMsg(tf("msgResendSent",{email},t));
                }}>{t("resendIt")}</span>.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ── Legal copy ───────────────────────────────────────────────────────────────
// Each policy is one markdown string rather than an array of {title,text}
// objects. The old shape was flat by construction — one title, one body string,
// rendered into a single <p> — so it could not express subsections, bullets or
// bold, and the section number had to be baked into the title text. Markdown
// gets all of that, and renders through the same ReactMarkdown the chat
// already uses, so no dependency is added.
//
// Both documents open with their own title and "Last updated" line, because
// the modal header no longer carries either — see the privacy/terms branches
// in InfoModal. Revising a policy means editing only the string below; the
// rendering needs no change.
const PRIVACY_POLICY_MD=`# Privacy Policy — The Docket

**Last updated:** 14 September 2026

This Privacy Policy explains how The Docket collects, uses, stores and shares your personal data when you use The Docket, and explains your rights under UK data protection law, including the UK General Data Protection Regulation ("UK GDPR") and the Data Protection Act 2018.

## 1. Who we are

The Docket is operated by **Docket Ltd**, a company registered in England and Wales, based in Liverpool, United Kingdom.

Docket Ltd is the **data controller** responsible for deciding how and why personal data is processed through The Docket.

For questions about this Privacy Policy, your personal data, or to exercise your data protection rights, contact:

**Email:** [privacy@thedocket.app](mailto:privacy@thedocket.app)

---

## 2. Personal data we collect

Depending on how you use The Docket, we may process the following categories of personal data.

### Account information

When you create an account, we process information such as your:

* name;
* email address;
* account identifier; and
* authentication information necessary to manage your account.

If you use a third-party sign-in method, we receive the account information that provider makes available to us, such as your name and email address.

### Tasks, routines and other planner content

We store the content you create within The Docket, including:

* tasks;
* due dates and times;
* recurring routines;
* categories;
* notes;
* calendar or scheduling information; and
* related preferences or settings.

This information is synced to your cloud account. It is not stored only on your device.

### AI conversations

When you use the AI assistant, we process:

* messages you send;
* responses generated by the assistant;
* conversation titles and related metadata; and
* any images you attach to a conversation.

Your conversations are stored so that you can return to and browse your previous chats.

### Uploaded images

Images attached to AI conversations are uploaded to secure cloud storage and associated with your conversation history.

When an image is used as part of an AI request, it may also be transmitted to our AI provider where necessary to generate the requested response.

Uploaded images are not made available to other users through The Docket.

### AI memories and personalisation

The Docket includes an optional memory feature that allows the AI assistant to use information from previous conversations to provide more personalised responses.

A memory may be created:

* when you explicitly ask the assistant to remember something; or
* automatically, where the AI identifies something you have said as likely to be a durable and useful fact for future conversations, such as a standing preference or ongoing goal.

Automatically-created memories are selected using AI and may occasionally be incomplete or inaccurate.

You can:

* view saved memories in your Profile;
* delete individual memories;
* clear saved memories; and
* switch off automatic memory creation.

Switching off automatic memory does not prevent you from explicitly asking the assistant to remember something.

Automatic memory is designed not to save special-category information such as information revealing your health, racial or ethnic origin, political opinions, religious or philosophical beliefs, trade-union membership, sexual orientation or sex life.

Information contained in saved memories may be supplied to the AI assistant as context in later conversations.

### Subscription and billing information

If you subscribe to a paid plan, payments are processed by Stripe.

The Docket does **not** receive or store your full payment-card details.

Depending on the transaction and integration, we may receive and retain limited payment and subscription information such as:

* Stripe customer identifier;
* subscription identifier;
* subscription tier;
* subscription status;
* billing period;
* renewal or cancellation status; and
* whether a payment succeeded or failed.

Stripe may separately collect payment-card details, billing information and other payment-related information directly from you.

### Usage information

We may process information about your use of The Docket where needed to operate the service, including:

* AI message usage;
* subscription usage limits;
* plan or model usage;
* timestamps; and
* feature-usage information necessary to enforce account or subscription limits.

We do not use advertising trackers and do not sell your personal data.

### Technical and security information

When you access The Docket, our systems and hosting infrastructure may process technical information such as:

* IP address;
* browser type;
* device type;
* operating system;
* request information;
* timestamps;
* error information; and
* security or diagnostic logs.

We use this information where necessary to operate, secure and troubleshoot the service.

### Prayer-time location information

If you enable location-based prayer times, your device may provide latitude and longitude coordinates for the purpose of calculating prayer times.

Those coordinates are used for the prayer-time request and are not stored by The Docket as part of your account profile or used to track your movements.

### Email preferences

If The Docket offers optional product-update or marketing emails, we store whether you have chosen to receive them.

Marketing or product-update emails are opt-in and you can withdraw your consent at any time.

---

## 3. Local storage and similar technologies

The Docket may use browser local storage or similar device-storage technologies for settings necessary or useful to operate the app, such as:

* theme;
* language;
* interface preferences;
* authentication or session-related information where technically necessary; and
* other device-specific preferences.

Your account content, including your tasks and routines, is stored in your cloud account and is **not dependent solely on browser local storage**.

We do not use local storage or similar technologies for third-party behavioural advertising.

Where a storage technology is strictly necessary to provide a feature you request, it may be used without advertising or tracking purposes.

---

## 4. Why we use your personal data and our lawful bases

Under UK data protection law, we must have a lawful basis for processing personal data.

### Providing The Docket

We process account information, tasks, routines, planner content, AI conversations, requested AI actions, chat history and subscription information where necessary to provide the service you have requested.

**Lawful basis:** performance of our contract with you.

### AI features you request

When you send a message or image to the AI assistant, we process that content and transmit relevant information to our AI providers so that the assistant can generate a response or perform the action you requested.

Where you explicitly ask The Docket to remember information for future conversations, we process that memory as part of providing the requested personalisation feature.

**Lawful basis:** performance of our contract with you.

### Automatic AI memory and personalisation

Where automatic memory is enabled, the AI may identify and save limited durable information that appears useful for future conversations.

We use this feature to make the assistant more useful and reduce the need for users to repeat relevant information across conversations.

**Lawful basis:** our legitimate interests in providing useful and personalised AI functionality, balanced against your privacy rights and subject to your ability to disable automatic memory and delete saved memories.

### Subscription administration and payments

We process subscription status and related billing information to activate paid plans, administer subscriptions, manage renewals and cancellations, respond to billing issues and maintain appropriate transaction records.

**Lawful basis:** performance of our contract with you and, where applicable, compliance with legal obligations.

### Security, fraud prevention and service integrity

We process technical, security and usage information where necessary to:

* protect accounts;
* detect abuse or unauthorised access;
* prevent fraud;
* enforce appropriate subscription or usage limits;
* troubleshoot faults; and
* maintain the reliability and security of The Docket.

**Lawful basis:** our legitimate interests in protecting The Docket and its users and operating the service securely and sustainably.

### Legal and financial record-keeping

We may retain limited records where necessary to comply with tax, accounting, regulatory or other legal requirements.

**Lawful basis:** compliance with a legal obligation.

### Optional product-update or marketing emails

Where you actively opt in to receive optional product or marketing communications, we use your email address and preference setting for that purpose.

**Lawful basis:** consent.

You may withdraw that consent at any time.

---

## 5. The AI assistant

The Docket uses third-party AI services, including **Anthropic and Groq**, to provide AI functionality.

Depending on the feature being used, information sent to an AI provider may include:

* your current message;
* relevant previous conversation content;
* relevant saved AI memories;
* images attached to the request, where supported; and
* instructions necessary for the assistant to generate a response or proposed action.

The Docket does **not** use your conversations to train its own AI models.

We do not currently make a broader promise that third-party AI providers can never use information for any form of service improvement or model development, because their treatment of API data depends on the applicable provider terms, contractual arrangements and product settings. We review those arrangements and will update this Privacy Policy where necessary.

The Docket's AI may make mistakes, including when interpreting information or selecting an automatic memory. You can review and delete saved memories through your Profile.

### Automated personalisation and decision-making

The automatic memory system uses automated processing to decide whether certain information appears useful to remember for future conversations.

This is used only to personalise the AI assistant.

The Docket does **not** use AI memory to make solely automated decisions about you that produce legal effects or similarly significant effects, such as decisions about employment, credit, insurance or eligibility for essential services.

---

## 6. Chat history and AI memory

Chat conversations and AI memories are stored against your account so you can access them later.

You can delete individual conversations, clear your chat history, or delete individual memories at any time.

Deleting a conversation does not necessarily delete a separate AI memory that was previously created from information in that conversation. Saved memories can be viewed and deleted separately from your Profile.

---

## 7. Prayer-time location data

If you enable location-based prayer times, your device's coordinates may be sent to the **Aladhan API** so that prayer times can be calculated for that location.

The Docket does not use this feature to track your movements and does not store those coordinates against your account for location tracking.

Your coordinates are disclosed to Aladhan only as necessary to obtain the requested prayer-time calculation.

If you do not enable the feature, this location processing does not take place.

---

## 8. Payments and Stripe

Payments for paid subscriptions are processed by **Stripe**.

The Docket does not receive or store your full payment-card number.

Stripe may collect and process information such as:

* payment-card details;
* name;
* email address;
* billing information;
* transaction details;
* device or IP information; and
* fraud-prevention information.

Stripe can act as a processor when providing payment services on our instructions and can also act as a separate data controller for certain purposes, including fraud prevention, security, regulatory compliance, financial-risk management and improvement of its services.

The Docket receives only the payment and subscription information required to administer your account and paid plan.

Stripe's own processing is also governed by its privacy documentation.

---

## 9. Service providers and recipients

We share personal data only where necessary to operate The Docket, provide requested functionality, comply with the law or protect the service and its users.

Our principal service providers include:

### Supabase

Supabase provides cloud database, authentication and storage infrastructure.

It may process:

* account information;
* authentication information;
* tasks and routines;
* notes and planner content;
* usage records;
* chat history;
* uploaded images;
* saved AI memories; and
* other information stored within your Docket account.

Our primary Supabase project data is hosted in the **European Union**.

### Anthropic

Anthropic is a US-based AI provider used to generate AI responses and process supported AI requests.

Depending on the feature used, it may receive chat content, relevant memory context and uploaded images.

### Groq

Groq is a US-based AI provider used for AI processing, including as a secondary or fallback AI service where applicable.

Depending on the request, it may receive chat text and relevant context necessary to generate a response.

### Stripe

Stripe provides payment and subscription-processing services.

Stripe receives payment information directly from users and provides The Docket with limited subscription and transaction information necessary to administer paid accounts.

### Aladhan

Aladhan provides prayer-time calculations.

If you choose location-based prayer times, it receives the location coordinates necessary to calculate prayer times.

### Infrastructure providers

Our hosting and infrastructure providers may process technical information such as IP addresses, request information, diagnostic data and server logs where necessary to host, secure and operate The Docket.

We may also disclose information where required by law, court order or a competent regulatory or law-enforcement authority.

---

## 10. International transfers

Some of our service providers are located outside the United Kingdom or may process personal data outside the United Kingdom.

In particular, Anthropic and Groq are US-based providers, and Stripe and other infrastructure providers may also process information internationally.

Where UK personal data is transferred to a country outside the UK, we will ensure that the transfer is made using a mechanism permitted by UK data protection law. Depending on the provider and transfer, this may include:

* UK adequacy regulations;
* participation in a recognised adequacy framework applicable to the recipient;
* the UK International Data Transfer Agreement;
* the UK Addendum to approved EU Standard Contractual Clauses; or
* another legally permitted safeguard.

The precise safeguard depends on the provider and applicable contractual arrangement.

You may contact us at **[privacy@thedocket.app](mailto:privacy@thedocket.app)** for information about the safeguards applicable to a particular transfer.

---

## 11. How long we keep your data

We do not keep personal data for longer than reasonably necessary for the purposes described in this Privacy Policy.

### Account, task and routine data

We normally keep account information, tasks, routines, notes and other core planner data for as long as your account remains active.

If you delete your account, active account data is scheduled for deletion within **30 days**, except where we need to retain limited information for legal, tax, accounting, fraud-prevention, security or dispute-resolution purposes.

### Chat messages, images and AI memories

Chat messages, images, and AI memories are retained for as long as your account is active or until you delete them, whichever is sooner.

You can delete individual conversations, clear your chat history, or delete individual memories at any time.

### Technical and security information

Technical or security logs are kept only for as long as reasonably necessary for security, troubleshooting, fraud prevention and service integrity.

Retention periods may differ depending on the type and purpose of the log.

### Subscription and financial records

Subscription information is retained for as long as needed to administer your subscription and afterwards where necessary for legitimate accounting, dispute-resolution or legal purposes.

Certain business and transaction records may need to be retained for longer where required by tax or accounting law.

### Backups and provider systems

Deleted information may remain temporarily in secure backups or provider systems until normal backup or deletion cycles complete, where immediate deletion from those systems is not technically possible.

We do not restore deleted information to active use except where necessary for disaster recovery, security or legal reasons.

---

## 12. Security

We use reasonable technical and organisational measures designed to protect personal data against unauthorised access, loss, misuse or disclosure.

These measures include, where applicable:

* encrypted connections using HTTPS/TLS;
* authentication and access controls;
* cloud database security controls;
* encryption at rest provided by our infrastructure providers;
* restrictions preventing users from accessing other users' account content; and
* appropriate security monitoring and logging.

No online service can guarantee absolute security.

If we become aware of a personal-data breach, we will assess it and make any notifications required by applicable data protection law.

---

## 13. Your rights

Under UK data protection law, depending on the circumstances and the lawful basis involved, you may have the right to:

* **access** personal data we hold about you;
* **correct** inaccurate or incomplete personal data;
* **request deletion** of your personal data;
* **restrict** certain processing;
* **object** to certain processing, including processing based on legitimate interests;
* **receive certain personal data in a portable format** where the right to data portability applies; and
* **withdraw consent** at any time where processing is based on consent.

Withdrawing consent does not affect processing that was lawful before consent was withdrawn.

Some rights are subject to exemptions or limitations under data protection law.

### Your right to object

Where we rely on legitimate interests, you have the right to object to that processing in certain circumstances.

For example, you can switch off automatic AI memory in your Profile if you do not want the assistant automatically creating new memories for personalisation.

### Exercising your rights

To exercise a privacy right, contact:

**[privacy@thedocket.app](mailto:privacy@thedocket.app)**

We will respond without undue delay and normally within **one month**, subject to any extension permitted by law for particularly complex or numerous requests.

We may need to verify your identity before responding to a request.

---

## 14. Complaints

If you have concerns about how we handle your personal data, please contact us first at:

**[privacy@thedocket.app](mailto:privacy@thedocket.app)**

You may use this address to make a data-protection complaint.

You also have the right to complain to the **Information Commissioner's Office (ICO)**, the UK's data protection regulator.

Information about making a complaint is available at **ico.org.uk**.

---

## 15. Information you need to provide

Certain information is necessary for us to provide The Docket.

For example, we need the account information required during registration to create and maintain your account.

If you do not provide information required to create an account, you may not be able to use account-based features.

If you choose a paid subscription, payment information required by Stripe must be provided to Stripe so that the subscription can be processed.

Other features are optional. For example, you do not have to:

* enable location-based prayer times;
* upload images;
* use AI memory;
* enable automatic AI memory; or
* opt in to marketing or product-update emails.

---

## 16. Special-category information

The Docket is not designed to create automatic memories containing special-category personal data.

Our automatic-memory system is configured to exclude information revealing matters such as:

* health information;
* racial or ethnic origin;
* political opinions;
* religious or philosophical beliefs;
* trade-union membership;
* genetic or biometric identity information;
* sex life; or
* sexual orientation.

However, The Docket contains free-form task, note and AI-chat features. This means you may choose to enter information of this nature into your own tasks, notes or conversations.

If you include sensitive information in content that you submit, it may be processed as part of providing the feature you requested.

Please avoid including sensitive personal information unless it is genuinely necessary for your use of the feature.

---

## 17. Children's privacy

The Docket is not directed at children under the age of **13**, and we do not knowingly offer the service to children under 13.

If you believe that a child under 13 has provided personal data through The Docket, contact us at **[privacy@thedocket.app](mailto:privacy@thedocket.app)**.

We will investigate and take appropriate steps where required.

---

## 18. Selling data, advertising and tracking

The Docket does **not sell your personal data**.

We do not operate third-party behavioural advertising within The Docket.

We do not use your task, chat or AI-memory content to create advertising profiles.

If this changes materially in the future, this Privacy Policy will be updated and any additional legal requirements will be addressed before that processing begins.

---

## 19. Changes to this Privacy Policy

We may update this Privacy Policy as The Docket changes or as legal requirements develop.

If we make a material change affecting how we collect or use personal data, we will bring the change to your attention through an appropriate method, such as an in-app notice or email, before beginning any new processing where required by law.

Updating this Privacy Policy does not by itself create consent to processing where consent or another lawful basis is legally required.

The "Last updated" date at the top of this page shows when this Privacy Policy was most recently changed.

---

## 20. Contact

**Docket Ltd**

Liverpool, United Kingdom

**Email:** [privacy@thedocket.app](mailto:privacy@thedocket.app)`;

const TERMS_MD=`# Terms & Conditions — The Docket

**Last updated:** 14 September 2026

These Terms govern your use of The Docket. Please read them alongside our Privacy Policy, which explains how we handle your personal data.

The Docket is operated by **Docket Ltd**, a company registered in England and Wales, based in Liverpool, United Kingdom. In these Terms, "The Docket", "we", "us" and "our" refer to Docket Ltd.

## 1. Acceptance of These Terms

By creating an account, starting a free trial, purchasing a subscription, or otherwise using The Docket, you agree to these Terms.

If you don't agree, please don't use the service.

## 2. About the Service

The Docket is a personal productivity, task, routine and scheduling app with an AI assistant.

The Service is available through a free tier and paid subscription plans, including Pro.

We may develop, improve, add or retire features over time, subject to these Terms and your consumer rights.

## 3. Eligibility

You must be at least **13 years old** to create an account.

By registering, you confirm that you meet this requirement and that the information you provide is accurate.

## 4. Your Account & Security

You're responsible for keeping your login credentials secure and for activity carried out through your account.

Tell us as soon as possible at **[support@thedocket.app](mailto:support@thedocket.app)** if you believe your account has been accessed without permission.

## 5. Account Required

A registered account is required to use The Docket. There is no guest or local-only account mode.

Your tasks and other account content are linked to your account, so you'll need to sign back in before accessing them after signing out.

## 6. Subscription, Trial & Billing

The Docket offers free and paid subscription tiers.

The current Pro subscription costs **£4.99 per month** and includes a **7-day free trial**, unless a different price or offer is clearly shown before you subscribe.

You are not charged when the trial begins. If you do not cancel during the trial, your **first subscription charge is taken when the 7-day trial ends**, and your subscription then renews automatically each month until cancelled.

Payments are processed through **Stripe**. We do not store your full payment-card details.

You can cancel automatic renewal at any time through your account settings. Cancellation stops future renewal charges.

### Price changes

We will not change the price of a billing period that has already begun.

If we change the price of a paid subscription for future renewals, we will give you at least **30 days' advance notice**. Any change may reflect changes to the Service, features included in your plan, or our reasonable operating costs.

If you do not want to renew at the new price, you can cancel before it takes effect.

## 7. Cancellations & Refunds

### Cancelling during your free trial

You can cancel during the 7-day free trial through your account settings.

If you cancel before the trial ends, you will not be charged for the paid subscription.

### Our 14-day first-charge refund promise

In addition to your statutory rights, Docket Ltd gives you a **14-day refund period beginning on the date of your first subscription charge**.

If you cancel your subscription and request a refund within **14 calendar days of that first charge**, we will refund that charge.

Refunds are processed manually through Stripe to the original payment method.

After this 14-day first-charge refund period has ended, subscription charges are normally non-refundable, including for an unused portion of a billing period, unless a refund is required by law.

This additional refund promise does not limit any cancellation, refund or other rights you may have under UK consumer law.

### Statutory cancellation rights

If you are a UK consumer entering into a contract online, you may also have statutory cancellation rights under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013.

Those statutory rights operate independently from The Docket's 14-day first-charge refund promise above.

Nothing in these Terms removes or restricts any statutory cancellation or refund right that applies to you.

## 8. Acceptable Use

Please don't:

* use The Docket for an unlawful purpose;
* attempt to access another user's account or data;
* interfere with, overload or disrupt the Service;
* bypass safety safeguards, access controls, subscription limits or other technical restrictions;
* scrape or reverse-engineer the Service except where applicable law expressly permits it; or
* use The Docket to harass, abuse or harm another person.

We may suspend or terminate accounts involved in serious or repeated breaches of these rules.

## 9. The AI Assistant

The Docket includes an AI assistant that can provide responses and, where supported, propose creating, modifying or reorganising tasks and routines for you.

**AI can make mistakes.** It may misunderstand instructions, provide inaccurate information, or make unsuitable scheduling suggestions.

The AI assistant is a productivity tool and is not a substitute for professional legal, medical, financial or other specialist advice.

You should use your own judgement and independently check anything important or time-sensitive.

Where the assistant asks you to confirm a proposed task or routine change, check the proposed action — including relevant dates, times, recurrence and affected items — before confirming it.

Our AI providers and the processing of AI conversations and memories are described in our Privacy Policy.

## 10. Third-Party Services

We rely on third-party services to operate parts of The Docket, including:

* **Supabase** for account, database and storage infrastructure;
* **Stripe** for subscription payments;
* **Anthropic and Groq** for AI processing; and
* **Aladhan** for prayer-time calculations.

Our Privacy Policy explains what personal data may be shared with these providers and why.

Their services may occasionally experience outages or other technical issues outside Docket Ltd's reasonable control.

## 11. Intellectual Property & Your Content

The Docket's software, design, branding and original materials belong to **Docket Ltd** or its licensors and may not be copied, redistributed or commercially exploited without permission except where permitted by law.

You retain ownership of the tasks, notes, messages, images and other content you create or upload.

You give Docket Ltd a limited licence to store, process and transmit your content only as reasonably necessary to provide and operate The Docket, as further explained in our Privacy Policy.

## 12. Privacy

Our Privacy Policy explains what personal data Docket Ltd collects, how it is used, the service providers involved, how long information is retained, and your rights under UK data protection law.

Nothing in these Terms limits your rights under applicable data protection law.

## 13. Availability

We aim to keep The Docket available and working reliably, but online services may occasionally be unavailable because of maintenance, updates, technical faults or circumstances outside our reasonable control.

We do not guarantee uninterrupted or completely error-free availability.

This does not affect your statutory rights or excuse failures for which Docket Ltd is legally responsible.

## 14. Limitation of Liability

Nothing in these Terms excludes or limits liability where it would be unlawful to do so, including liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation.

Nothing in these Terms affects your statutory rights under UK consumer law, including the Consumer Rights Act 2015.

The Docket is a productivity tool. We are not responsible for losses caused solely by relying on an AI suggestion that was inaccurate where it was reasonable for you to check that suggestion before relying on it.

This does not exclude responsibility for errors by the Service itself — for example, where The Docket saves or executes something materially different from an action you actually confirmed.

Where liability can lawfully be limited, we are not responsible for losses that were not reasonably foreseeable when the contract was entered into.

Where a monetary limitation can lawfully apply, Docket Ltd's total liability in connection with the Service will be limited to the **greater of £100 or the amount you paid to Docket Ltd during the 12 months before the event giving rise to the claim**.

## 15. Your Responsibility

You may be responsible for reasonably foreseeable losses suffered by Docket Ltd that are directly caused by your deliberate unlawful use of the Service or serious breach of these Terms.

You will not be responsible under this section for losses caused by Docket Ltd's own breach, negligence, or matters that were not reasonably foreseeable.

## 16. Suspension, Termination & Discontinuation

You can stop using The Docket and delete your account at any time through Settings.

We may suspend or terminate an account where the user seriously or repeatedly breaches these Terms, uses the Service fraudulently or abusively, or where suspension is required by law or necessary to protect the Service or other users.

If Docket Ltd decides to discontinue The Docket entirely, we will give reasonable advance notice where practicable.

If we discontinue a paid Service during a period you have already paid for, and the discontinuation is not caused by your breach of these Terms, we will refund any applicable unused prepaid subscription amount.

## 17. Changes to These Terms

We may update these Terms where reasonably necessary, including to reflect:

* changes to The Docket or its features;
* changes in law or regulation;
* security requirements; or
* corrections or clarifications.

For changes that do not materially affect your rights or obligations, we may simply update the "Last updated" date.

If we make a material change that meaningfully affects your rights or an existing paid subscription, we will give you reasonable advance notice through the app or by email.

Where an applicable material change would disadvantage an existing paid subscriber, you will have an opportunity to cancel before that change takes effect where appropriate.

Your legal rights do not depend on being deemed to have accepted a change merely because you continued using the Service.

## 18. Governing Law

These Terms are governed by the laws of **England and Wales**.

If you are a consumer, this does not prevent you from relying on mandatory consumer protections that apply where you live or from bringing proceedings in a court available to you under applicable consumer law.

## 19. Contact

The Docket is operated by:

**Docket Ltd**
Liverpool, United Kingdom

Questions about these Terms can be sent to:

**[legal@thedocket.app](mailto:legal@thedocket.app)**`;

// ── Info Modal ───────────────────────────────────────────────────────────────
function InfoModal({modal,onClose,dark,user,onUserChange,onNavigate,isPro,subPeriodEnd,subTier}:{
  modal:string;onClose:()=>void;dark:boolean;
  user:{name:string;email:string;avatar?:string;id?:string}|null;
  onUserChange:(u:{name:string;email:string;avatar?:string;id?:string}|null)=>void;
  onNavigate?:(m:string)=>void;
  isPro?:boolean;
  subPeriodEnd?:string|null;
  subTier?:string|null;
}){
  const{lang,t,dir}=useApp();
  const locale=localeFor(lang);
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
  // The period the counters belong to, resolved exactly as the server's
  // resolveSonnetPeriod does it: a subscriber's billing period, today's UTC
  // date for everyone else. The two genuinely differ — free-tier Nova is
  // capped per day, not per billing month.
  const usagePeriodEnd=isPro&&subPeriodEnd?subPeriodEnd:todayISO();

  // Reads the same usage row that powers the chat input's "Vega — N left"
  // indicator, so the two can never disagree.
  //
  // Deliberately NOT Pro-gated any more. The server tracks free-tier Nova as
  // well — trackSonnetUsage was extended to cover it once the 10/day cap
  // became enforced — so a free user does have a real row worth showing. The
  // comment that used to sit here claimed the opposite and was stale.
  //
  // period_end is checked rather than trusted, mirroring bumpUsage: the server
  // zeroes both counters when the stored period stops matching, but only on
  // its next write. Until then a stale row still holds the previous period's
  // numbers, and reading them blind would show yesterday's count against
  // today's limit.
  const[usage,setUsage]=useState<{sonnet_count:number;opus_count:number}|null>(null);
  useEffect(()=>{
    if(!user?.id){setUsage(null);return;}
    let cancelled=false;
    (async()=>{
      const sb=await getSupabaseClient();
      if(!sb)return;
      const{data,error}=await sb.from("usage")
        .select("period_end,sonnet_count,opus_count").eq("user_id",user.id).maybeSingle();
      if(cancelled)return;
      if(error){console.error("Failed to load usage:",error);return;}
      const stale=!data||data.period_end!==usagePeriodEnd;
      setUsage({
        sonnet_count:stale?0:(data.sonnet_count??0),
        opus_count:stale?0:(data.opus_count??0),
      });
    })();
    return()=>{cancelled=true;};
  },[user?.id,usagePeriodEnd]);

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

  // ── Account deletion ──────────────────────────────────────────────────────
  // Two-step, and the second step is typing your own address rather than
  // pressing a second button. A confirm dialog is dismissed by reflex; an
  // exact-match field cannot be completed by accident, and it is the
  // convention for this action across the tools people already use.
  //
  // The check here is a courtesy that shapes the UI. The route performs the
  // same comparison against the token's own email, because a client-side gate
  // is a suggestion.
  const[deleteOpen,setDeleteOpen]=useState(false);
  const[deleteConfirm,setDeleteConfirm]=useState("");
  const[deleting,setDeleting]=useState(false);
  const[deleteError,setDeleteError]=useState<string|null>(null);
  const deleteArmed=!!user?.email&&deleteConfirm.trim().toLowerCase()===user.email.toLowerCase();

  async function handleDeleteAccount(){
    if(!deleteArmed||deleting)return;
    setDeleting(true);
    setDeleteError(null);
    try{
      const authHeaders=await getAuthHeader();
      const res=await fetch("/api/account/delete",{
        method:"POST",
        headers:{"Content-Type":"application/json",...authHeaders},
        body:JSON.stringify({confirmEmail:deleteConfirm.trim()}),
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok){
        // Every failure path on the route leaves the account intact and says
        // what to do, so show its message rather than a generic one.
        setDeleteError(data?.error??"Could not delete your account.");
        setDeleting(false);
        return;
      }
      // The account is gone server-side. Clear this device too, or the sync
      // effects would keep pushing a deleted user's tasks at a dead account.
      // Preferences (theme, language) are deliberately left — they are not
      // account data and the next person to use this browser may want them.
      try{
        localStorage.removeItem(STORAGE_TASKS);
        localStorage.removeItem(STORAGE_ROUTINES);
        localStorage.removeItem("docket-onboarded");
        localStorage.removeItem("docket-user-name");
      }catch{}
      const sb=await getSupabaseClient();
      if(sb) await sb.auth.signOut();
      onUserChange(null);
      onClose();
    }catch(e:any){
      setDeleteError(e?.message??"Could not delete your account.");
      setDeleting(false);
    }
  }

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
              textTransform:"uppercase",marginBottom:14}}>{t("account")}</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <p style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{t("displayName")}</p>
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
                    {t("saveLabel")}
                  </button>
                </div>
              </div>
              <div>
                <p style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{t("email")}</p>
                <input value={user.email} disabled
                  style={{width:"100%",padding:"11px 14px",borderRadius:10,
                    border:`1.5px solid ${C.border}`,fontSize:14,
                    background:dark?"#13151f":"#F0F0F8",
                    color:C.muted,fontFamily:"inherit",cursor:"not-allowed"}}/>
                <p style={{fontSize:10,color:C.muted2,marginTop:4}}>{t("emailChangeNote")}</p>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
              <p style={{fontSize:12,fontWeight:600,color:C.navy,paddingRight:12}}>
                {t("marketingOptIn")}
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
              textTransform:"uppercase",marginBottom:14}}>{t("plan")}</p>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              {/* Bare glyph, no tile. The orange gradient square only ever
                  showed for subscribers, which made the Plan card look like a
                  different component depending on who was reading it. C.sage
                  rather than a new lime: it is the palette's existing positive
                  colour and it is theme-aware, which a raw hex would not be. */}
              <div style={{width:40,height:40,flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <i className={`ti ${isPro?"ti-crown":"ti-user"}`}
                  style={{fontSize:26,color:isPro?C.sage:C.muted}} aria-hidden="true"/>
              </div>
              <div>
                <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:16,color:C.navy}}>
                  {isPro?(subTier==="max"?"The Docket Max":"The Docket Pro"):t("freePlan")}
                </p>
                <p style={{fontSize:11.5,color:C.muted}}>
                  {/* The date is placed through the translation's {date}
                      placeholder and wrapped in <bdi>, never concatenated onto
                      the label. The old `Renews ${date}` form put a Latin word
                      in front of an Arabic date inside an RTL paragraph; the
                      date itself was right but bidi reordered the runs around
                      it. <bdi> isolates the date so its direction cannot leak
                      into the sentence, whatever the locale formats it as. */}
                  {isPro
                    ?(subPeriodEnd
                        ?(()=>{
                            const[before,after=""]=t("renewsOn").split("{date}");
                            return<>{before}<bdi>{new Date(subPeriodEnd)
                              .toLocaleDateString(locale,{day:"numeric",month:"long",year:"numeric"})}</bdi>{after}</>;
                          })()
                        :t("activeSubscription"))
                    :t("upgradeBlurb")}
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
                <i className="ti ti-settings" style={{fontSize:16,color:C.sage}} aria-hidden="true"/>
                {t("manageSubscription")}
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
                {t("tryProFree")}
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
                {/* Nova — uncapped for any subscriber, so this is a plain count rather than a fill bar with a fabricated denominator */}
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.navy,display:"flex",alignItems:"center",gap:6}}>
                      <i className="ti ti-message-circle" style={{fontSize:14,color:C.primary}} aria-hidden="true"/>
                      Nova messages
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
                {/* Vega — real per-period cap, same usage-table row as the chat input's "Vega — N left" indicator */}
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.navy,display:"flex",alignItems:"center",gap:6}}>
                      <i className="ti ti-brain" style={{fontSize:14,color:"#8670E8"}} aria-hidden="true"/>
                      Vega credits
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
                  Usage tracking is included with Pro — see exactly how many Nova and Vega messages you've used each billing period.
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
                      <p style={{fontSize:10,color:C.muted2,marginTop:3}}>{formatConversationTime(m.created_at,locale)}</p>
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

          {/* ── Danger zone ───────────────────────────────────────────────────
              Last in the card and visually separated, because nothing else here
              is irreversible. Collapsed until asked for: a delete control that
              is one tap from armed does not belong beside everyday settings. */}
          <div style={{height:1,background:C.border,marginBottom:14}}/>
          {!deleteOpen?(
            <button onClick={()=>{setDeleteOpen(true);setDeleteConfirm("");setDeleteError(null);}}
              style={{display:"flex",width:"100%",alignItems:"center",gap:10,padding:"12px 14px",
                borderRadius:12,border:`1px solid rgba(217,79,61,0.25)`,
                background:"rgba(217,79,61,0.06)",cursor:"pointer",
                color:C.urgent,fontSize:13,fontWeight:600,fontFamily:"inherit",textAlign:"start"}}>
              <i className="ti ti-trash" style={{fontSize:16,flexShrink:0}} aria-hidden="true"/>
              {t("deleteAccount")}
            </button>
          ):(
            <div style={{padding:"14px",borderRadius:12,
              border:`1px solid rgba(217,79,61,0.35)`,background:"rgba(217,79,61,0.06)"}}>
              <p style={{fontSize:12,lineHeight:1.5,color:C.navy,marginBottom:12}}>
                {t("deleteAccountWarn")}
              </p>
              {/* The address is the confirmation, so it has to be visible to
                  type. <bdi> keeps a Latin address from reordering the sentence
                  around it in Arabic or Urdu. */}
              <p style={{fontSize:11,color:C.muted,marginBottom:6}}>
                {(()=>{
                  const[before,after=""]=t("deleteAccountConfirm").split("{email}");
                  return<>{before}<bdi style={{fontWeight:700,color:C.navy}}>{user.email}</bdi>{after}</>;
                })()}
              </p>
              <input value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)}
                autoComplete="off" autoCapitalize="none" spellCheck={false}
                disabled={deleting}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,fontSize:13,
                  border:`1.5px solid ${deleteArmed?C.urgent:C.border}`,
                  background:dark?"#13151f":"#FFFFFF",color:C.navy,
                  outline:"none",fontFamily:"inherit",marginBottom:10}}/>
              {deleteError&&(
                <p style={{fontSize:11.5,lineHeight:1.45,color:C.urgent,marginBottom:10}}>
                  {deleteError}
                </p>
              )}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setDeleteOpen(false);setDeleteConfirm("");setDeleteError(null);}}
                  disabled={deleting}
                  style={{flex:1,padding:"10px",borderRadius:10,fontSize:12.5,fontWeight:700,
                    border:`1px solid ${C.border}`,background:"transparent",color:C.muted,
                    cursor:deleting?"default":"pointer",fontFamily:"inherit"}}>
                  {t("cancel2")}
                </button>
                {/* Stays disabled until the address matches exactly, so the
                    destructive action cannot be reached by a stray tap. */}
                <button onClick={handleDeleteAccount} disabled={!deleteArmed||deleting}
                  style={{flex:2,padding:"10px",borderRadius:10,fontSize:12.5,fontWeight:700,
                    border:"none",color:"white",fontFamily:"inherit",
                    background:deleteArmed?C.urgent:C.border,
                    opacity:deleting?0.7:1,
                    cursor:deleteArmed&&!deleting?"pointer":"not-allowed"}}>
                  {deleting?t("deleting"):t("deleteAccountCta")}
                </button>
              </div>
            </div>
          )}
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

    // Which tier this account is actually on. A credit bar only shows a real
    // "used" figure for this one — you cannot have consumed anything on a plan
    // you are not subscribed to, and inventing a 0% bar for the other two
    // would read as "you have used none of your Pro credits" to someone who
    // has no Pro subscription at all.
    const currentTier:"free"|"pro"|"max"=isPro?(subTier==="max"?"max":"pro"):"free";
    const signedIn=!!user?.id;

    // Free-tier Nova resets at the next UTC midnight; a subscriber's credits
    // reset at the end of the Stripe billing period. Rendered through <bdi> at
    // the call site so a localised date can never reorder the sentence
    // around it.
    function resetLabel(tier:"free"|"pro"|"max"):string{
      if(tier!=="free"&&subPeriodEnd){
        return new Date(subPeriodEnd).toLocaleDateString(locale,{day:"numeric",month:"short"});
      }
      if(tier==="free"){
        const t=new Date();t.setUTCDate(t.getUTCDate()+1);
        return t.toLocaleDateString(locale,{day:"numeric",month:"short"});
      }
      return "";
    }

    // One credit row. `used` is null for a plan the account is not on, which
    // renders the allowance with no fill and no percentage rather than a
    // misleading empty bar.
    function CreditBar({icon,color,label,used,limit,unlimited,reset}:{
      icon:string;color:string;label:string;
      used:number|null;limit:number|null;unlimited?:boolean;reset:string;
    }){
      const pct=unlimited?100:(used!=null&&limit?Math.min(100,(used/limit)*100):0);
      return(
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:5}}>
            <span style={{fontSize:11.5,fontWeight:600,color:C.navy,display:"flex",alignItems:"center",gap:6,minWidth:0}}>
              <i className={`ti ${icon}`} style={{fontSize:13,color,flexShrink:0}} aria-hidden="true"/>
              {label}
            </span>
            <span style={{fontSize:11.5,fontWeight:700,color:C.navy,whiteSpace:"nowrap"}}>
              {unlimited
                ?"Unlimited"
                :used!=null
                  ?<>{localeNum(used,locale)} / {localeNum(limit??0,locale)}</>
                  :<>{localeNum(limit??0,locale)}</>}
            </span>
          </div>
          <div style={{height:5,borderRadius:3,background:C.border,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${pct}%`,borderRadius:3,
              background:`linear-gradient(90deg,${color}88,${color})`,
              transition:`width ${PANEL_OPEN_MS}ms ${PANEL_EASE}`}}/>
          </div>
          {reset&&(
            <p style={{fontSize:9.5,color:C.muted2,marginTop:4}}>
              Resets <bdi>{reset}</bdi>
            </p>
          )}
        </div>
      );
    }

    const plans=[
      {id:"free",name:"Free",icon:"ti-user",accent:C.muted,price:"£0",priceSuffix:"/month",
        iconBg:C.surface,iconBorder:`1.5px solid ${C.border}`,
        bars:[{icon:"ti-message-circle",color:C.primary,label:"Nova",
               used:currentTier==="free"&&signedIn&&usage?usage.sonnet_count:null,
               limit:FREE_NOVA_DAILY_LIMIT,unlimited:false,reset:resetLabel("free")}],
        note:"10 messages a day · no Vega access",
        cta:"Continue Free",onClick:onClose,
        ctaStyle:{background:"transparent",color:C.navy,border:`1.5px solid ${C.border}`}},
      {id:"pro",name:"Pro",icon:"ti-crown",accent:C.primary,price:"£4.99",priceSuffix:"/month",
        disclosure:"7 days free, then £4.99/month. Cancel anytime.",
        iconBg:"linear-gradient(145deg,#6677E8,#4C5FD5)",iconShadow:"0 4px 14px rgba(76,95,213,0.4)",
        bars:[
          {icon:"ti-message-circle",color:C.primary,label:"Nova",
           used:null,limit:null,unlimited:true,reset:""},
          {icon:"ti-brain",color:"#8670E8",label:"Vega",
           used:currentTier==="pro"&&signedIn&&usage?usage.opus_count:null,
           limit:opusLimitForTier("pro"),unlimited:false,reset:resetLabel("pro")},
        ],
        cta:user?.id?"Start My Free 7 Days →":"Sign in to Start Free Trial",onClick:()=>handleSubCheckout("pro"),
        ctaStyle:{background:"linear-gradient(145deg,#6677E8,#4C5FD5,#2A3699)",color:"white",border:"none",boxShadow:"0 6px 20px rgba(76,95,213,0.4)"}},
      {id:"max",name:"Max",icon:"ti-bolt",accent:"#8670E8",price:"£14.99",priceSuffix:"/month",
        disclosure:"7 days free, then £14.99/month. Cancel anytime.",
        iconBg:"linear-gradient(145deg,#A78BFA,#8670E8)",iconShadow:"0 4px 14px rgba(134,112,232,0.4)",
        bars:[
          // Unlimited, matching what the server actually grants:
          // resolveSonnetEligibility allows any entitled subscriber through
          // with no count check. The card used to advertise 500/month, a cap
          // that has never existed in the code.
          {icon:"ti-message-circle",color:C.primary,label:"Nova",
           used:null,limit:null,unlimited:true,reset:""},
          {icon:"ti-brain",color:"#8670E8",label:"Vega",
           used:currentTier==="max"&&signedIn&&usage?usage.opus_count:null,
           limit:opusLimitForTier("max"),unlimited:false,reset:resetLabel("max")},
        ],
        cta:user?.id?"Try Docket Max →":"Sign in to Try Max",onClick:()=>handleSubCheckout("max"),
        ctaStyle:{background:"linear-gradient(145deg,#A78BFA,#8670E8,#5B3FBF)",color:"white",border:"none",boxShadow:"0 6px 20px rgba(134,112,232,0.35)"}},
    ];

    const centerIdx=plans.findIndex(p=>p.id===selectedTier);
    return(
    // No overflowY here. The backdrop used to scroll as well as the panel,
    // which meant two nested scrollers fighting over the same gesture.
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,
      background:"rgba(0,0,0,0.65)",backdropFilter:"blur(10px)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      {/* maxHeight + overflowY stay purely as an overflow valve for very short
          viewports. The carousel itself never needs them: it shows one card at
          a time instead of stacking three to scroll through. */}
      <div onClick={e=>e.stopPropagation()}
        style={{background:dark?"#16192A":"#FFFFFF",borderRadius:28,width:"100%",maxWidth:560,
          // overflowX pinned explicitly: with overflowY:auto, leaving
          // overflow-x at its default `visible` makes CSS compute it to
          // `auto`, which is where the stray horizontal scrollbar came from.
          maxHeight:"90vh",overflowY:"auto",overflowX:"hidden",position:"relative",
          boxShadow:"0 40px 120px rgba(0,0,0,0.5)",border:`1px solid ${C.border}`,
          padding:"22px 20px 18px"}}>
        {/* Plain close button on the panel itself — the gradient header that
            used to carry it is gone, so this matches the Privacy/Terms
            modals and the avatar card instead. */}
        <button onClick={onClose} aria-label={t("close")}
          style={{position:"absolute",top:14,insetInlineEnd:14,zIndex:5,
            background:"none",border:"none",cursor:"pointer",color:C.muted,
            width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <i className="ti ti-x" style={{fontSize:19}} aria-hidden="true"/>
        </button>

        {authStatus==="error"&&authMsg&&(
          <div style={{padding:"10px 14px",borderRadius:10,marginBottom:14,fontSize:13,
            background:"rgba(217,79,61,0.1)",color:C.urgent,
            border:`1px solid rgba(217,79,61,0.25)`}}>
            {authMsg}
          </div>
        )}

        {/* ── Carousel stage ──────────────────────────────────────────────
            Cards are absolutely positioned and transformed by their offset
            from the centred one, rather than laid out in a scroller: the
            point of the redesign is that nothing scrolls. The stage keeps a
            fixed height so the panel does not resize as cards change. */}
        {/* overflow:hidden is load-bearing, not cosmetic. The panel has
            overflowY:auto, and CSS resolves an overflow-x of `visible` to
            `auto` whenever the other axis is not visible — so a card
            extending past the panel produced a horizontal scrollbar along
            the bottom of the modal. Clipping here keeps side cards inside
            the frame, which is also how they are meant to look. */}
        <div style={{position:"relative",height:CAROUSEL_H,marginBottom:14,overflow:"hidden"}}>
          {plans.map((plan,i)=>{
            const offset=i-centerIdx;
            const center=offset===0;
            // Clamped to one step. With three tiers, centring an end card
            // gives the other two offsets of +1 and +2 (or -1 and -2), and
            // the unclamped form dropped both on the same side — two cards
            // at identical scale and opacity, overlapping into unreadable
            // text, with the far one hanging outside the panel entirely.
            //
            // The far card parks in the neighbour's slot at opacity 0 rather
            // than being unmounted, so when it does become the neighbour it
            // fades in where it already is instead of flying in from
            // somewhere it was never shown.
            const slot=Math.max(-1,Math.min(1,offset));
            const outer=Math.abs(offset)>1;
            // translateX is physical, so the sign flips under RTL or tapping
            // the left-hand card would send it the wrong way.
            const dirSign=slot*(dir==="rtl"?-1:1);
            return(
            <div key={plan.id}
              onClick={()=>{ if(!center&&!outer) setSelectedTier(plan.id as "free"|"pro"|"max"); }}
              aria-hidden={!center}
              style={{position:"absolute",top:0,left:"50%",width:CAROUSEL_CARD_W_CSS,
                height:"100%",marginInlineStart:`calc(${CAROUSEL_CARD_W_CSS} / -2)`,
                display:"flex",flexDirection:"column",
                cursor:center?"default":outer?"default":"pointer",
                pointerEvents:outer?"none":"auto",
                borderRadius:20,padding:"18px 16px",
                border:center?`2px solid ${C.primary}`:`1.5px solid ${C.border}`,
                background:dark?"rgba(255,255,255,0.03)":"#FAFAFC",
                boxShadow:center?"0 16px 40px rgba(76,95,213,0.25)":"none",
                transform:`translateX(calc(${dirSign} * ${CAROUSEL_SHIFT_CSS})) scale(${center?1:0.88})`,
                opacity:center?1:outer?0:0.5,
                filter:center?"none":"blur(2px)",
                zIndex:center?3:1,
                transition:[
                  `transform ${PANEL_OPEN_MS}ms ${PANEL_EASE}`,
                  `opacity ${PANEL_OPEN_MS}ms ${PANEL_EASE}`,
                  `filter ${PANEL_OPEN_MS}ms ${PANEL_EASE}`,
                  `border-color ${PANEL_OPEN_MS}ms ${PANEL_EASE}`,
                  `box-shadow ${PANEL_OPEN_MS}ms ${PANEL_EASE}`,
                ].join(", ")}}>
              <div style={{width:40,height:40,borderRadius:12,margin:"0 auto 10px",
                background:plan.iconBg,border:plan.iconBorder,
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:plan.iconShadow||"none"}}>
                <i className={`ti ${plan.icon}`} style={{fontSize:20,color:plan.iconBorder?C.muted:"white"}} aria-hidden="true"/>
              </div>
              <p style={{textAlign:"center",fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,
                fontSize:16,color:C.navy,marginBottom:2}}>{plan.name}</p>
              <div style={{textAlign:"center",marginBottom:10}}>
                <span style={{fontSize:22,fontWeight:800,fontFamily:"'Space Grotesk',sans-serif",color:C.navy}}>{plan.price}</span>
                <span style={{fontSize:11,color:C.muted}}>{plan.priceSuffix}</span>
              </div>
              <div style={{flex:1}}>
                {plan.bars.map(b=>(
                  <CreditBar key={b.label} icon={b.icon} color={b.color} label={b.label}
                    used={b.used} limit={b.limit} unlimited={b.unlimited} reset={b.reset}/>
                ))}
                {plan.note&&(
                  <p style={{fontSize:9.5,color:C.muted2,lineHeight:1.4}}>{plan.note}</p>
                )}
              </div>
              {plan.disclosure&&(
                <p style={{textAlign:"center",fontSize:9.5,fontWeight:700,color:C.sage,
                  lineHeight:1.35,marginBottom:9}}>
                  <i className="ti ti-shield-check" style={{fontSize:10}} aria-hidden="true"/> {plan.disclosure}
                </p>
              )}
              <button className="sq-btn"
                onClick={e=>{ e.stopPropagation(); plan.onClick(); }}
                tabIndex={center?0:-1}
                style={{width:"100%",padding:"10px",borderRadius:12,fontSize:12,fontWeight:800,
                  ...plan.ctaStyle}}>
                {plan.cta}
              </button>
            </div>
            );
          })}
        </div>

        {/* Dots — a second way to reach a tier, for anyone who would rather
            aim at a target than at a blurred card behind another one. */}
        <div role="tablist" aria-label="Plans"
          style={{display:"flex",justifyContent:"center",gap:8,marginBottom:12}}>
          {plans.map(p=>{
            const active=p.id===selectedTier;
            return(
              <button key={p.id} role="tab" aria-selected={active} aria-label={p.name}
                onClick={()=>setSelectedTier(p.id as "free"|"pro"|"max")}
                style={{width:active?22:8,height:8,borderRadius:4,border:"none",cursor:"pointer",
                  padding:0,background:active?C.primary:C.border,
                  transition:`width ${PANEL_OPEN_MS}ms ${PANEL_EASE}, background ${PANEL_OPEN_MS}ms ${PANEL_EASE}`}}/>
            );
          })}
        </div>

        <p style={{display:"flex",alignItems:"center",justifyContent:"center",flexWrap:"wrap",gap:4,
          fontSize:10.5,color:C.muted2,textAlign:"center"}}>
          Cancel anytime before day 7 and you won't be charged · Secure payment via Stripe
          <i className="ti ti-lock" style={{fontSize:10.5,color:C.muted2}} aria-hidden="true"/>
        </p>
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
      <div onClick={e=>e.stopPropagation()} style={{background:dark?"#16192A":"#FFFFFF",borderRadius:28,width:"100%",maxWidth:740,maxHeight:"88vh",boxShadow:"0 40px 120px rgba(0,0,0,0.5)",border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"24px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {cameFromAuth&&(
              <button onClick={()=>onNavigate?.("login")} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,marginRight:2}}>
                <i className="ti ti-arrow-left" style={{fontSize:18}} aria-hidden="true"/></button>
            )}
            <div style={{width:40,height:40,borderRadius:11,background:"linear-gradient(145deg,#2E8B57,#1A5235)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-shield-lock" style={{fontSize:20,color:"white"}} aria-hidden="true"/></div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted}}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
        </div>
        <div style={{padding:"24px 28px",overflowY:"auto",flex:1}}>
          {/* One markdown document, rendered with the chat's renderers
              retuned for long-form reading. maxWidth caps the measure at a
              comfortable line length independently of the modal's own width. */}
          {/* The documents themselves stay in English — machine-translating
              a contract that states a liability cap and a refund obligation
              is a legal exposure, not a UX improvement. This notice is the
              one translated element on the page, and it says exactly that. */}
          <p style={{maxWidth:680,margin:"0 auto 18px",padding:"10px 12px",borderRadius:10,
            background:dark?"rgba(255,255,255,0.05)":"rgba(15,23,42,0.04)",
            border:`1px solid ${C.border}`,fontSize:11.5,lineHeight:1.55,color:C.muted2}}>
            {t("legalEnglishNotice")}
          </p>
          {/* dir="ltr" because the document below is English whatever the UI
              language is. Without it the whole policy inherits the app's RTL
              direction and renders right-aligned with its punctuation adrift. */}
          <div className="legal-md" dir="ltr" style={{maxWidth:680,margin:"0 auto",fontSize:12.5,color:C.muted,textAlign:"start"}}>
            <ReactMarkdown components={legalMarkdownComponents}>{PRIVACY_POLICY_MD}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );

  if(modal==="terms") return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:dark?"#16192A":"#FFFFFF",borderRadius:28,width:"100%",maxWidth:740,maxHeight:"88vh",boxShadow:"0 40px 120px rgba(0,0,0,0.5)",border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"24px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {cameFromAuth&&(
              <button onClick={()=>onNavigate?.("login")} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,marginRight:2}}>
                <i className="ti ti-arrow-left" style={{fontSize:18}} aria-hidden="true"/></button>
            )}
            <div style={{width:40,height:40,borderRadius:11,background:"linear-gradient(145deg,#6677E8,#4C5FD5)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-file-description" style={{fontSize:20,color:"white"}} aria-hidden="true"/></div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted}}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
        </div>
        <div style={{padding:"24px 28px",overflowY:"auto",flex:1}}>
          {/* The documents themselves stay in English — machine-translating
              a contract that states a liability cap and a refund obligation
              is a legal exposure, not a UX improvement. This notice is the
              one translated element on the page, and it says exactly that. */}
          <p style={{maxWidth:680,margin:"0 auto 18px",padding:"10px 12px",borderRadius:10,
            background:dark?"rgba(255,255,255,0.05)":"rgba(15,23,42,0.04)",
            border:`1px solid ${C.border}`,fontSize:11.5,lineHeight:1.55,color:C.muted2}}>
            {t("legalEnglishNotice")}
          </p>
          {/* dir="ltr" because the document below is English whatever the UI
              language is. Without it the whole policy inherits the app's RTL
              direction and renders right-aligned with its punctuation adrift. */}
          <div className="legal-md" dir="ltr" style={{maxWidth:680,margin:"0 auto",fontSize:12.5,color:C.muted,textAlign:"start"}}>
            <ReactMarkdown components={legalMarkdownComponents}>{TERMS_MD}</ReactMarkdown>
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



// ── All Tasks Sidebar ────────────────────────────────────────────────────────
function TaskSidebar({tasks,filter,setFilter}:{tasks:Task[];filter:Filter;setFilter:(f:Filter)=>void;}){
  const{dark,t,lang}=useApp();
  const locale=localeFor(lang);
  const C=getC(dark);
  const open=tasks.filter(t=>!t.done&&!t.deleted);
  const archived=tasks.filter(t=>t.done||t.deleted);
  const catEntries=Object.entries(CATS);
  const[catMenuOpen,setCatMenuOpen]=useState(false);
  // `filter` is a single value covering both sections — "all"/"ongoing"/
  // "milestone"/"done" or one of the 59 categories — so there is no separate
  // "no category" state to read. The trigger derives its label instead: a
  // category name when one is selected, "All Categories" otherwise. Picking a
  // category therefore deselects whatever was active in Show above, which is
  // simply true of a single-filter model rather than something to paper over.
  const activeCat=catEntries.some(([k])=>k===filter)?filter as string:null;

  function Btn({f,label,count}:{f:Filter;label:string;count:number}){
    const active=filter===f;
    return(
      // Collapsing on select is harmless for the Show rows, which are never
      // inside the dropdown, so the behaviour lives here rather than in two
      // separate handlers.
      <button onClick={()=>{setFilter(f);setCatMenuOpen(false);}} style={{width:"100%",display:"flex",
        justifyContent:"space-between",alignItems:"center",
        padding:"10px 12px",borderRadius:10,fontSize:13.5,fontWeight:600,
        border:"none",cursor:"pointer",
        background:active?"linear-gradient(135deg,#4C5FD5 0%,#2A3699 100%)":"transparent",
        color:active?"white":C.muted,marginBottom:3,
        boxShadow:active?"0 4px 14px rgba(76,95,213,0.4)":"none"}}>
        <span>{label}</span>
        <span style={{fontFamily:"monospace",fontSize:11,opacity:0.75}}>{localeNum(count,locale)}</span>
      </button>
    );
  }
  return(
    <div className="glass" style={{borderRadius:18,padding:12,height:"fit-content"}}>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:C.muted2,
        textTransform:"uppercase",padding:"6px 10px 6px"}}>{t("show")}</p>
      <Btn f="all" label={t("allOpen")} count={open.length}/>
      <Btn f="ongoing" label={t("ongoing")} count={open.filter(x=>x.type==="ongoing").length}/>
      <Btn f="milestone" label={t("completable")} count={open.filter(x=>x.type==="milestone").length}/>
      <Btn f="done" label={t("finishedDeleted")} count={archived.length}/>
      <div style={{height:1,background:C.border,margin:"6px 4px"}}/>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:C.muted2,
        textTransform:"uppercase",padding:"6px 10px 6px"}}>{t("category")}</p>
      {/* Expands in flow rather than floating. Not for the avatar card's
          reason — nothing here clips — but because this column is 200px wide
          on desktop, too narrow for 59 labelled counts, and a popover would
          have to overflow it onto the task list. Below 640px the grid
          collapses and the sidebar sits directly above those tasks, where a
          floating panel would cover them and an in-flow one just pushes them
          down. */}
      <button onClick={()=>setCatMenuOpen(o=>!o)} aria-expanded={catMenuOpen}
        style={{width:"100%",display:"flex",justifyContent:"space-between",
          alignItems:"center",gap:8,
          padding:"10px 12px",borderRadius:10,fontSize:13.5,fontWeight:600,
          border:"none",cursor:"pointer",
          // Carries the same active treatment as the Btn rows, so a category
          // filter still reads as on at a glance once the list is collapsed.
          background:activeCat?"linear-gradient(135deg,#4C5FD5 0%,#2A3699 100%)":"transparent",
          color:activeCat?"white":C.muted,marginBottom:3,
          boxShadow:activeCat?"0 4px 14px rgba(76,95,213,0.4)":"none",
          fontFamily:"inherit",textAlign:"start"}}>
        <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {activeCat?catLabel(activeCat,t):t("allCategories")}
        </span>
        <i className="ti ti-chevron-down" aria-hidden="true"
          style={{fontSize:14,flexShrink:0,
            transform:catMenuOpen?"rotate(180deg)":"rotate(0deg)",
            transition:"transform 0.2s ease"}}/>
      </button>
      {catMenuOpen&&(
        // Same cap and scroll the flat list had — 59 entries needs it.
        <div role="listbox" aria-label={t("category")}
          style={{maxHeight:260,overflowY:"auto",marginBottom:3,
            background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.025)",
            borderRadius:10,padding:"4px 4px 1px"}}>
          {/* The way back out. Without it, choosing a category leaves the
              dropdown with no option that clears it. "all" is the same value
              the Show section's All Open button uses — one filter, one value. */}
          <Btn f="all" label={t("allCategories")} count={open.length}/>
          {/* Only the key is needed now — the label comes from catLabel, not
              from the CATS entry's English text. */}
          {catEntries.map(([k])=>(
            <Btn key={k} f={k as Filter} label={catLabel(k,t)} count={open.filter(x=>x.category===k).length}/>
          ))}
        </div>
      )}
      <div style={{height:1,background:C.border,margin:"6px 4px"}}/>
    </div>
  );
}

// ── Timeline Row ─────────────────────────────────────────────────────────────
function TimelineRow({item,onCheck}:{
  item:{time:string;label:string;category:string;done:boolean;streak:number;conflict:boolean;};
  onCheck:()=>void;
}){
  const{dark,lang}=useApp();
  const locale=localeFor(lang);
  const C=getC(dark);
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",
      borderBottom:`1px solid ${C.border}`}}>
      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11.5,
        color:C.muted,width:48,flexShrink:0,fontWeight:500}}>
        {item.time?localeNum(item.time,locale):"—"}
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

// The chat's renderers, retuned for long-form legal text, plus the headings it
// doesn't define at all. Both additions are needed rather than cosmetic:
// markdownComponents has no h1/h2/h3, so a legal document's headings would
// fall through to bare browser defaults — and since Tailwind's preflight was
// removed, the `*` reset in globals.css zeroes their margins, leaving headings
// jammed against the paragraphs around them. Its paragraph spacing (6px) is
// also tuned for a chat bubble, which reads as a wall at policy length.
// Declared after markdownComponents so the spread below has a value to read;
// InfoModal sits earlier in the file but only reads this at render time.
const legalMarkdownComponents={
  ...markdownComponents,
  h1:({children}:any)=><h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:800,
    margin:"0 0 14px 0",lineHeight:1.3}}>{children}</h1>,
  h2:({children}:any)=><h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,fontWeight:700,
    margin:"22px 0 8px 0",lineHeight:1.35}}>{children}</h2>,
  h3:({children}:any)=><h3 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13.5,fontWeight:700,
    margin:"16px 0 6px 0",lineHeight:1.4}}>{children}</h3>,
  p:({children}:any)=><p style={{margin:"0 0 12px 0",lineHeight:1.65}}>{children}</p>,
  ul:({children}:any)=><ul style={{margin:"0 0 12px 0",paddingLeft:20,listStyle:"disc"}}>{children}</ul>,
  ol:({children}:any)=><ol style={{margin:"0 0 12px 0",paddingLeft:20,listStyle:"decimal"}}>{children}</ol>,
  li:({children}:any)=><li style={{marginBottom:5,lineHeight:1.6}}>{children}</li>,
  a:({href,children}:any)=><a href={href} style={{color:"#4C5FD5",fontWeight:600,textDecoration:"none"}}>{children}</a>,
  // The policies separate every section with `---`. A bare <hr> would inherit
  // the browser's default border AND the zeroed margins from the `*` reset, so
  // it needs both its own rule and its own breathing room.
  hr:()=><hr style={{border:"none",borderTop:"1px solid rgba(128,128,128,0.22)",margin:"26px 0"}}/>,
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

// "2 hours ago" for anything within the last day, otherwise a short date in
// the caller's locale — the same source every other date in the app now uses
// (fmtDate, the calendar views), with the year added only when it isn't the
// current one.
//
// The relative half goes through Intl rather than translation keys. The old
// form built it as `${n} minute${n===1?"":"s"} ago`, and that English
// one-or-many rule is simply wrong for most of the eleven: Russian needs
// three plural forms (минуту / минуты / минут), Arabic six including a dual
// (دقيقة واحدة / دقيقتين / 5 دقائق). No set of static keys expresses that.
// RelativeTimeFormat carries each locale's CLDR plural rules, so this is
// both correct everywhere and zero keys.
const rtfCache=new Map<string,Intl.RelativeTimeFormat>();
function relTimeFmt(locale:string):Intl.RelativeTimeFormat{
  let f=rtfCache.get(locale);
  if(!f){ f=new Intl.RelativeTimeFormat(locale,{numeric:"auto"}); rtfCache.set(locale,f); }
  return f;
}
function formatConversationTime(iso:string,locale:string="en-GB"):string{
  const date=new Date(iso);
  const diffMin=Math.round((Date.now()-date.getTime())/60000);
  // numeric:"auto" is what turns 0 into the locale's idiomatic "now" rather
  // than a literal "in 0 seconds".
  if(diffMin<1) return relTimeFmt(locale).format(0,"second");
  if(diffMin<60) return relTimeFmt(locale).format(-diffMin,"minute");
  const diffHr=Math.round(diffMin/60);
  if(diffHr<24) return relTimeFmt(locale).format(-diffHr,"hour");
  const sameYear=date.getFullYear()===new Date().getFullYear();
  return date.toLocaleDateString(locale,{day:"numeric",month:"short",...(sameYear?{}:{year:"numeric"})});
}

function Chatbot({tasks,routines,onAction,user,isPro,tier,currentView,setCurrentView,onAddTask}:{tasks:Task[];routines:Routine[];onAction:(a:any[])=>void;
  user?:{id?:string}|null;isPro?:boolean;tier?:string|null;
  currentView:View;setCurrentView:(v:View)=>void;onAddTask:()=>void;}){
  const{dark,t,lang}=useApp();
  const locale=localeFor(lang);
  const C=getC(dark);
  // C.border is a near-transparent tint meant for subtle layering over
  // textured surfaces — against the input row's solid white/navy bar it reads
  // as invisible. This gives the mic/send/model-selector buttons an
  // actually-visible idle border in both themes.
  const inputBtnBorder=dark?"1.5px solid rgba(255,255,255,0.18)":"1.5px solid rgba(76,95,213,0.28)";
  // The composer's surface, shared rather than copied. The input pill and the
  // low-credit notice above it are meant to read as one piece of furniture;
  // duplicating these four values would match today and drift the first time
  // the pill is restyled. Layout (padding, display) stays with each user.
  const composerSurface:React.CSSProperties={
    background:dark?"#1A1D3E":"#FFFFFF",
    borderRadius:24,
    border:`1px solid ${dark?"rgba(255,255,255,0.10)":"rgba(20,20,43,0.08)"}`,
    boxShadow:dark?"0 8px 24px rgba(0,0,0,0.35)":"0 8px 24px rgba(76,95,213,0.12)",
  };
  const[open,setOpen]=useState(false);
  const[expanded,setExpanded]=useState(false);
  // The bar's real rendered height, measured rather than assumed — the same
  // lesson the chat history card's width already learned here. A static
  // constant can't get this right: the bar's 0.5px hairline borders snap up
  // to a whole device pixel, so its height (and therefore how far up the
  // panel has to sit to clear it) depends on the display's devicePixelRatio.
  // The bar is mounted for the whole life of this component now (it fades
  // rather than unmounting while fullscreen), so this attaches once and the
  // ResizeObserver covers every later change on its own.
  const barRef=React.useRef<HTMLDivElement|null>(null);
  const[measuredBarHeight,setMeasuredBarHeight]=useState<number|null>(null);
  React.useLayoutEffect(()=>{
    const el=barRef.current;
    if(!el)return;
    const measure=()=>setMeasuredBarHeight(el.getBoundingClientRect().height);
    measure();
    const ro=new ResizeObserver(measure);
    ro.observe(el);
    return()=>ro.disconnect();
  },[]);
  const barHeight=measuredBarHeight??BOTTOM_NAV_HEIGHT_FALLBACK;
  // Non-expanded panel: bottom edge one gap above the bar's real top edge,
  // and the vertical room it gives back when sizing itself is that offset
  // plus a matching margin above.
  const chatPanelBottom=BOTTOM_NAV_BOTTOM+barHeight+BOTTOM_NAV_GAP;
  const chatPanelVMargin=chatPanelBottom+20;

  // Closing is a two-step now: `closing` keeps the panel mounted so its exit
  // animation can play, and the unmount lands after it. Every close path in
  // the app routes through requestClose so none of them can skip the exit —
  // the bar's orb, the panel header's orb, and the click-outside catcher.
  // `expanded` is deliberately NOT reset until the unmount: dropping it up
  // front would snap a fullscreen panel back to floating geometry and then
  // animate it out from there.
  const[closing,setClosing]=useState(false);
  const closeTimer=React.useRef<number|null>(null);
  function requestClose(){
    if(closing)return;
    stopSpeaking();
    setClosing(true);
    // A timeout rather than onAnimationEnd, matching how the avatar card and
    // the old More popover already finalise their exits here. It also can't
    // strand the panel: a backgrounded tab freezes the animation timeline, so
    // animationend may never fire, while a throttled timeout still does.
    closeTimer.current=window.setTimeout(()=>{
      closeTimer.current=null;
      setClosing(false);
      setOpen(false);
      setExpanded(false);
    },PANEL_CLOSE_MS);
  }
  useEffect(()=>()=>{ if(closeTimer.current!=null)window.clearTimeout(closeTimer.current); },[]);
  // Expand/compress fade-in. The layout has already snapped by the time this
  // runs; the fade is the reveal that follows it. It animates opacity alone —
  // no geometry is interpolated, so the contents can't warp the way a scaling
  // transform made them.
  const prevExpandedRef=React.useRef(expanded);
  React.useLayoutEffect(()=>{
    const wasExpanded=prevExpandedRef.current;
    prevExpandedRef.current=expanded;
    // Nothing actually toggled — this is the mount pass, which belongs to the
    // open animation.
    if(wasExpanded===expanded)return;
    const el=chatPanelRef.current;
    if(!el)return;
    el.animate([{opacity:0},{opacity:1}],{duration:PANEL_MORPH_MS,easing:"ease-out"});
  },[expanded]);

  // The bar's orb is a toggle: it stays in the bar while the chat is open
  // (the panel sits above the bar rather than over it), so it has to close
  // as well as open.
  function toggleChat(){
    if(open)requestClose();
    else setOpen(true);
  }
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
  // Chat history card width — measured at runtime, not derived from an
  // assumed panel width. cardWidthNonExpanded/cardWidthExpanded (declared
  // further down) assumed the panel actually renders at
  // panelWidthNonExpanded/panelWidthExpandedMin — real-device testing
  // showed the panel can render meaningfully wider than that assumption
  // at some viewports, throwing off every value derived from it (the
  // dim overlay's cutout landing hundreds of px too far left, painting
  // over the card itself, not just the area beside it). Fixed by
  // measuring the header button group's actual rendered position
  // relative to the panel via refs, instead of computing where it
  // "should" be from a guessed panel width. null until the first
  // measurement lands (see the layout effect below); the static
  // cardWidthNonExpanded/cardWidthExpanded values still exist, but only
  // as the first-paint fallback before that measurement is available,
  // not as the source of truth.
  const[measuredCardWidth,setMeasuredCardWidth]=useState<number|null>(null);
  const chatPanelRef=React.useRef<HTMLDivElement|null>(null);
  const historyButtonGroupRef=React.useRef<HTMLDivElement|null>(null);
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
  // Feeds the panel's own border declaration below (non-expanded only —
  // expanded has no border). Independent of the chat history card's own
  // constants further down — this one predates it and the panel's own
  // border still needs a value regardless of how the card is built.
  const panelBorderWidth=1;

  // ── Chat history card — rebuilt from scratch as a single positioned
  // div (see its render further down) after a dozen incremental patches
  // to the previous two/three-layer version each fixed one real, verified
  // bug and revealed another leftover surface underneath. Every value
  // below is a named constant derived from the card's actual real
  // geometry or the header button group's actual real geometry — nothing
  // here is picked by eye.
  const cardInset=12; // gap from the panel's top/left/bottom edges
  const cardRadius=24; // uniform corner radius, all four corners, both modes
  // Blur radius of the card's own floating shadow (see cardShadow below).
  // Reused in the closed-state translate distance too, so the two can
  // never drift out of sync with each other.
  const cardShadowBlur=32;
  // Real geometry of the header's history/mute/expand button group (see
  // the control-buttons div further down: top:10,right:10, 36px buttons,
  // 10px gaps) — the card's width is derived from this so it always
  // clears the buttons, rather than a fixed number that only happens to
  // clear them at one size.
  const headerButtonSize=36;
  const headerButtonGap=10;
  const headerButtonCount=3;
  const headerButtonRightInset=10; // the button group's own `right:10`
  const headerButtonGroupWidth=
    headerButtonCount*headerButtonSize+(headerButtonCount-1)*headerButtonGap;
  // Breathing room between the card's right edge and the button group —
  // reuses cardInset's own value rather than introducing a second,
  // similar-but-different "gap" number.
  const cardWidthGap=cardInset;
  // panelWidthNonExpanded/panelWidthExpandedMin were the previous source
  // of truth for the card's width — both wrong: real-device testing found
  // the panel rendering meaningfully wider than either assumption at some
  // viewports (the panel's own width is `min(400px, calc(100vw - 40px))`,
  // a CSS expression that depends on the actual viewport and can't be
  // reliably mirrored by a static JS number). Every value derived from
  // that assumption was off by the same amount, including the dim
  // overlay's cutout — it landed hundreds of px too far left on the real
  // device, painting over the card itself instead of just the area
  // beside it. Kept only as the first-paint fallback (see cardWidth
  // below) before the real measurement lands, not as the real answer.
  const panelWidthNonExpanded=400;
  const panelWidthExpandedMin=480;
  const cardWidthNonExpandedFallback=
    panelWidthNonExpanded-panelBorderWidth-headerButtonRightInset-headerButtonGroupWidth
    -cardInset-cardWidthGap;
  const cardWidthExpandedFallback=
    panelWidthExpandedMin-headerButtonRightInset-headerButtonGroupWidth
    -cardInset-cardWidthGap; // no border term — expanded panel has none
  // Real source of truth: measuredCardWidth, set by the layout effect
  // below from the header button group's actual rendered position
  // relative to the actual rendered panel — both read fresh via
  // getBoundingClientRect(), so this is correct regardless of what the
  // panel's real width happens to be at the current viewport, zoom, or
  // OS display scale, none of which a static number can track. Falls
  // back to the old assumption-based value only for the first paint,
  // before that measurement has had a chance to run.
  const cardWidth=measuredCardWidth
    ??(expanded?cardWidthExpandedFallback:cardWidthNonExpandedFallback);
  // Card's actual right edge, for the dim overlay's cutout below. Derived
  // from cardWidth (now measured, not assumed), so this inherits the fix
  // automatically rather than needing its own separate measurement.
  const cardRightEdge=cardInset+cardWidth;
  // Closed-state translate distance: the card's own width (100%) plus its
  // own left inset plus its shadow's blur radius — clears the card fully
  // off-screen including the halo its own shadow would otherwise still
  // cast into the panel's visible area while "closed."
  const cardCloseDistance=`calc(100% + ${cardInset}px + ${cardShadowBlur}px)`;
  // Measures the header button group's real position relative to the
  // real panel, on both refs' current rendered boxes — not derived from
  // any assumption about panel width. A single ResizeObserver on the
  // panel itself (not the button group) covers every case that needs to
  // trigger a re-measurement — window resize, the expanded/non-expanded
  // toggle, and the existing visualViewport-driven keyboard-inset height
  // changes — without wiring each of those up separately: all three
  // change the panel's own rendered box size, which is exactly what
  // ResizeObserver watches, for any reason it happens. (The button group
  // itself isn't a useful observe() target: its own size never changes
  // as the panel resizes — it's a fixed-size flex item pinned by
  // right:10 — only its position relative to the panel does, and
  // ResizeObserver only fires on size changes, not position changes.)
  React.useLayoutEffect(()=>{
    const panelEl=chatPanelRef.current;
    const buttonGroupEl=historyButtonGroupRef.current;
    if(!panelEl||!buttonGroupEl)return;
    const measure=()=>{
      const panelRect=panelEl.getBoundingClientRect();
      const buttonGroupRect=buttonGroupEl.getBoundingClientRect();
      const buttonGroupLeftRelative=buttonGroupRect.left-panelRect.left;
      setMeasuredCardWidth(buttonGroupLeftRelative-cardInset-cardWidthGap);
    };
    measure();
    const ro=new ResizeObserver(measure);
    ro.observe(panelEl);
    return()=>ro.disconnect();
  },[]);
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
  const[usagePeriod,setUsagePeriod]=useState<string|null>(null);
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

  // The prompt itself lives server-side (app/api/ask/_prompt.ts) so it cannot
  // be swapped by the client and does not ship in the bundle. What is built
  // here is only the DATA it interpolates. The schedule is still derived
  // client-side because it comes from the in-memory `routines`, which is the
  // source of truth — the Supabase copy is a fire-and-forget sync target that
  // can trail it by an upsert.
  const buildChatContext=():ChatContext=>{
    const schedule:Record<string,string[]>={};
    DAYS.forEach(d=>{
      const slots=routines
        .filter(r=>(r.days??[]).includes(d)&&r.time)
        .sort((a,b)=>(a.time||"").localeCompare(b.time||""))
        .map(r=>`${r.time} ${r.label} (${r.duration}min)`);
      if(slots.length) schedule[d]=slots;
    });
    return{
      today:todayISO(),
      // Local weekday, not UTC — the server cannot infer the user timezone.
      // Deliberately en-GB and not the UI locale: this is model input, not a
      // label. The server prompt reasons over English weekday names, so
      // localising it here would hand the assistant "الثلاثاء" to match on.
      weekday:new Date().toLocaleDateString("en-GB",{weekday:"long"}),
      schedule,
      tasks:tasks.filter(t=>!t.deleted&&!t.done).map(t=>({id:t.id,title:t.title,
        type:t.type,category:t.category,priority:t.priority,date:t.date,
        time:t.time,notes:t.notes})),
      routines:routines.map(r=>({id:r.id,label:r.label,days:r.days,time:r.time,
        duration:r.duration,intensity:r.intensity})),
    };
  };

  // Real Vega-credits figure — reads the usage row /api/ask writes. Refetched
  // on mount/user change and again after every send(), so the low-credit
  // warning below reacts to the message just sent.
  //
  // period_end is read too, for two reasons. It decides whether the stored
  // count still belongs to the current period: the server zeroes both
  // counters when the period rolls, but only on its next write, so until then
  // a stale row still holds the old numbers and would have this warning fire
  // against credits the user has already got back. And it keys the dismissal
  // below, so dismissing the warning silences it for that period rather than
  // forever.
  // Guards against out-of-order responses. Two of these can overlap — a rapid
  // second send, or a user?.id change while a fetch is already in flight —
  // and they can resolve in either order. Without a guard the OLDER response
  // wins and writes a stale count over a newer one. Each call stamps itself;
  // a result is discarded if a later call has since started. Mirrors the
  // `cancelled` flag InfoModal's copy of this fetch already uses, which this
  // one was written without.
  const usageReqId=React.useRef(0);
  const refreshOpusCount=useCallback(async()=>{
    const reqId=++usageReqId.current;
    if(!user?.id){setOpusCount(null);setUsagePeriod(null);return;}
    const sb=await getSupabaseClient();
    if(!sb)return;
    const{data,error}=await sb.from("usage")
      .select("period_end,opus_count").eq("user_id",user.id).maybeSingle();
    if(error){console.error("Failed to load Vega usage count:",error);return;}
    // An elapsed period_end means the row predates the current period.
    // Comparing dates works for both shapes the server writes: a free user's
    // own UTC date, and a subscriber's billing-period end.
    // Superseded while we were awaiting — a newer call owns the state now.
    if(reqId!==usageReqId.current)return;
    const stale=!data||!data.period_end||data.period_end<todayISO();
    setOpusCount(stale?0:(data.opus_count??0));
    setUsagePeriod(stale?null:data.period_end);
  },[user?.id]);
  useEffect(()=>{refreshOpusCount();},[refreshOpusCount]);

  // Warns once a period when Vega credits get close to the cap. Deliberately
  // stops short of 100%: an exhausted quota already announces itself on the
  // assistant's own message (opusExhausted), and two notices for one
  // condition is one too many.
  //
  // Driven off opusCount rather than called from send(), because
  // refreshOpusCount already runs on mount AND after every send — hanging it
  // off the value means the two paths can never disagree about when to fire.
  const vegaLimit=opusLimitForTier(tier);
  // Rounded once, here, so the figure the warning states is the same one the
  // threshold below tested — computing it twice invites them to disagree at
  // the boundary (89.6% would test as under and display as 90%).
  const vegaPct=opusCount!=null&&vegaLimit>0?Math.round((opusCount/vegaLimit)*100):0;
  const[vegaWarn,setVegaWarn]=useState(false);
  useEffect(()=>{
    if(!isPro||opusCount==null||!usagePeriod){setVegaWarn(false);return;}
    const pct=(opusCount/vegaLimit)*100;
    if(pct<VEGA_WARN_PCT||pct>=100){setVegaWarn(false);return;}
    let dismissed=false;
    // Wrapped: storage throws outright in some privacy modes, and a warning
    // that cannot read its own dismissal flag should still show.
    try{dismissed=localStorage.getItem(VEGA_WARN_KEY+usagePeriod)==="1";}catch{}
    setVegaWarn(!dismissed);
  },[isPro,opusCount,vegaLimit,usagePeriod]);
  // Two-step visibility, the same shape the avatar card uses: `mounted` keeps
  // the element in the DOM so its exit transition can run, `shown` drives the
  // transition itself, and the unmount lands after it. Without the split,
  // dismissing would remove the node mid-frame and nothing would animate.
  const[vegaWarnMounted,setVegaWarnMounted]=useState(false);
  const[vegaWarnShown,setVegaWarnShown]=useState(false);
  const vegaExitTimer=React.useRef<number|null>(null);
  // The single exit path. Both routes out share it — the × below, and the
  // warning simply ceasing to apply (credits reset, tier change, sign-out).
  // Only the × used to clear vegaWarnMounted, so every other route left the
  // element in the DOM at opacity 0, holding its ~40px of space above the
  // input pill for the rest of the session.
  const beginVegaExit=useCallback(()=>{
    if(vegaExitTimer.current!=null)return;
    setVegaWarnShown(false);
    vegaExitTimer.current=window.setTimeout(()=>{
      vegaExitTimer.current=null;
      setVegaWarnMounted(false);
      setVegaWarn(false);
    },PANEL_CLOSE_MS);
  },[]);
  useEffect(()=>{
    if(vegaWarn){
      // Re-arming mid-exit: cancel the pending unmount and reverse, rather
      // than letting the timer tear down a warning that is current again.
      if(vegaExitTimer.current!=null){window.clearTimeout(vegaExitTimer.current);vegaExitTimer.current=null;}
      setVegaWarnMounted(true);
      // A frame after mounting, so the browser has a starting style to
      // transition from — setting both in one tick just paints the end state.
      const id=requestAnimationFrame(()=>setVegaWarnShown(true));
      return()=>cancelAnimationFrame(id);
    }
    // Cleared by something other than the × — run the same exit rather than
    // just hiding it, so it actually leaves.
    if(vegaWarnMounted) beginVegaExit();
  },[vegaWarn,vegaWarnMounted,beginVegaExit]);
  useEffect(()=>()=>{ if(vegaExitTimer.current!=null)window.clearTimeout(vegaExitTimer.current); },[]);

  function dismissVegaWarn(){
    beginVegaExit();
    // Keyed by period, not a bare flag: the point of dismissing is "I know,
    // stop telling me" for these credits, not for every period from now on.
    try{if(usagePeriod)localStorage.setItem(VEGA_WARN_KEY+usagePeriod,"1");}catch{}
  }

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
    setMessages([...newMsgs,{role:"assistant" as const,content:t("working")}]);
    setLoading(true);
    try{
      const authHeaders=await getAuthHeader();
      const res=await fetch("/api/ask",{method:"POST",
        headers:{"Content-Type":"application/json",...authHeaders},
        body:JSON.stringify({context:buildChatContext(),messages:buildApiMessages(newMsgs.slice(-20)),
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
  // position:fixed pinning technique the app-level avatar-card/modal lock
  // uses (see the top-level App component) — a separate effect since the chat
  // panel is scoped to Chatbot, not one of the app-level overlays that lock
  // already covers. The two can't actually be open at once in practice (the
  // chat's own full-viewport backdrop sits over the nav, so the avatar button
  // and anything else that opens a modal is unreachable while it's up), so
  // there's no real risk of the two effects fighting over document.body.style.
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
      lockBodyScroll(chatScrollLockY.current);
    }else{
      unlockBodyScroll();
      window.scrollTo(0,chatScrollLockY.current);
    }
    return unlockBodyScroll;
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
      {/* Bottom nav bar — floating pill, centred at the bottom of the
          screen. Two view-switchers, the chat orb dead centre, then All
          Tasks and Add Task, the last of these reparented here from the
          old standalone floating FAB. The orb is the same ChatBlob
          component/ref/animations as ever, just mounted here, and it now
          renders whether the chat is open or closed — the panel sits above
          the bar rather than over it, so the orb stays reachable and
          doubles as the close control. It hides while the chat is fullscreen
          by going transparent rather than unmounting, which keeps its height
          measurement live instead of re-running on every fullscreen toggle.
          That hide is instant, matching the panel's own instant switch. */}
      {(
        <div ref={barRef} style={{position:"fixed",bottom:BOTTOM_NAV_BOTTOM,left:"50%",
          transform:"translateX(-50%)",
          // Above the chat's own click-outside catcher (58) while the chat
          // is open. The panel no longer covers the bar, so the bar has to
          // stay tappable next to it — otherwise that catcher swallows
          // every bar tap, and the orb would "close" the chat through it
          // rather than through toggleChat (skipping stopSpeaking, leaving
          // a spoken reply still playing).
          zIndex:open?59:40,
          opacity:expanded?0:1,
          pointerEvents:expanded?"none":"auto",
          display:"flex",alignItems:"center",gap:2,padding:"8px 10px",
          borderRadius:999,background:dark?"#1E2043":"#FFFFFF",
          border:`0.5px solid ${C.border}`,
          boxShadow:dark?"0 2px 14px rgba(0,0,0,0.45)":"0 2px 12px rgba(0,0,0,0.08)"}}>
          <button onClick={()=>setCurrentView("daily")} title={t("daily")}
            style={{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",
              border:"none",background:"transparent",cursor:"pointer",borderRadius:"50%"}}>
            <i className="ti ti-list-check" style={{fontSize:21,
              color:currentView==="daily"?C.accent:C.muted}} aria-hidden="true"/>
          </button>
          <button onClick={()=>setCurrentView("calendar")} title={t("calendar")}
            style={{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",
              border:"none",background:"transparent",cursor:"pointer",borderRadius:"50%"}}>
            <i className="ti ti-calendar" style={{fontSize:21,
              color:currentView==="calendar"?C.accent:C.muted}} aria-hidden="true"/>
          </button>
          <div style={{width:1,height:22,background:C.border,flexShrink:0,margin:"0 2px"}}/>
          {/* `active` mirrors the panel header's own instance so it pulses
              while a reply is generating; the amplitude ref stays exclusive
              to that header instance, since a single ref can't drive two
              mounted blobs. */}
          <div style={{flexShrink:0}}>
            <ChatBlob size={44} active={loading} onClick={toggleChat}
              title={open?"Close Docket AI":"Open Docket AI"}/>
          </div>
          <div style={{width:1,height:22,background:C.border,flexShrink:0,margin:"0 2px"}}/>
          <button onClick={()=>setCurrentView("all")} title={t("allTasks")}
            style={{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",
              border:"none",background:"transparent",cursor:"pointer",borderRadius:"50%"}}>
            <i className="ti ti-checkbox" style={{fontSize:21,
              color:currentView==="all"?C.accent:C.muted}} aria-hidden="true"/>
          </button>
          {/* Add-task — an action, not a view, so it never takes the active
              state; it stays accent-coloured as the bar's primary action.
              Same handler as the old standalone floating FAB. */}
          <button onClick={onAddTask} title={t("addTask")}
            style={{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",
              border:"none",background:"transparent",cursor:"pointer",borderRadius:"50%"}}>
            <i className="ti ti-plus" style={{fontSize:23,color:C.accent}} aria-hidden="true"/>
          </button>
        </div>
      )}

      {open&&(
        <>
          <div onClick={requestClose}
            style={{position:"fixed",inset:0,zIndex:58,background:"transparent"}}/>
          {/* Full-viewport layer giving the box below a clean viewport-sized
              coordinate space to position against, with pointerEvents:none so
              it doesn't swallow the click-outside catcher underneath. (It was
              introduced to make every side of that box a plain interpolatable
              number for the expand transition; that transition is gone now,
              but the structure is simpler than what preceded it, so it
              stays.) */}
          <div style={{position:"fixed",inset:0,zIndex:60,pointerEvents:"none"}}>
            {/* Floating vs fullscreen. Every property here switches instantly;
                the only motion is the crossfade above. */}
            <div style={{position:"absolute",pointerEvents:"auto",
              // Non-expanded: sits above the floating bar (chatPanelBottom is
              // the bar's own offset + its MEASURED height + the gap) instead
              // of overlapping it. Expanded pins to 0 and covers everything.
              bottom:(expanded?0:chatPanelBottom)+keyboardInset,
              // Centred by auto margins rather than translateX(-50%), which
              // keeps the panel free of a permanent transform — so
              // `position:fixed` descendants inside it (the model menu's
              // backdrop) resolve against the viewport rather than the panel.
              left:0,right:0,marginLeft:"auto",marginRight:"auto",
              width:expanded?"100%":"min(400px, calc(100vw - 40px))",
              // Same shape as before (600px cap, otherwise fit the visible
              // viewport) — the room it gives back is chatPanelVMargin.
              height:expanded
                ?(visibleHeight!=null?`${visibleHeight}px`:"100vh")
                :(visibleHeight!=null?`${Math.min(600,visibleHeight-chatPanelVMargin)}px`:`min(600px, calc(100vh - ${chatPanelVMargin}px))`),
              maxHeight:expanded
                ?(visibleHeight!=null?`${visibleHeight}px`:"100vh")
                :(visibleHeight!=null?`${visibleHeight-chatPanelVMargin}px`:`calc(100vh - ${chatPanelVMargin}px)`)}}>
            <div ref={chatPanelRef} style={{
              width:"100%",height:"100%",
              borderRadius:expanded?0:24,
              display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",
              // Reverted to a plain, clean floating card — three rim-lit
              // passes (outward glow, then inward glow, then a gold retint)
              // never read as an intentional premium effect on a real
              // device in either theme, and the panel background itself is
              // being rethought anyway (see panelBg above). Revisit edge
              // treatment once the background tone is settled.
              background:panelBg,
              border:expanded?"none":`${panelBorderWidth}px solid ${C.border}`,
              boxShadow:expanded?"none":"0 32px 80px rgba(0,0,0,0.45)",
              // Rather than the blob itself visually traveling into the panel
              // (a true morph), the panel plays its own scale+fade on mount
              // and on the way out, anchored where the blob sits, so opening
              // reads as "rising from the blob" and closing as sinking back
              // into it. Origin swaps to the centre while expanded, where
              // there is no blob beneath it to grow out of.
              transformOrigin:expanded?"center center":"bottom center",
              // Swapping the whole shorthand is what restarts the animation
              // for the exit; `forwards` holds the last frame so the panel
              // doesn't flash back to full size in the gap before unmount.
              animation:closing
                ?`chatPanelOut ${PANEL_CLOSE_MS}ms ${PANEL_EASE} forwards`
                :`chatPanelIn ${PANEL_OPEN_MS}ms ${PANEL_EASE}`}}>
              <style>{`@keyframes chatPanelIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}@keyframes chatPanelOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.92)}}`}</style>

              {/* Chat history — dim overlay + one card, rebuilt from
                  scratch (see the plan in conversation history) after a
                  dozen incremental patches each fixed one real, verified
                  bug and revealed another leftover surface underneath. */}
              <div onClick={()=>setHistoryOpen(false)}
                style={{position:"absolute",
                  // top/bottom now match the card's own inset (same
                  // cardInset constant, not a copy of its value) instead
                  // of spanning the panel's full height. Real-device
                  // measurement found the dim's old top:0/bottom:0
                  // protruding exactly cardInset px above and below the
                  // card — a hard-square-cornered rectangle poking out
                  // past the card's own rounded top/bottom edge, which is
                  // what was actually being reported as a leftover
                  // surface behind the card. The horizontal fix (left:
                  // cardRightEdge) was already correct; this was the
                  // missing vertical half of the same alignment.
                  top:cardInset,bottom:cardInset,right:0,
                  // Card's actual right edge (cardRightEdge, above) — not
                  // a copy of its width alone, and not a hardcoded value.
                  left:cardRightEdge,zIndex:9,
                  // Rounded only on the left corners (touching the card's
                  // own rounded right corners, an internal edge the
                  // panel's clip never reaches) — right corners stay
                  // square since they touch the panel's own right edge,
                  // where the panel's own overflow:hidden + border-radius
                  // already shapes them, the same way the card's own left
                  // corners used to rely on the panel's clip back when it
                  // was a flush sheet. Without this, the dim's square
                  // left corner would sit outside the card's curve at the
                  // very top/bottom of the shared edge, leaving a tiny
                  // undimmed wedge of panel background in the corner.
                  borderRadius:`${cardRadius}px 0 0 ${cardRadius}px`,
                  // Both values dropped from their originals (0.4/0.14) —
                  // those were chosen back when the card itself was
                  // translucent and the dim needed to carry real contrast
                  // to separate it from what showed through behind it. The
                  // card is fully opaque now, so the dim only needs to
                  // signal "this area is inactive," not create contrast
                  // against a translucent neighbor. Real-device feedback
                  // at 0.06 in light mode: still flattening the panel's
                  // gradient and washing out the message bubble across the
                  // whole message area, so light mode goes fully
                  // transparent — the element stays in the DOM (click-to-
                  // close still needs it) and dark mode is untouched.
                  background:dark?"rgba(0,0,0,0.25)":"transparent",
                  opacity:historyOpen?1:0,
                  pointerEvents:historyOpen?"auto":"none",
                  transition:"opacity 0.22s"}}/>
              {/* The card — one positioned div, nothing nested purely for
                  structure. overflow:hidden clips its content to its own
                  rounded shape; the shadow is filter:drop-shadow(), not
                  box-shadow, specifically because box-shadow is clipped
                  by its own element's overflow:hidden in every engine
                  (verified directly in a repro before writing this) —
                  drop-shadow is a post-composite filter effect and isn't
                  subject to the element's own overflow, so it's the only
                  way to get a real floating shadow out of a single div
                  that also needs to clip its own content. */}
              <div onClick={e=>e.stopPropagation()}
                style={{position:"absolute",zIndex:10,
                  top:cardInset,left:cardInset,bottom:cardInset,width:cardWidth,
                  border:`1px solid ${dark?"rgba(255,255,255,0.10)":"rgba(20,20,43,0.08)"}`,
                  borderRadius:cardRadius,
                  background:dark?"#1E2043":"#F2F1F7",
                  overflow:"hidden",
                  display:"flex",flexDirection:"column",
                  // Dialect matched to the input pill's own shadow (tinted
                  // in light mode, since a colored shadow barely reads
                  // against a dark background there; flat black in dark
                  // mode). Only rendered while actually open — the closed-
                  // state transform (below) already clears the card and
                  // this shadow's own blur radius well behind the panel's
                  // clip, so this is a belt-and-suspenders redundancy, not
                  // load-bearing, kept because it was already how this
                  // worked and changing it wasn't asked for.
                  filter:historyOpen
                    ?(dark?`drop-shadow(0 12px ${cardShadowBlur}px rgba(0,0,0,0.4))`
                          :`drop-shadow(0 12px ${cardShadowBlur}px rgba(76,95,213,0.2))`)
                    :"none",
                  // Closed state must clear the card's own width, its own
                  // left inset (it doesn't rest at left:0), and its
                  // shadow's blur radius — see cardCloseDistance above.
                  // translateX(-100%) alone only clears the width, leaving
                  // a cardInset-wide sliver of the card's own opaque
                  // background permanently visible inside the panel
                  // regardless of historyOpen (confirmed on a real device
                  // and via getBoundingClientRect + elementFromPoint in a
                  // repro before this fix).
                  transform:historyOpen?"translateX(0)":`translateX(calc(-1 * ${cardCloseDistance}))`,
                  transition:"transform 0.22s cubic-bezier(0.34,1.56,0.64,1)"}}>
                <div style={{padding:"16px 16px 12px",
                  borderBottom:`1px solid ${dark?"rgba(255,255,255,0.10)":"rgba(20,20,43,0.08)"}`,
                  display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                  <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:13,color:C.navy}}>
                    {t("chatHistory")}
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
                    {t("newChat")}
                  </button>
                </div>

                <div style={{flex:1,overflowY:"auto",padding:"6px 10px"}}>
                  {!user?.id?(
                    <p style={{fontSize:11.5,color:C.muted,padding:"16px 10px",textAlign:"center"}}>
                      {t("historySignIn")}
                    </p>
                  ):historyLoading?(
                    <p style={{fontSize:11.5,color:C.muted,padding:"16px 10px",textAlign:"center"}}>{t("loading")}</p>
                  ):conversations.length===0?(
                    <p style={{fontSize:11.5,color:C.muted,padding:"16px 10px",textAlign:"center"}}>
                      {t("noConversations")}
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
                        <p style={{fontSize:10,color:C.muted}}>{formatConversationTime(c.updated_at,locale)}</p>
                      </div>
                      <button onClick={e=>deleteConversation(c.id,e)}
                        disabled={deletingId===c.id}
                        title={t("deleteConversation")}
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
                <div ref={historyButtonGroupRef} style={{position:"absolute",top:10,right:10,display:"flex",gap:10}}>
                  <button onClick={()=>setHistoryOpen(o=>!o)}
                    title={t("chatHistory")} className="pill-btn"
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
                    onClick={requestClose}
                    title={t("close")}/>
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
                      <img src={m.imageDataUrl} alt={t("attached")}
                        style={{display:"block",maxWidth:"100%",borderRadius:10,
                          marginBottom:m.content?6:0}}/>
                    )}
                    {m.role==="assistant"
                      ?<ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
                      :m.content}
                    {/* The message still arrived — it was answered by Nova
                        because this period's Vega credits are spent. That
                        degrade is deliberate (see resolveOpusEligibility's
                        overLimit branch in app/api/ask/route.ts): a paying
                        subscriber who has used their premium allowance gets a
                        different model, never a refused message. This note
                        exists so they know which one answered. */}
                    {m.opusFallback&&(
                      <p style={{fontSize:10.5,color:C.muted2,marginTop:6,paddingTop:6,
                        borderTop:`1px solid ${dark?"rgba(255,255,255,0.08)":C.border}`,fontStyle:"italic"}}>
                        <i className="ti ti-info-circle" style={{fontSize:11,marginRight:3}} aria-hidden="true"/>
                        {t("opusExhausted")}
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
                    <img src={pendingImage} alt={t("attachedPreview")}
                      style={{width:36,height:36,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
                    <span style={{fontSize:11,color:C.muted,flex:1}}>{t("imageAttached")}</span>
                    <button onClick={()=>setPendingImage(null)} title={t("removeImage")}
                      style={{background:"none",border:"none",cursor:"pointer",color:C.muted2,padding:4}}>
                      <i className="ti ti-x" style={{fontSize:14}} aria-hidden="true"/>
                    </button>
                  </div>
                )}
                {imageError&&(
                  <p style={{fontSize:11,color:C.urgent,marginBottom:8}}>{imageError}</p>
                )}
                {/* Low-Vega notice. A third sibling in this stack, above the
                    input pill and sharing its surface, so it reads as the
                    composer carrying a warning rather than a card parked on
                    top of the conversation. The amber is confined to the icon
                    and the border for the same reason.
                    Width needs no arithmetic — it inherits this wrapper's
                    padding, so it lines up with the pill exactly. */}
                {vegaWarnMounted&&(
                  <div role="status"
                    style={{...composerSurface,
                      display:"flex",alignItems:"center",gap:9,
                      padding:"9px 10px 9px 15px",marginBottom:8,
                      borderColor:dark?"rgba(201,168,76,0.4)":"rgba(201,168,76,0.45)",
                      // Fade and settle toward the pill it belongs to, rather
                      // than blinking out. Only opacity and transform animate:
                      // the row's height is left alone deliberately, so this
                      // cannot thrash layout the way transitioning geometry
                      // did in the chat panel. The gap it occupied closes in
                      // one step at unmount, by which point it is invisible.
                      opacity:vegaWarnShown?1:0,
                      transform:vegaWarnShown?"translateY(0)":"translateY(4px)",
                      transition:`opacity ${PANEL_CLOSE_MS}ms ${PANEL_EASE}, transform ${PANEL_CLOSE_MS}ms ${PANEL_EASE}`}}>
                    <i className="ti ti-alert-triangle" aria-hidden="true"
                      style={{fontSize:14,flexShrink:0,color:"#C9A84C"}}/>
                    <span style={{fontSize:11.5,lineHeight:1.4,color:C.navy,flex:1,minWidth:0}}>
                      {tf("vegaLowWarning",{pct:localeNum(vegaPct,locale)},t)}
                    </span>
                    <button onClick={dismissVegaWarn} aria-label={t("close")}
                      className="pill-btn"
                      style={{width:26,height:26,flexShrink:0,border:"none",
                        background:"transparent",cursor:"pointer",color:C.muted}}>
                      <i className="ti ti-x" style={{fontSize:13}} aria-hidden="true"/>
                    </button>
                  </div>
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
                <div style={{...composerSurface,display:"flex",gap:10,alignItems:"center",
                  padding:"8px 8px 8px 18px"}}>
                  <input value={input} onChange={e=>setInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&send()}
                    // Optimistic early re-measure for when this blur means
                    // the keyboard is on its way down (e.g. tapping Send) —
                    // doesn't replace the visualViewport listener above
                    // (still the source of truth once the browser actually
                    // reports the resize), just gives it a head start
                    // instead of waiting solely on that event's own timing.
                    onBlur={updateFromViewport}
                    placeholder={t("chatAsk")}
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
                        title={t("chooseModel")}
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
                            <span>Vega</span>
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
                  <button onClick={()=>fileInputRef.current?.click()} title={t("attachImage")}
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
          </div>
        </>
      )}
    </>
  );
}

// ── Calendar View ────────────────────────────────────────────────────────────
// `key` marks a holiday as internationally observed and therefore worth
// translating. An entry without one is nation-specific and keeps its
// English name deliberately — see holidayLabel.
const HOLIDAYS:Record<string,{name:string;type:"public"|"religious"|"awareness"|"cultural";key?:string}[]> = {
  "01-01":[{name:"New Year's Day",type:"public",key:"newYear"}],
  "01-15":[{name:"Martin Luther King Jr. Day",type:"public"}],
  "01-27":[{name:"Holocaust Memorial Day",type:"awareness",key:"holocaustMemorial"}],
  "02-14":[{name:"Valentine's Day",type:"cultural",key:"valentines"}],
  "03-08":[{name:"International Women's Day",type:"awareness",key:"womensDay"}],
  "03-17":[{name:"St Patrick's Day",type:"cultural"}],
  "03-21":[{name:"World Down Syndrome Day",type:"awareness",key:"downSyndrome"},{name:"Nowruz (Persian New Year)",type:"cultural",key:"nowruz"}],
  "03-22":[{name:"World Water Day",type:"awareness",key:"waterDay"}],
  "04-01":[{name:"April Fool's Day",type:"cultural"}],
  "04-07":[{name:"World Health Day",type:"awareness",key:"healthDay"}],
  "04-22":[{name:"Earth Day",type:"awareness",key:"earthDay"}],
  "05-01":[{name:"International Labour Day",type:"public",key:"labourDay"}],
  "05-04":[{name:"Star Wars Day",type:"cultural"}],
  "05-15":[{name:"International Day of Families",type:"awareness",key:"familiesDay"}],
  "06-01":[{name:"World Children's Day",type:"awareness",key:"childrensDay"}],
  "06-05":[{name:"World Environment Day",type:"awareness",key:"environmentDay"}],
  "06-21":[{name:"World Music Day",type:"cultural",key:"musicDay"}],
  "07-04":[{name:"US Independence Day",type:"public"}],
  "08-12":[{name:"International Youth Day",type:"awareness",key:"youthDay"}],
  "09-21":[{name:"International Day of Peace",type:"awareness",key:"peaceDay"}],
  "10-01":[{name:"International Day of Older Persons",type:"awareness",key:"olderPersons"}],
  "10-05":[{name:"World Teachers' Day",type:"awareness",key:"teachersDay"}],
  "10-10":[{name:"World Mental Health Day",type:"awareness",key:"mentalHealthDay"}],
  "10-16":[{name:"World Food Day",type:"awareness",key:"foodDay"}],
  "10-31":[{name:"Halloween",type:"cultural"}],
  "11-05":[{name:"Guy Fawkes Night (UK)",type:"cultural"}],
  "11-11":[{name:"Remembrance Day",type:"public"}],
  "12-01":[{name:"World AIDS Day",type:"awareness",key:"aidsDay"}],
  "12-10":[{name:"Human Rights Day",type:"awareness",key:"humanRights"}],
  "12-25":[{name:"Christmas Day",type:"public",key:"christmas"}],
  "12-26":[{name:"Boxing Day (UK)",type:"public"}],
  "12-31":[{name:"New Year's Eve",type:"cultural",key:"newYearsEve"}],
};
// UK Bank Holidays 2026
const UK_BANK_2026:string[]=["2026-01-01","2026-04-03","2026-04-06","2026-05-04","2026-05-25","2026-08-31","2026-12-25","2026-12-28"];
// Islamic dates vary yearly — approximate 2026 dates
const ISLAMIC_2026:Record<string,{name:string;key:string}>={
  "2026-01-20":{name:"Ramadan begins (approx)",key:"ramadan"},
  "2026-02-18":{name:"Eid al-Fitr (approx)",key:"eidFitr"},
  "2026-04-26":{name:"Eid al-Adha (approx)",key:"eidAdha"},
  "2026-05-16":{name:"Islamic New Year (approx)",key:"islamicNewYear"},
  "2026-07-25":{name:"Day of Arafah (approx)",key:"arafah"},
};

// A holiday's display name. Entries carrying a `key` are internationally
// observed and have translations; the rest are nation-specific — Guy Fawkes
// Night, Boxing Day, US Independence Day — and keep their English names on
// purpose, since a Bengali rendering of a British bank holiday helps nobody.
function holidayLabel(ev:{name:string;key?:string},t:(k:string)=>string):string{
  if(!ev.key) return ev.name;
  const tr=t("hol_"+ev.key);
  return tr==="hol_"+ev.key?ev.name:tr;
}
// The category shown on the legend pills and on each event's badge. Was
// rendered by upper-casing the raw type ("awareness" → "Awareness"), which
// only ever produced English.
function holidayType(type:string,t:(k:string)=>string):string{
  const tr=t("holType_"+type);
  return tr==="holType_"+type?type.charAt(0).toUpperCase()+type.slice(1):tr;
}

const TYPE_STYLE:Record<string,{bg:string;color:string;icon:string}>={
  public:    {bg:"#E4E9F9",color:"#3D52A0",icon:"ti-flag"},
  religious: {bg:"#DCF0E6",color:"#1f7a52",icon:"ti-building"},
  awareness: {bg:"#F6E9D3",color:"#9c6a1f",icon:"ti-heart-handshake"},
  cultural:  {bg:"#FFE4F0",color:"#a53070",icon:"ti-confetti"},
  islamic:   {bg:"#DCF0E6",color:"#1f7a52",icon:"ti-moon-stars"},
  bank:      {bg:"#EDE0F5",color:"#7a3a9e",icon:"ti-building-bank"},
};

function CalendarView({tasks,routines,C}:{tasks:Task[];routines:Routine[];C:ReturnType<typeof getC>}){
  const{lang,dir,t}=useApp();
  const locale=localeFor(lang);
  const now=new Date();
  const[viewMonth,setViewMonth]=useState(now.getMonth());
  const[viewYear,setViewYear]=useState(now.getFullYear());
  const[selectedDay,setSelectedDay]=useState<string|null>(null);

  const firstDay=new Date(viewYear,viewMonth,1);
  const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
  const weekStart=weekStartDay(dir);
  const startDow=leadingBlanks(firstDay,weekStart);

  const monthISO=`${viewYear}-${String(viewMonth+1).padStart(2,"0")}`;

  function getDayData(day:number){
    const iso=`${monthISO}-${String(day).padStart(2,"0")}`;
    const mmdd=iso.slice(5);
    const events:{name:string;type:string;key?:string}[]=[];
    // No key: a UK bank holiday is not an observance anyone outside the UK
    // needs rendered in their own language.
    if(UK_BANK_2026.includes(iso)) events.push({name:"UK Bank Holiday",type:"bank"});
    if(ISLAMIC_2026[iso]) events.push({...ISLAMIC_2026[iso],type:"islamic"});
    (HOLIDAYS[mmdd]||[]).forEach(h=>events.push({name:h.name,type:h.type,key:h.key}));
    const dayTasks=tasks.filter(t=>t.date===iso&&!t.deleted);
    const dayKey=["sun","mon","tue","wed","thu","fri","sat"][new Date(iso+"T12:00:00").getDay()];
    const dayRoutines=routines.filter(r=>(r.days??[]).includes(dayKey));
    return{iso,events,tasks:dayTasks,routineCount:dayRoutines.length};
  }

  const selData=selectedDay?getDayData(parseInt(selectedDay)):null;

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:22,color:C.navy}}>
          {t("calendar")}
        </p>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1);}}
            style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,
              background:C.surface,cursor:"pointer",fontSize:16,color:C.navy,
              backgroundImage:`linear-gradient(135deg,${C.surface},${C.surface2})`,
              boxShadow:"0 2px 6px rgba(35,42,77,0.08)"}}>‹</button>
          <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:15,color:C.navy,minWidth:130,textAlign:"center"}}>
            {monthNames(locale)[viewMonth]} {viewYear}
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
            {holidayType(k,t)}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",borderBottom:`1px solid ${C.border}`}}>
          {dowNames(locale,weekStart).map((d,i)=>(
            <div key={i} style={{padding:"8px 4px",textAlign:"center",fontSize:10.5,
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
                  {localeNum(day,locale)}
                </span>
                <div style={{marginTop:2,display:"flex",flexDirection:"column",gap:1}}>
                  {events.slice(0,2).map((ev,ei)=>{
                    const st=TYPE_STYLE[ev.type]??TYPE_STYLE.cultural;
                    return(
                      <div key={ei} style={{background:st.bg,color:st.color,fontSize:8.5,
                        fontWeight:600,padding:"1px 4px",borderRadius:3,
                        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        <i className={`ti ${st.icon}`} style={{fontSize:8}} aria-hidden="true"/> {holidayLabel(ev,t)}
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
            {new Date(selData.iso+"T12:00:00").toLocaleDateString(locale,{weekday:"long",day:"numeric",month:"long"})}
          </p>
          {selData.events.length>0&&(
            <div style={{marginBottom:10}}>
              {selData.events.map((ev,i)=>{
                const st=TYPE_STYLE[ev.type]??TYPE_STYLE.cultural;
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                    padding:"6px 0",borderBottom:i<selData.events.length-1?`1px solid ${C.border}`:"none"}}>
                    <i className={`ti ${st.icon}`} style={{fontSize:16,color:st.color,flexShrink:0}} aria-hidden="true"/>
                    <span style={{fontSize:13,fontWeight:600,color:C.navy}}>{holidayLabel(ev,t)}</span>
                    <span style={{background:st.bg,color:st.color,fontSize:10,fontWeight:600,
                      padding:"2px 7px",borderRadius:5,marginInlineStart:"auto"}}>{holidayType(ev.type,t)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {selData.tasks.length>0&&(
            <div>
              <p style={{fontSize:10,fontWeight:700,color:C.muted2,letterSpacing:1,
                textTransform:"uppercase",marginBottom:6}}>{t("tasksThisDay")}</p>
              {selData.tasks.map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0"}}>
                  <CatPill category={t.category}/>
                  <span style={{fontSize:13,color:C.navy,fontWeight:500}}>{t.title}</span>
                </div>
              ))}
            </div>
          )}
          {selData.events.length===0&&selData.tasks.length===0&&(
            <p style={{fontSize:13,color:C.muted2}}>{t("noEventsThisDay")}</p>
          )}
        </div>
      )}

      {/* Dot legend */}
      <div style={{display:"flex",gap:14,marginTop:10,fontSize:10.5,color:C.muted}}>
        <span><span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:C.urgent,marginRight:4,verticalAlign:"middle"}}/>{t("hasTask")}</span>
        <span><span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:C.sage,marginRight:4,verticalAlign:"middle"}}/>{t("hasRoutine")}</span>
      </div>
    </div>
  );
}

// ── Live Clock — signature element ───────────────────────────────────────────
function LiveClock({dark,C}:{dark:boolean;C:ReturnType<typeof getC>}){
  const{lang,t}=useApp();
  const locale=localeFor(lang);
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
  const dateLabel=time?time.toLocaleDateString(locale,{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"";
  const weekNum=time?String(Math.ceil((time.getDate()+new Date(time.getFullYear(),time.getMonth(),1).getDay())/7)):"–";
  const monthShort=time?time.toLocaleDateString(locale,{month:"short"}):"";
  return(
    <div className="glass" style={{borderRadius:20,padding:"20px 24px",marginBottom:18,
      background:dark?"rgba(0,0,0,0.1)":"rgba(255,255,255,0.05)",
      display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <p style={{fontFamily:"'IBM Plex Mono',monospace",fontWeight:500,
          fontSize:42,color:C.primary,letterSpacing:"-1px",lineHeight:1}}>
          {localeNum(hh,locale)}<span style={{opacity:0.5,animation:"pulse 1s infinite"}}>:</span>{localeNum(mm,locale)}
          <span style={{fontSize:24,color:C.muted,marginInlineStart:6}}>{localeNum(ss,locale)}</span>
        </p>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:500,
          color:C.muted,marginTop:4}}>
          {dateLabel}
        </p>
      </div>
      <div style={{textAlign:"right"}}>
        <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,
          color:C.muted2,letterSpacing:"2px",textTransform:"uppercase"}}>{t("week")}</p>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:28,
          color:C.navy,lineHeight:1,marginTop:2}}>
          {localeNum(weekNum,locale)}
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
              Then £4.99/mo (16p a day) · 50 Vega credits/mo · Sync everywhere · Cancel anytime
            </p>
          </div>
        </div>
        <div style={{marginTop:12,display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Everything in free","Unlimited Nova messages","Sync across devices","Prayer time auto-update","Advanced analytics","Priority support"].map(f=>(
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
              £14.99/mo · Unlimited Nova + 120 Vega credits/mo · Priority support
            </p>
          </div>
        </div>
        <div style={{marginTop:12,display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Everything in Pro","Unlimited Nova messages","120 Vega credits/mo","Priority support","Early access"].map(f=>(
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
  // Avatar card (replaces the old drawer AND the old settings panel), split
  // across two states so it can animate both ways: `avatarOpen` controls
  // mounting and stays true through the exit transition, `avatarShown` is
  // what the CSS transitions toward. Opening mounts it hidden and flips it
  // shown on the next frame, so there's a painted "from" state to animate
  // out of — same pattern the chat's own popovers use.
  const[avatarOpen,setAvatarOpen]=useState(false);
  const[avatarShown,setAvatarShown]=useState(false);
  const avatarExitTimer=React.useRef<number|null>(null);
  const[langMenuOpen,setLangMenuOpen]=useState(false);
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
  // Read only through setUndoStack's functional updater (see undoLast), so
  // the value binding itself is deliberately not taken.
  const[,setUndoStack]=useState<{tasks:Task[];routines:Routine[]}[]>([]);
  // One status per outcome rather than a single "error". The old shape forced
  // every failure — denial, timeout, no fix available, a dead network, an
  // Aladhan outage — through one string that told the user to check browser
  // permissions, which was wrong for all but the first.
  const[prayerStatus,setPrayerStatus]=useState<
    "idle"|"loading"|"done"|"denied"|"timeout"|"unavailable"|"service">("idle");
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

  function openAvatarCard(){
    if(avatarExitTimer.current!=null){
      // Re-opened mid-exit: still mounted, so just reverse the transition
      // rather than waiting for the pending unmount to land.
      window.clearTimeout(avatarExitTimer.current);
      avatarExitTimer.current=null;
      setAvatarShown(true);
      return;
    }
    setAvatarOpen(true);
  }
  function closeAvatarCard(){
    if(!avatarOpen||avatarExitTimer.current!=null)return;
    // Collapse the language list on the way out, or the card reopens with it
    // still expanded over the rows below.
    setLangMenuOpen(false);
    setAvatarShown(false);
    avatarExitTimer.current=window.setTimeout(()=>{
      avatarExitTimer.current=null;
      setAvatarOpen(false);
    },CARD_ANIM_MS);
  }
  function toggleAvatarCard(){ if(avatarOpen&&avatarShown)closeAvatarCard(); else openAvatarCard(); }
  // Card items that navigate or open a modal dismiss the card on the way.
  function cardGoToView(v:View){ closeAvatarCard(); setCurrentView(v); }
  function cardOpenModal(m:string){ closeAvatarCard(); setActiveModal(m); }
  useEffect(()=>{
    if(!avatarOpen)return;
    const id=requestAnimationFrame(()=>setAvatarShown(true));
    return()=>cancelAnimationFrame(id);
  },[avatarOpen]);
  useEffect(()=>()=>{ if(avatarExitTimer.current!=null)window.clearTimeout(avatarExitTimer.current); },[]);
  useEffect(()=>{
    if(!avatarOpen)return;
    // Escape unwinds one layer at a time: the language list first, the card
    // only once nothing is open on top of it.
    function onKey(e:KeyboardEvent){
      if(e.key!=="Escape")return;
      if(langMenuOpen){ setLangMenuOpen(false); return; }
      closeAvatarCard();
    }
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
    // langMenuOpen is read inside the handler, so the listener has to be
    // rebound when it changes or Escape closes the whole card from a stale
    // false.
  },[avatarOpen,langMenuOpen]);// eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll while the avatar card or a modal is open — see
  // lockBodyScroll for why pinning is necessary and why it reserves the
  // scrollbar's width while it holds.
  const scrollLockY=React.useRef(0);
  useEffect(()=>{
    const locked=avatarOpen||!!activeModal||onboarding;
    if(locked){
      scrollLockY.current=window.scrollY;
      lockBodyScroll(scrollLockY.current);
    }else{
      unlockBodyScroll();
      window.scrollTo(0,scrollLockY.current);
    }
    return unlockBodyScroll;
  },[avatarOpen,activeModal,onboarding]);
  const[user,setUser]=useState<{name:string;email:string;avatar?:string;id?:string}|null>(null);
  const[showWelcome,setShowWelcome]=useState(false);
  const[welcomeMsg,setWelcomeMsg]=useState("");

  const C=getC(dark);
  const dir:("ltr"|"rtl")=RTL_LANGS.includes(lang)?"rtl":"ltr";
  const rtl=dir==="rtl";
  const locale=localeFor(lang);
  const t=(k:string)=>T[lang]?.[k]??T.en[k]??k;

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
  // Every cloud write reports through here. Silence is what let the id
  // collision run for two months: all six call sites discarded the returned
  // error, so a sync that never landed looked exactly like one that did.
  //
  // The flag is deliberately a state, not a log — "this device is ahead of
  // your account right now" — so a later success clears it without anything
  // having to remember what failed. The console keeps the detail.
  const[syncFailed,setSyncFailed]=useState(false);
  const noteSync=useCallback((table:string,op:string,userId:string,rows:number,error:any)=>{
    if(error){
      console.error(`[sync] ${op} on ${table} failed — user ${userId}, ${rows} row(s):`,error);
      setSyncFailed(true);
    }else{
      setSyncFailed(false);
    }
  },[]);

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
      if(tasks.length>0){
        const{error}=await sb.from("tasks").upsert(tasks.map(t=>taskToRow(t,userId)),{onConflict:"user_id,id"});
        noteSync("tasks","first-sync upsert",userId,tasks.length,error);
      }
      if(routines.length>0){
        const{error}=await sb.from("routines").upsert(routines.map(r=>routineToRow(r,userId)),{onConflict:"user_id,id"});
        noteSync("routines","first-sync upsert",userId,routines.length,error);
        prevRoutineIdsRef.current=routines.map(r=>r.id);
      }
    }
    setTimeout(()=>{cloudSyncingRef.current=false;},300);
  }

  // Whether anything that could still overwrite `routines` from elsewhere has
  // finished. The prayer refresh below writes into routines, and a cloud pull
  // landing after it would silently throw the fetched times away.
  const[cloudPullDone,setCloudPullDone]=useState(false);
  useEffect(()=>{
    if(!isLoaded) return;
    if(user?.id){ loadCloudData(user.id).finally(()=>setCloudPullDone(true)); return; }
    // Auth resolved with no session: nothing is coming, so it is safe already.
    if(authChecked) setCloudPullDone(true);
  },[user?.id,isLoaded,authChecked]);

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
      const{error}=await sb.from("tasks").upsert(tasks.map(t=>taskToRow(t,uid)),{onConflict:"user_id,id"});
      noteSync("tasks","upsert",uid,tasks.length,error);
    })();
  },[tasks,isLoaded,user?.id,noteSync]);

  useEffect(()=>{
    if(!isLoaded||!user?.id||cloudSyncingRef.current)return;
    const uid=user.id;
    (async()=>{
      const sb=await getSupabaseClient();
      if(!sb)return;
      if(routines.length>0){
        const{error}=await sb.from("routines").upsert(routines.map(r=>routineToRow(r,uid)),{onConflict:"user_id,id"});
        noteSync("routines","upsert",uid,routines.length,error);
      }
      const currentIds=routines.map(r=>r.id);
      const removed=prevRoutineIdsRef.current.filter(id=>!currentIds.includes(id));
      // Scoped to the owner rather than leaning on RLS to filter it. Two
      // reasons: ids are only unique per account now, and after the composite
      // key there is no index led by id alone, so an unscoped .in() would fall
      // back to a sequential scan.
      if(removed.length>0){
        const{error}=await sb.from("routines").delete().eq("user_id",uid).in("id",removed);
        noteSync("routines","delete",uid,removed.length,error);
        // Only advance the baseline once the delete actually landed. Moving it
        // regardless would forget which ids still need removing, and they would
        // never be retried.
        if(error)return;
      }
      prevRoutineIdsRef.current=currentIds;
    })();
  },[routines,isLoaded,user?.id,noteSync]);

  // Set only when the *stored* setting was already on, so the mount refresh
  // below never double-fires alongside a manual toggle (which does its own
  // fetch). Consumed once and cleared.
  const pendingPrayerRefreshRef=React.useRef(false);

  // Load prayer setting from storage
  useEffect(()=>{
    const saved=localStorage.getItem("docket-prayer-enabled");
    if(saved==="true"){ setPrayerEnabled(true); pendingPrayerRefreshRef.current=true; }
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
  useEffect(()=>{
    localStorage.setItem("docket-lang",lang);
    // dir goes on <html>, not on a wrapper div. Three of this component's
    // return paths render outside the main wrapper — the auth gate, the
    // session-check spinner, and the onboarding screen — and every modal is
    // position:fixed, so a wrapper-level `direction` reached none of them.
    // The effect was that the very first screen an Arabic or Urdu user saw,
    // the sign-in form, was translated but still laid out left to right.
    // The document element covers every tree at once and is also what the
    // browser keys its own scrollbar side and caret behaviour off.
    document.documentElement.setAttribute("dir",dir);
    // Separate from direction: this is what tells a screen reader which
    // language to pronounce. layout.tsx can only hardcode lang="en" because
    // the choice lives in client state.
    document.documentElement.setAttribute("lang",lang);
  },[lang,dir]);

  // Prayer names to update
  const PRAYER_NAMES=["Fajr","Dhuhr","Asr","Maghrib","Isha"];

  // Returns whether prayer times were actually applied, so the toggle can roll
  // itself back rather than sitting ON above an error.
  async function fetchAndApplyPrayerTimes():Promise<boolean>{
    setPrayerStatus("loading");
    // A previously-denied site fails instantly with code 1 and shows no
    // prompt, so asking again only burns the timeout before saying the same
    // thing. Checking first turns that into an immediate, accurate message.
    // Wrapped because the Permissions API doesn't accept "geolocation"
    // everywhere (older Safari throws) — an unsupported query must fall
    // through to the normal request, not fail the whole operation.
    try{
      const perm=await navigator.permissions?.query({name:"geolocation" as PermissionName});
      if(perm?.state==="denied"){ setPrayerStatus("denied"); return false; }
    }catch{ /* Permissions API unavailable here — carry on and just ask. */ }
    try{
      const pos = await new Promise<GeolocationPosition>((resolve,reject)=>
        // 20s, not 8: the old limit had to cover the user reading the
        // permission prompt and deciding, so a slow-but-willing user timed out
        // and was then told to check permissions they had just granted.
        // maximumAge lets a fix from the last 10 minutes return immediately —
        // the default of 0 forced a fresh lookup on every single toggle.
        navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:20000,maximumAge:600000})
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
      return true;
    }catch(e:any){
      // This classification already existed but only reached the console — the
      // UI showed one message for all of it. Now it drives what the user sees,
      // so "check your browser permissions" appears only when permission is
      // genuinely the problem.
      const isGeoError=e&&typeof e.code==="number"&&typeof e.message==="string"&&!(e instanceof Error);
      if(isGeoError){
        const codeNames:Record<number,string>={1:"PERMISSION_DENIED",2:"POSITION_UNAVAILABLE",3:"TIMEOUT"};
        console.error(`Prayer times: geolocation failed — code ${e.code} (${codeNames[e.code]??"unknown"}): ${e.message}`);
        setPrayerStatus(e.code===1?"denied":e.code===3?"timeout":"unavailable");
      } else if(e instanceof TypeError){
        console.error("Prayer times: network/fetch failure —",e.message,e);
        setPrayerStatus("service");
      } else if(e instanceof Error){
        console.error("Prayer times: API/processing failure —",e.message,e);
        setPrayerStatus("service");
      } else {
        console.error("Prayer times: unexpected failure —",e);
        setPrayerStatus("service");
      }
      return false;
    }
  }

  async function togglePrayer(){
    const next=!prayerEnabled;
    setPrayerEnabled(next);
    // Switching off clears any stale error along with it.
    if(!next){ setPrayerStatus("idle"); return; }
    // Roll the switch back if it didn't actually work. Leaving it ON above an
    // error claims a feature is running when it isn't, and the next render
    // would show accurate prayer times as enabled while the times themselves
    // were never updated.
    const applied=await fetchAndApplyPrayerTimes();
    if(!applied) setPrayerEnabled(false);
  }

  // The setting persisted as ON, but the times themselves did not — they were
  // written into `routines` by whichever day the user last toggled it. Without
  // this the toggle reads "on" while the rows show yesterday's Fajr. Runs once
  // per load, and only once the routines it writes into have settled.
  useEffect(()=>{
    if(!pendingPrayerRefreshRef.current||!isLoaded||!cloudPullDone) return;
    pendingPrayerRefreshRef.current=false;
    (async()=>{
      // Same contract as the manual toggle: a failure must not leave the
      // switch claiming the feature is running.
      const applied=await fetchAndApplyPrayerTimes();
      if(!applied) setPrayerEnabled(false);
    })();
    // fetchAndApplyPrayerTimes is a stable declaration in this component and
    // the ref guard makes this a once-per-load effect regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isLoaded,cloudPullDone]);

  const addTask=useCallback((data:Omit<Task,"id"|"done"|"deleted"|"checklist">)=>{
    setTasks(p=>[...p,{id:nextId(p),...data,done:false,deleted:false,checklist:[]}]);
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
          // Owner-scoped for the same reason as the routines delete above.
          const{error}=await sb.from("tasks").delete().eq("user_id",user.id).in("id",archivedIds);
          noteSync("tasks","delete (clear archive)",user.id,archivedIds.length,error);
        }
      }
    }finally{
      setClearingArchive(false);
    }
  }
  const addStep=useCallback((taskId:number,text:string)=>{
    setTasks(p=>p.map(t=>t.id!==taskId?t:{...t,checklist:[...t.checklist,{id:nextId(t.checklist),text,done:false}]}));
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
          id:nextId(prev),
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
      // dow is the raw getDay() index, kept so the chip's weekday label can be
      // looked up straight out of a Sunday-first dowNames() array rather than
      // from a hardcoded English map.
      return{key,dow:d.getDay(),date:d.toISOString().slice(0,10),dayNum:d.getDate(),
        label:d.toLocaleDateString(locale,{day:"numeric",month:"short"}),
        month:d.toLocaleDateString(locale,{month:"short"})};
    });
  })();

  // weekDates now starts 2 weeks before today (see above), so without this
  // the day-picker strip would default to showing that earlier range on
  // load/view-switch instead of today — re-centers on today's chip
  // whenever the Daily view becomes active.
  //
  // Not the thing that positions the strip on first load — it can't be, since
  // currentView is already "daily" while the auth gate is still rendering and
  // the strip doesn't exist yet (see the measuring effect below, which owns
  // the initial scroll). What this still covers is a genuine view CHANGE:
  // leaving Daily for Calendar and coming back, where the strip is mounted
  // and currentView really does change. It targets the same position as the
  // initial scroll, so on first load it is a harmless no-op.
  useEffect(()=>{
    if(currentView==="daily"){
      document.getElementById("day-picker-today")?.scrollIntoView({inline:"start",block:"nearest"});
    }
  },[currentView]);

  // Callback ref rather than a plain one, so the initial scroll-to-today can
  // hang off the moment the strip actually mounts.
  //
  // It can't hang off an effect keyed on `currentView`: that is already
  // "daily" on the very first render, so both a useLayoutEffect and a
  // useEffect fire while the top-level auth gate is still showing its spinner
  // or sign-in screen, when the strip does not exist. getElementById returns
  // null, the optional call no-ops, and since currentView never changes
  // nothing re-runs once the session resolves and the strip finally appears —
  // which is exactly why the deployed site sat at scrollLeft 0. Local testing
  // missed it because the auth bypass used for that renders the app on the
  // first render, so the strip was already there. The bypass hid the bug.
  //
  // It also can't hang off the rAF measuring loop below: rAF doesn't run in a
  // backgrounded tab, so a page loaded in one would never scroll at all.
  // React invokes this the instant the node is attached — no effect ordering,
  // no frame scheduling. Children are already in the DOM by then (refs attach
  // bottom-up), so today's chip is there to scroll to.
  const dayScrollElRef=React.useRef<HTMLDivElement|null>(null);
  const didInitialDayScrollRef=React.useRef(false);
  const scrollDayStripToToday=React.useCallback((el:HTMLDivElement|null)=>{
    // inline:"start" is direction-aware — the left edge in LTR, the right one
    // in RTL — so this needs no branch of its own.
    el?.querySelector("#day-picker-today")?.scrollIntoView({inline:"start",block:"nearest"});
  },[]);
  const attachDayScrollEl=React.useCallback((el:HTMLDivElement|null)=>{
    dayScrollElRef.current=el;
    if(!el||didInitialDayScrollRef.current)return;
    didInitialDayScrollRef.current=true;
    scrollDayStripToToday(el);
  },[scrollDayStripToToday]);
  // The stored language arrives in an effect, so the first paint is always LTR
  // and an Arabic user's strip flips direction a moment later. The browser
  // keeps the old scroll offset across that flip, which lands them somewhere
  // arbitrary in a 204-day range, and the ref above means the initial scroll
  // never re-runs on its own. Re-aim it whenever the direction actually
  // changes — not on mount, where the callback ref has already done it.
  const prevDirRef=React.useRef(dir);
  React.useEffect(()=>{
    if(prevDirRef.current===dir)return;
    prevDirRef.current=dir;
    scrollDayStripToToday(dayScrollElRef.current);
  },[dir,scrollDayStripToToday]);
  const dayTrackRef=React.useRef<HTMLDivElement|null>(null);
  const dayDragRef=React.useRef<{startX:number;startLeft:number;max:number;range:number}|null>(null);
  const[dayScrollMetrics,setDayScrollMetrics]=useState({left:0,max:1,client:1});
  // Seeded with today rather than null so the label under the strip can never
  // render a wrong date, not even for the frame before the effect below takes
  // its first scroll reading.
  const[viewedDate,setViewedDate]=useState<string|null>(todayISO());

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
      // Distance from the start edge, never the raw signed scrollLeft — see
      // scrollStart. Everything below this line is direction-agnostic.
      const left=scrollStart(el,rtl);
      if(left!==lastLeft||max!==lastMax||client!==lastClient){
        lastLeft=left;lastMax=max;lastClient=client;
        setDayScrollMetrics({left,max,client});
      }
      const step=Math.max(1,el.scrollWidth/Math.max(1,weekDates.length));
      // Measured at the strip's LEFT edge, not its centre. The scroll above
      // uses inline:"start", which parks today at the left edge, so a
      // centre-of-viewport reading named a day about eight chips further
      // along — the label said "18 Sept" while today, and the leftmost chip,
      // were the 10th. Reading the same edge the scroll aligns to makes the
      // label name the day the strip is actually parked on.
      const idx=Math.min(weekDates.length-1,Math.max(0,
        Math.round(left/step)));
      if(idx!==lastIdx){
        lastIdx=idx;
        setViewedDate(weekDates[idx]?.date??null);
      }
    };
    const tick=()=>{measure();raf=requestAnimationFrame(tick);};
    measure();
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
    // rtl is read inside measure(); a language switch has to rebind the loop
    // or it keeps reading scrollLeft with the old direction's sign.
  },[currentView,rtl]);

  function dayTrackPointerDown(e:React.PointerEvent<HTMLDivElement>){
    const track=dayTrackRef.current,el=dayScrollElRef.current;
    if(!track||!el)return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect=track.getBoundingClientRect();
    const max=Math.max(1,el.scrollWidth-el.clientWidth);
    const thumbFrac=Math.max(0.06,Math.min(1,el.clientWidth/Math.max(1,el.scrollWidth)));
    const thumbPx=thumbFrac*rect.width;
    const range=Math.max(1,rect.width-thumbPx);
    dayDragRef.current={startX:e.clientX,startLeft:scrollStart(el,rtl),max,range};
  }
  function dayTrackPointerMove(e:React.PointerEvent<HTMLDivElement>){
    const drag=dayDragRef.current,el=dayScrollElRef.current;
    if(!drag||!el)return;
    // Dragging left increases the distance from the start edge in LTR and
    // decreases it in RTL, where the start edge is on the right.
    const dx=(e.clientX-drag.startX)*(rtl?-1:1);
    setScrollStart(el,rtl,
      Math.min(drag.max,Math.max(0,drag.startLeft+dx*(drag.max/drag.range))));
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

  const selDay=weekDates.find(d=>d.date===selectedDate)||weekDates.find(d=>d.key===selectedWeekDay);
  const viewedDay=weekDates.find(d=>d.date===viewedDate)||selDay;
  const selectedDayItems=getDayItems(selectedDate,selectedWeekDay);

  // Shared row/control styling for the avatar card's items.
  const cardRowStyle:React.CSSProperties={display:"flex",width:"100%",alignItems:"center",gap:11,
    padding:"11px 14px",border:"none",background:"transparent",color:C.navy,
    textAlign:"left",fontSize:13,fontWeight:500,fontFamily:"inherit",cursor:"pointer"};
  const cardIconStyle:React.CSSProperties={fontSize:16,flexShrink:0,color:C.muted2,width:16};
  function cardSwitchStyle(on:boolean):React.CSSProperties{
    return{width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",flexShrink:0,
      background:on?"linear-gradient(135deg,#5DE8A0,#2E8B57)":C.border,
      position:"relative",transition:"all 0.25s",
      boxShadow:on?"0 4px 12px rgba(46,139,87,0.4)":"none"};
  }
  function cardKnobStyle(on:boolean):React.CSSProperties{
    return{position:"absolute",top:3,left:on?23:3,width:18,height:18,borderRadius:"50%",
      background:"white",transition:"left 0.25s",boxShadow:"0 2px 6px rgba(0,0,0,0.25)"};
  }

  // Same sequence the drawer's own sign-out button used before the avatar
  // card replaced it.
  async function handleCardSignOut(){
    closeAvatarCard();
    const sb=await getSupabaseClient();
    if(sb) await sb.auth.signOut();
    setUser(null);
  }

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
    // Ids are assigned inside the updater below, against the array being
    // built, so these carry none of their own.
    const welcomeTasks:Omit<Task,"id">[]=[];
    if(goals.includes("health")) welcomeTasks.push({title:"Start a daily exercise habit",category:"fitness",priority:"medium",type:"ongoing",date:"",time:"",recurring:"daily",notes:"",done:false,deleted:false,checklist:[]});
    if(goals.includes("study")) welcomeTasks.push({title:"Set a daily study goal",category:"study",priority:"medium",type:"ongoing",date:"",time:"",recurring:"daily",notes:"",done:false,deleted:false,checklist:[]});
    if(goals.includes("finance")) welcomeTasks.push({title:"Review my finances this week",category:"finance",priority:"medium",type:"milestone",date:"",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]});
    if(goals.includes("faith")) welcomeTasks.push({title:"Establish a daily prayer routine",category:"faith",priority:"medium",type:"ongoing",date:"",time:"",recurring:"daily",notes:"",done:false,deleted:false,checklist:[]});
    if(goals.includes("business")) welcomeTasks.push({title:"Define my top business priority this week",category:"business",priority:"high",type:"milestone",date:"",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]});
    if(goals.includes("work")) welcomeTasks.push({title:"Set this week's career goal",category:"career",priority:"medium",type:"milestone",date:"",time:"",recurring:"",notes:"",done:false,deleted:false,checklist:[]});
    if(welcomeTasks.length>0){
      // Appends. This used to replace the whole array, which was only ever
      // safe because docket-onboarded is supposed to stop the wizard running
      // twice — a guard standing between working code and silent data loss.
      setTasks(prev=>{
        const out=[...prev];
        for(const w of welcomeTasks) out.push({id:nextId(out),...w});
        return out;
      });
    }
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
      // direction is set on <html> (see the lang effect) so that it also
      // covers the auth gate, the spinner and the onboarding screen, which
      // render outside this wrapper. Deliberately not repeated here.
      fontFamily:"'Inter',sans-serif",color:C.navy,
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

      {/* Nav */}
      <nav style={{position:"relative",zIndex:10,display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:`${NAV_PAD}px ${NAV_PAD}px 14px`}}>
        {/* The avatar took the hamburger's slot when the drawer was deleted —
            it opens the avatar card below. It kept the hamburger's solid
            gradient and glow, which made it the one heavy chrome element left
            in a UI whose other icons are all see-through; the fallback state
            now matches the bar's inactive icons instead (transparent, C.muted,
            21px). A real avatar photo still gets the gradient and glow: the
            image covers the button, so the gradient only shows if it has
            transparency, and the glow frames the photo rather than sitting
            around nothing. */}
        <button onClick={toggleAvatarCard} className="sq-btn nav-btn" title="Account & settings"
          style={{width:AVATAR_BTN,height:AVATAR_BTN,overflow:"hidden",
            background:user?.avatar
              ?"linear-gradient(145deg,#6677E8 0%,#4C5FD5 45%,#2A3699 100%)"
              :"transparent",
            boxShadow:user?.avatar
              ?"0 8px 28px rgba(76,95,213,0.6), 0 3px 8px rgba(0,0,0,0.25)"
              :"none"}}>
          {user?.avatar
            ?<img src={user.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            :<i className="ti ti-user" style={{fontSize:21,color:C.muted}} aria-hidden="true"/>}
        </button>
        <div style={{textAlign:"center"}}>
          <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,
            fontSize:18,color:C.navy,letterSpacing:"-0.5px"}}>{t("appName")}</p>
          <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,
            color:C.muted,letterSpacing:"2px",textTransform:"uppercase",marginTop:2}}>
            {clientToday?clientToday.toLocaleDateString(locale,{weekday:"short",day:"numeric",month:"short"}):""}
          </p>
        </div>
        {/* Spacer matching the avatar's footprint — the settings button that
            used to sit here moved into the avatar card, and without something
            of equal width the space-between layout would pull the centred
            title off centre. */}
        <div className="nav-btn" style={{width:AVATAR_BTN,height:AVATAR_BTN,flexShrink:0}} aria-hidden="true"/>
      </nav>

      {/* Avatar card — replaces both the old slide-in drawer and the old
          settings panel. A floating card hung under the avatar that opened
          it, not an edge drawer: anchored top-left, capped at
          AVATAR_CARD_WIDTH so it fits a 393px phone, and scrolling
          internally when its rows outrun the viewport. Sits above the chat
          panel (60) but below modals (200), in the z-index slots the drawer
          used to hold. */}
      {avatarOpen&&(<>
        <div onClick={closeAvatarCard}
          style={{position:"fixed",inset:0,zIndex:70,background:"rgba(0,0,0,0.35)",
            opacity:avatarShown?1:0,transition:`opacity ${CARD_ANIM_MS}ms ease`}}/>
        {/* position:fixed opts out of the wrapper's `direction`, so the card
            has to be told which edge to hang from. The nav's avatar flips on
            its own — it's a flex item under direction:rtl — and without this
            the card stayed on the left, disconnected from the button that
            opened it. NAV_PAD, not a literal 20, so it lines up with that
            button on both sides. */}
        <div style={{position:"fixed",top:AVATAR_CARD_TOP,zIndex:71,
          ...(dir==="rtl"?{right:NAV_PAD}:{left:NAV_PAD}),
          width:`min(${AVATAR_CARD_WIDTH}px, calc(100vw - ${NAV_PAD*2}px))`,
          background:dark?"#1E2043":"#FFFFFF",
          borderRadius:16,border:`0.5px solid ${C.border}`,
          boxShadow:dark?"0 8px 32px rgba(0,0,0,0.5)":"0 8px 32px rgba(0,0,0,0.12)",
          // transform-origin has no logical keyword, so it needs the same
          // branch: the open animation must grow out of the corner nearest
          // the avatar, not away from it.
          overflow:"hidden",transformOrigin:dir==="rtl"?"top right":"top left",
          opacity:avatarShown?1:0,
          transform:avatarShown?"scale(1)":"scale(0.96)",
          pointerEvents:avatarShown?"auto":"none",
          transition:`opacity ${CARD_ANIM_MS}ms ease, transform ${CARD_ANIM_MS}ms ease`}}>
          {/* The card clips its own corners, so the scroll lives on an inner
              wrapper — the full row list runs past a short viewport. */}
          <div style={{maxHeight:`calc(100vh - ${AVATAR_CARD_TOP+20}px)`,overflowY:"auto"}}>

            {/* Identity — the whole row is the way into the profile/login
                modal, which is where account management lives. */}
            <button onClick={()=>cardOpenModal("login")}
              style={{...cardRowStyle,padding:"14px",gap:10}}>
              <div style={{width:38,height:38,borderRadius:"50%",flexShrink:0,overflow:"hidden",
                background:"linear-gradient(145deg,#6677E8,#4C5FD5)",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                {user?.avatar
                  ?<img src={user.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<i className="ti ti-user" style={{fontSize:18,color:"white"}} aria-hidden="true"/>}
              </div>
              {/* <span>s, not <p>s — a button's content model is phrasing
                  content only, and this whole row is the button. */}
              <div style={{flex:1,minWidth:0}}>
                {user?(<>
                  <span style={{display:"block",fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
                    fontSize:13.5,color:C.navy,overflow:"hidden",textOverflow:"ellipsis",
                    whiteSpace:"nowrap"}}>{user.name}</span>
                  <span style={{display:"block",fontSize:11,color:C.muted,overflow:"hidden",
                    textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</span>
                </>):(
                  <span style={{display:"block",fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
                    fontSize:13.5,color:C.navy}}>Sign in / Create account</span>
                )}
              </div>
              <i className="ti ti-chevron-right" style={{fontSize:15,flexShrink:0,color:C.muted2}} aria-hidden="true"/>
            </button>

            {/* Sync state, not a sync error. Deliberately a passive row here
                rather than a toast: the two sync effects fire on every task and
                routine change, so a per-failure notification would storm the
                moment anyone goes offline, and it is not something the user can
                act on. Nothing is lost when it shows — the work is in local
                storage and the next edit retries — so the wording says "not
                backed up yet", not "failed to save". */}
            {syncFailed&&(<>
              <div style={{height:1,background:C.border}}/>
              <div style={{...cardRowStyle,cursor:"default",alignItems:"flex-start"}}>
                <i className="ti ti-cloud-off" style={{...cardIconStyle,color:C.urgent,marginTop:2}} aria-hidden="true"/>
                <span style={{flex:1,fontSize:11,lineHeight:1.45,color:C.muted}}>{t("syncBehind")}</span>
              </div>
            </>)}

            <div style={{height:1,background:C.border}}/>
            <button onClick={()=>cardGoToView("archive")} style={cardRowStyle}>
              <i className="ti ti-archive" style={cardIconStyle} aria-hidden="true"/>
              {t("archive")}
            </button>
            <button onClick={()=>cardOpenModal("subscription")} style={cardRowStyle}>
              <i className="ti ti-crown" style={cardIconStyle} aria-hidden="true"/>
              {t("subscription")}
            </button>

            <div style={{height:1,background:C.border}}/>
            {/* Settings rows — same state and handlers the deleted settings
                panel drove, just laid out compactly. */}
            <div style={{...cardRowStyle,cursor:"default"}}>
              <i className="ti ti-moon" style={cardIconStyle} aria-hidden="true"/>
              <span style={{flex:1}}>{t("darkMode")}</span>
              <button onClick={()=>setDark(d=>!d)} style={cardSwitchStyle(dark)}
                title={dark?t("switchToLight"):t("switchToDark")}>
                <span style={cardKnobStyle(dark)}/>
              </button>
            </div>
            {/* Eleven languages don't fit as pills — the row wrapped to four
                lines and pushed everything below it off a phone screen. The
                list expands in flow rather than floating: the card clips its
                own corners and scrolls internally, so an absolutely positioned
                popover would be cut off at the card's edge. */}
            <button onClick={()=>setLangMenuOpen(o=>!o)}
              style={cardRowStyle} aria-expanded={langMenuOpen}>
              <i className="ti ti-world" style={cardIconStyle} aria-hidden="true"/>
              <span style={{flex:1}}>{t("language")}</span>
              <span style={{fontSize:12.5,color:C.muted,fontFamily:langFont(lang),
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:110}}>
                {LANG_LABELS[lang]}
              </span>
              <i className="ti ti-chevron-down" aria-hidden="true"
                style={{fontSize:14,flexShrink:0,color:C.muted2,
                  transform:langMenuOpen?"rotate(180deg)":"rotate(0deg)",
                  transition:"transform 0.2s ease"}}/>
            </button>
            {langMenuOpen&&(
              // Capped and scrollable so the list can't push the card's own
              // rows out of reach on a short screen.
              <div role="listbox" aria-label={t("language")}
                style={{maxHeight:244,overflowY:"auto",
                  background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.025)",
                  borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}>
                {LANG_ORDER.map(code=>{
                  const active=lang===code;
                  return(
                    <button key={code} role="option" aria-selected={active}
                      onClick={()=>{ setLang(code); setLangMenuOpen(false); }}
                      // Indented to sit under the row's label, not its icon.
                      // Logical padding so the indent flips with an RTL locale.
                      style={{...cardRowStyle,padding:"9px 14px",paddingInlineStart:41,
                        background:active?(dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.05)"):"transparent",
                        color:active?C.primary:C.navy,fontWeight:active?700:500}}>
                      <span style={{flex:1,minWidth:0,fontFamily:langFont(code)}}>
                        {LANG_LABELS[code]}
                        {LANG_NAMES_EN[code]!==LANG_LABELS[code]&&(
                          <span style={{fontSize:11,color:C.muted2,fontFamily:"inherit",marginInlineStart:7}}>
                            {LANG_NAMES_EN[code]}
                          </span>
                        )}
                      </span>
                      {active&&<i className="ti ti-check" aria-hidden="true"
                        style={{fontSize:14,flexShrink:0,color:C.primary}}/>}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{...cardRowStyle,cursor:"default",alignItems:"flex-start"}}>
              <i className="ti ti-building-mosque" style={{...cardIconStyle,marginTop:2}} aria-hidden="true"/>
              <div style={{flex:1,minWidth:0}}>
                <p>{t("prayerSetting")}</p>
                {/* One compact status line — this is the only place a denied
                    location permission ever surfaces. */}
                {prayerStatus!=="idle"&&(
                  <p style={{fontSize:10.5,marginTop:3,lineHeight:1.45,
                    color:prayerStatus==="done"?C.sage
                      :prayerStatus==="loading"?C.accent:C.urgent}}>
                    {prayerStatus==="loading"?t("prayerLoading")
                      :prayerStatus==="done"?t("prayerDone")
                      :prayerStatus==="denied"?t("prayerDenied")
                      :prayerStatus==="timeout"?t("prayerTimeout")
                      :prayerStatus==="unavailable"?t("prayerUnavailable")
                      :t("prayerService")}
                  </p>
                )}
              </div>
              <button onClick={togglePrayer} style={cardSwitchStyle(prayerEnabled)} title={t("prayerSetting")}>
                <span style={cardKnobStyle(prayerEnabled)}/>
              </button>
            </div>
            <div style={{...cardRowStyle,cursor:"default"}}>
              <i className="ti ti-bell" style={cardIconStyle} aria-hidden="true"/>
              <span style={{flex:1}}>{t("notifSetting")}</span>
              <button onClick={toggleNotifications} style={cardSwitchStyle(notifEnabled)} title={t("notifSetting")}>
                <span style={cardKnobStyle(notifEnabled)}/>
              </button>
            </div>

            <div style={{height:1,background:C.border}}/>
            <button onClick={()=>cardOpenModal("widgets")} style={cardRowStyle}>
              <i className="ti ti-layout-grid" style={cardIconStyle} aria-hidden="true"/>
              {t("widgetsShortcuts")}
            </button>
            <button onClick={()=>cardOpenModal("siri")} style={cardRowStyle}>
              <i className="ti ti-microphone" style={cardIconStyle} aria-hidden="true"/>
              {t("siriShortcuts")}
            </button>

            <div style={{height:1,background:C.border}}/>
            <button onClick={()=>cardOpenModal("help")} style={cardRowStyle}>
              <i className="ti ti-help-circle" style={cardIconStyle} aria-hidden="true"/>
              {t("helpFeedback")}
            </button>
            <button onClick={()=>cardOpenModal("privacy")} style={cardRowStyle}>
              <i className="ti ti-shield-lock" style={cardIconStyle} aria-hidden="true"/>
              {t("privacyPermissions")}
            </button>
            <button onClick={()=>cardOpenModal("terms")} style={cardRowStyle}>
              <i className="ti ti-file-description" style={cardIconStyle} aria-hidden="true"/>
              {t("termsConditions")}
            </button>

            {/* Only a real account can be signed out of — same gating the
                drawer used. */}
            {user?.id&&(<>
              <div style={{height:1,background:C.border}}/>
              {/* The one sign-out in the app. There used to be a second at the
                  bottom of the profile modal, one tap deeper, which is a poor
                  place for an action this consequential to hide. Its label was
                  the better of the two — naming the account matters to anyone
                  who has had more than one — so that came here with it. */}
              <button onClick={handleCardSignOut}
                style={{...cardRowStyle,color:C.urgent,alignItems:"flex-start"}}>
                <i className="ti ti-logout" style={{...cardIconStyle,color:C.urgent,marginTop:2}} aria-hidden="true"/>
                <span style={{flex:1,minWidth:0,wordBreak:"break-word"}}>
                  {tf("signOutOf",{email:user.email},t)}
                </span>
              </button>
            </>)}
          </div>
        </div>
      </>)}

      {/* Content */}
      <main style={{position:"relative",zIndex:10,maxWidth:1100,margin:"0 auto",padding:"0 20px 100px"}}>

        {/* ── DAILY ─────────────────────────────────────────────────────── */}
        {currentView==="daily"&&(
          <div>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
              fontSize:24,color:C.navy,marginBottom:10,letterSpacing:"-0.5px"}}>{t("daily")}</p>
            <LiveClock dark={dark} C={C}/>
            {/* Week day picker with arrows */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              {/* Earlier dates. The flex row reverses under RTL, so this
                  button lands on the right — the side earlier dates scroll in
                  from — but scrollBy takes a PHYSICAL delta, so the sign has
                  to flip to keep meaning "back in time" rather than forward.
                  The glyph flips with it, or it points away from the
                  direction the strip actually moves. */}
              <button onClick={()=>{
                  const el=document.getElementById("day-picker-scroll");
                  if(el) el.scrollBy({left:rtl?180:-180,behavior:"smooth"});
                }}
                style={{width:32,height:32,borderRadius:9,flexShrink:0,border:`1px solid ${C.border}`,
                  background:C.surface,cursor:"pointer",color:C.navy,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                <i className={`ti ti-chevron-${rtl?"right":"left"}`} style={{fontSize:15}} aria-hidden="true"/>
              </button>
              <div id="day-picker-scroll" ref={attachDayScrollEl}
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
                        {/* No .slice(0,3): Intl's short form is already the
                            locale's abbreviation, and truncating it cuts
                            Arabic mid-word and can split a Devanagari
                            grapheme cluster. Sunday-first array, indexed by
                            the raw getDay() value. */}
                        {dowNames(locale,0)[day.dow]}
                      </p>
                      <p style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,
                        fontSize:16,marginTop:2,
                        color:active?"#FFFFFF":isToday?C.primary:dark?"rgba(255,255,255,0.85)":C.navy}}>
                        {localeNum(day.dayNum,locale)}
                      </p>
                      {isToday&&!active&&<div style={{width:4,height:4,borderRadius:"50%",
                        background:C.primary,margin:"2px auto 0"}}/>}
                      {hasConflict&&<span style={{position:"absolute",top:4,right:5,
                        width:5,height:5,borderRadius:"50%",background:C.urgent}}/>}
                    </button>
                  );
                })}
              </div>
              {/* Later dates — the mirror of the button above. */}
              <button onClick={()=>{
                  const el=document.getElementById("day-picker-scroll");
                  if(el) el.scrollBy({left:rtl?-180:180,behavior:"smooth"});
                }}
                style={{width:32,height:32,borderRadius:9,flexShrink:0,border:`1px solid ${C.border}`,
                  background:C.surface,cursor:"pointer",color:C.navy,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                <i className={`ti ti-chevron-${rtl?"left":"right"}`} style={{fontSize:15}} aria-hidden="true"/>
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
              {/* Offset from the START edge, which is the right one in RTL —
                  a physical `left` here is what put the thumb outside its
                  track. dayScrollMetrics.left is already start-relative. */}
              <div style={{position:"absolute",height:5,borderRadius:3,background:C.primary,
                opacity:0.85,pointerEvents:"none",
                [rtl?"right":"left"]:`${dayScrollMetrics.max>0?(dayScrollMetrics.left/dayScrollMetrics.max)*(1-Math.max(0.06,Math.min(1,dayScrollMetrics.client/(dayScrollMetrics.client+dayScrollMetrics.max))))*100:0}%`,
                width:`${Math.max(0.06,Math.min(1,dayScrollMetrics.client/(dayScrollMetrics.client+dayScrollMetrics.max)))*100}%`}}/>
            </div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,
              color:C.muted,marginBottom:10}}>
              {viewedDay?.label||(clientToday?clientToday.toLocaleDateString(locale,{weekday:"long",day:"numeric",month:"long"}):"")}
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
                fontFamily:"'Space Grotesk',sans-serif",fontWeight:600}}>{t("nothingToday")}</p>}
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
                  fontFamily:"'Space Grotesk',sans-serif",fontWeight:600}}>{t("nothingHere")}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── CALENDAR ────────────────────────────────────────────────── */}
        {currentView==="calendar"&&(
          <CalendarView tasks={tasks} routines={routines} C={C}/>
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

      {/* The floating FAB used to live here — it's now the bottom nav bar's
          rightmost item (see the bar's render inside Chatbot), so there's
          no separate floating add-task button any more. */}
      <Chatbot tasks={tasks} routines={routines} onAction={handleAiActions} user={user} isPro={isPro} tier={subTier}
        currentView={currentView} setCurrentView={setCurrentView}
        onAddTask={()=>setIsAddingTask(true)}/>

      {isAddingTask&&<TaskModal onClose={()=>setIsAddingTask(false)} onSave={addTask}/>}
      {editingTask&&<TaskModal initial={editingTask} onClose={()=>setEditingTask(null)}
        onSave={data=>{updateTask(editingTask.id,data);setEditingTask(null);}}/>}
    </div>
      {activeModal&&<InfoModal modal={activeModal} onClose={()=>setActiveModal(null)} dark={dark} user={user} onUserChange={setUser} onNavigate={setActiveModal} isPro={isPro} subPeriodEnd={subPeriodEnd} subTier={subTier}/>}
    </AppCtx.Provider>
  );
}