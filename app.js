'use strict';
const STORAGE = 'pagespeed-workbench-reports-v1';
const KEY_STORAGE = 'pagespeed-workbench-key';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function canonicalURL(url) { return new URL(url).href.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase()); }
function parseURLs(text) {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Enter at least one URL.');
  return [...new Set(lines.map(line => {
    let url;
    try { url = new URL(line); } catch { throw new Error(`Invalid URL: ${line}. Include https:// or http://.`); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(`Invalid URL: ${line}. Use an HTTP(S) URL without credentials.`);
    return canonicalURL(url.href);
  }))];
}
function buildQueue(urls, choice) { return urls.flatMap(url => (choice === 'both' ? ['mobile','desktop'] : [choice]).map(strategy => ({url,strategy}))); }
function makeReport(data, url, strategy) {
  const lighthouse = data.lighthouseResult;
  if (!lighthouse || lighthouse.runtimeError) throw new Error(lighthouse?.runtimeError?.message || 'Google did not return a Lighthouse report.');
  const audits = lighthouse.audits || {};
  const recommendations = (lighthouse.categories?.performance?.auditRefs || []).flatMap(ref => {
    const audit = audits[ref.id];
    const isInsight = ref.group === 'insights' || ref.group === 'load-opportunities' || ref.id.endsWith('-insight');
    if (!audit || !isInsight || audit.score === 1 || ['notApplicable', 'error', 'manual'].includes(audit.scoreDisplayMode)) return [];
    return [{title:audit.title, description:audit.description || '', displayValue:audit.displayValue || ''}];
  });
  const metricIds = ['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index'];
  return {id:crypto.randomUUID(), url, finalUrl:lighthouse.finalDisplayedUrl || lighthouse.finalUrl || url, strategy, date:lighthouse.fetchTime || new Date().toISOString(), score:lighthouse.categories?.performance?.score == null ? null : Math.round(lighthouse.categories.performance.score * 100), metrics:metricIds.flatMap(id => audits[id]?.displayValue ? [{title:audits[id].title, value:audits[id].displayValue}] : []), recommendations, googleResponse:data};
}
function compatible(before, after) { return canonicalURL(before.url) === canonicalURL(after.url) && before.strategy === after.strategy; }
function filename(report, type, ext) { return `pagespeed-${new URL(report.url).hostname}-${report.strategy}-${type}.${ext}`; }
function clientReport(before, after, notes) {
  if (!compatible(before, after)) throw new Error('Compare the same URL and device.');
  return websiteReport(new URL(after.url).hostname, [{url:after.url, strategy:after.strategy, before, after, notes}], false);
}
function aiExport(before, after, notes) {
  if (!compatible(before, after)) throw new Error('Compare the same URL and device.');
  return {format:'PageSpeed Workbench comparison v1', instructions:'Compare the before and after Google responses. Use lighthouseResult audits, details, metricSavings and field data where available. Identify remaining actionable issues and affected resources, cite the audit IDs and evidence, and do not assume a cause for score changes. Check the actual codebase before making changes.', url:after.url, strategy:after.strategy, changesDescribedByUser:notes, before:{date:before.date, score:before.score, googleResponse:before.googleResponse || null, savedSummary:before.googleResponse ? undefined : before}, after:{date:after.date, score:after.score, googleResponse:after.googleResponse || null, savedSummary:after.googleResponse ? undefined : after}, note:'A null googleResponse indicates an older summary-only report; run a new audit to capture the full response.'};
}
function websiteReport(domain, comparisons, showMissingDevices = true) {
  const e = escapeHTML;
  const digits = value => String(value).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  const faDate = date => {
    const d = new Date(date);
    return Number.isNaN(d.valueOf()) ? 'تاریخ ثبت نشده' : new Intl.DateTimeFormat('fa-IR-u-ca-persian', {year:'numeric', month:'long', day:'numeric'}).format(d);
  };
  const faValue = value => {
    if (value == null || value === '') return '—';
    return digits(String(value).replace(/(\d)\.(\d)/g, '$1٫$2').replace(/(\d),(\d)/g, '$1٬$2').replace(/\s*ms\b/g, ' میلی‌ثانیه').replace(/\s*s\b/g, ' ثانیه'));
  };
  const metricNames = {
    'First Contentful Paint':'زمان نمایش اولین محتوای صفحه',
    'Largest Contentful Paint':'زمان نمایش محتوای اصلی صفحه',
    'Total Blocking Time':'زمان مسدود بودن صفحه',
    'Cumulative Layout Shift':'میزان جابه‌جایی عناصر صفحه',
    'Speed Index':'شاخص سرعت نمایش صفحه'
  };
  const insights = {
    'use efficient cache lifetimes':'بهبود مدت نگهداری فایل‌ها در حافظه مرورگر',
    'font display':'بهبود نمایش نوشته‌ها هنگام بارگذاری قلم',
    'improve image delivery':'بهینه‌سازی حجم و بارگذاری تصاویر',
    'layout shift culprits':'کاهش جابه‌جایی ناگهانی عناصر صفحه',
    'network dependency tree':'بهبود ترتیب بارگذاری منابع صفحه',
    'render-blocking requests':'کاهش منابعی که نمایش صفحه را به تأخیر می‌اندازند',
    'forced reflow':'کاهش پردازش‌های اضافی هنگام نمایش صفحه',
    'lcp request discovery':'بهبود شناسایی و بارگذاری محتوای اصلی صفحه',
    'lcp breakdown':'بررسی عوامل مؤثر بر سرعت نمایش محتوای اصلی',
    'document request latency':'کاهش زمان پاسخ اولیه صفحه',
    'legacy javascript':'کاهش کدهای غیرضروری برای مرورگرهای قدیمی',
    'reduce unused javascript':'کاهش کدهای جاوااسکریپت استفاده‌نشده',
    'reduce unused css':'کاهش کدهای ظاهری استفاده‌نشده',
    'minify javascript':'کم‌حجم‌سازی فایل‌های جاوااسکریپت',
    'minify css':'کم‌حجم‌سازی فایل‌های ظاهری',
    'avoid enormous network payloads':'کاهش حجم فایل‌های دریافتی صفحه',
    'serve images in next-gen formats':'استفاده از قالب‌های مناسب‌تر برای تصاویر',
    'properly size images':'استفاده از تصاویر با اندازه مناسب',
    'eliminate render-blocking resources':'کاهش منابعی که نمایش صفحه را به تأخیر می‌اندازند'
  };
  const scoreClass = score => score == null ? 'unknown' : score >= 90 ? 'good' : score >= 50 ? 'medium' : 'poor';
  const scoreText = score => score == null ? 'نامشخص' : score >= 90 ? 'خوب' : score >= 50 ? 'نیازمند بهبود' : 'ضعیف';
  const displayURL = url => { try { return decodeURI(url); } catch { return url; } };
  const scoreCard = (report, label, waiting) => {
    if (!report) return `<div class="score-card pending"><div class="card-label">${label}</div><div class="pending-mark">—</div><p>${waiting ? 'نتایج پس از بهینه سازی در اینجا قرار خواهد گرفت' : 'برای این دستگاه هنوز آزمایشی ثبت نشده است.'}</p></div>`;
    return `<div class="score-card ${scoreClass(report.score)}"><div class="card-label">${label}</div><div class="score-line"><strong>${report.score == null ? '—' : digits(report.score)}</strong><span>از ۱۰۰<br><b>${scoreText(report.score)}</b></span></div><div class="date">تاریخ آزمایش: ${e(faDate(report.date))}</div></div>`;
  };
  const pages = new Map();
  for (const item of comparisons) { if (!pages.has(item.url)) pages.set(item.url, []); pages.get(item.url).push(item); }
  const sections = [...pages].map(([url, devices], index) => {
    const cards = (showMissingDevices ? ['mobile','desktop'] : devices.map(item => item.strategy)).map(strategy => {
      const item = devices.find(d => d.strategy === strategy);
      const label = strategy === 'mobile' ? 'تلفن همراه' : 'رایانه';
      const before = item?.before, after = item?.after;
      const names = [...new Set([...(before?.metrics || []), ...(after?.metrics || [])].map(m => m.title))].filter(name => metricNames[name]);
      const metric = (report, name) => report?.metrics?.find(m => m.title === name)?.value;
      const diff = before?.score != null && after?.score != null ? after.score-before.score : null;
      const difference = diff == null ? '' : `<span class="change ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff > 0 ? `افزایش ${digits(diff)} امتیاز` : diff < 0 ? `کاهش ${digits(Math.abs(diff))} امتیاز` : 'بدون تغییر در امتیاز'}</span>`;
      const current = after || before;
      const known = [], unique = new Set(); let other = 0;
      for (const audit of current?.recommendations || []) {
        const translated = insights[String(audit.title || '').trim().toLowerCase()];
        if (translated && !unique.has(translated)) { unique.add(translated); known.push(translated); }
        else if (!translated) other++;
      }
      const recommendations = current ? `<div class="insight-block"><h4>موارد قابل بررسی ${after ? 'پس از بهینه‌سازی' : 'در بررسی اولیه'}</h4>${known.length ? `<ul>${known.map(text => `<li>${e(text)}</li>`).join('')}</ul>` : '<p>پیشنهادی در این بخش ثبت نشده است.</p>'}${other ? `<p class="more">${digits(other)} مورد فنی دیگر در گزارش تخصصی گوگل موجود است.</p>` : ''}</div>` : '';
      const metrics = names.length ? `<div class="metrics-block"><h4>شاخص‌های عملکرد</h4><table><thead><tr><th>شاخص</th><th>پیش از بهینه‌سازی</th><th>پس از بهینه‌سازی</th></tr></thead><tbody>${names.map(name => `<tr><th scope="row">${e(metricNames[name])}</th><td>${e(faValue(metric(before,name)))}</td><td>${e(faValue(metric(after,name)))}</td></tr>`).join('')}</tbody></table></div>` : '';
      return `<article class="device"><div class="device-title"><h3>${label}</h3>${difference}</div><div class="comparison">${scoreCard(before,'پیش از بهینه‌سازی',false)}${scoreCard(after,'پس از بهینه‌سازی',true)}</div>${item?.notes?.trim() ? `<div class="work"><strong>اقدامات انجام‌شده</strong><p>${e(item.notes.trim())}</p></div>` : ''}${metrics}${recommendations}</article>`;
    }).join('');
    return `<section class="page-section"><div class="page-heading"><span class="page-number">${digits(String(index + 1).padStart(2,'0'))}</span><div><h2>صفحه ${digits(index + 1)}</h2><div class="url" dir="ltr">${e(displayURL(url))}</div></div></div>${cards}</section>`;
  }).join('');
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>گزارش عملکرد وب‌سایت ${e(domain)}</title><style>
  *{box-sizing:border-box}html{background:#eef3f5}body{margin:0;color:#20313c;font-family:Vazirmatn,IRANYekan,Tahoma,'DejaVu Sans',sans-serif;line-height:1.8;font-size:13px;print-color-adjust:exact;-webkit-print-color-adjust:exact}.sheet{max-width:940px;margin:32px auto;background:white;padding:42px 48px;box-shadow:0 8px 32px #29425718}.toolbar{max-width:940px;margin:22px auto -15px;text-align:left}.toolbar button{border:0;border-radius:9px;padding:11px 20px;background:#12677b;color:white;font:inherit;cursor:pointer}.masthead{border-top:7px solid #167b88;padding-top:20px}.kicker{color:#16818b;font-size:11px;font-weight:700;letter-spacing:.02em}.masthead h1{font-size:28px;line-height:1.5;margin:7px 0 5px;color:#193544}.lead{margin:0;color:#657985}.meta{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0 0}.meta span{background:#f0f6f7;border:1px solid #dce9eb;border-radius:8px;padding:7px 12px;font-size:12px}.meta .domain{direction:ltr;unicode-bidi:isolate}.guide{margin:24px 0 12px;padding:13px 16px;border-right:4px solid #5aaeb6;background:#f2f8f8;color:#506b76;font-size:12px}.legend{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0 25px;color:#687c85;font-size:11px}.legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-left:5px}.page-section{border-top:1px solid #dce8ea;padding:23px 0 10px}.page-heading{display:flex;align-items:center;gap:13px;margin-bottom:12px;break-after:avoid}.page-number{display:grid;place-items:center;flex:none;width:39px;height:39px;border-radius:10px;background:#e7f4f4;color:#177985;font-size:14px;font-weight:700}.page-heading h2{font-size:17px;margin:0}.url{direction:ltr;text-align:right;unicode-bidi:isolate;color:#71838b;font-size:11px;overflow-wrap:anywhere}.device{margin:16px 0 23px}.device-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px;break-after:avoid}.device-title h3{font-size:15px;margin:0}.change{font-size:11px;padding:4px 9px;background:#eef2f3;border-radius:20px;color:#657982}.change.up{background:#e5f5ef;color:#16805a}.change.down{background:#fff0ed;color:#b54a40}.comparison{display:flex;gap:10px;break-inside:avoid}.score-card{width:50%;min-height:125px;border:1px solid;border-radius:11px;padding:12px 16px}.score-card.good{background:#ecf8f2;border-color:#b9e3cf;color:#137c50}.score-card.medium{background:#fff8e9;border-color:#f1d9a0;color:#9b690d}.score-card.poor{background:#fff0ed;border-color:#f0c6c0;color:#b64237}.score-card.unknown{background:#f5f7f7;border-color:#d9e1e2;color:#60747a}.score-card.pending{background:#f7f9fa;border:1px dashed #c6d4d8;color:#71838a}.card-label{font-size:11px;font-weight:700}.score-line{display:flex;align-items:center;gap:9px;margin:5px 0}.score-line strong{font-size:34px;line-height:1.2}.score-line span{font-size:10px;line-height:1.7}.score-line b{font-size:11px}.date{font-size:10px;opacity:.8}.pending-mark{font-size:25px;line-height:1.3}.pending p{font-size:11px;margin:3px 0 0}.metrics-block,.insight-block,.work{margin-top:15px;break-inside:avoid}.metrics-block h4,.insight-block h4{font-size:12px;margin:0 0 6px;color:#2a4a58}table{border-collapse:collapse;width:100%;font-size:11px}th,td{text-align:right;padding:7px 9px;border-bottom:1px solid #edf1f2}thead th{background:#f3f7f8;color:#657c85;font-weight:600}tbody th{font-weight:500}td{white-space:nowrap}.insight-block ul{margin:4px 0;padding-right:19px;columns:2;column-gap:25px}.insight-block li{break-inside:avoid;margin:2px 0;color:#455e68}.insight-block p,.work p{margin:3px 0;color:#677d86}.work{background:#f4f8f9;padding:9px 12px;border-radius:7px;white-space:pre-wrap}.work strong{color:#2a4a58}.more{font-size:11px}.footer{border-top:1px solid #dce8ea;padding-top:15px;color:#73878e;font-size:10px}.footer b{color:#527078}@page{size:A4;margin:13mm}@media print{html{background:#fff}.toolbar{display:none}.sheet{max-width:none;margin:0;padding:0;box-shadow:none}.masthead{padding-top:12px}.page-section{padding-top:14px}.device{margin:10px 0 16px}.score-card{min-height:108px}.metrics-block,.insight-block,.work{margin-top:10px}}@media screen and (max-width:600px){.sheet{padding:24px 18px;margin:20px 10px}.toolbar{margin:15px 10px}.comparison{flex-direction:column}.score-card{width:100%}.insight-block ul{columns:1}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">چاپ یا ذخیره به صورت PDF</button></div><main class="sheet"><header class="masthead"><div class="kicker">گزارش بررسی وب‌سایت · GOOGLE PAGESPEED INSIGHTS</div><h1>گزارش سرعت و عملکرد وب‌سایت</h1><p class="lead">مقایسه وضعیت صفحات در تلفن همراه و رایانه</p><div class="meta"><span>وب‌سایت: <b class="domain" dir="ltr">${e(domain)}</b></span><span>تعداد صفحات: <b>${digits(pages.size)}</b></span><span>تاریخ تهیه گزارش: <b>${e(faDate(new Date()))}</b></span></div></header><div class="guide">امتیاز عملکرد از ۱۰۰ محاسبه می‌شود؛ عدد بالاتر نشان‌دهنده عملکرد بهتر در همان آزمایش است. در صورت آماده نبودن نتیجه پس از بهینه‌سازی، بخش مربوطه برای تکمیل بعدی در نظر گرفته شده است.</div><div class="legend"><span><i style="background:#16a46b"></i>۹۰ تا ۱۰۰: خوب</span><span><i style="background:#dfa42b"></i>۵۰ تا ۸۹: نیازمند بهبود</span><span><i style="background:#d85b4c"></i>۰ تا ۴۹: ضعیف</span></div>${sections}<footer class="footer"><b>درباره این گزارش:</b> نتایج بر اساس آزمایش‌های PageSpeed Insights گوگل تهیه شده‌اند و ممکن است در هر نوبت تغییر کنند. برای بررسی جزئیات فنی و داده‌های کامل، از گزارش تخصصی استفاده کنید.</footer></main></body></html>`;
}
function websiteData(domain, comparisons, history) {
  return {format:'PageSpeed Workbench website report v1', domain, instructions:'Review the complete Google responses by page and device. Compare selected before and after runs when available. Identify actionable issues with audit IDs and evidence. Do not infer causation from scores alone; inspect the codebase before making changes.', comparisons:comparisons.map(({url,strategy,before,after,notes}) => ({url,strategy,beforeId:before.id,afterId:after?.id || null,changesDescribedByUser:notes})), reports:history.map(r => ({id:r.id,url:r.url,strategy:r.strategy,date:r.date,score:r.score,googleResponse:r.googleResponse || null,savedSummary:r.googleResponse ? undefined : r})), note:'A null googleResponse is an older summary-only report; rerun that page to capture the full response.'};
}
if (typeof module !== 'undefined') module.exports = {parseURLs, buildQueue, makeReport, compatible, clientReport, aiExport, websiteReport, websiteData};
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  let reports = [], db;
  const message = (text, error = false) => { $('message').textContent = text; $('message').className = error ? 'error' : ''; };
  function transaction(store, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode); const request = action(tx.objectStore(store));
      tx.oncomplete = () => resolve(request?.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted.'));
    });
  }
  async function openStorage() {
    db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('pagespeed-workbench', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('reports', {keyPath:'id'}); request.result.createObjectStore('meta'); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const migrated = await transaction('meta', 'readonly', store => store.get('legacyMigrated'));
    if (!migrated) {
      const legacy = JSON.parse(localStorage.getItem(STORAGE) || '[]');
      if (!Array.isArray(legacy)) throw new Error('The old report data is invalid. It was left untouched.');
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['reports','meta'], 'readwrite'); const store = tx.objectStore('reports');
        legacy.forEach(report => store.put(report)); tx.objectStore('meta').put(true, 'legacyMigrated');
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Migration failed.'));
      });
    }
    reports = await transaction('reports', 'readonly', store => store.getAll());
    reports.sort((a,b) => new Date(b.date) - new Date(a.date));
  }
  function download(name, content, type) {
    const href = URL.createObjectURL(new Blob([content], {type})); const a = document.createElement('a'); a.href = href; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  function noteKey(url, strategy) { return `pagespeed-workbench-notes:${JSON.stringify([url, strategy])}`; }
  function readNote(url, strategy) { try { return localStorage.getItem(noteKey(url, strategy)); } catch { return null; } }
  function render() {
    $('count').textContent = reports.length;
    if (!reports.length) { $('reports').innerHTML = '<div class="empty"><div class="empty-icon">✳</div><strong>Your first website starts here</strong><p>Run an analysis to create a website folder and capture your baseline.</p></div>'; return; }
    const openDomains = new Set([...document.querySelectorAll('.site-folder[open]')].map(folder => folder.dataset.domain));
    const domains = new Map();
    for (const r of reports) {
      let domain; try { domain = new URL(r.url).hostname; } catch { domain = 'Other'; }
      if (!domains.has(domain)) domains.set(domain, new Map());
      const pages = domains.get(domain);
      const pageURL = canonicalURL(r.url);
      if (!pages.has(pageURL)) pages.set(pageURL, new Map());
      const devices = pages.get(pageURL);
      if (!devices.has(r.strategy)) devices.set(r.strategy, []);
      devices.get(r.strategy).push(r);
    }
    $('reports').innerHTML = [...domains].map(([domain,pages]) => `<details class="site-folder" data-domain="${escapeHTML(domain)}" ${openDomains.has(domain) ? 'open' : ''}><summary><span>📁</span> ${escapeHTML(domain)} <small>${pages.size} page${pages.size === 1 ? '' : 's'} · Open folder</small></summary><div class="folder-content"><div class="folder-actions"><p>Download a report for every page and device in this folder.</p><p class="folder-error" role="status" aria-live="polite"></p><button class="download" data-action="site-client">↓ Full client report</button> <button class="download" data-action="site-ai">↓ Full AI report (JSON)</button></div>${[...pages].map(([url,devices]) => `<section class="url-group"><div class="page-heading"><strong>${escapeHTML(url)}</strong></div><div class="device-grid">${['mobile','desktop'].map(strategy => {
      const group = devices.get(strategy);
      if (!group) return `<div class="device-card empty-device"><strong>${strategy}</strong><p>No ${strategy} report yet.</p></div>`;
      const latest = group[0], options = group.map(r => `<option value="${escapeHTML(r.id)}">${escapeHTML(new Date(r.date).toLocaleString())} · ${escapeHTML(r.score ?? '—')}/100${r.googleResponse ? '' : ' · summary only'}</option>`).join('');
      return `<section class="page-group device-card" data-url="${escapeHTML(url)}" data-strategy="${escapeHTML(strategy)}"><div class="page-heading"><div><strong>${escapeHTML(strategy)}</strong><small>${group.length} run${group.length === 1 ? '' : 's'}</small></div><span class="latest-score">${escapeHTML(latest.score ?? '—')}<small> / 100</small></span></div><div class="compare-controls"><label>Before<select class="before-select">${options}</select></label><label>After<select class="after-select">${options}</select></label></div><label class="notes-label">Work completed <span>OPTIONAL</span><textarea class="change-notes" rows="2" placeholder="e.g. Compressed images and removed unused scripts">${escapeHTML(readNote(url, strategy) ?? group.map(r => readNote(r.url, strategy)).find(note => note !== null) ?? '')}</textarea></label><div class="page-actions"><button class="download" data-action="client" ${group.length < 2 ? 'disabled' : ''}>↓ Client report</button><button class="download" data-action="ai" ${group.length < 2 ? 'disabled' : ''}>↓ AI comparison</button><button class="download secondary" data-action="raw">↓ Google JSON</button></div>${group.length < 2 ? '<p class="hint">Run again for a before-and-after comparison.</p>' : ''}${group.some(r => !r.googleResponse) ? '<p class="hint">Older summary-only reports do not contain the complete Google response.</p>' : ''}<details class="run-list"><summary>View and manage ${group.length} saved run${group.length === 1 ? '' : 's'}</summary>${group.map(r => `<div class="run-row"><span>${escapeHTML(new Date(r.date).toLocaleString())} · ${escapeHTML(r.score ?? '—')}/100${r.googleResponse ? '' : ' · summary only'}</span><button class="delete" data-action="delete" data-id="${escapeHTML(r.id)}" aria-label="Delete report from ${escapeHTML(r.date)}">Delete</button></div>`).join('')}</details></section>`;
    }).join('')}</div></section>`).join('')}</div></details>`).join('');
    document.querySelectorAll('.page-group').forEach(group => { const before = group.querySelector('.before-select'); before.selectedIndex = before.options.length - 1; });
  }
  $('reports').addEventListener('input', e => {
    if (!e.target.matches('.change-notes')) return;
    const group = e.target.closest('.page-group');
    try { localStorage.setItem(noteKey(group.dataset.url, group.dataset.strategy), e.target.value); } catch { message('Could not save your notes in browser storage.', true); }
  });
  $('reports').addEventListener('click', async e => {
    const button = e.target.closest('button[data-action]'); if (!button) return;
    const folder = button.closest('.site-folder'); const group = button.closest('.page-group');
    const before = group && reports.find(r => r.id === group.querySelector('.before-select').value);
    const after = group && reports.find(r => r.id === group.querySelector('.after-select').value);
    const notes = group?.querySelector('.change-notes').value || '';
    try {
      folder.querySelector('.folder-error').textContent = '';
      if (button.dataset.action === 'site-client' || button.dataset.action === 'site-ai') {
        const comparisons = [...folder.querySelectorAll('.page-group')].map(item => {
          const first = reports.find(r => r.id === item.querySelector('.before-select').value);
          const last = reports.find(r => r.id === item.querySelector('.after-select').value);
          if (!first || !last) throw new Error('A selected report is unavailable. Refresh the page and try again.');
          if (new Date(first.date) > new Date(last.date)) throw new Error(`Choose an earlier Before run for ${item.dataset.url} (${item.dataset.strategy}).`);
          return {url:item.dataset.url, strategy:item.dataset.strategy, before:first, after:first.id === last.id ? null : last, notes:item.querySelector('.change-notes').value};
        });
        const domain = folder.dataset.domain;
        const history = reports.filter(r => new URL(r.url).hostname === domain);
        if (button.dataset.action === 'site-client') download(`pagespeed-${domain}-full-report.html`, websiteReport(domain,comparisons), 'text/html;charset=utf-8');
        else download(`pagespeed-${domain}-full-ai-report.json`, JSON.stringify(websiteData(domain,comparisons,history),null,2), 'application/json');
      } else if (button.dataset.action === 'delete') {
        const report = reports.find(r => r.id === button.dataset.id); if (!report || !confirm('Delete this saved report?')) return;
        await transaction('reports','readwrite',store => store.delete(report.id)); reports = reports.filter(r => r.id !== report.id); render();
      } else if (button.dataset.action === 'raw') {
        if (!after.googleResponse) throw new Error('This older run contains only a summary. Choose a newer run or run PageSpeed again to capture the complete response.');
        download(filename(after,'google-response','json'), JSON.stringify(after.googleResponse,null,2), 'application/json');
      } else {
        if (!before || !after || before.id === after.id) throw new Error('Choose two different runs to make a before-and-after report.');
        if (new Date(before.date) > new Date(after.date)) throw new Error('Choose an earlier run for Before and a later run for After.');
        if (button.dataset.action === 'client') download(filename(after,'client-report','html'), clientReport(before,after,notes), 'text/html;charset=utf-8');
        else download(filename(after,'ai-comparison','json'), JSON.stringify(aiExport(before,after,notes),null,2), 'application/json');
      }
    } catch (error) { const text = error.message || 'Could not complete that action.'; folder.querySelector('.folder-error').textContent = text; message(text, true); }
  });
  $('run-form').addEventListener('submit', async e => {
    e.preventDefault(); message(''); let urls; try { urls = parseURLs($('urls').value); } catch (error) { message(error.message,true); return; }
    const choice = document.querySelector('input[name="strategy"]:checked').value; const key = $('api-key').value.trim();
    const queue = buildQueue(urls, choice);
    try { if (key) localStorage.setItem(KEY_STORAGE,key); else localStorage.removeItem(KEY_STORAGE); } catch { message('Browser storage is unavailable; reports cannot be saved.',true); return; }
    $('run').disabled = true; const failures = []; let saved = 0;
    for (const [i,{url,strategy}] of queue.entries()) {
      message(`Analyzing ${i+1} of ${queue.length}: ${url} (${strategy})\nThis may take a minute per test.`);
      try {
        const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed'); endpoint.searchParams.set('url',url); endpoint.searchParams.set('strategy',strategy); endpoint.searchParams.set('category','performance'); if (key) endpoint.searchParams.set('key',key);
        const response = await fetch(endpoint); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || `Google returned HTTP ${response.status}.`);
        const report = makeReport(data,url,strategy); await transaction('reports','readwrite',store => store.put(report)); reports.unshift(report); saved++;
      } catch (error) { failures.push(`${url} (${strategy}): ${error.message}`); }
    }
    try { render(); } catch (error) { failures.push(`Reports were saved, but the folder view could not be displayed: ${error.message}`); }
    $('run').disabled = false; message(`${saved} report${saved === 1 ? '' : 's'} saved.${failures.length ? '\n' + failures.join('\n') : ''}`, failures.length > 0);
  });
  $('run').disabled = true;
  (async () => { try { $('api-key').value = localStorage.getItem(KEY_STORAGE) || ''; await openStorage(); render(); $('run').disabled = false; } catch (error) { message(`Could not open browser storage: ${error.message}. Existing data was not deleted.`,true); } })();
}
