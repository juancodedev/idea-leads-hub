import { Profile, UpdateProfileDTO } from "../../domain/Profile";
import { ProfileRepository } from "../../ports/ProfileRepository";

export class GetProfile {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async execute(userId: string): Promise<Profile | null> {
    return await this.profileRepository.getProfile(userId);
  }
}

export class UpdateProfile {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async execute(userId: string, dto: UpdateProfileDTO): Promise<Profile> {
    return await this.profileRepository.updateProfile(userId, dto);
  }
}

export class UploadAvatar {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async execute(userId: string, file: File): Promise<string> {
    return await this.profileRepository.uploadAvatar(userId, file);
  }
}
