import { connectLambda } from '@netlify/blobs';
import serverless from 'serverless-http';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { bootstrapPlatform } from '../../server/bootstrap';

const UPLOAD_BINARY_MIME_TYPES = [
  'multipart/form-data',
  'application/octet-stream',
  'application/pdf',
  'image/*',
];

let cachedHandler: ReturnType<typeof serverless> | undefined;

export const handler = async (event: APIGatewayProxyEvent, context: Context) => {
  const blobsContext = (event as APIGatewayProxyEvent & { blobs?: string }).blobs;
  if (blobsContext) {
    connectLambda({
      blobs: blobsContext,
      headers: event.headers as Record<string, string>,
    });
  }

  if (!cachedHandler) {
    const skipMigrations = process.env.SKIP_RUNTIME_MIGRATIONS === 'true';
    const app = await bootstrapPlatform({ skipMigrations });
    cachedHandler = serverless(app, {
      binary: UPLOAD_BINARY_MIME_TYPES,
    });
  }

  return cachedHandler(event, context);
};
