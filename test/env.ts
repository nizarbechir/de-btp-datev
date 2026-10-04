// Tests never use the real e-mail provider from a local .env file: empty values mean "not configured".
for (const name of ["MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET", "MS_GRAPH_SENDER_EMAIL", "MS_GRAPH_TENANT_ID"]) {
	process.env[name] = "";
}
