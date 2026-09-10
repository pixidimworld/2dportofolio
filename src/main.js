import "./style.css";
import bgMusicUrl from "../music.mp3";
import paperSlideSoundUrl from "../paper slide.wav";

const root = document.documentElement;
const scene = document.querySelector(".hero-scene");
const parallaxAssets = document.querySelectorAll(".parallax-asset");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const supportsFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const siteLoader = document.querySelector("#site-loader");
const loaderPercent = document.querySelector(".loader-percent");
const loaderProgressTrack = document.querySelector(".loader-progress-track");
const tutorialCamera = document.querySelector(".scrapbook-world");
const tutorialOverlay = document.querySelector("[data-tutorial-overlay]");
const tutorialCue = document.querySelector("[data-tutorial-cue]");
const tutorialCueLabel = tutorialCue?.querySelector(".tutorial-cue-label");
const tutorialCueSublabel = tutorialCue?.querySelector(".tutorial-cue-sublabel");
const tutorialStorageKey = "pixidimworld:interaction-tutorial:v2";

const NAV_ZOOM_LEVELS = [1.0, 1.012, 1.023, 1.034, 1.045, 1.055];

let bgMusic = null;
let bgMusicStarted = false;
let bgMusicWasPlayingBeforeHidden = false;
let isAwaitingUserResume = false;
let paperSound = null;

function initBgMusic() {
  if (!bgMusic) {
    bgMusic = new Audio(bgMusicUrl);
    bgMusic.loop = true;
    bgMusic.volume = 0.2;
    bgMusic.preload = "auto";
  }
  return bgMusic;
}

function cleanupMusicResumeListeners() {
  if (!isAwaitingUserResume) return;
  isAwaitingUserResume = false;
  window.removeEventListener("pointerdown", onUserInteractionResume, { capture: true });
  window.removeEventListener("keydown", onUserInteractionResume, { capture: true });
}

function onUserInteractionResume(event) {
  if (event && event.type === "keydown") {
    const isSpaceOrEnter =
      event.code === "Space" ||
      event.code === "Enter" ||
      event.key === " " ||
      event.key === "Enter";
    if (!isSpaceOrEnter) return;
  }

  if (bgMusic && bgMusicWasPlayingBeforeHidden) {
    bgMusic.volume = 0.2;
    const playPromise = bgMusic.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          bgMusicStarted = true;
          bgMusicWasPlayingBeforeHidden = false;
          cleanupMusicResumeListeners();
        })
        .catch(() => {
          // Autoplay policy or gesture state prevented playback; retry on next valid gesture
        });
    } else {
      bgMusicStarted = true;
      bgMusicWasPlayingBeforeHidden = false;
      cleanupMusicResumeListeners();
    }
  } else {
    cleanupMusicResumeListeners();
  }
}

function setupMusicResumeListeners() {
  if (isAwaitingUserResume) return;
  isAwaitingUserResume = true;
  window.addEventListener("pointerdown", onUserInteractionResume, { capture: true, passive: true });
  window.addEventListener("keydown", onUserInteractionResume, { capture: true, passive: true });
}

function pauseBgMusicOnLeave() {
  if (bgMusic && !bgMusic.paused) {
    bgMusicWasPlayingBeforeHidden = true;
    bgMusic.pause();
  }
  cleanupMusicResumeListeners();
}

function handleVisibilityChange() {
  if (document.hidden) {
    pauseBgMusicOnLeave();
  } else if (bgMusicWasPlayingBeforeHidden) {
    setupMusicResumeListeners();
  }
}

document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("pagehide", pauseBgMusicOnLeave);

function startBgMusic() {
  if (root.classList.contains("is-loading")) return;

  if (bgMusic && bgMusic.paused && bgMusicWasPlayingBeforeHidden) {
    onUserInteractionResume();
    return;
  }

  if (bgMusicStarted) return;

  const audio = initBgMusic();
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        bgMusicStarted = true;
      })
      .catch(() => {
        // Autoplay policy prevented playback; will retry on next user interaction gesture.
      });
  }
}

function initPaperSound() {
  if (!paperSound) {
    paperSound = new Audio(paperSlideSoundUrl);
    paperSound.preload = "auto";
  }
  return paperSound;
}

function playPaperFallSound() {
  try {
    const sound = initPaperSound();
    sound.currentTime = 0;
    const playPromise = sound.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Handled silently if autoplay policy or interaction state interferes
      });
    }
  } catch {
    // Silent fallback
  }
}

