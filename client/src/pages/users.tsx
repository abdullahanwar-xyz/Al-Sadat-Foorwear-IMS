import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Edit, Trash2, UserX, Users as UsersIcon, Shield, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { userAPI, type User, type RegisterUserPayload } from "@/service/api";

export default function Users() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole, user: currentUser } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permanentDeleteUser, setPermanentDeleteUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<RegisterUserPayload>({
    user_name: "",
    user_username: "",
    user_password: "",
    phone: "",
    user_type: "ShopKeeper",
  });

  // Reset Password dialog state (admin sets a new password directly - no
  // OTP, no email; this replaces the removed self-service forgot-password
  // flow entirely).
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState("");

  // Check if user has permission
  const canManageUsers = hasRole(["ShopOwner", "SuperAdmin"]);

  // Fetch all users
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: userAPI.getAll,
  });

  // Filter out SuperAdmin users from the list
  const users = allUsers.filter(user => user.user_type !== "SuperAdmin");

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: userAPI.register,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "User Created",
        description: "User has been created successfully",
      });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RegisterUserPayload> }) =>
      userAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "User Updated",
        description: "User has been updated successfully",
      });
      setIsEditOpen(false);
      setSelectedUser(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  // Deactivate user mutation (soft - the account stays, just can't log in)
  const deleteMutation = useMutation({
    mutationFn: userAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "User Deactivated",
        description: "User has been deactivated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to deactivate user",
        variant: "destructive",
      });
    },
  });

  // Permanent delete mutation - irreversible, blocked server-side if the
  // user has any historical activity tied to their account.
  const permanentDeleteMutation = useMutation({
    mutationFn: (id: number) => userAPI.permanentDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "User Permanently Deleted",
        description: "The user has been permanently removed",
      });
      setPermanentDeleteUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Cannot Delete User",
        description: error.response?.data?.message || "Failed to permanently delete user",
        variant: "destructive",
      });
      setPermanentDeleteUser(null);
    },
  });

  // Reset password mutation (admin sets it directly for the target user)
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, new_password }: { id: number; new_password: string }) =>
      userAPI.resetPassword(id, new_password),
    onSuccess: (data) => {
      toast({
        title: "Password Reset",
        description: data.message || "Password has been reset successfully",
      });
      closeResetPasswordDialog();
    },
    onError: (error: any) => {
      setResetPasswordError(error.response?.data?.message || "Failed to reset password");
    },
  });

  const closeResetPasswordDialog = () => {
    setResetPasswordUser(null);
    setNewPassword("");
    setConfirmNewPassword("");
    setResetPasswordError("");
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordError("");

    if (newPassword.length < 6) {
      setResetPasswordError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetPasswordError("Passwords do not match");
      return;
    }
    if (resetPasswordUser) {
      resetPasswordMutation.mutate({ id: resetPasswordUser.user_id, new_password: newPassword });
    }
  };

  const resetForm = () => {
    setFormData({
      user_name: "",
      user_username: "",
      user_password: "",
      phone: "",
      user_type: "ShopKeeper",
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      const updateData: Partial<RegisterUserPayload> = { ...formData };
      // Remove password if empty
      if (!updateData.user_password) {
        const { user_password, ...rest } = updateData;
        updateMutation.mutate({ id: selectedUser.user_id, data: rest });
      } else {
        updateMutation.mutate({ id: selectedUser.user_id, data: updateData });
      }
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      user_name: user.user_name,
      user_username: user.user_username,
      user_password: "", // Don't populate password
      phone: user.phone || "",
      user_type: user.user_type,
    });
    setIsEditOpen(true);
  };

  const handleDeactivate = (id: number) => {
    if (confirm("Are you sure you want to deactivate this user? They will no longer be able to log in.")) {
      deleteMutation.mutate(id);
    }
  };

  const handlePermanentDelete = () => {
    if (permanentDeleteUser) {
      permanentDeleteMutation.mutate(permanentDeleteUser.user_id);
    }
  };

  const getUserTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      SuperAdmin: "destructive",
      ShopOwner: "default",
      Contentuser: "secondary",
      ShopKeeper: "outline",
    };
    return <Badge variant={variants[type] || "outline"}>{type}</Badge>;
  };

  if (!canManageUsers) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <Shield className="h-16 w-16 mx-auto mb-4 text-slate-400" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-slate-600 dark:text-slate-400">
                You don't have permission to manage users.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
            <UsersIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
              User Management
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Manage system users and permissions
            </p>
          </div>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.user_name}</TableCell>
                    <TableCell>{user.user_username}</TableCell>
                    <TableCell>{user.phone || "-"}</TableCell>
                    <TableCell>{getUserTypeBadge(user.user_type)}</TableCell>
                    <TableCell>
                      <Badge variant={user.user_status === 1 ? "default" : "secondary"}>
                        {user.user_status === 1 ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Reset Password"
                          onClick={() => setResetPasswordUser(user)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Deactivate"
                          onClick={() => handleDeactivate(user.user_id)}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          title="Permanently Delete"
                          disabled={currentUser?.user_id === user.user_id}
                          onClick={() => setPermanentDeleteUser(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with appropriate permissions
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.user_name}
                onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.user_username}
                onChange={(e) =>
                  setFormData({ ...formData, user_username: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.user_password}
                onChange={(e) =>
                  setFormData({ ...formData, user_password: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.user_type}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, user_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ShopKeeper">Shop Keeper</SelectItem>
                  <SelectItem value="Contentuser">Content User</SelectItem>
                  <SelectItem value="ShopOwner">Shop Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and permissions</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={formData.user_name}
                onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username *</Label>
              <Input
                id="edit-username"
                value={formData.user_username}
                onChange={(e) =>
                  setFormData({ ...formData, user_username: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role *</Label>
              <Select
                value={formData.user_type}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, user_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ShopKeeper">Shop Keeper</SelectItem>
                  <SelectItem value="Contentuser">Content User</SelectItem>
                  <SelectItem value="ShopOwner">Shop Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Updating..." : "Update User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog - admin sets a new password directly, no OTP/email */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => !open && closeResetPasswordDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetPasswordUser?.user_username}. They will need to use it the next time they sign in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            {resetPasswordError && (
              <p className="text-sm text-red-600 dark:text-red-400">{resetPasswordError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password *</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm New Password *</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeResetPasswordDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetPasswordMutation.isPending}>
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation */}
      <AlertDialog open={!!permanentDeleteUser} onOpenChange={(open) => !open && setPermanentDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {permanentDeleteUser?.user_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This is irreversible and removes the user account entirely - unlike Deactivate, it cannot be undone.
              This will only succeed if the user has no historical activity (bank accounts, expenses, supplier
              transactions, returns, etc.) tied to their account; if they do, deactivate them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              disabled={permanentDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {permanentDeleteMutation.isPending ? "Deleting..." : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
