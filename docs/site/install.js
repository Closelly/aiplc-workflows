// SPDX-License-Identifier: MIT
const request = document.querySelector('#request');
const opener = document.querySelector('#open-codex');
const copier = document.querySelector('#copy-request');
const status = document.querySelector('#status');
const codexUrl = new URL('codex://new');
codexUrl.searchParams.set('prompt', request.value.trim());
opener.href = codexUrl.toString();
opener.addEventListener('click', () => {
  status.textContent = 'Continúa en Codex y envía la solicitud para empezar. Si no se abre, copia el texto y pégalo en tu chat.';
});
copier.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(request.value.trim());
    status.textContent = 'Solicitud copiada. Pégala en tu chat de Codex y envíala cuando estés listo.';
  } catch {
    request.focus();
    request.select();
    status.textContent = 'El texto está seleccionado. Usa Copiar y pégalo en tu chat de Codex.';
  }
});
// The README explicitly requests opening the app. Browsers may still require
// another click or confirmation; the visible button and copy option remain usable.
if (new URL(location.href).searchParams.get('open') === '1') {
  status.textContent = 'Intentando abrir Codex… Si no se abre, usa Abrir Codex o copia la solicitud.';
  window.location.assign(codexUrl.toString());
}
