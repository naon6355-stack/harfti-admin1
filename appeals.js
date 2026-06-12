// ============================================================
// appeals.js — قسم الطعون فـ Harfti Admin
// يعتمد على window.__fb المُصدّر من index.html
// ============================================================

function fb() {
  if (!window.__fb) {
    console.error("window.__fb غير موجود - تأكد من التعديلات فالـ HTML");
    return null;
  }
  return window.__fb;
}

let appealChatUnsub = null;

// ============================================================
// الصفحة الرئيسية للطعون
// ============================================================
window.renderAppeals = async function renderAppeals() {
  const { escape } = fb();
  const page = document.getElementById("page");
  page.innerHTML = `
    <div class="page-header">
      <h2>⚖️ الطعون</h2>
      <div class="tools">
        <select id="appeal-filter">
          <option value="pending">قيد المراجعة</option>
          <option value="approved">مقبولة</option>
          <option value="rejected">مرفوضة</option>
          <option value="all">الكل</option>
        </select>
        <button class="ghost" id="refresh-appeals">🔄 تحديث</button>
      </div>
    </div>
    <div id="appeals-area" class="loading"><div class="spinner"></div></div>
  `;

  document.getElementById("refresh-appeals").onclick = loadAppeals;
  document.getElementById("appeal-filter").onchange = loadAppeals;

  loadAppeals();
};

async function loadAppeals() {
  const { db, collection, query, where, limit, getDocs, escape } = fb();
  const area = document.getElementById("appeals-area");
  area.className = "loading";
  area.innerHTML = '<div class="spinner"></div>';
  try {
    const filter = document.getElementById("appeal-filter").value;
    let q;
    if (filter === "all") {
      q = query(collection(db, "appeals"), limit(200));
    } else {
      q = query(collection(db, "appeals"), where("status", "==", filter), limit(200));
    }
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    renderAppealRows(rows);
  } catch (e) {
    area.className = "";
    area.innerHTML = `<div class="empty-state">خطأ: ${escape(e.message)}</div>`;
  }
}

