export const USERNAME_RULE = /^[A-Za-z][A-Za-z0-9]{7,63}$/;

export function validateUsername(username: string): string | null {
  const v = (username || '').trim();
  if (!v) return '用户名不能为空';
  if (!USERNAME_RULE.test(v)) {
    return '用户名需字母开头，仅字母数字，且不少于8位';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return '密码至少8位';
  return null;
}
