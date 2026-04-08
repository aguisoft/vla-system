import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // sends the vla_token httpOnly cookie automatically
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Only redirect to /login on 401 if it's NOT the login request itself
    // and we're not already on the login page — otherwise error messages get wiped.
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    const isOnLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';
    if (error.response?.status === 401 && !isLoginRequest && !isOnLoginPage) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