const entrancePlan = [
  [".edge-decor-year", -1, -1],
  [".edge-decor-bulb", -1, -1],
  [".edge-decor-file", -1, 0],
  [".edge-decor-paint", 0, -1],
  [".edge-decor-brush", -1, 1],
  [".edge-decor-star", 1, -1],
  [".edge-decor-radio", -1, 1],
  [".edge-decor-crayon", 1, 1],
  [".edge-decor-pencil", 1, 1],
  [".edge-decor-smiley", -1, 0],
  [".edge-decor-glue", 1, -1],
  [".edge-decor-laptop", 1, -1],
  [".edge-decor-notes", 1, 0],
  [".edge-decor-pin", 1, 0],
  [".edge-decor-eye", 1, 1],
];
let entranceAnimations = [];

let targetX = 0;
let targetY = 0;
let currentX = 0;
let currentY = 0;
let frameId = 0;
let orientationOrigin = null;
let tutorialStep = "idle";
let tutorialTarget = null;
let tutorialSyncFrame = 0;
let tutorialSyncUntil = 0;
let tutorialCameraState = { x: 0, y: 0, scale: 1 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderParallax() {
  currentX += (targetX - currentX) * 0.075;
  currentY += (targetY - currentY) * 0.075;

  parallaxAssets.forEach((item) => {
    const depth = Number(item.dataset.depth || 0);
    item.style.setProperty("--parallax-x", `${currentX * depth}px`);
    item.style.setProperty("--parallax-y", `${currentY * depth}px`);
  });

  const stillMoving =
    Math.abs(targetX - currentX) > 0.001 ||
    Math.abs(targetY - currentY) > 0.001;

  frameId = stillMoving ? requestAnimationFrame(renderParallax) : 0;
}

function queueParallax() {
  if (!frameId) frameId = requestAnimationFrame(renderParallax);
}

function handlePointerMove(event) {
  if (
    prefersReducedMotion.matches ||
    !supportsFinePointer.matches ||
    event.pointerType === "touch"
  ) return;

  targetX = (event.clientX / window.innerWidth - 0.5) * 2;
  targetY = (event.clientY / window.innerHeight - 0.5) * 2;
  queueParallax();
}

function handleTouchMove(event) {
  if (prefersReducedMotion.matches || supportsFinePointer.matches) return;

  const touch = event.touches[0];
  if (!touch) return;

  targetX = clamp((touch.clientX / window.innerWidth - 0.5) * 0.7, -0.35, 0.35);
  targetY = clamp((touch.clientY / window.innerHeight - 0.5) * 0.7, -0.35, 0.35);
  queueParallax();
}

function handleDeviceOrientation(event) {
  if (
    prefersReducedMotion.matches ||
    supportsFinePointer.matches ||
    !Number.isFinite(event.beta) ||
    !Number.isFinite(event.gamma)
  ) return;

  if (!orientationOrigin) {
    orientationOrigin = { beta: event.beta, gamma: event.gamma };
  }

  targetX = clamp((event.gamma - orientationOrigin.gamma) / 32, -0.42, 0.42);
  targetY = clamp((event.beta - orientationOrigin.beta) / 32, -0.42, 0.42);
  queueParallax();
}

function resetParallax() {
  targetX = 0;
  targetY = 0;
  queueParallax();
}

function hasCompletedTutorial() {
  try {
    return (
      window.sessionStorage.getItem(tutorialStorageKey) === "complete" ||
      window.localStorage.getItem(tutorialStorageKey) === "complete"
    );
  } catch {
    return false;
  }
}

function saveTutorialCompletion() {
  try {
    window.sessionStorage.setItem(tutorialStorageKey, "complete");
    window.localStorage.setItem(tutorialStorageKey, "complete");
  } catch {
    // Storage fallback
  }
}

function updateNavFocusZoom(index) {
  if (prefersReducedMotion.matches || (tutorialStep !== "complete" && tutorialStep !== "idle")) return;
  const clampedIndex = clamp(index, 0, NAV_ZOOM_LEVELS.length - 1);
  const zoom = NAV_ZOOM_LEVELS[clampedIndex];
  root.style.setProperty("--nav-focus-zoom", String(zoom));
}

function syncTutorialFocus() {
  tutorialSyncFrame = 0;
  if (!tutorialTarget || (tutorialStep !== "step_1" && tutorialStep !== "step_2")) return;

  const rect = tutorialTarget.getBoundingClientRect();
  const padX = Math.max(18, Math.min(34, rect.width * 0.16));
  const padY = Math.max(14, Math.min(26, rect.height * 0.42));
  root.style.setProperty("--tutorial-focus-x", `${rect.left + rect.width / 2}px`);
  root.style.setProperty("--tutorial-focus-y", `${rect.top + rect.height / 2}px`);
  root.style.setProperty("--tutorial-focus-width", `${rect.width + padX * 2}px`);
  root.style.setProperty("--tutorial-focus-height", `${rect.height + padY * 2}px`);

  if (tutorialCue) {
    const cueWidth = Math.min(300, Math.max(220, window.innerWidth - 32));
    const cueLeft = clamp(rect.left + rect.width / 2 - cueWidth / 2, 16, window.innerWidth - cueWidth - 16);
    const spaceAbove = rect.top;
    const cueTop = spaceAbove > 120
      ? Math.max(16, rect.top - 110)
      : Math.min(window.innerHeight - 90, rect.bottom + 16);
    tutorialCue.style.setProperty("--tutorial-cue-left", `${cueLeft}px`);
    tutorialCue.style.setProperty("--tutorial-cue-top", `${cueTop}px`);
    tutorialCue.style.setProperty("--tutorial-cue-width", `${cueWidth}px`);
    tutorialCue.classList.toggle("is-below", spaceAbove <= 120);
  }

  if (performance.now() < tutorialSyncUntil) {
    tutorialSyncFrame = requestAnimationFrame(syncTutorialFocus);
  }
}

function focusTutorialTarget(target, step) {
  if (!target || !tutorialCamera || !tutorialOverlay || !tutorialCue) return;

  tutorialTarget = target;
  tutorialStep = step;
  const rect = target.getBoundingClientRect();
  const viewportCenterX = window.innerWidth / 2;
  const viewportCenterY = window.innerHeight / 2;
  const current = tutorialCameraState;
  const baseX = viewportCenterX + (rect.left + rect.width / 2 - current.x - viewportCenterX) / current.scale;
  const baseY = viewportCenterY + (rect.top + rect.height / 2 - current.y - viewportCenterY) / current.scale;

  const isMobile = window.innerWidth <= 800;
  let scale = 1;
  let x = 0;
  let y = 0;

  if (!prefersReducedMotion.matches) {
    if (step === "step_1") {
      scale = isMobile ? 1.045 : 1.07;
      x = clamp(-(baseX - viewportCenterX) * 0.32, -window.innerWidth * 0.08, window.innerWidth * 0.08);
      y = clamp(-(baseY - viewportCenterY) * 0.32, -window.innerHeight * 0.08, window.innerHeight * 0.08);
    } else {
      scale = isMobile ? 1.035 : 1.055;
      x = clamp(-(baseX - viewportCenterX) * 0.22, -window.innerWidth * 0.06, window.innerWidth * 0.06);
      y = clamp(
        -(baseY - viewportCenterY) * 0.62,
        -window.innerHeight * 0.16,
        -window.innerHeight * 0.04
      );
    }
  }

  tutorialCameraState = { x, y, scale };
  root.style.setProperty("--tutorial-camera-x", `${x}px`);
  root.style.setProperty("--tutorial-camera-y", `${y}px`);
  root.style.setProperty("--tutorial-camera-scale", String(scale));
  root.dataset.tutorialStep = step;
  root.classList.add("is-tutorial-active");
  tutorialOverlay.hidden = false;
  tutorialOverlay.setAttribute("aria-hidden", "false");
  tutorialCue.hidden = false;
  tutorialCue.setAttribute("aria-hidden", "false");

  if (tutorialCueLabel) {
    tutorialCueLabel.textContent = step === "step_1"
      ? "Click to see next page"
      : "Reverse brings the previous page back";
  }

  tutorialSyncUntil = performance.now() + (prefersReducedMotion.matches ? 80 : 760);
  cancelAnimationFrame(tutorialSyncFrame);
  tutorialSyncFrame = requestAnimationFrame(syncTutorialFocus);
}

let tutorialAdvanceLock = 0;

function advanceTutorial(event) {
  if (tutorialStep !== "step_1" && tutorialStep !== "step_2") return;
  const now = performance.now();
  if (now < tutorialAdvanceLock) return;
  tutorialAdvanceLock = now + 420;

  if (event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  startBgMusic();

  if (tutorialStep === "step_1") {
    showReverseTutorial();
  } else if (tutorialStep === "step_2") {
    finishInteractionTutorial();
  }
}

function startInteractionTutorial() {
  if (
    tutorialStep !== "idle" ||
    hasCompletedTutorial() ||
    location.hash ||
    currentPaperIndex !== 0
  ) return;

  const nextTrigger = document.querySelector(".clipboard-paper.is-active [data-next-paper]");
  if (!nextTrigger) return;
  focusTutorialTarget(nextTrigger, "step_1");
}

function showReverseTutorial() {
  if (tutorialStep !== "step_1") return;
  if (!reversePaperTrigger) {
    finishInteractionTutorial();
    return;
  }
  focusTutorialTarget(reversePaperTrigger, "step_2");
}

function finishInteractionTutorial() {
  if (tutorialStep !== "step_1" && tutorialStep !== "step_2") return;

  tutorialStep = "complete";
  tutorialTarget = null;
  cancelAnimationFrame(tutorialSyncFrame);
  tutorialSyncFrame = 0;
  tutorialCameraState = { x: 0, y: 0, scale: 1 };
  root.style.setProperty("--tutorial-camera-x", "0px");
  root.style.setProperty("--tutorial-camera-y", "0px");
  root.style.setProperty("--tutorial-camera-scale", "1");
  root.classList.add("is-tutorial-leaving");
  saveTutorialCompletion();

  window.setTimeout(() => {
    root.classList.remove("is-tutorial-active", "is-tutorial-leaving");
    delete root.dataset.tutorialStep;
    if (tutorialOverlay) {
      tutorialOverlay.hidden = true;
      tutorialOverlay.setAttribute("aria-hidden", "true");
    }
    if (tutorialCue) {
      tutorialCue.hidden = true;
      tutorialCue.setAttribute("aria-hidden", "true");
    }
    [
      "--tutorial-camera-x",
      "--tutorial-camera-y",
      "--tutorial-camera-scale",
      "--tutorial-focus-x",
      "--tutorial-focus-y",
      "--tutorial-focus-width",
      "--tutorial-focus-height",
    ].forEach((property) => root.style.removeProperty(property));
    updateNavFocusZoom(currentPaperIndex);
  }, prefersReducedMotion.matches ? 20 : 520);
}

function finishEntrance() {
  root.classList.remove("has-entrance", "is-entering");
  entranceAnimations.forEach((animation) => animation.cancel());
  entranceAnimations = [];
  window.setTimeout(startInteractionTutorial, prefersReducedMotion.matches ? 20 : 140);
}

function playEntrance() {
  if (prefersReducedMotion.matches) {
    finishEntrance();
    return;
  }

  const officeBook = document.querySelector(".hero-center-art");
  if (!officeBook) {
    finishEntrance();
    return;
  }

  const bookRect = officeBook.getBoundingClientRect();
  const bookTravel = window.innerHeight - bookRect.top + Math.max(28, bookRect.height * 0.04);
  const bookAnimation = officeBook.animate(
    [
      { opacity: 0, translate: `0 ${bookTravel}px`, scale: "0.985" },
      { opacity: 1, translate: "0 -4px", scale: "1.003", offset: 0.84 },
      { opacity: 1, translate: "0 0", scale: "1" },
    ],
    {
      duration: 760,
      easing: "cubic-bezier(0.2, 0.72, 0.24, 1)",
      fill: "both",
    },
  );

  entranceAnimations = [bookAnimation];
  entrancePlan.forEach(([selector, horizontalDirection, verticalDirection], index) => {
    const item = document.querySelector(selector);
    if (!item || getComputedStyle(item).display === "none") return;

    const itemRect = item.getBoundingClientRect();
    const horizontalTravel = horizontalDirection < 0
      ? -(itemRect.right + 24)
      : horizontalDirection > 0
        ? window.innerWidth - itemRect.left + 24
        : 0;
    const verticalTravel = verticalDirection < 0
      ? -(itemRect.bottom + 24)
      : verticalDirection > 0
        ? window.innerHeight - itemRect.top + 24
        : 0;
    const animation = item.animate(
      [
        { opacity: 0, translate: `${horizontalTravel}px ${verticalTravel}px` },
        { opacity: 1, translate: "0 0" },
      ],
      {
        delay: 100 + index * 45,
        duration: 540,
        easing: "cubic-bezier(0.22, 0.78, 0.24, 1)",
        fill: "both",
      },
    );
    entranceAnimations.push(animation);
  });

  root.classList.add("is-entering");
  root.classList.remove("has-entrance");
  Promise.allSettled(entranceAnimations.map((animation) => animation.finished)).then(finishEntrance);
}

function waitForImage(image) {
  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      resolve();
    };

    if (image.complete) {
      if (typeof image.decode === "function") {
        image.decode().catch(() => {}).finally(finish);
      } else {
        finish();
      }
      return;
    }

    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
  });
}

