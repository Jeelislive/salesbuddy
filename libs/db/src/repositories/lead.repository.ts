import { supabase } from '../client';
import type {
  Lead,
  CreateLeadInput,
  UpdateLeadInput,
  LeadFilters,
  PaginatedResult,
} from '@salesbuddy/shared-types';
import { parsePagination } from '@salesbuddy/shared-utils';

const TABLE = 'leads';

export class LeadRepository {
  /**
   * Paginated list of non-deleted leads for a workspace.
   * Supports filtering by status, source, and full-text search on name/email.
   */
  async findAll(
    workspaceId: string,
    filters: LeadFilters = {},
  ): Promise<PaginatedResult<Lead>> {
    const { page, limit, offset } = parsePagination(filters.page, filters.limit);

    let query = supabase
      .from(TABLE)
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.source) {
      query = query.eq('source', filters.source);
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      query = query.or(
        `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},company_name.ilike.${term}`,
      );
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`LeadRepository.findAll: ${error.message}`);

    return {
      data: (data ?? []) as Lead[],
      total: count ?? 0,
      page,
      limit,
      has_more: offset + limit < (count ?? 0),
    };
  }

  /**
   * Find a single non-deleted lead by id within a workspace.
   */
  async findById(workspaceId: string, id: string): Promise<Lead | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw new Error(`LeadRepository.findById: ${error.message}`);
    }
    return data as Lead;
  }

  /**
   * Create a new lead for a workspace.
   */
  async create(workspaceId: string, data: CreateLeadInput): Promise<Lead> {
    const { data: created, error } = await supabase
      .from(TABLE)
      .insert({
        ...data,
        workspace_id: workspaceId,
        tags: data.tags ?? [],
        metadata: data.metadata ?? {},
        status: data.status ?? 'new',
      })
      .select()
      .single();

    if (error) throw new Error(`LeadRepository.create: ${error.message}`);
    return created as Lead;
  }

  /**
   * Update a lead — only non-deleted leads within the workspace can be updated.
   */
  async update(workspaceId: string, id: string, data: UpdateLeadInput): Promise<Lead> {
    const { data: updated, error } = await supabase
      .from(TABLE)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`LeadRepository.update: ${error.message}`);
    return updated as Lead;
  }

  /**
   * Soft-delete a lead by setting deleted_at timestamp.
   */
  async softDelete(workspaceId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw new Error(`LeadRepository.softDelete: ${error.message}`);
  }

  /**
   * Bulk insert an array of leads — inserts all and returns created records.
   */
  async bulkCreate(workspaceId: string, leads: CreateLeadInput[]): Promise<Lead[]> {
    const rows = leads.map((l) => ({
      ...l,
      workspace_id: workspaceId,
      tags: l.tags ?? [],
      metadata: l.metadata ?? {},
      status: l.status ?? 'new',
    }));

    const { data, error } = await supabase.from(TABLE).insert(rows).select();
    if (error) throw new Error(`LeadRepository.bulkCreate: ${error.message}`);
    return (data ?? []) as Lead[];
  }

  /**
   * Aggregate counts by status and average lead score for a workspace.
   */
  async getStats(
    workspaceId: string,
  ): Promise<{ status_counts: Record<string, number>; avg_score: number | null }> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('status, score')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (error) throw new Error(`LeadRepository.getStats: ${error.message}`);

    const rows = data ?? [];
    const status_counts: Record<string, number> = {};
    let scoreSum = 0;
    let scoreCount = 0;

    for (const row of rows) {
      status_counts[row.status] = (status_counts[row.status] ?? 0) + 1;
      if (row.score !== null && row.score !== undefined) {
        scoreSum += row.score;
        scoreCount++;
      }
    }

    return {
      status_counts,
      avg_score: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
    };
  }
}
