export interface UserProfile {
  name: string;
  avatarType: 'default' | 'custom';
  avatarUri?: string;
  updatedAt?: string;
}
