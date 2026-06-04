(function () {
  function initFloatingLabels(root) {
    var scope = root || document;
    scope.querySelectorAll('.cm-field, .auth-field').forEach(function (field) {
      var input = field.querySelector('input, textarea');
      if (!input || input.type === 'checkbox' || input.type === 'file') return;

      function sync() {
        field.classList.toggle('has-value', String(input.value || '').trim().length > 0);
      }

      input.addEventListener('focus', function () {
        field.classList.add('is-active');
      });
      input.addEventListener('blur', function () {
        field.classList.remove('is-active');
        sync();
      });
      input.addEventListener('input', sync);
      sync();
    });
  }

  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.cm-reveal').forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.cm-reveal').forEach(function (el) {
      observer.observe(el);
    });
  }

  function setFileInput(input, file) {
    if (!input || !file) return false;
    try {
      var dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      return true;
    } catch (err) {
      return false;
    }
  }

  function initNoticeDropzone() {
    var dropzone = document.getElementById('notice-dropzone');
    var input = document.getElementById('notice-image');
    var preview = document.getElementById('notice-preview');
    if (!dropzone || !input) return;

    var dragDepth = 0;

    function showPreview(file) {
      if (!file || !file.type || !file.type.startsWith('image/')) {
        if (typeof Noty !== 'undefined') {
          new Noty({
            theme: 'relax',
            text: 'Please choose a PNG or JPG image.',
            type: 'error',
            layout: 'topRight',
            timeout: 2000,
          }).show();
        }
        return;
      }
      if (!preview) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        preview.innerHTML = '<img src="' + e.target.result + '" alt="Preview">';
        dropzone.classList.add('has-preview');
      };
      reader.readAsDataURL(file);
    }

    function applyFile(file) {
      if (!setFileInput(input, file)) return;
      showPreview(file);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    input.addEventListener('change', function () {
      if (input.files && input.files[0]) showPreview(input.files[0]);
    });

    dropzone.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      input.click();
    });

    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });

    dropzone.setAttribute('tabindex', '0');
    dropzone.setAttribute('role', 'button');
    dropzone.setAttribute('aria-label', 'Upload notice image');

    function onDragEnter(e) {
      e.preventDefault();
      e.stopPropagation();
      dragDepth += 1;
      dropzone.classList.add('is-dragover');
    }

    function onDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    }

    function onDragLeave(e) {
      e.preventDefault();
      e.stopPropagation();
      dragDepth -= 1;
      if (dragDepth <= 0) {
        dragDepth = 0;
        dropzone.classList.remove('is-dragover');
      }
    }

    function onDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      dragDepth = 0;
      dropzone.classList.remove('is-dragover');

      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;

      var file = null;
      for (var i = 0; i < files.length; i++) {
        if (files[i].type && files[i].type.startsWith('image/')) {
          file = files[i];
          break;
        }
      }
      if (!file) file = files[0];
      applyFile(file);
    }

    dropzone.addEventListener('dragenter', onDragEnter);
    dropzone.addEventListener('dragover', onDragOver);
    dropzone.addEventListener('dragleave', onDragLeave);
    dropzone.addEventListener('drop', onDrop);
  }

  function resetNoticeDropzone() {
    var dropzone = document.getElementById('notice-dropzone');
    var input = document.getElementById('notice-image');
    var preview = document.getElementById('notice-preview');
    if (input) input.value = '';
    if (preview) preview.innerHTML = '';
    if (dropzone) dropzone.classList.remove('has-preview');
  }

  window.__resetNoticeDropzone = resetNoticeDropzone;

  function validateNoticeForm(form) {
    var valid = true;
    var title = form.querySelector('#notice-title');
    var category = form.querySelector('#notice-category');
    var description = form.querySelector('#notice-description');

    form.querySelectorAll('.cm-field').forEach(function (f) {
      f.classList.remove('is-error');
    });

    if (!title || title.value.trim().length < 2) {
      title && title.closest('.cm-field').classList.add('is-error');
      valid = false;
    }
    if (!category || category.value.trim().length < 2) {
      category && category.closest('.cm-field').classList.add('is-error');
      valid = false;
    }
    if (!description || description.value.trim().length < 10) {
      description && description.closest('.cm-field').classList.add('is-error');
      valid = false;
    }
    return valid;
  }

  window.__validateNoticeForm = validateNoticeForm;

  function initPageBackButton() {
    var backBtn = document.getElementById('cm-go-back');
    if (!backBtn) return;
    backBtn.addEventListener('click', function () {
      var fallback = backBtn.getAttribute('data-fallback') || '/work';
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = fallback;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initFloatingLabels();
    initScrollReveal();
    initNoticeDropzone();
    initPageBackButton();
  });
})();
