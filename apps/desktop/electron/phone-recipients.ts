import { deviceRequest } from './cloud-enrollment';
import { readEncrypted, removeSecureFile, writeEncrypted } from './secure-storage';

const STORAGE_FILE = 'phone-recipients.bin';
const E164 = /^\+[1-9]\d{7,14}$/;
const MAX_CONTACTS = 100;

let phoneStoreOperations: Promise<void> = Promise.resolve();

interface PendingRecipient {
  state: 'pending';
  challengeId: string;
  contactName: string;
  phone: string;
  phoneMask: string;
  expiresAt: string;
  developmentCode?: string;
}

interface VerifiedRecipient {
  state: 'verified';
  recipientId: string;
  contactName: string;
  phone?: string;
  phoneMask: string;
  enabled: boolean;
  verifiedAt: string;
  requiresReverification: boolean;
}

interface RecipientStore {
  pending: PendingRecipient[];
  verified: VerifiedRecipient[];
}

export interface PhoneRecipientView {
  state: 'pending' | 'verified';
  challengeId?: string;
  recipientId?: string;
  contactName: string;
  phoneMask: string;
  expiresAt?: string;
  enabled?: boolean;
  verifiedAt?: string;
  requiresReverification?: boolean;
  developmentCode?: string;
}

interface CloudRecipient {
  id: string;
  contactName: string;
  phoneMask: string;
  enabled: boolean;
  verifiedAt: string;
  requiresReverification: boolean;
}

function loadStore(): RecipientStore {
  const stored = readEncrypted<RecipientStore>(STORAGE_FILE);
  if (!stored || !Array.isArray(stored.pending) || !Array.isArray(stored.verified)) {
    return { pending: [], verified: [] };
  }
  return stored;
}

function saveStore(store: RecipientStore): void {
  writeEncrypted(STORAGE_FILE, store);
}

function serializePhoneStoreOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = phoneStoreOperations.then(operation);
  phoneStoreOperations = result.then(() => undefined, () => undefined);
  return result;
}

function validatePhone(phone: string): string {
  const value = phone.trim();
  if (!E164.test(value)) throw new Error('El teléfono debe usar formato E.164, por ejemplo +34123456789');
  return value;
}

function validateContactName(contactName: string): string {
  const value = contactName.trim();
  if (!value) throw new Error('El nombre del contacto es obligatorio');
  if (value.length > 100) throw new Error('El nombre del contacto es demasiado largo');
  return value;
}

function currentStore(): RecipientStore {
  const store = loadStore();
  const now = Date.now();
  const pending = store.pending.filter(item => Date.parse(item.expiresAt) > now);
  if (pending.length !== store.pending.length) {
    store.pending = pending;
    saveStore(store);
  }
  return store;
}

function views(store: RecipientStore): PhoneRecipientView[] {
  return [
    ...store.pending.map(item => ({
      state: item.state,
      challengeId: item.challengeId,
      contactName: item.contactName,
      phoneMask: item.phoneMask,
      expiresAt: item.expiresAt,
      developmentCode: item.developmentCode,
    })),
    ...store.verified.map(item => ({
      state: item.state,
      recipientId: item.recipientId,
      contactName: item.contactName,
      phoneMask: item.phoneMask,
      enabled: item.enabled,
      verifiedAt: item.verifiedAt,
      requiresReverification: item.requiresReverification,
    })),
  ];
}

export function listPhoneRecipients(): Promise<PhoneRecipientView[]> {
  return serializePhoneStoreOperation(async () => {
    const cloud = await deviceRequest<CloudRecipient[]>('/v1/installations/me/whatsapp-recipients');
    const store = currentStore();
    if (cloud.length + store.pending.length > MAX_CONTACTS) {
      throw new Error(`Se admite un máximo de ${MAX_CONTACTS} contactos`);
    }
    store.verified = cloud.map(item => {
      const local = store.verified.find(candidate => candidate.recipientId === item.id);
      return {
        state: 'verified',
        recipientId: item.id,
        contactName: local?.contactName ?? item.contactName,
        phone: local?.phone,
        phoneMask: item.phoneMask,
        enabled: item.enabled,
        verifiedAt: item.verifiedAt,
        requiresReverification: item.requiresReverification,
      };
    });
    saveStore(store);
    return views(store);
  });
}

