// Dark mode toggle functionality
(function() {
  // Check for saved dark mode preference or default to dark
  const savedTheme = localStorage.getItem('theme');
  const initialTheme = savedTheme || 'dark';
  
  // Set initial theme
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  
  // Create and append dark mode toggle button
  const toggleButton = document.createElement('button');
  toggleButton.className = 'dark-toggle';
  toggleButton.setAttribute('aria-label', 'Toggle dark mode');
  toggleButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="sun-icon">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-6.364-.386l1.591-1.591M3 12h2.25m.386-6.364l1.591 1.591M12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="moon-icon hidden">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  `;
  
  document.body.appendChild(toggleButton);
  
  // Update icon visibility based on current theme
  function updateIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    toggleButton.querySelector('.sun-icon').classList.toggle('hidden', isDark);
    toggleButton.querySelector('.moon-icon').classList.toggle('hidden', !isDark);
  }
  
  // Initial icon update
  updateIcons();
  
  // Toggle function
  function toggleDarkMode() {
    const isDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', !isDark);
    localStorage.setItem('theme', !isDark ? 'dark' : 'light');
    updateIcons();
  }
  
  // Add click event listener
  toggleButton.addEventListener('click', toggleDarkMode);
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    if (!localStorage.getItem('theme')) {
      document.documentElement.classList.toggle('dark', e.matches);
      updateIcons();
    }
  });
})();