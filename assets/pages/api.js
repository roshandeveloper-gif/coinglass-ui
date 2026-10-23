/*
 * API — developer documentation for the SAMPLE "Deriv Hub API": intro, auth,
 * rate limits, errors, the grouped endpoint reference, a "Try it" console
 * that answers from in-browser sample data (no network), code samples and a
 * changelog. There is no live service behind any of it.
 */
(function () {
  'use strict';
  const main = DH.page({ title: 'API', active: 'more' });
  const { esc, store, $, $$ } = DH;
  const A = window.DHAPI;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function hl(json) {
    const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|\b(true|false|null)\b/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(json))) {
      out += esc(json.slice(last, m.index));
      if (m[1]) out += `<span class="${m[2] ? 'j-k' : 'j-s'}">${esc(m[1])}</span>${m[2] || ''}`;
      else if (m[3]) out += `<span class="j-n">${m[3]}</span>`;
      else out += `<span class="j-b">${m[4]}</span>`;
      last = re.lastIndex;
    }
    return out + esc(json.slice(last));
  }
  /** Shorten long arrays so a documentation example stays readable. */
  const trunc = (v) => (Array.isArray(v) ? v.slice(0, 2).map(trunc) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trunc(x)])) : v);
  const randomKey = () => {
    const b = new Uint8Array(16);
    try {
      crypto.getRandomValues(b);
    } catch {
      b.forEach((_, i) => (b[i] = Math.floor(Math.random() * 256)));
    }
    return 'dhk_sample_' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  };
  let apiKey = store.get('api:key', 'dhk_sample_0123456789abcdef0123456789abcdef');
  const STATUS = { 200: 'OK', 400: 'Bad Request', 404: 'Not Found', 429: 'Too Many Requests' };
  const pre = (json, cls = '') => `<pre class="api-pre ${cls}"><code>${hl(json)}</code></pre>`;
  const findEp = (id) => A.ALL.find((e) => e.id === id) || A.ALL[0];

  // ── Markup ───────────────────────────────────────────────────────────────
  const nav = [
    ['intro', 'Introduction'],
    ['auth', 'Authentication'],
    ['limits', 'Rate limits'],
    ['errors', 'Errors'],
    ['try', 'Try it'],
    ...A.GROUPS.map((g) => ['g-' + g.id, g.name]),
    ['changelog', 'Changelog'],
  ];
  const epBlock = (ep) => {
    const ex = A.call(ep, A.defaults(ep));
    const params = ep.params.length
      ? `<div class="dh-table-scroll"><table class="dh-table api-params"><thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>${ep.params
          .map((p) => `<tr><td><code>${p.name}</code></td><td>${p.type}</td><td>${p.required ? '<span class="pill api-req">required</span>' : '<span class="muted">optional</span>'}</td><td class="api-wrap">${esc(p.desc)}</td></tr>`)
          .join('')}</tbody></table></div>`
      : '<p class="muted">No parameters.</p>';
    return `<article class="api-ep" id="ep-${ep.id}">
      <div class="api-ep-h"><span class="api-method">${ep.method || 'GET'}</span><code class="api-path">${ep.path}</code><button class="dh-btn sm" data-try="${ep.id}">Try it</button></div>
      <p class="api-desc">${esc(ep.desc)}</p>
      ${params}
      <details class="api-ex"><summary>Response example <span class="muted">(arrays shortened to two items)</span></summary>${pre(JSON.stringify(trunc(ex.body), null, 2))}</details>
    </article>`;
  };
  const sec = (id, title, body, tools = '') => DH.card(title, body, tools, 'api-sec" id="' + id);

  main.innerHTML = `
    <div class="dh-pagehead"><div><h1>Deriv Hub API</h1><p>REST endpoints for market, futures, options, fund and indicator data, documented the way a production API would be.</p></div></div>
    <div class="api-banner" role="note"><b>Sample API documentation · no live service.</b> The base URL uses a reserved example domain, keys are invented and every response on this page is generated in your browser from fictional sample data.</div>
    <div class="api-layout">
      <aside class="api-nav"><nav>${nav.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}</nav></aside>
      <div class="api-content">
        ${sec('intro', 'Introduction', `
          <p>The API is organised in five groups. Every endpoint is a <code>GET</code> request that returns JSON in the same envelope; times are Unix milliseconds in UTC and money is in US dollars unless a field says otherwise.</p>
          <div class="api-kv"><span>Base URL</span><code>${A.BASE}</code></div>
          <div class="api-kv"><span>Format</span><code>application/json; charset=utf-8</code></div>
          ${pre(JSON.stringify({ code: 0, msg: 'success', sample: true, data: '…' }, null, 2))}
          <ol class="api-steps"><li>Create a key under your account (sample keys can be generated below).</li><li>Send it in the <code>DH-API-KEY</code> header with every request.</li><li>Check <code>code</code>: <code>0</code> means success, anything else is an error from the table below.</li></ol>`)}
        ${sec('auth', 'Authentication', `
          <p>Authenticate by sending your key in a request header. Keys are 43 characters: the prefix <code>dhk_sample_</code> followed by 32 lowercase hex digits. Keep keys server-side; never ship them in browser code.</p>
          ${pre(`DH-API-KEY: ${apiKey}`, 'api-key-pre')}
          <div class="api-row"><button class="dh-btn sm" data-a="key">Generate a sample key</button><span class="muted">Generated locally. A sample key does not unlock anything.</span></div>`)}
        ${sec('limits', 'Rate limits', `
          <p>Limits apply per key over a rolling 60-second window. Every response carries three headers so a client can pace itself.</p>
          <div class="dh-table-scroll"><table class="dh-table"><thead><tr><th>Plan</th><th class="right">Requests / min</th><th class="right">Requests / day</th><th>History depth</th><th class="right">WebSocket streams</th><th>Endpoint groups</th></tr></thead><tbody>${A.PLANS.map((p) => `<tr><td><b>${p.name}</b></td><td class="right">${p.rpm.toLocaleString('en-US')}</td><td class="right">${p.daily}</td><td>${p.history}</td><td class="right">${p.ws}</td><td>${p.endpoints}</td></tr>`).join('')}</tbody></table></div>
          <div class="api-headers"><code>X-RateLimit-Limit</code><span>Requests allowed in the window</span><code>X-RateLimit-Remaining</code><span>Requests left in the window</span><code>X-RateLimit-Reset</code><span>Seconds until the window resets</span></div>
          <p class="muted">Plan figures are sample values. <a class="api-link" href="pricing.html">See sample plans</a>.</p>`)}
        ${sec('errors', 'Errors', `<div class="dh-table-scroll"><table class="dh-table"><thead><tr><th>HTTP</th><th>code</th><th>Meaning</th></tr></thead><tbody>${A.ERRORS.map(([s, c, m]) => `<tr><td><span class="pill ${s < 500 && s !== 429 ? 'api-4xx' : 'api-5xx'}">${s}</span></td><td><code>${c}</code></td><td class="api-wrap">${m}</td></tr>`).join('')}</tbody></table></div>`)}
        ${sec('try', 'Try it', `
          <p class="muted">Pick an endpoint, fill in the parameters and send. The answer is built in this page from sample data; nothing leaves your browser.</p>
          <div class="api-try">
            <div class="api-try-form">
              <label>Endpoint<select class="dh-select api-ep-sel">${A.GROUPS.map((g) => `<optgroup label="${g.name}">${g.endpoints.map((e) => `<option value="${e.id}">GET ${e.path}</option>`).join('')}</optgroup>`).join('')}</select></label>
              <label>Simulated plan<select class="dh-select api-plan">${A.PLANS.map((p, i) => `<option value="${i}">${p.name} · ${p.rpm}/min</option>`).join('')}</select></label>
              <div class="api-fields"></div>
              <div class="api-row"><button class="dh-btn primary" data-a="send">Send request</button><button class="dh-btn" data-a="reset">Reset</button></div>
            </div>
            <div class="api-try-out">
              <div class="api-url"></div>
              <div class="api-status muted">No request sent yet.</div>
              <div class="api-resp"></div>
            </div>
          </div>
          <div class="api-code">
            <div class="api-code-h"><span class="api-lang"></span><button class="dh-btn sm" data-a="copy">Copy</button></div>
            <pre class="api-pre api-code-pre"><code></code></pre>
          </div>`)}
        ${A.GROUPS.map((g) => sec('g-' + g.id, g.name, g.endpoints.map(epBlock).join(''), `<span class="muted">${g.endpoints.length} endpoint${g.endpoints.length > 1 ? 's' : ''}</span>`)).join('')}
        ${sec('changelog', 'Changelog', `<div class="api-log">${A.CHANGELOG.map(([v, d, items]) => `<div class="api-log-row"><div><b>${v}</b><span class="muted">${d}</span></div><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>`)}
      </div>
    </div>`;

  // ── Auth: sample keys ────────────────────────────────────────────────────
  main.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'key') {
      apiKey = randomKey();
      store.set('api:key', apiKey);
      $('.api-key-pre', main).innerHTML = `<code>${hl(`DH-API-KEY: ${apiKey}`)}</code>`;
      paintCode();
      DH.toast('Sample key generated (it does not work anywhere)');
    } else if (a === 'send') send();
    else if (a === 'reset') {
      fill(cur, A.defaults(cur));
      paintCode();
    } else if (a === 'copy') copyCode();
    const t = e.target.closest('[data-try]');
    if (t) {
      select(t.dataset.try);
      $('#try', main).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ── Try it ───────────────────────────────────────────────────────────────
  const epSel = $('.api-ep-sel', main);
  const planSel = $('.api-plan', main);
  const fields = $('.api-fields', main);
  const last = store.get('api:last', {});
  let cur = findEp(last.id);
  const calls = {};
  planSel.value = String(last.plan ?? 0);

  function fill(ep, values) {
    fields.innerHTML = ep.params.length
      ? ep.params
          .map((p) => {
            const v = values[p.name] ?? '';
            const input = p.type === 'enum'
              ? `<select class="dh-select" name="${p.name}">${p.options.map((o) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${o === '' ? '(any)' : esc(o)}</option>`).join('')}</select>`
              : `<input class="dh-input" name="${p.name}" value="${esc(v)}" placeholder="${p.required ? 'required' : 'optional'}" autocomplete="off" ${p.name === 'symbol' ? 'list="api-syms"' : ''}>`;
            return `<label>${p.name}${p.required ? ' <span class="api-star">*</span>' : ''}${input}<small class="muted">${esc(p.desc)}</small></label>`;
          })
          .join('') + `<datalist id="api-syms">${A.SYMBOLS.map((s) => `<option value="${s}">`).join('')}</datalist>`
      : '<p class="muted">This endpoint takes no parameters.</p>';
  }
  const values = () => Object.fromEntries($$('[name]', fields).map((x) => [x.name, x.value]));
  function query(vals) {
    const qs = Object.entries(vals).filter(([, v]) => String(v).trim() !== '');
    return qs.length ? '?' + qs.map(([k, v]) => `${k}=${encodeURIComponent(String(v).trim())}`).join('&') : '';
  }
  function select(id) {
    cur = findEp(id);
    epSel.value = cur.id;
    fill(cur, last.id === cur.id && last.params ? last.params : A.defaults(cur));
    $('.api-resp', main).innerHTML = '';
    $('.api-status', main).textContent = 'No request sent yet.';
    paintCode();
  }
  epSel.addEventListener('change', () => select(epSel.value));
  planSel.addEventListener('change', () => store.set('api:last', { ...store.get('api:last', {}), plan: Number(planSel.value) }));
  fields.addEventListener('input', paintCode);
  fields.addEventListener('change', paintCode);
  fields.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  });

  function send() {
    const vals = values();
    const plan = A.PLANS[Number(planSel.value)] || A.PLANS[0];
    const now = Date.now();
    const log = (calls[plan.name] = (calls[plan.name] || []).filter((t) => now - t < 60000));
    let res;
    if (log.length >= plan.rpm) res = { status: 429, body: { code: 42901, msg: `Rate limit of ${plan.rpm} requests per minute reached (simulated)`, sample: true, data: null } };
    else {
      log.push(now);
      res = A.call(cur, vals);
    }
    const reset = log.length ? Math.ceil((60000 - (now - log[0])) / 1000) : 60;
    const ms = 18 + Math.floor(Math.random() * 60);
    store.set('api:last', { id: cur.id, params: vals, plan: Number(planSel.value) });
    $('.api-url', main).innerHTML = `<span class="api-method">GET</span><code>${esc(A.BASE + cur.path + query(vals))}</code>`;
    $('.api-status', main).innerHTML = `<span class="pill ${res.status === 200 ? 'up' : 'down'}">${res.status} ${STATUS[res.status] || ''}</span><span>${ms} ms (simulated)</span><span><code>X-RateLimit-Limit: ${plan.rpm}</code></span><span><code>X-RateLimit-Remaining: ${Math.max(0, plan.rpm - log.length)}</code></span><span><code>X-RateLimit-Reset: ${reset}</code></span>`;
    $('.api-resp', main).innerHTML = pre(JSON.stringify(res.body, null, 2), 'api-resp-pre');
  }

  // ── Code samples ─────────────────────────────────────────────────────────
  let lang = store.get('api:lang', 'curl');
  const langSeg = DH.seg([['curl', 'cURL'], ['python', 'Python'], ['js', 'JavaScript']], lang, (v) => {
    lang = v;
    store.set('api:lang', v);
    paintCode();
  }, 'tabs');
  $('.api-lang', main).appendChild(langSeg);
  function codeFor() {
    const vals = Object.entries(values()).filter(([, v]) => String(v).trim() !== '');
    const url = A.BASE + cur.path;
    if (lang === 'python') {
      const params = vals.length ? `\n    params={${vals.map(([k, v]) => `"${k}": "${String(v).trim()}"`).join(', ')}},` : '';
      return `import requests\n\nresp = requests.get(\n    "${url}",${params}\n    headers={"DH-API-KEY": "${apiKey}"},\n    timeout=10,\n)\nbody = resp.json()\nif body["code"] != 0:\n    raise RuntimeError(body["msg"])\nprint(body["data"])`;
    }
    if (lang === 'js') {
      const params = vals.length ? `\nconst params = new URLSearchParams({ ${vals.map(([k, v]) => `${k}: '${String(v).trim()}'`).join(', ')} });` : '';
      return `${params}\nconst res = await fetch('${url}'${params ? " + '?' + params" : ''}, {\n  headers: { 'DH-API-KEY': '${apiKey}' },\n});\nconst body = await res.json();\nif (body.code !== 0) throw new Error(body.msg);\nconsole.log(body.data);`.trim();
    }
    return `curl -G "${url}" \\\n  -H "DH-API-KEY: ${apiKey}"${vals.map(([k, v]) => ` \\\n  --data-urlencode "${k}=${String(v).trim()}"`).join('')}`;
  }
  function paintCode() {
    $('.api-code-pre code', main).textContent = codeFor();
  }
  function copyCode() {
    const text = codeFor();
    const ok = () => DH.toast('Code sample copied');
    try {
      navigator.clipboard.writeText(text).then(ok, () => DH.toast('Copy is blocked here: select the code and copy it manually'));
    } catch {
      DH.toast('Copy is blocked here: select the code and copy it manually');
    }
  }

  select(cur.id);
})();
