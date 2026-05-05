import { AlertTriangleIcon, KeyRoundIcon, PenLineIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import useNavigateTo from "@/hooks/useNavigateTo";
import { handleError } from "@/lib/error";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import ChangeMemberPasswordDialog from "../ChangeMemberPasswordDialog";
import UpdateAccountDialog from "../UpdateAccountDialog";
import UserAvatar from "../UserAvatar";
import AccessTokenSection from "./AccessTokenSection";
import SettingGroup from "./SettingGroup";
import SettingSection from "./SettingSection";

const MyAccountSection = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigateTo = useNavigateTo();
  const accountDialog = useDialog();
  const passwordDialog = useDialog();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dangerAreaClickCount, setDangerAreaClickCount] = useState(0);
  const dangerAreaUnlocked = dangerAreaClickCount >= 5;
  const remainingDangerClicks = Math.max(5 - dangerAreaClickCount, 0);

  const handleDangerAreaClick = () => {
    setDangerAreaClickCount((count) => Math.min(count + 1, 5));
  };

  const handleDeleteAccount = async () => {
    if (!user?.name) {
      return;
    }
    try {
      await userServiceClient.deleteUser({ name: user.name });
      await logout();
      toast.success(t("setting.member.delete-success", { username: user.username }));
      navigateTo(ROUTES.AUTH, { replace: true });
    } catch (error) {
      handleError(error, toast.error, { context: "Delete account" });
      throw error;
    }
  };

  return (
    <SettingSection title={t("setting.my-account.label")}>
      <SettingGroup title={t("setting.account.title")}>
        <div className="w-full flex flex-row justify-start items-center gap-3">
          <UserAvatar className="shrink-0 w-12 h-12" avatarUrl={user?.avatarUrl} />
          <div className="flex-1 min-w-0 flex flex-col justify-center items-start gap-1">
            <div className="w-full">
              <span className="text-lg font-semibold">{user?.displayName}</span>
              <span className="ml-2 text-sm text-muted-foreground">@{user?.username}</span>
            </div>
            {user?.description && <p className="w-full text-sm text-muted-foreground truncate">{user?.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={accountDialog.open}>
              <PenLineIcon className="w-4 h-4 mr-1.5" />
              {t("common.edit")}
            </Button>
            <Button variant="outline" size="sm" onClick={passwordDialog.open}>
              <KeyRoundIcon className="w-4 h-4 mr-1.5" />
              {t("setting.account.change-password")}
            </Button>
          </div>
        </div>
      </SettingGroup>

      <AccessTokenSection />

      <SettingGroup showSeparator title="" description="">
        <button
          type="button"
          className="flex w-full flex-col items-start gap-1 rounded-[0.85rem] px-1 py-1 text-left text-muted-foreground transition-colors hover:text-foreground"
          onClick={handleDangerAreaClick}
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <AlertTriangleIcon className="size-4 text-destructive" />
            {t("setting.account.danger-area")}
          </span>
          <span className="text-xs leading-5 text-muted-foreground">
            {dangerAreaUnlocked
              ? "危险操作区已解锁。"
              : `为避免误操作，请连续点击“危险操作区”5 次后显示删除账户操作，还需点击 ${remainingDangerClicks} 次。`}
          </span>
        </button>

        {dangerAreaUnlocked && (
          <div className="flex flex-col gap-3 rounded-[0.85rem] border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                <AlertTriangleIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">{t("setting.account.delete-account")}</p>
                <p className="text-sm text-muted-foreground">{t("setting.account.delete-account-description")}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                {t("setting.account.delete-account")}
              </Button>
            </div>
          </div>
        )}
      </SettingGroup>

      {/* Update Account Dialog */}
      <UpdateAccountDialog open={accountDialog.isOpen} onOpenChange={accountDialog.setOpen} />

      {/* Change Password Dialog */}
      <ChangeMemberPasswordDialog open={passwordDialog.isOpen} onOpenChange={passwordDialog.setOpen} user={user} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={user ? t("setting.member.delete-warning", { username: user.username }) : ""}
        description={t("setting.member.delete-warning-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDeleteAccount}
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

export default MyAccountSection;
