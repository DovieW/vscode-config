document.addEventListener('DOMContentLoaded', function() {
  let retryCount = 0;
  const checkElement = setInterval(() => {
    const commandDialog = document.querySelector(".quick-input-widget");
    if (commandDialog) {
      // Apply the blur effect immediately if the command dialog is visible
      if (commandDialog.style.display !== "none") {
        runMyScript();
      }
      // Create an DOM observer to 'listen' for changes in element's attribute.
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "style"
          ) {
            if (commandDialog.style.display === "none") {
              handleEscape();
            } else {
              // If the .quick-input-widget element (command palette) is in the DOM
              // but no inline style display: none, show the backdrop blur.
              runMyScript();
            }
          }
        });
      });

      observer.observe(commandDialog, { attributes: true });

      // Clear the interval once the observer is set
      clearInterval(checkElement);
    } else {
      if (retryCount < 5) {
        console.log("Command dialog not found yet. Retrying...");
      } else if (retryCount === 5) {
        console.log("(suppressing further command dialog retry logs)");
      }
      retryCount++;
    }
  }, 500); // Check every 500ms

  // Execute when command palette was launched.
  document.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "p") {
      event.preventDefault();
      runMyScript();
    } else if (event.key === "Escape" || event.key === "Esc") {
      event.preventDefault();
      handleEscape();
    }
  });

  // Ensure the escape key event listener is at the document level
  document.addEventListener(
    "keydown",
    function (event) {
      if (event.key === "Escape" || event.key === "Esc") {
        handleEscape();
      }
    },
    true
  );

  function runMyScript() {
    const targetDiv = document.querySelector(".monaco-workbench");

    // Remove existing element if it already exists
    const existingElement = document.getElementById("command-blur");
    existingElement && existingElement.remove();

    // Create and configure the new element
    const newElement = document.createElement("div");
    newElement.setAttribute("id", "command-blur");

    newElement.addEventListener("click", function () {
      newElement.remove();
    });

    // Append the new element as a child of the targetDiv
    targetDiv.appendChild(newElement);

    // Hide the sticky widget
    const widgets = document.querySelectorAll(".sticky-widget");
    widgets.forEach((widget) => {
      widget.style.opacity = 0;
    });

    // Hide the tree sticky widget
    const treeWidget = document.querySelector(".monaco-tree-sticky-container");
    treeWidget && (treeWidget.style.opacity = 0);

    // Also update the empty-editor label if applicable
    updateEmptyEditorLabel();
  }

  // Remove the backdrop blur from the DOM when esc key is pressed.
  function handleEscape() {
    const element = document.getElementById("command-blur");
    element && element.click();

    // Show the sticky widget
    const widgets = document.querySelectorAll(".sticky-widget");
    widgets.forEach((widget) => {
      widget.style.opacity = 1;
    });

    // Show the tree sticky widget
    const treeWidget = document.querySelector(".monaco-tree-sticky-container");
    treeWidget && (treeWidget.style.opacity = 1);
  }

  // Create or update a subtle label under the empty-editor icon when there are no open editors.
  // More robust detection: look for an editor group container that has the 'empty' state and a '.letterpress' child.
  function updateEmptyEditorLabel() {
    const emptyGroup = document.querySelector(".editor-group-container.empty");
    const letterpress = emptyGroup
      ? emptyGroup.querySelector(".letterpress")
      : null;
    const existingLabel = document.getElementById("empty-editor-window-label");

    if (letterpress) {
      // Ensure the letterpress is position relative without breaking existing layout
      if (getComputedStyle(letterpress).position === "static") {
        letterpress.style.position = "relative";
      }
      // No-workspace: remove any label, suppress text, and exit
      if (isNoWorkspaceWindow()) {
        existingLabel && existingLabel.remove();
        toggleLetterpressSuppression(letterpress, true);
        document.body.classList.add('no-workspace');
        return;
      } else {
        document.body.classList.remove('no-workspace');
      }
      const workspaceName = parseWorkspaceName();
      if (!workspaceName) {
        toggleLetterpressSuppression(letterpress, true);
        existingLabel && existingLabel.remove();
        return;
      }
      toggleLetterpressSuppression(letterpress, false);
      if (existingLabel) {
        existingLabel.textContent = workspaceName;
        return; // Already present & updated.
      }
      const label = document.createElement("div");
      label.id = "empty-editor-window-label";
      label.className = "empty-editor-window-label";
      label.textContent = workspaceName;
      letterpress.appendChild(label);
    } else {
      existingLabel && existingLabel.remove();
    }
  }

  // Parse workspace/folder name from window title.
  // Patterns observed:
  //  - "FolderName - Visual Studio Code"
  //  - "FolderName - Visual Studio Code - Insiders"
  //  - "Visual Studio Code" (no workspace)
  //  - "Visual Studio Code - Insiders" (no workspace Insiders)
  function parseWorkspaceName() {
    const title = (document.title || '').trim();
    const productSuffixPattern = /( - Visual Studio Code(?: - Insiders)?)/i;
    const idx = title.search(productSuffixPattern);
    if (idx === -1) {
      // No recognizable product suffix; treat as no workspace to avoid showing wrong label.
      return '';
    }
    const before = title.slice(0, idx).trim();
    // If nothing before suffix, it's a bare product window (no workspace)
    if (!before) return '';
    return before;
  }
  // Determine if this window has no workspace/folder open using heuristics (title + absence of explorer items)
  function isNoWorkspaceWindow() {
    return parseWorkspaceName() === '';
  }

  // Toggle class-based suppression (more resilient than per-span visibility changes)
  function toggleLetterpressSuppression(letterpress, hide) {
    if (!letterpress) return;
    if (hide) {
      letterpress.classList.add('suppress-product-text');
    } else {
      letterpress.classList.remove('suppress-product-text');
    }
  }

  // getWorkspaceDisplayName no longer needed; parseWorkspaceName already returns cleaned name.

  // Wrap raw text nodes inside letterpress that match product naming so CSS can hide them uniformly.
  function wrapProductNameText(letterpress) {
    if (!letterpress) return;
    const targetPatterns = /(Visual Studio Code|VS Code)/i;
    const walker = document.createTreeWalker(letterpress, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        // Skip anything inside our custom label container
        if (node.parentElement && node.parentElement.closest('#empty-editor-window-label')) return NodeFilter.FILTER_REJECT;
        if (targetPatterns.test(node.nodeValue)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_REJECT;
      }
    });
    const toWrap = [];
    let current;
    while ((current = walker.nextNode())) {
      // Skip if already wrapped
      if (current.parentElement && current.parentElement.classList.contains('wrapped-product-name')) continue;
      toWrap.push(current);
    }
    toWrap.forEach(textNode => {
      const span = document.createElement('span');
      span.className = 'wrapped-product-name';
      span.textContent = textNode.nodeValue;
      textNode.parentNode.replaceChild(span, textNode);
    });
  }

  // Observe letterpress for changes to re-wrap product text if VS Code re-renders it
  const letterpressObserver = new MutationObserver(() => {
    const emptyGroup = document.querySelector('.editor-group-container.empty');
    const letterpress = emptyGroup ? emptyGroup.querySelector('.letterpress') : null;
    wrapProductNameText(letterpress);
    if (isNoWorkspaceWindow()) {
      toggleLetterpressSuppression(letterpress, true);
    }
  });
  letterpressObserver.observe(document.body, { childList: true, subtree: true });

  // Observe DOM mutations to keep the label in sync when editors open/close or layout changes
  const layoutObserver = new MutationObserver((mutationList) => {
    // Only run when editor group containers or letterpress nodes are added/removed
    const relevant = mutationList.some(
      (m) =>
        Array.from(m.addedNodes).some(
          (n) =>
            n.classList &&
            (n.classList.contains("editor-group-container") ||
              n.classList.contains("letterpress"))
        ) ||
        Array.from(m.removedNodes).some(
          (n) =>
            n.classList &&
            (n.classList.contains("editor-group-container") ||
              n.classList.contains("letterpress"))
        )
    );
    if (relevant) updateEmptyEditorLabel();
  });
  layoutObserver.observe(document.body, { childList: true, subtree: true });

  // Initial attempt shortly after load (some elements appear late)
  updateEmptyEditorLabel();
  setTimeout(updateEmptyEditorLabel, 500);
  setTimeout(updateEmptyEditorLabel, 1500);
  // Also attempt product text wrapping & suppression early
  setTimeout(() => {
    const emptyGroup = document.querySelector('.editor-group-container.empty');
    const letterpress = emptyGroup ? emptyGroup.querySelector('.letterpress') : null;
    wrapProductNameText(letterpress);
    if (isNoWorkspaceWindow()) toggleLetterpressSuppression(letterpress, true);
  }, 300);

  // Observe title changes (some builds update document.title asynchronously)
  const titleObserver = new MutationObserver(() => {
    const emptyGroup = document.querySelector('.editor-group-container.empty');
    const letterpress = emptyGroup ? emptyGroup.querySelector('.letterpress') : null;
    if (letterpress) enforceLetterpressSuppression(letterpress);
  });
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver.observe(titleEl, { childList: true });
  }
  // One-shot post-load enforcement (in case elements appear after DOMContentLoaded)
  setTimeout(() => {
    const emptyGroup = document.querySelector('.editor-group-container.empty');
    const letterpress = emptyGroup ? emptyGroup.querySelector('.letterpress') : null;
    if (letterpress) enforceLetterpressSuppression(letterpress);
  }, 800);
});

