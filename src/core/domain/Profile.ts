export interface Profile {
  id: string;
  fullName?: string;
  avatarUrl?: string;
  companyName?: string;
  jobTitle?: string;
  phone?: string;
  bio?: string;
  website?: string;
  updatedAt: string;
}

export interface UpdateProfileDTO {
  fullName?: string;
  avatarUrl?: string;
  companyName?: string;
  jobTitle?: string;
  phone?: string;
  bio?: string;
  website?: string;
}
