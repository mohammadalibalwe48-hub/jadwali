import { DAYS_ORDER, type DayOfWeek, type SessionType } from './types.js';

export type Locale = 'ar' | 'en';
const englishDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function displayDay(day: DayOfWeek, locale: Locale, short = false) {
  if (locale === 'ar') return day;
  const name = englishDays[DAYS_ORDER.indexOf(day)] ?? day;
  return short ? name.slice(0, 3) : name;
}

export function displayType(type: SessionType, locale: Locale) {
  return locale === 'ar' ? type : type === 'عملي' ? 'Lab' : 'Lecture';
}

const englishLocations: Readonly<Record<string, string>> = {
  'المدرّج': 'Auditorium', 'القبو': 'Basement', 'الأرضي': 'Ground', 'الأول': 'First', 'الثاني': 'Second',
  'الثالث': 'Third', 'الرابع': 'Fourth', 'الخامس': 'Fifth', 'غير محدّد': 'Unassigned',
};

export function displayLocation(value: string, locale: Locale) {
  return locale === 'en' ? englishLocations[value] ?? value : value;
}

// Existing Arabic copy is the fallback and remains the canonical storage language.
export const english: Readonly<Record<string, string>> = {
  'تحقّق من رمز الاسترداد وألصقه كاملاً.': 'Check the recovery code and paste it in full.',
  'لم نجد نسخة بهذا الرمز.': 'No backup was found for that code.',
  'تغيّرت النسخة على جهاز آخر. زامن الآن ثم حاول حذفها مجدداً.': 'The backup changed on another device. Sync now and try deleting it again.',
  'هذه النسخة أكبر من حدّ المزامنة.': 'This backup exceeds the sync limit.',
  'تعذّرت المزامنة حالياً. حاول مجدداً.': 'Couldn’t sync right now. Try again.',
  'تجاوز إلى الجدول': 'Skip to timetable',
  'جدول المحاضرات': 'Class schedule',
  'إضافة محاضرة': 'Add class',
  'استيراد صورة': 'Import images',
  'إغلاق التنبيه': 'Dismiss message',
  'استعادة جدول من جهاز آخر': 'Restore from another device',
  'المحاضرات المحدّدة موجودة مسبقاً في الجدول.': 'The selected classes are already in your timetable.',
  'تعذّرت قراءة الصور. جرّب مرة أخرى.': 'We couldn’t read the images. Try again.',
  'أرفق لقطة تظهر أسماء ورموز المقررات لإكمال جدول البوابة.': 'Add a screenshot showing the course names and codes to complete this timetable.',
  'تجاوز النموذج بعض الحقول غير المقروءة. جرّب صورة أوضح.': 'Some fields couldn’t be read. Try a clearer image.',
  'تعذّر تحديد أي صور تعود إلى الجدول نفسه. اختر صور جدول واحد.': 'We couldn’t match these screenshots. Choose images from the same timetable.',
  'بعض الخلايا مقصوصة. أضف لقطة تغطي الأيام والأوقات الناقصة.': 'Some cells are cropped. Add a screenshot with the missing days and times.',
  'تعذّر فتح إحدى الصور. جرّب صورة بصيغة JPG أو PNG.': 'An image couldn’t be opened. Try a JPG or PNG.',
  'حجم الصور كبير. اختر عدداً أقل منها.': 'These images are too large. Try selecting fewer images.',
  'حاضر': 'Present', 'متأخر': 'Late', 'غائب': 'Absent',
  'متابعة الحضور': 'Attendance', 'تاريخ المحاضرات': 'Class date',
  'لا توجد محاضرات في هذا اليوم.': 'There are no classes on this day.',
  'اختر اليوم أو تاريخاً سابقاً.': 'Choose today or an earlier date.',
  'الغياب حسب المادة': 'Absences by course',
  'حدّد الغيابات المسموحة لكل مادة. يُسجّل التأخّر بشكل منفصل.': 'Set an absence limit for each course. Late arrivals are tracked separately.',
  'حضور ·': 'present ·', 'تأخّر ·': 'late ·', 'غياب': 'absent',
  'الغيابات المتبقية': 'Absences remaining', 'حدّ الغياب': 'Absence limit',
  'النسخ الاحتياطي والمزامنة': 'Backup and sync',
  'جدولك وحضورك وإعدادات الطوابق تُشفّر قبل رفعها. لربط هاتف أو كمبيوتر، افتح جدولي عليه وأدخل رمز الاسترداد.': 'Your timetable, attendance and floor rules are encrypted before upload. To link a device, open Jadwali there and enter your recovery code.',
  'إخفاء الرمز': 'Hide code', 'إظهار رمز الاسترداد': 'Show recovery code', 'رمزك للاسترداد': 'Your recovery code',
  'تم النسخ': 'Copied', 'نسخ الرمز': 'Copy code',
  'احتفظ بالرمز في مكان آمن. يحتاج إليه أي جهاز يفتح النسخة، ولا يمكن استعادته إذا فقدته.': 'Keep your code somewhere safe. Any device opening the backup needs it, and it can’t be recovered if lost.',
  'تغيّرت البيانات على هذا الجهاز وفي النسخة السحابية. اختر النسخة التي تريد الاحتفاظ بها.': 'Data changed on this device and in the cloud. Choose the version to keep.',
  'الاحتفاظ ببيانات هذا الجهاز': 'Keep this device’s data', 'استخدام النسخة السحابية': 'Use cloud backup',
  'مزامنة الآن': 'Sync now', 'فصل هذا الجهاز': 'Disconnect device',
  'سيُحذف النسخ الاحتياطي السحابي ويتوقف رمز الاسترداد عن العمل. تبقى البيانات المحفوظة على أجهزتك.': 'The cloud backup will be deleted and its recovery code will stop working. Data saved on your devices will remain.',
  'حذف النسخة نهائياً': 'Delete backup permanently', 'إلغاء': 'Cancel', 'حذف النسخة السحابية': 'Delete cloud backup',
  'احفظ نسخة مشفّرة من جدولك وحضورك وإعدادات الطوابق، أو استعد نسخة أنشأتها على جهاز آخر.': 'Back up your timetable, attendance and floor rules, or restore a backup from another device.',
  'تفعيل المزامنة': 'Enable sync', 'رمز الاسترداد من جهاز آخر': 'Recovery code from another device',
  'أفهم أن الاستعادة ستستبدل الجدول والحضور وإعدادات الطوابق على هذا الجهاز.': 'I understand this will replace the timetable, attendance and floor rules on this device.',
  'ربط هذا الجهاز واستعادة النسخة': 'Link device and restore backup',
  'جارٍ مزامنة النسخة…': 'Syncing backup…', 'تمت المزامنة.': 'Backup synced.', 'أنت دون اتصال. بقيت تعديلاتك على هذا الجهاز.': 'You’re offline. Your changes are saved on this device.',
  'لا توجد محاضرات بأوقات صالحة ضمن هذه التواريخ.': 'There are no classes with valid times in this date range.',
  'تصدير إلى التقويم': 'Export to calendar', 'تُصدّر المحاضرات أسبوعياً بين التاريخين، بالتوقيت المحلي لتقويمك.': 'Classes repeat weekly between the dates below, in your calendar’s local time.',
  'بداية الفصل': 'Term starts', 'نهاية الفصل': 'Term ends', 'التذكير قبل المحاضرة': 'Reminder before class', 'بدون تذكير مرفق': 'No reminder', 'دقيقة': 'minutes',
  'اختر فترة مرتّبة تمتد حتى سنة واحدة.': 'Choose a valid date range of up to one year.', 'تنزيل ملف التقويم (.ics)': 'Download calendar (.ics)',
  'في تقويم Apple على Mac، افتح الملف وحدّد التقويم. على iPhone، يمكنك فتح الملف كمرفق في تطبيق البريد ثم إضافة المحاضرات. في Google Calendar على الكمبيوتر، اختر الإعدادات ثم الاستيراد والتصدير. في Outlook، اختر إضافة تقويم ثم التحميل من ملف. يمكنك ضبط التذكيرات من تطبيق التقويم بعد الاستيراد.': 'On Mac, open the file in Apple Calendar. On iPhone, open it as a Mail attachment. In Google Calendar, use Settings → Import & export. In Outlook, choose Add calendar → Upload from file. You can adjust reminders after importing.',
  'دليل رموز الطوابق': 'Room and floor rules', 'يُستخدم الرمز الأول للقاعة لتحديد طابقها تلقائياً.': 'The room prefix is used to assign its floor automatically.',
  'الطابق': 'Floor', 'الرمز': 'Code', 'الثالث': 'Third', 'إضافة قاعدة': 'Add rule', 'الافتراضي': 'Restore defaults', 'تطبيق': 'Apply',
  'تعذّر تجهيز الصورة. أعد المحاولة.': 'Couldn’t prepare the image. Try again.', 'تعذّرت المشاركة. نزّل الصورة ثم أرسلها من تطبيق الصور.': 'Couldn’t share the image. Download it and share it from your photos.',
  'مشاركة الجدول كصورة': 'Share timetable as an image', 'تنسيق الصورة': 'Image format',
  'خلفية شاشة القفل': 'Lock screen wallpaper', 'صورة للمشاركة': 'Shareable image',
  'تترك الخلفية مساحة لساعة شاشة القفل. احفظ الصورة واخترها من إعدادات الخلفية.': 'The wallpaper leaves space for the lock screen clock. Save it, then pick it in your wallpaper settings.',
  'معاينة صورة الجدول': 'Timetable image preview', 'السابق': 'Previous', 'صورة': 'Image', 'من': 'of',
  'التالي': 'Next', 'مشاركة الصورة': 'Share image', 'تنزيل PNG': 'Download PNG', 'جارٍ تجهيز الصورة…': 'Preparing image…',
  'مراجعة استيراد الجدول': 'Review imported classes', 'إغلاق المراجعة': 'Close review', 'جاري قراءة الصور…': 'Reading images…',
  'إضافة المحدّد': 'Add selected classes', 'لم تظهر محاضرات كاملة. أضف صوراً أوضح للجدول.': 'No complete classes were found. Add a clearer timetable image.',
  'أضف لقطات لهذا الجدول': 'Add screenshots for this timetable', 'أعد القراءة': 'Retry scan',
  'تثبيت جدولي': 'Install Jadwali', 'جدولي مثبت على هذا الجهاز.': 'Jadwali is installed on this device.',
  'تثبيت التطبيق': 'Install app', 'Safari على iPhone': 'Safari on iPhone', 'اضغط مشاركة': 'Tap Share', 'ثم اختر «إضافة إلى الشاشة الرئيسية».': 'then choose Add to Home Screen.',
  'افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».': 'Open the browser menu and choose Install app or Add to Home Screen.',
  'جدولك المحفوظ متاح دون إنترنت في هذا المتصفح. افتح النسخة المثبّتة مرة وأنت متصل لتجهيزها.': 'Your saved timetable is available offline in this browser. Open the installed app once while online to set it up.',
  'افتح جدولي مرة وأنت متصل حتى يصبح جدولك جاهزاً للعمل دون إنترنت.': 'Open Jadwali while online to make your timetable available offline.',
  'اليوم': 'Today', 'غداً': 'Tomorrow', 'المحاضرة القادمة': 'Next class', 'تبدأ الآن': 'Starting now', 'القاعة': 'Room',
  'تصدير PDF': 'Export PDF', 'إغلاق التصدير': 'Close export', 'تنزيل PDF': 'Download PDF', 'فتح المعاينة': 'Open preview',
  'الجدول الأسبوعي': 'Weekly timetable', 'طريقة عرض المحاضرات': 'Timetable view', 'قائمة': 'List', 'جدول': 'Table', 'أيام الجدول': 'Timetable days', 'الأسبوع': 'Week',
  'لا توجد محاضرات يوم': 'No classes on', 'الوقت': 'Time', 'المحاضرة': 'Class',
  'تعديل المحاضرة': 'Edit class', 'محاضرة جديدة': 'New class', 'حذف': 'Delete', 'حفظ': 'Save', 'المادة': 'Course',
  'مثلاً: تحليل رياضي 1': 'e.g. Calculus I', 'البداية': 'Start', 'ساعة البداية': 'Start hour', 'دقيقة البداية': 'Start minute',
  'النهاية': 'End', 'ساعة النهاية': 'End hour', 'دقيقة النهاية': 'End minute', 'النوع': 'Type',
  'B-06 أو المدرّج': 'B-06 or Auditorium', 'تلقائي': 'Auto', 'تعديل يدوي': 'Enter manually', 'يُحدّد من القاعة': 'Assigned from room',
  'الإعدادات': 'Settings', 'يُحفظ جدولك في هذا المتصفح. عند استيراد صورة، تُرسل للقراءة. يمكنك تفعيل المزامنة لربط أجهزتك بنسخة مشفّرة.': 'Your timetable is stored in this browser. Imported images are sent for scanning. Enable sync to link devices with an encrypted backup.',
  'سيتم مسح كل المحاضرات من جدولك الحالي. هل تريد المتابعة؟': 'This will clear all classes from your current timetable. Continue?', 'تأكيد مسح الجدول': 'Confirm clearing timetable',
  'مسح الجدول الحالي': 'Clear timetable', 'الجدول الحالي فارغ.': 'Your timetable is empty.',
  'استراحة ·': 'Break ·', 'جارية الآن': 'In progress', '· الطابق': '· Floor', 'جدول اليوم': 'Today’s classes',
  'انتهت محاضرات اليوم.': 'Today’s classes are finished.', 'لا توجد محاضرات اليوم.': 'No classes today.', 'المحاضرات المنتهية': 'Completed classes',
  'إغلاق': 'Close', 'جدول للطباعة أو المشاركة': 'A printable or shareable timetable', 'التقويم': 'Calendar',
  'مواعيد الفصل بصيغة ICS': 'Term schedule as an ICS file', 'مشاركة صورة': 'Share image', 'صورة للواتساب أو شاشة القفل': 'An image or lock screen wallpaper',
  'الطوابق': 'Floor rules', 'ربط رموز القاعات بالطوابق': 'Assign floors by room prefix', 'نسخ ومزامنة': 'Backup and sync',
  'ربط أجهزتك بنسخة مشفّرة': 'Sync devices with an encrypted backup', 'فتح الجدول من الشاشة الرئيسية': 'Open the timetable from your home screen',
  'إدارة بيانات جدولك': 'Manage your timetable data', 'جدولي، الصفحة الرئيسية': 'Jadwali home', 'التنقّل الرئيسي': 'Main navigation',
  'الجدول': 'Timetable', 'الحضور': 'Attendance', 'التصدير': 'Export', 'المزيد': 'More', 'تصدير الجدول': 'Export timetable',
  'أضف محاضرة إلى جدولك لتتمكّن من تصديره.': 'Add a class to your timetable before exporting.',
};
