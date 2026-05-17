import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

const DEFAULT_STAGES = [
  { name: 'Lead In',     probability: 10,  stage_type: 'open' },
  { name: 'Qualified',   probability: 25,  stage_type: 'open' },
  { name: 'Demo',        probability: 40,  stage_type: 'open' },
  { name: 'Proposal',    probability: 70,  stage_type: 'open' },
  { name: 'Negotiation', probability: 85,  stage_type: 'open' },
  { name: 'Closed Won',  probability: 100, stage_type: 'won'  },
];

interface WorkspaceStore {
  workspaceId: string | null;
  loading: boolean;
  initWorkspace: (userId: string, name: string, email: string) => Promise<void>;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  workspaceId: null,
  loading: true,

  reset: () => set({ workspaceId: null, loading: true }),

  initWorkspace: async (userId, name, email) => {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (member?.workspace_id) {
      set({ workspaceId: member.workspace_id, loading: false });
      return;
    }

    const displayName = name || email.split('@')[0] || 'My';
    const slug =
      displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 28) +
      '-' + Date.now().toString(36);

    const { data: workspace } = await supabase
      .from('workspaces')
      .insert({ name: `${displayName}'s Workspace`, slug })
      .select('id')
      .single();

    if (!workspace) {
      set({ loading: false });
      return;
    }

    await Promise.all([
      supabase.from('workspace_members').insert({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'owner',
      }),
      supabase.from('pipeline_stages').insert(
        DEFAULT_STAGES.map((s, i) => ({ ...s, workspace_id: workspace.id, position: i }))
      ),
    ]);

    set({ workspaceId: workspace.id, loading: false });
  },
}));
