import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { imageUrl } from './paths';

function noteMarkdown() {
  return (tree, file) => {
    const first = tree.children[0];
    const image = first?.type === 'paragraph' && first.children.length === 1 && first.children[0];
    if (image?.type === 'image') {
      file.data.astro.frontmatter.cover = { src: imageUrl(image.url, file.data.astro.frontmatter.day), alt: image.alt || '' };
    }
    function resolveImages(node) {
      if (node.type === 'image' || node.type === 'definition') node.url = imageUrl(node.url, file.data.astro.frontmatter.day);
      node.children?.forEach(resolveImages);
    }
    resolveImages(tree);

  };
}

export const processor = await createMarkdownProcessor({ remarkPlugins: [noteMarkdown] });
