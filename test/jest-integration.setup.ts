import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test BEFORE any test module is loaded.
// This ensures process.env.DATABASE_URL points to arrowmaze_test
// by the time any test file imports PrismaService or PrismaClient.
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Fail loudly if the test env is missing critical values.
// Better to crash upfront than to accidentally hit the dev database.
if (!process.env.DATABASE_URL) {
  throw new Error(
    '.env.test is missing DATABASE_URL. Integration tests require it.',
  );
}
if (!process.env.DATABASE_URL.includes('arrowmaze_test')) {
  throw new Error(
    `Refusing to run integration tests: DATABASE_URL does not point to arrowmaze_test. Current value: ${process.env.DATABASE_URL}`,
  );
}