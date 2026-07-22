"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { createUser, deleteUser, updateUserPassword, updateUserRole, type UserActionState } from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ROLE_LABELS,
  ROLES,
  type Role,
} from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/date";

export type UserRow = {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  users: UserRow[];
  currentUserId: string;
};

export function UsersAdmin({ users, currentUserId }: Props) {
  const doctorCount = useMemo(
    () => users.filter((user) => user.role === "DOCTOR").length,
    [users]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <CreateUserCard />
      <UsersTable
        users={users}
        currentUserId={currentUserId}
        doctorCount={doctorCount}
      />
    </div>
  );
}

function CreateUserCard() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    UserActionState,
    FormData
  >(createUser, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("User created");
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Create user
        </CardTitle>
        <CardDescription>
          Add a receptionist or doctor account. The password is hashed before
          storage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              placeholder="ex. reception2"
              autoComplete="off"
              required
            />
            {state?.fieldErrors?.username?.[0] ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.username[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Initial password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
            {state?.fieldErrors?.password?.[0] ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.password[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select name="role" defaultValue="RECEPTIONIST">
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Create account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UsersTable({
  users,
  currentUserId,
  doctorCount,
}: Props & { doctorCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [password, setPassword] = useState("");

  function canRemoveAdminAccess(user: UserRow) {
    if (user.id === currentUserId) return false;
    if (user.role !== "DOCTOR") return true;
    return doctorCount > 1;
  }

  function handleRoleChange(user: UserRow, role: Role) {
    startTransition(async () => {
      const result = await updateUserRole(user.id, role);
      if (result?.ok) {
        toast.success("Role updated");
        router.refresh();
      } else {
        toast.error(result?.error ?? "Update failed");
      }
    });
  }

  function handlePasswordUpdate() {
    if (!passwordTarget) return;
    startTransition(async () => {
      const result = await updateUserPassword(passwordTarget.id, password);
      if (result?.ok) {
        toast.success("Password updated");
        setPassword("");
        setPasswordTarget(null);
        router.refresh();
      } else {
        toast.error(result?.error ?? "Invalid password");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteUser(deleteTarget.id);
      if (result?.ok) {
        toast.success("User deleted");
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(result?.error ?? "Delete failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-primary" />
          Users
        </CardTitle>
        <CardDescription>
          {users.length} account(s). Keep at least one active doctor account to
          avoid administrative lockout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <tr
                    key={user.id}
                    className="border-t border-border hover:bg-muted/30"
                  >
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{user.username}</span>
                          {isSelf ? <Badge variant="success">You</Badge> : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Updated {formatRelative(user.updatedAt)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.role}
                          onValueChange={(role) =>
                            handleRoleChange(user, role as Role)
                          }
                          disabled={isPending || !canRemoveAdminAccess(user)}
                        >
                          <SelectTrigger className="w-[170px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {user.role === "DOCTOR" ? (
                          <ShieldCheck className="h-4 w-4 text-success" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs text-muted-foreground">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPasswordTarget(user)}
                          disabled={isPending}
                        >
                          <KeyRound className="h-4 w-4" />
                          Password
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(user)}
                          disabled={isPending || isSelf || !canRemoveAdminAccess(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog
        open={!!passwordTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null);
            setPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {passwordTarget
                ? `Set a new password for ${passwordTarget.username}.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPasswordTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordUpdate}
              disabled={isPending || password.length < 8}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this user?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `The account ${deleteTarget.username} will no longer be able to sign in. This action is permanent.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
