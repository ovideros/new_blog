---
title: 魔改hugo footnote与数学公式，实现漂亮的引用
description: 增加脚注悬停功能，以及数学公式引擎从KaTeX改为MathJax
slug: hugo_footnote
date: 2025-10-13
categories:
    - 技术
tags:
    - hugo
weight: 0
---

## 脚注
本博客基于 Hugo 框架[^1]，使用 hugo-theme-stack 主题[^2]搭建。

为了方便之后我在正文中进行引用，我希望“魔改”一下 footnote 脚注功能。原始的 footnote 只能显示数字，光标放上去可以跳转到文末处的链接，但是无法直接显示，这就导致你需要反复跳转，很麻烦。

有些网站[^3]便实现了方便的预览功能，只需要悬停，即可查看并复制脚注中的文本。

在 AI 帮助下，此种行为自然很容易达成。

首先，修改 `assets/scss/custom.scss` 文件：
```scss
/* Tippy 内置 light-border 主题的细节微调，结合 Stack 的浅/深色方案。 */
.tippy-box[data-theme~='light-border'] {
    color: var(--card-text-color-main);
    font-size: 1.4rem;
    line-height: 1.6;
    box-shadow: var(--shadow-l4);
    border-radius: var(--card-border-radius);
}

.tippy-box[data-theme~='light-border'] .tippy-content {
    padding: 1rem 1.2rem;
}

.tippy-box[data-theme~='light-border'] a {
    color: var(--accent-color);
    text-decoration: underline;
}
[data-scheme="light"] .tippy-box[data-theme~='light-border'] {
    background-color: #ffffff;
    border-color: rgba(0, 0, 0, 0.08);
}

[data-scheme="light"] .tippy-box[data-theme~='light-border'][data-placement^='top'] > .tippy-arrow::before {
    border-top-color: #ffffff;
}

[data-scheme="light"] .tippy-box[data-theme~='light-border'][data-placement^='bottom'] > .tippy-arrow::before {
    border-bottom-color: #ffffff;
}

[data-scheme="light"] .tippy-box[data-theme~='light-border'][data-placement^='left'] > .tippy-arrow::before {
    border-left-color: #ffffff;
}

[data-scheme="light"] .tippy-box[data-theme~='light-border'][data-placement^='right'] > .tippy-arrow::before {
    border-right-color: #ffffff;
}

[data-scheme="dark"] .tippy-box[data-theme~='light-border'] {
    background-color: rgba(54, 54, 54, 1);
    color: rgba(255, 255, 255, 0.92);
    border-color: rgba(255, 255, 255, 0.14);
    box-shadow: 0 20px 45px -25px rgba(0, 0, 0, 0.8);
}

[data-scheme="dark"] .tippy-box[data-theme~='light-border'][data-placement^='top'] > .tippy-arrow::before {
    border-top-color: rgba(54, 54, 54, 1);
}

[data-scheme="dark"] .tippy-box[data-theme~='light-border'][data-placement^='bottom'] > .tippy-arrow::before {
    border-bottom-color: rgba(54, 54, 54, 1);
}

[data-scheme="dark"] .tippy-box[data-theme~='light-border'][data-placement^='left'] > .tippy-arrow::before {
    border-left-color: rgba(54, 54, 54, 1);
}

[data-scheme="dark"] .tippy-box[data-theme~='light-border'][data-placement^='right'] > .tippy-arrow::before {
    border-right-color: rgba(54, 54, 54, 1);
}
```

