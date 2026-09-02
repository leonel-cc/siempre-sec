import { validateEnvironment } from '../src/config/env';

describe('cloud environment validation', () => {
  it('allows development auth with only a database URL', () => {
    expect(validateEnvironment({
      NODE_ENV: 'development',
      DEV_AUTH_ENABLED: 'true',
      DATABASE_URL: 'postgresql://localhost/test',
    }).DEV_AUTH_ENABLED).toBe('true');
  });

  it.each(['production', 'staging', undefined])(
    'rejects development auth when NODE_ENV is %s',
    (nodeEnvironment) => {
      expect(() => validateEnvironment({
        NODE_ENV: nodeEnvironment,
        DEV_AUTH_ENABLED: 'true',
        DATABASE_URL: 'postgresql://localhost/test',
      })).toThrow('DEV_AUTH_ENABLED requires NODE_ENV=development');
    },
  );

  it('requires OIDC configuration outside development auth', () => {
    expect(() => validateEnvironment({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/test',
    })).toThrow('Missing required environment variable: OIDC_ISSUER');
  });
});
