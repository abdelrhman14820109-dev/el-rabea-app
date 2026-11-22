/*
 * بيحوّل (appointmentDay + sessionTime) من Firestore لتاريخ ووقت.
 * بيفهم: 2026-11-25 | 25/11/2026 | 25/11 | اسم اليوم (السبت...) + أرقام عربي/إنجليزي + ص/م/AM/PM
 * بيرجّع {y,m,d,hh,mm} أو null لو مش قادر يفهم.
 * today = {y,m,d,dow,min}  (dow: 0=الأحد ... 6=السبت، min = دقايق اليوم لحد دلوقتي)
 */
(function (root) {
  var DAYS = [
    ['الاحد', 'sun'], ['الاثنين', 'mon', 'الاتنين'], ['الثلاثاء', 'tue', 'التلات'],
    ['الاربعاء', 'wed'], ['الخميس', 'thu'], ['الجمعة', 'fri'], ['السبت', 'sat']
  ];

  function norm(s) {
    s = String(s == null ? '' : s);
    s = s.replace(/[\u0660-\u0669]/g, function (c) { return c.charCodeAt(0) - 0x0660; });
    s = s.replace(/[\u06F0-\u06F9]/g, function (c) { return c.charCodeAt(0) - 0x06F0; });
    s = s.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ة');
    return s.toLowerCase();
  }

  function parseTime(str) {
    var s = ' ' + norm(str) + ' ';
    var m = s.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
    var hh, mm;
    if (m) { hh = +m[1]; mm = +m[2]; }
    else {
      m = s.match(/(\d{1,2})\s*(?:ص|م|am|pm|صباح|مساء|ظهر|عصر)/);
      if (!m) return null;
      hh = +m[1]; mm = 0;
    }
    var pm = /(^|[^\u0621-\u064A])م([^\u0621-\u064A]|$)|مساء|عصر|ظهر|pm|p\.m/.test(s);
    var am = /(^|[^\u0621-\u064A])ص([^\u0621-\u064A]|$)|صباح|am|a\.m/.test(s);
    if (pm && hh < 12) hh += 12;
    else if (am && !pm && hh === 12) hh = 0;
    if (hh > 23 || mm > 59) return null;
    return { hh: hh, mm: mm };
  }

  function addDays(y, m, d, n) {
    var t = new Date(Date.UTC(y, m - 1, d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }

  function parseDate(str, today, timeMin) {
    var s = norm(str), m;
    if ((m = s.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return { y: +m[1], m: +m[2], d: +m[3] };
    if ((m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/))) return { y: +m[3], m: +m[2], d: +m[1] };
    if ((m = s.match(/(\d{1,2})[-\/](\d{1,2})(?![\d:])/))) {
      var r = { y: today.y, m: +m[2], d: +m[1] };
      if (r.m < today.m || (r.m === today.m && r.d < today.d)) r.y += 1;
      return r;
    }
    for (var i = 0; i < DAYS.length; i++) {
      for (var j = 0; j < DAYS[i].length; j++) {
        if (s.indexOf(DAYS[i][j]) !== -1) {
          var diff = (i - today.dow + 7) % 7;
          if (diff === 0 && timeMin <= today.min) diff = 7; // النهارده ووقته عدّى → الأسبوع الجاي
          return addDays(today.y, today.m, today.d, diff);
        }
      }
    }
    return null;
  }

  function parseSession(appointmentDay, sessionTime, today) {
    var t = parseTime(sessionTime || '');
    if (!t && appointmentDay) t = parseTime(appointmentDay); // أحيانًا الوقت جوه نص اليوم
    if (!t) return null;
    var d = parseDate(appointmentDay || '', today, t.hh * 60 + t.mm);
    if (!d) return null;
    return { y: d.y, m: d.m, d: d.d, hh: t.hh, mm: t.mm };
  }

  var api = { parseSession: parseSession, parseTime: parseTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RabeaParser = api;
})(typeof window !== 'undefined' ? window : this);
