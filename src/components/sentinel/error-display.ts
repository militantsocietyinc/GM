/**
 * Error display wrapper for Sentinel panels.
 * Clears container and builds error UI with safe DOM methods (no innerHTML).
 *
 * Usage:
 *   try { renderPanel(...) } catch (err) { createErrorDisplay('SocialFeed', container, err); }
 */
export function createErrorDisplay(moduleName: string, container: HTMLElement, error: Error): void {
  while (container.firstChild) container.removeChild(container.firstChild);

  const wrapper = document.createElement('div');
  wrapper.className = 'sentinel-error-panel';
  wrapper.setAttribute('role', 'alert');
  wrapper.style.cssText = 'padding:16px;text-align:center;';

  const title = document.createElement('strong');
  title.textContent = moduleName;
  wrapper.appendChild(title);

  const msg = document.createTextNode(': temporarily unavailable');
  wrapper.appendChild(msg);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Retry';
  btn.style.cssText = 'margin-top:8px;display:block;margin-left:auto;margin-right:auto;';
  btn.onclick = () => container.dispatchEvent(new CustomEvent('sentinel:retry'));
  wrapper.appendChild(btn);

  const details = document.createElement('details');
  details.style.cssText = 'margin-top:8px;font-size:0.85em;opacity:0.7;';
  const summary = document.createElement('summary');
  summary.textContent = 'Error details';
  details.appendChild(summary);
  const pre = document.createElement('pre');
  pre.style.cssText = 'white-space:pre-wrap;word-break:break-all;';
  pre.textContent = error.message;
  details.appendChild(pre);
  wrapper.appendChild(details);

  container.appendChild(wrapper);
  console.error(`[${moduleName}] Panel error:`, error);
}