function renderAppealRows(rows) {
  const { escape, fmtDate } = fb();
  const area = document.getElementById("appeals-area");
  area.className = "table-wrap";
  if (rows.length === 0) {
    area.innerHTML = '<div class="empty-state">ما كاينش طعون</div>';
    return;
  }
  const body = rows.map(r => {
    const refund = Math.ceil((r.commissionCharged || 0) * 0.7);
    const statusPill = r.status === "approved" ? '<span class="pill green">مقبول</span>'
      : r.status === "rejected" ? '<span class="pill red">مرفوض</span>'
      : '<span class="pill amber">قيد المراجعة</span>';
    return `<tr>
      <td>${escape(r.workerName || "حرفي")}</td>
      <td>${escape(r.clientName || "زبون")}</td>
      <td><span class="pill amber">${r.commissionCharged || 0} دج</span></td>
      <td style="color:var(--success)">${refund} دج</td>
      <td>${statusPill}</td>
      <td>${fmtDate(r.createdAt)}</td>
      <td class="actions">
        <button class="primary" onclick="window.__openAppeal('${r.id}')">مراجعة</button>
      </td>
    </tr>`;
  }).join("");
  area.innerHTML = `<div class="table-scroll"><table>
    <thead><tr><th>الحرفي</th><th>الزبون</th><th>العمولة</th><th>الاسترجاع (70%)</th><th>الحالة</th><th>التاريخ</th><th>أوامر</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

// ============================================================
// مودال المراجعة: تفاصيل + سكرينشوت + محادثة كاملة + قرار
// ============================================================
window.__openAppeal = async function (appealId) {
  const { db, doc, getDoc, escape } = fb();
  const m = document.getElementById("modal");
  const ov = document.getElementById("modal-overlay");
  m.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  ov.hidden = false;

  try {
    const snap = await getDoc(doc(db, "appeals", appealId));
    if (!snap.exists()) {
      m.innerHTML = `<h3>ما لقيتش الطعن</h3>`;
      return;
    }
    const a = snap.data();
    const refund = Math.ceil((a.commissionCharged || 0) * 0.7);
    const isPending = a.status === "pending";

    const statusBadge = a.status === "approved" ? '<span class="pill green">مقبول</span>'
      : a.status === "rejected" ? '<span class="pill red">مرفوض</span>'
      : '<span class="pill amber">قيد المراجعة</span>';

    m.innerHTML = `
      <h3>⚖️ طعن — ${escape(a.workerName || "حرفي")} ${statusBadge}</h3>

      <div class="field-row">
        <div class="field-key">الحرفي</div>
        <div class="field-val">${escape(a.workerName || "—")} <span style="color:var(--text-dim);font-size:11px">(${escape(a.workerId || "")})</span></div>
      </div>
      <div class="field-row">
        <div class="field-key">الزبون</div>
        <div class="field-val">${escape(a.clientName || "—")} <span style="color:var(--text-dim);font-size:11px">(${escape(a.clientId || "")})</span></div>
      </div>
      <div class="field-row">
        <div class="field-key">العمولة المخصومة</div>
        <div class="field-val"><span class="pill amber">${a.commissionCharged || 0} دج</span> → استرجاع متوقع: <span style="color:var(--success)">${refund} دج</span></div>
      </div>
      <div class="field-row">
        <div class="field-key">حالة المهمة</div>
        <div class="field-val">${escape(a.requestStatus || "—")}</div>
      </div>
      <div class="field-row">
        <div class="field-key">السبب</div>
        <div class="field-val" style="white-space:pre-wrap">${escape(a.reason || "—")}</div>
      </div>
      <div class="field-row">
        <div class="field-key">لقطة الشاشة</div>
        <div class="field-val">${a.screenshotUrl ? `<img src="${a.screenshotUrl}" style="max-width:160px;cursor:zoom-in" onclick="window.__viewImg('${a.screenshotUrl}')">` : "—"}</div>
      </div>
      ${a.adminNote ? `<div class="field-row"><div class="field-key">ملاحظة الأدمين</div><div class="field-val">${escape(a.adminNote)}</div></div>` : ""}

      <div style="margin-top:16px">
        <div class="field-key" style="margin-bottom:8px">💬 المحادثة الكاملة (من السارفر)</div>
        <div id="appeal-chat" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;max-height:320px;overflow-y:auto">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>

      ${isPending ? `
        <div class="edit-field" style="margin-top:16px">
          <label>ملاحظة (اختيارية - تُحفظ مع القرار)</label>
          <input type="text" id="appeal-note" placeholder="ملاحظة للأرشيف...">
        </div>
        <div class="modal-actions">
          <button class="success" id="appeal-approve" style="padding:10px 18px">✅ قبول (استرجاع ${refund} دج)</button>
          <button class="danger" id="appeal-reject" style="padding:10px 18px">❌ رفض</button>
          <button class="ghost" onclick="window.__closeAppeal()">تراجع</button>
        </div>
      ` : `
        <div class="modal-actions">
          <button class="ghost" onclick="window.__closeAppeal()">إغلاق</button>
        </div>
      `}
    `;

    // تحميل المحادثة
    loadAppealChat(a.requestId, a.workerId);

    // أزرار القرار
    if (isPending) {
      document.getElementById("appeal-approve").onclick = () => decideAppeal(appealId, "approve");
      document.getElementById("appeal-reject").onclick = () => decideAppeal(appealId, "reject");
    }
  } catch (e) {
    m.innerHTML = `<h3>خطأ</h3><p>${escape(e.message)}</p>`;
  }
};

window.__closeAppeal = function () {
  document.getElementById("modal-overlay").hidden = true;
  if (appealChatUnsub) { appealChatUnsub(); appealChatUnsub = null; }
};

// ============================================================
// تحميل المحادثة من chats/{requestId}/messages
// ============================================================
async function loadAppealChat(requestId, workerId) {
  const { db, collection, query, getDocs, escape } = fb();
  const chatDiv = document.getElementById("appeal-chat");
  if (!chatDiv || !requestId) {
    if (chatDiv) chatDiv.innerHTML = '<p style="color:var(--text-dim)">لا يوجد معرّف محادثة.</p>';
    return;
  }
  try {
    // نجيب الرسائل ونرتبها محلياً (تفادي الحاجة لـ index)
    const snap = await getDocs(collection(db, "chats", requestId, "messages"));
    const msgs = [];
    snap.forEach(d => msgs.push(d.data()));
    msgs.sort((x, y) => (x.timestamp || 0) - (y.timestamp || 0));

    if (msgs.length === 0) {
      chatDiv.innerHTML = '<p style="color:var(--text-dim)">لا توجد رسائل في هذه المحادثة.</p>';
      return;
    }

    chatDiv.innerHTML = msgs.map(msg => {
      const isWorker = msg.senderId === workerId;
      const align = isWorker ? "margin-right:auto;background:#1a3a5c" : "margin-left:auto;background:var(--bg-3)";
      const who = isWorker ? "الحرفي" : "الزبون";
      const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }) : "";
      const content = msg.isImage && msg.imageUrl
        ? `<img src="${msg.imageUrl}" style="max-width:160px;border-radius:6px;cursor:zoom-in" onclick="window.__viewImg('${msg.imageUrl}')">`
        : `<span style="color:#fff;font-size:13px">${escape(msg.text || "")}</span>`;
      return `<div style="margin:6px 0;padding:8px 12px;border-radius:10px;max-width:78%;${align}">
        <div style="font-size:9px;color:var(--text-dim);margin-bottom:3px">${who} • ${time}</div>
        ${content}
      </div>`;
    }).join("");
  } catch (e) {
    chatDiv.innerHTML = `<p style="color:var(--danger)">خطأ في تحميل المحادثة: ${escape(e.message)}</p>`;
  }
}

// ============================================================
// تطبيق القرار عبر Cloud Function reviewAppeal
// ============================================================
async function decideAppeal(appealId, decision) {
  const { functions, httpsCallable, toast } = fb();
  const label = decision === "approve" ? "قبول" : "رفض";
  if (!confirm("هل أنت متأكد من " + label + " هذا الطعن؟")) return;

  const note = document.getElementById("appeal-note")?.value || "";

  // عطّل الأزرار وقت التنفيذ
  const approveBtn = document.getElementById("appeal-approve");
  const rejectBtn = document.getElementById("appeal-reject");
  if (approveBtn) approveBtn.disabled = true;
  if (rejectBtn) rejectBtn.disabled = true;

  try {
    const reviewAppeal = httpsCallable(functions, "reviewAppeal");
    const res = await reviewAppeal({ appealId, decision, adminNote: note });
    const data = res.data || {};

    if (decision === "approve") {
      toast("✅ تم القبول. الاسترجاع: " + (data.refund || 0) + " دج", "success");
    } else {
      toast(data.penalty > 0
        ? "❌ تم الرفض. العقوبة: " + data.penalty + " دج"
        : "❌ تم الرفض (تحذير أول، بلا خصم)", "success");
    }
    window.__closeAppeal();
    loadAppeals();
  } catch (e) {
    toast("خطأ: " + e.message, "error");
    if (approveBtn) approveBtn.disabled = false;
    if (rejectBtn) rejectBtn.disabled = false;
  }
}
