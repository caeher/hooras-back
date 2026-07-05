import { readFileSync, writeFileSync } from 'fs';
import { resolveBundledAsset } from '../config/runtime';
import { collectRoutes, syncOpenApiSpec } from '../app/openapi/syncOpenApiSpec';

const OUTPUT_PATH = resolveBundledAsset('openapi.yml');

function main() {
  const routes = collectRoutes();
  const existingRaw = readFileSync(OUTPUT_PATH, 'utf8');
  const next = syncOpenApiSpec(existingRaw, routes);

  writeFileSync(OUTPUT_PATH, next, 'utf8');

  console.log(`Generated ${OUTPUT_PATH} from ${routes.length} Express routes`);
}

main();
