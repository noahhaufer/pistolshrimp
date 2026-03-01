import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Validate required env vars before any tests run
const required = ['DEVNET_PRIVATE_KEY', 'DEVNET_PUBLIC_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(
      `Missing ${key} in .env — integration tests require a funded devnet wallet.\n` +
      `See .env.example for the required format.`
    );
  }
}