function updateLoaderProgress(value) {
  siteLoader?.style.setProperty("--loader-progress", `${value}%`);
  if (loaderPercent) loaderPercent.textContent = `${value}%`;
  loaderProgressTrack?.setAttribute("aria-valuenow", String(value));
}

async function loadSiteImages() {
  if (!siteLoader) {
    root.classList.remove("is-loading");
    playCurrentSceneEntrance();
    return;
  }

  const backgroundImage = new Image();
  backgroundImage.src = "/background.png";

  const images = [...document.images, backgroundImage];
  let loadedImages = 0;
  let displayedProgress = 1;
  let availableProgress = 1;
  let finishCounter;

  updateLoaderProgress(displayedProgress);

  const counterDone = new Promise((resolve) => {
    finishCounter = resolve;
  });

  const counter = window.setInterval(() => {
    if (displayedProgress >= availableProgress) return;

    displayedProgress += 1;
    updateLoaderProgress(displayedProgress);

    if (displayedProgress === 100) {
      window.clearInterval(counter);
      finishCounter();
    }
  }, 25);

  const imageTasks = images.map((image) =>
    waitForImage(image).then(() => {
      loadedImages += 1;
      availableProgress = Math.max(
        availableProgress,
        Math.min(99, Math.floor((loadedImages / images.length) * 99)),
      );
    }),
  );

  await Promise.all([
    Promise.all(imageTasks),
    document.fonts?.ready || Promise.resolve(),
  ]);

  availableProgress = 100;
  await counterDone;
  siteLoader.classList.add("is-leaving");

  window.setTimeout(() => {
    siteLoader.remove();
    root.classList.remove("is-loading");
    playCurrentSceneEntrance();
  }, 520);
}

