# جدولي (Jadwali)

منظّم جدول جامعي للموبايل. يقرأ نموذج Qwen 3.7 Flash صور الجداول ولقطات الشاشة، ويتيح مراجعة المحاضرات قبل حفظها. يدعم التطبيق أيضاً إضافة المحاضرات يدوياً وتحديد طوابق القاعات وتصدير الجدول إلى PDF.

## استيراد الجداول

- اختر صورة أو عدة صور من الجدول نفسه. تُرسل الصور إلى Qwen عبر Vercel AI Gateway، وتظهر النتائج للمراجعة قبل إضافتها.
- لاستيراد جدول بوابة مقسّم أفقياً، اختر لقطة لأسماء المقررات ورموزها مع لقطات أعمدة الأيام والأوقات. اترك الصفوف الفارغة ظاهرة بالترتيب نفسه. يمكنك إكمال الدفعة من شاشة المراجعة باستخدام «أضف لقطات لهذا الجدول».

## تصدير الجدول

اختر «تصدير PDF» ثم «تنزيل PDF». على iPhone يمكنك أيضاً اختيار «فتح المعاينة»، ثم حفظ الملف من قائمة المشاركة في Safari. تظهر الجداول الطويلة على عدة صفحات A4.

## أدوات الجدول

- تعرض الصفحة المحاضرة القادمة ووقتها وقاعتها وطابقها. من «الحضور» يمكن تسجيل الحضور والتأخّر والغياب وتحديد الحدّ لكل مادة.
- من «التقويم» اختر بداية الفصل ونهايته ونزّل ملف `.ics` لاستيراده إلى تقويم Apple أو Google Calendar أو Outlook. ومن «مشاركة صورة» احفظ الجدول بصيغة PNG للمشاركة أو لخلفية شاشة القفل.
- من «تثبيت التطبيق» اتّبع تعليمات Safari أو Chrome. افتح التطبيق مرة أثناء الاتصال لتجهيز العمل دون إنترنت.
- من «نسخ ومزامنة» فعّل نسخة مشفّرة. احتفظ برمز الاسترداد واستخدمه لربط أجهزتك. للمزامنة على Vercel اربط المشروع بمخزن Blob خاص يوفّر `BLOB_READ_WRITE_TOKEN` أو `BLOB_STORE_ID` مع OIDC.

## إعداد المسح

اضبط `AI_GATEWAY_API_KEY` كمتغيّر حساس في بيئة الإنتاج لمشروع Vercel، ثم انشر المشروع. يستخدم الخادم هذا المفتاح لجميع عمليات قراءة الصور. للتطوير المحلي، مرّر المتغيّر في بيئة عملية `npm run dev`.

## الاختبارات

- `npm run test:student-tools` يختبر المحاضرة القادمة والتقويم والحضور وتشفير النسخ الاحتياطية.
- `npm run test:vision` يختبر واجهة المسح بإجابات Qwen اختبارية.
- `npm run test:import` يختبر رفع الصور والمراجعة وإعادة المحاولة في Chromium باستخدام استجابات اختبارية. شغّل `npm run dev` أولاً. يمكنك ضبط `CHROMIUM_PATH` و`JADWALI_TEST_URL` عند الحاجة.
- `npm run test:pdf` يختبر التنزيل والمعاينة وتوزيع الجداول الطويلة على الصفحات. شغّل خادم التطوير أولاً وثبّت أدوات Poppler.

## Redesign architecture and verification

Jadwali runs as one client-rendered React 19 and TypeScript workspace built with Vite and styled with shared CSS tokens and Tailwind utilities. Its two main states are the image-import home screen and a populated workspace with Today, weekly agenda, and table views. The shared dialog system serves the upload and scan review, class editor, attendance, floor rules, settings, install flow, backup and sync, and PDF, image, and calendar exports.

The previous interface started scanning as soon as an image was chosen and supported Arabic-only navigation. Upload now stages files for review before scanning, with separate thumbnail, camera, processing, and result states. The Arabic and English UI uses localized labels and direction while retaining the existing timetable data format. Editable schedule rows and export previews share the same visual tokens. The SVG mark, wordmarks, and original timetable illustration live in `public/brand/` and `src/assets/`.

The browser prepares images and posts them to `/api/vision`. The existing Vercel AI Gateway integration returns sessions and issue codes, and the app retains its room normalization, deduplication, and split screenshot handling. PDF still uses the server-side Chromium renderer and supports both the native download and inline preview. Vercel Blob backup, local storage, and offline caching retain their existing roles.

Run `npm run dev` before the browser suites. `npm run build` type-checks and builds the production app. `npm run test:ui` verifies both text directions at nine viewport widths and exercises staging, editing, and export controls. The import and vision tests use deterministic OCR responses. The PDF suite checks parsed document content, fonts, and pagination.
