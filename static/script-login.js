document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const err = document.getElementById('errorMsg');
    const container = document.querySelector('.login-container');
    const splash = document.getElementById('splashScreen');

    // Validasi Sederhana (Sesuai Permintaan)
    if (u === 'SDMK2026' && p === 'SDMK11234#') {
        // SUKSES
        err.style.display = 'none';
        splash.classList.remove('hidden');
        
        // Timer Splash Screen sebelum redirect
        setTimeout(() => {
            window.location.href = '/kuota';
        }, 2000);
    } else {
        // GAGAL
        err.style.display = 'flex';
        container.classList.add('shake');
        
        // Hapus animasi shake biar bisa di-trigger lagi
        setTimeout(() => {
            container.classList.remove('shake');
        }, 500);
    }
});