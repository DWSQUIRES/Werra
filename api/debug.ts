type DebugRequest = {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type DebugResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

export default function handler(request: DebugRequest, response: DebugResponse) {
  response.statusCode = 200;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify(
      {
        ok: true,
        route: "api/debug",
        method: request.method,
        url: request.url,
        host: request.headers?.host,
        vercel: process.env.VERCEL === "1",
        environment: process.env.VERCEL_ENV,
        node: process.version,
        storeDriver: process.env.WERRA_STORE_DRIVER ?? null,
        hasDatabaseUrl: Boolean(
          process.env.WERRA_POSTGRES_URL ??
            process.env.POSTGRES_URL ??
            process.env.POSTGRES_PRISMA_URL ??
            process.env.DATABASE_URL,
        ),
        hasWalletEncryptionKey: Boolean(process.env.WERRA_WALLET_ENCRYPTION_KEY),
      },
      null,
      2,
    ),
  );
}
