// URL của backend
const BASE_URL = 'http://127.0.0.1:5000';

// Hàm login
async function login(username, password) {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }), 
      credentials: 'include', // Để gửi cookie
    });

    if (response.ok) {
      console.log('Login successful');
      window.location.href = '/index'; 
    } else {
      const errorData = await response.json();
      alert(errorData.error || 'Login failed');
    }
  } catch (error) {
    console.error('Error logging in:', error);
  }
}
// Hàm làm mới token
async function refreshToken() {
  try {
    const response = await fetch(`${BASE_URL}/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      console.log('Token refreshed successfully');
    } else {
      console.error('Refresh token failed');
      window.location.href = '/login'; 
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    window.location.href = '/login';
  }
}

// Gọi hàm getData khi trang được tải
// document.addEventListener('DOMContentLoaded', getData);