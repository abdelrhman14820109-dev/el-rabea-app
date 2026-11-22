/*
 * جسر التطبيق (Android / iOS) — إشعارات الجلسات
 *  1) registerPush: بياخد إذن الإشعارات ويحفظ FCM token في ملف المريض (fcmToken)
 *  2) scheduleReminders: بيجدول تنبيهات محلية على التليفون قبل/وقت الجلسة (ببلاش ومن غير سيرفر)
 */
(function () {
  // ===== إعدادات تقدر تعدّلها =====
  var CONFIG = {
    // true  = التذكير بيتجدول على التليفون نفسه (مجاني).
    // false = لو بتستخدم Cloud Functions للتذكير من السيرفر (عشان ماتجيش إشعارات مكررة).
    LOCAL_REMINDERS: true,
    // قبل الجلسة بكام دقيقة؟  0 = وقت الجلسة نفسه
    REMINDER_MINUTES_BEFORE: [60, 0]
  };
  var ID_BASE = 7000;

  var C = window.Capacitor;
  var isNative = !!(C && C.isNativePlatform && C.isNativePlatform());
  var P = (isNative && C.Plugins) || {};

  function log() { try { console.log.apply(console, ['[Rabea]'].concat([].slice.call(arguments))); } catch (e) {} }

  // ---------- Push (FCM) ----------
  async function registerPush(db, patientId) {
    if (!isNative || !P.FirebaseMessaging || !patientId) return null;
    var FM = P.FirebaseMessaging;
    try {
      var perm = await FM.requestPermissions();
      if (perm.receive !== 'granted') { log('push permission denied'); return null; }

      var res = await FM.getToken();
      var token = res && res.token;
      if (token) {
        await db.collection('patients').doc(patientId).update({
          fcmToken: token,
          platform: (C.getPlatform && C.getPlatform()) || 'native',
          tokenUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        log('push token saved');
      }

      if (!window.__rabeaPushListeners) {
        window.__rabeaPushListeners = true;
        FM.addListener('tokenReceived', function (e) {
          if (e && e.token) db.collection('patients').doc(patientId).update({ fcmToken: e.token }).catch(function () {});
        });
        FM.addListener('notificationReceived', function (e) {
          var n = e && e.notification;
          if (n && typeof window.notify === 'function') window.notify('🔔 ' + (n.title || '') + (n.body ? ' — ' + n.body : ''));
        });
        FM.addListener('notificationActionPerformed', function () {
          if (!/index-home\.html/.test(location.pathname)) location.href = 'index-home.html';
        });
      }
      return token || null;
    } catch (err) {
      log('registerPush error', err);
      return null;
    }
  }

  async function unregisterPush(db, patientId) {
    try {
      if (isNative && P.FirebaseMessaging) await P.FirebaseMessaging.deleteToken();
      if (db && patientId) await db.collection('patients').doc(patientId).update({ fcmToken: firebase.firestore.FieldValue.delete() });
    } catch (e) { log('unregisterPush', e); }
    await cancelReminders();
  }

  // ---------- Local reminders ----------
  function todayParts() {
    var d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), dow: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
  }

  function sessionDate(data) {
    if (data.sessionAt && typeof data.sessionAt.toDate === 'function') return data.sessionAt.toDate(); // Timestamp (لو السكرتارية بتخزنه)
    var p = window.RabeaParser && window.RabeaParser.parseSession(data.appointmentDay, data.sessionTime, todayParts());
    return p ? new Date(p.y, p.m - 1, p.d, p.hh, p.mm, 0) : null;
  }

  async function cancelReminders() {
    var LN = P.LocalNotifications;
    if (!LN) return;
    try {
      var ids = CONFIG.REMINDER_MINUTES_BEFORE.map(function (_, i) { return { id: ID_BASE + i }; });
      await LN.cancel({ notifications: ids });
    } catch (e) {}
  }

  async function scheduleReminders(data) {
    var LN = P.LocalNotifications;
    if (!isNative || !LN || !CONFIG.LOCAL_REMINDERS || !data) return;
    try {
      var perm = await LN.requestPermissions();
      if (perm.display !== 'granted') { log('local notif permission denied'); return; }

      await cancelReminders();
      var when = sessionDate(data);
      if (!when) { log('could not read session date/time', data.appointmentDay, data.sessionTime); return; }

      var now = Date.now(), list = [];
      var child = data.child ? ' ' + data.child : '';
      var doctor = data.doctorName ? ' مع ' + data.doctorName : '';
      CONFIG.REMINDER_MINUTES_BEFORE.forEach(function (mins, i) {
        var at = new Date(when.getTime() - mins * 60000);
        if (at.getTime() <= now) return;
        var body = mins === 0
          ? 'حان الآن موعد جلسة' + child + doctor + ' 💙'
          : 'جلسة' + child + doctor + ' بعد ' + (mins % 60 === 0 ? (mins / 60) + ' ساعة' : mins + ' دقيقة') +
            (data.sessionTime ? ' (الساعة ' + data.sessionTime + ')' : '');
        list.push({
          id: ID_BASE + i,
          title: 'مركز الربيع — تذكير بالجلسة',
          body: body,
          schedule: { at: at, allowWhileIdle: true }
        });
      });
      if (list.length) { await LN.schedule({ notifications: list }); log('scheduled', list.length, 'reminder(s)'); }
    } catch (err) {
      log('scheduleReminders error', err);
    }
  }

  window.RabeaNative = {
    isNative: isNative,
    config: CONFIG,
    registerPush: registerPush,
    unregisterPush: unregisterPush,
    scheduleReminders: scheduleReminders,
    cancelReminders: cancelReminders
  };
})();
