document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const err = document.getElementById('errorMsg');
    const container = document.querySelector('.login-container');
    const splash = document.getElementById('splashScreen');

    // Validasi Sederhana
    if (u === 'SDMK2026' && p === 'SDMK11234#') {
        // SUKSES
        err.style.display = 'none';
        
        // Sembunyikan form login agar transisi lebih rapi
        container.style.display = 'none'; 
        
        // Tampilkan Splash Screen
        splash.classList.remove('hidden');
        
        // Timer Splash Screen sebelum redirect
        setTimeout(() => {
            // PERBAIKAN DI SINI:
            // Gunakan 'window.top.location.href' untuk keluar dari iframe Google
            window.top.location.href = 'https://script.google.com/macros/s/AKfycbz-FwJ2ev_P-9BuYtDazV6grZ5ysIMWyrOi_EbLv9s/dev';
        }, 2000);
    } else {
        // GAGAL
        err.style.display = 'flex';
        container.classList.add('shake');
        
        setTimeout(() => {
            container.classList.remove('shake');
        }, 500);
    }
});