scene?.addEventListener("pointermove", handlePointerMove, { passive: true });
scene?.addEventListener("pointerleave", resetParallax, { passive: true });
scene?.addEventListener("touchmove", handleTouchMove, { passive: true });
scene?.addEventListener("touchend", resetParallax, { passive: true });
window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
window.addEventListener("orientationchange", () => {
  orientationOrigin = null;
  resetParallax();
});
prefersReducedMotion.addEventListener("change", (event) => {
  if (event.matches) resetParallax();
});
supportsFinePointer.addEventListener("change", (event) => {
  orientationOrigin = null;
  resetParallax();
});

const heroScene = document.querySelector(".hero-scene");
const projectsScene = document.querySelector(".projects-page");
const contactScene = document.querySelector(".contact-scene");
const hobbiesScene = document.querySelector(".hobbies-page");
const projectsTriggers = document.querySelectorAll('a[href="#projects"]');
const contactTriggers = document.querySelectorAll('a[href="#contact"]');
const hobbiesTriggers = document.querySelectorAll('a[href="#hobbies"]');
const projectsHomeTrigger = document.querySelector("[data-scene-home]");
const contactHomeTrigger = document.querySelector("[data-contact-home]");
const hobbiesHomeTrigger = document.querySelector("[data-hobbies-home]");
const contactForm = document.querySelector("#contact-form");
const contactStatus = document.querySelector(".contact-status");
const clipboardContactForm = document.querySelector("#clipboard-contact-form");
const clipboardContactStatus = document.querySelector(".clipboard-contact-status");
const reversePaperTrigger = document.querySelector("[data-reverse-paper]");
const whatsappNumber = "250798685100";
let sceneTransitioning = false;