export function requestPhoneVerification(contactNameInput: string, phoneInput: string): Promise<PhoneRecipientView[]> {
  return serializePhoneStoreOperation(async () => {
    const contactName = validateContactName(contactNameInput);
    const phone = validatePhone(phoneInput);
    const existing = currentStore();
    const result = await deviceRequest<{
      challengeId: string;
      mask: string;
      expiresAt: string;
      developmentCode?: string;
    }>('/v1/installations/me/whatsapp-recipients/verification/request', {
      method: 'POST',
      body: { contactName, phone },
    });
    const store = currentStore();
    store.pending = store.pending.filter(item => item.challengeId !== result.challengeId);
    store.pending.push({
      state: 'pending',
      contactName,
      phone,
      challengeId: result.challengeId,
      phoneMask: result.mask,
      expiresAt: result.expiresAt,
      developmentCode: result.developmentCode,
    });
    saveStore(store);
    return views(store);
  });
}

export function confirmPhoneVerification(challengeId: string, code: string): Promise<PhoneRecipientView[]> {
  return serializePhoneStoreOperation(async () => {
    if (!/^[0-9]{6}$/.test(code)) throw new Error('El código debe contener 6 dígitos');
    const pending = currentStore().pending.find(item => item.challengeId === challengeId);
    if (!pending) throw new Error('La verificación pendiente no existe o expiró');
    const result = await deviceRequest<{
      recipientId: string;
      contactName: string;
      mask: string;
      enabled: boolean;
      verifiedAt: string;
      requiresReverification: boolean;
    }>('/v1/installations/me/whatsapp-recipients/verification/confirm', {
      method: 'POST',
      body: { challengeId, phone: pending.phone, code },
    });
    const store = currentStore();
    store.pending = store.pending.filter(item => item.challengeId !== challengeId);
    store.verified = store.verified.filter(item => item.recipientId !== result.recipientId);
    store.verified.push({
      state: 'verified',
      phone: pending.phone,
      recipientId: result.recipientId,
      contactName: result.contactName,
      phoneMask: result.mask,
      enabled: result.enabled,
      verifiedAt: result.verifiedAt,
      requiresReverification: result.requiresReverification,
    });
    saveStore(store);
    return views(store);
  });
}

export function setPhoneRecipientEnabled(recipientId: string, enabled: boolean): Promise<PhoneRecipientView[]> {
  return serializePhoneStoreOperation(async () => {
    if (!recipientId) throw new Error('Invalid recipient');
    const action = enabled ? 'activate' : 'deactivate';
    const updated = await deviceRequest<CloudRecipient>(
      `/v1/installations/me/whatsapp-recipients/${encodeURIComponent(recipientId)}/${action}`,
      { method: 'POST' },
    );
    const store = currentStore();
    const local = store.verified.find(item => item.recipientId === recipientId);
    if (local) {
      local.enabled = updated.enabled;
      local.phoneMask = updated.phoneMask;
      local.verifiedAt = updated.verifiedAt;
      local.requiresReverification = updated.requiresReverification;
    }
    saveStore(store);
    return views(store);
  });
}

export function deletePhoneRecipient(recipientId: string): Promise<PhoneRecipientView[]> {
  return serializePhoneStoreOperation(async () => {
    if (!recipientId) throw new Error('Invalid recipient');
    await deviceRequest<void>(
      `/v1/installations/me/whatsapp-recipients/${encodeURIComponent(recipientId)}`,
      { method: 'DELETE' },
    );
    const store = currentStore();
    store.verified = store.verified.filter(item => item.recipientId !== recipientId);
    saveStore(store);
    return views(store);
  });
}

export function sendTestPhoneAlert(recipientId: string): Promise<{ sent: true; messageId: string | null }> {
  return serializePhoneStoreOperation(async () => {
    const recipient = currentStore().verified.find(item => item.recipientId === recipientId);
    if (!recipient?.phone || !E164.test(recipient.phone) || !recipient.enabled || recipient.requiresReverification) {
      throw new Error('El contacto debe estar verificado y activo para enviar una prueba');
    }
    return deviceRequest<{ sent: true; messageId: string | null }>(
      `/v1/installations/me/whatsapp-recipients/${encodeURIComponent(recipientId)}/test`,
      { method: 'POST', body: { phone: recipient.phone } },
    );
  });
}

export function clearPhoneRecipients(): Promise<void> {
  return serializePhoneStoreOperation(async () => removeSecureFile(STORAGE_FILE));
}

export function getPhoneRecipientsForDispatch(): Array<{ recipientId: string; phone: string }> {
  const recipients = currentStore().verified
    .filter((item): item is VerifiedRecipient & { phone: string } => !!item.phone && E164.test(item.phone))
    .map(item => ({ recipientId: item.recipientId, phone: item.phone }));
  if (recipients.length > MAX_CONTACTS) {
    throw new Error(`Se admite un máximo de ${MAX_CONTACTS} contactos`);
  }
  return recipients;
}
