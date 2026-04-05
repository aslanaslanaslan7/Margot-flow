export type AdminUserSummary = {
  id: string;
  email: string;
  fullName: string;
  role: "owner" | "manager" | "operator";
  status: "active" | "disabled";
  sessionVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type UserAdminAction = "set-status" | "revoke-sessions";