const stickerSceneSelectors = new Map([
  [projectsScene, ".projects-home, .projects-heading h2 > *, .projects-heading p, .projects-browser, .projects-filters button, .featured-project, .project-mini, .projects-quote, .projects-decor, .project-ribbon, .project-tape, .project-mini-label"],
  [contactScene, ".contact-home, .contact-paper, .contact-tape, .contact-kicker, .contact-paper h2, .contact-field, .contact-actions, .contact-footnote"],
  [hobbiesScene, ".hobbies-home, .hobbies-heading h2 > *, .hobbies-heading p, .hobbies-note, .hobbies-headphones, .hobby-card, .hobby-card-tape, .hobby-card h3, .hobby-card-icon, .hobbies-corner, .hobbies-footer"],
]);
const stickerAnimations = new WeakMap();

function stickerEntrance(sceneElement, startDelay = 70) {
  if (!sceneElement || prefersReducedMotion.matches) return;

  const selector = stickerSceneSelectors.get(sceneElement);
  const sceneRect = sceneElement.getBoundingClientRect();
  const elements = [...sceneElement.querySelectorAll(selector)]
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
    });

  const motions = elements.map((element, index) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 - sceneRect.left;
    const centerY = rect.top + rect.height / 2 - sceneRect.top;
    const horizontalStep = Math.min(68, Math.max(30, sceneRect.width * 0.045));
    const verticalStep = Math.min(52, Math.max(24, sceneRect.height * 0.045));
    let x = 0;
    let y = 0;

    if (centerX < sceneRect.width * 0.38) x = -horizontalStep;
    else if (centerX > sceneRect.width * 0.62) x = horizontalStep;

    if (centerY < sceneRect.height * 0.3) y = -verticalStep;
    else if (centerY > sceneRect.height * 0.72) y = verticalStep;
    else if (!x) y = index % 2 ? verticalStep * 0.72 : -verticalStep * 0.72;

    const rotation = (((index * 7) % 9) - 4) * 0.75 || 1.2;
    return { element, index, x, y, rotation };
  });

  motions.forEach(({ element, index, x, y, rotation }) => {
    stickerAnimations.get(element)?.cancel();
    element.style.willChange = "opacity, translate, rotate, scale";

    const animation = element.animate([
      { opacity: 0, translate: `${x}px ${y}px`, rotate: `${rotation}deg`, scale: "0.9 0.94" },
      { opacity: 1, translate: `${-x * 0.07}px ${-y * 0.07}px`, rotate: `${-rotation * 0.22}deg`, scale: "1.025 0.985", offset: 0.66 },
      { opacity: 1, translate: `${x * 0.025}px ${y * 0.025}px`, rotate: `${rotation * 0.08}deg`, scale: "0.995 1.008", offset: 0.84 },
      { opacity: 1, translate: "0 0", rotate: "0deg", scale: "1 1" },
    ], {
      delay: startDelay + index * 28,
      duration: 430 + (index % 4) * 24,
      easing: "cubic-bezier(0.2, 0.78, 0.24, 1)",
      fill: "both",
    });

    stickerAnimations.set(element, animation);
    animation.addEventListener("finish", () => {
      if (stickerAnimations.get(element) !== animation) return;
      animation.cancel();
      stickerAnimations.delete(element);
      element.style.removeProperty("will-change");
    }, { once: true });
  });
}

