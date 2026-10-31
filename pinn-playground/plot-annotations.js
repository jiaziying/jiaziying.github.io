/* Quantitative labels for the saved-checkpoint fields. No values or metrics are clipped. */
(() => {
  'use strict';
  const descriptions = [
    {id:'ref-map', key:'reference', kind:'field', name:'Analytical reference'},
    {id:'pred-map', key:'prediction', kind:'field', name:'Network prediction'},
    {id:'err-map', key:'error', kind:'error', name:'Absolute prediction error'},
    {id:'limits-correct', key:'correct', kind:'field', name:'Correct-physics network prediction'},
    {id:'limits-wrong', key:'wrong', kind:'field', name:'Wrong-physics network prediction'}
  ];
  const plots = [];
  for (const description of descriptions) {
    const canvas = document.getElementById(description.id);
    if (!canvas || canvas.closest('.quantitative-field')) continue;
    const wrapper = document.createElement('div');
    wrapper.className = 'quantitative-field';
    canvas.before(wrapper);
    wrapper.append(canvas);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${description.name}; position x from 0 to 1 left to right, position y from 0 to 1 bottom to top.`);
    const axes = document.createElement('div');
    axes.className = 'field-axes';
    axes.setAttribute('aria-hidden', 'true');
    axes.innerHTML = '<span class="field-axis-y-name">y</span><span class="field-y-ticks"><span>1</span><span>0.5</span><span>0</span></span><span class="field-x-ticks"><span>0</span><span>0.5</span><span>1</span></span><span class="field-axis-x-name">x</span>';
    wrapper.append(axes);
    const legend = document.createElement('div');
    legend.className = 'field-scale';
    const error = description.kind === 'error';
    legend.innerHTML = `<div class="field-scale-title">${error ? 'Absolute error |uθ − uref|' : 'Wave height u · shared scale'}</div><div class="field-colorbar ${error ? 'field-colorbar-error' : 'field-colorbar-wave'}" aria-hidden="true"></div><div class="field-color-ticks"><span>${error ? '0' : '−1'}</span><span>${error ? '0.5' : '0'}</span><span>1</span></div><p class="field-observed-range">Observed range: evaluating…</p>`;
    wrapper.after(legend);
    plots.push({...description, canvas, range:legend.querySelector('.field-observed-range')});
  }
  const comparison = document.querySelector('.viz-three');
  if (comparison && !document.getElementById('fieldScaleExplanation')) {
    const note = document.createElement('p');
    note.id = 'fieldScaleExplanation';
    note.className = 'field-scale-explanation';
    note.textContent = 'Compare like with like: reference and all predictions use the same fixed −1 to 1 wave-height colors. Absolute error uses a separate 0 to 1 scale. Colors saturate outside these ranges; predictions and numerical metrics retain their original values. All maps show x, y ∈ [0, 1].';
    comparison.after(note);
  }
  function number(value) {
    if (!Number.isFinite(value)) return String(value);
    return Math.abs(value) < 0.00005 ? '0.0000' : value.toFixed(4);
  }
  function field(n, sample) {
    const values = new Float32Array(n*n);
    for (let j=0; j<n; j++) for (let i=0; i<n; i++) values[j*n+i] = sample(i/(n-1),j/(n-1));
    return values;
  }
  function update(event) {
    const api = window.PINN_TEACHING;
    if (!api) return;
    const detail = event?.detail || {};
    const t = Number.isFinite(detail.time) ? detail.time : api.getTime();
    const current = api.getModel();
    const exported = window.PINN_MODELS?.models;
    const fields = {...(detail.fields || {})};
    if (!fields.reference) fields.reference = field(43,(x,y)=>api.analyticWave(t,x,y));
    if (!fields.prediction) fields.prediction = field(43,(x,y)=>api.evaluate(current,t,x,y));
    if (!fields.error) fields.error = field(43,(x,y)=>Math.abs(api.analyticWave(t,x,y)-api.evaluate(current,t,x,y)));
    if (exported?.pinn) fields.correct = field(33,(x,y)=>api.evaluate(exported.pinn,t,x,y));
    const wrong = window.PINN_WRONG_MODEL || exported?.wrong;
    if (wrong) fields.wrong = field(33,(x,y)=>api.evaluate(wrong,t,x,y));
    for (const plot of plots) {
      const values = fields[plot.key];
      if (!values?.length) continue;
      let low=Infinity, high=-Infinity;
      for (const value of values) {low=Math.min(low,value); high=Math.max(high,value);}
      const outside = low < (plot.kind==='error'?0:-1) || high > 1;
      plot.range.textContent = `Observed grid range: ${number(low)} to ${number(high)}${outside ? ' · colors saturated' : ''}`;
      plot.canvas.setAttribute('aria-description', `At t = ${t.toFixed(2)}, sampled range ${number(low)} to ${number(high)}. Fixed color scale ${plot.kind==='error'?'0 to 1':'minus 1 to 1'}.${outside?' Some colors saturate; values are retained.':''}`);
    }
  }
  window.addEventListener('pinn:experiment-updated', update);
  update();
})();
