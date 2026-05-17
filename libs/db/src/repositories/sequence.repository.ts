import { supabase } from '../client';
import type {
  Sequence,
  SequenceStep,
  Enrollment,
  CreateSequenceInput,
  CreateSequenceStepInput,
  EnrollmentFilters,
} from '@salesbuddy/shared-types';

const SEQ_TABLE = 'sequences';
const STEP_TABLE = 'sequence_steps';
const ENROLL_TABLE = 'sequence_enrollments';

export class SequenceRepository {
  /**
   * List all non-archived sequences for a workspace.
   */
  async findAll(workspaceId: string): Promise<Sequence[]> {
    const { data, error } = await supabase
      .from(SEQ_TABLE)
      .select('*')
      .eq('workspace_id', workspaceId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`SequenceRepository.findAll: ${error.message}`);
    return (data ?? []) as Sequence[];
  }

  /**
   * Get a sequence with its steps and enrollment count.
   */
  async findById(
    workspaceId: string,
    id: string,
  ): Promise<(Sequence & { steps: SequenceStep[]; enrollment_count: number }) | null> {
    const { data: seq, error: seqErr } = await supabase
      .from(SEQ_TABLE)
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .single();

    if (seqErr) {
      if (seqErr.code === 'PGRST116') return null;
      throw new Error(`SequenceRepository.findById: ${seqErr.message}`);
    }

    const { data: steps, error: stepsErr } = await supabase
      .from(STEP_TABLE)
      .select('*')
      .eq('sequence_id', id)
      .order('step_number', { ascending: true });

    if (stepsErr) throw new Error(`SequenceRepository.findById steps: ${stepsErr.message}`);

    const { count, error: countErr } = await supabase
      .from(ENROLL_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('sequence_id', id);

    if (countErr) throw new Error(`SequenceRepository.findById count: ${countErr.message}`);

    return {
      ...(seq as Sequence),
      steps: (steps ?? []) as SequenceStep[],
      enrollment_count: count ?? 0,
    };
  }

  /**
   * Create a sequence along with its steps in a single transaction-like batch.
   */
  async create(
    workspaceId: string,
    data: Omit<CreateSequenceInput, 'steps'>,
    steps: CreateSequenceStepInput[],
  ): Promise<Sequence & { steps: SequenceStep[] }> {
    const { data: seq, error: seqErr } = await supabase
      .from(SEQ_TABLE)
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        status: 'draft',
      })
      .select()
      .single();

    if (seqErr) throw new Error(`SequenceRepository.create seq: ${seqErr.message}`);

    const seqId = (seq as Sequence).id;

    const stepRows = steps.map((s) => ({
      sequence_id: seqId,
      step_number: s.step_number,
      channel: (s as any).type ?? (s as any).channel ?? 'email',
      subject: s.subject ?? null,
      body: s.body,
      delay_days: s.delay_days ?? 0,
    }));

    const { data: createdSteps, error: stepsErr } = await supabase
      .from(STEP_TABLE)
      .insert(stepRows)
      .select();

    if (stepsErr) throw new Error(`SequenceRepository.create steps: ${stepsErr.message}`);

    return {
      ...(seq as Sequence),
      steps: (createdSteps ?? []) as SequenceStep[],
    };
  }

  /**
   * Update the status of a sequence (pause / resume / archive).
   */
  async updateStatus(
    workspaceId: string,
    id: string,
    status: string,
  ): Promise<Sequence> {
    const { data, error } = await supabase
      .from(SEQ_TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`SequenceRepository.updateStatus: ${error.message}`);
    return data as Sequence;
  }

  /**
   * Enroll one or more contacts into a sequence.
   * Skips contacts already actively enrolled.
   */
  async enroll(
    workspaceId: string,
    sequenceId: string,
    contactIds: string[],
  ): Promise<Enrollment[]> {
    // Check for existing active enrollments to avoid duplicates
    const { data: existing } = await supabase
      .from(ENROLL_TABLE)
      .select('contact_id')
      .eq('workspace_id', workspaceId)
      .eq('sequence_id', sequenceId)
      .eq('status', 'active')
      .in('contact_id', contactIds);

    const existingIds = new Set((existing ?? []).map((r: { contact_id: string }) => r.contact_id));
    const toEnroll = contactIds.filter((id) => !existingIds.has(id));

    if (toEnroll.length === 0) return [];

    const rows = toEnroll.map((contactId) => ({
      workspace_id: workspaceId,
      sequence_id: sequenceId,
      contact_id: contactId,
      status: 'active',
      current_step: 1,
      next_send_at: new Date().toISOString(),
      enrolled_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase.from(ENROLL_TABLE).insert(rows).select();
    if (error) throw new Error(`SequenceRepository.enroll: ${error.message}`);
    return (data ?? []) as Enrollment[];
  }

  /**
   * List enrollments with optional filters.
   */
  async getEnrollments(
    workspaceId: string,
    filters: EnrollmentFilters = {},
  ): Promise<Enrollment[]> {
    let query = supabase
      .from(ENROLL_TABLE)
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('enrolled_at', { ascending: false });

    if (filters.sequence_id) {
      query = query.eq('sequence_id', filters.sequence_id);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.contact_id) {
      query = query.eq('contact_id', filters.contact_id);
    }

    const { data, error } = await query;
    if (error) throw new Error(`SequenceRepository.getEnrollments: ${error.message}`);
    return (data ?? []) as Enrollment[];
  }
}
