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
    const dataToUpsert = {
      id,
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
      .upsert(dataToUpsert)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
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
