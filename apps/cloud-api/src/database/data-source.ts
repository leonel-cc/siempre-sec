import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CLOUD_ENTITIES } from '../entities/entities';
import { InitialCloudSchema1788208000000 } from './migrations/1788208000000-initial-cloud-schema';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run cloud migrations');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: CLOUD_ENTITIES,
  migrations: [InitialCloudSchema1788208000000],
  synchronize: false,
});
