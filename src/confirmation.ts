import { createInterface } from "node:readline/promises";
import { digest, requireThat } from "./files";
import type { Confirm } from "./lifecycle";

/** A preview exits before the lifecycle writes a receipt or changes state. */
export class ConfirmationRequest extends Error {
  constructor(message: string, readonly review: string) { super(message); }
}

export function confirmation(options: { prepare?: boolean; review?: string; response?: string;
  context: { projectId: string; command: string; args: string[]; note?: string } }) {
  const chat = options.review !== undefined || options.response !== undefined;
  requireThat(!options.prepare || !chat, "Prepara la revisión antes de registrar la respuesta del chat.");
  if (chat) {
    requireThat(!!options.review && /^[a-f0-9]{64}$/.test(options.review), "Falta el identificador --review que devolvió --prepare.");
    requireThat(!!options.response?.trim() && options.response.length <= 3000,
      "Incluye la respuesta explícita de la persona con --chat-response (hasta 3000 caracteres).");
  }
  const confirm: Confirm = async (message, snapshot) => {
    const review = digest({ snapshot, ...options.context });
    if (options.prepare) throw new ConfirmationRequest(message, review);
    if (chat) {
      requireThat(review === options.review,
        "La revisión cambió desde que se presentó en el chat. Prepara y presenta la versión actual antes de pedir una nueva confirmación.");
      return;
    }
    requireThat(process.stdin.isTTY && process.stderr.isTTY,
      "Confirma en el chat usando la revisión de --prepare, o ejecuta este comando en una terminal interactiva.");
    const terminal = createInterface({ input: process.stdin, output: process.stderr });
    try {
      process.stderr.write(message + "\n");
      const answer = await terminal.question("Escribe CONFIRMAR: ");
      requireThat(answer.trim() === "CONFIRMAR", "La confirmación no coincide.");
    } finally { terminal.close(); }
  };
  const note = (detail: string) => {
    const result = chat ? `${detail.trim()}\nRespuesta en el chat: ${options.response}` : detail;
    requireThat(result.trim().length >= 8 && result.length <= 4000,
      "La nota y la respuesta deben ocupar entre 8 y 4000 caracteres.");
    return result;
  };
  return { confirm, note };
}
