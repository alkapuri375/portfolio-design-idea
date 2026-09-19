(() => {
  'use strict';

  const FRAME_COUNT = 240;
  const FRAME_PATH = (index) => `frames_24fps/frame_${String(index).padStart(6, '0')}.png`;

  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loader = document.getElementById('loader');
  const loaderPercent = document.getElementById('loader-percent');
  const scrollIndicator = document.getElementById('scroll-indicator');

  const images = new Array(FRAME_COUNT);
  const loadedFlags = new Uint8Array(FRAME_COUNT);

  let loadedCount = 0;
  let targetFraction = 0;
  let currentFraction = 0;
  let lastRenderedIndex = -1;
  let needsRedraw = true;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let loaderHidden = false;

  function hideLoader() {
    if (loaderHidden) return;
    loaderHidden = true;
    loader.classList.add('loaded');
  }

  // Auto-dismiss loader after 1 second max so user is never blocked
  setTimeout(hideLoader, 1000);

  // Resize canvas to match display size and device pixel ratio
  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    const targetWidth = Math.floor(displayWidth * dpr);
    const targetHeight = Math.floor(displayHeight * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      needsRedraw = true;
    }
  }

  // Draw the specified frame with object-fit: cover
  function renderFrame(index) {
    if (!ctx) return;

    let targetImg = images[index];

    // If target frame is not yet loaded, find nearest loaded neighbor
    if (!loadedFlags[index]) {
      let found = -1;
      for (let offset = 1; offset < FRAME_COUNT; offset++) {
        if (index - offset >= 0 && loadedFlags[index - offset]) {
          found = index - offset;
          break;
        }
        if (index + offset < FRAME_COUNT && loadedFlags[index + offset]) {
          found = index + offset;
          break;
        }
      }
      if (found !== -1) {
        targetImg = images[found];
      }
    }

    if (!targetImg || !targetImg.complete || targetImg.naturalWidth === 0) {
      return;
    }

    const cWidth = canvas.width;
    const cHeight = canvas.height;
    const imgWidth = targetImg.naturalWidth;
    const imgHeight = targetImg.naturalHeight;

    // Cover calculation: fill canvas crisply without distortion
    const scale = Math.max(cWidth / imgWidth, cHeight / imgHeight);
    const renderWidth = imgWidth * scale;
    const renderHeight = imgHeight * scale;
    const offsetX = (cWidth - renderWidth) * 0.5;
    const offsetY = (cHeight - renderHeight) * 0.5;

    ctx.drawImage(targetImg, offsetX, offsetY, renderWidth, renderHeight);
  }

  // Linear Interpolation loop for buttery-smooth scrubbing
  function animationLoop() {
    const diff = targetFraction - currentFraction;

    if (Math.abs(diff) > 0.0001) {
      // 0.1 gives immediate, buttery liquid momentum
      currentFraction += diff * 0.1;
    } else {
      currentFraction = targetFraction;
    }

    const frameIndex = Math.min(
      FRAME_COUNT - 1,
      Math.max(0, Math.round(currentFraction * (FRAME_COUNT - 1)))
    );

    if (frameIndex !== lastRenderedIndex || needsRedraw) {
      renderFrame(frameIndex);
      lastRenderedIndex = frameIndex;
      needsRedraw = false;
    }

    requestAnimationFrame(animationLoop);
  }

  function setFraction(newFraction) {
    targetFraction = Math.max(0, Math.min(1, newFraction));
    if (scrollIndicator) {
      if (targetFraction > 0.015) {
        scrollIndicator.classList.add('scrolled');
      } else {
        scrollIndicator.classList.remove('scrolled');
      }
    }
  }

  // Calculate scroll position across all document properties
  function updateScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );
    const maxScroll = docHeight - window.innerHeight;

    if (maxScroll > 0) {
      setFraction(scrollTop / maxScroll);
      // Instant render for 0ms scroll latency
      const directFrame = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.round(targetFraction * (FRAME_COUNT - 1)))
      );
      if (directFrame !== lastRenderedIndex) {
        renderFrame(directFrame);
        lastRenderedIndex = directFrame;
      }
    }
  }

  // Direct Wheel Listener: smooth responsiveness across all inputs
  window.addEventListener('wheel', (e) => {
    const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const maxScroll = docHeight - window.innerHeight;
    if (maxScroll <= 0) {
      // Direct virtual scrub if document scroll height isn't available
      setFraction(targetFraction + (e.deltaY * 0.0008));
    }
  }, { passive: true });

  // Drag-to-scrub support (click and drag vertically anywhere on the screen)
  let isDragging = false;
  let dragStartY = 0;
  let dragStartFraction = 0;

  window.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartY = e.clientY;
    dragStartFraction = targetFraction;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaY = dragStartY - e.clientY;
    const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const maxScroll = docHeight - window.innerHeight;
    const fractionDelta = deltaY / (window.innerHeight * 1.8);
    setFraction(dragStartFraction + fractionDelta);
    if (maxScroll > 0) {
      window.scrollTo(0, targetFraction * maxScroll);
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Touch gesture support for mobile/tablets
  let touchStartY = 0;
  let touchStartFraction = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartFraction = targetFraction;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    const touchY = e.touches[0].clientY;
    const deltaY = touchStartY - touchY;
    const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const maxScroll = docHeight - window.innerHeight;
    if (maxScroll <= 0) {
      setFraction(touchStartFraction + (deltaY / (window.innerHeight * 1.5)));
    }
  }, { passive: true });

  // Keyboard navigation support (Arrow keys, Space, PageUp/PageDown)
  window.addEventListener('keydown', (e) => {
    const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const maxScroll = docHeight - window.innerHeight;
    if (maxScroll <= 0) {
      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        setFraction(targetFraction + 0.04);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        setFraction(targetFraction - 0.04);
      }
    }
  });

  // Preload all frames progressively with concurrency
  function preloadImages() {
    const CONCURRENCY = 16;
    let nextIndex = 0;
    let activeWorkers = 0;

    function onFrameLoad(index, img) {
      loadedFlags[index] = 1;
      loadedCount++;

      const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
      if (loaderPercent) {
        loaderPercent.textContent = `${pct}%`;
      }

      // Render frame 0 immediately
      if (index === 0 && lastRenderedIndex === -1) {
        renderFrame(0);
        lastRenderedIndex = 0;
      }

      // Hide loader once initial buffer is ready
      if (loadedCount >= 5 || loadedCount === FRAME_COUNT) {
        hideLoader();
      }
    }

    function spawnWorker() {
      if (nextIndex >= FRAME_COUNT) return;

      const idx = nextIndex++;
      activeWorkers++;

      const img = new Image();
      images[idx] = img;

      img.onload = () => {
        onFrameLoad(idx, img);
        activeWorkers--;
        spawnWorker();
      };

      img.onerror = () => {
        activeWorkers--;
        spawnWorker();
      };

      img.src = FRAME_PATH(idx);
    }

    // Load frame 0 first with top priority
    const firstImg = new Image();
    images[0] = firstImg;
    nextIndex = 1;

    firstImg.onload = () => {
      onFrameLoad(0, firstImg);
      for (let i = 0; i < CONCURRENCY; i++) {
        spawnWorker();
      }
    };

    firstImg.onerror = () => {
      for (let i = 0; i < CONCURRENCY; i++) {
        spawnWorker();
      }
    };

    firstImg.src = FRAME_PATH(0);
  }

  // Setup event listeners
  window.addEventListener('scroll', updateScroll, { passive: true });
  document.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', () => {
    resizeCanvas();
    updateScroll();
  }, { passive: true });

  // Initialize
  resizeCanvas();
  preloadImages();
  updateScroll();
  requestAnimationFrame(animationLoop);
})();
