import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:file_selector/file_selector.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'schedule.dart';

const ink = Color(0xff32291f);
const clay = Color(0xff8b4c3b);
const oat = Color(0xfff5eee4);
const cream = Color(0xfffffdf8);
const line = Color(0xffe4d5c5);
const muted = Color(0xff695a4c);
const sage = Color(0xffe6eddf);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  runApp(Jadwali(preferences: preferences));
}

class Jadwali extends StatefulWidget {
  const Jadwali({super.key, required this.preferences});
  final SharedPreferences preferences;
  @override
  State<Jadwali> createState() => _JadwaliState();
}

class _JadwaliState extends State<Jadwali> with WidgetsBindingObserver {
  final navigator = GlobalKey<NavigatorState>();
  final messenger = GlobalKey<ScaffoldMessengerState>();
  final picker = ImagePicker();
  late final Timer ticker;
  late bool onboarding, arabic;
  late String scanner;
  late List<Lecture> lectures;
  late Map<String, String> attendance;
  DateTime now = DateTime.now();
  int intro = 0, tab = 0, filter = 0;
  bool scanning = false, table = false;

  String tr(String en, String ar) => arabic ? ar : en;
  String weekday(int day) => (arabic ? arabicDays : englishDays)[day - 1];
  BuildContext get contextForDialog => navigator.currentState!.overlay!.context;
  SharedPreferences get prefs => widget.preferences;

  @override
  void initState() {
    super.initState();
    onboarding = !(prefs.getBool('introduced') ?? false);
    arabic =
        prefs.getBool('arabic') ??
        WidgetsBinding.instance.platformDispatcher.locale.languageCode == 'ar';
    scanner =
        prefs.getString('scanner') ??
        const String.fromEnvironment('JADWALI_VISION_ORIGIN');
    lectures = [];
    attendance = {};
    try {
      final stored = jsonDecode(prefs.getString('schedule') ?? '{}') as Map;
      lectures = (stored['sessions'] as List? ?? [])
          .map(Lecture.read)
          .whereType<Lecture>()
          .toList();
      attendance = Map<String, String>.from(stored['attendance'] as Map? ?? {});
    } on Object {
      /* Keep an empty timetable if local data is unreadable. */
    }
    WidgetsBinding.instance.addObserver(this);
    ticker = Timer.periodic(const Duration(seconds: 15), (_) => refreshTime());
    WidgetsBinding.instance.addPostFrameCallback((_) => recoverPicker());
  }

