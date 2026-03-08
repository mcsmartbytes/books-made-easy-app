'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/utils/supabase';

interface Entity {
  id: string;
  name: string;
  legal_name: string;
  entity_type: string;
  tax_id: string;
  is_active: number;
  organization_id: string;
}

interface Organization {
  id: string;
  name: string;
}

interface EntityContextType {
  currentEntityId: string | null;
  currentEntity: Entity | null;
  entities: Entity[];
  organization: Organization | null;
  setCurrentEntity: (entityId: string | null) => void;
  isConsolidated: boolean;
  loading: boolean;
  refreshEntities: () => Promise<void>;
}

const EntityContext = createContext<EntityContextType | undefined>(undefined);

const STORAGE_KEY = 'bme_selected_entity_id';

export function EntityProvider({ children }: { children: ReactNode }) {
  const [currentEntityId, setCurrentEntityId] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const currentEntity = currentEntityId
    ? entities.find((e) => e.id === currentEntityId) || null
    : null;

  const isConsolidated = currentEntityId === null;

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored !== 'all') {
      setCurrentEntityId(stored);
    }
    loadEntities();
  }, []);

  const loadEntities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // First load organizations
      const orgRes = await fetch(`/api/organizations?user_id=${user.id}`);
      const orgResult = await orgRes.json();

      if (!orgResult.success || !orgResult.data?.length) {
        setLoading(false);
        return;
      }

      const org = orgResult.data[0];
      setOrganization(org);

      // Then load entities for this organization
      const entRes = await fetch(`/api/entities?user_id=${user.id}&organization_id=${org.id}`);
      const entResult = await entRes.json();

      if (entResult.success) {
        const entityList = entResult.data || [];
        setEntities(entityList);

        // Validate stored selection still exists
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && stored !== 'all') {
          const exists = entityList.some((e: Entity) => e.id === stored);
          if (!exists && entityList.length > 0) {
            setCurrentEntityId(entityList[0].id);
            localStorage.setItem(STORAGE_KEY, entityList[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load entities:', error);
    } finally {
      setLoading(false);
    }
  };

  const setCurrentEntity = (entityId: string | null) => {
    setCurrentEntityId(entityId);
    if (entityId) {
      localStorage.setItem(STORAGE_KEY, entityId);
    } else {
      localStorage.setItem(STORAGE_KEY, 'all');
    }
  };

  const refreshEntities = async () => {
    await loadEntities();
  };

  return (
    <EntityContext.Provider
      value={{
        currentEntityId,
        currentEntity,
        entities,
        organization,
        setCurrentEntity,
        isConsolidated,
        loading,
        refreshEntities,
      }}
    >
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity() {
  const context = useContext(EntityContext);
  if (context === undefined) {
    throw new Error('useEntity must be used within an EntityProvider');
  }
  return context;
}
