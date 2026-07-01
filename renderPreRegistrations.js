// ============================================================
// PRE-REGISTRATIONS (تسجيل مسبق) — قبول عبر Cloud Function
// ============================================================
async function renderPreRegistrations() {
  const page = $("page");
  page.innerHTML = `
    <div class="page-header">
      <h2>📝 تسجيل مسبق</h2>
      <div class="tools">
        <input type="text" id="search" placeholder="بحث بالاسم…" style="width:240px">
        <button class="ghost" id="refresh">🔄</button>
      </div>
    </div>
    <div id="table-area" class="loading"><div class="spinner"></div></div>
  `;

  let allRows = [];

  async function load() {
    const area = $("table-area");
    area.className = "loading";
    area.innerHTML = '<div class="spinner"></div>';
    try {
      const snap = await getDocs(query(collection(db, "pre_registrations"), limit(500)));
      allRows = [];
      snap.forEach(d => allRows.push({ id: d.id, ...d.data() }));
      // الجداد (pending) الأول
      allRows.sort((a, b) => {
        const sa = a.status === "pending" ? 0 : 1;
        const sb = b.status === "pending" ? 0 : 1;
        if (sa !== sb) return sa - sb;
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      render(allRows);
    } catch (e) {
      area.className = "";
      area.innerHTML = `<div class="empty-state">خطأ: ${escape(e.message)}</div>`;
    }
  }

  function statusPill(st) {
    if (st === "approved") return '<span class="pill green">✓ مقبول</span>';
    if (st === "rejected") return '<span class="pill red">✗ مرفوض</span>';
    return '<span class="pill amber">⏳ قيد المراجعة</span>';
  }

  function render(rows) {
    const area = $("table-area");
    if (rows.length === 0) {
      area.className = "";
      area.innerHTML = '<div class="empty-state">ما كاينش تسجيلات مسبقة 🎉</div>';
      return;
    }
    area.className = "table-wrap auto-cards";

    const btns = (r) => {
      let b = `<button class="ghost" onclick="window.__prView('${r.id}')">عرض</button>`;
      if (r.status !== "approved") {
        b += `<button class="success" onclick="window.__prApprove('${r.id}')">قبول ✓</button>`;
      }
      b += `<button class="danger" onclick="window.__prDelete('${r.id}')">حذف</button>`;
      return b;
    };

    const tableBody = rows.map(r => `
      <tr>
        <td style="font-weight:600">${escape(r.fullName || r.name || '—')}</td>
        <td>${escape(r.specialty || r.category || r.domain || '—')}</td>
        <td>${escape(r.wilaya || r.city || '—')}</td>
        <td>${escape(r.phone || '—')}</td>
        <td>${r.idCardUrl ? `<img src="${r.idCardUrl}" style="max-width:60px;max-height:40px;border-radius:4px" onclick="window.__viewImg('${r.idCardUrl}')">` : '<span class="pill gray">لا بطاقة</span>'}</td>
        <td>${statusPill(r.status)}</td>
        <td class="actions">${btns(r)}</td>
      </tr>
    `).join("");

    const cards = rows.map(r => `
      <div class="data-card">
        <div class="dc-head">
          <strong>${escape(r.fullName || r.name || '—')}</strong>
          ${statusPill(r.status)}
        </div>
        <div class="dc-row"><span class="dc-key">التخصص</span><span class="dc-val">${escape(r.specialty || r.category || r.domain || '—')}</span></div>
        <div class="dc-row"><span class="dc-key">الولاية</span><span class="dc-val">${escape(r.wilaya || r.city || '—')}</span></div>
        <div class="dc-row"><span class="dc-key">الهاتف</span><span class="dc-val">${escape(r.phone || '—')}</span></div>
        <div class="dc-row"><span class="dc-key">الإيميل</span><span class="dc-val">${escape(r.email || '—')}</span></div>
        <div class="dc-row"><span class="dc-key">البطاقة</span><span class="dc-val">${r.idCardUrl ? `<img src="${r.idCardUrl}" style="max-width:80px;max-height:50px;border-radius:4px" onclick="window.__viewImg('${r.idCardUrl}')">` : 'لا بطاقة'}</span></div>
        <div class="dc-actions">${btns(r)}</div>
      </div>
    `).join("");

    area.innerHTML = `
      <div class="table-scroll"><table>
        <thead><tr><th>الاسم</th><th>التخصص</th><th>الولاية</th><th>الهاتف</th><th>البطاقة</th><th>الحالة</th><th>أوامر</th></tr></thead>
        <tbody>${tableBody}</tbody>
      </table></div>
      <div class="cards-list active">${cards}</div>
    `;
  }

  $("refresh").onclick = load;
  $("search").oninput = () => {
    const q = $("search").value.toLowerCase().trim();
    render(q ? allRows.filter(r => (r.fullName || r.name || "").toLowerCase().includes(q)) : allRows);
  };

  window.__prView = (id) => openViewModal("pre_registrations", id);

  window.__prApprove = async (id) => {
    if (!confirm("متأكد باش تقبل هاد الحرفي؟ غادي يبان للزبائن فوراً.")) return;
    try {
      toast("جاري القبول…", "info");
      const fn = httpsCallable(functions, "approvePreRegistration");
      const res = await fn({ preRegId: id });
      toast("اتقبل ✓ الحرفي بان للزبائن", "success");
      load();
    } catch (e) {
      toast("خطأ: " + (e.message || e.code || "فشل القبول"), "error");
    }
  };

  window.__prDelete = async (id) => {
    if (!confirm(`حذف التسجيل ${id}؟`)) return;
    try {
      await deleteDoc(doc(db, "pre_registrations", id));
      toast("اتحذف", "success");
      load();
    } catch (e) { toast("خطأ: " + e.message, "error"); }
  };

  load();
}
