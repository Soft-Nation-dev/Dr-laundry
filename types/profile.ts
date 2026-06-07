export type Profile = {
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
};

export type UpdateProfileInput = {
  name: string;
  phoneNumber: string;
  address: string;
};
