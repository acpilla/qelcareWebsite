const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX = /^\d{6}$/;

function clean(value) {
  return String(value || "").trim();
}

function validatePasswordStrength(password, label = "Password") {
  const errors = [];
  const value = String(password || "");

  if (!value) {
    errors.push(`${label} is required`);
    return errors;
  }
  if (value.length < 8) errors.push(`${label} must be at least 8 characters`);
  if (value.length > 128) errors.push(`${label} must be 128 characters or less`);
  if (!/[a-z]/.test(value)) errors.push(`${label} must contain a lowercase letter`);
  if (!/[A-Z]/.test(value)) errors.push(`${label} must contain an uppercase letter`);
  if (!/\d/.test(value)) errors.push(`${label} must contain a number`);
  if (!/[@$!%*?&#]/.test(value)) errors.push(`${label} must contain a special character`);

  return errors;
}

const validateLoginInput = (username, password) => {
  const errors = [];
  const cleanUsername = clean(username);

  if (!cleanUsername) errors.push("Username is required");
  if (cleanUsername.length > 50) errors.push("Username must be 50 characters or less");
  if (!password || String(password).trim() === "") errors.push("Password is required");
  if (password && String(password).length > 128) errors.push("Password must be 128 characters or less");

  return errors;
};

const validateEmail = (email) => {
  const errors = [];
  const value = clean(email);

  if (!value) {
    errors.push("Email is required");
    return errors;
  }
  if (value.length > 100) errors.push("Email must be 100 characters or less");
  if (!EMAIL_REGEX.test(value)) errors.push("Invalid email format");

  return errors;
};

const validatePasswordChange = (currentPassword, newPassword) => {
  const errors = [];

  if (!currentPassword) errors.push("Current password is required");
  if (currentPassword && String(currentPassword).length > 128) errors.push("Current password must be 128 characters or less");
  errors.push(...validatePasswordStrength(newPassword, "New password"));

  return errors;
};

const validateOTPCode = (code) => {
  const errors = [];
  const value = clean(code);

  if (!value) {
    errors.push("Verification code is required");
    return errors;
  }
  if (!OTP_REGEX.test(value)) errors.push("Verification code must be 6 digits");

  return errors;
};

const validateResetPassword = (email, newPassword, code) => {
  const errors = [];
  errors.push(...validateEmail(email));
  errors.push(...validatePasswordStrength(newPassword, "Password"));
  errors.push(...validateOTPCode(code));
  return errors;
};

module.exports = {
  validateLoginInput,
  validateEmail,
  validatePasswordChange,
  validateResetPassword,
  validateOTPCode,
  validatePasswordStrength,
};
