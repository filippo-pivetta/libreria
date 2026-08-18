type HealthResult =
  | { reachable: true; body: unknown }
  | { reachable: false; error: string };

async function getBackendHealth(): Promise<HealthResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(`${baseUrl}/health`, { cache: "no-store" });
    const body: unknown = await response.json();

    if (response.ok) {
      return { reachable: true, body };
    }
    return { reachable: false, error: `Risposta HTTP ${response.status}` };
  } catch (error) {
    return { reachable: false, error: (error as Error).message };
  }
}

export default async function Home() {
  const health = await getBackendHealth();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Montaigne — scaffold</h1>
      <p>Verifica di raggiungibilità del backend tramite {"`"}GET /health{"`"}.</p>
      <p>
        Stato: <strong>{health.reachable ? "raggiungibile" : "non raggiungibile"}</strong>
      </p>
      <pre
        style={{
          background: "#f4f4f4",
          padding: "1rem",
          borderRadius: "0.5rem",
          overflowX: "auto",
        }}
      >
        {JSON.stringify(health.reachable ? health.body : { error: health.error }, null, 2)}
      </pre>
    </main>
  );
}
