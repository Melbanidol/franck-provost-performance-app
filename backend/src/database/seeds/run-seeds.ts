import { AppDataSource } from '../../config/data-source';
import { seedReferenceData } from './seed-reference-data';

async function run() {
  const dataSource = await AppDataSource.initialize();
  await seedReferenceData(dataSource);
  await dataSource.destroy();
  // eslint-disable-next-line no-console
  console.log('Seed complete: level_targets, rate_card, formula_settings, performance_tiers');
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
