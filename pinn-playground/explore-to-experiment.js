/* A teaching diagram: no training or model weights are changed here. */
(() => {
  'use strict';
  const mount = document.querySelector('#explore-learning-bridge');
  if (!mount) return;
  const stages = [
    {
      view: 'explore',
      title: 'Start with a few clues.',
      text: 'A sensor gives the water height at one place and time. Reveal the pond’s seven simulated sensors to see how little of the moving surface is observed.',
      action: 'Try the pond ↓'
    },
    {
      view: 'learn',
      title: 'Use physics between the clues.',
      text: 'During training, the network reduces mismatches with known heights, the wave equation, and the initial and boundary conditions. Derivatives of its prediction let us check the equation even where no height was measured.',
      action: 'See how a PINN learns →'
    },
    {
      view: 'experiment',
      title: 'Ask for a height anywhere in the domain.',
      text: 'Give the trained network time t and position (x, y); it returns a predicted height uθ(t, x, y). In Experiment, compare saved models against an exact reference for one controlled standing-wave example.',
      action: 'Compare the saved predictions →'
    }
  ];
  mount.classList.add('wave-learning-bridge');
  mount.setAttribute('aria-labelledby', 'wave-bridge-title');
  mount.innerHTML = `
    <div class="wlb-heading"><span class="small-kicker">FROM WAVES TO A LEARNED FIELD</span><h3 id="wave-bridge-title">How can a network predict the moving water?</h3><p>A few known heights give it clues. Physics helps connect them.</p></div>
    <div class="wlb-flow" role="tablist" aria-label="Explore the path from observations to predictions">
      <button type="button" class="wlb-step active" id="wlb-tab-0" role="tab" aria-selected="true" aria-controls="wlb-panel" tabindex="0" data-bridge-stage="0"><span class="wlb-stage">01 · Explore</span><b>A few known wave heights</b><span class="wlb-plus">+</span><span class="wlb-equation">Wave equation · initial &amp; boundary conditions</span></button>
      <span class="wlb-arrow" aria-hidden="true">→</span>
      <button type="button" class="wlb-step" id="wlb-tab-1" role="tab" aria-selected="false" aria-controls="wlb-panel" tabindex="-1" data-bridge-stage="1"><span class="wlb-stage">02 · Learn</span><b>Training</b><span class="wlb-step-description">Reduce data and physics mismatches</span><span class="wlb-training-mark" aria-hidden="true">prediction → check → update</span></button>
      <span class="wlb-arrow" aria-hidden="true">→</span>
      <button type="button" class="wlb-step" id="wlb-tab-2" role="tab" aria-selected="false" aria-controls="wlb-panel" tabindex="-1" data-bridge-stage="2"><span class="wlb-stage">03 · Experiment</span><b>A learned wave field</b><span class="wlb-field">(t, x, y) → u<sub>θ</sub>(t, x, y)</span><span class="wlb-step-description">Query the predicted height</span></button>
    </div>
    <div class="wlb-detail" id="wlb-panel" role="tabpanel" aria-labelledby="wlb-tab-0"><div aria-live="polite"><strong id="wlb-detail-title"></strong><p id="wlb-detail-text"></p></div><button type="button" class="wlb-action" id="wlb-action"></button></div>
    <p class="wlb-separation">The pond is a live, lightly damped simulation. Its sensors do not train the saved models. Experiment uses a separate, undamped wave problem with fixed conditions and c = 1; both illustrate the same equation family.</p>`;
  const tabs = Array.from(mount.querySelectorAll('[data-bridge-stage]'));
  const panel = mount.querySelector('#wlb-panel');
  const action = mount.querySelector('#wlb-action');
  let selected = 0;
  function select(index, moveFocus = false) {
    selected = index;
    tabs.forEach((tab, i) => {
      tab.classList.toggle('active', i === index);
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tabs[index].id);
    mount.querySelector('#wlb-detail-title').textContent = stages[index].title;
    mount.querySelector('#wlb-detail-text').textContent = stages[index].text;
    action.textContent = stages[index].action;
    if (moveFocus) tabs[index].focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      const next = { ArrowRight: (index + 1) % 3, ArrowDown: (index + 1) % 3, ArrowLeft: (index + 2) % 3, ArrowUp: (index + 2) % 3, Home: 0, End: 2 }[event.key];
      if (next !== undefined) { event.preventDefault(); select(next, true); }
    });
  });
  action.addEventListener('click', () => {
    if (stages[selected].view === 'explore') {
      document.querySelector('.explore-grid')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      document.querySelector('#sensorToggle')?.focus({ preventScroll: true });
    } else {
      document.querySelector(`.nav-link[data-view="${stages[selected].view}"]`)?.click();
    }
  });
  select(0);
})();