  void refreshTime() {
    if (mounted) setState(() => now = DateTime.now());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) refreshTime();
  }

  @override
  void dispose() {
    ticker.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Map<String, Object> backup() => {
    'sessions': lectures.map((lecture) => lecture.toJson()).toList(),
    'attendance': attendance,
  };
  Future<void> save() async {
    try {
      if (!await prefs.setString('schedule', jsonEncode(backup()))) {
        throw const FileSystemException('Storage write failed');
      }
    } catch (_) {
      notice(
        tr(
          'Could not save changes on this device.',
          'تعذّر حفظ التغييرات على هذا الجهاز.',
        ),
      );
    }
  }

  void notice(String text) {
    messenger.currentState?.showSnackBar(SnackBar(content: Text(text)));
  }

  void language(bool value) {
    setState(() => arabic = value);
    unawaited(prefs.setBool('arabic', value));
  }

  void finishIntro({bool sample = false}) {
    setState(() {
      onboarding = false;
      if (sample && lectures.isEmpty) {
        lectures = [
          Lecture(
            'sample-design',
            tr('Design studio', 'استوديو التصميم'),
            now.weekday,
            540,
            630,
            'F-03',
            tr('First', 'الأول'),
            true,
          ),
          Lecture(
            'sample-math',
            tr('Linear algebra', 'الجبر الخطي'),
            now.weekday,
            690,
            780,
            'F-03',
            tr('First', 'الأول'),
            false,
          ),
          Lecture(
            'sample-code',
            tr('Computer science', 'علوم الحاسوب'),
            now.weekday % 7 + 1,
            600,
            690,
            'L-12',
            tr('Fifth', 'الخامس'),
            false,
          ),
        ];
      }
    });
    unawaited(prefs.setBool('introduced', true));
    if (sample) unawaited(save());
  }

  @override
  Widget build(BuildContext context) {
    final colors = ColorScheme.fromSeed(
      seedColor: clay,
      surface: cream,
    ).copyWith(primary: clay, onSurface: ink, outline: line);
    return MaterialApp(
      navigatorKey: navigator,
      scaffoldMessengerKey: messenger,
      debugShowCheckedModeBanner: false,
      title: 'Jadwali',
      locale: Locale(arabic ? 'ar' : 'en'),
      supportedLocales: const [Locale('en'), Locale('ar')],
      // ignore: deprecated_member_use
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: ThemeData(
        colorScheme: colors,
        scaffoldBackgroundColor: oat,
        appBarTheme: const AppBarTheme(
          backgroundColor: oat,
          foregroundColor: ink,
          scrolledUnderElevation: 0,
        ),
        textTheme: ThemeData.light().textTheme.apply(
          bodyColor: ink,
          displayColor: ink,
        ),
        dividerColor: line,
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: cream,
          border: OutlineInputBorder(),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(minimumSize: const Size(48, 48)),
        ),
        navigationBarTheme: const NavigationBarThemeData(
          backgroundColor: cream,
          indicatorColor: Color(0xffeed9c8),
        ),
      ),
      home: onboarding ? introScreen() : workspace(),
    );
  }

  Widget mark({double size = 42}) =>
      Image.asset('assets/mark.png', width: size, height: size);

  Widget introScreen() {
    final titles = [
      tr('Make time for class.', 'نظّم وقت محاضراتك.'),
      tr('Build your timetable.', 'أنشئ جدولك.'),
      tr('Stay on top of the week.', 'تابع أسبوعك بسهولة.'),
    ];
    final copy = [
      tr(
        'See your next class, room, and weekly schedule in one place.',
        'اطّلع على محاضرتك القادمة وقاعتها وجدول الأسبوع في مكان واحد.',
      ),
      tr(
        'Add classes by hand or scan screenshots with your Jadwali website.',
        'أضف المحاضرات يدوياً أو امسح لقطات الجدول عبر موقع جدولي.',
      ),
      tr(
        'Mark attendance and share your schedule. Your timetable is available offline.',
        'سجّل الحضور وشارك جدولك. يعمل جدولك دون اتصال.',
      ),
    ];
    final icons = [
      Icons.calendar_month_rounded,
      Icons.document_scanner_outlined,
      Icons.fact_check_outlined,
    ];
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: (constraints.maxHeight - 48).clamp(
                  0,
                  double.infinity,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      mark(),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          tr('Jadwali', 'جدولي'),
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () => language(!arabic),
                        child: Text(tr('العربية', 'English')),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          height: 226,
                          width: double.infinity,
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(
                            color: const Color(0xffdfbc9d),
                            borderRadius: BorderRadius.circular(30),
                          ),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              ColorFiltered(
                                colorFilter: const ColorFilter.mode(
                                  Color(0xffb18a70),
                                  BlendMode.color,
                                ),
                                child: Image.asset(
                                  'assets/atrium.webp',
                                  fit: BoxFit.cover,
                                ),
                              ),
                              const ColoredBox(color: Color(0x5536291f)),
                              Center(
                                child: Container(
                                  padding: const EdgeInsets.all(24),
                                  decoration: BoxDecoration(
                                    color: cream,
                                    borderRadius: BorderRadius.circular(25),
                                  ),
                                  child: Icon(
                                    icons[intro],
                                    size: 54,
                                    color: clay,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          titles[intro],
                          style: const TextStyle(
                            fontSize: 38,
                            fontWeight: FontWeight.w800,
                            height: 1.08,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          copy[intro],
                          style: const TextStyle(
                            color: muted,
                            fontSize: 16,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: List.generate(
                          titles.length,
                          (index) => AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            margin: const EdgeInsetsDirectional.only(end: 6),
                            width: index == intro ? 26 : 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: index == intro ? clay : line,
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: () {
                          if (intro == titles.length - 1) {
                            finishIntro();
                          } else {
                            setState(() => intro++);
                          }
                        },
                        icon: const Icon(Icons.arrow_forward),
                        label: Text(
                          intro == titles.length - 1
                              ? tr('Get started', 'ابدأ الآن')
                              : tr('Continue', 'متابعة'),
                        ),
                      ),
                      TextButton(
                        onPressed: intro == titles.length - 1
                            ? () => finishIntro(sample: true)
                            : () => finishIntro(),
                        child: Text(
                          intro == titles.length - 1
                              ? tr(
                                  'Explore with sample classes',
                                  'استكشف بجدول تجريبي',
                                )
                              : tr('Skip onboarding', 'تخطّي المقدمة'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget workspace() => Scaffold(
    appBar: AppBar(
      title: Row(
        children: [
          mark(size: 36),
          const SizedBox(width: 10),
          Text(
            tr('Jadwali', 'جدولي'),
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ],
      ),
      actions: [
        IconButton(
          tooltip: tr('Settings', 'الإعدادات'),
          onPressed: () => setState(() => tab = 3),
          icon: const Icon(Icons.settings_outlined),
        ),
        const SizedBox(width: 8),
      ],
    ),
    body: SafeArea(
      top: false,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 780),
          child: ListView(
            key: PageStorageKey(tab),
            padding: const EdgeInsetsDirectional.fromSTEB(18, 12, 18, 28),
            children: switch (tab) {
              0 => timetable(),
              1 => attendancePage(),
              2 => exportPage(),
              _ => settingsPage(),
            },
          ),
        ),
      ),
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: tab,
      onDestinationSelected: (value) => setState(() => tab = value),
      destinations: [
        NavigationDestination(
          icon: const Icon(Icons.calendar_view_week_outlined),
          label: tr('Timetable', 'الجدول'),
        ),
        NavigationDestination(
          icon: const Icon(Icons.fact_check_outlined),
          label: tr('Attendance', 'الحضور'),
        ),
        NavigationDestination(
          icon: const Icon(Icons.ios_share_outlined),
          label: tr('Export', 'التصدير'),
        ),
        NavigationDestination(
          icon: const Icon(Icons.more_horiz),
          label: tr('More', 'المزيد'),
        ),
      ],
    ),
  );

  Widget heading(String title, [String? subtitle]) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (subtitle != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(
              subtitle,
              style: const TextStyle(color: clay, fontWeight: FontWeight.w700),
            ),
          ),
        Text(
          title,
          style: const TextStyle(
            fontSize: 34,
            height: 1.12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );

  Widget panel(
    Widget content, {
    Color color = cream,
    EdgeInsetsGeometry padding = const EdgeInsets.all(16),
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Material(
      color: color,
      shape: RoundedRectangleBorder(
        side: const BorderSide(color: line),
        borderRadius: BorderRadius.circular(19),
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(padding: padding, child: content),
    ),
  );

  List<Lecture> ordered(Iterable<Lecture> values) =>
      values.toList()..sort((a, b) => a.start.compareTo(b.start));

  List<Widget> timetable() {
    final next = nextLecture(lectures, now);
    final today = ordered(
      lectures.where((lecture) => lecture.day == now.weekday),
    );
    final elapsed = now.hour * 60 + now.minute;
    final dayOrder = [6, 7, 1, 2, 3, 4, 5];
    return [
      heading(
        tr('Class schedule', 'جدولي الدراسي'),
        '${weekday(now.weekday)} · ${dateKey(now)}',
      ),
      Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton.icon(
              onPressed: () => editLecture(),
              icon: const Icon(Icons.add),
              label: Text(tr('Add class', 'إضافة محاضرة')),
            ),
            OutlinedButton.icon(
              onPressed: scanning ? null : () => importImages(),
              icon: const Icon(Icons.document_scanner_outlined),
              label: Text(
                scanning
                    ? tr('Reading images…', 'جارٍ قراءة الصور…')
                    : tr('Import images', 'استيراد صور'),
              ),
            ),
          ],
        ),
      ),
      if (scanning)
        const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: LinearProgressIndicator(),
        ),
      if (next != null) nextCard(next.lecture, next.starts),
      if (lectures.isEmpty)
        panel(
          Column(
            children: [
              const SizedBox(height: 14),
              const Icon(Icons.event_available_outlined, color: clay, size: 42),
              const SizedBox(height: 12),
              Text(
                tr('Your timetable starts here', 'جدولك يبدأ هنا'),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                tr(
                  'Add a class or import a timetable screenshot.',
                  'أضف محاضرة أو استورد صورة لجدولك.',
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 14),
            ],
          ),
        )
      else ...[
        panel(
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              titleRow(
                Icons.today_outlined,
                tr('Today’s classes', 'جدول اليوم'),
              ),
              if (today.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    tr('No classes today.', 'لا توجد محاضرات اليوم.'),
                    style: const TextStyle(color: muted),
                  ),
                ),
              for (final lecture in today)
                lectureTile(
                  lecture,
                  active: lecture.start <= elapsed && elapsed < lecture.end,
                ),
            ],
          ),
        ),
        panel(
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                children: [
                  titleRow(
                    Icons.view_week_outlined,
                    tr('Weekly timetable', 'الجدول الأسبوعي'),
                  ),
                  IconButton(
                    onPressed: () => setState(() => table = !table),
                    tooltip: table
                        ? tr('List view', 'عرض القائمة')
                        : tr('Table view', 'عرض الجدول'),
                    icon: Icon(
                      table
                          ? Icons.view_agenda_outlined
                          : Icons.table_chart_outlined,
                    ),
                  ),
                ],
              ),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final day in [0, ...dayOrder])
                      Padding(
                        padding: const EdgeInsetsDirectional.only(end: 6),
                        child: ChoiceChip(
                          label: Text(
                            day == 0 ? tr('Week', 'الأسبوع') : weekday(day),
                          ),
                          selected: filter == day,
                          onSelected: (_) => setState(() => filter = day),
                        ),
                      ),
                  ],
                ),
              ),
              if (!lectures.any(
                (lecture) => filter == 0 || lecture.day == filter,
              ))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    tr(
                      'No classes on this day.',
                      'لا توجد محاضرات في هذا اليوم.',
                    ),
                  ),
                ),
              for (final day in dayOrder.where(
                (day) =>
                    (filter == 0 || day == filter) &&
                    lectures.any((lecture) => lecture.day == day),
              )) ...[
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: oat,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    weekday(day),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                if (table)
                  scheduleTable(
                    ordered(lectures.where((lecture) => lecture.day == day)),
                  )
                else
                  for (final lecture in ordered(
                    lectures.where((lecture) => lecture.day == day),
                  ))
                    lectureTile(lecture),
              ],
            ],
          ),
        ),
      ],
    ];
  }

  Widget titleRow(IconData icon, String title) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, color: clay, size: 19),
      const SizedBox(width: 8),
      Flexible(
        child: Text(
          title,
          style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
        ),
      ),
    ],
  );

  Widget nextCard(Lecture lecture, DateTime starts) {
    final duration = starts.difference(now);
    final minutes = (duration.inSeconds / 60).ceil();
    final countdown = minutes < 60
        ? tr('In $minutes min', 'بعد $minutes د')
        : minutes < 1440
        ? tr(
            'In ${minutes ~/ 60}h ${minutes % 60}m',
            'بعد ${minutes ~/ 60} س ${minutes % 60} د',
          )
        : tr('In ${minutes ~/ 1440} days', 'بعد ${minutes ~/ 1440} يوم');
    return panel(
      ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Stack(
          children: [
            Positioned.fill(
              child: Opacity(
                opacity: .30,
                child: ColorFiltered(
                  colorFilter: const ColorFilter.mode(
                    Color(0xffb18a70),
                    BlendMode.color,
                  ),
                  child: Image.asset('assets/atrium.webp', fit: BoxFit.cover),
                ),
              ),
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: AlignmentDirectional.centerStart,
                    end: AlignmentDirectional.centerEnd,
                    colors: const [oat, Color(0xccf5eee4), Color(0x00f5eee4)],
                  ),
                ),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      titleRow(
                        Icons.upcoming_outlined,
                        tr('Next class', 'المحاضرة القادمة'),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        lecture.name,
                        style: const TextStyle(
                          fontSize: 29,
                          height: 1.12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 7,
                        children: [
                          Text(
                            dateKey(starts) == dateKey(now)
                                ? tr('Today', 'اليوم')
                                : weekday(starts.weekday),
                            style: const TextStyle(color: muted),
                          ),
                          Text(
                            lecture.time,
                            textDirection: TextDirection.ltr,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: cream,
                          border: Border.all(color: line),
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          child: Text(
                            countdown,
                            style: const TextStyle(
                              color: clay,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                DecoratedBox(
                  decoration: const BoxDecoration(
                    color: Color(0xeefffdf8),
                    border: Border(top: BorderSide(color: line)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Expanded(
                          child: detail(
                            Icons.place_outlined,
                            tr('Room', 'القاعة'),
                            lecture.room,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: detail(
                            Icons.layers_outlined,
                            tr('Floor', 'الطابق'),
                            lecture.floor,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      color: oat,
      padding: EdgeInsets.zero,
    );
  }

  Widget detail(IconData icon, String label, String value) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 18, color: clay),
      const SizedBox(width: 6),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: muted)),
            Text(
              value.isEmpty ? '—' : value,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    ],
  );

  Widget scheduleTable(List<Lecture> values) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: DataTable(
      columnSpacing: 14,
      headingRowHeight: 37,
      columns: [
        DataColumn(label: Text(tr('Time', 'الوقت'))),
        DataColumn(label: Text(tr('Class', 'المحاضرة'))),
        DataColumn(label: Text(tr('Room', 'القاعة'))),
      ],
      rows: values
          .map(
            (lecture) => DataRow(
              cells: [
                DataCell(
                  Text(lecture.time, textDirection: TextDirection.ltr),
                  onTap: () => editLecture(lecture),
                ),
                DataCell(
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 145),
                    child: Text(lecture.name, overflow: TextOverflow.ellipsis),
                  ),
                  onTap: () => editLecture(lecture),
                ),
                DataCell(Text(lecture.room), onTap: () => editLecture(lecture)),
              ],
            ),
          )
          .toList(),
    ),
  );

  Widget lectureTile(Lecture lecture, {bool active = false}) => ListTile(
    contentPadding: EdgeInsets.zero,
    onTap: () => editLecture(lecture),
    leading: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          timeLabel(lecture.start),
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        Text(
          timeLabel(lecture.end),
          style: const TextStyle(color: muted, fontSize: 12),
        ),
      ],
    ),
    title: Text(
      lecture.name,
      style: const TextStyle(fontWeight: FontWeight.w700),
    ),
    subtitle: Text(
      [
        if (active) tr('In progress', 'جارية الآن'),
        if (lecture.room.isNotEmpty) lecture.room,
        if (lecture.floor.isNotEmpty) lecture.floor,
        lecture.lab ? tr('Lab', 'عملي') : tr('Lecture', 'نظري'),
      ].join(' · '),
    ),
    trailing: const Icon(Icons.edit_outlined, size: 18, color: clay),
  );

  Future<void> editLecture([Lecture? existing]) async {
    final result = await showModalBottomSheet<Lecture>(
      context: contextForDialog,
      useSafeArea: true,
      isScrollControlled: true,
      builder: (_) => LectureEditor(
        existing: existing,
        defaultDay: filter == 0 ? now.weekday : filter,
        tr: tr,
        weekday: weekday,
        onDelete: existing == null
            ? null
            : () async {
                final confirmed = await confirm(
                  tr('Delete this class?', 'حذف هذه المحاضرة؟'),
                );
                if (!confirmed || !mounted) return false;
                setState(() {
                  lectures.removeWhere((entry) => entry.id == existing.id);
                  attendance.removeWhere(
                    (key, _) => key.endsWith('|${existing.id}'),
                  );
                });
                await save();
                return true;
              },
      ),
    );
    if (result == null || !mounted) return;
    if (lectures.any(
      (entry) => entry.identity == result.identity && entry.id != result.id,
    )) {
      notice(
        tr(
          'This class is already in your timetable.',
          'هذه المحاضرة موجودة في جدولك.',
        ),
      );
      return;
    }
    setState(() {
      final index = lectures.indexWhere((entry) => entry.id == result.id);
      if (index == -1) {
        lectures.add(result);
      } else {
        lectures[index] = result;
      }
    });
    await save();
  }

  Future<bool> confirm(String title) async =>
      await showDialog<bool>(
        context: contextForDialog,
        builder: (context) => AlertDialog(
          title: Text(title),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(tr('Cancel', 'إلغاء')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(tr('Confirm', 'تأكيد')),
            ),
          ],
        ),
      ) ??
      false;

  Future<void> recoverPicker() async {
    try {
      final recovered = await picker.retrieveLostData();
      if (recovered.files case final files?
          when mounted && files.isNotEmpty && scanner.isNotEmpty) {
        await confirmScan(files);
      }
    } catch (_) {
      if (mounted) {
        notice(
          tr(
            'Could not recover the selected images.',
            'تعذّر استعادة الصور المحددة.',
          ),
        );
      }
    }
  }

  Future<void> importImages() async {
    if (scanner.isEmpty) {
      await editScanner();
      if (!mounted || scanner.isEmpty) return;
    }
    final source = await showModalBottomSheet<ImageSource>(
      context: contextForDialog,
      useSafeArea: true,
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: Text(tr('Choose screenshots', 'اختر لقطات الشاشة')),
            onTap: () => Navigator.pop(context, ImageSource.gallery),
          ),
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: Text(tr('Take a photo', 'التقط صورة')),
            onTap: () => Navigator.pop(context, ImageSource.camera),
          ),
        ],
      ),
    );
    if (source == null || !mounted) return;
    try {
      final List<XFile> files;
      if (source == ImageSource.camera) {
        final image = await picker.pickImage(
          source: source,
          maxWidth: 1850,
          maxHeight: 1850,
          imageQuality: 80,
        );
        files = [?image];
      } else {
        files = await picker.pickMultiImage(
          maxWidth: 1850,
          maxHeight: 1850,
          imageQuality: 80,
          limit: 8,
        );
      }
      if (!mounted || files.isEmpty) return;
      await confirmScan(files);
    } catch (_) {
      if (mounted) {
        notice(
          tr('Could not open the selected images.', 'تعذّر فتح الصور المحددة.'),
        );
      }
    }
  }

  Future<void> confirmScan(List<XFile> files) async {
    final agreed = await confirm(
      tr(
        'Send ${files.length} image(s) to $scanner for scanning?',
        'إرسال ${files.length} صورة إلى $scanner لقراءتها؟',
      ),
    );
    if (agreed && mounted) await scan(files);
  }

  Future<void> scan(List<XFile> files) async {
    if (scanning) return;
    setState(() => scanning = true);
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 15);
    try {
      if (files.length > 8) throw const FormatException('Too many images');
      final images = <String>[];
      var size = 0;
      for (final file in files) {
        size += await file.length();
        if (size > 2900000) {
          if (mounted) {
            notice(
              tr(
                'The images are too large. Try fewer screenshots.',
                'الصور كبيرة. جرّب عدداً أقل من اللقطات.',
              ),
            );
          }
          return;
        }
        final kind = file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
        images.add(
          'data:image/$kind;base64,${base64Encode(await file.readAsBytes())}',
        );
      }
      final request = await client.postUrl(
        Uri.parse(scanner).resolve('/api/vision'),
      );
      request.followRedirects = false;
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode({'images': images}));
      final response = await request.close().timeout(
        const Duration(seconds: 75),
      );
      if (response.statusCode != 200) {
        throw const HttpException('Scanner rejected the request');
      }
      final data = jsonDecode(
        await response
            .transform(utf8.decoder)
            .join()
            .timeout(const Duration(seconds: 20)),
      );
      if (data is! Map || data['sessions'] is! List) {
        throw const FormatException('Invalid scan');
      }
      final stamp = DateTime.now().microsecondsSinceEpoch;
      final candidates = <Lecture>[];
      final seen = lectures.map((lecture) => lecture.identity).toSet();
      for (final (index, row) in (data['sessions'] as List).indexed) {
        final lecture = Lecture.read(row, id: 'scan-$stamp-$index');
        if (lecture != null && seen.add(lecture.identity)) {
          candidates.add(lecture);
        }
      }
      if (!mounted) return;
      if (candidates.isEmpty) {
        notice(
          tr(
            'No new classes found. Try clearer screenshots.',
            'لم يُعثر على محاضرات جديدة. جرّب لقطات أوضح.',
          ),
        );
        return;
      }
      final checked = candidates.map((classItem) => classItem.id).toSet();
      final results = await showModalBottomSheet<List<Lecture>>(
        context: contextForDialog,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (context) => StatefulBuilder(
          builder: (context, update) => FractionallySizedBox(
            heightFactor: .8,
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                children: [
                  heading(
                    tr('Review imported classes', 'راجع المحاضرات المستوردة'),
                  ),
                  if (data['issues'] is List &&
                      (data['issues'] as List).isNotEmpty)
                    Text(
                      tr(
                        'Some timetable details may be missing. Check the detected classes below.',
                        'قد تكون بعض التفاصيل ناقصة. تحقّق من المحاضرات أدناه.',
                      ),
                    ),
                  Expanded(
                    child: ListView(
                      children: [
                        for (final lecture in candidates)
                          CheckboxListTile(
                            title: Text(lecture.name),
                            subtitle: Text(
                              '${weekday(lecture.day)} · ${lecture.time} · ${lecture.room}',
                            ),
                            value: checked.contains(lecture.id),
                            onChanged: (value) => update(() {
                              if (value == true) {
                                checked.add(lecture.id);
                              } else {
                                checked.remove(lecture.id);
                              }
                            }),
                          ),
                      ],
                    ),
                  ),
                  FilledButton(
                    onPressed: checked.isEmpty
                        ? null
                        : () => Navigator.pop(
                            context,
                            candidates
                                .where(
                                  (lecture) => checked.contains(lecture.id),
                                )
                                .toList(),
                          ),
                    child: Text(
                      tr(
                        'Add ${checked.length} classes',
                        'إضافة ${checked.length} محاضرات',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      if (results == null || !mounted) return;
      setState(() => lectures.addAll(results));
      await save();
    } catch (_) {
      if (mounted) {
        notice(
          tr(
            'Could not read the images. Check the scanner address and try again.',
            'تعذّرت قراءة الصور. تحقّق من عنوان الماسح وأعد المحاولة.',
          ),
        );
      }
    } finally {
      client.close(force: true);
      if (mounted) setState(() => scanning = false);
    }
  }

  Future<void> editScanner() async {
    var value = scanner;
    final result = await showDialog<String>(
      context: contextForDialog,
      builder: (context) => AlertDialog(
        title: Text(tr('Screenshot scanner', 'ماسح صور الجدول')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr(
                'Enter the HTTPS address of your Jadwali website with image scanning enabled.',
                'أدخل عنوان HTTPS لموقع جدولي المفعّل فيه مسح الصور.',
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              initialValue: scanner,
              keyboardType: TextInputType.url,
              textDirection: TextDirection.ltr,
              onChanged: (text) => value = text.trim(),
              decoration: const InputDecoration(hintText: 'https://…'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(tr('Cancel', 'إلغاء')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, value),
            child: Text(tr('Save', 'حفظ')),
          ),
        ],
      ),
    );
    if (!mounted || result == null) return;
    final uri = Uri.tryParse(result);
    if (result.isNotEmpty &&
        (uri == null ||
            uri.scheme != 'https' ||
            uri.host.isEmpty ||
            uri.userInfo.isNotEmpty)) {
      notice(tr('Enter a valid HTTPS address.', 'أدخل عنوان HTTPS صالحاً.'));
      return;
    }
    setState(() => scanner = result.isEmpty ? '' : uri!.origin);
    await prefs.setString('scanner', scanner);
  }

  DateTime? attendanceDate;
  List<Widget> attendancePage() {
    final date = attendanceDate ?? now;
    final classes = ordered(
      lectures.where((lecture) => lecture.day == date.weekday),
    );
    final values = attendance.values.toList();
    const codes = ['present', 'late', 'absent'];
    final labels = [
      tr('Present', 'حاضر'),
      tr('Late', 'متأخر'),
      tr('Absent', 'غائب'),
    ];
    return [
      heading(tr('Attendance', 'الحضور'), tr('Class records', 'سجل المحاضرات')),
      panel(
        Row(
          children: [
            for (var index = 0; index < codes.length; index++)
              Expanded(
                child: Column(
                  children: [
                    Text(
                      '${values.where((value) => value == codes[index]).length}',
                      style: const TextStyle(
                        fontSize: 25,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(labels[index], style: const TextStyle(color: muted)),
                  ],
                ),
              ),
          ],
        ),
        color: sage,
      ),
      panel(
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            OutlinedButton.icon(
              icon: const Icon(Icons.date_range_outlined),
              label: Text(dateKey(date)),
              onPressed: () async {
                final result = await showDatePicker(
                  context: contextForDialog,
                  initialDate: date,
                  firstDate: DateTime(now.year - 5),
                  lastDate: now,
                );
                if (result != null && mounted) {
                  setState(() => attendanceDate = result);
                }
              },
            ),
            if (classes.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  tr(
                    'No classes on this day.',
                    'لا توجد محاضرات في هذا اليوم.',
                  ),
                ),
              ),
            for (final lecture in classes) ...[
              const SizedBox(height: 12),
              Text(
                lecture.name,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                lecture.time,
                textDirection: TextDirection.ltr,
                textAlign: arabic ? TextAlign.right : TextAlign.left,
                style: const TextStyle(color: muted),
              ),
              Wrap(
                spacing: 7,
                children: [
                  for (var index = 0; index < codes.length; index++)
                    ChoiceChip(
                      label: Text(labels[index]),
                      selected:
                          attendance['${dateKey(date)}|${lecture.id}'] ==
                          codes[index],
                      onSelected: (selected) {
                        final key = '${dateKey(date)}|${lecture.id}';
                        setState(() {
                          if (selected) {
                            attendance[key] = codes[index];
                          } else {
                            attendance.remove(key);
                          }
                        });
                        unawaited(save());
                      },
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    ];
  }

  Widget action(
    IconData icon,
    String title,
    String subtitle,
    Future<void> Function()? run,
  ) => ListTile(
    contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 5),
    leading: Icon(icon, color: clay),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
    subtitle: Text(subtitle),
    trailing: const Icon(Icons.chevron_right),
    enabled: run != null,
    onTap: run,
  );

  List<Widget> exportPage() => [
    heading(
      tr('Export', 'التصدير'),
      tr('Take your timetable with you', 'احتفظ بجدولك معك'),
    ),
    panel(
      Column(
        children: [
          action(
            Icons.event_available_outlined,
            tr('Calendar file', 'ملف التقويم'),
            tr(
              'Share a recurring .ics schedule',
              'مشاركة جدول متكرر بصيغة .ics',
            ),
            lectures.isEmpty ? null : shareCalendar,
          ),
          const Divider(),
          action(
            Icons.share_outlined,
            tr('Share timetable', 'مشاركة الجدول'),
            tr('Send your week as readable text', 'أرسل جدول الأسبوع كنص'),
            lectures.isEmpty ? null : shareTimetable,
          ),
          const Divider(),
          action(
            Icons.download_outlined,
            tr('Back up data', 'نسخ احتياطي'),
            tr(
              'Export classes and attendance to JSON',
              'تصدير المحاضرات والحضور إلى JSON',
            ),
            shareBackup,
          ),
        ],
      ),
    ),
  ];

  List<Widget> settingsPage() => [
    heading(tr('Settings', 'الإعدادات')),
    panel(
      Column(
        children: [
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(tr('Arabic interface', 'الواجهة العربية')),
            value: arabic,
            onChanged: language,
          ),
          const Divider(),
          action(
            Icons.document_scanner_outlined,
            tr('Screenshot scanner', 'ماسح صور الجدول'),
            scanner.isEmpty
                ? tr('Connect your Jadwali website', 'اربط موقع جدولي')
                : scanner,
            editScanner,
          ),
          const Divider(),
          action(
            Icons.restore_outlined,
            tr('Restore a backup', 'استعادة نسخة احتياطية'),
            tr('Open a Jadwali JSON file', 'افتح ملف JSON من جدولي'),
            restoreBackup,
          ),
          const Divider(),
          action(
            Icons.info_outline,
            tr('Show onboarding', 'عرض المقدمة'),
            tr('Revisit the app tour', 'شاهد جولة التطبيق مرة أخرى'),
            () async {
              setState(() {
                intro = 0;
                onboarding = true;
              });
            },
          ),
        ],
      ),
    ),
  ];

  Future<void> shareFile(String filename, String data) async {
    final directory = await Directory.systemTemp.createTemp('jadwali-');
    final file = await File('${directory.path}/$filename').writeAsString(data);
    await SharePlus.instance.share(ShareParams(files: [XFile(file.path)]));
  }

  Future<void> shareBackup() async {
    try {
      await shareFile(
        'jadwali-backup.json',
        const JsonEncoder.withIndent('  ').convert(backup()),
      );
    } catch (_) {
      if (mounted) {
        notice(
          tr('Could not share the backup.', 'تعذّرت مشاركة النسخة الاحتياطية.'),
        );
      }
    }
  }

  Future<void> shareCalendar() async {
    final date = DateTime(now.year, now.month, now.day);
    final range = await showDateRangePicker(
      context: contextForDialog,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 3),
      initialDateRange: DateTimeRange(
        start: date,
        end: date.add(const Duration(days: 90)),
      ),
    );
    if (range == null || !mounted) return;
    try {
      await shareFile(
        'jadwali.ics',
        calendarExport(lectures, range.start, range.end),
      );
    } catch (_) {
      if (mounted) {
        notice(tr('Could not share the calendar.', 'تعذّرت مشاركة التقويم.'));
      }
    }
  }

  Future<void> shareTimetable() async {
    final lines = [tr('Jadwali timetable', 'جدول المحاضرات')];
    for (final day in [6, 7, 1, 2, 3, 4, 5]) {
      final list = ordered(lectures.where((lecture) => lecture.day == day));
      if (list.isEmpty) continue;
      lines.addAll([
        '',
        weekday(day),
        for (final lecture in list)
          '${lecture.time}  ${lecture.name}  ${lecture.room}',
      ]);
    }
    try {
      await SharePlus.instance.share(ShareParams(text: lines.join('\n')));
    } catch (_) {
      if (mounted) {
        notice(tr('Could not share the timetable.', 'تعذّرت مشاركة الجدول.'));
      }
    }
  }

  Future<void> restoreBackup() async {
    try {
      final file = await openFile(
        acceptedTypeGroups: [
          const XTypeGroup(
            label: 'JSON',
            extensions: ['json'],
            mimeTypes: ['application/json'],
          ),
        ],
      );
      if (file == null || !mounted) return;
      if (await file.length() > 4000000) {
        throw const FormatException('Backup too large');
      }
      final data = jsonDecode(await file.readAsString());
      if (data is! Map || data['sessions'] is! List) {
        throw const FormatException('Invalid backup');
      }
      final source = data['sessions'] as List;
      final restored = source.map(Lecture.read).whereType<Lecture>().toList();
      if (restored.length != source.length ||
          restored.map((lecture) => lecture.id).toSet().length !=
              restored.length) {
        throw const FormatException('Invalid sessions');
      }
      final records = <String, String>{};
      if (data['attendance'] case final Map entries) {
        for (final entry in entries.entries) {
          if (entry.key is String &&
              ['present', 'late', 'absent'].contains(entry.value)) {
            records[entry.key as String] = entry.value as String;
          }
        }
      }
      if (!mounted ||
          !await confirm(
            tr(
              'Replace the current timetable with this backup?',
              'استبدال الجدول الحالي بهذه النسخة الاحتياطية؟',
            ),
          )) {
        return;
      }
      if (!mounted) return;
      setState(() {
        lectures = restored;
        attendance = records;
        tab = 0;
        filter = 0;
      });
      await save();
    } catch (_) {
      if (mounted) {
        notice(
          tr(
            'Could not read this backup.',
            'تعذّر قراءة هذه النسخة الاحتياطية.',
          ),
        );
      }
    }
  }
}

class LectureEditor extends StatefulWidget {
  const LectureEditor({
    super.key,
    required this.existing,
    required this.defaultDay,
    required this.tr,
    required this.weekday,
    required this.onDelete,
  });
  final Lecture? existing;
  final int defaultDay;
  final String Function(String, String) tr;
  final String Function(int) weekday;
  final Future<bool> Function()? onDelete;
  @override
  State<LectureEditor> createState() => _LectureEditorState();
}

class _LectureEditorState extends State<LectureEditor> {
  final key = GlobalKey<FormState>();
  late String name, room, floor;
  late int day, start, end;
  late bool lab;
  bool invalidTime = false;

  @override
  void initState() {
    super.initState();
    final old = widget.existing;
    name = old?.name ?? '';
    room = old?.room ?? '';
    floor = old?.floor ?? '';
    day = old?.day ?? widget.defaultDay;
    start = old?.start ?? 540;
    end = old?.end ?? 630;
    lab = old?.lab ?? false;
  }

  Future<void> pickTime(bool first) async {
    final minutes = first ? start : end;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: minutes ~/ 60, minute: minutes % 60),
    );
    if (time == null || !mounted) return;
    setState(() {
      if (first) {
        start = time.hour * 60 + time.minute;
      } else {
        end = time.hour * 60 + time.minute;
      }
      invalidTime = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.tr;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          MediaQuery.viewInsetsOf(context).bottom + 20,
        ),
        child: Form(
          key: key,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.existing == null
                    ? tr('Add a class', 'إضافة محاضرة')
                    : tr('Edit class', 'تعديل المحاضرة'),
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                initialValue: name,
                textCapitalization: TextCapitalization.sentences,
                maxLength: 140,
                decoration: InputDecoration(
                  labelText: tr('Course name', 'اسم المقرر'),
                ),
                onChanged: (value) => name = value,
                validator: (value) => value == null || value.trim().isEmpty
                    ? tr('Enter a course name', 'أدخل اسم المقرر')
                    : null,
              ),
              DropdownButtonFormField<int>(
                initialValue: day,
                decoration: InputDecoration(labelText: tr('Day', 'اليوم')),
                items: [
                  for (final day in [6, 7, 1, 2, 3, 4, 5])
                    DropdownMenuItem(
                      value: day,
                      child: Text(widget.weekday(day)),
                    ),
                ],
                onChanged: (value) {
                  if (value != null) setState(() => day = value);
                },
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  OutlinedButton(
                    onPressed: () => pickTime(true),
                    child: Text(
                      '${tr('Start', 'البداية')} · ${timeLabel(start)}',
                    ),
                  ),
                  OutlinedButton(
                    onPressed: () => pickTime(false),
                    child: Text('${tr('End', 'النهاية')} · ${timeLabel(end)}'),
                  ),
                ],
              ),
              if (invalidTime)
                Text(
                  tr(
                    'End time must be after start time.',
                    'يجب أن يكون وقت النهاية بعد البداية.',
                  ),
                  style: const TextStyle(color: clay),
                ),
              const SizedBox(height: 10),
              TextFormField(
                initialValue: room,
                decoration: InputDecoration(labelText: tr('Room', 'القاعة')),
                onChanged: (value) => room = value,
              ),
              const SizedBox(height: 10),
              TextFormField(
                initialValue: floor,
                decoration: InputDecoration(labelText: tr('Floor', 'الطابق')),
                onChanged: (value) => floor = value,
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(tr('Lab session', 'محاضرة عملية')),
                value: lab,
                onChanged: (value) => setState(() => lab = value),
              ),
              FilledButton(
                onPressed: () {
                  final valid = key.currentState!.validate();
                  setState(() => invalidTime = start >= end);
                  if (!valid || invalidTime) return;
                  Navigator.pop(
                    context,
                    Lecture(
                      widget.existing?.id ??
                          'class-${DateTime.now().microsecondsSinceEpoch}',
                      name.trim(),
                      day,
                      start,
                      end,
                      room.trim(),
                      floor.trim(),
                      lab,
                    ),
                  );
                },
                child: Text(tr('Save class', 'حفظ المحاضرة')),
              ),
              if (widget.onDelete != null)
                TextButton(
                  onPressed: () async {
                    if (await widget.onDelete!() && context.mounted) {
                      Navigator.pop(context);
                    }
                  },
                  child: Text(tr('Delete class', 'حذف المحاضرة')),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