在 `layouts/partials/head/custom.html` 中加入相关的库：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tippy.js@6.3.7/dist/tippy.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tippy.js@6.3.7/dist/themes/light-border.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tippy.js@6.3.7/animations/shift-away.css">
```

在 `layouts/partials/footer/custom.html` 中实现逻辑：
```html
<script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/umd/popper.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/tippy.js@6.3.7/dist/tippy-bundle.umd.min.js" defer></script>
<script>
document.addEventListener('DOMContentLoaded', function () {
    if (typeof tippy === 'undefined') {
        return;
    }

    var noteRefs = document.querySelectorAll('a.footnote-ref[role="doc-noteref"]');
    if (!noteRefs.length) {
        return;
    }

    var noteCache = new Map();

    noteRefs.forEach(function (ref) {
        var targetId = ref.getAttribute('href');
        if (!targetId || targetId.charAt(0) !== '#') {
            return;
        }

        targetId = targetId.slice(1);
        var note = document.getElementById(targetId);
        if (!note) {
            return;
        }

        if (!noteCache.has(targetId)) {
            var clone = note.cloneNode(true);

            clone.querySelectorAll('.footnote-backref').forEach(function (backref) {
                backref.remove();
            });

            noteCache.set(targetId, clone.innerHTML.trim());
        }

        tippy(ref, {
            content: noteCache.get(targetId),
            allowHTML: true,
            interactive: true,
            theme: 'light-border',
            maxWidth: 360,
            appendTo: document.body,
            placement: 'auto',
            touch: ['hold', 400],
            animation: 'shift-away',
        });
    });
});
</script>
```

这样就可以正确实现想要的功能了。

## 公式

此外，原先的KaTeX最多只支持数学公式标号，但是没法做到交叉引用。如果未来要写一些更复杂的文章，这点有些麻烦。

于是，询问AI有啥解决途径，回答到使用MathJax。查了查Hugo本身就支持KaTeX与MathJax[^4]，并且我记得苏建林的博客中用的也是MathJax[^5]，遂让AI帮我写一写。

写了后有问题，AI自己根据本地导出的html分析，解决了问题。最后需要修改两个文件。

首先，还是那段 `layouts/partials/article/components/math.html`：
```html
{{/* 用 MathJax 替换 Hugo Stack 默认的 KaTeX，实现 \label/\ref 等高级特性。 */}}
<script>
  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      tags: 'ams',
      processEscapes: true,
      packages: {'[+]': ['ams']}
    },
    options: {
      skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'annotation', 'annotation-xml'],
      ignoreHtmlClass: 'gist|no-mathjax',
      processHtmlClass: 'main-article'
    },
    loader: {
      load: ['[tex]/ams']
    }
  };
</script>
<script async id="MathJax-script" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
```

其次，主题自带的 `smoothAnchors.ts` 会给所有 `href="#…"` 的链接挂平滑滚动逻辑，MathJax 重排时这些锚点会短暂无效，结果就报错。于是覆盖掉它：在 `assets/ts/smoothAnchors.ts` 新建同名文件，只在目标不是 `#mjx-eqn-...` 时才继续平滑滚动。MathJax 生成的引用链接就交给浏览器默认行为，既不会报错，也不会影响脚注、目录等其它锚点。

`assets/ts/smoothAnchors.ts` 代码如下：
```ts
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
```

相比于KaTeX，MathJax可以直接右键公式，复制Tex源码，这点挺方便的。


同时，也支持交叉引用，例如我可以在此交叉引用下面的公式，见 \eqref{eq:m} 。

$$
\begin{equation}
\begin{cases}
\nabla \cdot \mathbf{E} = \frac{\rho}{\epsilon_0} \\
\nabla \cdot \mathbf{B} = 0 \\
\nabla \times \mathbf{E} = -\frac{\partial \mathbf{B}}{\partial t} \\
\nabla \times \mathbf{B} = \mu_0 \mathbf{J} + \mu_0 \epsilon_0 \frac{\partial \mathbf{E}}{\partial t}
\end{cases}
\label{eq:m}
\end{equation}
$$


## 小结

折腾一番，总算让博客看起来更加美观，也更方便未来更新更多内容了（）



## 参考文献
[^1]: Hugo. https://gohugo.io/
[^2]: Hugo Theme Stack. https://github.com/CaiJimmy/hugo-theme-stack
[^3]: Yang Song. Generative Modeling by Estimating Gradients of the Data Distribution
. https://yang-song.net/blog/2021/score/
[^4]: Hugo. Mathematics in Markdown
. https://gohugo.io/content-management/mathematics/
[^5]: 科学空间. https://spaces.ac.cn/
