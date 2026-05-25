const pool = require("../../../config/database");
const bcrypt = require("bcrypt");
const tokenManager = require("../../../shared/utils/tokenManager");
const authService = require("../services/authService");
const logger = require("../../../shared/utils/activityLogger");
const {
  validateLoginInput,
  validateEmail,
  validatePasswordChange,
  validateResetPassword,
  validateOTPCode,
} = require("../validators/authValidator");

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const errors = validateLoginInput(username, password);
    if (errors.length > 0) return res.status(400).json({ success: false, errors });

    const result = await pool.query(
      `SELECT u.user_id, u.username, u.password, u.email,
              u.first_name, u.last_name, u.profile_picture,
              u.status, u.lockout_until, u.failed_login_attempts,
              r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.username = $1`,
      [username.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Account does not exist" });
    }

    const user = result.rows[0];
    const now = new Date();

    if (user.status === "deactivated") {
      return res.status(403).json({ success: false, message: "Account has been deactivated" });
    }

    if (user.status === "unverified") {
      return res.status(403).json({ success: false, message: "Account is not yet verified" });
    }

    if (user.status === "locked" && user.lockout_until) {
      if (now < new Date(user.lockout_until)) {
        const diffMs = new Date(user.lockout_until) - now;
        const minutes = Math.floor(diffMs / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        return res.status(403).json({
          success: false,
          message: `Account locked. Try again in ${minutes}m ${seconds}s`,
          lockout_until: user.lockout_until,
        });
      }

      await pool.query(
        `UPDATE users
         SET status = 'verified',
             lockout_until = NULL,
             failed_login_attempts = 0
         WHERE user_id = $1`,
        [user.user_id]
      );
      user.status = "verified";
    }

    if (user.status === "locked" && !user.lockout_until) {
      return res.status(403).json({
        success: false,
        message: "Account is permanently locked. Please contact an administrator.",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      const attempts = user.failed_login_attempts + 1;
      let lockMinutes = 0;

      if (attempts >= 8) lockMinutes = null;
      else if (attempts === 5) lockMinutes = 15;
      else if (attempts === 3) lockMinutes = 5;

      if (attempts >= 8) {
        await pool.query(
          `UPDATE users
           SET failed_login_attempts = $1,
               status = 'locked',
               lockout_until = NULL
           WHERE user_id = $2`,
          [attempts, user.user_id]
        );
        await logger.log({
          userId: user.user_id,
          action: "ACCOUNT_LOCKED",
          entityType: "user",
          entityId: user.user_id,
          description: `Account ${user.username} was permanently locked after repeated failed login attempts.`,
          ip: logger.getIP(req),
          metadata: { attempts },
        });
        return res.status(403).json({
          success: false,
          message: "Account permanently locked. Contact an administrator.",
        });
      }

      if (lockMinutes > 0) {
        const lockUntil = new Date(Date.now() + lockMinutes * 60000);
        await pool.query(
          `UPDATE users
           SET failed_login_attempts = $1,
               status = 'locked',
               lockout_until = $2
           WHERE user_id = $3`,
          [attempts, lockUntil, user.user_id]
        );
        await logger.log({
          userId: user.user_id,
          action: "ACCOUNT_TEMP_LOCKED",
          entityType: "user",
          entityId: user.user_id,
          description: `Account ${user.username} was temporarily locked for ${lockMinutes} minutes.`,
          ip: logger.getIP(req),
          metadata: { attempts, lock_minutes: lockMinutes, lockout_until: lockUntil },
        });
        return res.status(403).json({
          success: false,
          message: `Account locked for ${lockMinutes} minutes`,
          lockout_until: lockUntil,
          attempts,
        });
      }

      await pool.query(
        `UPDATE users SET failed_login_attempts = $1 WHERE user_id = $2`,
        [attempts, user.user_id]
      );

      const attemptsLeft = attempts < 5 ? 5 - attempts : null;
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        ...(attemptsLeft !== null && { attempts_left: attemptsLeft }),
      });
    }

    await pool.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           status = 'verified',
           lockout_until = NULL,
           last_login = NOW()
       WHERE user_id = $1`,
      [user.user_id]
    );

    const token = await tokenManager.createToken({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role_name,
    });

    await logger.log({
      userId: user.user_id,
      action: "LOGIN",
      entityType: "auth",
      entityId: user.user_id,
      description: `${user.username} logged in.`,
      ip: logger.getIP(req),
      metadata: { role: user.role_name },
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role_name,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture: user.profile_picture || null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(400).json({ success: false, message: "No token provided" });

    await tokenManager.revokeToken(token);
    await logger.log({
      userId: req.user?.user_id || null,
      action: "LOGOUT",
      entityType: "auth",
      entityId: req.user?.user_id || null,
      description: `${req.user?.username || "User"} logged out.`,
      ip: logger.getIP(req),
    });

    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ success: false, message: "Logout failed" });
  }
};

const logoutAll = async (req, res) => {
  try {
    await tokenManager.revokeAllUserTokens(req.user.user_id);
    await logger.log({
      userId: req.user.user_id,
      action: "LOGOUT_ALL",
      entityType: "auth",
      entityId: req.user.user_id,
      description: `${req.user.username || "User"} logged out from all devices.`,
      ip: logger.getIP(req),
    });
    res.status(200).json({ success: true, message: "Logged out from all devices" });
  } catch (error) {
    console.error("Logout all error:", error);
    res.status(500).json({ success: false, message: "Logout all failed" });
  }
};

const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const errors = validateEmail(email);
    if (errors.length > 0) return res.status(400).json({ success: false, errors });

    const userCheck = await pool.query(
      "SELECT user_id, status FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (userCheck.rows.length === 0) {
      return res.status(200).json({ success: false, message: "Email not found" });
    }

    const user = userCheck.rows[0];
    if (user.status === "deactivated") {
      return res.status(403).json({ success: false, message: "Account is deactivated" });
    }

    const result = await authService.sendOTP(email);
    res.status(result.success ? 200 : 429).json(result);
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, code } = req.body;
    const emailErrors = validateEmail(email);
    if (emailErrors.length > 0) return res.status(400).json({ success: false, errors: emailErrors });

    const codeErrors = validateOTPCode(code);
    if (codeErrors.length > 0) return res.status(400).json({ success: false, errors: codeErrors });

    const result = await authService.verifyOTP(email, code);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ success: false, message: "OTP verification failed" });
  }
};

const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const errors = validateEmail(email);
    if (errors.length > 0) return res.status(400).json({ success: false, errors });

    const result = await authService.resendOTP(email);
    res.status(result.success ? 200 : 429).json(result);
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ success: false, message: "Failed to resend OTP" });
  }
};

const resetPassword = async (req, res) => {
  const client = await pool.connect();
  try {
    let { email, newPassword } = req.body;
    newPassword = newPassword?.trim();

    const errors = validateResetPassword(email, newPassword);
    if (errors.length > 0) return res.status(400).json({ success: false, errors });

    await client.query("BEGIN");

    const userResult = await client.query(
      "SELECT user_id, username, password, status FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = userResult.rows[0];

    if (user.status === "deactivated") {
      await client.query("ROLLBACK");
      return res.status(403).json({ success: false, message: "Account is deactivated" });
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "New password cannot be the same as the old password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await client.query(
      `UPDATE users
       SET password = $1,
           failed_login_attempts = 0,
           status = CASE WHEN status = 'locked' THEN 'verified' ELSE status END,
           lockout_until = NULL,
           password_changed_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $2`,
      [hashedPassword, user.user_id]
    );

    await client.query("DELETE FROM otp_requests WHERE LOWER(email) = LOWER($1)", [email]);
    await client.query("COMMIT");

    await logger.log({
      userId: user.user_id,
      action: "PASSWORD_RESET",
      entityType: "auth",
      entityId: user.user_id,
      description: `${user.username || email} reset their password.`,
      ip: logger.getIP(req),
    });

    res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Password reset failed" });
  } finally {
    client.release();
  }
};

const changePassword = async (req, res) => {
  const client = await pool.connect();
  try {
    let { currentPassword, newPassword } = req.body;
    currentPassword = currentPassword?.trim();
    newPassword = newPassword?.trim();

    const errors = validatePasswordChange(currentPassword, newPassword);
    if (errors.length > 0) return res.status(400).json({ success: false, errors });

    await client.query("BEGIN");

    const result = await client.query(
      "SELECT user_id, username, password FROM users WHERE user_id = $1",
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      await client.query("ROLLBACK");
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "New password cannot be the same as the current password" });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await client.query(
      `UPDATE users
       SET password = $1,
           password_changed_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $2`,
      [hashed, req.user.user_id]
    );

    await tokenManager.revokeAllUserTokens(req.user.user_id);
    await client.query("COMMIT");

    await logger.log({
      userId: req.user.user_id,
      action: "PASSWORD_CHANGED",
      entityType: "auth",
      entityId: req.user.user_id,
      description: `${user.username || req.user.username || "User"} changed their password.`,
      ip: logger.getIP(req),
    });

    res.status(200).json({ success: true, message: "Password changed. Please login again." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Password change failed" });
  } finally {
    client.release();
  }
};

const validateToken = async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

module.exports = {
  login,
  logout,
  logoutAll,
  sendOTP,
  verifyOTP,
  resendOTP,
  resetPassword,
  changePassword,
  validateToken,
};
