export function getDatabaseConfig() {
  const provider = (process.env.DATABASE_PROVIDER || "sqlite").trim().toLowerCase();
  const sqlitePath = process.env.SQLITE_PATH?.trim() || "./data/margot-flow.db";
  const normalizedProvider = provider === "postgres" || provider === "supabase" ? provider : "sqlite";

  return {
    provider: normalizedProvider as "sqlite" | "postgres" | "supabase",
    sqlitePath,
    usingFallbackSqlitePath: !process.env.SQLITE_PATH?.trim(),
    supportsExternalDatabase: normalizedProvider !== "sqlite",
  };
}
