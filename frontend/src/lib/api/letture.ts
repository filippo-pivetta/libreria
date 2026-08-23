/**
 * Fetcher per `/letture/{id}` sul backend FastAPI: la sola cancellazione
 * (qualunque Lettura, aperta o chiusa — vedi `backend/app/services/letture_service.py`).
 * Apertura e chiusura passano da `cambiaStato` (`lib/api/voci.ts`).
 */

export type CancellaLetturaResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function cancellaLettura(
  accessToken: string,
  letturaId: string,
): Promise<CancellaLetturaResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "L’app non è configurata come dovrebbe. Parla con chi mantiene l’istanza." };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/letture/${letturaId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }
  return { status: "ok" };
}
