import { useEffect, useState } from "react";
import { getRememberedPassword } from "../lib/encryptedPasswordStore";
import {
  getPasswordPromptPending,
  submitPasswordPrompt,
  subscribePasswordPrompt,
} from "../lib/passwordPrompt";

export function PasswordPromptDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  const pending = getPasswordPromptPending();

  useEffect(
    () =>
      subscribePasswordPrompt(() => {
        const next = getPasswordPromptPending();
        setOpen(Boolean(next));
        setPassword("");
        setConfirmPassword("");
        setRemember(false);
        setError("");

        if (next?.options.allowRemember && next.options.documentPath) {
          void getRememberedPassword(next.options.documentPath).then((saved) => {
            if (!getPasswordPromptPending()) return;
            if (saved) {
              setPassword(saved);
              setRemember(true);
            }
          });
        }
      }),
    [],
  );

  if (!open || !pending) return null;

  const { options } = pending;
  const needsConfirm = options.confirm ?? false;
  const allowRemember = options.allowRemember ?? false;

  const handleCancel = () => {
    submitPasswordPrompt(null);
  };

  const handleSubmit = () => {
    const trimmed = password.trim();
    if (!trimmed) {
      setError("请输入密码");
      return;
    }
    if (needsConfirm && trimmed !== confirmPassword.trim()) {
      setError("两次输入的密码不一致");
      return;
    }
    submitPasswordPrompt(trimmed, allowRemember && remember);
  };

  return (
    <div className="password-prompt-overlay" role="presentation" onClick={handleCancel}>
      <div
        className="password-prompt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-prompt-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="password-prompt-title">{options.title}</h2>
        {options.description ? <p className="password-prompt-desc">{options.description}</p> : null}

        <label className="password-prompt-field">
          <span>密码</span>
          <input
            type="password"
            value={password}
            autoFocus
            autoComplete="off"
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSubmit();
              if (event.key === "Escape") handleCancel();
            }}
          />
        </label>

        {needsConfirm ? (
          <label className="password-prompt-field">
            <span>确认密码</span>
            <input
              type="password"
              value={confirmPassword}
              autoComplete="off"
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSubmit();
                if (event.key === "Escape") handleCancel();
              }}
            />
          </label>
        ) : null}

        {allowRemember ? (
          <label className="password-prompt-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>记住密码</span>
            <span className="password-prompt-remember-hint">仅保存在本机，下次打开同一文档时自动解密</span>
          </label>
        ) : null}

        {error ? <p className="password-prompt-error">{error}</p> : null}

        <div className="password-prompt-actions">
          <button type="button" className="secondary" onClick={handleCancel}>
            取消
          </button>
          <button type="button" className="primary" onClick={handleSubmit}>
            {options.submitLabel ?? "确定"}
          </button>
        </div>
      </div>
    </div>
  );
}
