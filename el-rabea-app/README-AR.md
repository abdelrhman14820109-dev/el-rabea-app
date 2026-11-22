# تطبيق مركز الربيع — أندرويد + آيفون

> **لو عايز أندرويد بس وأسهل طريقة:** اقرأ `ANDROID-ابدأ-من-هنا.md` (البناء بيتم على GitHub من غير Android Studio).

المشروع ده هو نفس صفحات الموقع بتاعك (`www/`) متلفّفة بـ **Capacitor** عشان تتحوّل لتطبيق حقيقي، مع إشعارات الجلسات.

## اللي اتغيّر في الكود
| الملف | التعديل |
|---|---|
| `www/index.html` | شلت `firebase-messaging` بتاع الويب (كان هيكسر التسجيل جوه التطبيق) وبدّلته بتسجيل إشعارات التطبيق |
| `www/index-home.html` | الموعد بقى بيتحدّث لحظيًا + بيتجدول تنبيه على التليفون + تسجيل الخروج بيوقف الإشعارات |
| `www/native.js` (جديد) | إذن الإشعارات، حفظ `fcmToken`، وجدولة التنبيهات |
| `www/session-parser.js` (جديد) | بيقرأ `appointmentDay` + `sessionTime` بأي شكل شائع (عربي/إنجليزي، ص/م، اسم اليوم أو تاريخ) |
| `www/app.css` (جديد) | مساحات آمنة للنوتش |
| `functions/` | اختياري: إشعار فوري لما الموعد يتغيّر + تذكير من السيرفر |

## الإشعارات شغالة إزاي
1. **تذكير على التليفون (مجاني، من غير سيرفر):** أول ما ولي الأمر يفتح التطبيق، بيجدول تنبيه **قبل الجلسة بساعة** و**وقت الجلسة**. تغيّره من `REMINDER_MINUTES_BEFORE` في `www/native.js`.
2. **إشعار من السيرفر (اختياري، محتاج Blaze):** لما السكرتارية تغيّر الموعد، ولي الأمر ييجيله إشعار حتى لو التطبيق مقفول.

> تنبيه: التذكير المحلي بيتجدول لما التطبيق يتفتح. لو عايز يضمن 100% حتى لو ولي الأمر مفتحش التطبيق بعد تغيير الموعد، فعّل الـ Functions (الخطوة 7).

---

## المتطلبات
- **Node.js** (آخر LTS) من nodejs.org
- **أندرويد:** Android Studio
- **آيفون:** جهاز **Mac** + Xcode + حساب Apple Developer (99$ في السنة). مفيش طريقة لبناء تطبيق آيفون من ويندوز/لينكس.

## 1) تثبيت Capacitor
افتح Terminal جوه فولدر المشروع:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/local-notifications @capacitor-firebase/messaging firebase
npm install -D @capacitor/assets
npx cap add android
npx cap add ios        # على الـ Mac بس
```
لو ظهر خطأ إن نسخة البلجن مش متوافقة مع Capacitor، ثبّت نسخة البلجن اللي رقمها الكبير زي رقم `@capacitor/core` (شوف `npm ls @capacitor/core`).

## 2) أيقونة وشاشة بداية
الأيقونة مصنوعة من لوجو المركز وموجودة في `assets/`. شغّل:
```bash
npx capacitor-assets generate
```

## 3) أندرويد
1. من Firebase Console → إعدادات المشروع → تطبيقك الأندرويد (`com.mycompany.elrabea`) → حمّل **google-services.json** وحطه في `android/app/`.
2. أضف الـ Google Services plugin لو مش مضاف: اتبع قسم Android في https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/messaging (غالبًا `apply plugin: 'com.google.gms.google-services'` في `android/app/build.gradle`).
3. شغّل:
```bash
npx cap sync android
npx cap open android
```
ومن Android Studio: **Run ▶** على موبايل أو محاكي. للنشر على Google Play: Build → Generate Signed Bundle (AAB).

## 4) آيفون (على Mac)
1. في Firebase Console أضف تطبيق **iOS** بنفس الـ Bundle ID `com.mycompany.elrabea` وحمّل **GoogleService-Info.plist**، وضيفه لمشروع Xcode (داخل `App/App`).
2. في Apple Developer اعمل **APNs Auth Key (.p8)** وارفعه في Firebase → Project settings → Cloud Messaging → Apple app configuration.
3. في Xcode: Target **App** → Signing & Capabilities → أضف **Push Notifications** و **Background Modes → Remote notifications**.
4. عدّل `AppDelegate.swift` حسب قسم iOS في README بتاع بلجن `@capacitor-firebase/messaging` (سطور قليلة: `FirebaseApp.configure()` + تمرير أحداث الـ token).
5. شغّل:
```bash
npx cap sync ios
npx cap open ios
```
واختار جهازك وRun. للنشر: Product → Archive → TestFlight / App Store.

> الإشعارات على آيفون **مبتشتغلش على المحاكي** — لازم جهاز حقيقي.

## 5) اختبار الإشعارات
- التذكير المحلي: من لوحة السكرتارية خلّي موعد الجلسة بعد 5–10 دقايق، وافتح التطبيق مرة، وقفله.
- من Firebase Console → Messaging → New campaign → Send test message وحط الـ `fcmToken` من مستند المريض.
- لو التذكير مجاش، افتح الكونسول ولاحظ رسالة `could not read session date/time` — معناها شكل `appointmentDay`/`sessionTime` مش مفهوم. الأضمن إن السكرتارية تحفظ كمان حقل `sessionAt` (Timestamp) وساعتها هو اللي يتستخدم.

## 6) قواعد Firestore (مهم قبل النشر)
- قواعد "test mode" **بتنتهي بعد 30 يوم** من إنشاء القاعدة، وساعتها التطبيق هيقفل فجأة.
- كمان بيانات الأطفال لازم تتحمى: أي حد معاه الـ `apiKey` (ظاهر في الكود) يقدر يقرأ/يعدّل `patients` لو القواعد مفتوحة. أفضل حل: Firebase Authentication (ولو برقم التليفون) + قواعد تسمح لكل ولي أمر بمستنده بس. أقدر أساعدك فيها بعد ما التطبيق يشتغل.

## 7) (اختياري) Cloud Functions
محتاج خطة **Blaze** (فيها حصة مجانية كبيرة، لكن لازم كارت).
```bash
npm install -g firebase-tools
firebase login
firebase use el-rabea
cd functions && npm init -y && npm install firebase-admin firebase-functions && cd ..
firebase deploy --only functions
```
- غيّر `REGION` في `functions/index.js` لنفس مكان Firestore.
- لو هتستخدم تذكير السيرفر: خلّي `LOCAL_REMINDERS: false` في `www/native.js` (وإلا هتوصل إشعارات مكررة).

## 8) النشر في المتاجر
- **Google Play:** حساب مطوّر (25$ مرة واحدة) + AAB موقّع.
- **App Store:** حساب 99$/سنة + رابط **سياسة الخصوصية** (عندك `policies.html` — لازم تتنشر على رابط عام) + شرح استخدام بيانات الأطفال.
