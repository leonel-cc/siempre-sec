export type DisabledProviderMode = 'development-code';

export class ProductionProviderDisabledError extends Error {}

export function disabledProviderMode(nodeEnv: string | undefined): DisabledProviderMode {
  if (nodeEnv === 'production') {
    throw new ProductionProviderDisabledError('Provider cannot be disabled in production');
  }
  return 'development-code';
}
