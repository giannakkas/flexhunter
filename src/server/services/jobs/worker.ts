// ==============================================
// Worker Process Entry Point
// ==============================================
// Run with: npm run worker

import 'dotenv/config';
import { startWorkers, scheduleRecurringJobs } from './jobQueue';

async function main() {
  console.log('🔧 Starting FlexHunter workers...');
  startWorkers();
  await scheduleRecurringJobs();
  console.log('✓ FlexHunter worker process running');
}

main().catch((err) => {
  console.error('Worker startup failed:', err);
  process.exit(1);
});