function playCurrentSceneEntrance() {
  const currentScene = getCurrentScene();
  if (currentScene === "home") {
    playEntrance();
    return;
  }

  const sceneElement = currentScene === "projects"
    ? projectsScene
    : currentScene === "contact"
      ? contactScene
      : hobbiesScene;
  stickerEntrance(sceneElement, 40);
}

function getCurrentScene() {
  if (root.classList.contains("show-projects")) return "projects";
  if (root.classList.contains("show-contact")) return "contact";
  if (root.classList.contains("show-hobbies")) return "hobbies";
  return "home";
}

function setScene(nextScene, updateUrl = true) {
  if (sceneTransitioning || getCurrentScene() === nextScene) return;

  const showProjects = nextScene === "projects";
  const showContact = nextScene === "contact";
  const showHobbies = nextScene === "hobbies";
  sceneTransitioning = true;
  root.classList.toggle("show-projects", showProjects);
  root.classList.toggle("show-contact", showContact);
  root.classList.toggle("show-hobbies", showHobbies);
  heroScene?.setAttribute("aria-hidden", String(showProjects || showContact || showHobbies));
  projectsScene?.setAttribute("aria-hidden", String(!showProjects));
  contactScene?.setAttribute("aria-hidden", String(!showContact));
  hobbiesScene?.setAttribute("aria-hidden", String(!showHobbies));

  const entranceScene = showProjects
    ? projectsScene
    : showContact
      ? contactScene
      : showHobbies
        ? hobbiesScene
        : null;
  if (entranceScene) stickerEntrance(entranceScene);

  if (updateUrl) {
    const target = nextScene === "home" ? location.pathname + location.search : `#${nextScene}`;
    history.replaceState(null, "", target);
  }

  window.setTimeout(() => {
    sceneTransitioning = false;
    const focusTarget = showProjects
      ? projectsHomeTrigger
      : showContact
        ? contactForm?.elements.name
        : showHobbies
          ? hobbiesHomeTrigger
          : projectsTriggers[0];
    focusTarget?.focus({ preventScroll: true });
  }, prefersReducedMotion.matches ? 0 : 700);
}

projectsTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    setScene("projects");
  });
});

contactTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    setScene("contact");
  });
});

projectsHomeTrigger?.addEventListener("click", () => setScene("home"));
hobbiesTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    setScene("hobbies");
  });
});

contactHomeTrigger?.addEventListener("click", () => setScene("home"));
hobbiesHomeTrigger?.addEventListener("click", () => setScene("home"));

contactForm?.addEventListener("input", (event) => {
  event.target.closest(".contact-field")?.classList.remove("is-invalid");
  contactStatus?.classList.remove("is-error");
  if (contactStatus) contactStatus.textContent = "";
});

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const nameField = contactForm.elements.name;
  const detailsField = contactForm.elements.project_details;
  const requiredFields = [nameField, detailsField];
  requiredFields.forEach((field) => {
    field.closest(".contact-field")?.classList.toggle("is-invalid", !field.value.trim());
  });

  if (!contactForm.reportValidity()) {
    if (contactStatus) {
      contactStatus.textContent = "Please complete both required fields.";
      contactStatus.classList.add("is-error");
    }
    return;
  }

  const message = [
    `Name: ${nameField.value.trim()}`,
    `Website request: ${detailsField.value.trim()}`,
    "Estimated project range: $200 - $1,000",
  ].join("\n");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  if (contactStatus) contactStatus.textContent = "Opening WhatsApp...";
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
});

clipboardContactForm?.addEventListener("input", (event) => {
  const field = event.target.closest(".clipboard-contact-field");
  if (!field) return;

  event.target.setCustomValidity("");
  field.classList.remove("is-invalid");
  clipboardContactStatus?.classList.remove("is-error");
  if (clipboardContactStatus) clipboardContactStatus.textContent = "";
});

clipboardContactForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const nameField = clipboardContactForm.elements.name;
  const websiteTypeField = clipboardContactForm.elements.website_type;
  const requiredFields = [nameField, websiteTypeField];

  requiredFields.forEach((field) => {
    const isEmpty = !field.value.trim();
    field.setCustomValidity(isEmpty ? "Please complete this field." : "");
    field.closest(".clipboard-contact-field")?.classList.toggle("is-invalid", isEmpty);
  });

  if (!clipboardContactForm.reportValidity()) {
    if (clipboardContactStatus) {
      clipboardContactStatus.textContent = "Please complete both fields.";
      clipboardContactStatus.classList.add("is-error");
    }
    return;
  }

  const message = `Hi, my name is ${nameField.value.trim()}. I'm interested in building a ${websiteTypeField.value.trim()} website.`;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  if (clipboardContactStatus) clipboardContactStatus.textContent = "Opening WhatsApp...";
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
});

const paperOrder = ["welcome", "services", "designs", "more-designs", "projects", "contact"];
let currentPaperIndex = Math.max(
  0,
  paperOrder.indexOf(document.querySelector(".clipboard-paper.is-active")?.dataset.page),
);
let paperTransitioning = false;

function getPaperDirection(paper) {
  const paperIndex = [...document.querySelectorAll(".clipboard-paper")].indexOf(paper);
  return paperIndex % 2 === 0 ? -1 : 1;
}

function getPaperMotion(paper, direction) {
  const paperRect = paper.getBoundingClientRect();
  return {
    fallDistance:
      window.innerHeight - paperRect.top + paperRect.height + Math.max(80, paperRect.height * 0.22),
    horizontalDrift:
      Math.min(96, Math.max(34, window.innerWidth * 0.075)) * direction,
    finalRotation: 13 * direction,
  };
}

function updatePaperNavigation() {
  document.querySelectorAll("[data-next-paper]").forEach((trigger) => {
    const pageName = trigger.closest(".clipboard-paper")?.dataset.page;
    const pageIndex = paperOrder.indexOf(pageName);
    const disabled = paperTransitioning || pageIndex !== currentPaperIndex || pageIndex >= paperOrder.length - 1;
    trigger.disabled = disabled;
    trigger.setAttribute("aria-disabled", String(disabled));
  });

  if (reversePaperTrigger) {
    const disabled = paperTransitioning || currentPaperIndex === 0;
    reversePaperTrigger.disabled = disabled;
    reversePaperTrigger.setAttribute("aria-disabled", String(disabled));
  }
}

function paperFall(paper, direction = 1) {
  if (prefersReducedMotion.matches) return Promise.resolve();

  const { fallDistance, horizontalDrift, finalRotation } = getPaperMotion(paper, direction);

  paper.classList.add("is-falling");

  const animation = paper.animate(
    [
      {
        translate: "0 0",
        rotate: "0deg",
        offset: 0,
        easing: "cubic-bezier(0.18, 0.72, 0.3, 1)",
      },
      {
        translate: "0 11px",
        rotate: `${direction * 0.7}deg`,
        offset: 0.16,
        easing: "cubic-bezier(0.36, 0.08, 0.72, 0.32)",
      },
      {
        translate: `${horizontalDrift * 0.14}px 42px`,
        rotate: `${direction * 2.4}deg`,
        offset: 0.34,
        easing: "cubic-bezier(0.45, 0.03, 0.92, 0.46)",
      },
      {
        translate: `${horizontalDrift}px ${fallDistance}px`,
        rotate: `${finalRotation}deg`,
        offset: 1,
      },
    ],
    {
      duration: 820,
      easing: "linear",
      fill: "forwards",
    },
  );

  return animation.finished.then(() => {
    animation.cancel();
    paper.classList.remove("is-falling");
  });
}

function paperReturn(paper, direction = 1) {
  if (prefersReducedMotion.matches) return Promise.resolve();

  const { fallDistance, horizontalDrift, finalRotation } = getPaperMotion(paper, direction);
  paper.classList.add("is-returning");

  const animation = paper.animate(
    [
      {
        translate: `${horizontalDrift}px ${fallDistance}px`,
        rotate: `${finalRotation}deg`,
        offset: 0,
      },
      {
        translate: `${horizontalDrift * 0.14}px 42px`,
        rotate: `${direction * 2.4}deg`,
        offset: 0.66,
        easing: "cubic-bezier(0.18, 0.72, 0.3, 1)",
      },
      {
        translate: "0 11px",
        rotate: `${direction * 0.7}deg`,
        offset: 0.86,
      },
      {
        translate: "0 0",
        rotate: "0deg",
        offset: 1,
      },
    ],
    {
      duration: 820,
      easing: "cubic-bezier(0.22, 0.68, 0.24, 1)",
      fill: "forwards",
    },
  );

  return animation.finished.then(() => {
    animation.cancel();
    paper.classList.remove("is-returning");
  });
}

