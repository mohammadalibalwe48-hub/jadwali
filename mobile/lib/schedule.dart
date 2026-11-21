const arabicDays = [
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
  'الأحد',
];
const englishDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

int? parseTime(Object? value) {
  if (value is! String ||
      !RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(value)) {
    return null;
  }
  return int.parse(value.substring(0, 2)) * 60 + int.parse(value.substring(3));
}

String timeLabel(int minutes) =>
    '${(minutes ~/ 60).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';

String dateKey(DateTime date) =>
    '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

class Lecture {
  const Lecture(
    this.id,
    this.name,
    this.day,
    this.start,
    this.end,
    this.room,
    this.floor,
    this.lab,
  );
  final String id, name, room, floor;
  final int day, start, end;
  final bool lab;

  String get time => '${timeLabel(start)}–${timeLabel(end)}';
  String get identity =>
      '$day|$start|$end|${name.toLowerCase()}|${room.toLowerCase()}';

  Map<String, Object> toJson() => {
    'id': id,
    'courseName': name,
    'day': day == DateTime.monday ? 'الإثنين' : arabicDays[day - 1],
    'startTime': timeLabel(start),
    'endTime': timeLabel(end),
    'room': room,
    'floor': floor,
    'type': lab ? 'عملي' : 'نظري',
    'floorAuto': false,
  };

  static Lecture? read(Object? data, {String? id}) {
    if (data is! Map) return null;
    final day =
        arabicDays.indexOf(data['day'] == 'الإثنين' ? 'الاثنين' : data['day']) +
        1;
    final start = parseTime(data['startTime']);
    final end = parseTime(data['endTime']);
    final name = data['courseName'];
    final key = id ?? data['id'];
    if (day == 0 ||
        start == null ||
        end == null ||
        end <= start ||
        name is! String ||
        name.trim().isEmpty ||
        key is! String ||
        key.isEmpty) {
      return null;
    }
    return Lecture(
      key,
      name.trim(),
      day,
      start,
      end,
      data['room'] is String ? data['room'] : '',
      data['floor'] is String ? data['floor'] : '',
      data['type'] == 'عملي',
    );
  }
}

({Lecture lecture, DateTime starts})? nextLecture(
  List<Lecture> lectures,
  DateTime now,
) {
  ({Lecture lecture, DateTime starts})? next;
  for (final lecture in lectures) {
    final offset = (lecture.day - now.weekday + 7) % 7;
    var starts = DateTime(
      now.year,
      now.month,
      now.day + offset,
      lecture.start ~/ 60,
      lecture.start % 60,
    );
    if (starts.isBefore(now)) {
      starts = DateTime(
        starts.year,
        starts.month,
        starts.day + 7,
        starts.hour,
        starts.minute,
      );
    }
    if (next == null || starts.isBefore(next.starts)) {
      next = (lecture: lecture, starts: starts);
    }
  }
  return next;
}

String calendarExport(List<Lecture> lectures, DateTime start, DateTime end) {
  String escape(String input) => input
      .replaceAll('\\', '\\\\')
      .replaceAll('\r', '')
      .replaceAll('\n', r'\n')
      .replaceAll(',', r'\,')
      .replaceAll(';', r'\;');
  String day(DateTime d) => dateKey(d).replaceAll('-', '');
  String time(int value) => '${timeLabel(value).replaceAll(':', '')}00';
  final stamp =
      '${DateTime.now().toUtc().toIso8601String().split('.').first.replaceAll(RegExp('[-:]'), '')}Z';
  const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  final lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jadwali//Timetable//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (final lecture in lectures) {
    final first = DateTime(
      start.year,
      start.month,
      start.day + (lecture.day - start.weekday + 7) % 7,
    );
    if (first.isAfter(end)) continue;
    final count =
        DateTime.utc(end.year, end.month, end.day)
                .difference(DateTime.utc(first.year, first.month, first.day))
                .inDays ~/
            7 +
        1;
    lines.addAll([
      'BEGIN:VEVENT',
      'UID:${Uri.encodeComponent(lecture.id)}@jadwali',
      'DTSTAMP:$stamp',
      'DTSTART:${day(first)}T${time(lecture.start)}',
      'DTEND:${day(first)}T${time(lecture.end)}',
      'RRULE:FREQ=WEEKLY;COUNT=$count;BYDAY=${weekdays[lecture.day - 1]}',
      'SUMMARY:${escape(lecture.name)}',
      'LOCATION:${escape(lecture.room)}',
      'END:VEVENT',
    ]);
  }
  return [...lines, 'END:VCALENDAR', ''].join('\r\n');
}
