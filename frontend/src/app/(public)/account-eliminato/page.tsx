import { Card, CardContent } from "@/components/ui/card";

/**
 * Schermata finale della cancellazione dell'account (design doc §17,
 * issue #8): due righe e basta, nessun fetch, nessun redirect
 * automatico — a quel punto non c'è più alcuna sessione da leggere, la
 * riga `utente` che l'avrebbe portata è già sparita.
 */
export default function AccountEliminatoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardContent className="flex flex-col gap-2 py-2 text-center">
            <p className="font-ui text-sm font-medium text-ink">Il tuo account non c&apos;è più.</p>
            <p className="text-sm text-pretty text-ink-soft">
              Per rientrare, parla con chi mantiene l&apos;istanza.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
