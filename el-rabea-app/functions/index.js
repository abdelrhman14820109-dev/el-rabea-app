/**
 * Cloud Functions اختيارية — مركز الربيع
 *  1) notifyOnSessionChange: لما السكرتارية تحدد/تغيّر موعد الجلسة → إشعار فوري لولي الأمر
 *  2) sessionReminders: كل 10 دقايق بتبعت تذكير قبل الجلسة ووقتها (لو SEND_REMINDERS = true)
 * بتحتاج خطة Blaze في Firebase (فيها حصة مجانية كبيرة).
 */
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { parseSession } = require('./session-parser');

admin.initializeApp();
const db = admin.firestore();

// ===== إعدادات =====
const REGION = 'us-central1';          // لازم تطابق مكان Firestore (شوفه من Firebase Console → Firestore → Data)
const TZ = 'Africa/Cairo';
const REMINDER_MINUTES_BEFORE = [60, 0];
const SEND_REMINDERS = true;           // لو true → خلّي LOCAL_REMINDERS = false في www/native.js
const WINDOW_MIN = 15;                 // لازم أكبر من فترة التشغيل (10 دقايق)

// ===== أدوات التوقيت (بتوقيت القاهرة) =====
function tzParts(date) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', weekday: 'short'
  });
  const o = {};
  f.formatToParts(date).forEach((p) => { o[p.type] = p.value; });
  return {
    y: +o.year, m: +o.month, d: +o.day, hh: +o.hour % 24, mm: +o.minute,
    dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday)
  };
}

function cairoToUtc(p) {
  const guess = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
  const g = tzParts(new Date(guess));
  const offset = Date.UTC(g.y, g.m - 1, g.d, g.hh, g.mm) - guess;
  return new Date(guess - offset);
}

// الجلسة المقصودة بالنسبة للحظة "probe" (مهم لو اليوم مكتوب باسم اليوم بس)
function sessionAround(data, probe) {
  if (data.sessionAt && typeof data.sessionAt.toDate === 'function') return data.sessionAt.toDate();
  const t = tzParts(probe);
  const p = parseSession(data.appointmentDay, data.sessionTime, { y: t.y, m: t.m, d: t.d, dow: t.dow, min: t.hh * 60 + t.mm });
  return p ? cairoToUtc(p) : null;
}

// ===== الإرسال =====
async function send(docRef, token, title, body) {
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: { type: 'session' },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } }
    });
    return true;
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
      await docRef.update({ fcmToken: admin.firestore.FieldValue.delete() }).catch(() => {});
    } else {
      console.error('send failed', err.code || err.message);
    }
    return false;
  }
}

// ===== 1) إشعار فوري عند تغيير الموعد =====
exports.notifyOnSessionChange = onDocumentUpdated({ document: 'patients/{id}', region: REGION }, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  if (!after.fcmToken) return;

  const keys = ['appointmentDay', 'sessionTime', 'doctorName', 'sessionAt'];
  const changed = keys.some((k) => JSON.stringify(before[k] || null) !== JSON.stringify(after[k] || null));
  if (!changed || (!after.appointmentDay && !after.sessionTime && !after.sessionAt)) return;

  const parts = [after.appointmentDay, after.sessionTime && ('الساعة ' + after.sessionTime)].filter(Boolean).join(' ');
  const who = after.doctorName ? ' مع ' + after.doctorName : '';
  await send(event.data.after.ref, after.fcmToken,
    'تم تحديد موعد جلسة 📅',
    (after.child ? after.child + ': ' : '') + parts + who);
});

// ===== 2) تذكير قبل/وقت الجلسة =====
exports.sessionReminders = onSchedule({ schedule: 'every 10 minutes', timeZone: TZ, region: REGION }, async () => {
  if (!SEND_REMINDERS) return;
  const now = Date.now();
  const snap = await db.collection('patients').where('fcmToken', '>', '').get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const sent = Array.isArray(data.remindersSent) ? data.remindersSent : [];

    for (const mins of REMINDER_MINUTES_BEFORE) {
      // الجلسة اللي وقت تذكيرها وقع في آخر WINDOW_MIN دقيقة
      const probe = new Date(now + mins * 60000 - WINDOW_MIN * 60000 - 60000);
      const when = sessionAround(data, probe);
      if (!when) continue;

      const remindAt = when.getTime() - mins * 60000;
      if (remindAt > now || remindAt < now - WINDOW_MIN * 60000) continue;

      const key = when.toISOString() + '|' + mins;
      if (sent.includes(key)) continue;

      const body = mins === 0
        ? 'حان الآن موعد جلسة ' + (data.child || '') + (data.doctorName ? ' مع ' + data.doctorName : '') + ' 💙'
        : 'جلسة ' + (data.child || '') + ' بعد ' + (mins % 60 === 0 ? (mins / 60) + ' ساعة' : mins + ' دقيقة') +
          (data.sessionTime ? ' (الساعة ' + data.sessionTime + ')' : '');

      const ok = await send(doc.ref, data.fcmToken, 'مركز الربيع — تذكير بالجلسة', body);
      if (ok) {
        sent.push(key);
        await doc.ref.update({ remindersSent: sent.slice(-10) });
      }
    }
  }
});
