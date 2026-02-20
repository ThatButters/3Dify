const serverInput = document.getElementById('server-url');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const errorMsg = document.getElementById('error-msg');

// Pre-fill server URL
window.trayAPI.getServerUrl().then(url => {
  serverInput.value = url || '';
});

async function doLogin() {
  errorMsg.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  const result = await window.trayAPI.login(
    serverInput.value.trim(),
    usernameInput.value.trim(),
    passwordInput.value,
  );

  if (result.ok) {
    // Window will be closed by main process
  } else {
    errorMsg.textContent = result.error || 'Login failed';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
}

loginBtn.addEventListener('click', doLogin);

// Enter key submits
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});
