// SPDX-License-Identifier: MIT
const request = document.querySelector('#request');
const opener = document.querySelector('#open-codex');
const status = document.querySelector('#status');
function fitMessage() {
  request.style.height = 'auto';
  request.style.height = request.scrollHeight + 2 + 'px';
}
fitMessage();
window.addEventListener('resize', fitMessage);
const codexUrl = new URL('codex://new');
codexUrl.searchParams.set('prompt', request.value.trim());
opener.href = codexUrl.toString();
opener.addEventListener('click', () => {
  status.textContent = 'Envía el mensaje en Codex para instalar. Si no se abre, copia el texto y pégalo en tu chat.';
});
document.querySelector('#copy-request').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(request.value.trim());
    status.textContent = 'Mensaje copiado. Pégalo en tu chat de Codex.';
  } catch {
    request.focus();
    request.select();
    status.textContent = 'El mensaje está seleccionado. Usa Copiar y pégalo en tu chat de Codex.';
  }
});
