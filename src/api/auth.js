import request from './request'

/**
 * 用户注册
 * @param {{ username: string, password: string }} data
 * @returns {Promise<{ code: number, data: { id: string, username: string, createdAt: string } }>}
 */
export function register(data) {
  return request.post('/auth/register', data)
}

/**
 * 用户登录
 * @param {{ username: string, password: string }} data
 * @returns {Promise<{ code: number, data: { token: string, tokenType: string, expiresIn: number, user: { id: string, username: string, createdAt: string } } }>}
 */
export function login(data) {
  return request.post('/auth/login', data)
}

/**
 * 检查认证状态
 * @returns {Promise<{ code: number, data: string }>}
 */
export function getStatus() {
  return request.get('/auth/status')
}

/**
 * 获取当前用户信息
 * @returns {Promise<{ code: number, data: { id: string, username: string, createdAt: string } }>}
 */
export function getMe() {
  return request.get('/auth/me')
}
