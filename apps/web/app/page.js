export const dynamic = "force-dynamic";

async function loadMatch() {
  const base = process.env["AGENT_URL"] || "http://127.0.0.1:8088";

  try {
    const response = await fetch(`${base}/api/match`, { cache: "no-store" });
    if (!response.ok) {
      return { ok: false, detail: `HTTP ${response.status}` };
    }
    return { ok: true, body: await response.json() };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "unreachable",
    };
  }
}

export default async function Home() {
  const match = await loadMatch();

  return (
    <main>
      <p className="mark">football</p>
      <h1>Match desk</h1>
      <p className={match.ok ? "ok" : "bad"}>
        {match.ok ? "Agent service is connected." : "Agent service is not connected."}
      </p>
      {match.ok ? (
        <dl>
          <div>
            <dt>Service</dt>
            <dd>{match.body.service}</dd>
          </div>
          <div>
            <dt>Message</dt>
            <dd>{match.body.message}</dd>
          </div>
        </dl>
      ) : (
        <p className="detail">{match.detail}</p>
      )}
    </main>
  );
}
