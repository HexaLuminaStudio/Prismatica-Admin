/**
 * 修改密码弹窗(2026-08-06 新增)
 *
 * 调用既有接口 POST /v1/admin/auth/change-password:
 *  - 校验:旧密码非空、新密码 ≥ 8 位、两次输入一致
 *  - 成功:展示成功提示,并提示重新登录(后端审计记录 admin.change_password)
 *  - 失败:展示后端错误文案(旧密码错误 → ADMIN_INVALID_CREDENTIALS)
 */

import * as React from "react";
import { X, Loader2, AlertTriangle, Check } from "lucide-react";
import { changePassword } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onClose: () => void;
}

export function ChangePasswordDialog({ onClose }: Props): React.ReactElement {
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!oldPassword) {
      setErr("请输入当前密码");
      return;
    }
    if (newPassword.length < 8) {
      setErr("新密码长度必须 ≥ 8 位");
      return;
    }
    if (newPassword !== confirm) {
      setErr("两次输入的新密码不一致");
      return;
    }
    if (newPassword === oldPassword) {
      setErr("新密码不能与当前密码相同");
      return;
    }
    setBusy(true);
    try {
      await changePassword(oldPassword, newPassword);
      setSuccess("密码修改成功,请使用新密码重新登录");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "修改失败,请稍后再试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">修改密码</div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {success ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              <Check className="mt-0.5 h-4 w-4 flex-none" />
              <div>
                <div className="font-medium">修改成功</div>
                <div className="text-emerald-700/90 dark:text-emerald-300/90">
                  {success}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={onClose}>关闭</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="old-password">当前密码</Label>
              <Input
                id="old-password"
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={busy}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="≥ 8 位"
                disabled={busy}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
              />
            </div>

            {err && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <div>{err}</div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                取消
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                确认修改
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
