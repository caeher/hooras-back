import { connectLambda } from '@netlify/blobs';
import serverless from 'serverless-http';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { bootstrapPlatform } from '../../server/bootstrap';

let cachedHandler: ReturnType<typeof serverless> | undefined;

export const handler = async (event: APIGatewayProxyEvent, context: Context) => {
  connectLambda({
    blobs: (event as APIGatewayProxyEvent & { blobs?: string }).blobs ?? '',
    headers: event.headers as Record<string, string>,
  });

  if (!cachedHandler) {
    const skipMigrations = process.env.SKIP_RUNTIME_MIGRATIONS === 'true';
    const app = await bootstrapPlatform({ skipMigrations });
    cachedHandler = serverless(app);
  }

  return cachedHandler(event, context);
};
