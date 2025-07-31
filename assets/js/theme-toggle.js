// Theme toggle logic for login/register pages
function setThemeFromStorage() {
  const savedTheme = localStorage.getItem('bitHabTheme');
  if (savedTheme) {
    document.body.className = savedTheme;
  }
  document.getElementById('theme-toggle').innerHTML = document.body.classList.contains('dark') ? '☀️' : '🌙';
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  document.getElementById('theme-toggle').innerHTML = document.body.classList.contains('dark') ? '☀️' : '🌙';
  localStorage.setItem('bitHabTheme', document.body.className);
}

document.addEventListener('DOMContentLoaded', function() {
  setThemeFromStorage();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
});
