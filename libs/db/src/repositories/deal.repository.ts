import { supabase } from '../client';
import type {
  Deal,
  CreateDealInput,
  UpdateDealInput,
  DealFilters,
  PaginatedResult,
  PipelineStageStats,
} from '@salesbuddy/shared-types';
import { parsePagination } from '@salesbuddy/shared-utils';

const TABLE = 'deals';

export class DealRepository {
  /**
   * Paginated list of non-deleted deals for a workspace with optional stage filter.
   */
  async findAll(
    workspaceId: string,
    filters: DealFilters = {},
  ): Promise<PaginatedResult<Deal>> {
    const { page, limit, offset } = parsePagination(filters.page, filters.limit);

    let query = supabase
      .from(TABLE)
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.stage_id) {
      query = query.eq('stage_id', filters.stage_id);
    }
    if (filters.owner_id) {
      query = query.eq('owner_id', filters.owner_id);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`DealRepository.findAll: ${error.message}`);

    return {
      data: (data ?? []) as Deal[],
      total: count ?? 0,
      page,
      limit,
      has_more: offset + limit < (count ?? 0),
    };
  }

  /**
   * Find a deal by id; also fetches related activities.
   */
  async findById(workspaceId: string, id: string): Promise<(Deal & { activities: unknown[] }) | null> {
    const { data: deal, error: dealError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (dealError) {
      if (dealError.code === 'PGRST116') return null;
      throw new Error(`DealRepository.findById: ${dealError.message}`);
    }

    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('deal_id', id)
      .order('performed_at', { ascending: false })
      .limit(50);

    return { ...(deal as Deal), activities: activities ?? [] };
  }

  /**
   * Create a new deal.
   */
  async create(workspaceId: string, data: CreateDealInput): Promise<Deal> {
    const { data: created, error } = await supabase
      .from(TABLE)
      .insert({
        ...data,
        workspace_id: workspaceId,
        currency: data.currency ?? 'USD',
        tags: data.tags ?? [],
      })
      .select()
      .single();

    if (error) throw new Error(`DealRepository.create: ${error.message}`);
    return created as Deal;
  }

  /**
   * Update arbitrary fields on a deal.
   */
  async update(workspaceId: string, id: string, data: UpdateDealInput): Promise<Deal> {
    const { data: updated, error } = await supabase
      .from(TABLE)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`DealRepository.update: ${error.message}`);
    return updated as Deal;
  }

  /**
   * Move a deal to a different stage.
   */
  async updateStage(workspaceId: string, id: string, stageId: string): Promise<Deal> {
    const { data: updated, error } = await supabase
      .from(TABLE)
      .update({ stage_id: stageId, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`DealRepository.updateStage: ${error.message}`);
    return updated as Deal;
  }

  /**
   * Mark a deal as won - sets won_at and probability to 100.
   */
  async markWon(workspaceId: string, id: string): Promise<Deal> {
    const { data: updated, error } = await supabase
      .from(TABLE)
      .update({
        won_at: new Date().toISOString(),
        probability: 100,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`DealRepository.markWon: ${error.message}`);
    return updated as Deal;
  }

  /**
   * Mark a deal as lost - sets lost_at, lost_reason, and probability to 0.
   */
  async markLost(workspaceId: string, id: string, reason: string): Promise<Deal> {
    const { data: updated, error } = await supabase
      .from(TABLE)
      .update({
        lost_at: new Date().toISOString(),
        lost_reason: reason,
        probability: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`DealRepository.markLost: ${error.message}`);
    return updated as Deal;
  }

  /**
   * Aggregate pipeline value per stage for dashboard/analytics.
   */
  async getPipelineStats(workspaceId: string): Promise<PipelineStageStats[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('stage_id, value, probability')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .is('won_at', null)
      .is('lost_at', null);

    if (error) throw new Error(`DealRepository.getPipelineStats: ${error.message}`);

    const rows = data ?? [];
    const stageMap: Record<
      string,
      { deal_count: number; total_value: number; prob_sum: number }
    > = {};

    for (const row of rows) {
      const sid = row.stage_id as string;
      if (!stageMap[sid]) {
        stageMap[sid] = { deal_count: 0, total_value: 0, prob_sum: 0 };
      }
      stageMap[sid].deal_count++;
      stageMap[sid].total_value += row.value ?? 0;
      stageMap[sid].prob_sum += row.probability ?? 0;
    }

    return Object.entries(stageMap).map(([stage_id, agg]) => ({
      stage_id,
      stage_name: stage_id, // resolved by caller if stage names are needed
      deal_count: agg.deal_count,
      total_value: agg.total_value,
      avg_probability:
        agg.deal_count > 0 ? Math.round(agg.prob_sum / agg.deal_count) : 0,
    }));
  }
}
