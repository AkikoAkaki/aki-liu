import { FONT_MONO, staggerFontChange } from "./text-effects.js";

export function initSearchPlaceholder() {
    // --- Search placeholder animation ---
    const searchBar = document.querySelector(".archive-search");
    if (searchBar) {
      const input = searchBar.querySelector(".search-input");
      const fakePlaceholder = searchBar.querySelector(
        ".search-fake-placeholder",
      );
      if (fakePlaceholder && input) {
        let searchTimers = [];
        let searchDebounce = null;
        let isHidden = false;
        let isPlaceholderWrapped = false;

        function initPlaceholder() {
          if (isPlaceholderWrapped) return;
          const text = fakePlaceholder.textContent;
          fakePlaceholder.innerHTML = "";
          [...text].forEach((char) => {
            if (char === " ") {
              fakePlaceholder.appendChild(document.createTextNode(char));
            } else {
              const span = document.createElement("span");
              span.className = "link-char";
              span.textContent = char;
              fakePlaceholder.appendChild(span);
            }
          });
          isPlaceholderWrapped = true;
        }

        function getChars() {
          return [...fakePlaceholder.querySelectorAll(".link-char")];
        }

        function cancelSearch() {
          searchTimers.forEach(clearTimeout);
          searchTimers = [];
        }

        function animateToMono() {
          initPlaceholder();
          cancelSearch();
          const chars = getChars();
          searchTimers = staggerFontChange(chars, (char) => {
            char.style.fontFamily = FONT_MONO;
          });
        }

        function animateToSans() {
          if (!isPlaceholderWrapped) return;
          cancelSearch();
          const chars = getChars().reverse();
          searchTimers = staggerFontChange(chars, (char) => {
            char.style.fontFamily = "";
          });
        }

        searchBar.addEventListener("mouseenter", () => {
          clearTimeout(searchDebounce);
          searchDebounce = setTimeout(() => {
            if (!isHidden) animateToMono();
          }, 20);
        });

        searchBar.addEventListener("mouseleave", () => {
          clearTimeout(searchDebounce);
          searchDebounce = setTimeout(() => {
            if (!isHidden) animateToSans();
          }, 20);
        });

        searchBar.addEventListener("click", () => input.focus());

        input.addEventListener("focus", () => {
          if (!isHidden) {
            isHidden = true;
            cancelSearch();
            fakePlaceholder.classList.add("is-hiding");
          }
        });

        fakePlaceholder.addEventListener("animationend", () => {
          if (isHidden) fakePlaceholder.style.opacity = "0";
        });

        input.addEventListener("blur", () => {
          if (input.value === "") {
            isHidden = false;
            fakePlaceholder.classList.remove("is-hiding");
            fakePlaceholder.style.opacity = "";
            if (isPlaceholderWrapped) {
              getChars().forEach((char) => {
                char.style.fontFamily = "";
              });
            }
          }
        });
      }
    }
}
