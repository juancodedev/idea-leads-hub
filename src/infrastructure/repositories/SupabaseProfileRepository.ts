import { SupabaseClient } from '@supabase/supabase-js';
import { Profile, UpdateProfileDTO } from "../../core/domain/Profile";
import { ProfileRepository } from "../../core/ports/ProfileRepository";

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getProfile(id: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? this.mapToDomain(data) : null;
  }

  async updateProfile(id: string, profile: UpdateProfileDTO): Promise<Profile> {
    const updates = {
      full_name: profile.fullName,
      avatar_url: profile.avatarUrl,
      company_name: profile.companyName,
      job_title: profile.jobTitle,
      phone: profile.phone,
      bio: profile.bio,
      website: profile.website,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  private mapToDomain(row: any): Profile {
    return {
      id: row.id,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      companyName: row.company_name,
      jobTitle: row.job_title,
      phone: row.phone,
      bio: row.bio,
      website: row.website,
      updatedAt: row.updated_at,
    };
  }
}
