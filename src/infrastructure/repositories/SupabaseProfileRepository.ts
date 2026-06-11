import { SupabaseClient } from '@supabase/supabase-js';
import { Profile, UpdateProfileDTO } from "../../core/domain/Profile";
import { ProfileRepository } from "../../core/ports/ProfileRepository";
import { Database } from "../database/database.types";

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getProfile(id: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? this.mapToDomain(data as unknown as ProfileRow) : null;
  }

  async updateProfile(id: string, profile: UpdateProfileDTO): Promise<Profile> {
    const dataToUpsert = {
      id,
      full_name: profile.fullName ?? null,
      avatar_url: profile.avatarUrl ?? null,
      company_name: profile.companyName ?? null,
      job_title: profile.jobTitle ?? null,
      phone: profile.phone ?? null,
      bio: profile.bio ?? null,
      website: profile.website ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('profiles')
      .upsert(dataToUpsert as never)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data as unknown as ProfileRow);
  }

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${crypto.randomUUID()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await this.supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = this.supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrl;
  }

  private mapToDomain(row: ProfileRow): Profile {
    return {
      id: row.id,
      fullName: row.full_name ?? undefined,
      avatarUrl: row.avatar_url ?? undefined,
      companyName: row.company_name ?? undefined,
      jobTitle: row.job_title ?? undefined,
      phone: row.phone ?? undefined,
      bio: row.bio ?? undefined,
      website: row.website ?? undefined,
      updatedAt: row.updated_at,
    };
  }
}
