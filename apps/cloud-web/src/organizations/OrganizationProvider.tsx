import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Membership, Organization } from '../types';

interface OrganizationContextValue {
  memberships: Membership[];
  selected: Membership | null;
  loading: boolean;
  error: string | null;
  select: (organizationId: string) => void;
  refresh: () => Promise<void>;
  create: (name: string) => Promise<Organization>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);
const selectionKey = 'siempre.selectedOrganization';

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem(selectionKey));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    try {
      const nextMemberships = await api.get<Membership[]>('/v1/organizations');
      setMemberships(nextMemberships);
      setSelectedId((current) => {
        if (current && nextMemberships.some((item) => item.organizationId === current)) return current;
        return nextMemberships[0]?.organizationId ?? null;
      });
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (selectedId) sessionStorage.setItem(selectionKey, selectedId);
    else sessionStorage.removeItem(selectionKey);
  }, [selectedId]);

  const select = (organizationId: string) => setSelectedId(organizationId);
  const create = async (name: string) => {
    const organization = await api.post<Organization>('/v1/organizations', { name });
    await refresh();
    setSelectedId(organization.id);
    return organization;
  };
  const selected = memberships.find((item) => item.organizationId === selectedId) ?? null;

  return (
    <OrganizationContext.Provider value={{ memberships, selected, loading, error, select, refresh, create }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizations(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganizations must be used inside OrganizationProvider');
  return context;
}

export function canAdminister(role: Membership['role'] | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function roleLabel(role: Membership['role']): string {
  const labels: Record<Membership['role'], string> = {
    OWNER: 'Propietario',
    ADMIN: 'Administrador',
    OPERATOR: 'Operador',
    VIEWER: 'Observador',
  };
  return labels[role];
}
