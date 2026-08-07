export type Profile = {
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  avatarUrl: string;
};

export type UpdateProfileInput = {
  name: string;
  phoneNumber: string;
  address: string;
};
