// public/js/main.js

// Navbar scroll
window.addEventListener('scroll', () => {
  document.querySelector('.navbar')?.classList.toggle('scrolled', window.scrollY > 50);
});

// Mobile menu
function toggleMenu() {
  document.getElementById('mobileMenu')?.classList.toggle('open');
}

// Scroll reveal
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .stagger').forEach(el => observer.observe(el));

// Date validation
const checkIn  = document.querySelector('input[name="checkIn"]');
const checkOut = document.querySelector('input[name="checkOut"]');
if (checkIn && checkOut) {
  checkIn.min = new Date().toISOString().split('T')[0];
  checkIn.addEventListener('change', () => {
    checkOut.min = checkIn.value;
    if (checkOut.value && checkOut.value <= checkIn.value) checkOut.value = '';
  });
}

// Contact form AJAX
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn    = contactForm.querySelector('button[type="submit"]');
    const result = document.getElementById('contactResult');
    btn.textContent = 'Sending...';
    btn.disabled    = true;
    try {
      const res  = await fetch('/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactForm.name.value,
          email: contactForm.email.value,
          phone: contactForm.phone?.value || '',
          message: contactForm.message.value,
        }),
      });
      const data = await res.json();
      result.className    = data.success ? 'alert-success' : 'alert-error';
      result.textContent  = data.success
        ? '✅ Message send ho gaya! Hum jald hi contact karenge.'
        : '❌ ' + (data.message || 'Kuch gadbad ho gayi.');
      result.style.display = 'block';
      if (data.success) contactForm.reset();
    } catch {
      result.className    = 'alert-error';
      result.textContent  = '❌ Network error. Please dobara try karo.';
      result.style.display = 'block';
    }
    btn.textContent = 'Send Message';
    btn.disabled    = false;
  });
}