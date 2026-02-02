document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const err = document.getElementById('errorMsg');
    const container = document.querySelector('.login-container');
    const splash = document.getElementById('splashScreen');

    if (u === 'SDMK2026' && p === 'SDMK11234#') {
        err.style.display = 'none';
        container.style.display = 'none'; 
        splash.classList.remove('hidden');
        setTimeout(() => {
            window.top.location.href = 'https://script.google.com/macros/s/AKfycbz-FwJ2ev_P-9BuYtDazV6grZ5ysIMWyrOi_EbLv9s/dev';
        }, 2000);
    } else {
        err.style.display = 'flex';
        container.classList.add('shake');
        
        setTimeout(() => {
            container.classList.remove('shake');
        }, 500);
    }
});