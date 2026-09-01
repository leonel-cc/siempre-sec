import {
  disabledProviderMode,
  ProductionProviderDisabledError,
} from '../src/notifications/provider-policy';

describe('disabled provider policy', () => {
  it('permits a development code outside production', () => {
    expect(disabledProviderMode('development')).toBe('development-code');
  });

  it('fails closed in production', () => {
    expect(() => disabledProviderMode('production')).toThrow(ProductionProviderDisabledError);
  });
});
