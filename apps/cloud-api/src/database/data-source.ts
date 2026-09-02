import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { InitialCloudSchema1788208000000 } from './migrations/1788208000000-initial-cloud-schema';
import { InstallationPhoneRecipients1788294400000 } from './migrations/1788294400000-installation-phone-recipients';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run cloud migrations');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  migrations: [InitialCloudSchema1788208000000, InstallationPhoneRecipients1788294400000],
  synchronize: false,
});
