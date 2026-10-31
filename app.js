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
  const refs = lighthouse.categories?.performance?.auditRefs || [];
  const audits = lighthouse.audits || {};
  const recommendations = refs.flatMap(ref => {
    const audit = audits[ref.id];
    const isInsight = ref.group === 'insights' || ref.group === 'load-opportunities' || ref.id.endsWith('-insight');
    if (!audit || !isInsight || audit.score === 1 || ['notApplicable', 'error', 'manual'].includes(audit.scoreDisplayMode)) return [];
    const headings = audit.details?.headings || [];
    const items = (audit.details?.items || []).map(item => headings.flatMap(h => {
      const raw = item[h.key]; const value = raw && typeof raw === 'object' ? (raw.url ?? raw.value ?? raw.text) : raw;
      return value == null || typeof value === 'object' ? [] : [`${h.label || h.key}: ${value}`];
    }).join(' | ')).filter(Boolean);
    return [{title:audit.title, description:audit.description || '', displayValue:audit.displayValue || '', items}];
  });
  const metricIds = ['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index'];
  return {id: crypto.randomUUID(), url, finalUrl:lighthouse.finalDisplayedUrl || lighthouse.finalUrl || url, strategy, date:lighthouse.fetchTime || new Date().toISOString(), score:lighthouse.categories?.performance?.score == null ? null : Math.round(lighthouse.categories.performance.score * 100), metrics:metricIds.flatMap(id => audits[id]?.displayValue ? [{title:audits[id].title, value:audits[id].displayValue}] : []), recommendations};
}
function reportMarkdown(r) {
  const metrics = r.metrics.map(m => `- ${m.title}: ${m.value}`).join('\n') || '- No metrics returned.';
  const fixes = r.recommendations.map((a,i) => `### ${i+1}. ${a.title}${a.displayValue ? ` — ${a.displayValue}` : ''}\n\n${a.description || 'See the full PageSpeed report for details.'}${a.items?.length ? '\n\n' + a.items.map(item => '- ' + item).join('\n') : ''}`).join('\n\n') || 'No actionable insights were returned for this run.';
  const link = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(r.url)}&form_factor=${r.strategy}`;
  return `# PageSpeed report\n\n- URL: ${r.url}\n- Final URL: ${r.finalUrl}\n- Device: ${r.strategy}\n- Tested: ${r.date}\n- Performance score: ${r.score ?? 'Unavailable'} / 100\n- [Open PageSpeed Insights](${link})\n\n## Lab metrics\n\n${metrics}\n\n## Google recommendations\n\n${fixes}\n`;
}
if (typeof module !== 'undefined') module.exports = {parseURLs, makeReport, reportMarkdown};
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  let reports = [];
  try { reports = JSON.parse(localStorage.getItem(STORAGE) || '[]'); if (!Array.isArray(reports)) throw Error(); $('api-key').value = localStorage.getItem(KEY_STORAGE) || ''; }
  catch { $('message').textContent = 'Could not read saved reports. Check your browser storage settings.'; $('message').className = 'error'; }
  function render() {
    $('count').textContent = reports.length;
    if (!reports.length) { $('reports').innerHTML = '<div class="empty"><div class="empty-icon">✳</div><strong>Your first report starts here</strong><p>Run an analysis to see your results and recommendations.</p></div>'; return; }
    $('reports').innerHTML = reports.map((r,i) => {
      const previous = reports.slice(i + 1).find(p => p.url === r.url && p.strategy === r.strategy && p.score != null);
      const delta = previous && r.score != null ? ` · ${r.score - previous.score >= 0 ? '+' : ''}${r.score - previous.score} vs previous` : '';
      const score = r.score == null ? '—' : r.score;
      return `<article class="report"><div class="report-top"><div class="score ${r.score == null ? '' : r.score < 50 ? 'low' : r.score < 90 ? 'mid' : ''}" aria-label="Performance score ${score}">${score}</div><div class="report-info"><strong>${escapeHTML(r.url)}</strong><small>${escapeHTML(r.strategy)} · ${escapeHTML(new Date(r.date).toLocaleString())}${escapeHTML(delta)}</small></div><div class="report-actions"><button class="download" data-action="download" data-id="${escapeHTML(r.id)}">↓ Download doc</button><button class="delete" data-action="delete" data-id="${escapeHTML(r.id)}" aria-label="Delete report for ${escapeHTML(r.url)}">✕</button></div></div><div class="metrics">${r.metrics.map(m => `${escapeHTML(m.title)}: <b>${escapeHTML(m.value)}</b>`).join(' &nbsp; · &nbsp; ')}</div><details><summary>${r.recommendations.length} Google recommendation${r.recommendations.length === 1 ? '' : 's'}</summary>${r.recommendations.length ? r.recommendations.map(a => `<div class="audit"><h4>${escapeHTML(a.title)}${a.displayValue ? ` — ${escapeHTML(a.displayValue)}` : ''}</h4><p>${escapeHTML(a.description)}</p></div>`).join('') : '<p>No actionable insights were returned for this run.</p>'}</details></article>`;
    }).join('');
  }
  $('reports').addEventListener('click', e => {
    const button = e.target.closest('button[data-action]'); if (!button) return;
    const report = reports.find(r => r.id === button.dataset.id); if (!report) return;
    if (button.dataset.action === 'download') {
      const blob = new Blob([reportMarkdown(report)], {type:'text/markdown;charset=utf-8'}); const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = `pagespeed-${new URL(report.url).hostname}-${report.date.slice(0,10)}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
    } else if (confirm('Delete this saved report?')) {
      const next = reports.filter(r => r.id !== report.id);
      try { localStorage.setItem(STORAGE, JSON.stringify(next)); reports = next; render(); } catch { $('message').textContent = 'Could not update browser storage. Your report was not deleted.'; $('message').className = 'error'; }
    }
  });
  $('run-form').addEventListener('submit', async e => {
    e.preventDefault(); $('message').className = '';
    let urls; try { urls = parseURLs($('urls').value); } catch (error) { $('message').textContent = error.message; $('message').className = 'error'; return; }
    const strategy = document.querySelector('input[name="strategy"]:checked').value; const key = $('api-key').value.trim();
    try { if (key) localStorage.setItem(KEY_STORAGE, key); else localStorage.removeItem(KEY_STORAGE); } catch { $('message').textContent = 'Browser storage is unavailable; reports cannot be saved.'; $('message').className = 'error'; return; }
    $('run').disabled = true; const failures = []; let saved = 0;
    for (const [i,url] of urls.entries()) {
      $('message').textContent = `Analyzing ${i+1} of ${urls.length}: ${url}\nThis may take a minute per page.`;
      try {
        const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed'); endpoint.searchParams.set('url',url); endpoint.searchParams.set('strategy',strategy); endpoint.searchParams.set('category','performance'); if (key) endpoint.searchParams.set('key',key);
        const response = await fetch(endpoint); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || `Google returned HTTP ${response.status}.`);
        const report = makeReport(data,url,strategy); const next = [report,...reports];
        try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { throw new Error('Browser storage is full or unavailable. Download existing reports and free space before trying again.'); }
        reports = next; saved++; render();
      } catch (error) { failures.push(`${url}: ${error.message}`); }
    }
    $('run').disabled = false; $('message').className = failures.length ? 'error' : ''; $('message').textContent = `${saved} report${saved === 1 ? '' : 's'} saved.${failures.length ? '\n' + failures.join('\n') : ''}`;
  });
  render();
}
