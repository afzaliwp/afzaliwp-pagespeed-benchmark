'use strict';
const STORAGE = 'pagespeed-workbench-reports-v1';
const KEY_STORAGE = 'pagespeed-workbench-key';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function parseURLs(text) {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Enter at least one URL.');
  return [...new Set(lines.map(line => {
    let url;
    try { url = new URL(line); } catch { throw new Error(`Invalid URL: ${line}. Include https:// or http://.`); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(`Invalid URL: ${line}. Use an HTTP(S) URL without credentials.`);
    return url.href;
  }))];
}
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
function compatible(before, after) { return before.url === after.url && before.strategy === after.strategy; }
function filename(report, type, ext) { return `pagespeed-${new URL(report.url).hostname}-${report.strategy}-${type}.${ext}`; }
function clientReport(before, after, notes) {
  if (!compatible(before, after)) throw new Error('Compare the same URL and device.');
  const e = escapeHTML;
  const metricNames = [...new Set([...before.metrics, ...after.metrics].map(m => m.title))];
  const metricValue = (r, name) => r.metrics.find(m => m.title === name)?.value || 'Not available';
  const delta = before.score == null || after.score == null ? 'Not available' : `${after.score - before.score > 0 ? '+' : ''}${after.score - before.score} points`;
  const recs = after.recommendations.map(a => `<li><strong>${e(a.title)}</strong>${a.displayValue ? ` <span>${e(a.displayValue)}</span>` : ''}<p>${e(a.description)}</p></li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PageSpeed comparison — ${e(after.url)}</title><style>body{font:15px/1.6 system-ui,sans-serif;color:#203328;max-width:900px;margin:48px auto;padding:0 24px}h1,h2{line-height:1.2}h1{font-size:36px}h2{margin-top:42px}.tag{color:#56765c;text-transform:uppercase;letter-spacing:.12em;font-size:12px;font-weight:bold}.muted{color:#637469;overflow-wrap:anywhere}.scores{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:28px 0}.card{background:#eef5e9;padding:20px;border-radius:12px}.card b{display:block;font-size:30px}.card small{color:#637469}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:12px;border-bottom:1px solid #dce6dc}li{margin:15px 0}li p{color:#637469;margin:4px 0;white-space:pre-wrap}.notes{white-space:pre-wrap}button{background:#203d30;color:white;border:0;border-radius:8px;padding:12px 16px;cursor:pointer}@media print{body{margin:0;max-width:none}button{display:none}.card{border:1px solid #dce6dc}a{color:inherit}}@media(max-width:550px){.scores{grid-template-columns:1fr}th,td{padding:8px}}</style></head><body><button onclick="window.print()">Print / save as PDF</button><p class="tag">Website performance report</p><h1>Before &amp; after</h1><p class="muted">${e(after.url)}<br>${e(after.strategy)} · Google PageSpeed Insights</p><div class="scores"><div class="card"><small>BEFORE · ${e(new Date(before.date).toLocaleString())}</small><b>${e(before.score ?? '—')}</b><small>Performance score / 100</small></div><div class="card"><small>AFTER · ${e(new Date(after.date).toLocaleString())}</small><b>${e(after.score ?? '—')}</b><small>Performance score / 100</small></div><div class="card"><small>CHANGE</small><b>${e(delta)}</b><small>Performance score</small></div></div><h2>What changed</h2><p class="notes">${e(notes.trim() || 'No changes were described for this report.')}</p><h2>Lab measurements</h2><table><thead><tr><th>Metric</th><th>Before</th><th>After</th></tr></thead><tbody>${metricNames.map(name => `<tr><th scope="row">${e(name)}</th><td>${e(metricValue(before,name))}</td><td>${e(metricValue(after,name))}</td></tr>`).join('') || '<tr><td colspan="3">No lab metrics available.</td></tr>'}</tbody></table><h2>Remaining Google insights</h2>${recs ? `<ol>${recs}</ol>` : '<p>No actionable insights were returned for the after run.</p>'}<p class="muted">These are lab measurements from two individual runs; scores can vary. A change in score alone does not prove its cause. For the complete findings and evidence, use the accompanying AI data export.</p></body></html>`;
}
function aiExport(before, after, notes) {
  if (!compatible(before, after)) throw new Error('Compare the same URL and device.');
  return {format:'PageSpeed Workbench comparison v1', instructions:'Compare the before and after Google responses. Use lighthouseResult audits, details, metricSavings and field data where available. Identify remaining actionable issues and affected resources, cite the audit IDs and evidence, and do not assume a cause for score changes. Check the actual codebase before making changes.', url:after.url, strategy:after.strategy, changesDescribedByUser:notes, before:{date:before.date, score:before.score, googleResponse:before.googleResponse || null, savedSummary:before.googleResponse ? undefined : before}, after:{date:after.date, score:after.score, googleResponse:after.googleResponse || null, savedSummary:after.googleResponse ? undefined : after}, note:'A null googleResponse indicates an older summary-only report; run a new audit to capture the full response.'};
}
if (typeof module !== 'undefined') module.exports = {parseURLs, makeReport, compatible, clientReport, aiExport};
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
  function readNote(url, strategy) { try { return localStorage.getItem(noteKey(url, strategy)) || ''; } catch { return ''; } }
  function render() {
    $('count').textContent = reports.length;
    if (!reports.length) { $('reports').innerHTML = '<div class="empty"><div class="empty-icon">✳</div><strong>Your first website starts here</strong><p>Run an analysis to create a website folder and capture your baseline.</p></div>'; return; }
    const domains = new Map();
    for (const r of reports) {
      let domain; try { domain = new URL(r.url).hostname; } catch { domain = 'Other'; }
      if (!domains.has(domain)) domains.set(domain, new Map());
      const pages = domains.get(domain); const key = JSON.stringify([r.url,r.strategy]);
      if (!pages.has(key)) pages.set(key, []); pages.get(key).push(r);
    }
    $('reports').innerHTML = [...domains].map(([domain,pages]) => `<details class="site-folder" open><summary><span>▸</span> ${escapeHTML(domain)} <small>${[...pages.values()].flat().length} reports</small></summary><div class="folder-content">${[...pages.values()].map(group => {
      const latest = group[0], options = group.map((r,i) => `<option value="${escapeHTML(r.id)}" ${i === group.length-1 ? 'data-oldest="true"' : ''}>${escapeHTML(new Date(r.date).toLocaleString())} · ${escapeHTML(r.score ?? '—')}/100${r.googleResponse ? '' : ' · summary only'}</option>`).join('');
      return `<section class="page-group" data-url="${escapeHTML(latest.url)}" data-strategy="${escapeHTML(latest.strategy)}"><div class="page-heading"><div><strong>${escapeHTML(latest.url)}</strong><small>${escapeHTML(latest.strategy)} · ${group.length} run${group.length === 1 ? '' : 's'}</small></div><span class="latest-score">${escapeHTML(latest.score ?? '—')}<small> / 100</small></span></div><div class="compare-controls"><label>Before<select class="before-select">${options}</select></label><label>After<select class="after-select">${options}</select></label></div><label class="notes-label">Work completed <span>OPTIONAL · INCLUDED IN THE CLIENT REPORT</span><textarea class="change-notes" rows="2" placeholder="e.g. Compressed images and removed unused scripts">${escapeHTML(readNote(latest.url, latest.strategy))}</textarea></label><div class="page-actions"><button class="download" data-action="client" ${group.length < 2 ? 'disabled' : ''}>↓ Client report</button><button class="download" data-action="ai" ${group.length < 2 ? 'disabled' : ''}>↓ AI comparison JSON</button><button class="download secondary" data-action="raw">↓ Selected Google JSON</button></div>${group.length < 2 ? '<p class="hint">Run this page again on the same device to compare before and after.</p>' : ''}${group.some(r => !r.googleResponse) ? '<p class="hint">Older summary-only reports do not contain Google’s full response. New runs capture it.</p>' : ''}<details class="run-list"><summary>View and manage ${group.length} saved run${group.length === 1 ? '' : 's'}</summary>${group.map(r => `<div class="run-row"><span>${escapeHTML(new Date(r.date).toLocaleString())} · ${escapeHTML(r.score ?? '—')}/100${r.googleResponse ? '' : ' · summary only'}</span><button class="delete" data-action="delete" data-id="${escapeHTML(r.id)}" aria-label="Delete report from ${escapeHTML(r.date)}">Delete</button></div>`).join('')}</details></section>`;
    }).join('')}</div></details>`).join('');
    document.querySelectorAll('.page-group').forEach(group => { const before = group.querySelector('.before-select'); before.selectedIndex = before.options.length - 1; });
  }
  $('reports').addEventListener('input', e => {
    if (!e.target.matches('.change-notes')) return;
    const group = e.target.closest('.page-group');
    try { localStorage.setItem(noteKey(group.dataset.url, group.dataset.strategy), e.target.value); } catch { message('Could not save your notes in browser storage.', true); }
  });
  $('reports').addEventListener('click', async e => {
    const button = e.target.closest('button[data-action]'); if (!button) return;
    const group = button.closest('.page-group'); const before = reports.find(r => r.id === group.querySelector('.before-select').value); const after = reports.find(r => r.id === group.querySelector('.after-select').value); const notes = group.querySelector('.change-notes').value;
    try {
      if (button.dataset.action === 'delete') {
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
    } catch (error) { message(error.message || 'Could not complete that action.', true); }
  });
  $('run-form').addEventListener('submit', async e => {
    e.preventDefault(); message(''); let urls; try { urls = parseURLs($('urls').value); } catch (error) { message(error.message,true); return; }
    const strategy = document.querySelector('input[name="strategy"]:checked').value; const key = $('api-key').value.trim();
    try { if (key) localStorage.setItem(KEY_STORAGE,key); else localStorage.removeItem(KEY_STORAGE); } catch { message('Browser storage is unavailable; reports cannot be saved.',true); return; }
    $('run').disabled = true; const failures = []; let saved = 0;
    for (const [i,url] of urls.entries()) {
      message(`Analyzing ${i+1} of ${urls.length}: ${url}\nThis may take a minute per page.`);
      try {
        const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed'); endpoint.searchParams.set('url',url); endpoint.searchParams.set('strategy',strategy); endpoint.searchParams.set('category','performance'); if (key) endpoint.searchParams.set('key',key);
        const response = await fetch(endpoint); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || `Google returned HTTP ${response.status}.`);
        const report = makeReport(data,url,strategy); await transaction('reports','readwrite',store => store.put(report)); reports.unshift(report); saved++; render();
      } catch (error) { failures.push(`${url}: ${error.message}`); }
    }
    $('run').disabled = false; message(`${saved} report${saved === 1 ? '' : 's'} saved.${failures.length ? '\n' + failures.join('\n') : ''}`, failures.length > 0);
  });
  $('run').disabled = true;
  (async () => { try { $('api-key').value = localStorage.getItem(KEY_STORAGE) || ''; await openStorage(); render(); $('run').disabled = false; } catch (error) { message(`Could not open browser storage: ${error.message}. Existing data was not deleted.`,true); } })();
}
