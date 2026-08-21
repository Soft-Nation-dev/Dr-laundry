export type Profile = {
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  avatarUrl: string;
  role: AppRole;
};

export type AppRole = "customer" | "driver" | "admin" | "superadmin";

export type UpdateProfileInput = {
  name: string;
  phoneNumber: string;
  address: string;
};
