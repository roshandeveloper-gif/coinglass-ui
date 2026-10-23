/*
 * Helpers shared by the Open Interest pages (open-interest, oi-history,
 * oi-altcoins): an exchange checkbox dropdown with colour swatches, the
 * "top venues + Others" stack built from a venue selection, and unit
 * formatting. Every figure is SAMPLE DATA. Attaches DH.OI.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const OTHERS_COLOR = '#4a4f5a';

  /**
   * Checkbox dropdown. items: [{ value, label, color }]; selected: array of values.
   * onChange(selectedValues). opts.align = 'right' opens the panel towards the left.
   * Returns the element; el.close() hides the panel.
   */
  function multiSelect(title, items, selected, onChange, opts = {}) {
    const sel = new Set(selected);
    const el = DH.h(`<div class="oi-ms${opts.align === 'right' ? ' right' : ''}"><button type="button" class="dh-select oi-ms-btn" aria-haspopup="true" aria-expanded="false"></button>
      <div class="oi-ms-pop" hidden><div class="oi-ms-acts"><button type="button" data-all>Select all</button><button type="button" data-none>Clear</button></div>
      ${items
        .map(
          (it) =>
            `<label><input type="checkbox" value="${DH.esc(it.value)}" ${sel.has(it.value) ? 'checked' : ''}>${it.color ? `<i style="background:${it.color}"></i>` : ''}${DH.esc(it.label)}</label>`,
        )
        .join('')}</div></div>`);
    const btn = DH.$('.oi-ms-btn', el);
    const pop = DH.$('.oi-ms-pop', el);
    const label = () => {
      const txt = sel.size === items.length ? 'All' : sel.size ? `${sel.size} of ${items.length}` : 'None';
      btn.innerHTML = `${title ? DH.esc(title) + ': ' : ''}<b>${txt}</b> ▾`;
    };
    const emit = () => {
      label();
      onChange(items.map((i) => i.value).filter((v) => sel.has(v)));
    };
    const open = (on) => {
      pop.hidden = !on;
      btn.setAttribute('aria-expanded', String(on));
    };
    btn.addEventListener('click', () => open(pop.hidden));
    pop.addEventListener('change', (e) => {
      const cb = e.target.closest('input');
      if (!cb) return;
      cb.checked ? sel.add(cb.value) : sel.delete(cb.value);
      emit();
    });
    pop.addEventListener('click', (e) => {
      const all = e.target.closest('[data-all]');
      if (!all && !e.target.closest('[data-none]')) return;
      DH.$$('input', pop).forEach((cb) => {
        cb.checked = !!all;
        all ? sel.add(cb.value) : sel.delete(cb.value);
      });
      emit();
    });
    // Listeners are removed once the dropdown leaves the page (it is rebuilt per coin).
    const onDoc = (e) => {
      if (!el.isConnected) return off();
      if (!el.contains(e.target)) open(false);
    };
    const onKey = (e) => {
      if (!el.isConnected) return off();
      if (e.key === 'Escape') open(false);
    };
    const off = () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    label();
    el.close = () => open(false);
    return el;
  }

  /** Dropdown items for every venue listing a coin, biggest first. */
  const venueItems = (rows) => rows.map((x) => ({ value: x.ex.id, label: x.ex.name, color: x.ex.color }));

  /**
   * History stack for the selected venues: the `top` largest selected venues each get a
   * series, the rest of the selection is summed into "Others". seed(id) names each walk,
   * so a venue's line is the same wherever it is drawn. R: { n, vol, drift }.
   */
  function venueStack(rows, excluded, seed, R, top = 6) {
    const picked = rows.filter((x) => !excluded.has(x.ex.id));
    const series = picked.map((x) => ({
      id: x.ex.id,
      name: x.ex.name,
      color: x.ex.color,
      usd: x.usd,
      data: S.walk(seed(x.ex.id), R.n, x.usd, R.vol, R.drift || 0),
    }));
    const bs = series.slice(0, top);
    const rest = series.slice(top);
    if (rest.length) {
      bs.push({
        id: 'others',
        name: `Others (${rest.length})`,
        color: OTHERS_COLOR,
        usd: rest.reduce((s, b) => s + b.usd, 0),
        data: Array.from({ length: R.n }, (_, i) => rest.reduce((s, b) => s + b.data[i], 0)),
      });
    }
    return { bs, picked: picked.length, total: rows.length };
  }

  /** Value in the chosen unit: 'usd' keeps dollars, 'coin' divides by the price. */
  const inUnit = (usd, px, unit) => (unit === 'coin' ? usd / px : usd);
  const fmtUnit = (v, unit, sym, digits = 2) => (unit === 'coin' ? `${DH.compact(v, digits)} ${sym}` : DH.usd(v, digits));
  const axisUnit = (unit) => (unit === 'coin' ? (v) => DH.compact(v, 1) : (v) => DH.usd(v, 1));
  const pxAxis = (v) => (Math.abs(v) >= 1000 ? '$' + DH.compact(v, 1) : DH.price(v));

  DH.OI = { OTHERS_COLOR, multiSelect, venueItems, venueStack, inUnit, fmtUnit, axisUnit, pxAxis };
})();
