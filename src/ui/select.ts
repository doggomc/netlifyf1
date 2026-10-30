let customSelectSequence = 0;

function enhanceSelect(select: HTMLSelectElement) {
  if (!select || select.dataset.customEnhanced === 'true') return;
  select.dataset.customEnhanced = 'true';
  const shell = document.createElement('div');
  shell.className = 'select-shell';
  select.parentNode.insertBefore(shell, select);
  shell.appendChild(select);

  const menuId = `custom-select-menu-${++customSelectSequence}`;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', menuId);

  const label = select.closest('.sel')?.querySelector(`label[for="${select.id}"]`);
  if (label) {
    if (!label.id) label.id = `${select.id}-label`;
    trigger.setAttribute('aria-labelledby', label.id);
  }
  trigger.innerHTML = '<span class="select-value"></span><span class="select-chevron" aria-hidden="true"></span>';

  const menu = document.createElement('div');
  menu.className = 'select-menu';
  menu.id = menuId;
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  shell.insertBefore(trigger, select);
  shell.appendChild(menu);

  select.classList.add('native-select-source');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  let optionButtons: HTMLButtonElement[] = [];

  const getAvailableIndex = (start, direction) => {
    let index = start;
    while (index >= 0 && index < optionButtons.length) {
      const option = optionButtons[index];
      if (!option.disabled && !option.hidden) return index;
      index += direction;
    }
    return -1;
  };

  const close = (focusTrigger) => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    shell.classList.remove('is-open');
    shell.closest('.sel')?.classList.remove('is-open');
    shell.closest('.deck-box')?.classList.remove('has-open-menu');
    shell.closest('.deck')?.classList.remove('has-open-menu');
    if (focusTrigger) trigger.focus();
  };

  const sync = () => {
    const selected = select.options[select.selectedIndex];
    const value = trigger.querySelector<HTMLElement>('.select-value');
    if (value) value.textContent = selected?.textContent || 'Select an option';
    trigger.disabled = select.disabled || !select.options.length;
    menu.replaceChildren();
    optionButtons = [];
    [...select.options].forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'select-option';
      button.textContent = option.textContent;
      button.dataset.value = option.value;
      button.dataset.index = String(index);
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === select.selectedIndex));
      button.disabled = Boolean(option.disabled);
      button.hidden = Boolean(option.hidden);
      if (option.disabled) button.classList.add('is-disabled');
      button.addEventListener('click', () => {
        if (option.disabled || option.hidden) return;
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
        close(false);
        trigger.focus();
      });
      menu.appendChild(button);
      optionButtons.push(button);
    });
  };

  const open = (direction) => {
    if (trigger.disabled) return;
    sync();
    menu.hidden = false;
    menu.classList.remove('above');
    const menuRect = menu.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    if (menuRect.bottom > innerHeight - 12 && shellRect.top > menuRect.height + 12) {
      menu.classList.add('above');
    }
    trigger.setAttribute('aria-expanded', 'true');
    shell.classList.add('is-open');
    shell.closest('.sel')?.classList.add('is-open');
    shell.closest('.deck-box')?.classList.add('has-open-menu');
    shell.closest('.deck')?.classList.add('has-open-menu');
    const selectedIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0;
    const step = direction || 0;
    const target = step ? getAvailableIndex(selectedIndex + step, step) : getAvailableIndex(selectedIndex, 1);
    (optionButtons[target >= 0 ? target : selectedIndex] || optionButtons[0])?.focus();
  };

  trigger.addEventListener('click', () => {
    if (menu.hidden) open(0);
    else close(false);
  });

  trigger.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (menu.hidden) open(event.key === 'ArrowUp' ? -1 : 1);
      else close(false);
    }
  });

  menu.addEventListener('keydown', (event) => {
    const current = optionButtons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      close(true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (document.activeElement as HTMLElement)?.click();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = getAvailableIndex(current + (event.key === 'ArrowDown' ? 1 : -1), event.key === 'ArrowDown' ? 1 : -1);
      if (next >= 0) optionButtons[next].focus();
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = getAvailableIndex(event.key === 'Home' ? 0 : optionButtons.length - 1, event.key === 'Home' ? 1 : -1);
      if (next >= 0) optionButtons[next].focus();
    }
  });

  select.addEventListener('change', sync);
  new MutationObserver(sync).observe(select, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'hidden', 'selected']
  });
  select._syncCustom = sync;
  sync();
}

export function setupCustomSelects() {
  document.querySelectorAll<HTMLSelectElement>('.sel > select').forEach(enhanceSelect);
  document.addEventListener('click', (event) => {
    document.querySelectorAll<HTMLElement>('.select-shell').forEach((shell) => {
      if (!shell.contains(event.target as Node)) {
        const trigger = shell.querySelector<HTMLElement>('.select-trigger');
        const menu = shell.querySelector<HTMLElement>('.select-menu');
        if (trigger && menu && !menu.hidden) {
          menu.hidden = true;
          trigger.setAttribute('aria-expanded', 'false');
          shell.classList.remove('is-open');
          shell.closest('.sel')?.classList.remove('is-open');
          shell.closest('.deck-box')?.classList.remove('has-open-menu');
          shell.closest('.deck')?.classList.remove('has-open-menu');
        }
      }
    });
  });
}

