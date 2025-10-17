const anchorLinksQuery = "a[href]";
const mathJaxAnchorPrefix = "#mjx-eqn-";

const isMathJaxAnchor = (href: string): boolean => {
  try {
    return decodeURI(href).startsWith(mathJaxAnchorPrefix);
  } catch {
    return href.startsWith(mathJaxAnchorPrefix);
  }
};

function setupSmoothAnchors(): void {
  document.querySelectorAll<HTMLAnchorElement>(anchorLinksQuery).forEach((aElement) => {
    const rawHref = aElement.getAttribute("href");
    if (!rawHref || !rawHref.startsWith("#")) {
      return;
    }

    if (isMathJaxAnchor(rawHref)) {
      return;
    }

    aElement.addEventListener("click", (event) => {
      let decodedHref: string;
      try {
        decodedHref = decodeURI(rawHref);
      } catch {
        decodedHref = rawHref;
      }

      const targetId = decodedHref.substring(1);
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }

      event.preventDefault();

      const offset =
        target.getBoundingClientRect().top - document.documentElement.getBoundingClientRect().top;

      window.history.pushState({}, "", rawHref);
      scrollTo({
        top: offset,
        behavior: "smooth",
      });
    });
  });
}

export { setupSmoothAnchors };