// Examine pseudo-element content and title heuristics to decide if product text must be hidden.
function enforceLetterpressSuppression(letterpress){
  const title = (document.title||'').trim();
  const pseudoAfter = getComputedStyle(letterpress,'::after').getPropertyValue('content');
  const pseudoBefore = getComputedStyle(letterpress,'::before').getPropertyValue('content');
  const productPattern = /(Visual Studio Code|VS Code)/i;
  const hasProductPseudo = productPattern.test(pseudoAfter) || productPattern.test(pseudoBefore);
  const looksBareTitle = productPattern.test(title) && !/[-|—|–].+/.test(title);
  if (looksBareTitle || hasProductPseudo) {
    // Remove any injected label
    const lbl = document.getElementById('empty-editor-window-label');
    if (lbl) lbl.remove();
    letterpress.classList.add('suppress-product-text');
    document.body.classList.add('no-workspace');
    // Aggressively remove descendant elements that contain ONLY product text (fallback for unexpected structure)
    const descendants = letterpress.querySelectorAll('*');
    descendants.forEach(el => {
      if (!el.children.length && productPattern.test(el.textContent.trim()) ) {
        el.remove();
      }
    });
    // Remove stray text nodes directly under letterpress
    Array.from(letterpress.childNodes).forEach(n => {
      if (n.nodeType === Node.TEXT_NODE && productPattern.test(n.nodeValue.trim())) {
        n.parentNode.removeChild(n);
      }
    });
    if (localStorage.getItem('ccjsDebug') === '1') {
      console.log('[custom-css-js] Suppressed product text; title="'+title+'"');
    }
  }
}

// change explorer title
(function () {
  const SEL = '#workbench\\.parts\\.sidebar h2';

  const apply = () => {
    const el = document.querySelector(SEL);
    if (!el) return false;
    if (el.textContent !== 'Files') el.textContent = 'Files';
    return true;
  };

  // Try once now; if not present, or if VS Code later rewrites it, watch DOM.
  if (!apply()) {
    const obs = new MutationObserver(() => apply());
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
})();

