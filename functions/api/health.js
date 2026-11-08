export async function onRequestGet({ env }) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({
        ok: false,
        error: "D1 binding DB is not available"
      }), { status: 500, headers });
    }

    const result = await env.DB
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all();

    const tables = (result.results || []).map(row => row.name);
    const expected = [
      "users",
      "licenses",
      "business_plans",
      "module_data",
      "sessions",
      "webhook_events"
    ];

    return new Response(JSON.stringify({
      ok: true,
      database: "connected",
      expectedTables: expected.map(name => ({
        name,
        exists: tables.includes(name)
      })),
      tables
    }, null, 2), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Database check failed"
    }), { status: 500, headers });
  }
}
