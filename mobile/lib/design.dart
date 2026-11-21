// ignore: deprecated_member_use
import 'package:flutter/material.dart';

const ink = Color(0xff2e241e);
const clay = Color(0xff884632);
const oat = Color(0xfff6efe4);
const cream = Color(0xfffffcf6);
const line = Color(0xffdfd0bf);
const muted = Color(0xff705e50);
const sage = Color(0xffe9eddf);
const espresso = Color(0xff30231d);
const sand = Color(0xfff1d6b5);

TextStyle displayType(bool arabic, {double size = 42, Color color = ink}) =>
    TextStyle(
      fontFamily: arabic ? null : 'Fraunces',
      fontSize: size,
      height: 1.08,
      letterSpacing: arabic ? 0 : -size * .035,
      fontWeight: arabic ? FontWeight.w800 : FontWeight.w500,
      color: color,
    );

class CampusPhoto extends StatelessWidget {
  const CampusPhoto({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Positioned.fill(
        child: ColorFiltered(
          colorFilter: const ColorFilter.mode(
            Color(0xff946b52),
            BlendMode.color,
          ),
          child: Image.asset('assets/atrium.webp', fit: BoxFit.cover),
        ),
      ),
      const Positioned.fill(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: AlignmentDirectional.bottomStart,
              end: AlignmentDirectional.topEnd,
              colors: [espresso, Color(0xdd30231d), Color(0x3030231d)],
              stops: [0, .52, 1],
            ),
          ),
        ),
      ),
      child,
    ],
  );
}

class ModuleIcon extends StatelessWidget {
  const ModuleIcon(
    this.icon, {
    super.key,
    this.color = clay,
    this.background = oat,
  });
  final IconData icon;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(12),
    ),
    child: SizedBox.square(
      dimension: 42,
      child: Icon(icon, size: 20, color: color),
    ),
  );
}
