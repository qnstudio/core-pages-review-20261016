(() => {
  const requestBase = 'https://core-review-feedback.qnstudio11.chatgpt.site/codex';
  document.querySelectorAll('.feedback[data-page]').forEach(panel => {
    const page = panel.dataset.page;
    const state = panel.querySelector('select[name="state"]');
    if (!page || !state || panel.querySelector('.codex-request-link')) return;
    const link = document.createElement('a');
    link.className = 'codex-request-link';
    link.textContent = 'Codex에 수정 요청';
    link.title = 'ChatGPT 로그인 후 소유자만 수정 작업을 요청할 수 있습니다.';
    const update = () => {
      const url = new URL(requestBase);
      url.searchParams.set('page', page);
      url.searchParams.set('state', state.value || 'page');
      link.href = url.href;
    };
    state.addEventListener('change', update);
    link.addEventListener('click', update);
    update();
    panel.append(link);
  });
})();
