import { ConfigService } from '@nestjs/config';
import { MetaWhatsAppProvider } from '../src/notifications/whatsapp.provider';

const configuration: Record<string, string> = {
  WHATSAPP_ENABLED: 'true',
  WHATSAPP_ACCESS_TOKEN: 'test-token',
  WHATSAPP_PHONE_NUMBER_ID: '123456789',
  WHATSAPP_API_VERSION: 'v20.0',
  WHATSAPP_AUTH_TEMPLATE_NAME: 'demo_auth',
  WHATSAPP_ALERT_TEMPLATE_NAME: 'demo_alert',
  WHATSAPP_TEMPLATE_LANGUAGE: 'es',
};

function createProvider(overrides: Record<string, string> = {}) {
  const values = { ...configuration, ...overrides };
  const config = {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    getOrThrow: jest.fn((key: string) => {
      if (!values[key]) throw new Error(`Missing ${key}`);
      return values[key];
    }),
  } as unknown as ConfigService;
  return new MetaWhatsAppProvider(config);
}

describe('MetaWhatsAppProvider template payloads', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the approved authentication template with one code parameter', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ messages: [{ id: 'wamid.auth' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(createProvider().sendAuthenticationCode('+14155552671', '123456'))
      .resolves.toEqual({ messageId: 'wamid.auth' });
    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      to: '14155552671',
      template: {
        name: 'demo_auth',
        language: { code: 'es' },
        components: [{ parameters: [{ type: 'text', text: '123456' }] }],
      },
    });
  });

  it('sends the approved alert template with event and camera parameters', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ messages: [{ id: 'wamid.alert' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(createProvider().sendAlert('+14155552671', 'DEMO_ALERT', 'Casa'))
      .resolves.toEqual({ messageId: 'wamid.alert' });
    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      to: '14155552671',
      template: {
        name: 'demo_alert',
        components: [{
          parameters: [
            { type: 'text', text: 'DEMO_ALERT' },
            { type: 'text', text: 'Casa' },
          ],
        }],
      },
    });
  });

  it('sends hello_world without components in development demo mode', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ messages: [{ id: 'wamid.demo' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const provider = createProvider({ WHATSAPP_DEMO_TEMPLATE_NAME: ' hello_world ' });
    expect(provider.authenticationEnabled).toBe(false);
    await expect(provider.sendAlert('+14155552671', 'DEMO_ALERT', 'Casa'))
      .resolves.toEqual({ messageId: 'wamid.demo' });
    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      to: '14155552671',
      template: { name: 'hello_world', language: { code: 'en_US' } },
    });
    expect(JSON.parse(String(request?.body)).template).not.toHaveProperty('components');
  });
});