async function nextPaper(trigger) {
  if (paperTransitioning) return;

  const currentPaper = trigger.closest(".clipboard-paper");
  const nextPageName = trigger.dataset.nextPaper;
  const nextSheet = document.querySelector(`[data-page="${nextPageName}"]`);
  const currentIndex = paperOrder.indexOf(currentPaper?.dataset.page);
  const nextIndex = paperOrder.indexOf(nextPageName);

  if (
    !currentPaper?.classList.contains("is-active") ||
    !nextSheet ||
    currentIndex !== currentPaperIndex ||
    nextIndex !== currentPaperIndex + 1
  ) return;

  const fallDirection = getPaperDirection(currentPaper);
  const clipboard = currentPaper.closest(".clipboard");

  paperTransitioning = true;
  updatePaperNavigation();
  updateNavFocusZoom(nextIndex);
  clipboard?.classList.add("is-paper-animating");

  try {
    playPaperFallSound();
    await paperFall(currentPaper, fallDirection);
    currentPaper.classList.remove("is-active");
    currentPaper.classList.add("is-passed");
    currentPaper.setAttribute("aria-hidden", "true");
    currentPaper.inert = true;
    nextSheet.classList.add("is-active");
    nextSheet.setAttribute("aria-hidden", "false");
    nextSheet.inert = false;
    currentPaperIndex = nextIndex;
    nextSheet.focus({ preventScroll: true });
  } finally {
    clipboard?.classList.remove("is-paper-animating");
    paperTransitioning = false;
    updatePaperNavigation();
    updateNavFocusZoom(currentPaperIndex);
  }
}

async function reversePaper() {
  if (paperTransitioning || currentPaperIndex === 0) return;

  const currentPaper = document.querySelector(".clipboard-paper.is-active");
  const previousIndex = currentPaperIndex - 1;
  const previousPaper = document.querySelector(`[data-page="${paperOrder[previousIndex]}"]`);
  if (!currentPaper || !previousPaper?.classList.contains("is-passed")) return;

  const clipboard = currentPaper.closest(".clipboard");
  const returnDirection = getPaperDirection(previousPaper);
  paperTransitioning = true;
  updatePaperNavigation();
  updateNavFocusZoom(previousIndex);
  clipboard?.classList.add("is-paper-animating");
  previousPaper.classList.remove("is-passed");

  try {
    await paperReturn(previousPaper, returnDirection);
    currentPaper.classList.remove("is-active");
    currentPaper.setAttribute("aria-hidden", "true");
    currentPaper.inert = true;
    previousPaper.classList.add("is-active");
    previousPaper.setAttribute("aria-hidden", "false");
    previousPaper.inert = false;
    currentPaperIndex = previousIndex;
    previousPaper.focus({ preventScroll: true });
  } finally {
    clipboard?.classList.remove("is-paper-animating");
    paperTransitioning = false;
    updatePaperNavigation();
    updateNavFocusZoom(currentPaperIndex);
  }
}

document.addEventListener("click", (event) => {
  if (tutorialStep === "step_1" || tutorialStep === "step_2") {
    advanceTutorial(event);
    return;
  }

  const trigger = event.target.closest("[data-next-paper]");
  if (!trigger) return;

  startBgMusic();
  event.preventDefault();
  nextPaper(trigger);
}, { capture: true });

window.addEventListener("keydown", (event) => {
  if (tutorialStep !== "step_1" && tutorialStep !== "step_2") return;
  if (event.code === "Space" || event.code === "Enter" || event.key === " " || event.key === "Enter") {
    advanceTutorial(event);
  }
});

reversePaperTrigger?.addEventListener("click", () => {
  if (tutorialStep === "step_1" || tutorialStep === "step_2") return;
  startBgMusic();
  reversePaper();
});

document.addEventListener("click", () => {
  if (!bgMusicStarted) {
    startBgMusic();
  }
});

window.addEventListener("resize", () => {
  if (tutorialStep !== "step_1" && tutorialStep !== "step_2") return;
  focusTutorialTarget(tutorialTarget, tutorialStep);
}, { passive: true });
updatePaperNavigation();

if (location.hash === "#projects") {
  root.classList.add("show-projects");
  heroScene?.setAttribute("aria-hidden", "true");
  projectsScene?.setAttribute("aria-hidden", "false");
} else if (location.hash === "#contact") {
  root.classList.add("show-contact");
  heroScene?.setAttribute("aria-hidden", "true");
  contactScene?.setAttribute("aria-hidden", "false");
} else if (location.hash === "#hobbies") {
  root.classList.add("show-hobbies");
  heroScene?.setAttribute("aria-hidden", "true");
  hobbiesScene?.setAttribute("aria-hidden", "false");
}
root.classList.add("is-ready");
loadSiteImages();
