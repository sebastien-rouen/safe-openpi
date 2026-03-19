// ============================================================
// EXPORT - Export PNG de la vue courante (pleine page)
// ============================================================

function exportPNG() {
  const view   = typeof currentView !== 'undefined' ? currentView : 'dashboard';
  const target = document.querySelector('.view.active') || document.getElementById('content');
  if (!target) return showToast("⚠️ Aucune vue active", 'error');

  showToast('📸 Capture en cours...', 'success');

  // Temporairement : forcer la vue à sa pleine hauteur (pas juste le viewport)
  const content   = document.getElementById('content');
  const origOvf   = content.style.overflow;
  const origH     = content.style.height;
  content.style.overflow = 'visible';
  content.style.height   = 'auto';

  html2canvas(target, {
    scale: 2,
    useCORS: true,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F1F5F9',
    scrollY: -window.scrollY,
    windowHeight: target.scrollHeight,
  })
  .then(canvas => {
    content.style.overflow = origOvf;
    content.style.height   = origH;
    const a = document.createElement('a');
    a.download = `${view}-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    showToast('✅ Export PNG téléchargé !', 'success');
  })
  .catch(err => {
    content.style.overflow = origOvf;
    content.style.height   = origH;
    console.error('[export]', err);
    showToast("⚠️ Erreur lors de l'export", 'error');
  });
}
