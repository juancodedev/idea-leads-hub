import { Profile, UpdateProfileDTO } from "../domain/Profile";

export interface ProfileRepository {
  getProfile(id: string): Promise<Profile | null>;
  updateProfile(id: string, profile: UpdateProfileDTO): Promise<Profile>;
  uploadAvatar(userId: string, file: File): Promise<string>;
}
