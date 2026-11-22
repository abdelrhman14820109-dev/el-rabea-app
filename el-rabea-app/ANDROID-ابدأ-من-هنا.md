# تطبيق مركز الربيع — أندرويد (من غير Android Studio)

GitHub هيبني ملف الـ APK بدالك، وإنت تنزّله وتنصّبه على موبايلك.

## الخطوات

**1) ملف Firebase**
Firebase Console → ⚙️ Project settings → Your apps → تطبيق الأندرويد (`com.mycompany.elrabea`) → **Download google-services.json**.
حطه في فولدر المشروع **جنب `package.json`** (مش جوه أي فولدر).

**2) ارفع المشروع على GitHub**
- اعمل Repository جديد (خليه **Private**).
- **Add file → Upload files** واسحب كل محتويات الفولدر (`www` و`assets` و`functions` و`package.json` و`capacitor.config.json` و`google-services.json` وفولدر `.github`).
- لو فولدر `.github` ماظهرش في الرفع: **Add file → Create new file**، اكتب الاسم `.github/workflows/android.yml` والصق محتوى الملف.

**3) ابنِ الـ APK**
تبويب **Actions** → **Build Android APK** → **Run workflow**. استنى حوالي 8–12 دقيقة.
لما يبقى أخضر ✅ افتح التشغيل ونزّل **el-rabea-apk** من آخر الصفحة (Artifacts)، فك الضغط.

**4) نصّب على الموبايل**
ابعت `app-debug.apk` للموبايل وافتحه (لو طلب، فعّل "التثبيت من مصادر غير معروفة").
أول ما تفتح التطبيق: سجّل الدخول ووافق على **الإشعارات**.

## الإشعارات
- بعد ما التطبيق يتفتح، بيجدول تنبيه **قبل الجلسة بساعة** و**وقت الجلسة**، ومن غير سيرفر.
- غيّر التوقيت من `REMINDER_MINUTES_BEFORE` في `www/native.js` (الصفر = وقت الجلسة).
- لو موعد الجلسة اتغيّر والتطبيق مقفول، التنبيه الجديد مش هيتجدول غير لما التطبيق يتفتح. عشان يوصل إشعار حتى والتطبيق مقفول، شوف قسم Cloud Functions في `README-AR.md` (محتاج Blaze).

## ملاحظات
- ده نسخة **Debug** للتجربة والتوزيع المباشر. للنشر على Google Play محتاجين نسخة موقّعة (Release)، وأجهزها لك بعدين.
- لو التذكير مجاش: لازم `appointmentDay` و`sessionTime` يكونوا بصيغة مفهومة (زي `الأحد` + `5:30 م`، أو `25/11/2026`).
- قواعد Firestore: لو في test mode هتقفل بعد 30 يوم من إنشائها.
